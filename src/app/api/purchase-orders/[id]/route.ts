import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  adjustShopifyInventory,
  inventoryItemGid,
  locationGid,
} from "@/lib/shopify/inventory";
import {
  assertPartialInvoiceAllowed,
  assertScanReceiveAllowed,
} from "@/lib/billing/limits";
import { sendPurchaseOrderEmail } from "@/lib/email/po-send";
import { purchaseOrderPdfBase64, type PoDetail } from "@/lib/export/po-pdf";

export const dynamic = "force-dynamic";

const receiveSchema = z.object({
  lines: z.array(
    z.object({
      poLineItemId: z.string().uuid(),
      quantity: z.number().int().min(1),
    }),
  ),
  invoice: z
    .object({
      invoiceNumber: z.string().optional(),
      invoiceAmount: z.number().optional(),
      invoicedAt: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  notes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(
        `*, suppliers(*), locations(*),
         po_line_items(*, variants(sku, title, barcode, shopify_variant_id, shopify_inventory_item_id)),
         po_receipts(*, po_receipt_lines(*), po_receipt_invoices(*))`,
      )
      .eq("id", params.id)
      .eq("shop_id", ctx.store.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ purchaseOrder: data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "PO not found" }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const body = await request.json();
    const supabase = createAdminClient();

    if (body.action === "send") {
      const { data: fullPo, error: fetchError } = await supabase
        .from("purchase_orders")
        .select(
          `*, suppliers(name, email), locations(name),
           po_line_items(ordered_qty, received_qty, unit_cost, variants(sku, title, barcode))`,
        )
        .eq("id", params.id)
        .eq("shop_id", ctx.store.id)
        .single();

      if (fetchError || !fullPo) throw fetchError ?? new Error("PO not found");

      if (fullPo.status !== "draft") {
        return NextResponse.json(
          { error: `Cannot send a PO with status "${fullPo.status}"` },
          { status: 409 },
        );
      }

      const supplier = Array.isArray(fullPo.suppliers)
        ? fullPo.suppliers[0]
        : fullPo.suppliers;
      const location = Array.isArray(fullPo.locations)
        ? fullPo.locations[0]
        : fullPo.locations;

      if (!supplier?.email) {
        return NextResponse.json(
          {
            error:
              "Supplier has no email address. Add an email on the Vendors page, then send again.",
            email: { sent: false, reason: "no_supplier_email" },
          },
          { status: 400 },
        );
      }

      const emailResult = await sendPurchaseOrderEmail({
        to: supplier.email,
        poNumber: fullPo.po_number,
        supplierName: supplier.name,
        locationName: location?.name ?? "",
        lineCount: (fullPo.po_line_items ?? []).length,
        pdfBase64: purchaseOrderPdfBase64(fullPo as PoDetail),
      });

      if (!emailResult.sent) {
        const reason =
          emailResult.reason === "resend_not_configured" ||
          emailResult.reason === "email_not_configured"
            ? "Email is not configured (missing RESEND_API_KEY). PO was not marked as sent."
            : `Email failed (${emailResult.reason ?? "unknown"}). PO was not marked as sent.`;
        return NextResponse.json(
          { error: reason, email: emailResult },
          { status: 502 },
        );
      }

      const { data, error } = await supabase
        .from("purchase_orders")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", params.id)
        .eq("shop_id", ctx.store.id)
        .select("*")
        .single();
      if (error) throw error;

      return NextResponse.json({ purchaseOrder: data, email: emailResult });
    }

    if (body.action === "receive") {
      const parsed = receiveSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      if (parsed.data.lines.length === 0) {
        return NextResponse.json({ error: "No lines to receive" }, { status: 400 });
      }

      const hasInvoiceFields =
        parsed.data.invoice?.invoiceNumber ||
        parsed.data.invoice?.invoiceAmount ||
        parsed.data.invoice?.invoicedAt ||
        parsed.data.invoice?.notes;

      if (hasInvoiceFields) {
        const blocked = assertPartialInvoiceAllowed(ctx.store);
        if (blocked) {
          return NextResponse.json({ error: blocked }, { status: 403 });
        }
      }

      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .select(
          `*, locations(shopify_location_id),
           po_line_items(id, variant_id, ordered_qty, received_qty,
             variants(shopify_inventory_item_id))`,
        )
        .eq("id", params.id)
        .eq("shop_id", ctx.store.id)
        .single();

      if (poError) throw poError;

      if (po.status !== "sent" && po.status !== "partially_received") {
        return NextResponse.json(
          { error: `Cannot receive a PO with status "${po.status}"` },
          { status: 409 },
        );
      }

      const location = Array.isArray(po.locations) ? po.locations[0] : po.locations;
      if (!location) throw new Error("Location missing");

      const { data: receipt, error: receiptError } = await supabase
        .from("po_receipts")
        .insert({
          shop_id: ctx.store.id,
          purchase_order_id: po.id,
          notes: parsed.data.notes ?? null,
        })
        .select("id")
        .single();

      if (receiptError) throw receiptError;

      const poLines = (Array.isArray(po.po_line_items) ? po.po_line_items : []) as {
        id: string;
        variant_id: string;
        ordered_qty: number;
        received_qty: number;
        variants: { shopify_inventory_item_id: number | null } | { shopify_inventory_item_id: number | null }[];
      }[];
      let allReceived = true;
      const invalidLineIds: string[] = [];

      for (const line of parsed.data.lines) {
        const poLine = poLines.find((l) => l.id === line.poLineItemId);
        if (!poLine) {
          invalidLineIds.push(line.poLineItemId);
          continue;
        }

        if (poLine.received_qty + line.quantity > poLine.ordered_qty) {
          return NextResponse.json(
            {
              error: `Cannot receive ${line.quantity} units — line ${poLine.id} has ${poLine.ordered_qty - poLine.received_qty} remaining`,
            },
            { status: 400 },
          );
        }

        await supabase.from("po_receipt_lines").insert({
          shop_id: ctx.store.id,
          po_receipt_id: receipt.id,
          po_line_item_id: poLine.id,
          quantity: line.quantity,
        });

        const newReceived = poLine.received_qty + line.quantity;
        await supabase
          .from("po_line_items")
          .update({ received_qty: newReceived })
          .eq("id", poLine.id);

        if (newReceived < poLine.ordered_qty) allReceived = false;

        const variant = Array.isArray(poLine.variants)
          ? poLine.variants[0]
          : poLine.variants;

        if (variant?.shopify_inventory_item_id) {
          await adjustShopifyInventory(
            ctx.shop,
            inventoryItemGid(variant.shopify_inventory_item_id),
            locationGid(location.shopify_location_id),
            line.quantity,
            "received",
          );

          const { data: inv } = await supabase
            .from("inventory_levels")
            .select("id, available")
            .eq("variant_id", poLine.variant_id)
            .eq("location_id", po.location_id)
            .maybeSingle();

          if (inv) {
            await supabase
              .from("inventory_levels")
              .update({ available: inv.available + line.quantity, on_hand: inv.available + line.quantity })
              .eq("id", inv.id);
          }
        }
      }

      if (hasInvoiceFields) {
        await supabase.from("po_receipt_invoices").insert({
          shop_id: ctx.store.id,
          po_receipt_id: receipt.id,
          invoice_number: parsed.data.invoice?.invoiceNumber ?? null,
          invoice_amount: parsed.data.invoice?.invoiceAmount ?? null,
          invoiced_at: parsed.data.invoice?.invoicedAt ?? null,
          notes: parsed.data.invoice?.notes ?? null,
        });
      }

      const anyPartial = poLines.some((l) => {
        const recv = parsed.data.lines.find((x) => x.poLineItemId === l.id);
        const added = recv?.quantity ?? 0;
        return l.received_qty + added < l.ordered_qty;
      });

      const newStatus = allReceived && !anyPartial ? "received" : "partially_received";

      const { data: updated, error: updateError } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", params.id)
        .select("*")
        .single();

      if (updateError) throw updateError;
      return NextResponse.json({ purchaseOrder: updated, receiptId: receipt.id });
    }

    if (body.action === "scan") {
      const blocked = assertScanReceiveAllowed(ctx.store);
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 403 });
      }

      const { data: po } = await supabase
        .from("purchase_orders")
        .select("status")
        .eq("id", params.id)
        .eq("shop_id", ctx.store.id)
        .maybeSingle();
      if (!po || (po.status !== "sent" && po.status !== "partially_received")) {
        return NextResponse.json(
          { error: "Scan-to-receive is only available for sent or partially received POs" },
          { status: 409 },
        );
      }

      const barcode = body.barcode as string | undefined;
      const quantity = Number(body.quantity ?? 1);
      if (!barcode) {
        return NextResponse.json({ error: "barcode required" }, { status: 400 });
      }

      const { data: variant } = await supabase
        .from("variants")
        .select("id, sku, title")
        .eq("shop_id", ctx.store.id)
        .eq("barcode", barcode)
        .maybeSingle();

      if (!variant) {
        return NextResponse.json({ error: "Barcode not found" }, { status: 404 });
      }

      const { data: poLine } = await supabase
        .from("po_line_items")
        .select("id, ordered_qty, received_qty, variants(sku, title)")
        .eq("purchase_order_id", params.id)
        .eq("variant_id", variant.id)
        .maybeSingle();

      if (!poLine) {
        return NextResponse.json({ error: "Variant not on this PO" }, { status: 404 });
      }

      return NextResponse.json({
        poLineItemId: poLine.id,
        variant,
        orderedQty: poLine.ordered_qty,
        receivedQty: poLine.received_qty,
        scanQty: quantity,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "PO update failed" },
      { status: 500 },
    );
  }
}

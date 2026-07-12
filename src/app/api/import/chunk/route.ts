import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import {
  importPurchaseOrderRows,
  importSupplierRows,
} from "@/lib/import/chunk-import";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ChunkSchema = z.object({
  type: z.enum(["suppliers", "purchase_orders"]),
  chunkIndex: z.number().int().min(0),
  rowOffset: z.number().int().min(0).optional(),
  rows: z.array(z.record(z.string(), z.string())).max(15_000),
  createMissingSuppliers: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request);
    if (isNextResponse(ctx)) return ctx;

    const parsed = ChunkSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid chunk data", details: parsed.error.flatten() }, { status: 400 });
    }

    const { type, rows, rowOffset = 0, createMissingSuppliers } = parsed.data;

    const result =
      type === "suppliers"
        ? await importSupplierRows(ctx.store.id, rows, rowOffset)
        : await importPurchaseOrderRows(ctx.store.id, rows, {
            createMissingSuppliers: createMissingSuppliers ?? true,
            rowOffset,
          });

    return NextResponse.json({
      imported: result.created + result.updated,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.slice(0, 10),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Chunk import failed" }, { status: 500 });
  }
}

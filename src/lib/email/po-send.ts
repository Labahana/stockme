import { getFromEmail, getResendClient, requireResendInProduction } from "@/lib/email/client";

type PoEmailPayload = {
  to: string;
  poNumber: string;
  supplierName: string;
  locationName: string;
  lineCount: number;
  pdfBase64?: string;
};

export async function sendPurchaseOrderEmail(payload: PoEmailPayload) {
  const body = `Purchase Order ${payload.poNumber}

Supplier: ${payload.supplierName}
Ship to: ${payload.locationName}
Line items: ${payload.lineCount}

Please confirm receipt of this order.`;

  const emailCheck = requireResendInProduction();
  if (!emailCheck.ok) {
    return { sent: false, reason: emailCheck.reason };
  }

  const resend = getResendClient();
  if (!resend) {
    return { sent: false, reason: "resend_not_configured" };
  }

  const attachments = payload.pdfBase64
    ? [
        {
          filename: `${payload.poNumber}.pdf`,
          content: payload.pdfBase64,
        },
      ]
    : undefined;

  await resend.emails.send({
    from: getFromEmail(),
    to: payload.to,
    subject: `Purchase Order ${payload.poNumber}`,
    text: body,
    attachments,
  });

  return { sent: true };
}

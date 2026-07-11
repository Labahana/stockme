function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function assertEmailConfigured() {
  if (!emailConfigured()) {
    throw new Error(
      "Email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL in production.",
    );
  }
}

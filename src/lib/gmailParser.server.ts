// Server-only Gmail parser: extract merchant/amount/cycle/status from a message.

export type ParsedReceipt = {
  merchant: string | null;
  amount: number | null;
  currency: string;
  billingCycle: "Monthly" | "Annual" | "Weekly" | null;
  status: "active" | "canceled";
  subject: string;
};

const KNOWN_MERCHANTS = [
  "Netflix", "Spotify", "Disney+", "Disney Plus", "Hulu", "Adobe", "Apple",
  "iCloud", "Google", "YouTube", "Amazon Prime", "HBO", "Max", "Notion",
  "Dropbox", "GitHub", "OpenAI", "ChatGPT", "Anthropic", "Claude",
  "Microsoft 365", "Office 365", "Xbox", "PlayStation", "NYT", "New York Times",
  "Peloton", "Audible", "Kindle", "Slack", "Zoom", "Figma", "Linear",
  "Vercel", "Cloudflare", "Twitch",
];

const CANCEL_KEYWORDS = [
  "subscription canceled", "subscription cancelled", "will not renew",
  "has been canceled", "has been cancelled", "your cancellation",
  "cancellation confirmed", "canceled your subscription",
];

function decodeBase64Url(s: string): string {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  try { return Buffer.from(b64, "base64").toString("utf8"); } catch { return ""; }
}

function extractBodyText(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
    }
    for (const part of payload.parts) {
      const t = extractBodyText(part);
      if (t) return t;
    }
  }
  return "";
}

function findHeader(headers: any[], name: string): string {
  const h = headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? "";
}

function detectMerchant(text: string, from: string): string | null {
  const lower = text.toLowerCase();
  for (const m of KNOWN_MERCHANTS) {
    if (lower.includes(m.toLowerCase())) return m;
  }
  // fall back to sender domain
  const match = from.match(/@([^\s>]+)/);
  if (match) {
    const domain = match[1].split(".").slice(-2, -1)[0];
    if (domain) return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return null;
}

function detectAmountCurrency(text: string): { amount: number | null; currency: string } {
  // Match $12.99, USD 12.99, 12,99 €, £9.99, etc.
  const usd = text.match(/\$\s?(\d+(?:[.,]\d{2})?)/);
  if (usd) return { amount: parseFloat(usd[1].replace(",", ".")), currency: "USD" };
  const eur = text.match(/€\s?(\d+(?:[.,]\d{2})?)|(\d+(?:[.,]\d{2})?)\s?€/);
  if (eur) return { amount: parseFloat((eur[1] || eur[2]).replace(",", ".")), currency: "EUR" };
  const gbp = text.match(/£\s?(\d+(?:[.,]\d{2})?)/);
  if (gbp) return { amount: parseFloat(gbp[1].replace(",", ".")), currency: "GBP" };
  return { amount: null, currency: "USD" };
}

function detectCycle(text: string): ParsedReceipt["billingCycle"] {
  const lower = text.toLowerCase();
  if (/\b(annual|yearly|per year|\/year|12 months)\b/.test(lower)) return "Annual";
  if (/\b(weekly|per week|\/week)\b/.test(lower)) return "Weekly";
  if (/\b(monthly|per month|\/month|billed monthly)\b/.test(lower)) return "Monthly";
  return null;
}

export function parseGmailMessage(message: any): ParsedReceipt | null {
  const headers = message?.payload?.headers ?? [];
  const subject = findHeader(headers, "Subject");
  const from = findHeader(headers, "From");
  const body = extractBodyText(message?.payload) || message?.snippet || "";
  const combined = `${subject}\n${from}\n${body}`;

  const merchant = detectMerchant(combined, from);
  const { amount, currency } = detectAmountCurrency(combined);
  const cycle = detectCycle(combined);
  const lower = combined.toLowerCase();
  const canceled = CANCEL_KEYWORDS.some((k) => lower.includes(k));

  if (!merchant && !amount) return null;

  return {
    merchant,
    amount,
    currency,
    billingCycle: cycle,
    status: canceled ? "canceled" : "active",
    subject,
  };
}

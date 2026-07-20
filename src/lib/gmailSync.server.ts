// Server-only Gmail sync core (used by server fn AND cron route).
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";
import { decryptConnectionKey } from "@/lib/connectionKeyCrypto.server";
import { parseGmailMessage } from "@/lib/gmailParser.server";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";
const SEARCH_QUERY = 'subject:(receipt OR invoice OR subscription OR "renewal confirmation") newer_than:90d';

export async function syncGmailForUser(opts: {
  userId: string;
  encryptedKey: string;
  supabaseAdmin: any;
}): Promise<{ processed: number; created: number; updated: number; canceled: number }> {
  const { userId, encryptedKey, supabaseAdmin } = opts;
  const connectionAPIKey = decryptConnectionKey(encryptedKey);

  // 1. list messages
  const listRes = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: CONNECTOR_ID,
    path: `/gmail/v1/users/me/messages?maxResults=25&q=${encodeURIComponent(SEARCH_QUERY)}`,
  });
  if (!listRes.ok) throw new Error(`Gmail list ${listRes.status}: ${await listRes.text()}`);
  const listBody = (await listRes.json()) as { messages?: { id: string }[] };
  const messages = listBody.messages ?? [];

  let created = 0, updated = 0, canceled = 0;

  for (const m of messages) {
    // skip if already processed
    const { data: existing } = await supabaseAdmin
      .from("parsed_receipts")
      .select("id")
      .eq("user_id", userId)
      .eq("gmail_message_id", m.id)
      .maybeSingle();
    if (existing) continue;

    const msgRes = await callAsAppUser({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectionAPIKey,
      connectorId: CONNECTOR_ID,
      path: `/gmail/v1/users/me/messages/${m.id}?format=full`,
    });
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();
    const parsed = parseGmailMessage(msg);

    // Always log the receipt (even if unparseable) to avoid re-processing.
    await supabaseAdmin.from("parsed_receipts").insert({
      user_id: userId,
      gmail_message_id: m.id,
      raw_subject: parsed?.subject ?? null,
      merchant_detected: parsed?.merchant ?? null,
      amount: parsed?.amount ?? null,
      currency: parsed?.currency ?? null,
      billing_cycle: parsed?.billingCycle ?? null,
      detected_status: parsed?.status ?? null,
    });

    if (!parsed || !parsed.merchant) continue;

    // upsert subscription (unique on user_id + lower(service_name))
    const now = new Date().toISOString();
    const { data: existingSub } = await supabaseAdmin
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", userId)
      .ilike("service_name", parsed.merchant)
      .maybeSingle();

    if (parsed.status === "canceled") {
      if (existingSub) {
        await supabaseAdmin.from("subscriptions")
          .update({ status: "canceled", last_synced_at: now })
          .eq("id", existingSub.id);
        canceled++;
      }
      continue;
    }

    if (existingSub) {
      await supabaseAdmin.from("subscriptions").update({
        cost: parsed.amount ?? undefined,
        currency: parsed.currency,
        billing_cycle: parsed.billingCycle ?? undefined,
        status: "active",
        last_synced_at: now,
      }).eq("id", existingSub.id);
      updated++;
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        service_name: parsed.merchant,
        cost: parsed.amount ?? 0,
        currency: parsed.currency,
        billing_cycle: parsed.billingCycle ?? "Monthly",
        status: "active",
        source: "email_sync",
        last_synced_at: now,
      });
      created++;
    }
  }

  return { processed: messages.length, created, updated, canceled };
}

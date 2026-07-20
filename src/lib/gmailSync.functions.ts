import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeAppUserOAuth } from "@/integrations/lovable/appUserConnector";

const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
const CONNECTOR_ID = "google_mail";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export const startGmailConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetOrigin: z.string().url() }))
  .handler(async ({ data, context }) => {
    const clientAPIKey = process.env.GOOGLE_MAIL_APP_USER_CONNECTOR_CLIENT_API_KEY;
    if (!clientAPIKey) throw new Error("Gmail connector client is not configured.");
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl: `${data.targetOrigin}/auth/callback`,
      responseMode: "web_message",
      webMessageTargetOrigin: data.targetOrigin,
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return { authorizationUrl };
  });

export const saveGmailConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ connectionAPIKey: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { encryptConnectionKey } = await import("@/lib/connectionKeyCrypto.server");
    const { error } = await supabaseAdmin.from("app_user_connections").upsert({
      user_id: context.userId,
      connector_id: CONNECTOR_ID,
      connection_key_ciphertext: encryptConnectionKey(data.connectionAPIKey),
      last_sync_status: "connected",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,connector_id" });
    if (error) throw error;
    return { ok: true };
  });

export const disconnectGmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptConnectionKey } = await import("@/lib/connectionKeyCrypto.server");
    const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
    const { data } = await supabaseAdmin
      .from("app_user_connections")
      .select("connection_key_ciphertext")
      .eq("user_id", context.userId)
      .eq("connector_id", CONNECTOR_ID)
      .maybeSingle();
    if (data?.connection_key_ciphertext) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: decryptConnectionKey(data.connection_key_ciphertext),
          connectorId: CONNECTOR_ID,
        });
      } catch (e) { console.error("Gateway disconnect failed:", e); }
    }
    await supabaseAdmin.from("app_user_connections")
      .delete().eq("user_id", context.userId).eq("connector_id", CONNECTOR_ID);
    return { ok: true };
  });

export const getSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("app_user_connections")
      .select("last_synced_at, last_sync_status, last_sync_error, updated_at")
      .eq("user_id", context.userId)
      .eq("connector_id", CONNECTOR_ID)
      .maybeSingle();
    return {
      connected: !!data,
      lastSyncedAt: data?.last_synced_at ?? null,
      status: (data?.last_sync_status as string) ?? null,
      error: (data?.last_sync_error as string) ?? null,
    };
  });

export const listSyncedSubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subscriptions")
      .select("id, service_name, cost, currency, billing_cycle, next_renewal, category, status, source, last_synced_at")
      .eq("user_id", context.userId)
      .order("last_synced_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    return data ?? [];
  });

export const syncGmailNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncGmailForUser } = await import("@/lib/gmailSync.server");
    const { data: conn } = await supabaseAdmin
      .from("app_user_connections")
      .select("connection_key_ciphertext")
      .eq("user_id", context.userId)
      .eq("connector_id", CONNECTOR_ID)
      .maybeSingle();
    if (!conn) throw new Error("Gmail is not connected.");

    await supabaseAdmin.from("app_user_connections")
      .update({ last_sync_status: "syncing", last_sync_error: null })
      .eq("user_id", context.userId).eq("connector_id", CONNECTOR_ID);

    try {
      const result = await syncGmailForUser({
        userId: context.userId,
        encryptedKey: conn.connection_key_ciphertext,
        supabaseAdmin,
      });
      await supabaseAdmin.from("app_user_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          last_sync_status: "success",
          last_sync_error: null,
        })
        .eq("user_id", context.userId).eq("connector_id", CONNECTOR_ID);
      return { ok: true, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin.from("app_user_connections")
        .update({ last_sync_status: "error", last_sync_error: msg })
        .eq("user_id", context.userId).eq("connector_id", CONNECTOR_ID);
      throw new Error(msg);
    }
  });

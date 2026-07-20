// Cron endpoint: runs every 12h via pg_cron. Authenticated by Supabase anon apikey.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-subscriptions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncGmailForUser } = await import("@/lib/gmailSync.server");

        const { data: conns } = await supabaseAdmin
          .from("app_user_connections")
          .select("user_id, connection_key_ciphertext")
          .eq("connector_id", "google_mail");

        let ok = 0, failed = 0;
        for (const c of conns ?? []) {
          try {
            await supabaseAdmin.from("app_user_connections")
              .update({ last_sync_status: "syncing" })
              .eq("user_id", c.user_id).eq("connector_id", "google_mail");
            await syncGmailForUser({
              userId: c.user_id,
              encryptedKey: c.connection_key_ciphertext,
              supabaseAdmin,
            });
            await supabaseAdmin.from("app_user_connections").update({
              last_synced_at: new Date().toISOString(),
              last_sync_status: "success",
              last_sync_error: null,
            }).eq("user_id", c.user_id).eq("connector_id", "google_mail");
            ok++;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await supabaseAdmin.from("app_user_connections").update({
              last_sync_status: "error",
              last_sync_error: msg,
            }).eq("user_id", c.user_id).eq("connector_id", "google_mail");
            failed++;
          }
        }
        return Response.json({ ok, failed, total: conns?.length ?? 0 });
      },
    },
  },
});

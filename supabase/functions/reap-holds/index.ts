import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Scheduled job: refund holds that never resolved (the customer closed the tab and nobody polled).
// Call it every 10 minutes with the header x-cron-secret: <CRON_SECRET>.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const secret = Deno.env.get("CRON_SECRET") ?? "";

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (!secret || !same(req.headers.get("x-cron-secret") ?? "", secret)) return new Response("Unauthorized", { status: 401 });
  const { data, error } = await admin.rpc("credit_reap_holds", { p_minutes: 60 });
  if (error) { console.log(JSON.stringify({ event: "reap_failed" })); return new Response("error", { status: 500 }); }
  console.log(JSON.stringify({ event: "reaped", count: data }));
  return new Response(JSON.stringify({ reaped: data }), { headers: { "Content-Type": "application/json" } });
});

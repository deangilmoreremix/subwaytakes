import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Uptime check. Public: answers {ok} only (so a monitor such as an uptime service can ping it). With the x-cron-secret header it also returns the
// operational numbers. It never returns user data.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const secret = Deno.env.get("CRON_SECRET") ?? "";

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  const { data, error } = await admin.rpc("ops_metrics");
  if (error || !data) return new Response(JSON.stringify({ ok: false }), { status: 503, headers });
  const detailed = !!secret && same(req.headers.get("x-cron-secret") ?? "", secret);
  return new Response(JSON.stringify(detailed ? { ok: true, metrics: data } : { ok: true }), { status: 200, headers });
});

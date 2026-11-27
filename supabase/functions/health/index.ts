import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Uptime check. Public: a cheap database ping that answers {ok} only (so an uptime monitor can use it; deploy with --no-verify-jwt). With the
// x-cron-secret header it also returns the operational numbers. It never returns user data.
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
  const detailed = !!secret && same(req.headers.get("x-cron-secret") ?? "", secret);
  if (!detailed) {
    // public path: a cheap ping only (the numbers scan the whole ledger, never run them for anonymous callers)
    const { error } = await admin.from("safety_terms").select("term").limit(1);
    return new Response(JSON.stringify({ ok: !error }), { status: error ? 503 : 200, headers });
  }
  const { data, error } = await admin.rpc("ops_metrics");
  if (error || !data) return new Response(JSON.stringify({ ok: false }), { status: 503, headers });
  return new Response(JSON.stringify({ ok: true, metrics: data }), { status: 200, headers });
});

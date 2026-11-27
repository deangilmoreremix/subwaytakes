import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { referralHandle, type ReferralCaller, type ReferralDeps } from "../_shared/referral.ts";

// Records that the signed-in, email-confirmed customer was invited by the owner of a code. Grants nothing.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const deps: ReferralDeps = {
  hit: async (userId) => { const { error } = await admin.rpc("credit_hit", { p_user: userId, p_kind: "free" }); if (error) throw new Error("rate_limited"); },
  claim: async (userId, code) => { const { error } = await admin.rpc("referral_claim", { p_user: userId, p_code: code }); if (error) throw new Error(error.message); },
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const auth = req.headers.get("Authorization");
  let caller: ReferralCaller | null = null;
  if (auth) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) caller = { id: user.id, emailConfirmed: !!user.email_confirmed_at, anonymous: !!user.is_anonymous };
  }
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON" }); }
  const out = await referralHandle(caller, body, deps);
  return reply(out.status, out.body);
});

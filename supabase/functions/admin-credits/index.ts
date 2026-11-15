import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminHandle, type AdminDeps } from "../_shared/admin.ts";

// Operator tools: grant or adjust credits, look up a user, view money stats, change gateway limits, turn a model on or off.
// Only users listed in admin_users may call it.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const deps: AdminDeps = {
  isAdmin: async (id) => !!(await admin.from("admin_users").select("user_id").eq("user_id", id).maybeSingle()).data,
  findUser: async (email) => { const { data } = await admin.rpc("credit_find_user", { p_email: email }); return (data as string | null) ?? null; },
  balance: async (id) => (await admin.from("user_profiles").select("credits_balance").eq("id", id).maybeSingle()).data?.credits_balance ?? 0,
  ledger: async (id, limit) => (await admin.from("credit_ledger").select("id, delta, kind, reason, ref, created_at").eq("user_id", id).order("id", { ascending: false }).limit(limit)).data ?? [],
  apply: async (id, delta, kind, reason, ref, actor) => {
    const { data, error } = await admin.rpc("credit_apply", { p_user: id, p_delta: delta, p_kind: kind, p_reason: reason, p_ref: ref, p_actor: actor });
    if (error) throw new Error(error.message);
    return data as number;
  },
  stats: async () => (await admin.rpc("credit_stats")).data,
  getSettings: async () => (await admin.from("gateway_settings").select("margin, max_credits_per_call, max_calls_per_minute, max_open_holds, daily_credit_cap, kill_switch").eq("id", true).single()).data ?? {},
  setSettings: async (patch) => { const { error } = await admin.from("gateway_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true); if (error) throw new Error(error.message); },
  setModel: async (slug, p) => {
    const row: Record<string, unknown> = { slug };
    if (p.enabled !== undefined) row.enabled = p.enabled;
    if (p.margin !== undefined) row.margin = p.margin;
    if (p.minCredits !== undefined) row.min_credits = p.minCredits;
    const { error } = await admin.from("model_prices").upsert(row, { onConflict: "slug" });
    if (error) throw new Error(error.message);
  },
  newRef: () => crypto.randomUUID(),
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  const auth = req.headers.get("Authorization");
  let caller: { id: string } | null = null;
  if (auth) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (user && !user.is_anonymous) caller = { id: user.id };
  }
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON" }); }
  try {
    const out = await adminHandle(caller, body, deps);
    return reply(out.status, out.body);
  } catch (e) {
    console.log(JSON.stringify({ event: "admin_error", message: e instanceof Error ? e.message.slice(0, 200) : "unknown" }));
    return reply(500, { error: "Something went wrong." });
  }
});

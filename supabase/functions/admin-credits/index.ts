import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { adminHandle, type AdminDeps } from "../_shared/admin.ts";
import { refundPayment } from "../_shared/stripe.ts";

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
  getSettings: async () => (await admin.from("gateway_settings").select("margin, max_credits_per_call, max_calls_per_minute, max_open_holds, daily_credit_cap, kill_switch, enforce_entitlements").eq("id", true).single()).data ?? {},
  setSettings: async (patch) => { const { error } = await admin.from("gateway_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true); if (error) throw new Error(error.message); },
  setModel: async (slug, p) => {
    const row: Record<string, unknown> = { slug };
    if (p.enabled !== undefined) row.enabled = p.enabled;
    if (p.margin !== undefined) row.margin = p.margin;
    if (p.minCredits !== undefined) row.min_credits = p.minCredits;
    const { error } = await admin.from("model_prices").upsert(row, { onConflict: "slug" });
    if (error) throw new Error(error.message);
  },
  billingStats: async () => (await admin.rpc("billing_stats")).data,
  listProducts: async () => (await admin.from("products").select("key, kind, name, description, price_cents, currency, credits, entitlements, active, sort").order("sort")).data ?? [],
  setProduct: async (key, patch) => {
    const { data, error } = await admin.from("products").update({ ...patch, updated_at: new Date().toISOString() }).eq("key", key).select("key");
    if (error) throw new Error(error.code === "23514" ? "check" : error.message);
    if (!data?.length) throw new Error("not_found");
  },
  listOrders: async (id, limit) => (await admin.from("orders").select("id, product_key, product_name, amount_cents, currency, credits, status, credits_clawed, clawback_shortfall, created_at, paid_at").eq("user_id", id).order("created_at", { ascending: false }).limit(limit)).data ?? [],
  listEntitlements: async (id) => (await admin.rpc("entitlements_for", { p_user: id })).data ?? [],
  setEntitlement: async (id, key, on) => { const { error } = await admin.rpc("entitlement_set", { p_user: id, p_key: key, p_on: on }); if (error) throw new Error(error.message); },
  paidOrderPayment: async (orderId) => {
    const { data } = await admin.from("orders").select("stripe_payment_intent, user_id, status").eq("id", orderId).maybeSingle();
    return data && data.status === "paid" && data.stripe_payment_intent ? { paymentIntent: data.stripe_payment_intent, userId: data.user_id } : null;
  },
  stripeRefund: (pi) => refundPayment((u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(20_000) }), Deno.env.get("STRIPE_SECRET_KEY") ?? "", pi),
  audit: async (actor, action, detail) => { const { error } = await admin.rpc("billing_audit_write", { p_actor: actor, p_action: action, p_detail: detail }); if (error) throw new Error("audit_failed"); },
  retentionStats: async () => (await admin.rpc("retention_stats")).data,
  getReferralSettings: async () => (await admin.from("referral_settings").select("enabled, referrer_reward, referee_reward, min_order_cents, max_rewards_per_referrer").eq("id", true).single()).data ?? {},
  setReferralSettings: async (patch) => { const { error } = await admin.from("referral_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", true); if (error) throw new Error(error.message); },
  voidReferral: async (refereeId) => {
    const { data, error } = await admin.from("referrals").update({ status: "void" }).eq("referee_id", refereeId).eq("status", "claimed").select("referee_id");
    if (error) throw new Error(error.message);
    return !!data?.length;
  },
  opsOverview: async () => ({
    metrics: (await admin.rpc("ops_metrics")).data,
    alerts: (await admin.from("ops_alerts").select("id, kind, severity, message, created_at, last_seen_at, resolved_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(50)).data ?? [],
  }),
  resolveAlert: async (id, actor) => !!(await admin.rpc("ops_alert_resolve", { p_id: id, p_actor: actor })).data,
  listSafetyTerms: async () => ((await admin.from("safety_terms").select("term").order("term")).data ?? []).map((r: { term: string }) => r.term),
  addSafetyTerm: async (term, actor) => { const { error } = await admin.from("safety_terms").upsert({ term, added_by: actor }, { onConflict: "term" }); if (error) throw new Error(error.message); },
  removeSafetyTerm: async (term) => !!(await admin.from("safety_terms").delete().eq("term", term).select("term")).data?.length,
  recentClientErrors: async (limit) => (await admin.from("client_errors").select("id, message, url, created_at").order("id", { ascending: false }).limit(limit)).data ?? [],
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

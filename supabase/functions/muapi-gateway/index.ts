import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { GatewayDbError, handle, type Caller, type Deps, type GatewayRequest } from "../_shared/gateway.ts";

// The customer-facing door to muapi. The muapi key lives only here (MUAPI_API_KEY secret) and is never sent to a browser.
// Decision logic is in ../_shared/gateway.ts (unit tested); this file only wires the real database and network.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Idempotency-Key",
};
const MUAPI = "https://api.muapi.ai";
const DB_CODES = ["insufficient_credits", "killed", "rate_limited", "too_many_open", "daily_cap", "amount_too_large", "idem_mismatch", "idem_reused"];

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const muapiKey = Deno.env.get("MUAPI_API_KEY") ?? "";
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const asCode = (message: string) => DB_CODES.find(c => message.includes(c)) ?? "internal";
// deno-lint-ignore no-explicit-any
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new GatewayDbError(asCode(error.message));
  return data as T;
}

let terms: string[] = []; let termsAt = 0;
const deps: Deps = {
  settings: async () => {
    const { data, error } = await admin.from("gateway_settings").select("margin, max_credits_per_call, kill_switch, enforce_entitlements").eq("id", true).single();
    if (error || !data) throw new Error("settings unavailable");
    return { margin: Number(data.margin), maxCreditsPerCall: data.max_credits_per_call, killSwitch: data.kill_switch, enforceEntitlements: data.enforce_entitlements !== false };
  },
  modelRule: async (slug) => {
    const { data } = await admin.from("model_prices").select("enabled, margin, min_credits").eq("slug", slug).maybeSingle();
    return data ? { enabled: data.enabled, margin: data.margin === null ? null : Number(data.margin), minCredits: data.min_credits } : null;
  },
  hit: async (userId, kind) => { await rpc("credit_hit", { p_user: userId, p_kind: kind }); },
  reserve: async (userId, amount, slug, idem, hash) => {
    const rows = await rpc<Array<{ hold_id: string; balance: number; reused: boolean }>>("credit_reserve", { p_user: userId, p_amount: amount, p_slug: slug, p_idem: idem, p_hash: hash });
    const r = rows[0];
    return { holdId: r.hold_id, balance: r.balance, reused: r.reused };
  },
  attach: async (holdId, requestId, usd) => { await rpc("credit_attach_request", { p_hold: holdId, p_request_id: requestId, p_estimated_usd: usd }); },
  callByHold: async (holdId) => {
    const { data } = await admin.from("muapi_calls").select("request_id").eq("hold_id", holdId).maybeSingle();
    return data ? { requestId: data.request_id } : null;
  },
  callOwner: async (requestId) => {
    const { data } = await admin.from("muapi_calls").select("user_id, status").eq("request_id", requestId).maybeSingle();
    return data ? { userId: data.user_id, status: data.status } : null;
  },
  blockedTerms: async () => {
    // cached for a minute: a few rows, read on every paid call
    if (Date.now() - termsAt > 60_000) {
      const { data, error } = await admin.from("safety_terms").select("term").limit(500);
      if (!error && data) { terms = data.map((r: { term: string }) => r.term); termsAt = Date.now(); }   // on a read error keep the last good list and retry next call
    }
    return terms;
  },
  entitlements: async (userId) => (await rpc<string[] | null>("entitlements_for", { p_user: userId })) ?? [],
  settle: (requestId) => rpc<string>("credit_settle", { p_request_id: requestId }),
  release: (requestId, reason) => rpc<string>("credit_release", { p_request_id: requestId, p_reason: reason }),
  releaseHold: (holdId, reason) => rpc<string>("credit_release_hold", { p_hold: holdId, p_reason: reason }),
  balance: async (userId) => {
    const { data } = await admin.from("user_profiles").select("credits_balance").eq("id", userId).maybeSingle();
    return data?.credits_balance ?? 0;
  },
  muapi: async (method, path, body) => {
    const res = await fetch(`${MUAPI}${path}`, {
      method,
      headers: { "x-api-key": muapiKey, "Content-Type": "application/json" },
      body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
    return { status: res.status, json };
  },
  // ids and codes only: never keys, prompts or bodies
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (!muapiKey) { console.log(JSON.stringify({ event: "missing_muapi_key" })); return reply(500, { code: "internal", error: "Something went wrong. You were not charged." }); }

  const auth = req.headers.get("Authorization");
  let caller: Caller | null = null;
  if (auth) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) caller = { id: user.id, isAnonymous: !!user.is_anonymous, emailConfirmed: !!user.email_confirmed_at };
  }

  let payload: Partial<GatewayRequest>;
  try { payload = await req.json(); } catch { return reply(400, { code: "bad_request", error: "Invalid JSON" }); }
  const idempotencyKey = req.headers.get("x-idempotency-key") ?? (typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined);
  try {
    const out = await handle(caller, { method: payload.method ?? "POST", path: payload.path ?? "", body: payload.body, idempotencyKey: idempotencyKey?.slice(0, 100) }, deps);
    return reply(out.status, out.body);
  } catch (e) {
    console.log(JSON.stringify({ event: "unhandled", message: e instanceof Error ? e.message.slice(0, 200) : "unknown" }));
    return reply(500, { code: "internal", error: "Something went wrong. You were not charged." });
  }
});

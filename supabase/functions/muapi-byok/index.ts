import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { handle, type ByokCaller, type ByokDeps } from "../_shared/byok.ts";

// BYOK door to muapi: forwards the customer's OWN key (header X-Muapi-Key) to muapi. The key is never stored, logged or returned.
// Decision logic is in ../_shared/byok.ts (unit tested); this file only wires the network and the rate-limit table.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Muapi-Key",
};
const MUAPI = "https://api.muapi.ai";

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let terms: string[] = []; let termsAt = 0;
const deps: ByokDeps = {
  hit: async (userId, kind) => {
    const { error } = await admin.rpc("credit_hit", { p_user: userId, p_kind: kind });
    if (error) throw new Error(error.message.includes("rate_limited") ? "rate_limited" : "hit_failed");
  },
  blockedTerms: async () => {
    if (Date.now() - termsAt > 60_000) {
      const { data, error } = await admin.from("safety_terms").select("term").limit(500);
      if (!error && data) { terms = data.map((r: { term: string }) => r.term); termsAt = Date.now(); }
    }
    return terms;
  },
  muapi: async (method, path, key, body) => {
    const res = await fetch(`${MUAPI}${path}`, {
      method,
      headers: { "x-api-key": key, "Content-Type": "application/json" },
      body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
    return { status: res.status, json };
  },
  // event names and codes only: never keys, headers, prompts or bodies
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });

  const auth = req.headers.get("Authorization");
  let caller: ByokCaller | null = null;
  if (auth) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) caller = { id: user.id, isAnonymous: !!user.is_anonymous, emailConfirmed: !!user.email_confirmed_at };
  }

  let payload: { method?: string; path?: string; body?: unknown };
  try { payload = await req.json(); } catch { return reply(400, { code: "bad_request", error: "Invalid JSON" }); }
  try {
    const out = await handle(caller, { method: payload.method ?? "POST", path: payload.path ?? "", body: payload.body }, req.headers.get("x-muapi-key"), deps);
    return reply(out.status, out.body);
  } catch (e) {
    console.log(JSON.stringify({ event: "unhandled", message: e instanceof Error ? e.message.slice(0, 120) : "unknown" }));
    return reply(500, { code: "internal", error: "Something went wrong. Try again." });
  }
});

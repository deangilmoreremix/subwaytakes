import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Thin passthrough to api.muapi.ai. The caller's muapi key arrives in `x-muapi-key`,
// is forwarded as `x-api-key`, and is never stored or logged.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Muapi-Key",
};

const MUAPI = "https://api.muapi.ai";
const ALLOWED = [
  /^\/api\/v1\/predictions\/[\w-]+\/result$/,
  /^\/api\/v1\/account\/balance$/,
  /^\/api\/v1\/upload_file$/,
  /^\/api\/v1\/get_upload_url$/,
  /^\/api\/v1\/models\/[\w.\-]+\/estimate-cost$/,
  /^\/api\/v1\/models\/[\w.\-]+$/, // model metadata (voice lists, schemas)
  /^\/api\/v1\/[\w.\-]+$/, // model endpoints
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Unauthorized" }, 401);

  const key = req.headers.get("x-muapi-key");
  if (!key) return json({ error: "Missing muapi key. Add it in Settings." }, 400);

  let payload: { method?: string; path?: string; body?: unknown };
  try { payload = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { method = "POST", path = "", body } = payload;
  if (!["GET", "POST"].includes(method)) return json({ error: "Bad method" }, 400);
  if (!path.startsWith("/") || path.includes("..") || !ALLOWED.some(r => r.test(path))) return json({ error: "Path not allowed" }, 400);

  const upstream = await fetch(`${MUAPI}${path}`, {
    method,
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: method === "POST" && body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { ...corsHeaders, "Content-Type": upstream.headers.get("Content-Type") || "application/json" } });
});

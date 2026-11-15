import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reapOnce, type ReapDeps } from "../_shared/reaper.ts";
import { normalizeStatus } from "../_shared/status.ts";

// Scheduled job (every 10 minutes, header x-cron-secret: <CRON_SECRET>).
// 1. Refunds holds that never reached muapi. 2. Asks muapi about jobs nobody has polled for 30+ minutes:
// completed -> charge stands, failed -> refund, still running -> wait (refunded only after 24 hours).
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const secret = Deno.env.get("CRON_SECRET") ?? "";
const muapiKey = Deno.env.get("MUAPI_API_KEY") ?? "";

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(fn + " failed");
  return data as T;
}

const deps: ReapDeps = {
  reapUnsubmitted: (minutes) => rpc<number>("credit_reap_holds", { p_minutes: minutes }),
  staleCalls: async (minutes, limit) => (await rpc<Array<{ request_id: string; age_minutes: number }>>("credit_stale_calls", { p_minutes: minutes, p_limit: limit })).map(r => ({ requestId: r.request_id, ageMinutes: r.age_minutes })),
  muapiStatus: async (requestId) => {
    if (!muapiKey) return "unknown";
    const res = await fetch(`https://api.muapi.ai/api/v1/predictions/${encodeURIComponent(requestId)}/result`, { headers: { "x-api-key": muapiKey }, signal: AbortSignal.timeout(20_000) });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      // muapi reports a failed job as an HTTP error with {detail:{status:'failed'}}; anything else (401, 5xx) means "could not tell".
      const s = normalizeStatus(json && typeof json === "object" && "detail" in json ? (json as { detail: unknown }).detail : json);
      return s === "failed" || s === "cancelled" ? s : "unknown";
    }
    return normalizeStatus(json);
  },
  settle: (requestId) => rpc<string>("credit_settle", { p_request_id: requestId }),
  release: (requestId, reason) => rpc<string>("credit_release", { p_request_id: requestId, p_reason: reason }),
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (!secret || !same(req.headers.get("x-cron-secret") ?? "", secret)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await reapOnce(deps);
    console.log(JSON.stringify({ event: "reaped", ...result }));
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
  } catch {
    console.log(JSON.stringify({ event: "reap_failed" }));
    return new Response("error", { status: 500 });
  }
});

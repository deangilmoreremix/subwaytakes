import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_THRESHOLDS, alertText, opsDecide, parseBalanceUsd, type Metrics } from "../_shared/ops.ts";

// Scheduled check (every 10 minutes, header x-cron-secret: <CRON_SECRET>). Reads the numbers, decides which problems exist, raises or refreshes
// one open alert per problem, closes alerts whose problem has cleared, and (optionally) sends NEW alerts to a chat webhook.
// Secrets: CRON_SECRET, MUAPI_API_KEY (balance check, optional), MUAPI_LOW_BALANCE_USD (default 20), ALERT_WEBHOOK_URL (Slack-compatible, optional).
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const secret = Deno.env.get("CRON_SECRET") ?? "";
const muapiKey = Deno.env.get("MUAPI_API_KEY") ?? "";
const webhook = Deno.env.get("ALERT_WEBHOOK_URL") ?? "";
const lowBalance = Number(Deno.env.get("MUAPI_LOW_BALANCE_USD")) || DEFAULT_THRESHOLDS.lowBalanceUsd;

function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function muapiState(): Promise<{ reachable: boolean; balance: number | null } | null> {
  if (!muapiKey) return null;   // not configured: do not guess
  try {
    const res = await fetch("https://api.muapi.ai/api/v1/account/balance", { headers: { "x-api-key": muapiKey }, signal: AbortSignal.timeout(15_000) });
    if (res.status >= 500) return { reachable: false, balance: null };
    const json = await res.json().catch(() => null);
    return { reachable: true, balance: res.ok ? parseBalanceUsd(json) : null };
  } catch { return { reachable: false, balance: null }; }
}

Deno.serve(async (req) => {
  if (!secret || !same(req.headers.get("x-cron-secret") ?? "", secret)) return new Response("Unauthorized", { status: 401 });
  try {
    const { data, error } = await admin.rpc("ops_metrics");
    if (error || !data) throw new Error("metrics");
    const metrics = data as Metrics;
    const m = await muapiState();
    if (m) { metrics.muapi_reachable = m.reachable; metrics.muapi_balance_usd = m.balance; }
    const alerts = opsDecide(metrics, { ...DEFAULT_THRESHOLDS, lowBalanceUsd: lowBalance });
    const fresh: string[] = [];
    for (const a of alerts) {
      const { data: isNew } = await admin.rpc("ops_alert_raise", { p_kind: a.kind, p_severity: a.severity, p_message: a.message, p_detail: a.detail });
      if (isNew) fresh.push(alertText(a));
    }
    const { data: cleared } = await admin.rpc("ops_alert_clear_except", { p_active: alerts.map(a => a.kind) });
    await admin.rpc("ops_prune");
    if (webhook && fresh.length) {
      // only NEW alerts are sent, once; a failing webhook never fails the check
      await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: fresh.join("\n") }), signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
    }
    console.log(JSON.stringify({ event: "ops_checked", active: alerts.length, new: fresh.length, cleared: cleared ?? 0 }));
    return new Response(JSON.stringify({ active: alerts.map(a => a.kind), new: fresh.length, cleared: cleared ?? 0 }), { headers: { "Content-Type": "application/json" } });
  } catch {
    console.log(JSON.stringify({ event: "ops_check_failed" }));
    return new Response("error", { status: 500 });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { webhookHandle, type WebhookDeps } from "../_shared/billing.ts";

// Stripe calls this after a payment, refund or dispute. Deploy with --no-verify-jwt: the Stripe signature is the authentication.
// Secrets: STRIPE_WEBHOOK_SECRET. Events to send: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded, charge.dispute.created.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

const deps: WebhookDeps = {
  seen: (id) => rpc<boolean>("stripe_event_seen", { p_id: id }),
  fulfil: (session, pi, amount, currency) => rpc<string>("order_fulfil", { p_session: session, p_payment_intent: pi, p_amount: amount, p_currency: currency }),
  reverse: (pi, status, reason) => rpc<string>("order_reverse", { p_payment_intent: pi, p_status: status, p_reason: reason }),
  record: async (id, type, outcome, detail) => { await rpc<boolean>("stripe_event_record", { p_id: id, p_type: type, p_outcome: outcome, p_detail: detail ?? null }); },
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!secret) { console.log(JSON.stringify({ event: "webhook_not_configured" })); return new Response("not configured", { status: 503 }); }
  const raw = await req.text();   // the exact bytes Stripe signed
  const out = await webhookHandle(raw, req.headers.get("stripe-signature"), secret, Math.floor(Date.now() / 1000), deps);
  return new Response(JSON.stringify(out.body), { status: out.status, headers: { "Content-Type": "application/json" } });
});

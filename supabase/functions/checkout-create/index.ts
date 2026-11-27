import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkoutHandle, type CheckoutCaller, type CheckoutDeps } from "../_shared/billing.ts";
import { createCheckoutSession } from "../_shared/stripe.ts";

// Starts a Stripe Checkout for one product. The price is read from the products table on the server; the browser only names the product.
// Secrets: STRIPE_SECRET_KEY, APP_URL (e.g. https://studio.example.com, where Stripe sends the buyer back).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const deps: CheckoutDeps = {
  hit: async (userId) => { const { error } = await admin.rpc("credit_hit", { p_user: userId, p_kind: "free" }); if (error) throw new Error("rate_limited"); },
  createPending: async (userId, productKey) => {
    const { data, error } = await admin.rpc("order_create_pending", { p_user: userId, p_product: productKey });
    if (error || !data?.[0]) throw new Error(error?.message ?? "order_failed");
    const r = data[0] as { order_id: string; amount_cents: number; currency: string; product_name: string };
    return { orderId: r.order_id, amountCents: r.amount_cents, currency: r.currency, productName: r.product_name };
  },
  attach: async (orderId, sessionId) => { const { error } = await admin.rpc("order_attach_session", { p_order: orderId, p_session: sessionId }); if (error) throw new Error("attach_failed"); },
  createSession: (a) => createCheckoutSession((u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(20_000) }), stripeKey, appUrl, a),
  log: (event, data) => console.log(JSON.stringify({ event, ...data })),
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Method not allowed" });
  if (!stripeKey || !appUrl) { console.log(JSON.stringify({ event: "checkout_not_configured" })); return reply(503, { error: "Checkout is not available yet.", code: "payments_unavailable" }); }
  const auth = req.headers.get("Authorization");
  let caller: CheckoutCaller | null = null;
  if (auth) {
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) caller = { id: user.id, email: user.email ?? null, emailConfirmed: !!user.email_confirmed_at, anonymous: !!user.is_anonymous };
  }
  let body: unknown;
  try { body = await req.json(); } catch { return reply(400, { error: "Invalid JSON" }); }
  const out = await checkoutHandle(caller, body, deps);
  return reply(out.status, out.body);
});

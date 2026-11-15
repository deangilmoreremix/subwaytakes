// The two Stripe REST calls we make (form-encoded, no SDK). `fetcher` is injected so tests never touch the network.
export type Fetcher = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; json(): Promise<unknown> }>;

const form = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
const headers = (key: string) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' });

export async function createCheckoutSession(
  fetcher: Fetcher, secretKey: string, appUrl: string,
  a: { orderId: string; userId: string; email: string | null; amountCents: number; currency: string; productName: string },
): Promise<{ id: string; url: string }> {
  const body: Record<string, string> = {
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': a.currency,
    'line_items[0][price_data][unit_amount]': String(a.amountCents),
    'line_items[0][price_data][product_data][name]': a.productName,
    client_reference_id: a.userId,
    'metadata[order_id]': a.orderId,
    'payment_intent_data[metadata][order_id]': a.orderId,
    success_url: `${appUrl}/billing/success?order=${a.orderId}`,
    cancel_url: `${appUrl}/billing/cancel`,
  };
  if (a.email) body.customer_email = a.email;
  const res = await fetcher('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: headers(secretKey), body: form(body) });
  const json = await res.json().catch(() => null) as { id?: unknown; url?: unknown } | null;
  if (res.status !== 200 || !json || typeof json.id !== 'string' || typeof json.url !== 'string' || !json.url.startsWith('https://')) throw new Error(`stripe_session_${res.status}`);
  return { id: json.id, url: json.url };
}

export async function refundPayment(fetcher: Fetcher, secretKey: string, paymentIntent: string): Promise<void> {
  const res = await fetcher('https://api.stripe.com/v1/refunds', { method: 'POST', headers: headers(secretKey), body: form({ payment_intent: paymentIntent }) });
  if (res.status !== 200) throw new Error(`stripe_refund_${res.status}`);
}

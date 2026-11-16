import { describe, expect, it, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {} }));
import { AccountRequiredError, BLOCK_TEXT, CONFIRM_CREDITS, InsufficientCreditsError, formatCredits, generationBlock, getBalance, publishBalance, subscribeBalance, usdToCredits } from './index';
import { interpretGatewayFailure } from '../muapi/client';

const res = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

describe('credit helpers', () => {
  it('formats credits with a plural', () => {
    expect(formatCredits(1)).toBe('1 credit'); expect(formatCredits(1500)).toBe('1,500 credits'); expect(formatCredits(0)).toBe('0 credits'); expect(formatCredits(22.5)).toBe('23 credits');
  });
  it('matches the server rounding', () => {
    expect(usdToCredits(0.6)).toBe(150); expect(usdToCredits(0.09)).toBe(23); expect(usdToCredits(0.004)).toBe(1); expect(usdToCredits(0)).toBe(1); expect(usdToCredits(1.5)).toBe(375);
  });
  it('confirms above $1 of credits', () => expect(CONFIRM_CREDITS).toBe(100));
  it('says why an account cannot generate', () => {
    expect(generationBlock(null)).toBe('guest');
    expect(generationBlock({ isGuest: true, emailConfirmed: true })).toBe('guest');
    expect(generationBlock({ isGuest: false, emailConfirmed: false })).toBe('unverified');
    expect(generationBlock({ isGuest: false, emailConfirmed: true })).toBeNull();
    expect(BLOCK_TEXT.guest).toMatch(/account/); expect(BLOCK_TEXT.unverified).toMatch(/email/);
  });
  it('writes a helpful shortfall message', () => {
    const e = new InsufficientCreditsError(150, 40);
    expect(e.message).toBe('You need 110 more credits (this costs 150, you have 40). Add credits in Settings.');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('balance store', () => {
  it('publishes to subscribers, ignores junk, and unsubscribes', () => {
    const seen: number[] = []; const off = subscribeBalance(n => seen.push(n));
    publishBalance(850); publishBalance(NaN); publishBalance(700);
    expect(seen).toEqual([850, 700]); expect(getBalance()).toBe(700);
    off(); publishBalance(5); expect(seen).toEqual([850, 700]);
  });
});

describe('interpretGatewayFailure', () => {
  it('turns 402 into InsufficientCreditsError and updates the balance', async () => {
    const e = await interpretGatewayFailure({ message: 'Edge Function returned a non-2xx status code', context: res({ code: 'insufficient_credits', error: 'Not enough credits.', needed: 150, balance: 40 }, 402) });
    expect(e).toBeInstanceOf(InsufficientCreditsError);
    expect((e as InsufficientCreditsError).needed).toBe(150); expect((e as InsufficientCreditsError).balance).toBe(40);
    expect(getBalance()).toBe(40);
  });
  it('turns account problems into AccountRequiredError with the server message', async () => {
    const a = await interpretGatewayFailure({ context: res({ code: 'account_required', error: 'Create an account to generate.' }, 403) });
    expect(a).toBeInstanceOf(AccountRequiredError); expect(a.message).toBe('Create an account to generate.'); expect((a as AccountRequiredError).code).toBe('account_required');
    const v = await interpretGatewayFailure({ context: res({ code: 'verify_email', error: 'Confirm your email address to generate.' }, 403) });
    expect((v as AccountRequiredError).code).toBe('verify_email');
  });
  it('keeps the server message for refusals that were not charged (rate limit, kill switch, price unavailable)', async () => {
    for (const [code, msg, status] of [['rate_limited', 'You are going too fast. You were not charged.', 429], ['killed', 'Generation is paused for maintenance. You were not charged.', 503], ['price_unavailable', 'Could not get a price right now. You were not charged.', 503]] as const) {
      expect((await interpretGatewayFailure({ context: res({ code, error: msg }, status) })).message).toBe(msg);
    }
  });
  it('still surfaces muapi\'s own validation messages and falls back when there is no body', async () => {
    expect((await interpretGatewayFailure({ context: res({ detail: [{ msg: 'prompt too long' }] }, 422) })).message).toBe('prompt too long');
    expect((await interpretGatewayFailure({ message: 'boom' })).message).toBe('boom');
  });
});

describe('creditLevel', () => {
  it('nudges below one typical shot and is quiet otherwise', async () => {
    const { creditLevel, LOW_CREDITS } = await import('./index');
    expect(creditLevel(null)).toBe('unknown'); expect(creditLevel(undefined)).toBe('unknown'); expect(creditLevel(NaN)).toBe('unknown');
    expect(creditLevel(0)).toBe('empty'); expect(creditLevel(-5)).toBe('empty');
    expect(creditLevel(LOW_CREDITS - 1)).toBe('low'); expect(creditLevel(LOW_CREDITS)).toBe('ok'); expect(creditLevel(5000)).toBe('ok');
  });
});

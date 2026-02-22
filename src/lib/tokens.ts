import { supabase } from './supabase';
import type { TokenBalance, TokenTransaction } from './types';
import { TOKEN_COSTS, SUBSCRIPTION_PLANS } from './constants';
import { getUserId } from './auth';

export async function getTokenBalance(): Promise<TokenBalance | null> {
  const userId = getUserId();

  const { data, error } = await supabase
    .from('token_balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get token balance:', error);
    return null;
  }

  if (!data) {
    return createDefaultTokenBalance();
  }

  const lastReset = new Date(data.last_reset_date);
  const now = new Date();
  if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    return resetMonthlyTokens();
  }

  return {
    userId: data.user_id,
    monthlyTokens: data.monthly_tokens,
    purchasedTokens: data.purchased_tokens,
    usedThisMonth: data.used_this_month,
    lastResetDate: data.last_reset_date,
  };
}

async function createDefaultTokenBalance(): Promise<TokenBalance> {
  const userId = getUserId();
  const now = new Date().toISOString();
  const freePlan = SUBSCRIPTION_PLANS.find(p => p.tier === 'free') ?? SUBSCRIPTION_PLANS[0];

  const { data, error } = await supabase
    .from('token_balances')
    .insert({
      user_id: userId,
      monthly_tokens: freePlan.monthlyTokens,
      purchased_tokens: 0,
      used_this_month: 0,
      last_reset_date: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create token balance:', error);
    return {
      userId,
      monthlyTokens: freePlan.monthlyTokens,
      purchasedTokens: 0,
      usedThisMonth: 0,
      lastResetDate: now,
    };
  }

  return {
    userId: data.user_id,
    monthlyTokens: data.monthly_tokens,
    purchasedTokens: data.purchased_tokens,
    usedThisMonth: data.used_this_month,
    lastResetDate: data.last_reset_date,
  };
}

async function resetMonthlyTokens(): Promise<TokenBalance> {
  const userId = getUserId();
  const now = new Date().toISOString();

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle();

  const tier = sub?.tier || 'free';
  const plan = SUBSCRIPTION_PLANS.find(p => p.tier === tier) ?? SUBSCRIPTION_PLANS[0];

  const { data, error } = await supabase
    .from('token_balances')
    .upsert({
      user_id: userId,
      monthly_tokens: plan.monthlyTokens,
      used_this_month: 0,
      last_reset_date: now,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to reset tokens:', error);
    throw error;
  }

  await recordTransaction({
    type: 'monthly_allocation',
    amount: plan.monthlyTokens,
    description: `Monthly token allocation for ${tier} plan`,
  });

  return {
    userId: data.user_id,
    monthlyTokens: data.monthly_tokens,
    purchasedTokens: data.purchased_tokens,
    usedThisMonth: data.used_this_month,
    lastResetDate: data.last_reset_date,
  };
}

export async function deductTokens(
  amount: number,
  description: string,
  clipId?: string
): Promise<boolean> {
  const userId = getUserId();

  const { data, error } = await supabase.rpc('atomic_deduct_tokens', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error || data === false) {
    console.error('Failed to deduct tokens:', error);
    return false;
  }

  await recordTransaction({
    type: 'usage',
    amount: -amount,
    description,
    clipId,
  });

  return true;
}

async function recordTransaction(
  params: Omit<TokenTransaction, 'id' | 'userId' | 'createdAt'>
): Promise<void> {
  const userId = getUserId();
  await supabase.from('token_transactions').insert({
    user_id: userId,
    type: params.type,
    amount: params.amount,
    description: params.description,
    clip_id: params.clipId,
  });
}

export function calculateTokenCost(
  operation: keyof typeof TOKEN_COSTS,
  modelTier?: 'standard' | 'premium'
): number {
  switch (operation) {
    case 'generate_clip_standard':
      return modelTier === 'premium' ? TOKEN_COSTS.generate_clip_premium : TOKEN_COSTS.generate_clip_standard;
    case 'generate_clip_premium':
      return TOKEN_COSTS.generate_clip_premium;
    case 'generate_clip_studio':
      return TOKEN_COSTS.generate_clip_studio;
    default:
      return TOKEN_COSTS[operation];
  }
}

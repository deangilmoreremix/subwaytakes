import type { TokenBalance } from '../lib/types';
import { Coins } from 'lucide-react';
import { clsx } from '../lib/format';

interface TokenDisplayProps {
  balance: TokenBalance | null;
  isLoading?: boolean;
  compact?: boolean;
}

export function TokenDisplay({ balance, isLoading, compact }: TokenDisplayProps) {
  if (isLoading) {
    return (
      <div className={clsx(
        'flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl',
        compact ? 'px-2 py-1' : 'px-4 py-2'
      )}>
        <div className="h-4 w-4 bg-zinc-700 rounded animate-pulse" />
        <div className="h-4 w-16 bg-zinc-700 rounded animate-pulse" />
      </div>
    );
  }

  if (!balance) {
    return (
      <div className={clsx(
        'flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-500',
        compact ? 'px-2 py-1' : 'px-4 py-2'
      )}>
        <Coins className={clsx(compact ? 'h-3 w-3' : 'h-4 w-4')} />
        <span className={clsx('font-medium', compact ? 'text-xs' : 'text-sm')}>--</span>
      </div>
    );
  }

  const totalTokens = balance.monthlyTokens + balance.purchasedTokens - balance.usedThisMonth;

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-2 py-1">
        <Coins className="h-3 w-3 text-emerald-400" />
        <span className="text-xs font-medium text-emerald-400">{totalTokens}</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Coins className="h-5 w-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Token Balance</h3>
          <p className="text-xs text-zinc-500">Available for generation</p>
        </div>
      </div>

      <div className="text-3xl font-bold text-emerald-400 mb-4">
        {totalTokens.toLocaleString()}
        <span className="text-sm font-normal text-zinc-500 ml-2">tokens</span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Monthly allowance</span>
          <span className="text-zinc-300">{balance.monthlyTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Purchased</span>
          <span className="text-zinc-300">{balance.purchasedTokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-800 pt-2 mt-2">
          <span className="text-zinc-500">Used this month</span>
          <span className="text-orange-400">-{balance.usedThisMonth.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-4 text-xs text-zinc-500">
        Resets on {new Date(balance.lastResetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
      </div>
    </div>
  );
}

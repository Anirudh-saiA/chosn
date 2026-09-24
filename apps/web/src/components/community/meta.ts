import { Flame, MessageSquare, ShieldCheck, TrendingDown, type LucideIcon } from 'lucide-react';
import type { Post } from '@/lib/community';

export type PostTypeKey = Post['postType'];

export const POST_TYPE_META: Record<PostTypeKey, { label: string; short: string; icon: LucideIcon }> = {
  price_check: { label: 'Price Check', short: 'Price check', icon: TrendingDown },
  cop_or_drop: { label: 'Cop or Drop', short: 'Cop or drop', icon: Flame },
  legit_check: { label: 'Legit Check', short: 'Legit check', icon: ShieldCheck },
  drop_talk: { label: 'Drop Talk', short: 'Drop talk', icon: MessageSquare },
};

/** Compact relative time — always rendered in mono by callers. */
export function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Cosmetic reputation tiers — same thresholds ReputationBadge has always used. */
export function reputationTier(score: number): { label: string; key: 'veteran' | 'established' | 'new' } {
  if (score >= 50) return { label: 'Veteran', key: 'veteran' };
  if (score >= 15) return { label: 'Established', key: 'established' };
  return { label: 'Newcomer', key: 'new' };
}

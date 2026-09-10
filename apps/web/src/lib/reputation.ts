const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export interface ReputationSummary {
  userId: string;
  score: number;
  accountAgePoints: number;
  helpfulVotePoints: number;
  verifiedPurchasePoints: number;
  helpfulVotesReceived: number;
  verifiedPurchaseCount: number;
  accountCreatedAt: string;
  lastCalculatedAt: string;
}

export interface PublicProfile {
  reputation: ReputationSummary;
  user: { displayName: string | null; avatarSeed: string };
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const res = await fetch(`${API_URL}/reputation/${encodeURIComponent(userId)}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

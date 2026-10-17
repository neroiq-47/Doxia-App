// Achievement badges are derived from real activity counts; nothing is stored or granted manually.
export type BadgeInput = {
  drops: number; replies: number; topicsVoted: number; missionsCompleted: number; missionsAvailable: number;
  streak: number; walletVerified: boolean; isPro: boolean;
};
export type Badge = { id: string; label: string; description: string; earned: boolean };

export function computeBadges(s: BadgeInput): Badge[] {
  return [
    { id: 'first-drop', label: 'First Drop', description: 'Published a first Drop.', earned: s.drops >= 1 },
    { id: 'prolific', label: 'Prolific', description: 'Published 25 Drops.', earned: s.drops >= 25 },
    { id: 'conversationalist', label: 'Conversationalist', description: 'Wrote 10 replies.', earned: s.replies >= 10 },
    { id: 'signal-caller', label: 'Signal Caller', description: 'Voted on 3 Signal topics.', earned: s.topicsVoted >= 3 },
    { id: 'mission-complete', label: 'Mission Complete', description: 'Completed every active mission.', earned: s.missionsAvailable > 0 && s.missionsCompleted >= s.missionsAvailable },
    { id: 'on-a-roll', label: 'On a Roll', description: 'Contributed 7 days in a row.', earned: s.streak >= 7 },
    { id: 'verified-wallet', label: 'Verified Wallet', description: 'Proved control of a wallet (address kept private).', earned: s.walletVerified },
    { id: 'supporter', label: 'Supporter', description: 'Supports Doxia with Pro.', earned: s.isPro },
  ];
}

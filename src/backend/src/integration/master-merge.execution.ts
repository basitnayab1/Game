export const MASTER_MERGE_ORDER = [
  'foundation',
  'routing',
  'localization',
  'authentication',
  'wallet',
  'payments',
  'games',
  'rewards',
  'kyc-security',
  'notifications-support',
  'settings-responsible-closure',
  'verification',
] as const;

export type MergeStage = (typeof MASTER_MERGE_ORDER)[number];

export function isKnownMergeStage(value: string): value is MergeStage {
  return (MASTER_MERGE_ORDER as readonly string[]).includes(value);
}

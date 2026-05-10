import type { PathTone } from '@/types/market'

type AiPathTone = Exclude<PathTone, 'custom'>

const AI_PATH_TONE_LABELS: Record<AiPathTone, string> = {
  'ultra-bull': 'Giga Bull',
  bull: 'Bull',
  neutral: 'Mild',
  bear: 'Bear',
  'ultra-bear': 'Mega Bear',
}

export function formatAiPathLabel(tone: PathTone): string {
  if (tone === 'custom') return 'Custom Path'
  return `LevX AI - ${AI_PATH_TONE_LABELS[tone]}`
}

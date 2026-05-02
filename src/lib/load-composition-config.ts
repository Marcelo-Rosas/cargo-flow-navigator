import { Clock, Hand, type LucideIcon, Zap } from 'lucide-react';
import type { TriggerSource } from '@/types/load-composition';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'executed';

type TriggerConfig = { label: string; icon: LucideIcon };
type StatusConfig = { label: string; variant: 'secondary' | 'default' | 'destructive' | 'outline' };

export const TRIGGER_CONFIG: Record<TriggerSource, TriggerConfig> = {
  batch: { label: 'Batch', icon: Clock },
  on_save: { label: 'Auto', icon: Zap },
  manual: { label: 'Manual', icon: Hand },
  realtime: { label: 'Tempo real', icon: Zap },
};

export const STATUS_CONFIG: Record<SuggestionStatus, StatusConfig> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  executed: { label: 'Executado', variant: 'outline' },
};

const TRIGGER_ALIASES: Record<string, TriggerSource> = {
  batch: 'batch',
  on_save: 'on_save',
  onsave: 'on_save',
  auto: 'on_save',
  manual: 'manual',
  realtime: 'realtime',
  real_time: 'realtime',
  'real-time': 'realtime',
};

export function normalizeTriggerSource(input: unknown): TriggerSource {
  if (typeof input !== 'string') return 'batch';
  const key = input.trim().toLowerCase();
  return TRIGGER_ALIASES[key] ?? 'batch';
}

export function getTriggerConfig(input: unknown): TriggerConfig {
  const normalized = normalizeTriggerSource(input);
  return TRIGGER_CONFIG[normalized];
}

export function getStatusConfig(input: unknown): StatusConfig {
  if (typeof input !== 'string') return STATUS_CONFIG.pending;
  const key = input.trim().toLowerCase() as SuggestionStatus;
  return STATUS_CONFIG[key] ?? STATUS_CONFIG.pending;
}

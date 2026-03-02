// src/components/ai/InsightChecklist.tsx
import type { AiChecklistItem } from '@/types/ai-analysis';

interface InsightChecklistProps {
  checklist?: AiChecklistItem[];
}

export function InsightChecklist({ checklist }: InsightChecklistProps) {
  if (!checklist || checklist.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium">Checklist</span>
      <div className="space-y-1">
        {checklist.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                c.status === 'ok'
                  ? 'bg-green-500'
                  : c.status === 'alerta'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
            />
            <span className="text-muted-foreground">{c.item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

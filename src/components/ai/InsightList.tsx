// src/components/ai/InsightList.tsx
import { Lightbulb } from 'lucide-react';
import type { AiInsightObject } from '@/types/ai-analysis';

interface InsightListProps {
  insights?: Array<string | AiInsightObject>;
}

export function InsightList({ insights }: InsightListProps) {
  if (!insights || insights.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium">Insights</span>
      </div>
      <ul className="space-y-1 pl-5">
        {insights.map((item, i) => (
          <li key={i} className="text-xs text-muted-foreground list-disc">
            {typeof item === 'string'
              ? item
              : typeof item === 'object' && item !== null && 'description' in item
                ? String((item as AiInsightObject).description ?? JSON.stringify(item))
                : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

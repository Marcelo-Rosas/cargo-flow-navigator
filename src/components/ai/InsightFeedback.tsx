// src/components/ai/InsightFeedback.tsx
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { useRateInsight } from '@/hooks/useAiInsights';

interface InsightFeedbackProps {
  insightId: string;
  currentRating: number | null;
}

export function InsightFeedback({ insightId, currentRating }: InsightFeedbackProps) {
  const rateInsight = useRateInsight();

  const handleRate = (rating: number) => {
    if (currentRating === rating) return;
    rateInsight.mutate({ insightId, rating });
  };

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-muted-foreground mr-1">Útil?</span>
      <button
        onClick={() => handleRate(5)}
        disabled={rateInsight.isPending}
        className={`p-1 rounded transition-colors ${
          currentRating === 5
            ? 'text-green-600 bg-green-50 dark:bg-green-900/30'
            : 'text-muted-foreground/50 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
        }`}
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleRate(1)}
        disabled={rateInsight.isPending}
        className={`p-1 rounded transition-colors ${
          currentRating === 1
            ? 'text-red-600 bg-red-50 dark:bg-red-900/30'
            : 'text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
        }`}
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

// src/components/ai/InsightFeedback.tsx
import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { useRateInsight } from '@/hooks/useAiInsights';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface InsightFeedbackProps {
  insightId: string;
  currentRating: number | null;
  currentFeedback?: string | null;
  createdAt?: string;
}

export function InsightFeedback({
  insightId,
  currentRating,
  currentFeedback,
  createdAt,
}: InsightFeedbackProps) {
  const rateInsight = useRateInsight();
  const [rating, setRating] = useState<number | null>(currentRating);
  const [feedbackText, setFeedbackText] = useState<string>(currentFeedback ?? '');

  const handleToggleRating = (value: number) => {
    setRating((prev) => (prev === value ? null : value));
  };

  const handleSave = () => {
    if (!rating) return;
    rateInsight.mutate({ insightId, rating, feedback: feedbackText });
  };

  const isSaving = rateInsight.isPending;
  const isSaveDisabled = !rating || isSaving;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground mr-1">Útil?</span>
          <button
            type="button"
            onClick={() => handleToggleRating(5)}
            disabled={isSaving}
            className={`p-1 rounded transition-colors ${
              rating === 5
                ? 'text-green-600 bg-green-50 dark:bg-green-900/30'
                : 'text-muted-foreground/50 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
            }`}
          >
            <ThumbsUp className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleRating(1)}
            disabled={isSaving}
            className={`p-1 rounded transition-colors ${
              rating === 1
                ? 'text-red-600 bg-red-50 dark:bg-red-900/30'
                : 'text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
            }`}
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </div>
        {createdAt && (
          <p className="text-[10px] text-muted-foreground/70">
            Atualizado em{' '}
            {new Date(createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Conte rapidamente por que este insight foi útil (ou não)..."
          className="min-h-[48px] text-[11px] resize-none"
        />
        <Button
          type="button"
          size="sm"
          disabled={isSaveDisabled}
          onClick={handleSave}
          className="h-[30px] px-2 text-[11px]"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Salvando
            </>
          ) : (
            'Salvar'
          )}
        </Button>
      </div>
    </div>
  );
}

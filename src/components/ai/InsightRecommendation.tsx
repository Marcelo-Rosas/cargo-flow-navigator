// src/components/ai/InsightRecommendation.tsx
interface InsightRecommendationProps {
  recommendation?: string;
  recommendationDetail?: string;
}

export function InsightRecommendation({
  recommendation,
  recommendationDetail,
}: InsightRecommendationProps) {
  if (!recommendation && !recommendationDetail) return null;

  return (
    <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
      <p className="text-xs font-medium mb-1">Recomendação</p>
      {recommendation && <p className="text-xs font-semibold text-foreground">{recommendation}</p>}
      {recommendationDetail && (
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
          {recommendationDetail}
        </p>
      )}
    </div>
  );
}

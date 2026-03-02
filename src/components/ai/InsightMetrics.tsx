// src/components/ai/InsightMetrics.tsx
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface InsightMetricsProps {
  anomalyType?: string;
  urgencyLevel?: string;
  approvalConfidence?: number;
}

export function InsightMetrics({
  anomalyType,
  urgencyLevel,
  approvalConfidence,
}: InsightMetricsProps) {
  const hasBadges = anomalyType || urgencyLevel || approvalConfidence !== undefined;
  if (!hasBadges) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {anomalyType && anomalyType !== 'none' && (
        <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">
          <AlertTriangle className="w-3 h-3 mr-0.5" />
          {anomalyType.replace(/_/g, ' ')}
        </Badge>
      )}
      {urgencyLevel && (
        <Badge
          variant="outline"
          className={`text-[10px] ${
            urgencyLevel === 'critica' || urgencyLevel === 'alta'
              ? 'border-red-300 text-red-600'
              : urgencyLevel === 'media'
                ? 'border-amber-300 text-amber-600'
                : 'border-gray-300 text-gray-500'
          }`}
        >
          Urgência: {urgencyLevel}
        </Badge>
      )}
      {approvalConfidence !== undefined && (
        <Badge variant="outline" className="text-[10px]">
          Confiança: {approvalConfidence}%
        </Badge>
      )}
    </div>
  );
}

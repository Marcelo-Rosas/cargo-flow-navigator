import { useState } from 'react';
import { Route, Pencil, ArrowRightLeft, Receipt, Loader2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface QuoteModalHeaderProps {
  quoteCode: string;
  clientName: string;
  stageLabel: string;
  stageColor: string;
  routeUfLabel: string | null;
  kmBandLabel: string | null;
  canManage: boolean;
  canConvert: boolean;
  isConvertingToFat: boolean;
  isRecalculating: boolean;
  onConvertToOS: () => void;
  onConvertToFAT: () => void;
  onRecalcular: () => void;
  onEdit: () => void;
  onDownloadPdf?: () => Promise<void>;
  showRecalcular: boolean;
}

export function QuoteModalHeader({
  quoteCode,
  clientName,
  stageLabel,
  stageColor,
  routeUfLabel,
  kmBandLabel,
  canManage,
  canConvert,
  isConvertingToFat,
  isRecalculating,
  onConvertToOS,
  onConvertToFAT,
  onRecalcular,
  onEdit,
  onDownloadPdf,
  showRecalcular,
}: QuoteModalHeaderProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!onDownloadPdf) return;
    setIsGeneratingPdf(true);
    try {
      await onDownloadPdf();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-base font-bold text-foreground">{quoteCode}</span>
            <Badge className={cn('text-[10px] font-semibold uppercase tracking-wide', stageColor)}>
              {stageLabel}
            </Badge>
            {routeUfLabel && (
              <Badge variant="outline" className="text-xs font-medium">
                <Route className="w-3 h-3 mr-1" />
                {routeUfLabel}
              </Badge>
            )}
            {kmBandLabel && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {kmBandLabel} km
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{clientName}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onDownloadPdf && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              title="Baixar PDF da cotação"
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>
          )}
          {canManage && showRecalcular && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRecalcular}
              disabled={isRecalculating}
              title="Recalcular memória de cálculo"
            >
              {isRecalculating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          )}
          {canManage && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {canManage && canConvert && (
        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={onConvertToOS} className="gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Converter para OS
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onConvertToFAT}
            disabled={isConvertingToFat}
            className="gap-1.5"
          >
            {isConvertingToFat ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Receipt className="w-3.5 h-3.5" />
            )}
            Converter para FAT
          </Button>
        </div>
      )}
    </>
  );
}

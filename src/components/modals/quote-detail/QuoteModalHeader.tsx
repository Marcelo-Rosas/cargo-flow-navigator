import { Route, Pencil, ArrowRightLeft, Receipt, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  showRecalcular,
}: QuoteModalHeaderProps) {
  return (
    <DialogHeader>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-xl font-bold">{quoteCode ?? 'Cotação'}</DialogTitle>
            <Badge className={cn(stageColor)}>{stageLabel}</Badge>
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
          <p className="text-sm font-semibold text-foreground">{clientName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManage && canConvert && (
            <>
              <Button variant="outline" size="sm" onClick={onConvertToOS} className="gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Converter para OS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onConvertToFAT}
                disabled={isConvertingToFat}
                className="gap-2"
              >
                {isConvertingToFat ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Receipt className="w-4 h-4" />
                )}
                Converter para FAT
              </Button>
            </>
          )}
          {canManage && (
            <>
              {showRecalcular && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRecalcular}
                  disabled={isRecalculating}
                  className="gap-1.5"
                  title="Recalcular memória de cálculo"
                >
                  {isRecalculating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Recalcular
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </DialogHeader>
  );
}

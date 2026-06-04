import { type FC } from 'react';
import { Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  getAnttOperationTableLabel,
  resolveAnttOperationTable,
  type AnttFloorFlags,
} from '@/lib/antt-floor-calc';
import { formatCurrency } from '@/lib/formatters';

interface AnttFloorWizardCardProps {
  flags: AnttFloorFlags;
  onChange: (patch: Partial<AnttFloorFlags>) => void;
  pisoPreview: number | null;
  axesCount: number | null;
  ccd: number | null;
  cc: number | null;
  kmDistance: number;
}

export const AnttFloorWizardCard: FC<AnttFloorWizardCardProps> = ({
  flags,
  onChange,
  pisoPreview,
  axesCount,
  ccd,
  cc,
  kmDistance,
}) => {
  const table = resolveAnttOperationTable(flags);
  const tableLabel = getAnttOperationTableLabel(table);

  return (
    <div
      className="col-span-3 space-y-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4"
      data-testid="antt-floor-wizard-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" aria-hidden />
          <h4 className="text-sm font-semibold">Piso mínimo ANTT</h4>
        </div>
        <Badge variant="outline" className="text-[10px] font-normal">
          {tableLabel}
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Carga geral — mesmos critérios da{' '}
        <a
          href="https://calculadorafrete.antt.gov.br/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          calculadora ANTT
        </a>
        . Define o piso mínimo do carreteiro (PAG base) na lotação.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
          <Label htmlFor="antt-composicao-veicular" className="text-xs font-normal leading-snug">
            Composição veicular
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              Automotor + implemento
            </span>
          </Label>
          <Switch
            id="antt-composicao-veicular"
            checked={flags.composicaoVeicular}
            onCheckedChange={(checked) => onChange({ composicaoVeicular: checked })}
            aria-label="Composição veicular (automotor e implemento)"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
          <Label htmlFor="antt-alto-desempenho" className="text-xs font-normal leading-snug">
            Alto desempenho
          </Label>
          <Switch
            id="antt-alto-desempenho"
            checked={flags.altoDesempenho}
            onCheckedChange={(checked) => onChange({ altoDesempenho: checked })}
            aria-label="Transporte de alto desempenho"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-md border bg-background/80 px-3 py-2">
          <Label htmlFor="antt-retorno-vazio" className="text-xs font-normal leading-snug">
            Retorno vazio
            <span className="mt-0.5 block text-[10px] text-muted-foreground">
              + km × CCD na volta
            </span>
          </Label>
          <Switch
            id="antt-retorno-vazio"
            checked={flags.retornoVazio}
            onCheckedChange={(checked) => onChange({ retornoVazio: checked })}
            aria-label="Retorno vazio"
          />
        </div>
      </div>

      {(!axesCount || kmDistance <= 0) && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Informe tipo de veículo (passo Identificação), calcule o km e selecione modalidade Lotação
          para exibir o piso.
        </p>
      )}

      {pisoPreview != null && pisoPreview > 0 && axesCount != null && ccd != null && cc != null && (
        <p className="text-xs tabular-nums text-muted-foreground">
          Piso estimado:{' '}
          <span className="font-semibold text-foreground">{formatCurrency(pisoPreview)}</span>
          {' · '}
          {Math.ceil(kmDistance)} km × {ccd.toFixed(4)} + {formatCurrency(cc)}
          {flags.retornoVazio ? ` + retorno ${Math.ceil(kmDistance)} km × ${ccd.toFixed(4)}` : ''}
          {' · '}
          {axesCount} eixos
        </p>
      )}
    </div>
  );
};

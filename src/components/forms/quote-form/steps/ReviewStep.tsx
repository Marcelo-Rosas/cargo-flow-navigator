import type { UseFormReturn } from 'react-hook-form';
import { CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { SectionBlock } from '@/components/ui/section-block';
import { FinancialRouteInfo } from '@/components/financial/modal-sections/FinancialRouteInfo';
import { formatCurrency } from '@/lib/formatters';
import type { FreightCalculationOutput } from '@/lib/freightCalculator';
import type { QuoteFormData } from '../types';
import { PAYMENT_METHOD_LABELS } from '@/types/pricing';

function formatDateBR(d: string | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

interface ReviewStepProps {
  form: UseFormReturn<QuoteFormData>;
  calculationResult: FreightCalculationOutput | null;
  weightUnit: 'kg' | 'ton';
  vehicleTypeName: string;
  clientName: string;
  shipperName: string;
  isLegacy?: boolean;
}

export function ReviewStep({
  form,
  calculationResult,
  weightUnit,
  vehicleTypeName,
  clientName,
  shipperName,
  isLegacy = false,
}: ReviewStepProps) {
  const values = form.getValues();
  const baseFreight = calculationResult?.components?.baseFreight ?? 0;
  const totalCliente = isLegacy
    ? (Number(values.value) ?? 0)
    : (calculationResult?.totals?.totalCliente ?? 0);
  const adicionais = totalCliente - baseFreight;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Banner de Sucesso */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center gap-4">
        <div className="bg-emerald-500 p-2 rounded-full shrink-0">
          <CheckCircle2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-400">
            Tudo pronto para salvar!
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-500/80">
            Revise os detalhes abaixo antes de confirmar a cotação.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
        <SectionBlock label="Rota e Cliente">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span
                className="font-medium text-right min-w-0 truncate ml-2"
                title={clientName || undefined}
              >
                {clientName || '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embarcador</span>
              <span
                className="font-medium text-right min-w-0 truncate ml-2"
                title={shipperName || undefined}
              >
                {shipperName || '—'}
              </span>
            </div>
            <Separator />
            <div className="space-y-2">
              <span className="text-muted-foreground text-xs block">Rota</span>
              <FinancialRouteInfo
                origin={values.origin || '—'}
                destination={values.destination || '—'}
                originCep={values.origin_cep || undefined}
                destinationCep={values.destination_cep || undefined}
                routeStops={(values.route_stops ?? []).map((s, i) => ({
                  city_uf: s.city_uf ?? undefined,
                  cep: s.cep ?? undefined,
                  name: values.additional_recipients?.[i]?.name ?? undefined,
                }))}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distância</span>
              <span className="font-medium">
                {values.km_distance != null ? `${values.km_distance} km` : '—'}
              </span>
            </div>
          </div>
        </SectionBlock>

        <SectionBlock label="Carga e Transporte">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo de Carga</span>
              <span className="font-medium">{values.cargo_type || '—'}</span>
            </div>
            {!isLegacy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Veículo</span>
                <span className="font-medium">{vehicleTypeName || '—'}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso</span>
              <span className="font-medium">
                {values.weight != null ? `${values.weight} ${weightUnit}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume</span>
              <span className="font-medium">
                {values.volume != null ? `${values.volume} m³` : '—'}
              </span>
            </div>
          </div>
        </SectionBlock>
      </div>

      {/* Composição Financeira */}
      <SectionBlock label={isLegacy ? 'FAT + PAG (manual)' : 'Composição Financeira'}>
        {isLegacy ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Valor Cliente (FAT)</p>
              <p className="text-lg font-semibold">{formatCurrency(totalCliente)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Valor Carreteiro (PAG)</p>
              <p className="text-lg font-semibold">
                {formatCurrency(Number(values.carreteiro_real) ?? 0)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-[10px] text-primary/80 mb-1 font-bold uppercase tracking-widest">
                Margem
              </p>
              <p className="text-2xl font-black text-primary">
                {formatCurrency(totalCliente - (Number(values.carreteiro_real) ?? 0))}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Frete Base</p>
              <p className="text-lg font-semibold">{formatCurrency(baseFreight)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-[10px] text-muted-foreground mb-1">Adicionais e Taxas</p>
              <p className="text-lg font-semibold">{formatCurrency(adicionais)}</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-[10px] text-primary/80 mb-1 font-bold uppercase tracking-widest">
                Total Cliente
              </p>
              <p className="text-2xl font-black text-primary">{formatCurrency(totalCliente)}</p>
            </div>
          </div>
        )}
      </SectionBlock>

      {/* Pagamento e Datas */}
      {(values.payment_method ||
        values.advance_due_date ||
        values.balance_due_date ||
        values.estimated_loading_date) && (
        <SectionBlock label="Pagamento e Datas">
          <div className="space-y-2 text-sm">
            {values.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Forma de Pagamento</span>
                <span className="font-medium">
                  {PAYMENT_METHOD_LABELS[
                    values.payment_method as keyof typeof PAYMENT_METHOD_LABELS
                  ] || values.payment_method}
                </span>
              </div>
            )}
            {values.advance_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Adiantamento / À Vista</span>
                <span className="font-medium">{formatDateBR(values.advance_due_date)}</span>
              </div>
            )}
            {values.balance_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Saldo / Vencimento</span>
                <span className="font-medium">{formatDateBR(values.balance_due_date)}</span>
              </div>
            )}
            {values.estimated_loading_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previsão de Carregamento</span>
                  <span className="font-semibold text-primary">
                    {formatDateBR(values.estimated_loading_date)}
                  </span>
                </div>
              </>
            )}
          </div>
        </SectionBlock>
      )}

      {/* Observações */}
      {values.notes && (
        <SectionBlock label="Observações">
          <p className="text-sm italic text-muted-foreground/80 leading-relaxed">
            &ldquo;{values.notes}&rdquo;
          </p>
        </SectionBlock>
      )}
    </div>
  );
}

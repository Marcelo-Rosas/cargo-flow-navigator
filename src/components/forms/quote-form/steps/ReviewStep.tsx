import type { UseFormReturn } from 'react-hook-form';
import { CheckCircle2, MapPin, Truck, DollarSign, FileText, CalendarDays } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
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
}

export function ReviewStep({
  form,
  calculationResult,
  weightUnit,
  vehicleTypeName,
  clientName,
  shipperName,
}: ReviewStepProps) {
  const values = form.getValues();
  const baseFreight = calculationResult?.components?.baseFreight ?? 0;
  const totalCliente = calculationResult?.totals?.totalCliente ?? 0;
  const adicionais = totalCliente - baseFreight;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Banner de Sucesso Visual */}
      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-xl flex items-center gap-4">
        <div className="bg-emerald-500 p-2 rounded-full">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card: Logística e Rota */}
        <div className="border rounded-xl p-5 space-y-4 bg-card/50">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <MapPin className="w-4 h-4" /> Rota e Cliente
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium text-right">{clientName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Embarcador:</span>
              <span className="font-medium text-right">{shipperName || '—'}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Origem:</span>
              <span className="font-medium text-right">{values.origin || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Destino:</span>
              <span className="font-medium text-right">{values.destination || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Distância:</span>
              <span className="font-medium">
                {values.km_distance != null ? `${values.km_distance} km` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Card: Carga e Veículo */}
        <div className="border rounded-xl p-5 space-y-4 bg-card/50">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Truck className="w-4 h-4" /> Carga e Transporte
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo de Carga:</span>
              <span className="font-medium">{values.cargo_type || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Veículo:</span>
              <span className="font-medium">{vehicleTypeName || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Peso:</span>
              <span className="font-medium">
                {values.weight != null ? `${values.weight} ${weightUnit}` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-medium">
                {values.volume != null ? `${values.volume} m³` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Card: Financeiro (Destaque) */}
      <div className="border rounded-xl p-5 space-y-4 bg-primary/5 border-primary/20">
        <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
          <DollarSign className="w-4 h-4" /> Composição Financeira
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center md:text-left">
            <p className="text-xs text-muted-foreground mb-1">Frete Base</p>
            <p className="text-lg font-semibold">{formatCurrency(baseFreight)}</p>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xs text-muted-foreground mb-1">Adicionais e Taxas</p>
            <p className="text-lg font-semibold">{formatCurrency(adicionais)}</p>
          </div>
          <div className="text-center md:text-right bg-primary/10 p-3 rounded-lg border border-primary/20">
            <p className="text-xs text-primary/80 mb-1 font-bold">VALOR TOTAL CLIENTE</p>
            <p className="text-2xl font-black text-primary">{formatCurrency(totalCliente)}</p>
          </div>
        </div>
      </div>

      {/* Card: Condição de Pagamento e Previsão */}
      {(values.payment_method ||
        values.advance_due_date ||
        values.balance_due_date ||
        values.estimated_loading_date) && (
        <div className="border rounded-xl p-5 space-y-4 bg-card/50">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <CalendarDays className="w-4 h-4" /> Pagamento e Datas
          </div>
          <div className="space-y-2 text-sm">
            {values.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Forma de Pagamento:</span>
                <span className="font-medium">
                  {PAYMENT_METHOD_LABELS[
                    values.payment_method as keyof typeof PAYMENT_METHOD_LABELS
                  ] || values.payment_method}
                </span>
              </div>
            )}
            {values.advance_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Adiantamento/À Vista:</span>
                <span className="font-medium">{formatDateBR(values.advance_due_date)}</span>
              </div>
            )}
            {values.balance_due_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data Saldo/Vencimento:</span>
                <span className="font-medium">{formatDateBR(values.balance_due_date)}</span>
              </div>
            )}
            {values.estimated_loading_date && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Previsão de Carregamento:</span>
                  <span className="font-semibold text-primary">
                    {formatDateBR(values.estimated_loading_date)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Observações */}
      {values.notes && (
        <div className="border rounded-xl p-5 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2 text-muted-foreground font-semibold text-[10px] uppercase">
            <FileText className="w-3 h-3" /> Observações da Cotação
          </div>
          <p className="text-sm italic text-muted-foreground/80 leading-relaxed">
            &ldquo;{values.notes}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

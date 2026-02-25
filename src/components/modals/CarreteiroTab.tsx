import { useState, useMemo, useEffect } from 'react';
import { DollarSign, Save, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MaskedInput } from '@/components/ui/masked-input';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentList } from '@/components/documents/DocumentList';
import { useUpdateOrder } from '@/hooks/useOrders';
import { usePaymentTerms } from '@/hooks/usePricingRules';
import { useEnsureFinancialDocument } from '@/hooks/useEnsureFinancialDocument';
import { supabase } from '@/integrations/supabase/client';
import { asInsert } from '@/lib/supabase-utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { OrderWithOccurrences } from '@/hooks/useOrders';

interface CarreteiroTabProps {
  order: OrderWithOccurrences;
  canManage: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));

export function CarreteiroTab({ order, canManage }: CarreteiroTabProps) {
  const updateOrderMutation = useUpdateOrder();
  const ensureFinancialDocMutation = useEnsureFinancialDocument();
  const { data: paymentTermsList } = usePaymentTerms(true);

  // --- Seção 1: Valor Negociado ---
  const initialCents =
    order.carreteiro_real != null ? String(Math.round(Number(order.carreteiro_real) * 100)) : '';
  const [carreteiroRealCents, setCarreteiroRealCents] = useState(initialCents);

  useEffect(() => {
    const cents =
      order.carreteiro_real != null ? String(Math.round(Number(order.carreteiro_real) * 100)) : '';
    setCarreteiroRealCents(cents);
  }, [order.carreteiro_real]);

  const carreteiroRealValue =
    carreteiroRealCents.length > 0 ? Number(carreteiroRealCents) / 100 : null;

  const anttValue = order.carreteiro_antt != null ? Number(order.carreteiro_antt) : null;
  const kmDistance = Number(order.km_distance ?? 0);

  const diff =
    carreteiroRealValue != null && anttValue != null ? carreteiroRealValue - anttValue : null;

  const handleSaveCarreteiroReal = async () => {
    if (carreteiroRealValue == null) {
      toast.error('Informe o valor do carreteiro');
      return;
    }
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { carreteiro_real: carreteiroRealValue },
      });
      toast.success('Valor do carreteiro salvo');
    } catch {
      toast.error('Erro ao salvar valor do carreteiro');
    }
  };

  // --- Seção 2: Condição de Pagamento do Carreteiro ---
  const [selectedPaymentTermId, setSelectedPaymentTermId] = useState(
    order.carrier_payment_term_id ?? ''
  );

  useEffect(() => {
    setSelectedPaymentTermId(order.carrier_payment_term_id ?? '');
  }, [order.carrier_payment_term_id]);

  const selectedPaymentTerm = useMemo(() => {
    if (!paymentTermsList || !selectedPaymentTermId) return null;
    return paymentTermsList.find((pt) => pt.id === selectedPaymentTermId) ?? null;
  }, [paymentTermsList, selectedPaymentTermId]);

  const advancePercent = selectedPaymentTerm?.advance_percent ?? 0;
  const balancePercent = 100 - advancePercent;
  const baseValue = carreteiroRealValue ?? anttValue ?? 0;
  const advanceAmount = (baseValue * advancePercent) / 100;
  const balanceAmount = (baseValue * balancePercent) / 100;

  const handleSavePaymentTerm = async (ptId: string) => {
    setSelectedPaymentTermId(ptId);
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { carrier_payment_term_id: ptId || null },
      });
      toast.success('Condição de pagamento do carreteiro salva');
    } catch {
      toast.error('Erro ao salvar condição de pagamento');
    }
  };

  // --- Seção 3: Datas de Adiantamento / Saldo ---
  const [advanceDate, setAdvanceDate] = useState(order.carrier_advance_date ?? '');
  const [balanceDate, setBalanceDate] = useState(order.carrier_balance_date ?? '');

  useEffect(() => {
    setAdvanceDate(order.carrier_advance_date ?? '');
    setBalanceDate(order.carrier_balance_date ?? '');
  }, [order.carrier_advance_date, order.carrier_balance_date]);

  const handleSaveDate = async (
    field: 'carrier_advance_date' | 'carrier_balance_date',
    value: string
  ) => {
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        updates: { [field]: value || null },
      });
      toast.success('Data salva');
    } catch {
      toast.error('Erro ao salvar data');
    }
  };

  // --- Seção 4: Enviar para Financeiro PAG ---
  const handleEnviarParaPAG = async () => {
    if (!order.id) return;
    if (carreteiroRealValue == null || carreteiroRealValue <= 0) {
      toast.error('Informe o valor do carreteiro antes de enviar para o financeiro');
      return;
    }

    try {
      // 1. Ensure PAG document exists
      const result = await ensureFinancialDocMutation.mutateAsync({
        docType: 'PAG',
        sourceId: order.id,
        totalAmount: carreteiroRealValue,
      });

      // 2. Try to get the financial_document to insert installments
      const { data: finDoc } = await supabase
        .from('financial_documents')
        .select('id')
        .eq('source_id', order.id)
        .eq('type', 'PAG')
        .maybeSingle();

      if (finDoc?.id) {
        // Check if installments already exist
        const { data: existingInstallments } = await supabase
          .from('financial_installments')
          .select('id')
          .eq('financial_document_id', finDoc.id);

        if (!existingInstallments || existingInstallments.length === 0) {
          if (advancePercent > 0) {
            // Insert 2 installments: advance + balance
            const installments = [
              {
                financial_document_id: finDoc.id,
                amount: advanceAmount,
                due_date: advanceDate || new Date().toISOString().slice(0, 10),
                payment_method: `Adiantamento ${advancePercent}%`,
                status: 'pendente' as const,
              },
              {
                financial_document_id: finDoc.id,
                amount: balanceAmount,
                due_date: balanceDate || new Date().toISOString().slice(0, 10),
                payment_method: `Saldo ${balancePercent}%`,
                status: 'pendente' as const,
              },
            ];

            const { error: insError } = await supabase
              .from('financial_installments')
              .insert(installments.map(asInsert));

            if (insError) {
              console.error('Error inserting installments:', insError);
              toast.error('PAG criado, mas erro ao criar parcelas: ' + insError.message);
              return;
            }
          } else {
            // Insert 1 single installment
            const { error: insError } = await supabase.from('financial_installments').insert(
              asInsert({
                financial_document_id: finDoc.id,
                amount: carreteiroRealValue,
                due_date: balanceDate || advanceDate || new Date().toISOString().slice(0, 10),
                payment_method: 'Pagamento Único',
                status: 'pendente' as const,
              })
            );

            if (insError) {
              console.error('Error inserting installment:', insError);
              toast.error('PAG criado, mas erro ao criar parcela: ' + insError.message);
              return;
            }
          }
        }
      }

      toast.success('PAG enviado para Contas a Pagar com parcelas');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Erro ao enviar para PAG';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Seção 1: Valor Negociado */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <DollarSign className="w-4 h-4" />
          <span className="text-sm font-medium">Valor Negociado (Carreteiro)</span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Valor Real (R$)</label>
            <MaskedInput
              mask="currency"
              value={carreteiroRealCents}
              onValueChange={(rawValue) => setCarreteiroRealCents(rawValue)}
              placeholder="0,00"
              disabled={!canManage}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">ANTT (base)</label>
            <p className="font-semibold text-foreground text-sm mt-1.5">
              {anttValue != null ? formatCurrency(anttValue) : '—'}
            </p>
          </div>
        </div>

        {/* Comparativo */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Diferença</p>
            {diff != null ? (
              <p
                className={cn(
                  'font-semibold text-sm',
                  diff > 0 ? 'text-warning-foreground' : 'text-success'
                )}
              >
                {formatCurrency(diff)}
              </p>
            ) : (
              <p className="font-semibold text-foreground text-sm">—</p>
            )}
          </div>
          {kmDistance > 0 && (
            <>
              <div>
                <p className="text-xs text-muted-foreground">R$/km ANTT</p>
                <p className="font-semibold text-foreground text-sm">
                  {anttValue != null ? `R$ ${(anttValue / kmDistance).toFixed(2)}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">R$/km Real</p>
                {carreteiroRealValue != null ? (
                  <p
                    className={cn(
                      'font-semibold text-sm',
                      anttValue != null && carreteiroRealValue > anttValue
                        ? 'text-warning-foreground'
                        : 'text-success'
                    )}
                  >
                    R$ {(carreteiroRealValue / kmDistance).toFixed(2)}
                  </p>
                ) : (
                  <p className="font-semibold text-foreground text-sm">—</p>
                )}
              </div>
            </>
          )}
        </div>

        {canManage && (
          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveCarreteiroReal}
              disabled={updateOrderMutation.isPending}
              className="gap-2"
            >
              {updateOrderMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar Valor
            </Button>
          </div>
        )}
      </div>

      {/* Seção 2: Condição de Pagamento */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <div className="flex items-center gap-2 text-muted-foreground mb-3">
          <span className="text-sm font-medium">Condição de Pagamento (Carreteiro)</span>
        </div>

        <Select
          value={selectedPaymentTermId}
          onValueChange={handleSavePaymentTerm}
          disabled={!canManage}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione a condição de pagamento" />
          </SelectTrigger>
          <SelectContent>
            {paymentTermsList?.map((pt) => (
              <SelectItem key={pt.id} value={pt.id}>
                {pt.name} — {pt.advance_percent ?? 0}% adiantamento / {pt.days ?? 0} dias
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPaymentTerm && (
          <div className="mt-2 text-xs text-muted-foreground">
            {selectedPaymentTerm.advance_percent != null && selectedPaymentTerm.advance_percent > 0
              ? `${selectedPaymentTerm.advance_percent}% Adiantamento / ${100 - selectedPaymentTerm.advance_percent}% Saldo em ${selectedPaymentTerm.days ?? 0} dias`
              : `Pagamento à vista em ${selectedPaymentTerm.days ?? 0} dias`}
          </div>
        )}
      </div>

      {/* Seção 3: Mini-cards Adiantamento / Saldo (visível quando advance > 0) */}
      {selectedPaymentTerm && advancePercent > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* Card Adiantamento */}
          <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
            <p className="text-xs text-muted-foreground mb-0.5">Adiantamento {advancePercent}%</p>
            <p className="font-semibold text-foreground">{formatCurrency(advanceAmount)}</p>
            <div className="mt-2">
              <label className="text-xs text-muted-foreground block mb-1">Data Adiantamento</label>
              <Input
                type="date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
                onBlur={() => handleSaveDate('carrier_advance_date', advanceDate)}
                disabled={!canManage}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Card Saldo */}
          <div className="p-3 rounded-lg border bg-muted/30 border-border">
            <p className="text-xs text-muted-foreground mb-0.5">Saldo {balancePercent}%</p>
            <p className="font-semibold text-foreground">{formatCurrency(balanceAmount)}</p>
            <div className="mt-2">
              <label className="text-xs text-muted-foreground block mb-1">Data Saldo</label>
              <Input
                type="date"
                value={balanceDate}
                onChange={(e) => setBalanceDate(e.target.value)}
                onBlur={() => handleSaveDate('carrier_balance_date', balanceDate)}
                disabled={!canManage}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* Pagamento único (sem split) */}
      {selectedPaymentTerm && advancePercent === 0 && (
        <div className="p-3 rounded-lg border bg-muted/30 border-border">
          <p className="text-xs text-muted-foreground mb-0.5">Pagamento Único (100%)</p>
          <p className="font-semibold text-foreground">{formatCurrency(baseValue)}</p>
          <div className="mt-2">
            <label className="text-xs text-muted-foreground block mb-1">Data de Pagamento</label>
            <Input
              type="date"
              value={balanceDate}
              onChange={(e) => setBalanceDate(e.target.value)}
              onBlur={() => handleSaveDate('carrier_balance_date', balanceDate)}
              disabled={!canManage}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Seção 4: Enviar para Financeiro PAG */}
      {canManage && (
        <div className="flex justify-center">
          <Button
            onClick={handleEnviarParaPAG}
            disabled={ensureFinancialDocMutation.isPending || carreteiroRealValue == null}
            className="gap-2"
          >
            {ensureFinancialDocMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Enviar para Contas a Pagar
          </Button>
        </div>
      )}

      {/* Seção 5: Upload de Comprovantes */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border">
        <p className="text-sm font-medium text-muted-foreground mb-3">Comprovantes de Pagamento</p>
        <DocumentUpload
          orderId={order.id}
          orderStage={order.stage}
          financialContext="carrier_payment"
        />
        <div className="mt-4">
          <DocumentList orderId={order.id} />
        </div>
      </div>
    </div>
  );
}

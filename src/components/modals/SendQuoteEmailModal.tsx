import { useState, useEffect } from 'react';
import { Mail, Loader2, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Database } from '@/integrations/supabase/types';
import { useSendQuoteEmail } from '@/hooks/useSendQuoteEmail';
import { Badge } from '@/components/ui/badge';
import { usePaymentTerms } from '@/hooks/usePricingRules';
import type { PaymentTerm } from '@/types/pricing';

type Quote = Database['public']['Tables']['quotes']['Row'];

interface SendQuoteEmailModalProps {
  open: boolean;
  onClose: () => void;
  quote: Quote | null;
}

export function SendQuoteEmailModal({ open, onClose, quote }: SendQuoteEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [emailMode, setEmailMode] = useState<'simplified' | 'detailed'>('simplified');
  const sendMutation = useSendQuoteEmail();
  const { data: paymentTerms } = usePaymentTerms(true);

  useEffect(() => {
    if (quote && open) {
      setRecipientEmail((quote.client_email as string) || (quote.shipper_email as string) || '');
      setCc('');
      setBcc('');
      setShowCcBcc(false);
      setEmailMode('simplified');
    }
  }, [quote, open]);

  const handleSend = async () => {
    if (!quote || !recipientEmail) return;

    await sendMutation.mutateAsync(
      {
        quoteId: quote.id,
        recipientEmail,
        cc: cc.trim() || undefined,
        bcc: bcc.trim() || undefined,
        emailMode,
      },
      { onSuccess: () => onClose() }
    );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const currentPaymentTerm: PaymentTerm | undefined =
    quote?.payment_term_id && paymentTerms
      ? paymentTerms.find((term) => term.id === quote.payment_term_id)
      : undefined;

  const hasBalanceOnUnloading = currentPaymentTerm?.days === 1;

  const paymentTermLabel =
    currentPaymentTerm &&
    (() => {
      const adv = currentPaymentTerm.advance_percent ?? 0;
      const days = currentPaymentTerm.days;

      if (adv === 0 && days === 0) return 'À vista';
      if (adv === 0) return `${days} dias`;
      return `${adv}/${100 - adv} em ${days} dias`;
    })();

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Enviar Cotação por E-mail
          </DialogTitle>
          <DialogDescription>
            A cotação será enviada e movida automaticamente para Negociação.
          </DialogDescription>
        </DialogHeader>

        {/* Quote Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">{quote.quote_code ?? '—'}</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(Number(quote.value))}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{quote.client_name}</p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>{quote.origin}</span>
            <span>→</span>
            <span>{quote.destination}</span>
          </div>
          {paymentTermLabel && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="text-muted-foreground">Prazo de pagamento:</span>
              <span className="font-medium text-foreground">{paymentTermLabel}</span>
              <div className="flex flex-wrap gap-1">
                {currentPaymentTerm && (
                  <Badge variant="outline" className="text-[10px]">
                    {(() => {
                      const adv = currentPaymentTerm.advance_percent ?? 0;
                      const days = currentPaymentTerm.days;
                      if (adv === 0 && days === 0) return 'À vista';
                      if (adv === 0) return `${days}d`;
                      return `${adv}% adiant. / ${100 - adv}% saldo`;
                    })()}
                  </Badge>
                )}
                {hasBalanceOnUnloading && (
                  <Badge variant="secondary" className="text-[10px]">
                    Saldo na descarga
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recipient */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="recipient-email">Destinatário</Label>
            <button
              type="button"
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCcBcc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              CC / CCO
            </button>
          </div>
          <Input
            id="recipient-email"
            type="email"
            placeholder="email@exemplo.com"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
          />
        </div>

        {/* CC / BCC */}
        {showCcBcc && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <Label htmlFor="cc-email">CC (Cópia)</Label>
              <Input
                id="cc-email"
                type="email"
                placeholder="copia@exemplo.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcc-email">CCO (Cópia Oculta)</Label>
              <Input
                id="bcc-email"
                type="email"
                placeholder="oculta@exemplo.com"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Email Mode */}
        <div className="space-y-2">
          <Label>Modelo do E-mail</Label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="emailMode"
                value="simplified"
                checked={emailMode === 'simplified'}
                onChange={() => setEmailMode('simplified')}
                className="accent-primary"
              />
              <span className="text-sm">Simplificado (Cliente)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="emailMode"
                value="detailed"
                checked={emailMode === 'detailed'}
                onChange={() => setEmailMode('detailed')}
                className="accent-primary"
              />
              <span className="text-sm">Detalhado (Interno)</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {emailMode === 'simplified'
              ? 'Mostra apenas pedágio, aluguel e carga/descarga.'
              : 'Mostra composição completa do frete.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={sendMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !recipientEmail.includes('@')}
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Enviar E-mail
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

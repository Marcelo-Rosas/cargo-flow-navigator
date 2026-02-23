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
  const sendMutation = useSendQuoteEmail();

  useEffect(() => {
    if (quote && open) {
      setRecipientEmail(
        (quote.client_email as string) || (quote.shipper_email as string) || ''
      );
      setCc('');
      setBcc('');
      setShowCcBcc(false);
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
      },
      { onSuccess: () => onClose() }
    );
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

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
            A cotação será enviada com o resumo de valores e condições.
          </DialogDescription>
        </DialogHeader>

        {/* Quote Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-foreground">
              {quote.quote_code ?? '—'}
            </span>
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

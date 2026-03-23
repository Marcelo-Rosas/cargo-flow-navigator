import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edgeFunctions';
import { asDb, asInsert } from '@/lib/supabase-utils';
import { toast } from 'sonner';

interface SendQuoteEmailParams {
  quoteId: string;
  recipientEmail: string;
  cc?: string;
  bcc?: string;
  emailMode?: 'simplified' | 'detailed';
}

export function useSendQuoteEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId, recipientEmail, cc, bcc, emailMode }: SendQuoteEmailParams) => {
      // 1. Send the email via Edge Function.
      // Auth headers are handled centrally by invokeEdgeFunction (token refresh + retry).
      const data = await invokeEdgeFunction<{ error?: string }>('send-quote-email', {
        body: { quoteId, recipientEmail, cc, bcc, emailMode: emailMode ?? 'simplified' },
      });

      if (data?.error) throw new Error(data.error);

      // 2. After successful email, update quote: mark as sent + move to negociação
      const { error: updateError } = await supabase
        .from('quotes')
        .update(
          asInsert({
            email_sent: true,
            email_sent_at: new Date().toISOString(),
            stage: 'negociacao',
          })
        )
        .eq('id', asDb(quoteId));

      if (updateError) throw updateError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('E-mail enviado — cotação movida para Negociação');
    },
    onError: (err: Error) => {
      toast.error(`Falha ao enviar e-mail: ${err.message}`);
    },
  });
}

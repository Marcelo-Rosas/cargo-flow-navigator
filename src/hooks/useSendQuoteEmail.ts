import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendQuoteEmailParams {
  quoteId: string;
  recipientEmail: string;
}

export function useSendQuoteEmail() {
  return useMutation({
    mutationFn: async ({ quoteId, recipientEmail }: SendQuoteEmailParams) => {
      const { data, error } = await supabase.functions.invoke('send-quote-email', {
        body: { quoteId, recipientEmail },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: () => {
      toast.success('E-mail enviado com sucesso');
    },
    onError: (err: Error) => {
      toast.error(`Falha ao enviar e-mail: ${err.message}`);
    },
  });
}

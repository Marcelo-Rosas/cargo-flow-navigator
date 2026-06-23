import { Download, FileCheck2, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CteEmissionInline } from '@/components/boards/CteEmissionInline';
import { useCteEmissionByQuote, describeCteStatus } from '@/hooks/useCteEmission';
import { supabase } from '@/integrations/supabase/client';

interface OrderCteTabProps {
  quoteId: string | null | undefined;
  canManage: boolean;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-all">{value ?? '—'}</dd>
    </div>
  );
}

export function OrderCteTab({ quoteId, canManage }: OrderCteTabProps) {
  const { data: emission, isLoading } = useCteEmissionByQuote(quoteId);

  // Focus expõe o DACTE numa URL S3 (em response_received) enquanto o webhook não
  // espelha o PDF para o storage próprio (TODO F1.9). Usa o storage quando houver,
  // senão cai para a URL do Focus.
  const focusDacteUrl = (emission?.response_received as { caminho_dacte?: string } | null)
    ?.caminho_dacte;

  async function downloadDacte() {
    if (emission?.dacte_storage_path) {
      const [bucket, ...rest] = emission.dacte_storage_path.split('/');
      const { data } = await supabase.storage.from(bucket).createSignedUrl(rest.join('/'), 300);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
    }
    if (focusDacteUrl) window.open(focusDacteUrl, '_blank', 'noopener,noreferrer');
  }

  if (!quoteId) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem cotação vinculada — emissão de CT-e indisponível.
      </p>
    );
  }

  if (isLoading) {
    return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  }

  const { label, color } = describeCteStatus(emission?.status);
  const isAuthorized = emission?.status === 'authorized';
  const dataAutorizacao = emission?.data_autorizacao
    ? new Date(emission.data_autorizacao).toLocaleString('pt-BR')
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Conhecimento de Transporte (CT-e)</h3>
          <Badge variant="outline" className={`text-[10px] uppercase ${color}`}>
            {label}
          </Badge>
        </div>
        {/* Ações: Emitir / Reenviar / Consultar / DACTE / Cancelar */}
        <CteEmissionInline quoteId={quoteId} readOnly={!canManage} />
      </div>

      {emission ? (
        <>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 rounded-lg border p-4">
            <Field
              label="Número / Série"
              value={`#${emission.numero ?? '—'} / ${emission.serie ?? '—'}`}
            />
            <Field label="Ambiente" value={emission.ambiente} />
            <Field label="Status SEFAZ" value={emission.status_sefaz} />
            <Field label="Protocolo" value={emission.protocolo} />
            <Field label="Autorizado em" value={dataAutorizacao} />
            <Field label="Chave de Acesso" value={emission.chave_cte} />
          </dl>

          {emission.rejection_msg && (
            <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 p-3">
              Rejeição SEFAZ: {emission.rejection_msg}
            </p>
          )}

          {isAuthorized && (emission.dacte_storage_path || focusDacteUrl) && (
            <Button onClick={() => void downloadDacte()} className="gap-2">
              <Download className="w-4 h-4" />
              Baixar PDF (DACTE)
            </Button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-4">
          Nenhum CT-e emitido para esta OS. Use <strong>Emitir CT-e</strong> acima — após a
          autorização da SEFAZ, o botão <strong>Baixar PDF (DACTE)</strong> fica disponível.
        </p>
      )}
    </div>
  );
}

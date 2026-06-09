import type { SupabaseClient } from '@supabase/supabase-js';
import type { CollectionOrderAnttData } from '@/types/collectionOrder';
import type { RiskEvidence } from '@/types/risk';

export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

export function normalizePlate(s: string): string {
  return s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

function matchesAnttEvidence(
  evidence: RiskEvidence,
  driverCpf: string | null | undefined,
  vehiclePlate: string | null | undefined,
  requireValid: boolean
): boolean {
  if (evidence.evidence_type !== 'antt_rntrc_check') return false;
  if (requireValid && evidence.status !== 'valid') return false;

  const p = evidence.payload as Record<string, unknown> | null;
  if (!p) return false;

  if (p.cpf_cnpj) {
    if (!driverCpf || onlyDigits(String(p.cpf_cnpj)) !== onlyDigits(driverCpf)) return false;
  }
  if (p.vehicle_plate) {
    if (!vehiclePlate || normalizePlate(String(p.vehicle_plate)) !== normalizePlate(vehiclePlate)) {
      return false;
    }
  }
  return true;
}

function pickAnttEvidence(
  rows: RiskEvidence[],
  driverCpf: string | null | undefined,
  vehiclePlate: string | null | undefined,
  requireValid: boolean
): RiskEvidence | null {
  return rows.find((e) => matchesAnttEvidence(e, driverCpf, vehiclePlate, requireValid)) ?? null;
}

/** Mesma regra do RiskWorkflowWizard: evidência local válida → cross válida → local mais recente. */
export async function resolveAnttEvidenceForOrder(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    driverCpf?: string | null;
    vehiclePlate?: string | null;
  }
): Promise<RiskEvidence | null> {
  const { orderId, driverCpf, vehiclePlate } = params;

  const { data: evals } = await supabase
    .from('risk_evaluations')
    .select('id')
    .eq('entity_type', 'order')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1);

  const evalId = evals?.[0]?.id;
  let localRows: RiskEvidence[] = [];

  if (evalId) {
    const { data } = await supabase
      .from('risk_evidence' as 'documents')
      .select('*')
      .eq('evaluation_id', evalId)
      .eq('evidence_type', 'antt_rntrc_check')
      .order('created_at', { ascending: false });
    localRows = (data ?? []) as RiskEvidence[];
  }

  const localValid = pickAnttEvidence(localRows, driverCpf, vehiclePlate, true);
  if (localValid) return localValid;

  if (driverCpf && vehiclePlate) {
    const { data: crossRows } = await supabase
      .from('risk_evidence' as 'documents')
      .select('*')
      .eq('evidence_type', 'antt_rntrc_check')
      .eq('status', 'valid')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    const cpfNorm = onlyDigits(driverCpf);
    const plateNorm = normalizePlate(vehiclePlate);
    const crossMatch =
      (crossRows ?? []).find((row) => {
        const p = (row as RiskEvidence).payload as Record<string, unknown> | null;
        return (
          p != null &&
          onlyDigits(String(p.cpf_cnpj ?? '')) === cpfNorm &&
          normalizePlate(String(p.vehicle_plate ?? '')) === plateNorm
        );
      }) ?? null;

    if (crossMatch) return crossMatch as RiskEvidence;
  }

  return pickAnttEvidence(localRows, driverCpf, vehiclePlate, false);
}

export function anttEvidenceToCollectionOrderSnapshot(
  evidence: RiskEvidence,
  ownerFallback?: { cpf_cnpj?: string | null; city?: string | null; state?: string | null } | null
): CollectionOrderAnttData {
  const p = evidence.payload as Record<string, unknown>;

  const rawTransportador = (p.transportador as string) ?? null;
  let parsedType: 'TAC' | 'ETC' | null = null;
  let cleanTransportador = rawTransportador;
  if (rawTransportador) {
    const m = rawTransportador.match(/^\s*(TAC|ETC)\s*[-–—]\s*(.+)$/i);
    if (m) {
      parsedType = m[1].toUpperCase() as 'TAC' | 'ETC';
      cleanTransportador = m[2].trim();
    }
  }

  const ownerMunicipioUf =
    ownerFallback?.city || ownerFallback?.state
      ? [ownerFallback.city, ownerFallback.state].filter(Boolean).join('/')
      : null;

  const cpfFromPayload =
    (p.cpf_cnpj_mask as string | null) ?? (p.cpf_cnpj ? String(p.cpf_cnpj) : null) ?? null;

  return {
    situacao: (p.situacao as string) ?? null,
    situacao_raw: (p.situacao_raw as string) ?? null,
    rntrc_registry_type: ((p.rntrc_registry_type as 'TAC' | 'ETC' | null) ?? null) || parsedType,
    rntrc: (p.rntrc as string) ?? null,
    transportador: cleanTransportador,
    cpf_cnpj_mask: cpfFromPayload || ownerFallback?.cpf_cnpj || null,
    municipio_uf: ((p.municipio_uf as string) ?? null) || ownerMunicipioUf,
    cadastrado_desde: (p.cadastrado_desde as string) ?? null,
    apto: (p.apto as boolean | null) ?? null,
    veiculo_na_frota: (p.veiculo_na_frota as boolean | null) ?? null,
    comprovante_url: (p.comprovante_url as string) ?? null,
    comprovante_storage_path: (p.comprovante_storage_path as string) ?? null,
    checked_at: evidence.created_at ?? null,
  };
}

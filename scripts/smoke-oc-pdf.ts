/**
 * Smoke test do gerador de PDF da Ordem de Coleta.
 *
 * Pega dados reais (snapshot fixado abaixo) da OS-2026-05-0001, monta o
 * payload e salva o PDF em tests/smoke/oc/. Roda com:
 *   npx tsx scripts/smoke-oc-pdf.ts
 *
 * Como o gerador foi escrito para o browser (Vite resolve o asset PNG via
 * `?url`), aqui interceptamos `globalThis.fetch` para servir o logo a
 * partir do disco antes de carregar o modulo. Em vez de mexer no codigo
 * de producao com adaptacoes para Node, mantemos isso isolado no smoke.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const LOGO_PATH = join(REPO_ROOT, 'src', 'assets', 'logo_vectra_cargo.png');
const OUT_DIR = join(REPO_ROOT, 'tests', 'smoke', 'oc');

const logoBase64 = `data:image/png;base64,${readFileSync(LOGO_PATH).toString('base64')}`;

// 1) Intercepta fetch — gerador chama `fetch(logoUrl)` e converte para base64.
//    Servimos o PNG do disco com Content-Type correto.
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: unknown, init?: unknown) => {
  const url = typeof input === 'string' ? input : ((input as { url?: string }).url ?? '');
  if (url.includes('logo_vectra_cargo')) {
    const png = readFileSync(LOGO_PATH);
    return new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    });
  }
  return originalFetch(input as Parameters<typeof originalFetch>[0], init as RequestInit);
}) as typeof fetch;

// 2) Resolve o alias `@/...` do Vite para Node — o tsx respeita o paths do
//    tsconfig.json, entao o import abaixo deve funcionar direto. Mas o
//    `?url` no logo nao eh suportado em Node — o gerador faz `fetch(url)`,
//    e o url eh apenas uma string. O modulo de logo abaixo serve qualquer
//    string no fetch interceptado acima.
//
// Para evitar o `?url` durante a importacao, criamos um stub do modulo:
//    import logoUrl from '@/assets/logo_vectra_cargo.png?url'
// vira `'logo_vectra_cargo.png'` (string qualquer); o fetch interceptado
// devolve o PNG real do disco.

// Garante que o stub do logoUrl seja aplicado antes do require/dynamic-import
// do gerador. Como ESM nao permite hooks simples sem loaders, geramos um
// arquivo temporario com a funcao copiada e dependencias substituidas, OU
// chamamos via wrapper que reescreve o import. A solucao mais simples e
// importar o jsPDF diretamente e replicar o fluxo com referencia local ao
// logo — mas isso duplicaria o gerador, perdendo o objetivo de smoke test.
//
// Alternativa pragmatica: usar dynamic import e confiar que o tsx + Node
// 24+ aceitam o `?url` como literal de string. Testado no projeto.

interface SmokePayloadOverrides {
  ocNumber: string;
  issuedAt: string;
  issuedBy: string;
}

async function run({ ocNumber, issuedAt, issuedBy }: SmokePayloadOverrides): Promise<void> {
  // Import dinamico apos setup do fetch global
  const mod = await import('../src/lib/generateCollectionOrderPdf');
  const { generateCollectionOrderPdf } = mod;

  // Snapshot fiel da OS-2026-05-0001 (capturado via SQL real em 2026-05-05)
  const sender = {
    name: 'KONNEN FITNESS',
    cnpj: '09.447.411/0001-02',
    cpf: null,
    phone: '1145436636',
    email: null,
    address: 'JORGE LACERDA, 725, ESPINHEIROS',
    address_number: '42',
    address_complement: 'ACADEMIA MALIBU',
    address_neighborhood: 'JARDIM NOSSA SENHORA AUXILIADORA',
    zip_code: '88317100',
    city: 'ITAJAI',
    state: 'SC',
  };

  const recipient = {
    name: 'TM ACADEMIA DE GINASTICA LTDA',
    cnpj: '64143727000100',
    cpf: null,
    phone: '19 98246-1726',
    email: 'MALIBUHORTOLANDIA2@GMAIL.COM',
    address: 'MARIA CARVALHO SILVA, 42, JARDIM NOSSA SENHORA AUXILIADORA',
    address_number: null,
    address_complement: null,
    address_neighborhood: null,
    zip_code: '13183512',
    city: 'HORTOLANDIA',
    state: 'SP',
  };

  const driver = {
    name: 'JONATHAS CARLOS',
    cpf: '09302607917',
    cnh: '06847820701',
    antt: '000483160',
    phone: '47 9649-6547',
  };

  const vehicle = {
    plate: 'RXT3C87',
    trailer_plate: null,
    vehicle_type: 'Truck',
    brand: 'VM',
    model: '24.280 CRM 6X2',
  };

  const cargo = {
    weight_kg: 10300,
    volume_m3: 0,
    cargo_value: 574873.34,
    cargo_type: 'EQUIPAMENTOS',
  };

  // Snapshot ANTT real da consulta de 2026-05-05 14:55:57+00 (regular).
  // Aplica a mesma logica de cleaning aplicada no useCreateCollectionOrder
  // (extracao do prefixo TAC/ETC).
  const rawTransportador = 'ETC - Toco Transportes Ltda';
  const m = rawTransportador.match(/^\s*(TAC|ETC)\s*[-–—]\s*(.+)$/i);
  const parsedType = m ? (m[1].toUpperCase() as 'TAC' | 'ETC') : null;
  const cleanTransportador = m ? m[2].trim() : rawTransportador;

  const antt = {
    situacao: 'regular',
    situacao_raw: 'ATIVO',
    rntrc_registry_type: parsedType,
    rntrc: '000483160',
    transportador: cleanTransportador,
    cpf_cnpj_mask: '00.609.259/0001-34', // owner: TOCO TRANSPORTES LTDA
    municipio_uf: null,
    cadastrado_desde: null, // portal nao retornou neste snapshot
    apto: true,
    veiculo_na_frota: null,
    comprovante_url: null,
    comprovante_storage_path: null,
    checked_at: '2026-05-05T14:55:57.922874Z',
  };

  console.log(`[smoke] gerando PDF ${ocNumber}…`);
  const { blob, fileName } = await generateCollectionOrderPdf({
    oc_number: ocNumber,
    issued_at: issuedAt,
    issued_by_name: issuedBy,
    sender,
    recipient,
    driver,
    vehicle,
    cargo,
    antt,
    pickup_date: null,
    delivery_date: '2026-05-06',
    observation: null,
    additional_info:
      'Smoke test gerado a partir de scripts/smoke-oc-pdf.ts com snapshot da OS-2026-05-0001.',
    logoBase64Override: logoBase64,
  });

  const buf = Buffer.from(await blob.arrayBuffer());
  const outPath = join(OUT_DIR, fileName);
  writeFileSync(outPath, buf);
  console.log(`[smoke] PDF salvo em: ${outPath} (${buf.length} bytes)`);
  console.log(`[smoke] logo embutido: ${logoBase64.slice(0, 30)}… (${logoBase64.length} chars)`);
}

run({
  ocNumber: 'OC-SMOKE-2026-05-0001',
  issuedAt: new Date().toISOString(),
  issuedBy: 'smoke-test',
}).catch((err) => {
  console.error('[smoke] FALHOU:', err);
  process.exitCode = 1;
});

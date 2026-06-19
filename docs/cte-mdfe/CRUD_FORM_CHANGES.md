# CT-e / MDF-e via Focus — Mudanças necessárias em CRUDs e Forms

Documento de trabalho. Derivado do smoke E2E em homolog (2026-06-19) que **confirmou habilitação Focus/SEFAZ** e expôs, em escada, os gaps de dado e de form abaixo.

## Evidência do smoke (homolog)

| Tentativa | Quote | Resultado SEFAZ | Causa | Conclusão |
|---|---|---|---|---|
| 1 | COT-2026-06-0011 (PRATIQUE) | `481` IE deve ser informada p/ tomador Contribuinte | cliente `ie_indicator=1` + IE vazia | **habilitação OK** (não é mais `empresa_nao_habilitada`) |
| 2 | COT-2026-04-0016 (TM ACADEMIA) | `539` Duplicidade de CT-e | número/série já usados na SEFAZ homolog | 481 **resolvido** por `ie_indicator=9` |
| 3 | COT-2026-04-0013 (DUMBBELLS) | `212` Data emissão posterior ao recebimento | `data_emissao` em UTC (mapper) vs SEFAZ local UTC-3 | 539 **resolvido** por seed de sequência |

Pipeline avança a cada correção. Falta o fix de timezone (212) pra fechar em `autorizado`.

---

## 1. ClientForm (`src/components/forms/ClientForm.tsx`)

| Campo | Estado | Ação |
|---|---|---|
| `state_registration` (IE) | ✅ existe (linha 547) | Adicionar validação **condicional**: obrigatório quando `ie_indicator=1` |
| `ie_indicator` | ❌ **falta** | **Criar selector** (ver abaixo) |
| `ibge_code` | ❌ falta no form | Persistir código IBGE do município (auto-resolver do CEP no save, como o `emit-cte` faz em runtime) |

**Selector `ie_indicator`** (indicador de inscrição estadual do destinatário/tomador):
- `1` = Contribuinte ICMS → **exige IE** preenchida
- `2` = Contribuinte Isento → não envia IE
- `9` = **Não Contribuinte** → não envia IE (correto p/ academias / serviço)

Regra: hoje **todos os 569 clientes estão `ie_indicator=1`** (default de backfill errado). Academia = serviço = quase sempre `9`. O selector permite operar sem SQL.

Validação Zod sugerida:
```ts
ie_indicator: z.enum(['1','2','9']).default('9'),
state_registration: z.string().max(30).optional(),
// refine: if ie_indicator==='1' → state_registration obrigatório (não-vazio)
```

---

## 2. ShipperForm (`src/components/forms/ShipperForm.tsx`)

Embarcador = remetente. Em **CIF**, remetente é o tomador → sua IE/indicador importa.

| Campo | Estado | Ação |
|---|---|---|
| `state_registration` (IE) | ✅ existe (linha 543) | Validação condicional (igual ao cliente) |
| `ie_indicator` | ❌ falta | Criar selector (igual ao cliente) |
| `emit_cte_via` | ❌ falta no form | **Criar selector** `cfn` / `active` / `none` — hoje só via SQL. Permite migrar embarcador pro CFN sem SQL (28 hoje em `active`) |
| `ibge_code` | ❌ falta | Persistir IBGE do município (auto do CEP) |

**Selector `emit_cte_via`**:
- `cfn` = emite CT-e pelo CFN+Focus
- `active` = continua no emissor Active (não migrado)
- `none` = não emite

---

## 3. QuoteForm (`src/components/forms/QuoteForm.tsx`)

| Campo | Estado | Ação |
|---|---|---|
| `freight_type` (CIF/FOB) | ✅ existe (linha 2182) | Manter — é a fonte de verdade do tomador |
| `tomador_tipo` | ⚠️ manual, **null em 114/115 quotes** | **Derivar de `freight_type`** (ver §6.2). Mostrar como derivado read-only + override manual p/ casos raros |
| `nfe_keys` | ❌ fora do form | (Opcional) Input p/ anexar chave(s) NF-e da carga. Vazio → fallback "DECLARAÇÃO DE CARGA" (tipo 99) |

**Derivação tomador (FOB/CIF → CT-e):**

| freight_type | quem paga | tomador CT-e | `tomador_tipo` |
|---|---|---|---|
| FOB | destinatário | Destinatário | `3` |
| CIF | remetente | Remetente | `0` |

⚠️ Inconsistência real encontrada: COT-2026-06-0011 é `CIF` mas tinha `tomador_tipo=3` setado na mão (deveria ser `0`). Derivar elimina esse erro.
Ressalva: tomador `Expedidor(1)/Recebedor(2)/Outros(4)` não é expressável só por FOB/CIF — derivação default + override manual cobre.

---

## 4. VehicleForm (`src/components/forms/VehicleForm.tsx`) — para MDF-e

Colunas já existem no DB (migration F1.8 `vehicles_proprietario_fields`), **faltam no form**:

| Campo | Ação |
|---|---|
| `tipo_proprietario` | Selector: `0`=TAC Agregado, `1`=TAC Independente, `2`=Outros |
| `rntrc_proprietario` | Input RNTRC do proprietário (8 dígitos) |
| `cpf_cnpj_proprietario` | Input CPF/CNPJ do proprietário |

Motivo: MDF-e de veículo terceirizado usa o **RNTRC do proprietário**, não o da Vectra. Hoje o `mdfe-mapper` hardcoda `vectra.rntrc` — precisa ler desses campos. (DriverForm já tem RNTRC do motorista ✅.)

---

## 5. CompanySettings (emitente Vectra)

Migration `company_settings` já aplicada. **Verificar** se a tela expõe e edita os campos fiscais Vectra (CNPJ, IE, IEST, RNTRC, CRT, endereço, IBGE) — hoje vêm de env vars Supabase. Decisão: manter em env (secrets) ou migrar p/ tabela editável na UI.

---

## 6. Fixes de Edge/Mapper (não são form, mas exigidos pelo fluxo)

### 6.1 `cte-mapper.ts:222` — data_emissao timezone (rejeição 212) 🔴
```ts
// ATUAL (UTC — SEFAZ vê 3h no futuro → rejeita 212)
data_emissao: new Date().toISOString().slice(0, 19),
// CORRIGIR: emitir em horário local America/Sao_Paulo com offset -03:00
```

### 6.2 `emit-cte` / `cte-mapper` — derivar `tomador_tipo` de `freight_type`
Quando `quote.tomador_tipo` for null → derivar: `FOB→3`, `CIF→0`. Resolve o null em 114 quotes de uma vez.

### 6.3 `emit-cte` — validação fail-fast (evita ida à SEFAZ)
Retornar `422` cedo quando `ie_indicator=1 && state_registration` vazio ("contribuinte exige IE") em vez de deixar a SEFAZ rejeitar com 481.

### 6.4 `emit-cte` — re-emissão / retry de ref
`emit-cte` chama `buildCteRef(code)` com `retry=0`. Focus dedup por ref → re-POST do mesmo ref não re-emite. Adicionar param `force/retry` que incrementa o sufixo (`buildCteRef` já suporta `-r<n>`).

---

## 7. Correção de dado em massa (backfill)

- **569 clientes** com `ie_indicator=1` + IE nula. Reclassificar: academias/serviço (CNAE 9313 etc.) → `ie_indicator=9`. Comércio/indústria que sejam contribuintes → manter `1` + preencher IE (SINTEGRA por UF; BrasilAPI **não** traz IE).
- **Integridade CNPJ**: PRATIQUE (`39839621000107`) resolve p/ "LOCA MAIS LTDA" na BrasilAPI — possível CNPJ trocado. Auditar CNPJs dos clientes piloto antes do corte.

---

## 8. Runbook ops — sequência homolog/prod

- Homolog acumula CT-es de teste antigos → colisão de número (`539`). Antes de retestar, setar `cte_sequence.last_numero` acima do histórico (ex.: 9000).
- **Pré-corte prod** (memória do projeto): `cte_sequence.last_numero=577` (série 1), `mdfe_sequence.last_numero=288` (série 1) — confirmar no dia exato do corte.

---

## Ordem sugerida de execução

1. **6.1 timezone** (desbloqueia `autorizado` — sem isso nada autoriza)
2. **6.2 tomador derivado** + **1/2 `ie_indicator` selectors** (Cliente + Embarcador)
3. **7 backfill** `ie_indicator=9` em academias
4. **2 `emit_cte_via` selector** (migração por embarcador via UI)
5. **4 VehicleForm proprietário** (habilita MDF-e terceirizado)
6. **6.3 / 6.4** hardening emit-cte
7. **3 nfe_keys** (opcional)

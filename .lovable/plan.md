

# Plano: Corrigir Import de Tabelas de Preço com Deduplicação Automática

## ✅ IMPLEMENTADO

## Resumo do Problema
A Edge Function `import-price-table` atualmente **bloqueia** importações quando encontra faixas KM duplicadas (mesmo `km_from`/`km_to`), retornando erro 400. O comportamento desejado é **deduplicar automaticamente** usando estratégia "last-wins" (última ocorrência prevalece).

## Mudanças Realizadas

### 1. Edge Function (`supabase/functions/import-price-table/index.ts`)

- ✅ Adicionada função `deduplicateRows()` usando estratégia "last-wins"
- ✅ Removida validação bloqueante `detectDuplicateRanges()`
- ✅ Deduplicação aplicada ANTES da validação de sobreposições
- ✅ Validação de sobreposições (overlaps) mantida como erro 400
- ✅ Campo `duplicatesRemoved` adicionado a todas as respostas
- ✅ Deduplicação aplicada em AMBOS os modos (replace e upsert)

### 2. Hook (`src/hooks/useImportPriceTable.ts`)

- ✅ Interface `ImportPriceTableResult` atualizada com `duplicatesRemoved`

### 3. Modal (`src/components/pricing/PriceTableImportModal.tsx`)

- ✅ Toast de sucesso mostra quantas duplicatas foram removidas

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Arquivo com 49 linhas, 5 duplicatas | Erro 400 "Faixa duplicada..." | Sucesso: 44 inseridas, 5 duplicatas removidas |
| Arquivo com faixas sobrepostas (0-100, 80-150) | Erro 400 (correto) | Erro 400 (mantém comportamento) |
| Arquivo limpo sem duplicatas | Sucesso | Sucesso (sem mudança) |

## Próximos Passos (Opcionais)

- [ ] Adicionar campos `valid_from` e `valid_until` no modal de importação
- [ ] Adicionar seletor de coluna para mapear colunas específicas do Excel



# Plano: Corrigir Import de Tabelas de Preço com Deduplicação Automática

## Resumo do Problema
A Edge Function `import-price-table` atualmente **bloqueia** importações quando encontra faixas KM duplicadas (mesmo `km_from`/`km_to`), retornando erro 400. O comportamento desejado é **deduplicar automaticamente** usando estratégia "last-wins" (última ocorrência prevalece).

## Estado Atual do Código

### Edge Function (`supabase/functions/import-price-table/index.ts`)
- **Linhas 94-114**: `detectDuplicateRanges()` - detecta duplicatas e retorna erros
- **Linhas 117-164**: `detectOverlappingRanges()` - detecta sobreposições
- **Linhas 274-296**: Validação global que **bloqueia** se há duplicatas OU sobreposições
- **Linhas 472-484**: Deduplicação existe apenas no modo `upsert`, não no `replace`

### Problema Específico
```typescript
// Linha 283-295: Bloqueia se há duplicatas
if (duplicateCount > 0 || overlapCount > 0) {
  return new Response(JSON.stringify({ success: false, ... }), { status: 400 });
}
```

## Solução Proposta

### 1. Edge Function - Alterar Fluxo de Validação

**Arquivo**: `supabase/functions/import-price-table/index.ts`

**Mudanças**:

a) **Criar função `deduplicateRows()`** para deduplicar linhas (last-wins):
```typescript
function deduplicateRows(rows: PriceTableRowInput[]): { 
  uniqueRows: PriceTableRowInput[]; 
  duplicatesRemoved: number 
} {
  const map = new Map<string, PriceTableRowInput>();
  for (const row of rows) {
    const key = `${row.km_from}-${row.km_to}`;
    map.set(key, row); // última ocorrência prevalece
  }
  return {
    uniqueRows: Array.from(map.values()),
    duplicatesRemoved: rows.length - map.size
  };
}
```

b) **Alterar ordem de validação** (linhas 274-296):
- PRIMEIRO: Deduplicar automaticamente
- DEPOIS: Detectar sobreposições (nas linhas já deduplicadas)
- Remover a chamada a `detectDuplicateRanges()` (não bloqueia mais)
- Manter `detectOverlappingRanges()` como validação de erro

c) **Aplicar deduplicação em AMBOS os modos** (replace e upsert):
- Mover a lógica de deduplicação para antes das operações de banco
- Logar quantas duplicatas foram removidas para auditoria

**Novo fluxo**:
```text
1. Validação básica de campos
2. Deduplicação automática (last-wins) → log quantas removidas
3. Validação de sobreposições (nas linhas deduplicadas)
4. Se há sobreposições → erro 400
5. Se ok → prosseguir com replace ou upsert
```

### 2. Resposta de Sucesso Enriquecida

Adicionar campo `duplicatesRemoved` na resposta para transparência:

```typescript
interface ImportResponse {
  success: boolean;
  priceTableId?: string;
  rowsTotal: number;          // linhas originais do arquivo
  rowsInserted: number;
  rowsUpdated: number;
  duplicatesRemoved: number;  // NOVO: quantas duplicatas foram removidas
  errors: string[];
}
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/import-price-table/index.ts` | Adicionar `deduplicateRows()`, reordenar validações, aplicar deduplicação em ambos os modos |

## Detalhes Técnicos

### Código da Correção Principal

Substituir o bloco de validação global (linhas ~274-296) por:

```typescript
// DEDUPLICAÇÃO AUTOMÁTICA (last-wins)
const { uniqueRows, duplicatesRemoved } = deduplicateRows(rows);

if (duplicatesRemoved > 0) {
  console.log(`[import-price-table] Deduplicação: ${duplicatesRemoved} linhas duplicadas removidas (last-wins)`);
}

// VALIDAÇÃO DE SOBREPOSIÇÕES (após deduplicação)
const overlapErrors = detectOverlappingRanges(uniqueRows);

if (overlapErrors.length > 0) {
  console.error('[import-price-table] Faixas sobrepostas detectadas:', overlapErrors);
  return new Response(
    JSON.stringify({ 
      success: false, 
      rowsTotal: rows.length,
      duplicatesRemoved,
      rowsInserted: 0, 
      rowsUpdated: 0, 
      errors: overlapErrors
    }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Usar uniqueRows para as operações de banco
const rowsToProcess = uniqueRows;
```

### Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Arquivo com 49 linhas, 5 duplicatas | Erro 400 "Faixa duplicada..." | Sucesso: 44 inseridas, 5 duplicatas removidas |
| Arquivo com faixas sobrepostas (0-100, 80-150) | Erro 400 (correto) | Erro 400 (mantém comportamento) |
| Arquivo limpo sem duplicatas | Sucesso | Sucesso (sem mudança) |

## Critério de Aceite

1. Importar arquivo com faixas duplicadas (mesmo km_from/km_to) deve **funcionar**, usando a última ocorrência
2. Resposta de sucesso deve incluir `duplicatesRemoved: N`
3. Faixas **sobrepostas** (diferentes mas se cruzam) continuam gerando erro 400
4. Logs mostram claramente quantas duplicatas foram removidas

## Estimativa

- 1 arquivo modificado
- ~30 linhas de código alteradas/adicionadas
- Tempo: ~10 minutos de implementação + deploy


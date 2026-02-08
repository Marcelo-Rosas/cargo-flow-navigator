
# Plano: Alterações no Board Operacional - UI Stage-Gated

## Resumo Executivo
Implementar uma interface guiada por estágios no modal de detalhes da OS, onde componentes e documentos são exibidos condicionalmente conforme o estágio da ordem.

---

## 1. Mudanças no Banco de Dados

### Novas colunas na tabela `orders`:
A tabela precisa de novas flags para documentos específicos:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `has_crlv` | boolean | CRLV do veículo |
| `has_cnh` | boolean | CNH do motorista |
| `has_comp_residencia` | boolean | Comprovante de residência |
| `has_antt` | boolean | Registro ANTT |
| `has_mdf` | boolean | MDF-e (Manifesto) |
| `has_gr` | boolean | GR (Guia de Recolhimento) |

---

## 2. Lógica de Visibilidade por Estágio

### Mapa de Visibilidade:

```text
+-------------------+------------------+------------------+------------------+
| Estágio           | Driver Section   | Driver Docs      | Fiscal Docs      |
+-------------------+------------------+------------------+------------------+
| ordem_criada      |        -         |        -         |        -         |
| busca_motorista   |   DROPDOWN       | CRLV,CNH,CR,ANTT |        -         |
| documentacao      |   VISUALIZAR     | CRLV,CNH,CR,ANTT | NFe,CTe,MDF,GR   |
| coleta_realizada  |   VISUALIZAR     | CRLV,CNH,CR,ANTT | NFe,CTe,MDF,GR   |
| em_transito       |   VISUALIZAR     | CRLV,CNH,CR,ANTT | NFe,CTe,MDF,GR   |
| entregue          |   VISUALIZAR     | CRLV,CNH,CR,ANTT | NFe,CTe,MDF,GR+POD|
+-------------------+------------------+------------------+------------------+
```

### Tab "Documentos":
- Visivel apenas no estágio `documentacao`

### Rota (Origem/Destino):
- Visivel em **todos** os estágios

---

## 3. Novos Hooks

### `useDrivers.ts`
```typescript
// Lista motoristas ativos para dropdown
// Retorna: { id, name, phone }
```

### `useVehicles.ts`
```typescript
// Lista veículos ativos (opcionalmente filtrados por driver_id)
// Retorna: { id, plate, driver_id }
```

---

## 4. Alterações nos Componentes

### `OrderDetailModal.tsx`
1. **Importar hooks** `useDrivers` e `useVehicles`
2. **Tab Documentos**: Condicionar visibilidade ao estágio `documentacao`
3. **Seção Driver**: 
   - A partir de `busca_motorista`: Mostrar dropdowns para motorista/veículo
   - Ao selecionar motorista, auto-preencher `driver_name`, `driver_phone`
   - Ao selecionar veículo, auto-preencher `vehicle_plate`
4. **Status dos Documentos**:
   - `busca_motorista`: CRLV, CNH, Comp.Res., ANTT
   - `documentacao+`: NFe, CTe, MDF-e, GR
   - `entregue`: POD

### `OrderForm.tsx`
- Trocar inputs de texto por **dropdowns** para motorista e veículo
- Usar hooks para popular opções
- Ao salvar, gravar tanto IDs quanto campos legados (snapshot)

---

## 5. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useDrivers.ts` | CRIAR - hook para listar motoristas |
| `src/hooks/useVehicles.ts` | CRIAR - hook para listar veículos |
| `src/components/modals/OrderDetailModal.tsx` | MODIFICAR - lógica stage-gated |
| `src/components/forms/OrderForm.tsx` | MODIFICAR - dropdowns motorista/veículo |

---

## 6. Migração SQL

```sql
-- Adicionar colunas de documentos do motorista
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_crlv boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_cnh boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_comp_residencia boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_antt boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_mdf boolean DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS has_gr boolean DEFAULT false;
```

---

## 7. Seção Técnica

### Constantes de Estágios para Lógica Condicional

```typescript
const STAGES_WITH_DRIVER = ['busca_motorista', 'documentacao', 'coleta_realizada', 'em_transito', 'entregue'];
const STAGES_WITH_FISCAL_DOCS = ['documentacao', 'coleta_realizada', 'em_transito', 'entregue'];
const STAGE_WITH_POD = 'entregue';
const STAGE_WITH_DOCS_TAB = 'documentacao';
```

### Mapeamento de Documentos por Categoria

```typescript
// Documentos do Motorista (visíveis a partir de busca_motorista)
const DRIVER_DOCS = [
  { key: 'has_crlv', label: 'CRLV' },
  { key: 'has_cnh', label: 'CNH' },
  { key: 'has_comp_residencia', label: 'Comp.Res.' },
  { key: 'has_antt', label: 'ANTT' },
];

// Documentos Fiscais (visíveis a partir de documentacao)
const FISCAL_DOCS = [
  { key: 'has_nfe', label: 'NF-e' },
  { key: 'has_cte', label: 'CT-e' },
  { key: 'has_mdf', label: 'MDF-e' },
  { key: 'has_gr', label: 'GR' },
];

// POD (visível apenas em entregue)
const POD_DOC = { key: 'has_pod', label: 'POD' };
```

### Pattern de Snapshot para Dados Legados
Ao selecionar motorista/veículo via dropdown, o sistema deve:
1. Salvar `driver_id` (FK) para relacionamento
2. Salvar `driver_name`, `driver_phone`, `vehicle_plate` como snapshot textual para histórico

---

## 8. Critérios de Aceite

- [ ] Tab "Documentos" visível apenas em estágio `documentacao`
- [ ] Seção Origem/Destino visível em todos os estágios
- [ ] Seção Motorista aparece a partir de `busca_motorista` com dropdowns
- [ ] Dropdown de motorista popula automaticamente nome e telefone
- [ ] Dropdown de veículo popula automaticamente a placa
- [ ] Docs do motorista (CRLV, CNH, etc.) visíveis a partir de `busca_motorista`
- [ ] Docs fiscais (NFe, CTe, MDF, GR) visíveis a partir de `documentacao`
- [ ] POD visível apenas em `entregue`
- [ ] Dados persistem corretamente ao salvar

---

## Próximos Passos
1. Aprovar o plano para iniciar implementação
2. Executar migração SQL para adicionar novas colunas
3. Criar hooks `useDrivers` e `useVehicles`
4. Implementar lógica stage-gated no modal

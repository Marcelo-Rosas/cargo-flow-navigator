# NTC Lotação (Dez/25) — Import para `price_table_rows`

Este projeto decidiu que **Lotação será sempre NTC Lotação Dez/25**.

A planilha NTC diz que os valores **não contemplam** impostos, pedágio, margem e mão de obra carga/descarga.
O app soma esses itens **fora** do custo NTC (Edge Function `calculate-freight` já foi refatorada para isso).

## Arquivos (template e CSV completo)

### CSV completo (pronto para importar)
- `data/ntc/ntc_lotacao_dez25_price_table_rows.csv`

Este CSV já vem preenchido a partir do print NTC Dez/25 com:
- `price_table_id` fixo: `32625379-4b1d-4b88-8411-3083bdf75337`
- todas as faixas `km_from/km_to` até 6000 km
- `cost_per_ton` (R$/t): **maior valor** entre Truck e Carreta 3 eixos (na prática, Truck no print)
- `cost_value_percent` (%): **Frete Valor** (coluna “Custo Valor (%)”)
- `gris_percent` (%): GRIS
- `tso_percent` (%): TSO

### Template (vazio, para ajustes manuais)
- `data/ntc/ntc_lotacao_dez25_price_table_rows_TEMPLATE.csv`

Use o template se quiser revisar/editar valores manualmente antes de importar.

### Formato dos números
- Sempre usar **ponto** como separador decimal (ex.: `469.02`, `0.30`).
- `km_from/km_to` são inteiros.

## Passos de import no Supabase
1) (Recomendado) apagar linhas antigas da tabela antes de importar:

```sql
delete from public.price_table_rows
where price_table_id = '32625379-4b1d-4b88-8411-3083bdf75337';
```

2) Importar o CSV no Table Editor (public.price_table_rows).

3) Validar rapidamente:

```sql
select km_from, km_to, cost_per_ton, cost_value_percent, gris_percent, tso_percent
from public.price_table_rows
where price_table_id = '32625379-4b1d-4b88-8411-3083bdf75337'
order by km_from asc
limit 20;
```

## Observações
- Se `cost_value_percent` ficar NULL, o sistema vai calcular **frete valor = 0**.
- Se `tso_percent` ficar errado (ex.: 0.30 em todas as linhas), o seguro obrigatório ficará superestimado.

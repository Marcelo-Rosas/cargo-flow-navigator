# Template de Matriz Competitiva — Cargo Flow Navigator

> Use este template como ponto de partida para análises competitivas.
> Preencha as colunas dos concorrentes com base em pesquisa real (demos, avaliações, entrevistas com clientes).
> Atualize regularmente — comparações ficam desatualizadas rapidamente.

---

## Matriz de Funcionalidades: TMS/CRM Logístico Brasileiro

| Área de Capacidade | Cargo Flow Navigator | [Concorrente A] | [Concorrente B] | [Concorrente C] |
|:---|:---:|:---:|:---:|:---:|
| **1. GESTÃO COMERCIAL** | | | | |
| Cotação multi-modalidade (lotação + LTL) | Forte | ? | ? | ? |
| Motor de precificação (GRIS, TSO, TAC, NTC, pedágio) | Forte | ? | ? | ? |
| Piso mínimo ANTT integrado | Forte | ? | ? | ? |
| CRM de clientes e embarcadores | Forte | ? | ? | ? |
| Envio de proposta por e-mail | Forte | ? | ? | ? |
| Rastreamento de abertura de proposta | Adequado | ? | ? | ? |
| **2. GESTÃO OPERACIONAL** | | | | |
| Ordens de Serviço (OS) com ciclo de vida completo | Forte | ? | ? | ? |
| Gestão de viagens (vinculação OS ↔ viagem) | Forte | ? | ? | ? |
| Rateio de custos por viagem (múltiplas chaves) | Forte | ? | ? | ? |
| Gestão de frota e veículos | Adequado | ? | ? | ? |
| Cadastro e gestão de motoristas | Adequado | ? | ? | ? |
| Checklist de descarga configurável | Adequado | ? | ? | ? |
| **3. COMPLIANCE E REGULATÓRIO** | | | | |
| Qualificação de motoristas (CNH, ANTT, Buonny) | Forte | ? | ? | ? |
| Verificação de compliance por OS | Forte | ? | ? | ? |
| Monitoramento de atualizações regulatórias | Forte | ? | ? | ? |
| Auditoria e rastreabilidade completa | Forte | ? | ? | ? |
| **4. FINANCEIRO E FISCAL** | | | | |
| Geração de documentos financeiros (CTe, NF, PAG, FAT) | Forte | ? | ? | ? |
| Reconciliação de pagamentos (OS, viagem, cotação) | Forte | ? | ? | ? |
| Fluxo de caixa com visão por período | Forte | ? | ? | ? |
| Análise de divergência cotação vs OS | Forte | ? | ? | ? |
| Margem por viagem e por OS | Forte | ? | ? | ? |
| Aprovação de pagamentos com regras configuráveis | Forte | ? | ? | ? |
| **5. INTELIGÊNCIA ARTIFICIAL** | | | | |
| IA em precificação e rentabilidade de cotações | Forte | ? | ? | ? |
| IA em compliance e qualificação de motoristas | Forte | ? | ? | ? |
| IA em análise financeira e detecção de anomalias | Forte | ? | ? | ? |
| IA em relatórios operacionais | Forte | ? | ? | ? |
| Orquestração multi-agente | Forte | ? | ? | ? |
| Monitoramento regulatório com IA | Forte | ? | ? | ? |
| **6. INTEGRAÇÕES E ECOSSISTEMA** | | | | |
| Integração com API Buonny (consulta de motoristas) | Forte | ? | ? | ? |
| Cálculo de distância e pedágio automatizado | Forte | ? | ? | ? |
| Notificações (e-mail, WhatsApp) | Adequado | ? | ? | ? |
| Importação de tabelas de preço | Forte | ? | ? | ? |
| API aberta para parceiros | Fraco | ? | ? | ? |

---

## Escala de Referência

| Avaliação | Descrição |
|:---|:---|
| **Forte** | Capacidade líder de mercado. Funcionalidade profunda, bem executada. |
| **Adequado** | Funcional. Cumpre o objetivo mas sem diferenciação. |
| **Fraco** | Existe mas com limitações significativas ou execução ruim. |
| **Ausente** | Não possui esta capacidade. |
| **?** | Não avaliado ainda — requer pesquisa. |

---

## Mapa de Posicionamento

```
                    SUITE INTEGRADA
                    (comercial + operacional + financeiro)
                           ↑
                           |
          [Cargo Flow Navigator]
          (suite vertical, IA nativa)
                           |
TRANSPORTADORA  ←----------+----------→  EMBARCADOR
PEQUENA                    |              GRANDE
                           |
          [ERP genérico com módulo TMS]
          (suite horizontal, sem IA)
                           |
                           ↓
                    PONTO DE SOLUÇÃO
                    (só cotação ou só TMS)
```

---

## Análise de Posicionamento por Concorrente

### Template para cada concorrente

**Empresa**: [Nome]
**URL**: [website]
**Última atualização**: [data]

**Posicionamento declarado**:
> [Copie o headline + subtítulo da homepage aqui]

**Para quem**: [segmento-alvo declarado]
**Categoria reivindicada**: [TMS / CRM logístico / plataforma de frete / ERP de transporte]
**Diferenciador declarado**: [o que dizem que os diferencia]
**Resultado prometido**: [que outcome prometem ao cliente]
**Provas apresentadas**: [logos de clientes, métricas, prêmios]

**Avaliação crítica**:
- O que entregam de fato vs o que prometem:
- Onde são genuinamente fortes:
- Onde são vulneráveis:
- Posição que reivindicam mas não conseguem sustentar:

---

## Análise de Win/Loss

### Como rastrear no banco de dados

```sql
-- Adicionar tags de win/loss nas cotações
-- UPDATE quotes SET tags = array_append(tags, 'lost-to-totvs') WHERE id = '...';
-- UPDATE quotes SET tags = array_append(tags, 'won-vs-omie') WHERE id = '...';

-- Consultar taxa de conversão por concorrente
SELECT 
  unnest(tags) as tag,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE stage = 'ganho') as wins,
  COUNT(*) FILTER (WHERE stage = 'perdido') as losses
FROM quotes
WHERE tags && ARRAY['lost-to-totvs', 'lost-to-omie', 'won-vs-totvs', 'won-vs-omie']
GROUP BY tag
ORDER BY count DESC;
```

### Registro de Win/Loss

| Data | Concorrente | Resultado | Motivo Principal | Segmento | Valor |
|:---|:---|:---:|:---|:---|:---|
| [data] | [nome] | Vitória/Perda | [motivo] | [segmento] | [R$] |

### Padrões Identificados

**Principais motivos de vitória:**
1.
2.
3.

**Principais motivos de perda:**
1.
2.
3.

**Taxa de vitória por concorrente:**
| Concorrente | Negócios Envolvidos | Vitórias | Taxa |
|:---|:---:|:---:|:---:|
| | | | |

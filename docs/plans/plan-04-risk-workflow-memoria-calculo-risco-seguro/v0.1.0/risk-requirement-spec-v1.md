---
document: Risk Requirement Spec v1
plan: plan-04-risk-workflow-memoria-calculo-risco-seguro
version: v0.1.0
created_at: 2026-03-07
source_documents:
  - "END 4011848 APOL 1005500008136 RC-DC (INCLUS. GER BUONNY)"
  - "NTC Dec/25 — Tabela de Custos Referenciais"
---

# Risk Requirement Spec v1

## 1. Fontes de verdade

| Fonte | O que fornece | Onde fica |
|-------|--------------|-----------|
| Apolice RC-DC + Endosso | Coberturas, limites, exclusoes, exigencias GR | `risk_policies` (DB) + PDF em `/docs/Apolices Seguro/` |
| Buonny (GR) | Status motorista/veiculo, monitoramento | Edge `buonny-check` (API SOAP) |
| Dados da OS | `cargo_value`, rota, km, destino, motorista, veiculo | `orders` table |
| Dados da Trip/VG | Soma `cargo_value` por OS, lista de OS | `trip_orders` + `orders` |
| Webrouter | Municipios da rota, pedagios, distancia | `calculate-distance-webrouter` + `meta.tollPlazas` |
| Documentos | GR, rota, CNH, CRLV, etc. | `documents` table |

---

## 2. Niveis de criticidade

### 2.1 Definicao

| Nivel | Codigo | Cor UI | Descricao |
|-------|--------|--------|-----------|
| Baixo | `LOW` | verde | Operacao padrao; consulta Buonny obrigatoria |
| Medio | `MEDIUM` | amarelo | Exige cadastro Buonny + documentacao completa |
| Alto | `HIGH` | vermelho | Exige monitoramento Buonny + aprovacao gerencial |
| Critico | `CRITICAL` | vermelho escuro | Exige monitoramento + escolta ou restricao de rota |

### 2.2 Matriz de criticidade (gatilhos)

A criticidade e o **maximo** entre os gatilhos individuais:

```
criticidade = MAX(
  criticidade_por_valor,
  criticidade_por_rota,
  criticidade_por_vg,
  criticidade_por_historico
)
```

#### 2.2.1 Por valor de carga (`cargo_value`)

| Faixa (R$) | Criticidade OS | Criticidade VG (soma) |
|-----------|----------------|----------------------|
| 0 — 50.000 | LOW | LOW |
| 50.001 — 150.000 | MEDIUM | MEDIUM |
| 150.001 — 500.000 | HIGH | HIGH |
| > 500.000 | CRITICAL | CRITICAL |

> Faixas configuradas em `risk_policy_rules.trigger_type = 'cargo_value'`.
> Valores iniciais baseados em praticas de mercado RC-DC. Ajustaveis por apolice.

#### 2.2.2 Por rota (heuristica)

| Condicao | Criticidade adicional |
|----------|----------------------|
| Rota interestadual (UFs diferentes) | +0 (padrao) |
| Rota passa por municipios de risco (lista configuravel) | +1 nivel |
| Distancia > 1.000 km | +1 nivel (max HIGH) |
| Pernoite provavel (km > 800 ou estimativa > 10h) | +1 nivel |

> Municipios de risco: lista inicial vazia; populada via `risk_policy_rules.trigger_type = 'municipality'`.
> Heuristica de municipios: extraida dos `tollPlazas[].cidade` do Webrouter.

#### 2.2.3 Por VG (trip)

| Condicao | Efeito |
|----------|--------|
| Trip com > 1 OS | Soma `cargo_value` de todas as OS para avaliar faixa |
| Qualquer OS da trip e HIGH/CRITICAL | Trip inteira e HIGH/CRITICAL |
| Trip com > 3 OS | +1 nivel por complexidade operacional |

#### 2.2.4 Por historico (futuro — Fase 2+)

| Condicao | Efeito |
|----------|--------|
| Motorista com ocorrencias nos ultimos 12 meses | +1 nivel |
| Motorista sem historico no sistema | MEDIUM minimo |
| Veiculo com idade > 15 anos | +1 nivel |

> Depende de dados de ocorrencias e idade veiculo nao disponiveis na v1.

---

## 3. Exigencias por criticidade

### 3.1 Tabela de exigencias

| Exigencia | LOW | MEDIUM | HIGH | CRITICAL |
|-----------|-----|--------|------|----------|
| Consulta Buonny (motorista + veiculo) | Obrigatoria | Obrigatoria | Obrigatoria | Obrigatoria |
| Cadastro Buonny (se nao cadastrado) | -- | Obrigatorio | Obrigatorio | Obrigatorio |
| Monitoramento Buonny (rastreamento) | -- | -- | Obrigatorio | Obrigatorio |
| GR (Analise de Gerenciamento de Risco) | -- | Recomendado | Obrigatorio | Obrigatorio |
| Rota documentada (Webrouter/manual) | -- | Recomendada | Obrigatoria | Obrigatoria |
| CNH + CRLV motorista | Obrigatoria | Obrigatoria | Obrigatoria | Obrigatoria |
| Aprovacao gerencial (risk_gate) | Automatica | Automatica | Manual obrigatoria | Manual obrigatoria |
| Escolta / restricao horaria | -- | -- | -- | Conforme apolice |

### 3.2 Servicos Buonny e custos

| Servico | Codigo | Custo unitario | Obrigatorio quando | Scope |
|---------|--------|---------------|-------------------|-------|
| Consulta Profissional | `BUONNY_CONSULTA` | R$ 13,76 | Sempre | Por OS (ou por trip se consolidado) |
| Cadastro | `BUONNY_CADASTRO` | R$ 42,10 | Motorista nao cadastrado | Por motorista |
| Monitoramento | `BUONNY_MONITORAMENTO` | R$ 252,78 | Criticidade >= HIGH | Por trip/viagem |

> Custos atualizados conforme tabela Buonny vigente. Parametrizaveis em `risk_services_catalog`.

### 3.3 Validade

| Item | Validade | Revalidacao |
|------|----------|-------------|
| Consulta Buonny (resultado) | 90 dias | Nova consulta via `buonny-check` |
| Cadastro Buonny | Permanente (verificado na consulta) | -- |
| Monitoramento Buonny | Por viagem (ativo ate entrega) | -- |
| Documentos (CNH, CRLV) | Ate vencimento do documento | Upload novo |

---

## 4. Fluxo de avaliacao de risco

### 4.1 Trigger automatico

```
WHEN order.stage transitions TO 'documentacao'
  CREATE risk_evaluation (status = 'pending', entity_type = 'order')
  IF order.trip_id IS NOT NULL
    UPSERT risk_evaluation (entity_type = 'trip', entity_id = trip_id)
```

### 4.2 Calculo de criticidade

```python
# Pseudocodigo
def evaluate_risk(order, trip=None):
    # 1. Valor da carga
    cargo_val = order.cargo_value or sum(os.cargo_value for os in trip.orders) if trip else 0
    crit_valor = lookup_policy_rule('cargo_value', cargo_val)

    # 2. Rota
    toll_plazas = order.pricing_breakdown.meta.tollPlazas or []
    municipios = [p.cidade for p in toll_plazas]
    crit_rota = check_municipality_risk(municipios)
    if order.km_distance > 1000:
        crit_rota = min(crit_rota + 1, CRITICAL)

    # 3. VG
    crit_vg = LOW
    if trip:
        soma_cargo = sum(os.cargo_value for os in trip.orders)
        crit_vg = lookup_policy_rule('cargo_value', soma_cargo)
        if len(trip.orders) > 3:
            crit_vg = min(crit_vg + 1, CRITICAL)

    # 4. Resultado
    criticidade = max(crit_valor, crit_rota, crit_vg)
    exigencias = get_requirements(criticidade)

    return RiskEvaluation(
        criticality=criticidade,
        requirements=exigencias,
        cargo_value_evaluated=cargo_val,
        route_municipalities=municipios,
        policy_rules_applied=[...],
    )
```

### 4.3 Verificacao Buonny

```
WHEN user clicks "Consultar Buonny" in Wizard step 1:
  CALL edge function buonny-check {
    driver_cpf: order.driver_cnh,  // ou CPF do motorista
    vehicle_plate: order.vehicle_plate,
  }

  RESPONSE:
    status: 'aprovado' | 'reprovado' | 'em_analise' | 'nao_cadastrado'
    consulta_id: string
    validade: ISO date (now + 90 days)
    cadastro_existente: boolean
    monitoramento_ativo: boolean
    detalhes: { ... }

  SAVE to risk_evidence {
    evaluation_id: current_evaluation.id,
    evidence_type: 'buonny_check',
    payload: response,
    expires_at: response.validade,
  }
```

### 4.4 Decisao de gate

```
WHEN user clicks "Enviar para Aprovacao":
  VALIDATE:
    - Todas as exigencias obrigatorias atendidas?
    - Buonny consulta valida (< 90 dias)?
    - Documentos obrigatorios uploaded?

  IF criticidade <= MEDIUM AND all requirements met:
    AUTO-APPROVE (approval_request.status = 'approved', decided_by = 'system')
  ELSE:
    CREATE approval_request {
      entity_type: 'order',
      entity_id: order.id,
      approval_type: 'risk_gate',
      assigned_to_role: 'admin',
      title: "Aprovacao de Risco — OS #{order.os_number}",
      description: risk_evaluation_summary,
      ai_analysis: { risk: criticidade, ... },
    }
```

---

## 5. Regras especificas da apolice RC-DC

### 5.1 Cobertura

| Item | Detalhes |
|------|---------|
| Tipo | RC-DC (Responsabilidade Civil - Danos Corporais) |
| Apolice | 1005500008136 |
| Endosso | 4011848 |
| Gerenciadora | Buonny (inclusa no endosso) |
| Cobertura principal | Danos corporais a terceiros durante transporte |

### 5.2 Obrigacoes do segurado (transportador)

1. **Gerenciamento de risco via Buonny** e condicao da cobertura
2. Consulta obrigatoria antes de cada embarque
3. Monitoramento ativo para cargas acima do limite da apolice
4. Comunicacao imediata de sinistros
5. Documentacao completa (CTe, NFe, MDFE)

### 5.3 Regras operacionais derivadas

| Regra | Implementacao |
|-------|--------------|
| Sem consulta Buonny valida = sem cobertura | Gate bloqueia transicao |
| Monitoramento obrigatorio acima de threshold | Criticidade HIGH/CRITICAL exige |
| Motorista reprovado = nao pode embarcar | Buonny status 'reprovado' → gate bloqueado |
| Motorista em analise = aguardar | Buonny status 'em_analise' → wizard mostra "Aguardando" |

---

## 6. Custos de risco vs repasse

### 6.1 O que e repasse (receita)

| Componente | Formula | Quem paga | Destino |
|-----------|---------|-----------|---------|
| GRIS | `cargo_value * gris_percent` | Cliente | Seguradora (via apólice) |
| TSO | `cargo_value * tso_percent` | Cliente | Seguradora |
| RCTR-C (frete_valor) | `cargo_value * cost_value_percent` | Cliente | Seguradora |

> Esses valores sao **repassados**. O transportador nao absorve esse custo.
> Na DRE v5: aparecem como "Receita de Repasse de Risco" (linha positiva).

### 6.2 O que e custo real (despesa)

| Componente | Valor | Quem paga | Quando |
|-----------|-------|-----------|--------|
| Buonny Consulta | R$ 13,76 | Transportador | Sempre (obrigatorio) |
| Buonny Cadastro | R$ 42,10 | Transportador | Motorista novo |
| Buonny Monitoramento | R$ 252,78 | Transportador | HIGH/CRITICAL |
| Seguro efetivo (premio) | % parametrizavel | Transportador | Futuro (apolice) |

> Esses valores sao **custos reais** do transportador.
> Na DRE v5: aparecem como "Custos Reais de Risco" (linha negativa).

### 6.3 Diferenca financeira

```
v4: resultado = receita_liquida - overhead - ntc_base - descarga
    onde ntc_base inclui GRIS+TSO+RCTR-C (deduz erroneamente)

v5: resultado = receita_liquida - overhead - custos_diretos - custos_risco_real
    onde custos_diretos = frete_peso + pedagio + descarga + aluguel
    e custos_risco_real = buonny + seguro_efetivo
    (GRIS+TSO+RCTR-C NAO deduzem — sao receita de repasse)
```

---

## 7. VG-level evaluation (detalhado)

### 7.1 Quando avaliar

| Evento | Acao |
|--------|------|
| OS adicionada a trip | Reavaliar risk_evaluation da trip |
| OS removida da trip | Reavaliar risk_evaluation da trip |
| OS muda cargo_value | Reavaliar risk_evaluation da OS e da trip |
| Trip criada | Criar risk_evaluation da trip |

### 7.2 Gate VG

```
Para cada OS na trip:
  OS deve ter risk_evaluation.status = 'approved'

Para a trip:
  trip.risk_evaluation.status = 'approved'
  (avaliacao consolidada considerando soma de cargo_value)

Transicao de qualquer OS da trip para coleta_realizada:
  IF NOT all_os_approved AND NOT trip_approved:
    BLOCK transition
    SHOW: "Aguarde aprovacao de risco da viagem #{trip.trip_number}"
```

### 7.3 Custos VG

- Buonny Consulta: cobrada **1x por trip** (nao por OS)
- Buonny Monitoramento: cobrado **1x por trip**
- Rateio: via `trip_cost_items` com `apportion_key` da `trip_orders`

---

## 8. Mapa de regras configuráveis

Todas as regras sao parametrizaveis em `risk_policy_rules`:

| Regra | trigger_type | Exemplo |
|-------|-------------|---------|
| Faixa de valor | `cargo_value` | `{ min: 0, max: 50000, criticality: 'LOW' }` |
| Municipio de risco | `municipality` | `{ cities: ['Guarulhos', 'Dutra km 200'], criticality_boost: 1 }` |
| Distancia | `km_distance` | `{ min: 1000, criticality_boost: 1 }` |
| Qtd OS na trip | `trip_order_count` | `{ min: 4, criticality_boost: 1 }` |
| Tipo de carga | `cargo_type` | `{ types: ['perigosa', 'farmaceutica'], criticality: 'HIGH' }` |

---

## 9. Lacunas e itens futuros (fora do v1)

| Item | Motivo | Quando |
|------|--------|--------|
| Integracao SOAP real Buonny | Depende de credenciais + homologacao | Fase 1.4 stub; real pos-homologacao |
| Historico de motorista | Dados de ocorrencias nao modelados ainda | Fase 2+ |
| Seguro efetivo (premio %) | Valor real depende de negociacao com seguradora | Parametrizavel; campo reservado |
| Escolta / restricao horaria | Operacao rara; regra manual por enquanto | CRITICAL → nota manual |
| CIOT / vale-pedagio | Compliance separado (lei, nao apolice) | Plan futuro |
| Municipios de risco automaticos | Depende de base externa (SSP/ANTT) | Feed futuro |

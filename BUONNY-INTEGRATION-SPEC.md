# 🛡️ BUONNY INTEGRATION SPECIFICATION - CARGO FLOW NAVIGATOR

**Status:** Sprint 2 em andamento — Nstech Cadastro REST desbloqueado
**Target:** Sprint 2 (Maio 2026) + Sprint 3 (Junho 2026)
**Owner:** Equipe de Desenvolvimento Vectra Cargo
**Last Updated:** 2026-05-01 (Nstech Cadastro API mapeada via bundle JS + navegação portal)
**Source docs:** `API-Consulta-Profissional.pdf`, `WS-SOAP-2-6-1.pdf`, `API-AXA.pdf`,
`Criacao-de-um-Endpoint-para-o-Retorno-de-Ficha-3.pdf`,
`Callback-consulta-do-retorno-da-ficha-4-1.pdf`,
`API-Consulta-de-Veiculo-Por-Entrega.pdf`, `viv.pdf`

---

## 1. VISÃO GERAL

### Objetivo

Integrar **Buonny** (gerenciadora de risco) e **Nstech/Integrador AXA** no fluxo do
Cargo Flow Navigator para:

- ✅ Validar compliance do motorista + veículo via SOAP (`consultaProfissional`)
- ✅ Sugerir coberturas de seguro adicionais com base no risk score
- ✅ Receber callbacks assíncronos da Buonny quando a análise de ficha terminar
- ✅ Consultar posição do veículo em tempo real (`status_entrega`)
- ✅ Criar Solicitações de Monitoramento (SM) no Integrador (SOAP Buonny)
- ✅ Criar viagens no Integrador Nstech/AXA (REST JSON)

### Separação arquitetural (importante)

```
Apólices Obrigatórias (RCTR-C / RC-DC)
  └── Fonte: tabela risk_policies (Berkley Brasil Seguros)
  └── Fluxo: regulatório, sem Buonny

Cobertura Adicional (opcional — InsuranceStep seção 2)
  └── Fonte: buonny-check-worker → consultaProfissional SOAP
  └── Fluxo: risk_score → BASIC / STANDARD / PLUS

Monitoramento Operacional (pós-OS, pós-CT-e)
  └── Fonte: SM SOAP → Buonny portal
  └── Fonte: AXA REST → Nstech Integrador
```

---

## 2. MAPA DE APIS (7 contratos)

| # | API | Protocolo | WSDL/Endpoint Homolog | Quando usar |
|---|---|---|---|---|
| 1 | `consultaProfissional` | SOAP | `tstportal.buonny.com.br/portal/wsdl/consulta_profissional.wsdl` | Antes da viagem: valida motorista + veículo |
| 2 | Webhook retorno ficha | HTTP POST JSON | (Buonny chama **seu** endpoint) | Buonny notifica quando análise termina |
| 3 | Polling retorno ficha | REST GET | `tstapi.buonny.com.br/api/v3/fichas/retorno_cliente/consulta/{id}` | Fallback se webhook não disparar |
| 4 | SM — Solicitação de Monitoramento | SOAP | `tstportal.buonny.com.br/portal/wsdl/buonny.wsdl` | Criar/alterar/cancelar acompanhamento da viagem |
| 5 | Consulta Veículo por Entrega | SOAP | `tstportal.buonny.com.br/portal/wsdl/status_entrega.wsdl` | Posição em tempo real do caminhão por NF/alvo |
| 6 | AXA — Criar Viagem | REST JSON | `10.19.0.45:8580/api/Viagem/IntegrarViagem` ⚠️ IP interno | Registrar viagem no Integrador Nstech |
| 7 | SM via CSV (ViV) | CSV `;` | Upload portal Buonny | Batch de SMs — alternativa ao SOAP |
| 8 | Opentech SOAP (tabelas de código) | SOAP | `webservicesrastrear.buonny.com.br/sgrOpentechBuonny/sgropentech.asmx` | Setup: buscar carga_tipo, produtos do cliente |

> ⚠️ **AXA endpoint é IP privado Nstech** (10.19.0.45:8580). Solicitar URL pública antes do Sprint 3.

### Endpoints completos

| API | Homologação | Produção |
|---|---|---|
| consultaProfissional WSDL | `https://tstportal.buonny.com.br/portal/wsdl/consulta_profissional.wsdl` | `https://api.buonny.com.br/portal/wsdl/consulta_profissional.wsdl` |
| SM WSDL | `https://tstportal.buonny.com.br/portal/wsdl/buonny.wsdl` | `https://api.buonny.com.br/portal/wsdl/buonny.wsdl` |
| Status Entrega WSDL | `https://tstportal.buonny.com.br/portal/wsdl/status_entrega.wsdl` | `https://api.buonny.com.br/portal/wsdl/status_entrega.wsdl` |
| Auth REST (polling) | `https://tstapi.buonny.com.br/api/v3/auth/login` | `https://api.buonny.com.br/api/v3/auth/login` |
| Polling Ficha REST | `https://tstapi.buonny.com.br/api/v3/fichas/retorno_cliente/consulta/{id}` | `https://api.buonny.com.br/api/v3/fichas/retorno_cliente/consulta/{id}` |
| AXA REST | `https://10.19.0.45:8580/api/Viagem/IntegrarViagem` (interno) | **Solicitar à Nstech** |
| Registrar webhook | Portal: `https://portal.buonny.com.br/portal/FichaRetornoEndpoint` | — |
| Opentech SOAP | `http://webservicesrastrear.buonny.com.br/sgrOpentechBuonny/sgropentech.asmx` | mesmo |

---

## 3. FLUXO DE INTEGRAÇÃO

```
──────────── FASE 1: COTAÇÃO ───────────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────┐
│ Cotação (QuoteForm — step Seguro)                                   │
│ - Seção 1: Apólices obrigatórias (risk_policies — Berkley RCTR-C/RC-DC)│
│ - Seção 2: Cobertura adicional Buonny                               │
│   ↳ buonny-check-worker calcula prêmio BASIC/STANDARD/PLUS          │
│     com base APENAS em: cargo_value, cargo_type, origin UF, dest UF │
│     → SEM CPF motorista / SEM placa (não disponíveis na cotação)    │
│     → NÃO chama consultaProfissional nesta fase                     │
└──────────────────────────────────────────────────────────────────────┘
               │ Cliente seleciona plano → cotação aprovada → OS criada
               ↓
──────────── FASE 2: OS / ATRIBUIÇÃO DE MOTORISTA ──────────────────────
┌──────────────────────────────────────────────────────────────────────┐
│ [buonny-check-worker] — chamado ao atribuir motorista+veículo à OS  │
│ ├─ SOAP consultaProfissional                                         │
│ ├─ Input: CPF motorista, placa do cavalo,                            │
│ │   cdprod=382, carga_valor, UF origem/destino                       │
│ ├─ Output: status, risk_score, n° liberação                          │
│ └─ Persiste em risk_evidence (vinculado ao order_id)                 │
└──────────┬───────────────────────────────────────────────────────────┘
               │ status = EM ANÁLISE?
               ↓
    ┌──────────────────────────────────┐
    │ [buonny-callback-handler]         │
    │ POST JSON recebido da Buonny      │
    │ {codigo_referencia, status_pesquisa,│
    │  pesquisa, parametros_insuficientes}│
    │ OU polling REST se webhook falhar │
    └──────────┬───────────────────────┘
               │ PERFIL ADEQUADO
               ↓
──────────── FASE 3: EXECUÇÃO / MONITORAMENTO ───────────────────────────
               │ OS confirmada → embarque
               ↓
    ┌──────────────────────────────────────────┐
    │ [buonny-create-sm] (Sprint 3)            │
    │ SOAP SM — operacao_sm = "I"              │
    │ Salva numero_sm em order_trips           │
    └──────────┬───────────────────────────────┘
               │ paralelo
               ↓
    ┌──────────────────────────────────────────┐
    │ [buonny-create-trip-axa] (Sprint 3)      │
    │ REST POST AXA /api/Viagem/IntegrarViagem  │
    │ Salva trip_id em order_trips             │
    └──────────────────────────────────────────┘
```

---

## 4. DETALHAMENTO: API 1 — consultaProfissional (SOAP)

**WSDL prod:** `https://api.buonny.com.br/portal/wsdl/consulta_profissional.wsdl`

### Parâmetros de entrada

```xml
<consulta>
  <cnpj_cliente>59650913000104</cnpj_cliente>  <!-- CNPJ Vectra, 14 dígitos -->
  <autenticacao>
    <token>...</token>                           <!-- Token Buonny Comercial -->
  </autenticacao>
  <produto>1</produto>                           <!-- 1=STANDARD, 2=PLUS -->
  <profissional>
    <documento>00000000000</documento>           <!-- CPF motorista, 11 dígitos -->
    <carreteiro>S</carreteiro>                   <!-- "S"=autônomo, "N"=não -->
  </profissional>
  <veiculos>
    <placa>ABC-1234</placa>                      <!-- Placa cavalo mecânico -->
  </veiculos>
  <carga_tipo>...</carga_tipo>                   <!-- ❌ Tabela não entregue — solicitar -->
  <carga_valor>100000.00</carga_valor>           <!-- Valor da carga, 8 chars -->
  <pais_origem>0</pais_origem>                   <!-- "0" = Brasil -->
  <uf_origem>SC</uf_origem>
  <cidade_origem>NAVEGANTES</cidade_origem>
  <pais_destino>0</pais_destino>
  <uf_destino>SP</uf_destino>
  <cidade_destino>SAO PAULO</cidade_destino>
</consulta>
```

### Parâmetros de saída

```xml
<retorno>
  <consulta>6079194676</consulta>                <!-- Número da liberação (salvar!) -->
  <status>PERFIL ADEQUADO AO RISCO</status>
  <mensagem>ATENÇÃO - DOCUMENTOS SOB RESPONSABILIDADE...</mensagem>
  <validade>IMPORTANTE - Se a foto apresentada...</validade>
  <consultas_adequadas_ultimos_12_meses>15</consultas_adequadas_ultimos_12_meses>
</retorno>
```

### Tabela de status e ação

| Status | Ação no sistema |
|---|---|
| `PERFIL ADEQUADO AO RISCO` | ✅ Liberar. Salvar `numero_liberacao` em risk_evidence |
| `PERFIL COM INSUFICIÊNCIA DE DADOS` | ⚠️ Bloquear. Exibir `parametros_insuficientes` ao operador |
| `PERFIL DIVERGENTE` | 🔴 Bloquear. Orientar profissional a buscar a Buonny |
| `PERFIL EXPIRADO` | 🔴 Bloquear. Reenviar ficha de cadastro |
| `EM ANÁLISE` | ⏳ Aguardar webhook ou polling. Bloquear emissão |

---

## 5. DETALHAMENTO: API 2 — Webhook Retorno da Ficha

**Endpoint que você cria:** `POST https://<sua-url>/functions/v1/buonny-callback-handler`
**Registrar em:** `https://portal.buonny.com.br/portal/FichaRetornoEndpoint`
**Auth:** Bearer Token (você define o token e cadastra no portal)

### Payload recebido (JSON)

```json
{
  "codigo_referencia": "19533164",
  "status_pesquisa": "1",
  "pesquisa": "PERFIL ADEQUADO AO RISCO",
  "parametros_insuficientes": []
}
```

### Mapeamento `status_pesquisa` (numérico)

| Código | Equivalente SOAP | Ação |
|---|---|---|
| `1` | PERFIL ADEQUADO AO RISCO | ✅ Liberar motorista. Notificar operador |
| `2` | PERFIL DIVERGENTE | 🔴 Bloquear |
| `3` | PERFIL COM INSUFICIÊNCIA | ⚠️ Exibir `parametros_insuficientes` |
| `4` | PERFIL EXPIRADO | 🔴 Solicitar reenvio de ficha |
| `5` | EM ANÁLISE | ⏳ Manter aguardando (defensivo) |

> ⚠️ Tabela numérica não publicada oficialmente. Código `3` = insuficiência confirmado pelo exemplo do PDF. Confirmar demais com TI Buonny em homologação.

---

## 6. DETALHAMENTO: API 3 — Polling de Retorno (Fallback)

Para quando o webhook não disparar. Fluxo em 2 etapas:

**Etapa 1 — Auth:**
```
POST https://api.buonny.com.br/api/v3/auth/login
Body: { "token": "<token-fixo-buonny>" }
Response: { "accessToken": "<token-temp-15min>" }
```

**Etapa 2 — Consulta:**
```
GET https://api.buonny.com.br/api/v3/fichas/retorno_cliente/consulta/{codigo_referencia}
Headers: Authorization: Bearer <token-temp>
Response: mesmo JSON do webhook
```

**Quando usar:** agendar polling após X minutos sem receber o webhook (ex: job CRON via Supabase após 30min).

---

## 7. DETALHAMENTO: API 4 — SM (Solicitação de Monitoramento — SOAP)

**WSDL prod:** `https://api.buonny.com.br/portal/wsdl/buonny.wsdl`

### Operações (campo `operacao_sm`)

| Valor | Operação | Identificador |
|---|---|---|
| `I` | Incluir nova SM | — |
| `A` | Alterar (itinerário, placa, motorista) | `pedido_cliente` |
| `C` | Cancelar | `codigo_sm` (número Buonny) |

### Campos principais de entrada

```xml
<viagem>
  <cnpj_cliente>59650913000104</cnpj_cliente>
  <autenticacao><token>...</token></autenticacao>
  <cnpj_embarcador>...</cnpj_embarcador>
  <cnpj_transportador>59650913000104</cnpj_transportador>
  <cnpj_gerenciadora_de_risco>00000000000000</cnpj_gerenciadora_de_risco>
  <pedido_cliente>CFN-OS-00123</pedido_cliente>   <!-- Seu ID interno -->
  <tipo_transporte>6</tipo_transporte>            <!-- 6=NACIONAL (ver tabela) -->
  <motorista>
    <nome>...</nome>
    <cpf>00000000000</cpf>
    <telefone>4799999999</telefone>
  </motorista>
  <veiculos><placa>ABC-1234</placa></veiculos>
  <origem>
    <!-- endereço completo com lat/long -->
  </origem>
  <data_previsao_inicio>25/05/2026 08:00:00</data_previsao_inicio>
  <data_previsao_fim>26/05/2026 18:00:00</data_previsao_fim>
  <monitorar_retorno>0</monitorar_retorno>
  <itinerario>
    <alvo>
      <tipo_parada>5</tipo_parada>               <!-- 5=DESTINO -->
      <previsao_de_chegada>26/05/2026 14:00:00</previsao_de_chegada>
      <!-- endereço destino -->
      <dados_da_carga>
        <carga>
          <nf>123456</nf>
          <serie_nf>1</serie_nf>
          <tipo_produto>...</tipo_produto>        <!-- ver tabela Produto -->
          <valor_total_nf>100000.00</valor_total_nf>
          <volume>10</volume>
          <peso>5000</peso>
        </carga>
      </dados_da_carga>
    </alvo>
  </itinerario>
  <operacao_sm>I</operacao_sm>
</viagem>
```

### Retorno

```xml
<numero_sm>22087856</numero_sm>   <!-- Salvar em order_trips.buonny_sm_number -->
```

---

## 8. DETALHAMENTO: API 5 — Consulta de Veículo por Entrega (SOAP)

**WSDL prod:** `https://api.buonny.com.br/portal/wsdl/status_entrega.wsdl`

Consulta posição em tempo real do caminhão. Requer pelo menos um identificador:
- `alvo` (código externo da parada na SM)
- `nota_fiscal`
- `placa`
- `pedido_cliente`

### Retorno

```xml
<viagem>
  <codigo_sm>19881148</codigo_sm>
  <placa>ABC0123</placa>
  <latitude>-23.6139500000</latitude>
  <longitude>-46.6398240000</longitude>
  <status_alvo>...</status_alvo>
  <km_restante>45</km_restante>
  <minutos_restante>60</minutos_restante>
  <notas>
    <numero>123456</numero>
    <pedido>...</pedido>
    <produto>EQUIPAMENTOS</produto>
    <valor>100000.00</valor>
  </notas>
</viagem>
```

**Uso:** Módulo de tracking/despacho para mostrar ETA ao cliente. Sprint 3+.

---

## 9. DETALHAMENTO: API 6 — AXA Criar Viagem (REST JSON)

**Endpoint homolog:** `https://10.19.0.45:8580/api/Viagem/IntegrarViagem` (**IP interno Nstech**)
**Endpoint prod:** solicitar à Nstech
**Método:** `POST`
**Auth:** `documentoCliente` (CPF/CNPJ) + `token` (fornecido pela **Nstech**, não Buonny)

> ⚠️ **Credenciais AXA são da Nstech** (separadas das credenciais Buonny).
> ⚠️ `cdcliente`, `cdtransp`, `cdembarcador` são **códigos internos do Integrador** — solicitar à Nstech.

### Payload (campos essenciais para Vectra FTL)

> ⚠️ **Datas**: `dtprevini`/`dtprevfim` usam `dd/MM/yyyy HH:mm:ss`. `dtPrevista` dentro de `documentos` usa ISO 8601 (`2026-05-26T14:00:00Z`).
> ⚠️ **`cdvincmot1`**: `"A"` = autônomo/agregado (confirmado em exemplo real do PDF). Não confundir com `<carreteiro>S</carreteiro>` do SOAP consultaProfissional.
> ⚠️ **`cdpaisorigemcavalo`**: `1` = Brasil (não `0` — confirmado em exemplo real).
> ⚠️ **Códigos de cidade** (`cdcidorigem`, `cdciddestino`): referenciados em `Cidades.pdf` (anexo do PDF). Solicitar à Nstech.

```json
{
  "documentoCliente": "59650913000104",
  "token": "<token-nstech>",
  "cdcliente": 0,                          // Código interno Vectra no Integrador — solicitar
  "nrplacacavalo": "ABC-1234",
  "cdpaisorigemcavalo": 1,                 // 1 = Brasil
  "nrplacacarreta1": "AAD0000",
  "cdpaisorigemcarreta1": 1,
  "cdpaisorigemcarreta2": -1,              // -1 quando sem segunda carreta
  "nrplacacarreta2": "",
  "cdpaisorigemmot1": 1,
  "nrdocmotorista1": "00000000000",        // CPF motorista
  "cdpaisorigemmot2": -1,                  // -1 quando sem segundo motorista
  "nrdocmotorista2": "",
  "nomemot1": "Nome Motorista",
  "nomemot2": "",
  "cdvincmot1": "A",                       // "A"=autônomo/agregado (confirmado em PDF)
  "cdvincmot2": "",
  "dtprevini": "25/05/2026 08:00:00",      // formato dd/MM/yyyy HH:mm:ss
  "dtprevfim": "26/05/2026 18:00:00",
  "rastreadorcavalo": null,                // ID rastreador (nullable)
  "cdemprastrcavalo": 0,                   // Empresa rastreadora — ver tabela Tecnologias
  "rastreadorcarreta1": "",
  "cdemprastrcarreta1": -1,
  "cdcidorigem": 0,                        // Código cidade Integrador — ver Cidades.pdf
  "cdciddestino": 0,
  "cdrota": -1,                            // -1 quando sem modelo de rota
  "vlcarga": 100000.00,
  "cdtransp": 0,                           // Código transportadora no Integrador — solicitar
  "nrfonecel": "999999999",
  "cdtipooperacao": 6,                     // 6=NACIONAL (ver tabela Tipo Transporte)
  "cdembarcador": 0,                       // Código embarcador no Integrador — solicitar
  "nrcontrolecarga": "CFN-OS-00123",       // Nº interno da OS/carga
  "nrfrota": "",
  "distanciatotal": 0,
  "pesocarga": 5000.0,
  "dscontroleviag1": "",                   // Campos livres dscontroleviag1..10
  "produtos": [{ "cdprod": 382, "valor": 100000.00 }],  // 382=MATERIAL ESPORTIVO
  "documentos": [{
    "nrDoc": "123456",
    "tpDoc": 1,                            // 1=NF
    "valorDoc": 100000.00,
    "tpOperacao": 3,                       // 2=coleta, 3=entrega
    "dtPrevista": "2026-05-26T14:00:00Z",  // ISO 8601 (diferente do nível raiz)
    "dtPrevistaSaida": null,
    "cdCid": 0,                            // Cidade destino (Integrador)
    "dsRua": "Rua Destino",
    "nrRua": "100",
    "cdEmbarcador": 0,
    "cdPaisOrigemEmitente": 1,
    "nrCnpjCpfEmitente": "59650913000104",
    "cdPaisOrigemDestinatario": 1,
    "nrCnpjCPFDestinatario": "00000000000000",
    "latitude": -23.5,
    "longitude": -46.6,
    "dsNome": "Academia Destino",
    "vlPeso": 5000.0,
    "vlCubagem": 0,
    "cdTransp": 0,
    "flRegiao": 0,
    "flTrocaNota": 0,
    "cdTrocaNota": 0,
    "produtos": [{ "cdprod": 382, "valor": 100000.00 }]
  }],
  "nrDDDCelMot": "47",
  "dsnomerespviag": "",
  "dsfone1respviag": "",
  "dsfone2respviag": "",
  "iscas": [],                             // Dispositivos antifurto (opcional)
  "rotas": [{ "latLngViewModels": [], "cdRotaModelo": -1 }],
  "temperaturas": [],
  "localDeOrigem": {
    "cdCid": 0,                            // Navegantes/SC — ver Cidades.pdf
    "dsRua": "Rua Exemplo",
    "nrRua": "100",
    "complementoRua": "",
    "dsBairro": "Centro",
    "nrCep": "88370000",
    "nrFone1": "",
    "nrFone2": "",
    "email": "",
    "observacao": "",
    "cdPaisOrigemEmitente": 1,
    "nrCnpjCpfEmitente": "59650913000104",
    "latitude": -26.8,
    "longitude": -48.6,
    "dsNome": "Vectra Cargo Navegantes",
    "razaoSocial": "Vectra Transportes Ltda",
    "inscricaoEstadual": "",
    "nomeFantasia": "Vectra Cargo",
    "nrDDDFone1": "47",
    "nrDDDFone2": ""
  },
  "escolta": null,
  "travas": []
}
```

### Retorno

> ⚠️ O PDF não documenta o formato de retorno de sucesso. Confirmar com Nstech em homologação.

```json
{ "trip_id": "...", "status": "..." }
```

---

## 10. TABELAS DE CÓDIGO (extraídas dos PDFs)

### Tipo Transporte (campo `tipo_transporte` na SM)

| Código | Descrição | Usar? |
|---|---|---|
| 1 | TRANSFERENCIA | eventual |
| 2 | DISTRIBUICAO | fracionado |
| 3 | MATERIA PRIMA | — |
| 4 | MISTA | — |
| 5 | RETORNO | — |
| **6** | **NACIONAL** | ✅ **FTL ponta-a-ponta** |
| 7 | EXPORTACAO | — |
| 8 | IMPORTACAO | — |
| 9 | COLETA | — |
| 10 | DEVOLUCAO | — |
| 17 | CROSSDOKING | — |
| 18 | VAREJO | — |
| 20 | TRANSFERENCIA REGIONAL | eventual |

### Tipo Parada (campo `tipo_parada` por alvo na SM)

| Código | Descrição |
|---|---|
| 2 | COLETA |
| 3 | ENTREGA |
| **4** | **ORIGEM** |
| **5** | **DESTINO** |
| 6 | REFEICAO |
| 7 | PERNOITE |
| 8 | PASSAGEM |
| 9 | ADUANA |

### Tecnologias de rastreador (campo `cdemprastrcavalo` na AXA)

| Código | Rastreadora |
|---|---|
| 1 | ONIXSAT |
| 2 | OMNILINK |
| 4 | SASCAR |
| 6 | ITER |
| 7 | CRONOS |
| 8 | AUTOTRAC |
| 10 | STI |
| 21 | CIELO |
| 5002 | ITURAN |
| 5003 | PROTECT SAT |
| 5004 | CARGO TRACK |
| 5009 | TRACKER |
| 5010 | OMNILOC |
| 5012 | POINTER |
| 5014 | POSITRON |

### Produto (campo `cdprod` na SM e AXA — lista parcial relevante para Vectra)

> Tabela completa varrida em `WS-SOAP-2-6-1.pdf`. Não existe entrada específica "EQUIPAMENTOS DE ACADEMIA".
> Melhor mapeamento para carga Vectra: **382 = MATERIAL ESPORTIVO** (carga homogênea de academia);
> **365 = MAT. ESPORTIVO / DIVERSOS** (carga mista com outros itens).

| Código | Descrição | Uso Vectra |
|---|---|---|
| **382** | **MATERIAL ESPORTIVO** | **Equipamentos de academia (uso principal)** |
| **365** | **MAT. ESPORTIVO / DIVERSOS** | **Carga mista fitness + outros** |
| 266 | EQUIPAMENTOS INDUSTRIAIS | Maquinário pesado (não fitness) |
| 267 | EQUIPAMENTOS PARA SHOWS | Estrutura/palco — não aplicável |
| 231 | DIVERSOS | Fallback genérico |
| 137 | CARGA SECA | Fallback genérico seco |
| 138 | CARGA SECA EM GERAL | Fallback genérico seco |
| 6 | TELEVISORES | — |
| 7 | CELULAR | — |

### carga_tipo (campo `carga_tipo` na consultaProfissional)

> ✅ **Resolvível via SOAP Opentech `sgrListaTipoCarga`** — operação retorna lista de tipos de carga
> do cliente (requer `chaveacesso`, `cdpas`, `cdcliente`). Chamar uma vez em setup e cachear.
> Endpoint Opentech: `http://webservicesrastrear.buonny.com.br/sgrOpentechBuonny/sgropentech.asmx`

| Ação | Status |
|---|---|
| Buscar credenciais Opentech (`chaveacesso`, `cdpas`, `cdcliente`) com TI Buonny | ⏳ Pendente |
| Chamar `sgrListaTipoCarga` e mapear tipos para carga de academia | ⏳ Pendente setup |

---

## 10b. OPENTECH SOAP — Operações de Setup

**WSDL:** `http://webservicesrastrear.buonny.com.br/sgrOpentechBuonny/sgropentech.asmx`
**Auth comum:** `chaveacesso` (string), `cdpas` (int), `cdcliente` (int)

Descobertas ao analisar o WSDL completo entregue pela Buonny:

| Operação | Descrição | Uso |
|---|---|---|
| `sgrListaTipoCarga` | Retorna lista de tipos de carga | ✅ **Resolve o bloqueio `carga_tipo`** — chamar uma vez, cachear resultado |
| `sgrListaProdutos` | Retorna lista de produtos da empresa (client-specific) | Confirmar se cdprod=382 está mapeado para Vectra |
| `InsereNaFilaBuonny` | Insere viagem na fila de processamento para envio à Buonny | Mecanismo alternativo de enfileiramento (usa `cdviag`) |
| `sgrConsultarStatusPesquisaUnificado` | Retorna status de pesquisa na API NSTech | Alternativa ao polling REST para verificar resultado de ficha |

> ⚠️ **Produtos são client-specific**: `sgrListaProdutos` retorna a tabela de produtos cadastrada para o cliente Vectra — não é uma tabela global. Confirmar se cdprod=382 aparece na lista antes de hardcodar.

> **`InsereNaFilaBuonny`** revela que o Opentech tem uma fila interna de processamento. Em vez de chamar `consultaProfissional` diretamente, é possível enfileirar via `InsereNaFilaBuonny(chaveacesso, cdviag, cdpas, cdcliente)` e aguardar processamento assíncrono. Avaliar qual fluxo (direto vs fila) é mais adequado para o buonny-check-worker.

---

## 10c. NSTECH CADASTRO REST — Consulta de Profissional (Alternativa ao SOAP Buonny)

> **Descoberta via análise do bundle JS e navegação do portal `nscadastro.nstech.com.br` (2026-05-01)**
> O sistema Nstech Backoffice é a plataforma de cadastro e análise de motoristas/veículos
> que alimenta a consulta de risco — provavelmente o mesmo backend do Buonny `consultaProfissional`.

**Base URL:** `https://nscadastro.nstech.com.br/cadastrons`
**Auth:** OAuth via `auth.nstech.com.br` — token criptografado (`v2:...`) em localStorage
**Usuário logado:** Camilla Rosas / VECTRA CARGO
**`setId` da Vectra:** `1206937` ✅ (capturado de `aggregatePage` localStorage)

### Endpoints identificados

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/sets/v1/sendToAnalysis` | **Principal** — submete motorista+veículo para análise |
| `GET` | `/bases/v1/vehicleType/list/all` | Tipos de veículo |
| `GET` | `/bases/v1/bodyWorkTypes/list/all` | Tipos de carroceria |
| `GET` | `/bases/v1/genders/list/all` | Sexo |
| `GET` | `/bases/v1/cities/province/{provinceId}` | Cidades por estado |
| `GET` | `/bases/v1/provinces/country/{countryId}` | Estados por país |
| `GET` | `/bases/v1/colors/list/all` | Cores |
| `GET` | `/bases/v1/companies/activity/{activityId}` | Fabricantes por atividade |

### Payload `POST /sets/v1/sendToAnalysis`

```json
{
  "setId": 1206937,
  "advancedAnalysis": false,
  "professionals": [
    {
      "countryId": 1,
      "cpfNumber": "00000000000",
      "name": "Nome Motorista",
      "jobId": 1,
      "dateBirth": "1990-01-01",
      "provinceBirthId": 24,
      "cityBirthId": 0,
      "rgNumber": "000000000",
      "rgProvinceId": 24,
      "motherName": "Nome Mae",
      "fatherName": "Nome Pai",
      "provinceAddressId": 24,
      "cityAddressId": 0,
      "phoneNumber1": "47999999999",
      "countryPhoneCode1": 55
    }
  ],
  "vehicles": [
    {
      "countryId": 1,
      "licensePlate": "ABC1234",
      "vehicleTypeId": 0,
      "manufacturerId": 0,
      "vehicleModelId": 0,
      "colorId": 0,
      "chassisNumber": "",
      "renavamOrCRLV": "",
      "licensingProvinceId": 24,
      "manufactureYear": 2020,
      "modelYear": 2020,
      "trackingCompanyId": 0,
      "trackNumber": ""
    }
  ],
  "facialBiometrics": null
}
```

### Retorno esperado

```json
{
  "setId": 1206937,
  "consultId": 2333100,
  "statusId": 3,
  "statusDescription": "Concluída",
  "resultTypeId": 1,
  "resultId": null,
  "resultDescription": null,
  "isResultExpired": true,
  "completedAt": "..."
}
```

> `consultId` = equivalente ao `numero_liberacao` do Buonny SOAP
> `statusId: 3 / statusDescription: "Concluída"` = consulta processada
> `resultTypeId: 1` = aprovado (confirmar mapeamento completo em homologação)

### Campos de profissional (completo)

| Campo | Tipo | Descrição |
|---|---|---|
| `countryId` | int | ID do país (Brasil = 1) |
| `cpfNumber` | string | CPF 11 dígitos |
| `name` | string | Nome completo |
| `hasSocialName` | bool | Tem nome social |
| `socialName` | string | Nome social (se houver) |
| `jobId` | int | ID da profissão (motorista = confirmar) |
| `dateBirth` | string | Data nascimento (ISO) |
| `provinceBirthId` | int | ID do estado de nascimento |
| `cityBirthId` | int | ID da cidade de nascimento |
| `rgNumber` | string | Número do RG |
| `rgProvinceId` | int | ID do estado do RG |
| `motherName` | string | Nome da mãe |
| `fatherName` | string | Nome do pai |
| `provinceAddressId` | int | ID do estado do endereço |
| `cityAddressId` | int | ID da cidade do endereço |
| `phoneNumber1..4` | string | Telefones (até 4) |
| `countryPhoneCode1..4` | int | DDI de cada telefone |

### Campos de veículo (completo)

| Campo | Tipo | Descrição |
|---|---|---|
| `countryId` | int | ID do país |
| `licensePlate` | string | Placa |
| `vehicleTypeId` | int | Tipo de veículo/carroceria |
| `manufacturerId` | int | Fabricante |
| `vehicleModelId` | int | Modelo |
| `colorId` | int | Cor |
| `chassisNumber` | string | Chassis |
| `renavamOrCRLV` | string | RENAVAM ou CRLV |
| `crlvSecurityCode` | string | Código segurança CRLV |
| `licensingProvinceId` | int | Estado de licenciamento |
| `manufactureYear` | int | Ano fabricação |
| `modelYear` | int | Ano modelo |
| `trackingCompanyId` | int | Empresa rastreadora |
| `trackNumber` | string | Nº rastreador |
| `trackingAntennaType` | string | Tipo antena |
| `secondaryTrackers` | array | Rastreadores secundários |
| `vehicleOwnerId` | string | ID do proprietário |
| `picture` | string | Foto (base64?) |

### Campos proprietário pessoa física

| Campo | Tipo | Descrição |
|---|---|---|
| `ownerType` | string | `natural` / `legal` |
| `countryId` | int | País |
| `isProfessionalOwner` | bool | Motorista é o dono |
| `hasRntrcAntt` | bool | Tem RNTRC/ANTT |
| `rntrcAntt` | string | Nº RNTRC |
| `name` | string | Nome |
| `registrationNumber` | string | CPF |
| `birthDate` | string | Data nascimento |
| `birthProvinceId` | int | Estado nascimento |
| `birthCityId` | int | Cidade nascimento |
| `addressProvinceId` | int | Estado endereço |
| `addressCityId` | int | Cidade endereço |
| `registrationProvinceId` | int | Estado do RG |
| `mothersName` | string | Nome da mãe |
| `fathersName` | string | Nome do pai |
| `countryPhoneCode1` | int | DDI |
| `phoneNumber1` | string | Telefone |

### Estratégia de implementação

A API Nstech Cadastro pode ser usada como **caminho alternativo** ao SOAP Buonny para validação de motoristas:

```
BUONNY_USE_STUB=false + BUONNY_TOKEN configurado → SOAP Buonny (caminho oficial)
NSTECH_USE_CADASTRO=true + NSTECH_SET_ID=1206937 → REST Nstech (caminho alternativo)
```

**Vantagem do caminho Nstech**: `setId` já identificado (1206937), API REST documentada, sem SOAP.
**Pendência**: obter token de serviço (não o token de sessão criptografado do browser) via Nstech.

### O que ainda falta do backoffice Nstech (não exposto no frontend)

| Item | Status |
|---|---|
| Token AXA (serviço Integrador) | ❌ Backend Nstech — solicitar |
| URL pública AXA (substitui 10.19.0.45:8580) | ❌ Backend Nstech — solicitar |
| `cdcliente` Vectra no Integrador | ❌ Backend Nstech — solicitar |
| `cdtransp` Vectra no Integrador | ❌ Backend Nstech — solicitar |
| `cdcidorigem`/`cdciddestino` (Cidades.pdf) | ❌ Backend Nstech — solicitar |
| Token de serviço Nstech Cadastro (não sessão browser) | ❌ Solicitar conta de serviço |

---

## 11. COMPONENTES A CRIAR

```
// supabase/functions/_shared/
├── buonny-soap-client.ts          // SOAP: consultaProfissional + SM + status_entrega
├── buonny-rest-client.ts          // REST: auth login + polling ficha
├── buonny-axa-client.ts           // REST JSON: AXA IntegrarViagem
└── buonny-types.ts                // Tipos compartilhados

// supabase/functions/
├── buonny-check-worker/index.ts   // REFACTOR: stub → consultaProfissional real
├── buonny-callback-handler/       // NEW: webhook POST JSON receiver
├── buonny-create-sm/              // NEW: criar SM (SOAP buonny.wsdl)
└── buonny-create-trip-axa/        // NEW: criar viagem AXA (REST)

// src/components/insurance/        // JÁ EXISTE — não recriar
├── InsuranceSelector.tsx          ✅ Pronto
├── InsuranceSelectorLazy.tsx      ✅ Pronto
└── InsuranceSummary.tsx           ✅ Pronto

// src/hooks/                       // JÁ EXISTE — não recriar
├── useInsuranceOptionsRefactored.ts  ✅ Pronto (chama buonny-check-worker)
└── useRiskEvaluation.ts              ✅ Pronto (11 hooks + mutations)
```

> **Nota:** `buonny-check` (stub antigo) e `buonny-check-worker` (stub atual) são dois arquivos
> distintos. Refatorar apenas o `buonny-check-worker` — é o que `useInsuranceOptionsRefactored`
> chama.

---

## 12. BANCO DE DADOS

### Já existe (não criar)

- `risk_policies` — apólices RCTR-C / RC-DC (Berkley)
- `risk_evaluations` — avaliações de risco por entidade
- `risk_evidence` — evidências (inclui resultado Buonny + numero_liberacao)
- `insurance_logs` — log de chamadas ao buonny-check-worker

### Adicionar a `quotes`

```sql
-- Já pode existir via QuoteFormData — verificar antes de migrar
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS insurance_coverage_type VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS insurance_estimated_premium INTEGER DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS insurance_status VARCHAR(20);
```

### Adicionar a `order_trips`

```sql
ALTER TABLE order_trips ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100);
ALTER TABLE order_trips ADD COLUMN IF NOT EXISTS buonny_sm_number VARCHAR(100);
ALTER TABLE order_trips ADD COLUMN IF NOT EXISTS buonny_numero_liberacao VARCHAR(100);
ALTER TABLE order_trips ADD COLUMN IF NOT EXISTS axa_trip_id VARCHAR(100);
```

### Nova tabela (Sprint 3)

```sql
CREATE TABLE IF NOT EXISTS insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  order_id UUID REFERENCES order_trips(id),
  policy_number VARCHAR(100) UNIQUE,
  coverage_level VARCHAR(20) NOT NULL,       -- BASIC | STANDARD | PLUS
  premium_amount INTEGER NOT NULL,           -- centavos
  buonny_consulta_id VARCHAR(100),           -- numero_liberacao do retorno SOAP
  buonny_sm_number VARCHAR(100),             -- numero_sm do retorno SM
  axa_trip_id VARCHAR(100),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expiry_at TIMESTAMPTZ,
  status VARCHAR(20),                        -- active | claimed | expired
  buonny_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insurance_policies_quote_id ON insurance_policies(quote_id);
CREATE INDEX idx_insurance_policies_consulta_id ON insurance_policies(buonny_consulta_id);
```

---

## 13. ROLLOUT PLAN

### Sprint 2 (Maio 2026) — bloqueado por credenciais

> **Decisão arquitetural**: `consultaProfissional` é chamado ao **atribuir motorista+veículo à OS**,
> NÃO no step Seguro da cotação. O step Seguro calcula prêmio BASIC/STANDARD/PLUS
> apenas com cargo_value + cargo_type + UFs — sem CPF/placa (indisponíveis nessa fase).

**Semana 1-2: Clients + Pricing**
- [ ] `buonny-rest-client.ts`: auth login (Bearer token)
- [ ] `buonny-soap-client.ts`: operação `consultaProfissional` (para fase OS)
- [ ] Refatorar `buonny-check-worker/index.ts` — fase cotação: retornar opções de prêmio sem chamar SOAP
- [ ] Feature flag: `BUONNY_USE_STUB=true` para dev local
- [ ] Registrar endpoint webhook no Portal Buonny

**Semana 3-4: Driver Check + Callback**
- [ ] `buonny-check-worker`: adicionar modo `phase=os` → chama `consultaProfissional` com CPF+placa
- [ ] `buonny-callback-handler/index.ts`: POST JSON + atualizar risk_evidence
- [ ] Polling fallback: CRON job após 30min sem callback
- [ ] E2E tests (insurance selection + driver check flow)
- [ ] Deploy em staging

### Sprint 3 (Junho 2026)

**Semana 1-2: Monitoramento**
- [ ] `buonny-soap-client.ts`: adicionar operação SM (incluir/alterar/cancelar)
- [ ] `buonny-create-sm/index.ts`: criar SM ao converter OS
- [ ] `buonny-axa-client.ts`: REST POST AXA
- [ ] `buonny-create-trip-axa/index.ts`: criar viagem Integrador
- [ ] Migrations `order_trips` + `insurance_policies`

**Semana 3: Tracking**
- [ ] `buonny-soap-client.ts`: adicionar `status_entrega` (Consulta Veículo)
- [ ] Edge function para polling de ETA
- [ ] UI: ETA no card de despacho

**Semana 4: Produção**
- [ ] Deploy produção
- [ ] Monitor Buonny API health (circuit breaker)
- [ ] Dashboard de seguros (admin)
- [ ] Playbook troubleshooting

---

## 14. BLOCKERS & DEPENDÊNCIAS

### CRÍTICO — Buonny

| Item | Status |
|---|---|
| Token de homologação + CNPJ | ⏳ Aguardando (desde 2026-03-09) |
| **Tabela `carga_tipo`** | ✅ **Resolvível via `sgrListaTipoCarga` (Opentech SOAP)** — aguarda credenciais Opentech |
| Credenciais Opentech (`chaveacesso`, `cdpas`, `cdcliente`) | ⏳ Solicitar ao TI Buonny |
| Cadastro do endpoint webhook | Pendente (aguarda URL da Edge Function) |

### CRÍTICO — Nstech/AXA

| Item | Status |
|---|---|
| Token AXA (fornecido pela Nstech) | ⏳ Aguardando |
| URL pública AXA (o PDF tem IP interno 10.19.0.45:8580) | ❌ Solicitar à Nstech |
| `cdcliente` Vectra no Integrador | ❌ Solicitar à Nstech |
| `cdtransp` Vectra no Integrador | ❌ Solicitar à Nstech |
| Códigos de cidade Integrador (`cdcidorigem`/`cdciddestino`) | ❌ Solicitar `Cidades.pdf` à Nstech (referenciado em API-AXA.pdf) |
| Formato retorno AXA sucesso (não documentado no PDF) | ❌ Confirmar em homologação |

### PODE RESOLVER INTERNAMENTE

| Item | Ação |
|---|---|
| ~~Código `cdprod` para Equipamentos de Academia~~ | ✅ **382 = MATERIAL ESPORTIVO** (ou 365 para carga mista) |
| ~~Tabela `carga_tipo`~~ | ✅ **Via `sgrListaTipoCarga` Opentech SOAP** (aguarda credenciais Opentech) |
| Mapeamento `status_pesquisa` numérico completo | Confirmar em homologação |
| Código rastreador (`cdemprastrcavalo`) | Tabela Tecnologias já disponível no PDF |
| Códigos de cidade AXA (`cdcidorigem`/`cdciddestino`) | Referenciados em `Cidades.pdf` — solicitar à Nstech |
| `sgrListaProdutos` (Opentech) | Confirmar cdprod=382 com cliente Vectra via SOAP |

---

## 15. REFERÊNCIA RÁPIDA DE ENDPOINTS

| Serviço | Protocolo | Endpoint Homolog |
|---|---|---|
| consultaProfissional | SOAP | `tstportal.buonny.com.br/portal/wsdl/consulta_profissional.wsdl` |
| SM (monitoramento) | SOAP | `tstportal.buonny.com.br/portal/wsdl/buonny.wsdl` |
| Status Entrega | SOAP | `tstportal.buonny.com.br/portal/wsdl/status_entrega.wsdl` |
| Auth REST | REST | `tstapi.buonny.com.br/api/v3/auth/login` |
| Polling Ficha | REST | `tstapi.buonny.com.br/api/v3/fichas/retorno_cliente/consulta/{id}` |
| AXA (Integrador) | REST JSON | `10.19.0.45:8580/api/Viagem/IntegrarViagem` ⚠️ IP interno |
| Webhook register | Portal | `portal.buonny.com.br/portal/FichaRetornoEndpoint` |

---

## 16. DOCUMENTAÇÃO RELACIONADA

- `BUONNY-INTEGRATION-SPEC.md` — este arquivo
- `.cursor/Buonny API/API-Consulta-Profissional.pdf` — SOAP consultaProfissional
- `.cursor/Buonny API/WS-SOAP-2-6-1.pdf` — SOAP SM + tabelas de código completas (cdprod varrido)
- `.cursor/Buonny API/API-AXA.pdf` — REST AXA payload completo (inclui exemplo real com cdvincmot1="A", cdpais=1, datas dd/MM/yyyy)
- `webservicesrastrear.buonny.com.br/sgrOpentechBuonny/sgropentech.asmx` — WSDL Opentech (sgrListaTipoCarga, sgrListaProdutos, InsereNaFilaBuonny)
- `.cursor/Buonny API/API-Consulta-de-Veiculo-Por-Entrega.pdf` — SOAP status_entrega
- `.cursor/Buonny API/Criacao-de-um-Endpoint-para-o-Retorno-de-Ficha-3.pdf` — webhook spec
- `.cursor/Buonny API/Callback-consulta-do-retorno-da-ficha-4-1.pdf` — polling REST spec
- `.cursor/Buonny API/viv.pdf` — SM via CSV (batch alternativo)
- `src/hooks/useInsuranceOptionsRefactored.ts` — hook que chama buonny-check-worker
- `src/hooks/useRiskEvaluation.ts` — suite de hooks de avaliação de risco
- `supabase/functions/buonny-check-worker/index.ts` — stub atual a refatorar

---

**Próximo Review:** Após recebimento das credenciais Buonny + tabela `carga_tipo`

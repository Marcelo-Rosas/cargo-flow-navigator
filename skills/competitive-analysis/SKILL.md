---
name: competitive-analysis
description: Analisa concorrentes do mercado de TMS/CRM logístico com matrizes de funcionalidades, análise de posicionamento e implicações estratégicas para o Cargo Flow Navigator. Use quando pesquisar um concorrente, comparar capacidades de produto, avaliar posicionamento competitivo ou preparar um briefing competitivo para estratégia de produto.
---

# Skill: Análise Competitiva — Cargo Flow Navigator

Você é especialista em análise competitiva para o mercado de **TMS (Transportation Management System) e CRM logístico** no Brasil. Você ajuda a analisar concorrentes, mapear o cenário competitivo, comparar funcionalidades, avaliar posicionamento e derivar implicações estratégicas para as decisões de produto e comerciais da **Vectra Cargo**.

---

## Contexto do Produto

O **Cargo Flow Navigator** é o CRM logístico da Vectra Cargo. Seu diferencial central é a **integração nativa entre gestão comercial e operacional**: cotação → OS → viagem → financeiro, tudo em um único sistema com inteligência artificial embarcada.

**Capacidades-chave do produto (baseadas no banco de dados real):**

| Domínio | Capacidades Principais |
|:---|:---|
| **Cotação e Precificação** | Tabelas de preço por modalidade (lotação/fracionado), GRIS, TSO, TAC, NTC, pedágio por rota, cubage, `pricing_breakdown` detalhado |
| **Gestão Operacional** | Ordens de Serviço (OS), viagens (`trips`), rateio de custos (`trip_cost_items`), `apportion_key` configurável |
| **Compliance e Qualificação** | `compliance_checks`, `driver_qualifications`, `antt_floor_rates`, `regulatory_updates` |
| **Financeiro** | `financial_documents` (CTe, NF, PAG, FAT), `trip_financial_summary`, reconciliação de pagamentos, fluxo de caixa |
| **IA Embarcada** | 30 Edge Functions de IA: `ai-financial-agent`, `ai-compliance-check-worker`, `ai-driver-qualification-worker`, `ai-orchestrator-agent`, `ai-operational-report-worker` |
| **Workflow** | `workflow_definitions`, `workflow_transitions`, `approval_rules`, `approval_requests` |
| **Integrações** | API Buonny (consulta de motoristas), cálculo de distância, lookup de CEP, envio de e-mail de cotação |

---

## 1. Mapeamento do Cenário Competitivo

### Identificando o Conjunto Competitivo

Defina os concorrentes em múltiplos níveis, sempre ancorado na realidade do mercado brasileiro de transporte rodoviário de cargas:

**Concorrentes Diretos** — TMS/CRM logísticos que atendem transportadoras e embarcadores brasileiros:
- Sistemas que cobrem cotação, OS, viagem e financeiro em um único produto
- Aparecem em avaliações de clientes, comparações em grupos do setor, RFPs de transportadoras
- Exemplos do mercado: Omie Logística, Intelipost, Transys, RotaExata, sistemas ERP com módulo TMS

**Concorrentes Indiretos** — Resolvem o mesmo problema de forma diferente:
- ERPs genéricos com módulo logístico (TOTVS, SAP, Sankhya) — mesma necessidade, abordagem mais pesada
- Planilhas Excel + WhatsApp — o "não-consumo" ainda é o maior concorrente em transportadoras menores
- Sistemas de cotação isolados (sem gestão operacional integrada)

**Concorrentes Adjacentes** — Não competem hoje, mas poderiam:
- Plataformas de frete spot (Fretebras, Cargosnap, Truckpad) que poderiam adicionar gestão de OS
- ERPs verticais para transporte que poderiam lançar módulo de CRM comercial
- Startups de IA logística atacando nichos específicos (compliance, precificação)

**Soluções Substitutivas** — Formas completamente diferentes de resolver a necessidade:
- Terceirizar a gestão para uma transportadora maior (embarcador usa o TMS do parceiro)
- Contratar um analista de operações para gerir em planilhas
- Usar um 4PL que absorve a complexidade operacional

### Eixos do Mapa de Posicionamento

Escolha eixos que revelem diferenças estratégicas relevantes para o mercado de transporte rodoviário:

| Eixo | Extremo A | Extremo B |
|:---|:---|:---|
| **Escopo** | Ponto de solução (só cotação ou só TMS) | Suite integrada (comercial + operacional + financeiro) |
| **Segmento** | PME / transportadora pequena | Enterprise / grande embarcador |
| **IA** | Sem IA nativa | IA embarcada em todos os fluxos |
| **Vertical** | Horizontal (qualquer setor) | Vertical transporte rodoviário BR |
| **Modelo** | Self-serve / SaaS simples | Implantação consultiva |
| **Compliance** | Sem gestão regulatória | Compliance ANTT/SEFAZ integrado |

### Monitoramento Contínuo do Cenário

Acompanhe movimentos competitivos ao longo do tempo:
- Lançamentos de produto e releases de funcionalidades (changelogs, blog posts, LinkedIn)
- Mudanças de precificação e empacotamento
- Rodadas de investimento e aquisições (especialmente no mercado de logtech brasileiro)
- Contratações estratégicas e vagas abertas (sinalizam direção estratégica)
- Vitórias e perdas de clientes — especialmente as suas
- Cobertura de analistas e avaliações em G2, Capterra, Reclame Aqui
- Anúncios de parcerias (ex: integração com SEFAZ, Buonny, seguradoras)
- Mudanças regulatórias da ANTT que criam oportunidade para novos entrantes

---

## 2. Matrizes de Comparação de Funcionalidades

### Áreas de Capacidade para o Mercado de TMS/CRM Logístico

Use estas áreas funcionais ao construir matrizes de comparação — elas refletem o que os compradores do setor de transporte avaliam:

**1. Gestão Comercial**
- Cotação de frete (lotação, fracionado, LTL)
- Motor de precificação (tabelas, GRIS, TSO, TAC, NTC, pedágio)
- CRM de clientes e embarcadores
- Envio e rastreamento de propostas

**2. Gestão Operacional**
- Ordens de Serviço (OS) e ciclo de vida
- Gestão de viagens e vinculação OS ↔ viagem
- Qualificação e compliance de motoristas
- Gestão de frota e veículos

**3. Financeiro e Fiscal**
- Geração de CTe e NF
- Contas a pagar/receber (PAG, FAT)
- Rateio de custos por viagem
- Reconciliação de pagamentos
- Fluxo de caixa

**4. Compliance e Regulatório**
- Verificação ANTT (piso mínimo de frete)
- Qualificação de motoristas (CNH, ANTT, Buonny)
- Monitoramento de atualizações regulatórias
- Auditoria e rastreabilidade

**5. Inteligência Artificial**
- IA em cotação e precificação
- IA em compliance e qualificação
- IA em análise financeira e anomalias
- IA em relatórios operacionais
- Orquestração multi-agente

**6. Integrações e Ecossistema**
- Integração com SEFAZ (CTe, NF)
- Integração com API Buonny
- Cálculo de distância e pedágio
- Notificações (e-mail, WhatsApp)
- API aberta para parceiros

### Escala de Avaliação

**Simples (recomendada para a maioria dos casos):**
- **Forte**: Capacidade líder de mercado. Funcionalidade profunda, bem executada.
- **Adequado**: Funcional. Cumpre o objetivo mas sem diferenciação.
- **Fraco**: Existe mas com limitações. Lacunas significativas ou execução ruim.
- **Ausente**: Não possui esta capacidade.

**Detalhada (para comparações aprofundadas):**
- **5**: Melhor da categoria. Define o padrão que outros aspiram a alcançar.
- **4**: Forte. Completo e bem executado.
- **3**: Adequado. Atende necessidades básicas sem diferenciação.
- **2**: Limitado. Existe mas com lacunas significativas.
- **1**: Mínimo. Mal funcional ou em beta inicial.
- **0**: Ausente.

### Template de Matriz de Comparação

```
| Área de Capacidade        | Cargo Flow Navigator | Concorrente A | Concorrente B |
|:--------------------------|:--------------------:|:-------------:|:-------------:|
| **Gestão Comercial**      |                      |               |               |
| Cotação multi-modalidade  | Forte                | Adequado      | Fraco         |
| Motor de precificação     | Forte                | Fraco         | Ausente       |
| **Gestão Operacional**    |                      |               |               |
| OS e ciclo de vida        | Forte                | Forte         | Adequado      |
| Gestão de viagens         | Forte                | Adequado      | Ausente       |
| **Financeiro**            |                      |               |               |
| Rateio de custos          | Forte                | Fraco         | Ausente       |
| Reconciliação             | Forte                | Ausente       | Ausente       |
| **IA Embarcada**          |                      |               |               |
| IA em compliance          | Forte                | Ausente       | Ausente       |
| Orquestração multi-agente | Forte                | Ausente       | Ausente       |
```

### Dicas para Comparação de Funcionalidades

- Avalie com base em experiência real do produto, feedback de clientes e avaliações — não apenas em claims de marketing
- "Tem a funcionalidade X" é menos útil do que "Quão bem executa X?" — use a escala de avaliação
- Pondere a comparação pelo que importa para seus clientes-alvo (transportadoras de médio porte), não pela contagem total de features
- Atualize regularmente — comparações de funcionalidades ficam desatualizadas rapidamente
- Seja honesto sobre onde concorrentes estão à frente. Uma comparação que sempre mostra você vencendo não é crível.
- Inclua o "por que importa" para cada área de capacidade — nem todas as features têm o mesmo peso para os compradores

---

## 3. Frameworks de Análise de Posicionamento

### Análise do Posicionamento do Concorrente

Para cada concorrente, extraia o posicionamento usando este template:

**Template**: Para [cliente-alvo] que [necessidade/problema], [Produto] é um [categoria] que [benefício principal]. Diferente de [concorrente/alternativa], [Produto] [diferenciador-chave].

**Fontes para posicionamento:**
- Headline e subtítulo da homepage
- Descrição do produto em marketplaces (G2, Capterra, AppSumo)
- Materiais de pitch de vendas (às vezes vazados ou compartilhados por prospects)
- Materiais de briefing para analistas
- Linguagem em comunicados de imprensa e press releases

### Análise da Arquitetura de Mensagem

Como cada concorrente comunica valor?

- **Nível 1 — Categoria**: Que categoria eles reivindicam? (TMS, CRM logístico, plataforma de frete, ERP de transporte)
- **Nível 2 — Diferenciador**: O que os diferencia dentro dessa categoria? (IA nativa, tudo-em-um, foco em compliance, integração SEFAZ)
- **Nível 3 — Proposta de Valor**: Que resultado eles prometem? (Reduzir custo de frete, eliminar retrabalho operacional, fechar mais cotações)
- **Nível 4 — Provas**: Que evidências fornecem? (Logos de clientes, métricas, prêmios, cases de transportadoras)

### Lacunas e Oportunidades de Posicionamento

Procure por:
- **Posições não reivindicadas**: Propostas de valor que nenhum concorrente possui e que importam para compradores — ex: "único TMS com IA de compliance ANTT integrada"
- **Posições saturadas**: Claims que todos os concorrentes fazem e que perderam significado — ex: "fácil de usar", "economize tempo"
- **Posições emergentes**: Novas propostas de valor impulsionadas por mudanças de mercado — ex: IA generativa em operações, piso mínimo ANTT, integração com marketplaces de frete
- **Posições vulneráveis**: Claims que concorrentes fazem mas não conseguem entregar plenamente — ex: "gestão financeira completa" sem rateio de custos ou reconciliação

---

## 4. Metodologia de Análise Win/Loss

### Conduzindo Análise Win/Loss

A análise win/loss revela por que você realmente ganha e perde negócios. É a inteligência competitiva mais acionável.

**Fontes de dados disponíveis no projeto:**
- Tabela `quotes` com `stage` — rastreie conversões de cotação para OS
- Tabela `quotes` com `tags` — adicione tags como `lost-to-[concorrente]`, `won-vs-[concorrente]`
- Campo `notes` em `quotes` — registre razões de perda/ganho
- Entrevistas com clientes após decisão (mais valiosas, menos tendenciosas)
- Pesquisas com prospects perdidos

### Perguntas para Entrevista Win/Loss

**Para vitórias:**
- Que problema você estava tentando resolver?
- Quais alternativas você avaliou? (Revela o conjunto competitivo real)
- Por que nos escolheu em vez das alternativas?
- O que quase te fez escolher outra opção?
- O que precisaria mudar para você reconsiderar?

**Para perdas:**
- Que problema você estava tentando resolver?
- O que você acabou escolhendo? Por quê?
- Onde nosso produto ficou aquém?
- O que poderíamos ter feito diferente?
- Você nos reconsideraria no futuro? Em que condições?

### Analisando Dados Win/Loss

- Acompanhe razões de win/loss ao longo do tempo. Os padrões estão mudando?
- Segmente por tipo de negócio: transportadora vs embarcador, pequeno vs médio porte, região geográfica
- Identifique os 3-5 principais motivos de vitórias e perdas
- Distinga entre razões de produto (funcionalidades, qualidade) e razões não-produto (preço, marca, relacionamento, timing)
- Calcule taxas de vitória competitiva por concorrente: em que % dos negócios envolvendo cada concorrente você vence?

### Padrões Comuns de Win/Loss no Mercado de TMS

- **Lacuna de funcionalidade**: Concorrente tem uma capacidade específica que você não tem e que é decisiva (ex: integração nativa com SEFAZ, emissão de CTe)
- **Vantagem de integração**: Concorrente se integra com ferramentas que o comprador já usa (ERP, sistema de rastreamento)
- **Estrutura de precificação**: Nem sempre mais barato — às vezes um modelo diferente (por usuário vs por OS) se encaixa melhor
- **Vantagem do incumbente**: Comprador fica com o que tem porque o custo de troca é alto
- **Execução comercial**: Demo melhor, resposta mais rápida, cases mais relevantes do setor
- **Marca/confiança**: Comprador escolhe a opção mais segura ou mais conhecida

---

## 5. Identificação de Tendências de Mercado

### Fontes para Identificação de Tendências no Setor de Transporte Brasileiro

- **Regulatório**: ANTT (piso mínimo de frete, RNTRC), SEFAZ (CTe 4.0, NF-e, MDF-e), LGPD
- **Tecnologia**: IA generativa em operações logísticas, IoT em rastreamento, blockchain para documentos fiscais
- **Mercado**: Consolidação de logtechs brasileiras, entrada de players internacionais (Uber Freight, Convoy)
- **Comportamento do cliente**: Transportadoras migrando de planilhas para sistemas, embarcadores exigindo visibilidade em tempo real
- **Capital de risco**: O que VCs brasileiros estão financiando em logtech? (Sinaliza onde o dinheiro inteligente vê oportunidade)
- **Eventos do setor**: NTC&Logística, Intermodal, Fenatran — quais temas dominam?
- **Movimentação de talentos**: Para onde vão os melhores profissionais de produto e engenharia em logtech?

### Framework de Análise de Tendências

Para cada tendência identificada:

1. **O que está mudando?**: Descreva a tendência de forma clara e específica
2. **Por que agora?**: O que está impulsionando essa mudança? (Tecnologia, regulação, comportamento, economia)
3. **Quem é afetado?**: Quais segmentos de clientes ou categorias de mercado? (Transportadoras de carga seca? Embarcadores industriais? Carreteiros autônomos?)
4. **Qual é o prazo?**: Isso está acontecendo agora, em 1-2 anos ou em 3-5 anos?
5. **Qual é a implicação para nós?**: Como isso deve influenciar nossa estratégia de produto?
6. **O que os concorrentes estão fazendo?**: Como os concorrentes estão respondendo a essa tendência?

### Separando Sinal de Ruído

- **Sinais**: Tendências respaldadas por dados comportamentais, investimento crescente, ação regulatória ou demanda de clientes
- **Ruído**: Tendências respaldadas apenas por hype de mídia, buzz de conferência ou anúncios de concorrentes sem tração de clientes
- Teste tendências contra seus próprios dados de clientes: os SEUS clientes estão pedindo isso ou vivenciando essa mudança?
- Desconfie de ciclos de hype do "tema do ano". Muitas tendências que dominam a conversa do setor não afetam materialmente seus clientes por anos.

### Opções de Resposta Estratégica

Para cada tendência significativa:
- **Liderar**: Investir cedo e tentar definir a categoria ou abordagem. Alto risco, alta recompensa. Ex: ser o primeiro TMS com orquestração multi-agente de IA.
- **Seguir rápido**: Aguardar sinais iniciais de demanda de clientes, então mover rapidamente. Menor risco mas mais difícil de diferenciar.
- **Monitorar**: Acompanhar a tendência mas não investir ainda. Definir gatilhos para quando agir.
- **Ignorar**: Decidir explicitamente que essa tendência não é relevante para sua estratégia. Documentar o porquê.

A resposta correta depende de: sua posição competitiva, sua base de clientes, seus recursos e a velocidade com que a tendência está se movendo.

---

## Referências do Banco de Dados

Ao conduzir análise competitiva, use estas tabelas do Supabase para embasar com dados reais:

| Tabela | Uso na Análise Competitiva |
|:---|:---|
| `quotes` | Taxa de conversão, estágios perdidos, tags de concorrentes |
| `quotes.tags` | Adicionar tags `lost-to-X`, `won-vs-X` para rastrear win/loss |
| `quotes.notes` | Registrar razões de perda/ganho em campo livre |
| `clients` | Perfil dos clientes ganhos — segmento, porte, região |
| `regulatory_updates` | Tendências regulatórias que criam oportunidade/ameaça |
| `ai_insights` | Insights gerados pela IA sobre padrões operacionais e financeiros |
| `workflow_events` | Padrões de uso que revelam onde o produto entrega mais valor |

---

## Keywords

análise competitiva, concorrentes, TMS, CRM logístico, posicionamento, win/loss, matriz de funcionalidades, tendências de mercado, transporte rodoviário, logtech, benchmarking

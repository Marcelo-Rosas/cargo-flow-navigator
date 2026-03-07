---
name: feature-spec
description: Escreve documentos de requisitos de produto (PRDs) estruturados com declaração do problema, histórias de usuário, requisitos e métricas de sucesso. Use ao especificar uma nova funcionalidade, escrever um PRD, definir critérios de aceitação, priorizar requisitos ou documentar decisões de produto no contexto do Cargo Flow Navigator.
---

# Skill: Especificação de Funcionalidade (PRD) — Cargo Flow Navigator

Você é especialista em escrever documentos de requisitos de produto (PRDs) e especificações de funcionalidades para o mercado de **TMS (Transportation Management System) e CRM logístico** no Brasil. Você ajuda gerentes de produto a definir o que construir, por que, e como medir o sucesso, sempre com base no contexto real do **Cargo Flow Navigator**.

---

## Estrutura de um PRD

Um PRD bem estruturado segue este template:

### 1. Declaração do Problema
- Descreva o problema do usuário em 2-3 frases
- Quem vivencia este problema e com que frequência (ex: "analistas operacionais", "diariamente")
- Qual o custo de não resolver (dor do usuário, impacto no negócio, risco competitivo)
- Fundamente em evidências: pesquisa com usuários, dados de suporte, métricas do Supabase, feedback de clientes

### 2. Objetivos
- 3-5 resultados específicos e mensuráveis que a funcionalidade deve alcançar
- Cada objetivo deve responder: "Como saberemos que isso foi um sucesso?"
- Distinga entre objetivos de usuário (o que os usuários ganham) e de negócio (o que a Vectra Cargo ganha)
- Objetivos devem ser resultados, não saídas (ex: "reduzir o tempo de reconciliação de viagem em 50%" em vez de "construir um modal de reconciliação")

### 3. Não-Objetivos
- 3-5 coisas que a funcionalidade explicitamente NÃO fará
- Capacidades adjacentes que estão fora do escopo para esta versão
- Para cada não-objetivo, explique brevemente por que está fora do escopo (pouco impacto, muito complexo, iniciativa separada, prematuro)
- Não-objetivos previnem o *scope creep* durante a implementação e alinham expectativas com stakeholders

### 4. Histórias de Usuário

Escreva histórias de usuário no formato padrão: "Como um(a) [tipo de usuário], eu quero [capacidade] para que [benefício]"

**Diretrizes:**
- O tipo de usuário deve ser específico (ex: "analista financeiro", "gestor de frota", "cliente embarcador")
- A capacidade deve descrever o que eles querem realizar, não como
- O benefício deve explicar o "porquê" — que valor isso entrega
- Inclua casos de borda: estados de erro, estados vazios, condições limite
- Inclua diferentes tipos de usuário se a funcionalidade atender a múltiplas personas
- Ordene por prioridade — histórias mais importantes primeiro

**Exemplo (baseado no schema real):**
- "Como um **analista financeiro**, eu quero **ver um resumo das divergências entre cotação e OS** para que eu possa **identificar rapidamente perdas de margem antes do faturamento**."
- "Como um **gestor operacional**, eu quero **ser notificado quando uma viagem tiver todos os seus pagamentos de OS reconciliados** para que eu possa **liberar o pagamento final ao carreteiro com segurança**."
- "Como um **cliente embarcador**, eu quero **receber um link para o comprovante de entrega assinado assim que ele for anexado à OS** para que eu possa **ter visibilidade do fim do processo**."

### 5. Requisitos

**Obrigatório (P0)**: A funcionalidade não pode ser lançada sem isso. Representa a versão mínima viável. Pergunte: "Se cortarmos isso, a funcionalidade ainda resolve o problema principal?" Se não, é P0.

**Desejável (P1)**: Melhora significativamente a experiência, mas o caso de uso principal funciona sem. Frequentemente se tornam *fast follows* após o lançamento.

**Considerações Futuras (P2)**: Explicitamente fora do escopo da v1, mas queremos projetar de forma que os suporte mais tarde. Documentar isso previne decisões de arquitetura que os dificultem no futuro.

Para cada requisito:
- Escreva uma descrição clara e inequívoca do comportamento esperado
- Inclua critérios de aceitação (veja abaixo)
- Anote quaisquer considerações ou restrições técnicas
- Sinalize dependências de outras equipes ou sistemas

### 6. Métricas de Sucesso

Veja a seção de métricas de sucesso abaixo para orientação detalhada.

### 7. Questões Abertas
- Perguntas que precisam de respostas antes ou durante a implementação
- Marque cada uma com quem deve responder (engenharia, design, jurídico, dados, stakeholder)
- Distinga entre questões bloqueantes (devem ser respondidas antes de começar) e não-bloqueantes (podem ser resolvidas durante a implementação)

### 8. Considerações de Cronograma
- Prazos rígidos (compromissos contratuais, eventos, datas de conformidade)
- Dependências do trabalho ou lançamentos de outras equipes
- Faseamento sugerido se a funcionalidade for muito grande para um único lançamento

---

## Escrita de Histórias de Usuário

Boas histórias de usuário são:
- **Independentes**: Podem ser desenvolvidas e entregues por conta própria
- **Negociáveis**: Detalhes podem ser discutidos, a história não é um contrato
- **Valiosas**: Entregam valor ao usuário (não apenas à equipe)
- **Estimáveis**: A equipe pode estimar o esforço grosseiramente
- **Pequenas**: Podem ser concluídas em um sprint/iteração
- **Testáveis**: Há uma maneira clara de verificar se funciona

### Erros Comuns em Histórias de Usuário

- **Muito vago**: "Como um usuário, eu quero que o produto seja mais rápido" — o que especificamente deve ser mais rápido? A consulta na `v_trip_financial_details`? O carregamento do modal de OS?
- **Prescritivo da solução**: "Como um usuário, eu quero um menu suspenso" — descreva a necessidade, não o widget de UI
- **Sem benefício**: "Como um usuário, eu quero clicar em um botão" — por quê? O que isso realiza?
- **Muito grande**: "Como um usuário, eu quero gerenciar minha equipe" — quebre isso em capacidades específicas (convidar usuário, definir papéis, remover usuário)
- **Foco interno**: "Como a equipe de engenharia, queremos refatorar o banco de dados" — isso é uma tarefa, não uma história de usuário

---

## Categorização de Requisitos

### Framework MoSCoW

- **Must have (Obrigatório)**: Sem isso, a funcionalidade não é viável. Inegociável.
- **Should have (Deveria ter)**: Importante, mas não crítico para o lançamento. *Fast follows* de alta prioridade.
- **Could have (Poderia ter)**: Desejável se o tempo permitir. Não atrasará a entrega se for cortado.
- **Won't have (Não terá - desta vez)**: Explicitamente fora do escopo. Pode ser revisitado em versões futuras.

### Dicas para Categorização

- Seja implacável com os P0s. Quanto mais enxuta a lista de obrigatórios, mais rápido você lança e aprende.
- Se tudo é P0, nada é P0. Desafie cada obrigatório: "Nós realmente não lançaríamos sem isso?"
- P1s devem ser coisas que você tem confiança que construirá em breve, não uma lista de desejos.
- P2s são um seguro de arquitetura — eles guiam decisões de design mesmo que você não os esteja construindo agora.

---

## Definição de Métricas de Sucesso

### Indicadores Antecedentes (Leading Indicators)

Métricas que mudam rapidamente após o lançamento (dias a semanas):

- **Taxa de adoção**: % de usuários elegíveis que experimentam a funcionalidade (ex: % de analistas financeiros que abrem o modal `v_quote_order_divergence`)
- **Taxa de ativação**: % de usuários que completam a ação principal (ex: % de cotações que têm o `pricing_breakdown` recalculado com a nova regra)
- **Taxa de conclusão de tarefa**: % de usuários que realizam com sucesso seu objetivo (ex: % de viagens que atingem o status `reconciled` na `v_trip_payment_reconciliation`)
- **Tempo para concluir**: Quanto tempo leva o fluxo principal (ex: tempo médio entre `trip.status_operational = 'finalizada'` e `trip.financial_status = 'reconciliado'`)
- **Taxa de erro**: Com que frequência os usuários encontram erros ou becos sem saída (ex: falhas na chamada da Edge Function `reconcile-trip`)
- **Frequência de uso da funcionalidade**: Com que frequência os usuários retornam para usar a funcionalidade (ex: visualizações diárias da `v_cash_flow_summary`)

### Indicadores Consequentes (Lagging Indicators)

Métricas que levam tempo para se desenvolver (semanas a meses):

- **Impacto na retenção**: Esta funcionalidade melhora a retenção de usuários? (ex: clientes que usam a reconciliação automática têm menor churn?)
- **Impacto na receita**: Isso impulsiona upgrades, expansão ou nova receita? (ex: a funcionalidade de rateio de custos justifica um tier de preço mais alto?)
- **Mudança no NPS / satisfação**: Isso melhora como os usuários se sentem sobre o produto?
- **Redução de tickets de suporte**: Isso reduz a carga de suporte? (ex: menos perguntas sobre como calcular a margem da viagem)
- **Taxa de vitória competitiva**: Isso ajuda a ganhar mais negócios? (ex: a funcionalidade de compliance ANTT se torna um diferencial em demos?)

### Definindo Metas

- As metas devem ser específicas: "Adoção de 50% em 30 dias" em vez de "alta adoção"
- Baseie as metas em funcionalidades comparáveis, benchmarks do setor ou hipóteses explícitas
- Defina um limite de "sucesso" e uma meta "esticada" (*stretch goal*)
- Defina o método de medição: qual ferramenta, qual query SQL, qual janela de tempo
- Especifique quando você avaliará: 1 semana, 1 mês, 1 trimestre após o lançamento

---

## Critérios de Aceitação

Escreva critérios de aceitação no formato Given/When/Then ou como uma checklist:

**Given/When/Then**:
- **Dado** [pré-condição ou contexto]
- **Quando** [ação que o usuário realiza]
- **Então** [resultado esperado]

**Exemplo (baseado no schema real):**
- **Dado** que uma viagem (`trips`) tem 3 ordens de serviço (`trip_orders`) e um custo de R$300 com `scope = 'TRIP'`
- **Quando** a chave de rateio (`apportion_key`) for 'equal'
- **Então** cada ordem de serviço deve ter um `trip_cost_item` de R$100 atribuído a ela

**Formato de Checklist**:
- [ ] O administrador pode definir a `apportion_key` padrão nas configurações (`pricing_parameters`)
- [ ] Ao adicionar uma OS a uma viagem, o `apportion_factor` é calculado automaticamente
- [ ] A view `v_trip_financial_summary` reflete a soma dos custos rateados e diretos
- [ ] A exclusão de uma OS de uma viagem aciona o recálculo do rateio para as OS restantes
- [ ] Uma tentativa de fechar uma viagem com custos não rateados exibe uma mensagem de erro clara

### Dicas para Critérios de Aceitação

- Cubra o caminho feliz, casos de erro e casos de borda
- Seja específico sobre o comportamento esperado, não sobre a implementação
- Inclua o que NÃO deve acontecer (casos de teste negativos)
- Cada critério deve ser testável de forma independente
- Evite palavras ambíguas: "rápido", "amigável", "intuitivo" — defina o que significam concretamente

---

## Gerenciamento de Escopo

### Reconhecendo o *Scope Creep*

O *scope creep* (aumento de escopo) acontece quando:
- Requisitos continuam sendo adicionados após a aprovação da especificação
- Adições "pequenas" se acumulam em um projeto significativamente maior
- A equipe está construindo funcionalidades que nenhum usuário pediu ("já que estamos mexendo nisso...")
- A data de lançamento continua se movendo sem re-escopo explícito
- Stakeholders adicionam requisitos sem remover nada

### Prevenindo o *Scope Creep*

- Escreva não-objetivos explícitos em cada especificação
- Exija que qualquer adição de escopo venha com uma remoção de escopo ou extensão de prazo
- Separe "v1" de "v2" claramente na especificação
- Revise a especificação contra a declaração do problema original — tudo serve a ela?
- Limite o tempo de investigações: "Se não conseguirmos descobrir X em 2 dias, cortamos"
- Crie um "estacionamento" (*parking lot*) para boas ideias que estão fora do escopo

---

## Keywords

PRD, especificação de funcionalidade, requisitos de produto, histórias de usuário, critérios de aceitação, métricas de sucesso, MoSCoW, gerenciamento de escopo, TMS, CRM logístico

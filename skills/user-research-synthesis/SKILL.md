---
name: user-research-synthesis
description: Sintetiza pesquisa de usuário qualitativa e quantitativa em insights estruturados e áreas de oportunidade. Use ao analisar notas de entrevista, respostas de pesquisa, tickets de suporte ou dados comportamentais para identificar temas, construir personas ou priorizar oportunidades.
---

# Skill: Síntese de Pesquisa de Usuário — Cargo Flow Navigator

Você é especialista em sintetizar pesquisa de usuário para o **Cargo Flow Navigator**, transformando dados brutos em insights estruturados que impulsionam decisões de produto. Você ajuda a equipe a extrair sentido das fontes de dados reais do projeto.

---

## Fontes de Dados de Usuário no Cargo Flow Navigator

| Fonte de Dados | Tipo | O que podemos aprender? |
|:---|:---|:---|
| Tabela `quotes` | Quantitativo | Padrões de precificação, taxa de conversão (ganho/perdido), tipos de carga e frete mais comuns, sazonalidade. |
| Tabela `orders` | Quantitativo | Estágios onde as OS mais demoram, uso de motoristas, placas de veículos mais frequentes. |
| Tabela `occurrences` | Qualitativo | Principais problemas operacionais (atrasos, avarias), severidade e frequência das ocorrências. |
| Tabela `ai_insights` | Qualitativo | Análises de risco, sugestões de preço e pareceres de viabilidade gerados pela IA. |
| Campo `notes` em `quotes` e `orders` | Qualitativo | Contexto específico da negociação, pedidos do cliente, informações não estruturadas. |
| Tickets de Suporte / E-mails | Qualitativo | Dúvidas, bugs reportados, frustrações e solicitações de funcionalidades dos usuários. |

---

## Metodologia de Síntese Adaptada

### 1. Análise Temática (para dados qualitativos)

Use este método para analisar os campos `notes`, `occurrences.description` e tickets de suporte.

1.  **Familiarização**: Leia uma amostra de 20-30 notas e ocorrências para ter uma ideia geral.
2.  **Codificação Inicial**: Crie tags descritivas. Ex: `[dificuldade_preco]`, `[pedido_prazo_apertado]`, `[atraso_na_coleta]`, `[documentacao_faltante]`, `[cliente_reclamou_valor]`.
3.  **Desenvolvimento de Temas**: Agrupe os códigos. `[dificuldade_preco]` e `[cliente_reclamou_valor]` podem virar o tema **"Sensibilidade ao Preço"**.
4.  **Refinamento e Relatório**: Defina cada tema e quantifique sua frequência. "O tema 'Atraso na Coleta' apareceu em 15% das ocorrências de criticidade 'alta' no último mês".

### 2. Triangulação (para fortalecer os achados)

Combine múltiplas fontes para validar uma hipótese.

- **Hipótese**: "Estamos perdendo cotações de frete fracionado por preço".
- **Triangulação**:
    - **Dado 1 (Quantitativo)**: A taxa de conversão para `freight_modality = 'fracionado'` é 20% menor que para `'lotacao'` (tabela `quotes`).
    - **Dado 2 (Qualitativo)**: O tema `[preco_alto_fracionado]` é frequente no campo `notes` das cotações perdidas.
    - **Dado 3 (Externo)**: Uma análise competitiva (skill `competitive-analysis`) mostra que nossos concorrentes X e Y têm tabelas de preço mais agressivas para cargas pequenas.

**Conclusão Forte**: A combinação dos três pontos valida a hipótese com alta confiança.

---

## Personas Baseadas em Comportamento (e não em demografia)

Com base nos dados do Supabase, podemos identificar três personas comportamentais principais dentro do Cargo Flow Navigator.

### 1. O Analista Comercial ("O Fechador")

- **Comportamento**: Focado no funil de cotações (`quotes`). Cria muitas cotações, move-as rapidamente entre os estágios `precificacao` -> `enviado` -> `negociacao`. Usa muito o campo `notes` para registrar interações com o cliente. É sensível à taxa de conversão `ganho`/`perdido`.
- **Objetivos**: Fechar mais negócios, responder rapidamente ao cliente, ter flexibilidade para negociar preços.
- **Dores**: Processo de precificação lento, dificuldade em justificar o preço para o cliente, falta de visibilidade sobre a rentabilidade real da cotação.
- **O que valoriza**: Agilidade, informação de mercado para negociação, alertas sobre cotações paradas.

### 2. O Gestor Operacional ("O Resolvedor")

- **Comportamento**: Vive no painel de Ordens de Serviço (`orders`). Focado nos estágios `documentacao`, `coleta_realizada`, `em_transito`. Lida com a tabela `occurrences` e é responsável por resolver problemas (atrasos, avarias).
- **Objetivos**: Garantir que a operação flua sem problemas, que os prazos sejam cumpridos e que os clientes fiquem satisfeitos com a entrega.
- **Dores**: Falta de visibilidade sobre a localização do motorista, documentação incompleta que atrasa a coleta, comunicação fragmentada com motoristas e clientes.
- **O que valoriza**: Visibilidade em tempo real, alertas proativos sobre problemas, automação de tarefas repetitivas (como checagem de documentos).

### 3. O Analista Financeiro ("O Auditor")

- **Comportamento**: Focado nas etapas finais do fluxo (`entregue`, `faturado`). Lida com as tabelas de `financial_documents`, `payment_proofs` e `trip_cost_items`. Seu trabalho é garantir que a receita e os custos estejam corretos e que a margem seja positiva.
- **Objetivos**: Garantir a precisão financeira, conciliar pagamentos e recebimentos, analisar a rentabilidade por viagem/cliente.
- **Dores**: Processo de reconciliação manual e demorado, divergências entre o valor cotado e o faturado, dificuldade em ratear custos de viagem entre múltiplas OS.
- **O que valoriza**: Precisão dos dados, automação da conciliação, dashboards de rentabilidade confiáveis.

---

## Keywords

pesquisa de usuário, síntese de pesquisa, análise temática, affinity mapping, personas, insights de usuário, dados qualitativos, dados quantitativos

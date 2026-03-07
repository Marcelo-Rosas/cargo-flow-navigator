---
name: skill-evaluator
description: Uma skill para analisar e avaliar o desempenho de outras skills no Cargo Flow Navigator, usando análise pós-hoc de comparações A/B e resultados de benchmarking para gerar insights e sugestões de melhoria.
---

# Skill: Avaliador de Skills (skill-evaluator)

Esta skill capacita o agente a atuar como um **Avaliador de Desempenho de Skills**, um papel crucial para a melhoria contínua do ecossistema de agentes do Cargo Flow Navigator. A função principal é analisar os resultados de execuções de skills, seja em um cenário de comparação A/B (análise pós-hoc) ou em um benchmark de performance, para extrair insights acionáveis.

## Papel

Como um Avaliador de Skills, seu objetivo é ir além das métricas de sucesso superficiais. Você deve investigar o *porquê* de um resultado, examinando os "cookbooks" (as `SKILL.md` das skills), os logs de execução (transcrições) e os dados de performance. O resultado do seu trabalho alimenta diretamente o "Squad de Fluxos" (Engenharia de Prompt) com sugestões concretas para refinar e otimizar as skills existentes.

Esta skill abrange dois cenários de análise principais:

1.  **Análise Pós-Hoc de Comparação**: Quando duas versões de uma skill (ou duas skills diferentes) são comparadas, e um vencedor é declarado, sua tarefa é "desvendar" a comparação para entender as razões da vitória e propor melhorias para a versão perdedora.
2.  **Análise de Resultados de Benchmark**: Ao analisar os resultados de múltiplos testes de uma única skill, seu foco é identificar padrões, anomalias e tendências de performance que não são aparentes em métricas agregadas.

## Cenário 1: Análise Pós-Hoc de Comparação

**Objetivo**: Analisar os resultados de uma comparação para entender por que o vencedor foi superior e gerar sugestões de melhoria para o perdedor.

### Entradas (Inputs)

Você receberá os seguintes parâmetros:

-   `comparison_id`: ID do teste de comparação.
-   `winner`: "A" ou "B", indicando o lado vencedor.
-   `winner_skill_path`: Caminho para a skill vencedora (ex: `skills/commercial/price-intelligence/SKILL.md`).
-   `winner_transcript_path`: Caminho para o log de execução do vencedor (ex: `tmp/runs/comp-123-winner.log`).
-   `loser_skill_path`: Caminho para a skill perdedora.
-   `loser_transcript_path`: Caminho para o log de execução do perdedor.
-   `comparison_result_path`: Caminho para o JSON com o resultado e a justificativa do comparador.
-   `output_path`: Onde salvar o JSON com a sua análise detalhada.

### Processo de Análise

#### Passo 1: Entender o Resultado da Comparação

1.  Leia o arquivo de resultado da comparação (`comparison_result_path`).
2.  Identifique o lado vencedor, a justificativa do comparador e quaisquer métricas ou pontuações utilizadas.
3.  Compreenda o que o comparador valorizou na saída vencedora. Foi a precisão, a velocidade, o formato da resposta?

#### Passo 2: Analisar os Cookbooks (SKILL.md)

1.  Leia a `SKILL.md` da skill vencedora e da perdedora.
2.  Identifique diferenças estruturais, como:
    *   Clareza e especificidade das instruções.
    *   Padrões de uso de ferramentas e scripts (`supabase/functions`).
    *   Qualidade e cobertura dos exemplos.
    *   Tratamento de casos de borda (edge cases).

#### Passo 3: Analisar os Logs de Execução (Transcrições)

1.  Leia os logs de execução do vencedor e do perdedor.
2.  Compare os padrões de execução:
    *   Quão fielmente cada agente seguiu as instruções de sua respectiva skill?
    *   Quais ferramentas (`Edge Functions`) foram usadas de forma diferente?
    *   Onde o perdedor divergiu do comportamento ideal esperado?
    *   Algum dos agentes encontrou erros? Como tentou se recuperar?

#### Passo 4: Identificar Pontos Fortes do Vencedor

Determine o que tornou a skill vencedora melhor. Seja específico e cite trechos dos artefatos quando relevante.

-   Instruções mais claras que levaram a um comportamento mais eficaz?
-   Uso de `Edge Functions` mais adequadas que produziram um resultado superior?
-   Exemplos mais abrangentes que guiaram o agente em cenários complexos?

#### Passo 5: Identificar Fraquezas do Perdedor

Determine o que limitou o desempenho da skill perdedora.

-   Instruções ambíguas que levaram a escolhas subótimas?
-   Falta de ferramentas ou scripts que forçaram o agente a improvisar?
-   Lacunas na cobertura de casos de borda?

#### Passo 6: Gerar Sugestões de Melhoria

Com base na análise, produza sugestões **acionáveis** para melhorar a skill perdedora. Priorize pelo impacto esperado.

-   Mudanças específicas nas instruções (ex: "Substituir 'processe o documento' por '1. Extraia o texto, 2. Identifique as seções, 3. Formate conforme o template X'").
-   Adição ou modificação de scripts/ferramentas (ex: "Criar uma nova Edge Function para validar o formato do CNPJ").
-   Exemplos a serem incluídos para cobrir novos cenários.

#### Passo 7: Escrever o Resultado da Análise

Salve a análise estruturada no caminho de saída (`output_path`) em formato JSON, conforme o esquema definido em `references/post_hoc_analysis_schema.json`.

## Cenário 2: Análise de Resultados de Benchmark

**Objetivo**: Analisar os resultados de múltiplos testes de uma skill para identificar padrões e anomalias que não são visíveis em métricas agregadas.

### Entradas (Inputs)

-   `benchmark_data_path`: Caminho para o arquivo JSON com os resultados de todas as execuções do benchmark.
-   `skill_path`: Caminho para a skill que foi benchmarked.
-   `output_path`: Onde salvar as notas de análise (como um JSON array de strings).

### Processo de Análise

#### Passo 1: Analisar Padrões por Asserção

Para cada expectativa (asserção) testada nos benchmarks:

-   Sempre passa? (Pode não estar diferenciando o valor da skill).
-   Sempre falha? (Pode estar quebrada ou além da capacidade atual).
-   Passa com a skill, mas falha sem ela? (Evidência clara do valor da skill).
-   É altamente variável? (Pode indicar instabilidade ou comportamento não determinístico).

#### Passo 2: Analisar Padrões de Métricas

Analise as métricas de `tempo_execucao`, `tokens_usados`, `chamadas_de_ferramentas`:

-   A skill aumenta significativamente o tempo de execução ou o custo (tokens)?
-   Existe uma alta variância no uso de recursos entre as execuções?
-   Há execuções "outlier" que distorcem as médias?

#### Passo 3: Gerar Notas de Análise

Escreva observações em formato livre como uma lista de strings. Cada nota deve ser uma observação específica e baseada em dados.

**Exemplos de Notas:**

-   "A asserção 'Formato do CTe' passa em 100% dos casos com e sem a skill, indicando que não é um bom diferenciador de valor."
-   "O uso da skill 'ai-compliance-check-worker' adiciona em média 8 segundos ao tempo de execução, mas aumenta a taxa de aprovação em 40%."
-   "O consumo de tokens é 75% maior com a skill, principalmente devido à análise de documentos PDF."

#### Passo 4: Escrever as Notas

Salve as notas no caminho de saída (`output_path`) como um JSON array de strings.

## Diretrizes Gerais

-   **Seja Específico**: Cite trechos dos logs, `SKILL.md` ou `Edge Functions`. Não diga apenas "as instruções eram confusas".
-   **Seja Acionável**: As sugestões devem ser mudanças concretas, não conselhos vagos.
-   **Foque na Melhoria da Skill**: O objetivo é melhorar a skill, não criticar o agente.
-   **Pense em Generalização**: Uma melhoria ajudaria em outras avaliações também?

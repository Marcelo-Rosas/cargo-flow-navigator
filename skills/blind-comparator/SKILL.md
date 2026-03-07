---
name: blind-comparator
description: Uma skill para comparar duas saídas de forma cega (sem saber qual skill as produziu) e determinar qual delas melhor cumpre uma tarefa de avaliação no contexto do Cargo Flow Navigator.
---

# Skill: Comparador Cego (blind-comparator)

Esta skill capacita o agente a atuar como um **Comparador Cego**, um juiz imparcial que avalia qual de duas saídas (A ou B) melhor executa uma tarefa específica. O ponto central é que você **não sabe** qual skill ou agente produziu cada saída, o que previne qualquer viés e garante que o julgamento seja baseado puramente na qualidade do resultado final.

## Papel

Seu papel é julgar qual saída, A ou B, melhor atende aos requisitos da tarefa de avaliação (`eval_prompt`). Sua decisão deve ser fundamentada em uma análise objetiva, utilizando uma rubrica de avaliação que você mesmo irá gerar com base na tarefa. O foco é a qualidade do resultado e o cumprimento dos objetivos, independentemente do método de geração.

## Entradas (Inputs)

Você receberá os seguintes parâmetros:

-   `output_a_path`: Caminho para o primeiro arquivo ou diretório de saída.
-   `output_b_path`: Caminho para o segundo arquivo ou diretório de saída.
-   `eval_prompt`: A tarefa/prompt original que foi executada para gerar as saídas.
-   `expectations`: Uma lista opcional de asserções a serem verificadas.
-   `output_path`: Onde salvar o JSON com o resultado da comparação.

## Processo de Comparação

### Passo 1: Entender a Tarefa

1.  Leia atentamente o `eval_prompt`.
2.  Identifique os requisitos essenciais da tarefa:
    *   Qual artefato deveria ser produzido? (ex: um CTe em PDF, um JSON com dados financeiros, um relatório em Markdown).
    *   Quais qualidades são mais importantes? (ex: precisão dos cálculos, completude dos dados, formatação correta).
    *   O que distinguiria uma saída excelente de uma medíocre neste contexto?

### Passo 2: Gerar a Rubrica de Avaliação

Com base na tarefa, gere uma rubrica com critérios específicos. A rubrica deve ter duas dimensões principais: **Conteúdo** e **Estrutura**. Adapte os critérios ao contexto do `cargo-flow-navigator`.

Consulte `references/rubric_examples.md` para exemplos de rubricas aplicadas a tarefas comuns do projeto, como a geração de um CTe ou a análise de rentabilidade de uma cotação.

**Exemplo de Critérios para a Geração de um CTe:**

| Dimensão | Critério | 1 (Ruim) | 3 (Aceitável) | 5 (Excelente) |
|:---|:---|:---|:---|:---|
| **Conteúdo** | `correcao_fiscal` | Erros graves de cálculo de impostos | Pequenos desvios nos impostos | Cálculos fiscais 100% corretos |
| | `completude_dados` | Faltam campos obrigatórios (ex: CNPJ do tomador) | Todos os campos obrigatórios, mas faltam opcionais | Todos os campos relevantes preenchidos |
| **Estrutura** | `formato_pdf` | PDF mal formatado, ilegível | PDF legível, mas com desalinhamentos | PDF profissional e bem organizado |
| | `schema_dados` | Estrutura do JSON de origem incorreta | Schema JSON válido, mas com tipos de dados mistos | Schema JSON estritamente aderente |

### Passo 3: Avaliar Cada Saída com a Rubrica

Para cada saída (A e B):

1.  **Pontue cada critério** na rubrica (escala de 1 a 5).
2.  **Calcule os totais** por dimensão (Pontuação de Conteúdo, Pontuação de Estrutura).
3.  **Calcule a pontuação geral**: Média das pontuações das dimensões, escalada de 1 a 10.

### Passo 4: Verificar Asserções (se fornecidas)

Se a lista de `expectations` foi fornecida:

1.  Verifique cada asserção para a saída A e para a saída B.
2.  Calcule a taxa de aprovação (`pass_rate`) para cada uma.
3.  Use os resultados das asserções como uma evidência **secundária**. A decisão principal deve vir da rubrica.

### Passo 5: Determinar o Vencedor

Compare A e B com base na seguinte ordem de prioridade:

1.  **Primário**: Pontuação geral da rubrica.
2.  **Secundário**: Taxa de aprovação das asserções.
3.  **Desempate**: Se as saídas forem verdadeiramente equivalentes, declare um `TIE`. Empates devem ser raros.

### Passo 6: Escrever o Resultado da Comparação

Salve os resultados em um arquivo JSON no caminho especificado (`output_path`), seguindo o schema definido em `references/comparison_schema.json`.

## Diretrizes Gerais

-   **Mantenha-se Cego**: Não tente adivinhar qual skill gerou qual saída. Julgue apenas a qualidade do resultado.
-   **Seja Decisivo**: Escolha um vencedor, a menos que as saídas sejam funcionalmente idênticas.
-   **Qualidade em Primeiro Lugar**: A pontuação da rubrica é mais importante que a taxa de aprovação das asserções.
-   **Justifique sua Decisão**: O campo `reasoning` deve deixar claro por que você escolheu o vencedor, citando exemplos específicos das saídas.
-   **Lide com Falhas**: Se ambas as saídas falharem, escolha a que falhou "menos". Se ambas forem excelentes, escolha a que for marginalmente superior.

# Exemplos de Rubricas para o Cargo Flow Navigator

Use estes exemplos como ponto de partida para criar rubricas de avaliação específicas para as tarefas do projeto. Lembre-se de adaptar os critérios ao `eval_prompt` de cada comparação.

## Exemplo 1: Geração de Cotação de Frete (Saída: JSON)

**`eval_prompt`**: "Gerar uma cotação de frete em JSON para a rota de São Paulo/SP para Curitiba/PR, com 1000kg, valor de R$50.000. A saída deve incluir o valor final do frete, impostos detalhados e a margem de lucro."

| Dimensão | Critério | 1 (Ruim) | 3 (Aceitável) | 5 (Excelente) |
|:---|:---|:---|:---|:---|
| **Conteúdo** | `precisao_calculo` | Erros grosseiros no frete ou impostos | Pequenos desvios (<2%) no valor final | Cálculos precisos e corretos |
| | `completude_dados` | Faltam campos chave (ex: margem) | Inclui frete e impostos, mas sem detalhamento | Todos os campos solicitados presentes e detalhados |
| | `logica_negocio` | Ignora regras de negócio (ex: margem mínima) | Aplica a maioria das regras, mas com exceções | Lógica de negócio (margem, taxas) aplicada corretamente |
| **Estrutura** | `schema_json` | JSON inválido ou com estrutura quebrada | JSON válido, mas com nomes de campos inconsistentes | Schema JSON limpo, consistente e bem aninhado |
| | `tipos_dados` | Tipos de dados incorretos (ex: valor como string) | A maioria dos tipos está correta | Tipos de dados corretos para todos os campos (number, string, etc) |

## Exemplo 2: Análise de Compliance de Motorista (Saída: Markdown)

**`eval_prompt`**: "Analisar os documentos do motorista (CNH, ANTT) e gerar um relatório em Markdown indicando se ele está apto para a coleta. O relatório deve listar as pendências, se houver."

| Dimensão | Critério | 1 (Ruim) | 3 (Aceitável) | 5 (Excelente) |
|:---|:---|:---|:---|:---|
| **Conteúdo** | `acuracia_analise` | Conclusão incorreta (apto vs. inapto) | Identifica a maioria das pendências, mas omite uma | Análise 100% correta, todas as pendências listadas |
| | `clareza_pendencias` | Lista de pendências vaga ou inexistente | Pendências listadas, mas sem detalhes de como resolver | Pendências claras, acionáveis e com contexto |
| **Estrutura** | `formatacao_md` | Markdown quebrado ou mal formatado | Markdown legível, mas com formatação inconsistente | Relatório bem estruturado com cabeçalhos e listas |
| | `organizacao` | Informação desorganizada e difícil de seguir | Conclusão e pendências apresentadas, mas sem ordem lógica | Estrutura clara: 1. Veredito, 2. Evidências, 3. Pendências |

## Exemplo 3: Geração de Documento CTe (Saída: PDF e XML)

**`eval_prompt`**: "Gerar o CTe em formato PDF e XML para a ordem de serviço OS-123. O PDF deve ser visualmente claro e o XML deve ser válido para a SEFAZ."

| Dimensão | Critério | 1 (Ruim) | 3 (Aceitável) | 5 (Excelente) |
|:---|:---|:---|:---|:---|
| **Conteúdo** | `validade_xml` | XML inválido, rejeitado pela SEFAZ | XML válido, mas com warnings ou campos opcionais faltando | XML 100% válido e completo |
| | `consistencia_dados` | Dados no PDF e XML são diferentes | Pequenas divergências entre PDF e XML | Dados perfeitamente consistentes entre os dois arquivos |
| **Estrutura** | `layout_pdf` | PDF ilegível, com texto sobreposto ou cortado | PDF legível, mas com layout desalinhado | Layout do PDF profissional, claro e bem organizado |
| | `entrega_arquivos` | Apenas um dos arquivos (PDF ou XML) foi gerado | Ambos os arquivos gerados, mas com nomes confusos | Ambos os arquivos gerados em um diretório nomeado corretamente |

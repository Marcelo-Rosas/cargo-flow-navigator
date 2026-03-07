# Diretrizes para Feedback de Avaliação (Eval Feedback)

O objetivo do feedback de avaliação é fortalecer os testes, tornando-os mais **discriminatórios**: eles devem passar quando a tarefa é genuinamente bem-sucedida e falhar quando não é. Mantenha um padrão elevado para as sugestões. O ideal é que o autor da avaliação pense "boa observação!" ao ler seu feedback.

## Quando Fornecer Feedback

Concentre-se em lacunas claras e significativas. Não é necessário criticar cada asserção.

**Cenários que justificam uma sugestão:**

1.  **Falso Positivo (Superficialidade)**: A asserção passou, mas passaria também para uma saída claramente errada. O teste verifica a forma, mas não a substância.
    -   *Exemplo Ruim*: A asserção verifica se `cte.pdf` existe.
    -   *Sugestão de Melhoria*: "A asserção `O arquivo cte.pdf existe` é superficial. Considere adicionar uma verificação de que o PDF contém o CNPJ correto do destinatário, extraído do `eval_prompt`."

2.  **Lacuna de Cobertura**: Um resultado importante (bom ou ruim) foi observado, mas nenhuma asserção o cobre.
    -   *Exemplo*: Você nota que, embora o valor do frete esteja correto, a margem de lucro calculada foi negativa, mas nenhuma asserção verificava a lucratividade.
    -   *Sugestão de Melhoria*: "Nenhuma asserção verifica a margem de lucro. Observei que a saída B, embora com cálculos corretos, apresentou uma margem negativa de -5%, o que deveria ser um critério de falha."

3.  **Asserção Não Verificável**: A asserção testa algo que não pode ser confirmado (ou refutado) com as informações disponíveis no log ou nas saídas.
    -   *Exemplo*: A asserção é "O agente considerou o histórico de fretes do cliente", mas essa informação não está presente em nenhum log ou saída.
    -   *Sugestão de Melhoria*: "A asserção `O agente considerou o histórico de fretes` não é verificável. O log não fornece evidências sobre quais dados históricos foram consultados."

## Como Estruturar o Feedback

-   **Seja Concreto**: Aponte a asserção específica (se aplicável) e explique claramente a falha.
-   **Proponha uma Solução**: Não aponte apenas o problema, sugira como a asserção poderia ser melhorada.
-   **Foque no Impacto**: Explique por que a sua sugestão tornaria o teste mais robusto.

No campo `overall` do feedback, forneça uma avaliação geral. Se não houver sugestões, um simples "As asserções parecem sólidas e cobrem bem os resultados esperados" é suficiente.

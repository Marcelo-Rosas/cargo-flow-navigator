# Diretrizes para Sugestões de Melhoria

Ao gerar sugestões de melhoria para uma skill, utilize as seguintes categorias e níveis de prioridade para garantir que o feedback seja claro, estruturado e acionável para o Squad de Fluxos.

## Categorias para Sugestões

Use estas categorias para organizar as sugestões de melhoria. Cada sugestão deve ser classificada em uma das seguintes categorias para facilitar a triagem e a implementação.

| Categoria | Descrição |
|:--- |:--- |
| `instructions` | Mudanças no texto e nas instruções da `SKILL.md`. Refere-se à clareza, especificidade e ao fluxo lógico apresentado ao agente. |
| `tools` | Adição, modificação ou remoção de ferramentas, principalmente `Edge Functions` (`supabase/functions`), scripts ou templates. |
| `examples` | Exemplos de entrada/saída a serem incluídos na `SKILL.md` para cobrir novos cenários, casos de borda ou para clarificar o comportamento esperado. |
| `error_handling` | Instruções específicas sobre como o agente deve lidar com falhas, erros de API, ou resultados inesperados. |
| `structure` | Reorganização do conteúdo da skill, como mover seções, dividir a `SKILL.md` em arquivos de referência (`references/`) para melhor clareza. |
| `references` | Adição ou atualização de documentos externos, documentação de API, ou outros recursos que devem ser referenciados pela skill. |

## Níveis de Prioridade

Cada sugestão deve ter um nível de prioridade para ajudar o time a focar nos itens de maior impacto primeiro.

-   **high**: A mudança provavelmente alteraria o resultado da comparação ou resolveria uma falha crítica. Tem impacto direto e significativo na performance da skill.
-   **medium**: A mudança melhoraria a qualidade ou a eficiência da skill, mas pode não ser suficiente para alterar o resultado de uma comparação ganha/perdida. Agrega valor, mas não é crítica.
-   **low**: Uma melhoria "nice-to-have". Representa um refinamento ou uma otimização de baixo impacto, como melhorias textuais menores ou formatação.

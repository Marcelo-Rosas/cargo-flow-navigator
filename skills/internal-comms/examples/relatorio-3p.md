# Diretriz: Relatório 3P (Progresso, Planos, Problemas)

## Instruções

Você foi solicitado a escrever uma atualização 3P. 3P significa "Progresso, Planos, Problemas". O público principal são executivos, liderança e outros membros da equipe. O objetivo é que sejam muito sucintos e diretos: algo que possa ser lido em 30-60 segundos ou menos. Eles também são para pessoas com algum, mas não muito, contexto sobre o que a equipe faz.

Os 3Ps representam o trabalho da equipe durante um período, quase sempre uma semana. Eles incluem três seções:

1.  **Progresso**: O que a equipe realizou no último período. Foque principalmente em funcionalidades entregues, marcos alcançados, PRs mergeados, etc.
2.  **Planos**: O que a equipe planeja fazer no próximo período. Foque no que é prioridade máxima para a equipe.
3.  **Problemas**: Qualquer coisa que esteja atrasando a equipe. Isso pode incluir débitos técnicos, bugs bloqueadores, dependências externas ou decisões que precisam ser tomadas.

Antes de escrever, certifique-se de saber o nome da equipe (ex: "Squad de Fluxos", "Equipe de Frontend"). Se não for especificado, pergunte explicitamente.

## Fontes de Informação Disponíveis

Sempre que possível, tente extrair informações das fontes disponíveis no projeto para obter os dados necessários:

| Fonte | Como Usar para o 3P |
| :--- | :--- |
| **GitHub** | **Progresso**: Analise o `git log` da última semana para commits e PRs mergeados. **Problemas**: Verifique Issues abertas com as tags `bug` ou `blocker`. **Planos**: Revise os PRs abertos e as Issues no backlog do sprint. |
| **Supabase Dashboard** | **Problemas**: Verifique os logs das Edge Functions em busca de picos de erros (status 5xx) ou anomalias de performance. **Progresso**: Monitore o aumento no uso de uma nova função após o lançamento. |
| **Vercel** | **Progresso**: Confirme os deploys bem-sucedidos em produção. **Problemas**: Investigue builds que falharam ou regressões de performance identificadas pelo Vercel. |
| **Documentos Internos** | **Planos**: Consulte os arquivos de planejamento em `.cursor/plans/` para entender as próximas grandes entregas. |

Se o acesso a essas ferramentas não for suficiente, peça ao usuário para fornecer os pontos que ele deseja cobrir.

## Fluxo de Trabalho

1.  **Esclarecer o escopo**: Confirme o nome da equipe e o período de tempo (geralmente a última semana para Progresso/Problemas, a próxima semana para Planos).
2.  **Coletar informações**: Use as ferramentas disponíveis (GitHub, Supabase, Vercel) ou peça diretamente ao usuário.
3.  **Elaborar a atualização**: Siga as diretrizes de formatação estritas abaixo.
4.  **Revisar**: Garanta que o texto seja conciso (leitura de 30-60 segundos) e orientado por dados.

## Formatação

O formato é sempre o mesmo e muito estrito. **Nunca use outro formato**. Escolha um emoji que seja divertido e capture a vibe da equipe e da atualização.

```markdown
[emoji] [Nome da Equipe] ([Datas Cobertas])

**Progresso**: [1-3 frases sobre o que foi concluído. Seja orientado por dados. Ex: "Finalizamos a refatoração do cálculo de frete (PR #123), reduzindo a latência da API em 25% e corrigindo 3 bugs de arredondamento."]

**Planos**: [1-3 frases sobre as próximas prioridades. Ex: "Nesta semana, vamos iniciar a implementação do fluxo de reconciliação de pagamentos da Trip e criar o ADR para a nova arquitetura de documentos."]

**Problemas**: [1-3 frases sobre os bloqueios. Ex: "Estamos bloqueados pela definição da API do parceiro de logística X e observamos um aumento de 15% nos erros 5xx da função `calculate-distance` desde o último deploy."]
```

Cada seção deve ter no máximo de 1 a 3 frases: claras e diretas. Deve ser orientada por dados e incluir métricas sempre que possível. O tom deve ser muito objetivo, sem excesso de prosa.

---
name: document-writer
description: Um processo estruturado em 3 estágios para a escrita colaborativa de documentos técnicos (especificações, ADRs, propostas) com um usuário, garantindo clareza, profundidade e alinhamento com o leitor.
---

# Skill: Escritor de Documentos (document-writer)

Esta skill implementa um fluxo de trabalho de escrita colaborativa para criar documentos técnicos de alta qualidade. O processo é dividido em três estágios principais para garantir que o documento final seja claro, completo e eficaz para seu público-alvo.

## Proposta do Fluxo de Trabalho

No início da interação, proponha o seguinte fluxo de trabalho de 3 estágios ao usuário:

1.  **Coleta de Contexto**: O usuário fornece todo o contexto relevante enquanto o agente faz perguntas para aprofundar o entendimento.
2.  **Refinamento e Estrutura**: O documento é construído seção por seção, de forma iterativa, com brainstorming e edições.
3.  **Teste de Leitura**: O documento final é testado com um novo agente (sem o contexto da conversa atual) para identificar pontos cegos antes de ser compartilhado.

Pergunte se o usuário deseja seguir este fluxo ou prefere uma escrita de formato livre. Se ele aceitar, prossiga para o Estágio 1.

## Estágio 1: Coleta de Contexto

**Objetivo**: Fechar a lacuna entre o que o usuário sabe e o que o agente sabe, permitindo uma orientação mais inteligente nas etapas posteriores.

### Perguntas Iniciais

Comece perguntando ao usuário o metacontexto sobre o documento:

1.  Qual é o tipo de documento? (ex: especificação técnica de uma Edge Function, documento de decisão de arquitetura (ADR), proposta de melhoria de um fluxo).
2.  Quem é o público principal?
3.  Qual é o impacto desejado quando alguém ler este documento?
4.  Existe um template ou formato específico a ser seguido (ex: um arquivo `.md` no repositório)?
5.  Há outras restrições ou contexto a serem considerados?

### Coleta de Informações

Incentive o usuário a fornecer todo o contexto que ele possui. Peça informações como:

-   Histórico do projeto/problema.
-   Discussões de equipe relacionadas ou documentos existentes no repositório.
-   Por que soluções alternativas não estão sendo consideradas.
-   Contexto organizacional (dinâmicas da equipe, incidentes passados).
-   Prazos ou restrições de tempo.
-   Arquitetura técnica ou dependências (ex: interações com `supabase/functions`).

**Durante a coleta de contexto:**

-   Se o usuário mencionar documentos ou código no repositório, use o `shell` com `gh` ou `cat` para lê-los.
-   Se o usuário mencionar entidades/projetos desconhecidos (ex: um novo serviço ou biblioteca), pergunte se deve usar a ferramenta de `search` para aprender mais.
-   À medida que o usuário fornece contexto, mantenha um registro mental do que foi aprendido e do que ainda não está claro.

### Perguntas de Esclarecimento

Quando o usuário sinalizar que terminou a coleta inicial, gere de 5 a 10 perguntas numeradas com base nas lacunas do contexto para garantir o entendimento.

**Condição de saída**: O contexto é suficiente quando as perguntas do agente demonstram entendimento dos detalhes e das nuances, em vez de apenas dos conceitos básicos.

**Transição**: Pergunte se há mais algum contexto a ser fornecido ou se é hora de passar para a elaboração do documento.

## Estágio 2: Refinamento e Estrutura

**Objetivo**: Construir o documento seção por seção através de brainstorming, curadoria e refinamento iterativo.

### Estrutura do Documento

-   **Se a estrutura estiver clara**: Pergunte ao usuário por qual seção ele gostaria de começar. Sugira começar pela seção com mais incertezas (geralmente a proposta principal ou a abordagem técnica).
-   **Se a estrutura não estiver clara**: Sugira de 3 a 5 seções apropriadas para o tipo de documento.

Uma vez que a estrutura esteja acordada, crie o arquivo `.md` inicial (ex: `adr-refatoracao-financeira.md`) com todas as seções como placeholders usando a ferramenta `file` (`write`).

### Para cada seção:

1.  **Perguntas de Esclarecimento**: Anuncie em qual seção o trabalho começará e faça de 5 a 10 perguntas específicas sobre o que deve ser incluído.
2.  **Brainstorming**: Gere de 5 a 20 opções numeradas de pontos que poderiam ser incluídos na seção.
3.  **Curadoria**: Peça ao usuário para indicar quais pontos manter, remover ou combinar, com breves justificativas.
4.  **Verificação de Lacunas**: Com base no que foi selecionado, pergunte se algo importante está faltando.
5.  **Elaboração**: Use a ferramenta `file` (`edit` com `find`/`replace`) para substituir o placeholder da seção pelo conteúdo elaborado.
6.  **Refinamento Iterativo**: À medida que o usuário fornece feedback, use `file` (`edit`) para fazer as edições. Continue iterando até que o usuário esteja satisfeito.

### Conclusão do Estágio

Quando todas as seções estiverem elaboradas, anuncie que o rascunho está completo e que você fará uma revisão final em busca de coerência, fluxo e redundâncias. Após a revisão, pergunte se está pronto para o Teste de Leitura.

## Estágio 3: Teste de Leitura

**Objetivo**: Verificar se o documento funciona para um leitor sem o contexto da conversa, usando um novo agente.

### Abordagem de Teste (Manual)

Explique ao usuário que, para garantir que o documento seja claro para qualquer pessoa, vocês farão um teste simulando um novo leitor. O usuário precisará realizar o teste manualmente.

1.  **Prever Perguntas do Leitor**: Gere de 5 a 10 perguntas que um leitor real faria ao tentar entender o documento.

2.  **Instruções para o Teste**: Peça ao usuário para seguir estes passos:
    1.  Iniciar uma **nova tarefa/conversa** com o Manus.
    2.  Anexar ou colar o conteúdo completo do documento recém-criado.
    3.  Fazer ao novo agente as perguntas geradas no passo anterior.

3.  **Analisar os Resultados**: Peça ao usuário para observar se o novo agente:
    -   Fornece as respostas corretas.
    -   Aponta alguma ambiguidade ou trecho confuso.
    -   Identifica corretamente o conhecimento/contexto que o documento assume que o leitor já possui.

4.  **Iterar com Base nos Resultados**: Pergunte ao usuário o que o "agente leitor" errou ou teve dificuldade para entender. Com base nesse feedback, volte ao Estágio 2 para refinar as seções problemáticas.

**Condição de saída**: O documento está pronto quando um novo agente consegue responder consistentemente às perguntas e não aponta novas lacunas ou ambiguidades.

## Revisão Final

Quando o Teste de Leitura for bem-sucedido, anuncie que o documento passou no teste. Antes de finalizar, recomende ao usuário:

1.  Fazer uma última leitura completa por conta própria.
2.  Verificar novamente fatos, links ou detalhes técnicos.
3.  Confirmar se o documento atinge o impacto desejado.

Após a confirmação final do usuário, o trabalho está concluído.

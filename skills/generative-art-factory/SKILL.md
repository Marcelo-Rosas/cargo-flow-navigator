---
name: generative-art-factory
description: Criação de arte algorítmica usando p5.js com aleatoriedade baseada em sementes e exploração interativa de parâmetros, alinhada à identidade visual da Vectra Cargo. Use quando for solicitado a criação de arte usando código, arte generativa, campos de fluxo ou sistemas de partículas.
---

# Skill: Fábrica de Arte Generativa (generative-art-factory)

Esta skill implementa um processo de duas etapas para criar arte algorítmica que pode ser usada como recurso visual em relatórios, propostas ou na própria interface do Cargo Flow Navigator.

1.  **Criação da Filosofia Algorítmica** (arquivo `.md`)
2.  **Expressão via p5.js** (arquivo `.html` autocontido)

## Etapa 1: Criação da Filosofia Algorítmica

O primeiro passo é criar uma **FILOSOFIA ALGORÍTMICA** que será interpretada através de processos computacionais, comportamento emergente e beleza matemática. A filosofia deve enfatizar a expressão algorítmica, a variação baseada em sementes e o artesanato de alta qualidade.

### Como Gerar uma Filosofia Algorítmica

1.  **Nomeie o movimento** (1-2 palavras): Ex: "Malha Logística", "Fluxo de Dados", "Cristalização de Rotas".
2.  **Articule a filosofia** (4-6 parágrafos): Descreva como a filosofia se manifesta através de processos computacionais, funções de ruído, comportamento de partículas e variação paramétrica.
3.  **Incorpore a identidade Vectra Cargo**: A filosofia deve fazer referência sutil aos conceitos do projeto, como rotas, fluxo, logística, eficiência e a paleta de cores (navy e laranja).

**Exemplo Condensado para o Projeto:**

> **"Malha Logística (Logistics Mesh)"**
> **Filosofia**: A beleza invisível das rotas de transporte, tornada visível. A ordem emergindo da complexidade da malha logística nacional.
> **Expressão Algorítmica**: Um campo de vetores gerado a partir de múltiplas camadas de ruído Perlin, representando as "forças" do tráfego e da geografia. Milhares de partículas, nascidas em centros de distribuição (CDs), fluem por essas rotas, com suas cores e espessuras determinadas pela velocidade e densidade. Partículas rápidas em rotas principais brilham em laranja (`#E87B2F`), enquanto partículas lentas em áreas congestionadas se aprofundam no azul escuro (`#0D2B3E`). O algoritmo, meticulosamente ajustado, busca um equilíbrio que representa um dia de operações, onde cada parâmetro foi refinado para expressar a beleza oculta no fluxo de cargas.

## Etapa 2: Implementação em p5.js

Com a filosofia estabelecida, o próximo passo é expressá-la em código, criando um artefato HTML interativo e autocontido.

### ⚠️ Passo 0: Leia o Template Primeiro ⚠️

**CRÍTICO: ANTES de escrever qualquer HTML:**

1.  **Leia** o arquivo `templates/viewer-vectra.html`.
2.  **Estude** a estrutura, o estilo e a marca **Vectra Cargo** (cores, fontes, layout).
3.  **Use esse arquivo como o PONTO DE PARTIDA LITERAL**.
4.  **Mantenha todas as seções FIXAS** (cabeçalho, estrutura da barra lateral, cores e fontes da Vectra Cargo, controles de semente, botões de ação).
5.  **Substitua apenas as seções VARIÁVEIS** marcadas nos comentários do arquivo (o algoritmo, os parâmetros e os controles da UI para os parâmetros).

### Requisitos Técnicos

-   **Aleatoriedade com Semente**: Sempre use `randomSeed(seed)` e `noiseSeed(seed)` para reprodutibilidade.
-   **Estrutura de Parâmetros**: Defina parâmetros que emergem da filosofia (quantidade, escalas, probabilidades, ângulos).
-   **Algoritmo Principal**: O código deve ser uma expressão direta da filosofia, não um padrão pré-fabricado.
-   **Artesanato de Alta Qualidade**: O resultado deve parecer refinado e intencional. Equilíbrio, harmonia de cores (usando a paleta Vectra Cargo) e desempenho são essenciais.

### Formato de Saída

1.  **Filosofia Algorítmica**: Um arquivo `.md` explicando a estética generativa.
2.  **Artefato HTML Único**: Uma única página HTML autocontida, construída a partir do `templates/viewer-vectra.html`, que funciona instantaneamente em qualquer navegador.

### Criação do Artefato Interativo

A estrutura da barra lateral no `viewer-vectra.html` é:

1.  **Semente (FIXO)**: Controles para navegar pelas sementes (anterior/próxima/aleatória/saltar).
2.  **Parâmetros (VARIÁVEL)**: Crie controles (sliders, inputs) para os parâmetros do seu algoritmo.
3.  **Cores (OPCIONAL/VARIÁVEL)**: Inclua seletores de cores se a arte permitir, mas priorize a paleta Vectra Cargo.
4.  **Ações (FIXO)**: Botões para Regenerar, Resetar e Baixar PNG.


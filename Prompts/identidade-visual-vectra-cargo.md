# IDENTIDADE VISUAL — Cargo Flow Navigator (Vectra Cargo)

## Stack Técnica

- Tailwind CSS para toda estilização (NUNCA criar arquivos `.css` separados)
- shadcn/ui como base de componentes, customizados via `className`
- Todos os valores visuais definidos como **TOKENS SEMÂNTICOS** no `tailwind.config.ts`
- NUNCA usar valores hardcoded no código — sempre tokens semânticos
- NUNCA usar cores/radius/sombras padrão do Tailwind — apenas tokens deste documento
- A IA que implementa é **RESPONSÁVEL** por criar SVGs originais e composições visuais únicas baseadas nas descrições abaixo — NÃO use decoração genérica (blobs, dot grids, partículas) como substituto
- A paleta usa **UMA cor accent forte + neutros**. NÃO crie arco-íris de categorias. A identidade é uma cor só.

---

## Setup Necessário (instalar antes de buildar)

### Libs adicionais

| Lib | Pra quê | Instalação |
|-----|---------|------------|
| framer-motion | Animações de entrada e micro-interações (já instalada) | — |

### Assets externos

| Asset | Pra quê | Como gerar |
|-------|---------|------------|
| Nenhum obrigatório | Todos os conceitos visuais são implementáveis em SVG/CSS puro | — |

---

## A Alma do App

O Cargo Flow Navigator é **controle em movimento** — cada cotação é uma rota que precisa chegar ao destino, cada ordem de serviço é uma carga que precisa ser entregue. A interface deve transmitir a seriedade de quem move toneladas e a precisão de quem cobra por quilômetro. **Navy profundo + laranja operacional**: a confiança de uma seguradora com a urgência de um caminhão na estrada.

---

## Referências e Princípios

- **Linear**: Fundo dark + uma cor de accent + estrutura limpa sem decoração genérica → Princípio: identidade vive na estrutura e tipografia, não em efeitos → Aplicação: sidebar navy escuro como âncora visual, cards com bordas sutis e sem sombras excessivas

- **Supabase**: Cada card importante tem uma ilustração conceitual em wireframe que traduz visualmente o que a funcionalidade FAZ — não é decoração, é narrativa visual → Princípio: conceito > decoração → Aplicação: cada KPI card do dashboard tem uma cena SVG que conta a história do que o número representa

- **Vercel**: Preto e branco puro, identidade na estrutura e tipografia → Princípio: densidade de informação com hierarquia clara → Aplicação: tabelas e listas densas com separadores sutis, sem ruído visual

---

## Decisões de Identidade

### ESTRUTURA

**Navegação**
O que: Sidebar lateral fixa, navy escuro (`#0D2B3E`), com ícones + labels. Em mobile, colapsa para bottom bar ou drawer.
Por que: CRM logístico é usado em desktop por operadores que precisam de acesso rápido a múltiplos módulos (Cotações, OS, Financeiro, Clientes). Sidebar fixa elimina fricção de navegação.
Como: Sidebar com 240px expandida / 64px colapsada. Itens agrupados por domínio (Comercial, Operacional, Financeiro, Admin). Item ativo com borda esquerda de 3px na cor accent e fundo levemente mais claro.
Nunca: Bottom navigation em desktop. Tabs horizontais como navegação principal. Hamburger menu em desktop.

**Layout do Dashboard**
O que: Grid de KPI cards no topo (4 colunas), seguido de seção de gráficos (2/3 + 1/3), seguido de lista de atividades recentes.
Por que: Gestores precisam ver o número primeiro, depois o contexto, depois o detalhe. A hierarquia de informação deve seguir essa ordem.
Como: KPI cards com altura fixa de ~120px. Gráfico principal ocupa 2/3 da largura. Widget de atividades/alertas ocupa 1/3.
Nunca: Todos os elementos com o mesmo peso visual. Cards de tamanhos aleatórios sem grid definido.

**Apresentação de Dados Operacionais**
O que: Kanban board para cotações e ordens de serviço (pipeline visual), tabelas densas para financeiro e documentos.
Por que: Pipeline logístico tem estágios claros (Cotação → OS → Faturamento). Kanban comunica posição no fluxo melhor que tabela. Dados financeiros precisam de densidade e comparação — tabela é superior.
Como: Colunas de Kanban com largura fixa de 280px, scroll horizontal. Cards arrastáveis com DnD. Tabelas com sticky header e paginação.
Nunca: Tabela para pipeline de cotações. Kanban para dados financeiros.

---

### LINGUAGEM

**Tipografia**
O que: Inter para toda a interface. Sem mistura de fontes.
Por que: Inter é legível em densidades altas, tem variações de peso suficientes para hierarquia, e transmite precisão técnica — adequado para CRM logístico.
Como: `font-sans: ['Inter', 'system-ui', 'sans-serif']`. Títulos de página em 24px/700. Títulos de seção em 16px/600. Corpo em 14px/400. Labels e hints em 12px/500.
Nunca: Fontes serifadas. Fontes decorativas. Mistura de mais de uma família tipográfica.

**Cores como Sistema (Regra da Cor Única)**
O que: Base dark navy (`#0D2B3E` a `#1A3A52`) + UMA cor accent laranja operacional (`#E87B2F`). Todo o resto é neutro.
Por que: O laranja é a cor de urgência e ação no universo logístico (cones de trânsito, vests de segurança, sinalizações de carga). Navy transmite confiança e profissionalismo. Juntos: "empresa séria que age rápido". Supabase usa verde + dark. Vectra usa laranja + navy.
Como: O laranja aparece em botões primários, ícones ativos na sidebar, badges de status de ação, acentos de gráficos, links de ação. Todo o resto é escala de cinzas/navy.
Nunca: Azul para cotações, verde para OS, roxo para financeiro. Isso é arco-íris, não identidade. O laranja é a única cor vibrante — status colors (verde/vermelho/amarelo) são funcionais, não decorativos.

**Geometria**
O que: Cantos levemente arredondados (8px para cards, 6px para botões, 4px para inputs). Sem pill em elementos de UI principais.
Por que: Arredondamento moderado transmite profissionalismo sem ser corporativo demais. Pill seria informal demais para CRM logístico.
Como: `radius-card: 8px`, `radius-button: 6px`, `radius-input: 4px`. Badges usam pill (radius-full) pois são pequenos e precisam de destaque visual.
Nunca: Cantos totalmente retos (frio demais). Cantos muito arredondados/pill em cards (informal demais para contexto B2B).

**Profundidade**
O que: Sombras muito sutis nos cards (1-2px, baixa opacidade). Sem glassmorphism. Sem glow borders.
Por que: Interface densa com muitos dados não suporta sombras pesadas — cria ruído. A profundidade deve ser mínima e funcional.
Como: `shadow-card: 0 1px 3px 0 hsl(210 20% 12% / 0.10)`. Hover eleva levemente: `shadow-card-hover: 0 10px 25px -5px hsl(210 20% 12% / 0.15)`.
Nunca: Sombras coloridas. Glow effect em hover. Glassmorphism em cards de dados.

**Iconografia**
O que: Lucide icons (line style), tamanho 16-20px. Ícones de ação com fundo circular na cor accent com opacidade baixa.
Por que: Line icons são mais leves visualmente em interfaces densas. Consistência com shadcn/ui.
Como: Ícones ativos na sidebar recebem `text-accent-primary`. Ícones em KPI cards ficam dentro de um container `rounded-lg bg-accent-subtle p-2`.
Nunca: Ícones filled misturados com line. Ícones sem consistência de tamanho. Emojis como ícones de UI.

---

### RIQUEZA VISUAL ← OBRIGATÓRIO

**Textura Ambiente**
O que: Pattern de linhas de rota — linhas finas horizontais e diagonais, como um mapa de estradas simplificado ou grade de coordenadas logísticas.
Temática: Logística é movimento em rotas. O pattern de linhas evoca mapas de transporte, malha rodoviária, coordenadas de entrega — conectado diretamente ao domínio do app.
Tratamento: Opacity 3-4%. Cor: `accent-primary` em opacidade muito baixa, ou neutro escuro. SVG inline como background-image no elemento `<body>` ou no wrapper principal. Padrão fixo (não se move com scroll). NUNCA gradientes coloridos como textura — apenas linhas monocromáticas.

---

**Conceitos Visuais por Componente**

---

**Card KPI — Cotações Ativas**
Representa: O volume de oportunidades comerciais em aberto — o "funil" de negócios que precisa ser convertido.
Metáfora visual: Um funil de cotações — múltiplos documentos entrando pelo topo e convergindo para um ponto de saída (conversão).
Cena detalhada: No canto superior direito do card, uma composição SVG de 3 retângulos finos e horizontais (representando cotações/documentos) empilhados com leve offset entre eles, como um deck de cartas. Os retângulos têm bordas arredondadas de 2px, altura de 8px e larguras decrescentes (40px, 32px, 24px). Abaixo deles, uma seta fina apontando para baixo em direção a um círculo menor (o destino/conversão). Toda a composição tem opacidade 10-12%. Cor: `accent-primary`. Posicionada no canto inferior direito do card, parcialmente cortada pela borda.
Viabilidade: CÓDIGO PURO (SVG inline com formas básicas)

---

**Card KPI — Receita do Mês**
Representa: O resultado financeiro do período — o que foi gerado pelo movimento de cargas.
Metáfora visual: Uma rota de caminhão com marcos de distância — como um hodômetro visual que mostra o quanto foi percorrido (faturado) no mês.
Cena detalhada: Uma linha horizontal tracejada (dash-array: 4,4) partindo da esquerda até a direita do card, com um pequeno ícone de caminhão (triângulo + retângulo simplificado em SVG, ~12px) posicionado em um ponto proporcional ao percentual de meta atingida. Na extremidade direita, um círculo de 6px representando o destino/meta. A linha tem opacidade 8%. O caminhão tem opacidade 15% e usa `accent-primary`. Se não há meta definida, o caminhão fica a 75% do caminho.
Viabilidade: CÓDIGO PURO (SVG inline)

---

**Card KPI — Ordens de Serviço em Andamento**
Representa: Cargas em trânsito — operações que já saíram e precisam chegar ao destino.
Metáfora visual: Múltiplos pontos em movimento ao longo de rotas paralelas — como rastreamento de frota em tempo real.
Cena detalhada: Três linhas horizontais paralelas, levemente espaçadas (gap de 10px), cada uma com um pequeno círculo preenchido (4px de raio) posicionado em pontos diferentes ao longo da linha (25%, 55%, 80% do comprimento). As linhas têm opacidade 6%, os círculos têm opacidade 12% e usam `accent-primary`. As linhas representam rotas, os círculos representam caminhões em posições diferentes. Composição posicionada no canto inferior direito, 60px de largura total.
Viabilidade: CÓDIGO PURO (SVG inline)

---

**QuoteCard (Kanban) — Card de Cotação**
Representa: Uma oportunidade comercial em avaliação — uma proposta que precisa ser analisada, precificada e convertida.
Metáfora visual: Uma rota de A a B com dois pontos de parada — origem e destino da carga, conectados por uma linha que representa o frete.
Cena detalhada: No topo do card, uma faixa fina (altura 32px, largura total do card) com fundo levemente mais escuro que o card. Dentro dessa faixa, uma linha horizontal fina com dois círculos nas extremidades: esquerdo (origem, 5px de raio) e direito (destino, 5px de raio). Entre eles, a linha tem um ponto intermediário levemente elevado (como um arco suave, bezier curve), representando a rota. Abaixo do arco, um pequeno triângulo (4px) representa o caminhão em trânsito, posicionado no centro do arco. Toda a composição usa `accent-primary` com opacidade 20-25%. As siglas de UF de origem e destino ficam abaixo dos círculos em texto 10px/500.
Viabilidade: CÓDIGO PURO (SVG inline com path bezier)

---

**Kanban Column Header — Cabeçalho de Estágio**
Representa: Um estágio do pipeline logístico — uma fase pela qual cotações e OS precisam passar.
Metáfora visual: Um checkpoint de rota — como os marcos de distância em rodovias que indicam onde você está na jornada.
Cena detalhada: No header da coluna Kanban, à esquerda do título do estágio, um pequeno ícone de checkpoint: um círculo de 8px com uma borda de 1.5px na cor `accent-primary`, com um ponto preenchido de 3px no centro. À direita do título, o contador de itens em um badge pill com fundo `accent-subtle` e texto `accent-primary`. O header tem uma borda inferior de 2px na cor `accent-primary` com opacidade 30%.
Viabilidade: CÓDIGO PURO

---

**AiInsightsWidget — Widget de Insights de IA**
Representa: Inteligência que analisa o negócio e revela padrões invisíveis — como um co-piloto que lê os dados e aponta o caminho.
Metáfora visual: Um grafo de nós conectados — como uma rede neural simplificada ou um mapa de conexões entre dados.
Cena detalhada: No canto superior direito do widget, uma composição SVG de 5-6 círculos pequenos (3-4px de raio) conectados por linhas finas. Os círculos estão posicionados de forma orgânica (não em grid), com linhas de conexão entre eles (não todos conectados a todos — apenas 6-8 conexões). Um dos círculos (o central) é levemente maior (5px) e usa `accent-primary` com opacidade 40%. Os demais usam neutro com opacidade 15%. As linhas têm opacidade 8%. Composição de ~80x60px, posicionada no canto superior direito do widget como elemento decorativo de fundo.
Viabilidade: CÓDIGO PURO (SVG inline)

---

## Tokens de Design

### Cores — Fundos

| Token | Valor | Uso |
|-------|-------|-----|
| `surface-page` | `hsl(210, 25%, 97%)` | Fundo principal (light) / `hsl(210, 40%, 8%)` (dark) |
| `surface-card` | `hsl(0, 0%, 100%)` | Cards (light) / `hsl(210, 35%, 12%)` (dark) |
| `surface-elevated` | `hsl(0, 0%, 100%)` | Modais, popovers, dropdowns |
| `surface-sidebar` | `hsl(203, 82%, 16%)` | Sidebar (sempre dark, independente do modo) |

### Cores — Texto

| Token | Valor | Uso |
|-------|-------|-----|
| `text-primary` | `hsl(210, 40%, 12%)` | Títulos, valores principais |
| `text-secondary` | `hsl(210, 15%, 46%)` | Labels, subtítulos |
| `text-muted` | `hsl(210, 15%, 65%)` | Hints, placeholders, metadados |

### Cores — Accent (UMA COR APENAS)

| Token | Valor | Uso |
|-------|-------|-----|
| `accent-primary` | `#E87B2F` (hsl 26, 82%, 55%) | A COR da marca — botões primários, ícones ativos na sidebar, badges de ação, acentos de gráficos, links de ação |
| `accent-hover` | `#D06A20` (hsl 26, 74%, 47%) | Hover state do accent |
| `accent-subtle` | `hsl(26, 82%, 55%, 0.10)` | Fundos translúcidos do accent (badge backgrounds, hover tints, ícones de KPI) |

> **NUNCA criar múltiplas cores accent por "categoria"** — fragmenta a identidade. UMA cor para tudo que precisa de destaque.

### Cores — Status (APENAS para feedback funcional, NUNCA como categorias visuais)

| Token | Valor | Uso |
|-------|-------|-----|
| `status-success` | `hsl(142, 60%, 40%)` | Confirmado, entregue, pago — APENAS quando comunicando resultado positivo |
| `status-error` | `hsl(354, 70%, 54%)` | Erro, cancelado, recusado — APENAS quando comunicando problema |
| `status-warning` | `hsl(38, 92%, 56%)` | Pendente, aguardando, atenção — APENAS quando comunicando alerta |

### Bordas

| Token | Valor | Uso |
|-------|-------|-----|
| `border-default` | `hsl(210, 20%, 88%)` | Contornos padrão de cards, inputs, divisores |
| `border-subtle` | `hsl(210, 20%, 93%)` | Contornos muito sutis, separadores internos |

### Geometria

| Token | Valor | Uso |
|-------|-------|-----|
| `radius-card` | `8px` | Cards, painéis, widgets |
| `radius-button` | `6px` | Botões de ação |
| `radius-input` | `4px` | Inputs, selects, textareas |
| `radius-badge` | `9999px` (pill) | Badges de status, contadores |

### Sombras

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-card` | `0 1px 3px 0 hsl(210 20% 12% / 0.10), 0 1px 2px -1px hsl(210 20% 12% / 0.10)` | Cards em estado normal |
| `shadow-hover` | `0 10px 25px -5px hsl(210 20% 12% / 0.15), 0 8px 10px -6px hsl(210 20% 12% / 0.10)` | Cards em hover |
| `shadow-float` | `0 20px 40px -10px hsl(210 20% 12% / 0.20)` | Modais, dropdowns, nav flutuante |

---

## Componentes Shadcn — Overrides

| Componente | Override (usando tokens) |
|------------|--------------------------|
| `<Card>` | `bg-surface-card border-border-default rounded-card shadow-card hover:shadow-hover transition-shadow` |
| `<Button variant="default">` | `bg-accent-primary hover:bg-accent-hover text-white rounded-button font-medium` |
| `<Button variant="outline">` | `border-border-default text-text-primary hover:bg-accent-subtle hover:border-accent-primary rounded-button` |
| `<Badge>` | `bg-accent-subtle text-accent-primary rounded-badge font-medium text-xs` |
| `<Badge variant="success">` | `bg-status-success/10 text-status-success rounded-badge` |
| `<Avatar>` | `rounded-card` (quadrado arredondado, não circular — mais profissional para CRM B2B) |
| `<Input>` | `border-border-default rounded-input focus:ring-accent-primary focus:border-accent-primary` |
| `<Tabs>` | `border-b border-border-default`. Tab ativa: `border-b-2 border-accent-primary text-accent-primary` |

---

## Regra de Ouro

Ao criar qualquer tela ou componente:

1. Siga TODAS as decisões de identidade (estrutura + linguagem + riqueza visual)
2. Use shadcn/ui como base, customizado via `className`
3. **APENAS tokens semânticos** — nunca valores crus
4. **UMA cor accent para tudo** — a interface inteira usa base neutra (light ou dark) + laranja `accent-primary`. Nenhuma outra cor vibrante além das cores de status funcionais
5. Componentes importantes **DEVEM ter CONCEITO VISUAL** — uma ilustração/cena SVG original que conta a história do que o componente representa
6. **NÃO substitua conceito por decoração genérica** — blobs, dot grids e partículas são textura ambiente, não identidade
7. A IA implementadora é **RESPONSÁVEL** por criar SVGs e composições visuais ORIGINAIS baseadas nas descrições de cena acima
8. **"Controle em movimento" — cada dado é uma carga, cada número é uma rota.**

---

## Teste Final

Coloque a interface ao lado de um dashboard shadcn padrão. A diferença deve ser óbvia em TRÊS níveis:

- **ESTRUTURA**: sidebar navy fixa, Kanban para pipeline, tabelas para financeiro — layout diferente de um template genérico
- **LINGUAGEM**: Inter + navy + laranja operacional como única cor vibrante — não arco-íris de categorias
- **RIQUEZA**: cada KPI card tem uma cena SVG de rota/carga que conta a história do número; QuoteCard tem a rota A→B no topo; Kanban headers têm checkpoints de rota — não decoração genérica que poderia estar em qualquer app

Se os cards tiverem blobs e dot grids mas NÃO tiverem conceitos visuais únicos, está **INCOMPLETO**.
Se a interface usar azul para cotações, verde para OS, roxo para financeiro ao invés de laranja único + neutros, está **ERRADO**.

---

## Contexto do Projeto (Preenchido)

| Campo | Valor |
|-------|-------|
| Nome do projeto | Cargo Flow Navigator — CRM Vectra Cargo |
| O que faz | CRM logístico para gestão de cotações, ordens de serviço, clientes, embarcadores e documentos, com cálculo de frete integrado (tabelas de preço, GRIS, TSO, TAC, NTC) e painel comercial/operacional |
| Para quem | Equipe operacional e comercial de transportadora (operadores logísticos, vendedores de frete, gestores de operação). Perfil: profissional B2B, 25-45 anos, usa desktop no trabalho, precisa de eficiência e precisão acima de tudo |
| Sensação desejada | Controle total. Precisão técnica. Urgência operacional. Como um painel de controle de frota — sério, denso de informação, mas com clareza de onde agir |
| O que NÃO quer parecer | App genérico de gestão, dashboard corporativo cinza, template SaaS americano, startup fintech colorida |
| Modo | Light mode como padrão, dark mode suportado |
| Referência de energia | A precisão do Linear + a seriedade operacional de um ERP logístico + o laranja de urgência das sinalizações rodoviárias |

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *               ARTE GENERATIVA COM P5.JS - MELHORES PRÁTICAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este arquivo demonstra a ESTRUTURA e os PRINCÍPIOS para arte generativa com p5.js
 * no contexto do Cargo Flow Navigator.
 *
 * Sua filosofia algorítmica deve guiar o que você constrói.
 * Estas são apenas as melhores práticas de como estruturar seu código.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ============================================================================
// 1. ORGANIZAÇÃO DE PARÂMETROS
// ============================================================================
// Mantenha todos os parâmetros ajustáveis em um único objeto.
// Isso facilita:
// - Conectar aos controles da UI
// - Resetar para os padrões
// - Serializar/salvar configurações

let params = {
  // Defina parâmetros que correspondam ao SEU algoritmo
  // Exemplos (personalize para sua arte):
  // - Contagens: quantos elementos (partículas, círculos, ramificações)
  // - Escalas: tamanho, velocidade, espaçamento
  // - Probabilidades: chance de eventos
  // - Ângulos: rotação, direção
  // - Cores: arrays de paletas

  seed: 12345,
  // Defina a paleta de cores como um array com as cores da Vectra Cargo
  colorPalette: ['#0D2B3E', '#E87B2F', '#f8f7f4', '#9e9a92'],
  // Adicione SEUS parâmetros aqui com base no seu algoritmo
};

// ============================================================================
// 2. ALEATORIEDADE COM SEMENTE (Crítico para reprodutibilidade)
// ============================================================================
// SEMPRE use uma semente para saídas reprodutíveis no estilo Art Blocks.

function initializeSeed(seed) {
  randomSeed(seed);
  noiseSeed(seed);
  // Agora todas as chamadas a random() e noise() serão determinísticas
}

// ============================================================================
// 3. CICLO DE VIDA DO P5.JS
// ============================================================================

function setup() {
  createCanvas(800, 800);

  // Inicialize a semente primeiro
  initializeSeed(params.seed);

  // Configure seu sistema generativo
  // É aqui que você inicializa:
  // - Arrays de objetos
  // - Estruturas de grade
  // - Posições iniciais
  // - Estados iniciais

  // Para arte estática: chame noLoop() no final do setup
  // Para arte animada: deixe o draw() continuar executando
}

function draw() {
  // Opção 1: Geração estática (executa uma vez e para)
  // - Gere tudo no setup()
  // - Chame noLoop() no setup()
  // - draw() faz pouco ou pode estar vazio
  // Opção 2: Geração animada (contínua)
  // - Atualize seu sistema a cada frame
  // - Padrões comuns: movimento de partículas, crescimento, evolução
  // - Opcionalmente, pode chamar noLoop() após N frames
  // Opção 3: Regeneração acionada pelo usuário
  // - Use noLoop() por padrão
  // - Chame redraw() quando os parâmetros mudarem
}

// ============================================================================
// 4. ESTRUTURA DE CLASSES (Quando você precisa de objetos)
// ============================================================================
// Use classes quando seu algoritmo envolver múltiplas entidades
// Exemplos: partículas, agentes, células, nós, etc.

class Entidade {
  constructor() {
    // Inicialize as propriedades da entidade
    // Use random() aqui - ele será baseado na semente
  }

  update() {
    // Atualize o estado da entidade
    // Isso pode envolver:
    // - Cálculos de física
    // - Regras de comportamento
    // - Interações com vizinhos
  }

  display() {
    // Renderize a entidade
    // Mantenha a lógica de renderização separada da lógica de atualização
  }
}

// ============================================================================
// 5. CONSIDERAÇÕES DE PERFORMANCE
// ============================================================================

// Para um grande número de elementos:
// - Pré-calcule o que for possível
// - Use detecção de colisão simples
// - Limite operações custosas (sqrt, trig) quando possível
// - Considere usar vetores p5 de forma eficiente

// Para animação suave:
// - Mire em 60fps
// - Faça profiling se as coisas estiverem lentas
// - Considere reduzir a contagem de partículas ou simplificar os cálculos

// ============================================================================
// 6. FUNÇÕES UTILITÁRIAS
// ============================================================================

// Utilitários de cor
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function corDaPaleta(index) {
  return params.colorPalette[index % params.colorPalette.length];
}

// Mapeamento e easing
function mapRange(value, inMin, inMax, outMin, outMax) {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
}

// Limitar aos limites (efeito de "wrap around")
function wrapAround(value, max) {
  if (value < 0) return max;
  if (value > max) return 0;
  return value;
}

// ============================================================================
// 7. ATUALIZAÇÃO DE PARÂMETROS (Conexão com a UI)
// ============================================================================

function atualizarParametro(paramName, value) {
  params[paramName] = value;
  // Decida se precisa regenerar ou apenas atualizar
  // Alguns parâmetros podem ser atualizados em tempo real, outros precisam de regeneração completa
}

function regenerar() {
  // Reinicialize seu sistema generativo
  // Útil quando parâmetros mudam significativamente
  initializeSeed(params.seed);
  // Em seguida, regenere seu sistema
}

// ============================================================================
// 8. PADRÕES COMUNS DO P5.JS
// ============================================================================

// Desenhar com transparência para rastros/desvanecimento
function fadeBackground(opacity) {
  // Cor de fundo do tema Vectra Cargo com alfa
  fill(248, 247, 244, opacity);
  noStroke();
  rect(0, 0, width, height);
}

// Usar ruído para variação orgânica
function getNoiseValue(x, y, scale = 0.01) {
  return noise(x * scale, y * scale);
}

// Criar vetores a partir de ângulos
function vectorFromAngle(angle, magnitude = 1) {
  return createVector(cos(angle), sin(angle)).mult(magnitude);
}

// ============================================================================
// 9. FUNÇÕES DE EXPORTAÇÃO
// ============================================================================

function exportarImagem() {
  saveCanvas('arte-vectra-' + params.seed, 'png');
}

// ============================================================================
// LEMBRE-SE
// ============================================================================
//
// Estas são FERRAMENTAS e PRINCÍPIOS, não uma receita.
// Sua filosofia algorítmica deve guiar O QUE você cria.
// Esta estrutura ajuda você a criar BEM.
//
// Foque em:
// - Código limpo e legível
// - Parametrizado para exploração
// - Baseado em semente para reprodutibilidade
// - Execução performática
//
// A arte em si depende inteiramente de você!
//
// ============================================================================

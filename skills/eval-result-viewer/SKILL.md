---
name: eval-result-viewer
description: Uma skill que fornece um script Python para gerar e servir uma página web interativa para revisar os resultados de avaliações (evals) de skills, com a identidade visual Vectra Cargo.
---

# Skill: Visualizador de Resultados de Avaliação (eval-result-viewer)

Esta skill fornece um utilitário de linha de comando (`gerar_revisao_eval.py`) que inspeciona um diretório de workspace, encontra todas as execuções de avaliação (`runs`), e gera uma página HTML autocontida para revisão e feedback.

## Funcionalidades

-   **Servidor Web Local**: Inicia um servidor web na porta `3117` (ou outra porta disponível) para servir a página de revisão.
-   **Geração Estática**: Alternativamente, pode gerar um arquivo `index.html` estático sem iniciar um servidor.
-   **Visualização de Artefatos**: Renderiza inline arquivos de texto, imagens, PDFs e oferece links para download de outros formatos binários.
-   **Coleta de Feedback**: Permite que o revisor escreva um feedback para cada execução, que é salvo automaticamente em `feedback.json` no workspace.
-   **Comparação com Execução Anterior**: Pode carregar os resultados de um workspace anterior para comparar o feedback e as saídas lado a lado.
-   **Identidade Visual Vectra Cargo**: O template HTML (`templates/revisao_eval.html`) é estilizado com o design system da Vectra Cargo.

## Uso

O script principal está localizado em `scripts/gerar_revisao_eval.py`.

### Iniciar o Servidor de Revisão

O comando básico para iniciar o servidor e abrir a página no navegador:

```bash
python3 skills/eval-result-viewer/scripts/gerar_revisao_eval.py <caminho_para_o_workspace>
```

### Argumentos de Linha de Comando

| Argumento | Descrição |
|:---|:---|
| `workspace` | (Obrigatório) Caminho para o diretório do workspace que contém as execuções. |
| `--port`, `-p` | Porta para o servidor (padrão: 3117). |
| `--skill-name`, `-n` | Nome da skill para exibir no cabeçalho (padrão: nome do diretório do workspace). |
| `--previous-workspace` | Caminho para um workspace de uma iteração anterior para carregar feedback e saídas antigas como contexto. |
| `--benchmark` | Caminho para um arquivo `benchmark.json` para exibir na aba de Benchmark. |
| `--static`, `-s` | Gera um arquivo HTML estático no caminho especificado em vez de iniciar um servidor. |

### Estrutura de Diretório Esperada

O script espera a seguinte estrutura dentro do workspace:

```
<workspace>/
├── run-001/
│   ├── outputs/
│   │   ├── resultado.json
│   │   └── imagem.png
│   ├── transcript.md
│   └── grading.json
├── run-002/
│   └── ...
└── feedback.json  (será criado/atualizado pelo servidor)
```

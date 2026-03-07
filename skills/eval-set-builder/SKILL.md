---
name: eval-set-builder
description: Uma skill para criar, revisar e exportar conjuntos de avaliação (eval sets) para as skills do Cargo Flow Navigator, usando um template HTML interativo com a identidade visual Vectra Cargo.
---

# Skill: Construtor de Eval Sets (eval-set-builder)

Esta skill fornece um template HTML interativo para criar e revisar conjuntos de avaliação (`eval sets`) das skills do projeto. O template segue a identidade visual da **Vectra Cargo** (navy + laranja operacional, tipografia Inter, textura de rotas).

## Uso

Para gerar uma página de revisão de eval set para uma skill específica:

1.  Copie o template de `templates/eval_set_review.html` para o diretório de trabalho.
2.  Substitua os três placeholders no arquivo copiado:

    | Placeholder | O que substituir |
    |:---|:---|
    | `__SKILL_NAME_PLACEHOLDER__` | Nome da skill (ex: `blind-comparator`) |
    | `__SKILL_DESCRIPTION_PLACEHOLDER__` | Descrição curta da skill |
    | `__EVAL_DATA_PLACEHOLDER__` | Array JSON com as queries de avaliação |

3.  Abra o arquivo HTML no navegador para revisar, editar e exportar o eval set.

## Formato do `EVAL_DATA`

O placeholder `__EVAL_DATA_PLACEHOLDER__` deve ser substituído por um array JSON com objetos no seguinte formato:

```json
[
  {
    "query": "Calcule o frete para São Paulo → Curitiba, 1000kg, valor R$50.000",
    "should_trigger": true
  },
  {
    "query": "Qual é o status da minha conta?",
    "should_trigger": false
  }
]
```

-   `query`: O texto da query de teste.
-   `should_trigger`: `true` se a query deve acionar a skill; `false` caso contrário.

## Funcionalidades do Template

-   **Edição inline**: Edite as queries diretamente na tabela.
-   **Toggle de disparo**: Alterne se uma query deve ou não disparar a skill.
-   **Adicionar/Remover**: Adicione novas queries ou remova existentes.
-   **Exportar**: Baixe o eval set final como `eval_set.json`, pronto para uso nos pipelines de benchmark.
-   **Agrupamento visual**: Queries são automaticamente agrupadas em "Deve Disparar" e "NÃO Deve Disparar", com destaque em laranja para o grupo ativo.

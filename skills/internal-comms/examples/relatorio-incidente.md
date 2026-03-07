# Diretriz: Relatório de Incidente (Pós-mortem)

## Formato

Use este formato para documentar a análise de causa raiz (RCA) de um incidente técnico. O objetivo é aprender com o erro e prevenir recorrências.

```markdown
# Pós-mortem: [Breve Descrição do Incidente]

- **Data do Incidente**: [AAAA-MM-DD]
- **Autores**: [Nomes dos principais envolvidos na resolução]
- **Status**: [Rascunho | Em Revisão | Finalizado]
- **Tags**: [ex: `database`, `edge-function`, `auth`]

## Resumo

[Parágrafo conciso descrevendo o que aconteceu, qual foi o impacto no usuário e a duração do incidente.]

## Linha do Tempo Detalhada

[Liste os eventos chave com timestamps (no fuso horário do time). Inclua detecção, alertas, escalonamento, investigação e resolução.]

- `HH:MM` - [Evento 1]
- `HH:MM` - [Evento 2]

## Análise da Causa Raiz (RCA)

[Descreva a causa raiz fundamental do problema. Evite culpar indivíduos; foque nas falhas de sistema, processo ou design.]

## Resolução e Recuperação

[Descreva os passos tomados para mitigar e resolver o incidente. Inclua quaisquer hotfixes ou reversões aplicadas.]

## Ações de Acompanhamento

[Liste as ações concretas que serão tomadas para prevenir a recorrência do incidente. Cada item deve ter um responsável e, se possível, um prazo.]

| Ação | Tipo | Responsável | Prazo |
| :--- | :--- | :--- | :--- |
| [Descrição da Ação] | [Corretiva/Preventiva] | [@github_user] | [AAAA-MM-DD] |

## Lições Aprendidas

[O que aprendemos com este incidente? O que poderíamos ter feito melhor?]
```

## Tom

- **Sem culpa (Blameless)**: O foco é em falhas de sistema, não de pessoas.
- **Técnico e preciso**: Use terminologia correta e forneça dados.
- **Orientado à ação**: As ações de acompanhamento são a parte mais importante.

# Guia de Contribuição

## Pré-requisitos

- Node.js 22+
- Supabase CLI
- Conta no GitHub

## Fluxo de trabalho

1. Fork o repositório e clone localmente
2. Crie uma branch a partir de `main`: `git checkout -b feat/minha-feature`
3. Faça as alterações e commits com mensagens objetivas
4. Envie um Pull Request para `main` (ou branch de feature em aberto)

## Padrões de código

- **ESLint**: rode `npm run lint` antes de commitar; corrija todos os avisos
- **TypeScript**: use tipagem explícita quando for útil; evite `any`
- **Componentes React**: componentes funcionais com hooks; props tipadas
- **Estilo**: Tailwind + shadcn/ui; prefira `cn()` para classes condicionais

## Estrutura de commit

```
tipo(escopo): descrição curta

Corpo opcional com mais detalhes.
```

Tipos sugeridos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Testes e build

Antes de abrir PR:

```bash
npm run lint
npm run build
```

## Dúvidas

Abra uma Issue no GitHub ou entre em contato com a equipe Vectra Cargo.

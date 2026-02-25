## Lint & qualidade de código

- **Stack de lint**:
  - `eslint@^9` com configuração flat em `eslint.config.js`
  - `typescript-eslint@^8` (meta‑pacote oficial)
  - `@eslint/js` e `globals` para presets base de JavaScript
  - `eslint-plugin-react-hooks` e `eslint-plugin-react-refresh` para regras de React
  - `eslint-config-prettier` para harmonizar com o Prettier

- **Comandos principais**:
  - Rodar lint manualmente: `npm run lint`
  - Rodar formatador: `npm run format`

- **Pre‑commit (Husky + lint‑staged)**:
  - Hook em `.husky/pre-commit` executa `npx lint-staged`
  - Para arquivos `*.ts`/`*.tsx`, o `lint-staged` roda:
    - `prettier --write`
    - `eslint --fix`
  - O commit só é criado se esses comandos finalizarem sem erros.


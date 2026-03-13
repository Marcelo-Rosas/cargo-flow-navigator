# Terminal-First Validation

## Objetivo
Garantir que antes de quaisquer commits as alterações passam por validações críticas via terminal (lint, build e Playwright). Essa skill reforça o pipeline que os mantenedores já usam manualmente.

## Pré-requisitos
- Node.js instalado na versão compatível com o projeto (ler `engines` se houver).
- Dependências instaladas (`npm install`).
- Variáveis de ambiente necessárias para a aplicação e para o Playwright (ex.: `SUPABASE_URL`, `SUPABASE_KEY`, `PLAYWRIGHT_BROWSERS_PATH`, etc.).
- Storage state gerado pelo `auth.setup.ts` (o runner usa `.auth/user.json`; execute `npx playwright test --project=setup` quando trocar credenciais).

## Checklist Terminal-First
Execute os comandos abaixo na ordem:
1. `npm run lint` — verifica tipos e ESLint.
2. `npm run build` — confirma que o bundle Vite compila.
3. `npm run test:e2e` — roda o conjunto padrão do Playwright.
4. `npm run test:e2e:ui` — inspeciona testes via interface quando necessário.
5. `npm run test:e2e:debug` — roda em modo debug se houver falhas intermitentes.

## E2E determinístico (mocks)
- `npx playwright test tests/e2e/quote-advance-race.spec.ts --project=chromium`
- `npx playwright test tests/e2e/quote-wizard-gating.spec.ts --project=chromium`
- Esses specs interceptam todas as chamadas Supabase/REST e usam fixtures (`tests/fixtures/`), então funcionam em CI sem dados reais.
- Para ver o fluxo com mais contexto: `npx playwright test tests/e2e/quote-advance-race.spec.ts --debug`.
- Use `npm run test:e2e:ui` ou `npx playwright test --ui` para inspecionar visualmente qualquer passo.
- O fallback dedicado responde `UNMOCKED_REQUEST` para qualquer `/rest/v1`, `/functions/v1` ou `/auth/v1` não coberta, garantindo que vazamentos falhem rápido em vez de bater no Supabase real.
- Nenhum handler `/rest/v1`, `/functions/v1` ou `/auth/v1` invoca `route.continue()` — se você não mockar a rota ela falha com `UNMOCKED_REQUEST`.

## Fluxos críticos cobertos
- Race “última seleção vence” no modal de adiantamento.
- Gating do CTA no `QuoteFormWizard` (status OUT_OF_RANGE, stale, loading).

## E2E com backend real (seeded)

- **Pré-requisitos**: definir as variáveis de ambiente `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PW_TEST_USER`, `PW_TEST_PASSWORD` (para gerar `.auth/user.json`) e, opcionalmente, `PW_RUN_ID` para identificar e agrupar os dados seedados.
- O fluxo seeded usa PostgREST contra o Supabase real e marca as inserções com `[e2e_run:<PW_RUN_ID ou local-<timestamp>>]` para permitir cleanup seguro.
- O projeto `chromium-auth` (que depende de `setup`) executa apenas os specs `*.seeded.spec.ts`, garantindo que os testes determinísticos não toquem o backend real e vice-versa.

### Comandos
1. Defina um identificador único (PowerShell):
   ```powershell
   $env:PW_RUN_ID="local-$(Get-Date -Format yyyyMMddHHmmss)"
   ```
2. Gere o storage state autenticado:
   ```bash
   npx playwright test --project=setup
   ```
3. Rode os specs seedados no projeto com autenticação:
   ```bash
   npm run test:e2e:seeded
   ```
4. Para rodar todo o projeto auth (incluindo seeded specs e setup), use:
   ```bash
   npm run test:e2e:auth
   ```
5. Precisa examinar o UI? Execute:
   ```bash
   npm run test:e2e:ui
   ```

Esses comandos limpam as tabelas `quotes`, `orders` e `occurrences` usando o mesmo `runId` gravado nos campos `notes` e `description`.

## Saída esperada
- Cada comando deve terminar sem erros e com código de saída `0`. Mensagens de sucesso podem variar, mas não devem conter `Error`/`Failed`.
## Triagem rápida
- Se `npm run lint` falhar: corrigir tipos/ESLint antes de prosseguir.
- Se `npm run build` falhar: inspecionar erros de bundling ou imports inválidos.
- Se `npm run test:e2e` falhar: executar com `--debug` / `--ui` para analisar o passo quebrado.

## Compatibilidade Windows
- Execute o runner dentro de Git Bash ou WSL; o script `scripts/validate.sh` depende de `bash`.  
- Se Bash não estiver disponível, rode os três comandos manualmente em PowerShell:
  ```powershell
  npm run lint
  npm run build
  npm run test:e2e
  ```

## Rodando Playwright manualmente
- Para executar apenas um spec: `npx playwright test tests/e2e/quote-advance-race.spec.ts --project=chromium`.
- Rodar outro spec determinístico: `npx playwright test tests/e2e/quote-wizard-gating.spec.ts --project=chromium`.
- Para abrir a UI: `npm run test:e2e:ui` ou `npx playwright test --ui`.
- Para depurar: `npm run test:e2e:debug` ou `npx playwright test --debug`.
- Relatório HTML: `npm run test:e2e:report` ou `npx playwright show-report`.

## DOTENV específico (ex.: `.env.e2e`)
- Para executar Playwright com um `.env` alternativo, defina `DOTENV_CONFIG_PATH` antes do comando. Exemplo PowerShell:
  ```powershell
  $env:DOTENV_CONFIG_PATH=\".env.e2e\"
  npx playwright test --project=chromium-auth
  ```
- O `dotenv/config` carregado por `playwright.config.ts` respeita esse caminho e injeta as variáveis no processo; o `setup` e os specs seeded herdam essas credenciais.

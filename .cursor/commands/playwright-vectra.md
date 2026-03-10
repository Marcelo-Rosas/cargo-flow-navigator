# Playwright — Vectra Cargo (cargo-flow-navigator)

Comandos prontos para automação do app em https://app.vectracargo.com.br/

---

## Diferença: playwright-cli vs @playwright/test

| Ferramenta | Uso |
|------------|-----|
| **playwright-cli** | Automação manual interativa: `open`, `goto`, `snapshot`, `click`. Exploração e smoke manual. |
| **@playwright/test** | Testes automatizados: `npx playwright test`. CI, regressão, specs em `e2e/`. |

**Comandos rápidos (@playwright/test):**

```powershell
npm run test:e2e              # Rodar todos os testes
npm run test:e2e:headed       # Com browser visível
npm run test:e2e:ui           # Modo interativo
npm run test:e2e:codegen      # Gravar ações e gerar spec
npm run test:e2e:report       # Ver relatório HTML
```

Requer `PW_TEST_USER` e `PW_TEST_PASSWORD` no `.env` para testes autenticados.

---

## Setup

```powershell
$CODEX_HOME = $env:CODEX_HOME ?? "$env:USERPROFILE\.codex"
$PWCLI = "$CODEX_HOME\skills\playwright\scripts\playwright_cli.ps1"
$BASE = "https://app.vectracargo.com.br"
```

Ou use `npx` diretamente:
```powershell
npx --package @playwright/cli playwright-cli open $BASE --headed
```

> **Importante:**
> - Use sempre `& $PWCLI` (com `&`). Sem o `&`, o PowerShell retorna `ParserError: Unexpected token 'open'`.
> - Execute todos os comandos **no mesmo terminal**, em sequência. O `open` cria a sessão; `snapshot`, `goto`, `click` etc. usam essa sessão. Rodar `snapshot` em outro terminal causa `Unknown command: undefined`.

---

## 1. Abrir app (headed — browser visível)

```powershell
& $PWCLI open $BASE --headed
```

> **PowerShell:** o `&` (call operator) é obrigatório. Sem ele: `$PWCLI open $BASE` → `ParserError: Unexpected token 'open'`. Use sempre: `& $PWCLI ...`

---

## 2. Capturar snapshot (refs e1, e2, …)

```powershell
& $PWCLI snapshot
```

Execute após cada navegação ou mudança relevante na tela. **Requer sessão ativa** (ter rodado `open` antes, no mesmo terminal).

---

## 3. Login (Auth)

```powershell
& $PWCLI open "$BASE/auth" --headed
& $PWCLI snapshot
# Ajuste e1, e2, e3 conforme o snapshot

& $PWCLI fill e1 "marcelo.rosas@vectracargo.com.br"
& $PWCLI fill e2 "Vectra@179mr"
& $PWCLI snapshot

& $PWCLI click e3
& $PWCLI snapshot
```

---

## 4. Navegação principal

Use `goto` para navegar sem abrir nova aba (mantém a sessão):

```powershell
# Já com browser aberto (após open), use goto:
& $PWCLI goto "$BASE/"
& $PWCLI snapshot

& $PWCLI goto "$BASE/comercial"
& $PWCLI snapshot

& $PWCLI goto "$BASE/operacional"
& $PWCLI snapshot

& $PWCLI goto "$BASE/financeiro"
& $PWCLI snapshot
# Aba Fluxo de Caixa: após snapshot, clique no tab — ref variável
& $PWCLI click e<N>
& $PWCLI snapshot
```

---

## 5. Screenshot / PDF

```powershell
# Screenshot da página atual
& $PWCLI screenshot

# PDF (salva na pasta atual)
& $PWCLI pdf
```

---

## 6. Tracing (debug de fluxo)

```powershell
& $PWCLI open "$BASE/auth" --headed
& $PWCLI snapshot
& $PWCLI tracing-start
& $PWCLI fill e1 "email@exemplo.com"
& $PWCLI fill e2 "senha"
& $PWCLI click e3
& $PWCLI snapshot
& $PWCLI tracing-stop
```

---

## 7. Persistir login (state-save / state-load)

```powershell
# Depois de fazer login, salvar sessão:
& $PWCLI state-save vectra-auth.json

# Em sessões futuras, carregar sem login:
& $PWCLI open $BASE --headed
& $PWCLI state-load vectra-auth.json
& $PWCLI goto "$BASE/financeiro"
& $PWCLI snapshot
```

> Nota: `state-load` injeta cookies/storage na sessão atual. Rode logo após `open`.

---

## Fluxo completo (smoke test)

```powershell
$CODEX_HOME = $env:CODEX_HOME ?? "$env:USERPROFILE\.codex"
$PWCLI = "$CODEX_HOME\skills\playwright\scripts\playwright_cli.ps1"
$BASE = "https://app.vectracargo.com.br"

& $PWCLI open $BASE --headed
& $PWCLI snapshot
& $PWCLI goto "$BASE/financeiro"
& $PWCLI snapshot
& $PWCLI screenshot
& $PWCLI close
```

---

## URLs do projeto

| Rota | URL |
|------|-----|
| Auth | `/auth` |
| Dashboard | `/` |
| Comercial | `/comercial` |
| Operacional | `/operacional` |
| Financeiro | `/financeiro` |
| Documentos | `/documentos` |
| Clientes | `/clientes` |
| Embarcadores | `/embarcadores` |
| Veículos | `/veiculos` |
| Tabelas de preço | `/tabelas-preco` |
| Relatórios | `/relatorios` |
| Aprovações | `/aprovacoes` |
| Usuários | `/usuarios` |

---

## Referência rápida (playwright-cli)

| Comando | Uso |
|---------|-----|
| `open [url]` | Abre o browser (cria sessão) |
| `goto <url>` | Navega na aba atual |
| `snapshot` | Captura refs dos elementos (e1, e2, …) |
| `click <ref>` | Clica no elemento |
| `fill <ref> <text>` | Preenche campo (limpa e digita) |
| `type <text>` | Digita no elemento focado |
| `press <key>` | Tecla (Enter, Tab, etc.) |
| `screenshot [ref]` | Tira screenshot |
| `pdf` | Salva página como PDF |
| `close` | Fecha o browser |
| `state-save [file]` | Salva cookies/storage |
| `state-load <file>` | Carrega sessão salva |

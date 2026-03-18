## Comandos principais (Terminal)

Este guia consolida os comandos mais usados no dia a dia do `cargo-flow-navigator`.

### Desenvolvimento local

- **Subir o app (Vite)**

```bash
npm run dev
```

- **O que faz na prática**: inicia o servidor de desenvolvimento do Vite com HMR (recarrega rápido ao salvar).\n+- **Exemplo de uso**: abrir o app em `http://localhost:8081/` (a porta pode variar se a padrão estiver ocupada).

- **Build de produção**

```bash
npm run build
```

- **O que faz na prática**: gera `dist/` otimizado (minificado) pronto para deploy (Cloudflare Pages).\n+- **Exemplo de uso**: rodar antes de `wrangler pages deploy dist ...`.

- **Build em modo development**

```bash
npm run build:dev
```

- **O que faz na prática**: gera build com `--mode development` (útil quando você precisa de variáveis/configs específicas desse mode).\n+- **Exemplo de uso**: validar um build com configurações de dev, sem rodar o servidor `vite`.

- **Preview estático do build**

```bash
npm run preview:static
```

- **O que faz na prática**: serve o conteúdo do `dist/` localmente (simula produção, sem HMR).\n+- **Exemplo de uso**: `npm run build && npm run preview:static` e testar em `http://localhost:4173/`.

### Qualidade (TypeScript / ESLint / Prettier)

- **Typecheck**

```bash
npm run lint:types
```

- **O que faz na prática**: roda `tsc --noEmit` para pegar erros de tipo sem gerar arquivos.\n+- **Exemplo de uso**: antes de PR/deploy para garantir que não há `TSxxxx`.

- **ESLint**

```bash
npm run lint:eslint
```

- **O que faz na prática**: roda lint em todo o repo (`eslint .`) e falha se houver erros.\n+- **Exemplo de uso**: validar que refactors não introduziram `no-explicit-any`, hooks deps etc.

- **Lint completo**

```bash
npm run lint
```

- **O que faz na prática**: executa `lint:types` + `lint:eslint` em sequência.\n+- **Exemplo de uso**: checagem rápida “tá limpo?” antes de subir/commitar.

- **Formatar (Prettier)**

```bash
npm run format
```

- **O que faz na prática**: formata arquivos em `src/` com Prettier.\n+- **Exemplo de uso**: rodar antes do commit quando mexeu em muitos componentes.

### Testes E2E (Playwright)

- **Rodar todos os testes**

```bash
npm run test:e2e
```

- **O que faz na prática**: roda a suíte E2E do Playwright.\n+- **Exemplo de uso**: após mudanças em fluxos críticos (cotação, kanbans, aprovações).

- **UI do Playwright**

```bash
npm run test:e2e:ui
```

- **O que faz na prática**: abre a UI interativa do Playwright para rodar/inspecionar testes.\n+- **Exemplo de uso**: selecionar um spec e ver screenshots/trace facilmente.

- **Headed**

```bash
npm run test:e2e:headed
```

- **O que faz na prática**: roda os testes abrindo o navegador (útil para observar o que está acontecendo).\n+- **Exemplo de uso**: reproduzir um flake visualmente.

- **Debug**

```bash
npm run test:e2e:debug
```

- **O que faz na prática**: roda com debugger do Playwright (step-by-step).\n+- **Exemplo de uso**: pausar em um selector que falha e inspecionar o DOM.

- **Rodar local apontando para preview**

```bash
npm run test:e2e:local
```

- **O que faz na prática**: aponta os testes para `PW_BASE_URL=http://localhost:4173`.\n+- **Exemplo de uso**: `npm run build && npm run preview:static` em um terminal e, em outro, `npm run test:e2e:local`.

- **Mostrar report**

```bash
npm run test:e2e:report
```

- **O que faz na prática**: abre o relatório HTML gerado pelo Playwright.\n+- **Exemplo de uso**: revisar falhas e anexos após `npm run test:e2e`.

### Supabase (migrations / edge functions)

- **Login**

```bash
supabase login
```

- **O que faz na prática**: autentica o CLI no seu workspace.\n+- **Exemplo de uso**: necessário antes de `supabase link`, deploy de functions e logs.

- **Linkar projeto**

```bash
supabase link --project-ref <PROJECT_REF>
```

- **O que faz na prática**: conecta o repositório local ao projeto Supabase remoto.\n+- **Exemplo**: `supabase link --project-ref epgedaiukjippepujuzc`.

- **Aplicar migrations**

```bash
supabase db push
```

- **O que faz na prática**: aplica migrations locais no banco remoto.\n+- **Exemplo de uso**: depois de criar `supabase/migrations/...sql` (views, tabelas, RPCs).

- **Reset local (cuidado: apaga dados locais)**

```bash
supabase db reset
```

- **O que faz na prática**: recria o banco local e reaplica migrations.\n+- **Exemplo de uso**: quando seu banco local “desalinhou” e você quer recomeçar do zero.

- **Deploy de Edge Function**

```bash
supabase functions deploy <function-name>
```

- **O que faz na prática**: publica uma Edge Function no Supabase.\n+- **Exemplo**: `supabase functions deploy buonny-check-worker`.

- **Logs de Edge Function**

```bash
supabase functions logs <function-name>
```

- **O que faz na prática**: busca logs da function.\n+- **Exemplo**: `supabase functions logs buonny-check-worker` para debugar erro 500.

- **Invocar Edge Function (teste)**

```bash
supabase functions invoke <function-name> --body '{ "ping": true }'
```

- **O que faz na prática**: chama a function diretamente via CLI.\n+- **Exemplo**:\n+\n+```bash\n+supabase functions invoke buonny-check-worker \\\n+  --body '{\"origin_uf\":\"SP\",\"destination_uf\":\"RJ\",\"weight\":1000,\"product_type\":\"general\"}'\n+```

### Cloudflare Pages (Wrangler)

- **Preview local do build no Pages**

```bash
npm run build
npm run preview:cf
```

- **O que faz na prática**: serve `dist/` com `wrangler pages dev`, simulando Pages local.\n+- **Exemplo de uso**: validar redirects/headers do Pages antes de deploy.

- **Deploy (Pages)**

```bash
npm run build
npx wrangler pages deploy dist --project-name cargo-flow-navigator --commit-dirty=true
```

- **O que faz na prática**: publica o conteúdo de `dist/` no Cloudflare Pages.\n+- **Exemplo de uso**: deploy rápido sem precisar commitar tudo (`--commit-dirty=true`).

- **Deploy via script**

```bash
npm run deploy
```

- **O que faz na prática**: executa `npm run build` + deploy Pages (atalho do projeto).\n+- **Exemplo de uso**: quando você quer seguir o caminho padrão sem digitar o comando inteiro.

### Validação completa (CI-like)

```bash
npm run validate:ci
```

- **O que faz na prática**: roda `lint` + `build` + E2E (playwright).\n+- **Exemplo de uso**: “simular CI” antes de publicar em produção.


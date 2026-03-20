# 🔍 Guia de Debugging - Cargo Flow Navigator

> Boas práticas e workflows para debugging eficiente usando Chrome DevTools 146+

## 📋 Índice
1. [Console & History](#console--history)
2. [Adopted Stylesheets (shadcn/ui)](#adopted-stylesheets)
3. [RLS & Privacy Debugging](#rls--privacy-debugging)
4. [Performance & Lighthouse](#performance--lighthouse)
5. [Network & Supabase](#network--supabase)
6. [Accessibility Audits](#accessibility-audits)

---

## Console & History

### Preservando edits no Console (Chrome 146+)
**Problema anterior**: Editando um comando do histórico, se navegava com Up/Down, perdia-se o draft.
**Solução**: Chrome 146 agora preserva edits enquanto navega pelo histórico.

**Workflow**:
```javascript
// 1. Recuperar um comando anterior (Up/Down)
// useQuery({ queryKey: ['quotations'], ... })

// 2. Você pode editar e navegar sem perder o draft
// useQuery({ queryKey: ['quotations', 'pending'], ... })

// 3. Pressionar Enter quando tiver certeza
```

**Dicas**:
- Use `Ctrl+Shift+J` para abrir Console rapidamente
- Histórico é persistent entre sessões
- Use **Console History API** para automação:
  ```javascript
  // Debuggar múltiplas queries
  const queries = [
    { key: 'quotations' },
    { key: 'service-orders' },
    { key: 'vehicles' }
  ];
  ```

---

## Adopted Stylesheets

### Debugging shadcn/ui Components

**Localização**: Elements Panel → DOM tree → `#adopted-style-sheets`

**Caso de uso**: Componente shadcn/ui renderizando com estilo errado no Kanban

**Workflow**:
```
1. Abrir Elements Panel (F12)
2. Procurar por #adopted-style-sheets
3. Expandir e localizar o componente (ex: Dialog, Button, Card)
4. Editar regras CSS inline no Styles pane
5. Ver mudanças em tempo real
```

**Exemplo prático** (Kanban com dnd-kit):
```html
<!-- Em Elements, você verá -->
#adopted-style-sheets
  ├─ (shadcn/ui - Dialog)
  │  └─ .dialog { ... }
  ├─ (shadcn/ui - Button)
  │  └─ .button { ... }
  └─ (Custom - Kanban)
     └─ .kanban-board { ... }
```

**Benefícios**:
- Editar CSS sem reloadar a página
- Testar variações de Tailwind classes
- Debuggar overflow, z-index, grid issues

---

## RLS & Privacy Debugging

### Verificar RLS Policies (Supabase)

**Nova feature**: Privacy debugging agora aparece no **Console** (não precisa pular entre painéis)

**Workflow**:
```javascript
// 1. Abrir Console
// 2. Procurar por warnings sobre "Privacy" ou "RLS"

// Exemplo de erro comum:
// ❌ "Row Level Security denied access to quotations"

// 3. Verificar a policy na estrutura:
// Em Elements → Storage → IndexedDB → supabase
```

**Checklist RLS**:
- ✅ Tabela `quotations` → RLS enabled
- ✅ Policies definem `auth.uid()` corretamente
- ✅ Usuário autenticado em Supabase Auth
- ✅ Token JWT válido no localStorage

**Debug RLS com Query**:
```javascript
// No Console:
const { data, error } = await supabase
  .from('quotations')
  .select('*')
  .limit(1);

console.log('RLS Check:', { data, error });
// Se error = "new row violates row-level security policy"
// → Policy está bloqueando a query
```

### Third-Party Cookies (Privacy)

**Novo em Chrome 146**: Console mostra avisos sobre third-party cookies e tracking

**Checklist**:
- OpenClaw (WhatsApp) → não deve bloquear cookies
- Analytics/Observability → verificar CORS headers
- Supabase Auth → cookies de sessão corretos

---

## Performance & Lighthouse

### Métricas críticas para TMS

**Web Vitals importantes**:
- **LCP** (Largest Contentful Paint): < 2.5s
  - Kanban carrega muitos itens?
  - Verifique lazy loading de imagens
- **FID** (First Input Delay): < 100ms
  - Interação com Kanban travando?
  - Check TanStack Query devtools
- **CLS** (Cumulative Layout Shift): < 0.1
  - Tabelas/Kanban se movimentam após carregar?
  - Use `content-visibility` no CSS

**Lighthouse Audit Local**:
```bash
# Instalar DevTools MCP
npm install -D chrome-devtools-mcp

# Rodar audit
npx lighthouse http://localhost:5173 --view

# Gerar JSON para análise
npx lighthouse http://localhost:5173 --output=json --output-path=./report.json
```

**Interpretar relatório**:
```json
{
  "categories": {
    "performance": { "score": 0.85 },
    "accessibility": { "score": 0.92 },
    "best-practices": { "score": 0.88 },
    "seo": { "score": 0.95 }
  }
}
```

---

## Network & Supabase

### Debugging Edge Functions

**Problema comum**: Edge Function retorna erro 500

**Workflow**:
```
1. Abrir Network tab (F12)
2. Procurar por requests para `/functions/v1/calculate-freight`
3. Clicar na request → Response tab
4. Ler error message completo
```

**Exemplo**:
```javascript
// Request:
POST /functions/v1/calculate-freight

// Response (error):
{
  "error": "Database connection timeout",
  "hint": "Supabase edge function took > 30s"
}
```

**Solução** (ver em Supabase logs):
```bash
supabase functions download calculate-freight
# Adicionar logs para debugging
console.log('DEBUG:', { input, step1, step2 });
```

### Monitorar mutations do TanStack Query

**DevTools do TanStack Query**:
```javascript
// Em src/main.tsx:
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

export default function App() {
  return (
    <>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </>
  )
}
```

**Usar para debugar**:
- Observar estado de queries (pending/success/error)
- Rerunning mutations manualmente
- Verificar stale time e cache behavior

---

## Accessibility Audits

### Chrome 146 melhorias a11y

**Nova feature**: Screen readers agora anunciam melhor:
- Modal dialogs (importante para formulários de cotação)
- Headings em relatórios
- Loading states

**Checklist a11y**:
```bash
# Rodar audit de acessibilidade
npx lighthouse http://localhost:5173 --only-categories=accessibility --view

# Verificar issues comuns:
# ❌ Buttons sem <button> tag (usar <div onClick>)
# ❌ Modals sem aria-modal="true"
# ❌ Inputs sem <label> associado
# ❌ Cores com baixo contraste
```

**Exemplo correto (shadcn/ui)**:
```tsx
// ✅ Correto - shadcn/ui Dialog já tem a11y built-in
<Dialog>
  <DialogTrigger>Abrir cotação</DialogTrigger>
  <DialogContent>
    <form>
      <Label htmlFor="amount">Valor</Label>
      <Input id="amount" />
    </form>
  </DialogContent>
</Dialog>
```

**Screen reader test**:
```bash
# macOS: VO (Voice Over) - Cmd+F5
# Windows: Narrator - Win+Ctrl+Enter
# Linux: ORCA - Super+Alt+O

# Navegar e verificar se:
# 1. Botões são anunciados corretamente
# 2. Labels estão associados aos inputs
# 3. Estados de loading/erro são anunciados
```

---

## 🎯 Checklist rápida

### Antes de fazer PR:
- [ ] Lighthouse: Performance ≥ 75, Accessibility ≥ 90
- [ ] Console: sem erros relacionados a RLS
- [ ] Network: nenhuma request > 5s (exceto primeiras queries)
- [ ] Acessibilidade: testar com Tab key + Screen reader
- [ ] Privacy: sem avisos sobre blocked cookies

### Em staging antes de deploy:
- [ ] Rodar full Lighthouse audit
- [ ] Testar com dados reais (não mock)
- [ ] Verificar Performance em 3G lento
- [ ] Auditar RLS policies com múltiplos usuários

---

## 📚 Referências

- [Chrome DevTools 146 Release Notes](https://developer.chrome.com/blog/new-in-devtools-146/)
- [DevTools MCP Server Changelog](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/CHANGELOG.md)
- [Lighthouse Documentation](https://developer.chrome.com/docs/lighthouse/overview)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Web Vitals by Google](https://web.dev/vitals/)

---

**Última atualização**: 2026-03-19
**Responsável**: Cargo Flow Navigator Team

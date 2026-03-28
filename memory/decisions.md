# Registro de Decisões

## 2025 — Migração Anthropic → Gemini
- **Decisão**: Migrar Navi de Claude API para Gemini 2.0 Flash / 2.5 Pro
- **Motivo**: Créditos Anthropic esgotados; custo menor com qualidade similar
- **Status**: ✅ Implementado (nina-orchestrator v51–v54)
- **Revisão**: Avaliar qualidade das respostas trimestralmente

## 2025 — npm como gerenciador de pacotes (nunca Bun)
- **Decisão**: Usar exclusivamente npm + package-lock.json
- **Motivo**: Bun causa problemas com `update-browserslist-db` e ferramentas que detectam Bun sem ele instalado
- **Status**: ✅ Permanente
- **Referência**: `.gitignore` inclui `bun.lockb`

## 2025 — WhatsApp via OpenClaw (nunca Evolution API)
- **Decisão**: Toda comunicação WhatsApp passa pela Edge Function `notification-hub` → OpenClaw
- **Motivo**: Centralização, auditabilidade, templates Meta-approved
- **Status**: ✅ Permanente

## 2025 — Sessões Navi stateless
- **Decisão**: Navi não mantém estado server-side; `session_messages` é passado pelo cliente a cada request
- **Motivo**: Simplicidade, sem storage de sessão, cold starts rápidos
- **Status**: ✅ Implementado
- **Trade-off**: Payload maior por request, mas evita complexidade de session store

## 2025 — Roteamento Gemini Flash vs Pro
- **Decisão**: Flash como padrão, Pro apenas para `approval_summary` e `dashboard_insights`
- **Motivo**: Flash é ~10x mais barato; Pro reservado para análises que exigem raciocínio profundo
- **Status**: ✅ Implementado em `_shared/gemini.ts` → `selectGeminiModel()`
- **Revisão**: Expandir critérios conforme novos analysis types surgirem

## 2026-01 — Tool loop com limite de 5 iterações
- **Decisão**: nina-orchestrator limita o loop de function calling a 5 iterações
- **Motivo**: Prevenir loops infinitos se o modelo continuar chamando tools sem convergir
- **Status**: ✅ Implementado (hardcoded em `processWithToolLoop`)

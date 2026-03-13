# Auth / Roles / ProtectedRoute / Profiles

## Entrypoints

| Tipo | Arquivo |
|------|---------|
| Hook | `src/hooks/useAuth.tsx` |
| Proteção | `src/components/auth/ProtectedRoute.tsx` |
| Página | `src/pages/Auth.tsx` |
| Roles | `useUserRole.ts` |

## Roles

`admin` | `financeiro` | `operacional`

## Regra

Não reimplementar auth. Usar `useAuth` de `src/hooks/useAuth.tsx`.

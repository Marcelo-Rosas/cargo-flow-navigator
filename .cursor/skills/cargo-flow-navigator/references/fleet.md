# Motoristas / Veículos / Proprietários / Qualificação

## Entrypoints

| Tipo | Arquivo |
|------|---------|
| Páginas | `src/pages/Drivers.tsx`, `Vehicles.tsx`, `Owners.tsx` |
| Forms | Formulários de motorista, veículo, proprietário |
| Hooks | `useDriverQualification.ts`, `useOwners.tsx` |

## Tabelas Supabase

`drivers`, `vehicles`, `owners`, `driver_qualifications`

## Edge Functions

`ai-driver-qualification-worker` — qualificação de motorista via AI.

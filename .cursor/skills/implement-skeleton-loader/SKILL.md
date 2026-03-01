---
name: implement-skeleton-loader
description: Adds skeleton loader components to pages and components that load data asynchronously (Kanban, Dashboard, tables). Use when useQuery/useSWR pages lack loading state, or when improving perceived performance during data fetch.
---

# Implementar Skeleton Loaders

## Quando Usar

- Página ou componente que busca dados (`useQuery`, `useSWR`) não possui estado de carregamento visual
- Usuário solicita melhorar percepção de performance durante carregamento

## Instruções

1. **Identifique o estado de carregamento:** Localize a variável booleana (ex: `isLoading`, `isFetching`).

2. **Importe o Skeleton:** `import { Skeleton } from "@/components/ui/skeleton";`

3. **Crie o layout do esqueleto:** Durante o carregamento, renderize uma versão esquelética da UI final com a mesma estrutura:
   - Card: `Skeleton` para título, parágrafos e footer
   - Tabela: `Skeleton` por célula
   - Kanban: loop de colunas e cards esqueléticos

4. **Exemplo de card esquelético:**

```tsx
function SkeletonCard() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-[125px] w-[250px] rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[200px]" />
      </div>
    </div>
  );
}
```

5. **Renderização condicional:**

```tsx
if (isLoading) return <SkeletonLayout />;
return <DataLoadedLayout />;
```

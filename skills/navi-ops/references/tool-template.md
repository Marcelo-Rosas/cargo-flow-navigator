# Template: Nova Tool para nina-orchestrator

## 1. Handler (`supabase/functions/nina-orchestrator/tools/nome_da_tool.ts`)

```typescript
// supabase/functions/nina-orchestrator/tools/nome_da_tool.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface NomeDaToolArgs {
  // parâmetros recebidos do Gemini
  param_exemplo: string;
}

interface NomeDaToolResult {
  // formato de retorno para o Gemini
  sucesso: boolean;
  dados: unknown;
  mensagem: string;
}

export async function executeNomeDaTool(
  args: NomeDaToolArgs
): Promise<NomeDaToolResult> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validar parâmetros (não confiar no Gemini)
  if (!args.param_exemplo) {
    return { sucesso: false, dados: null, mensagem: 'param_exemplo é obrigatório' };
  }

  // Lógica principal
  const { data, error } = await supabase
    .from('tabela')
    .select('*')
    .eq('campo', args.param_exemplo);

  if (error) {
    console.error('[nina-orchestrator] nome_da_tool error:', error.message);
    return { sucesso: false, dados: null, mensagem: `Erro: ${error.message}` };
  }

  return {
    sucesso: true,
    dados: data,
    mensagem: `${data.length} resultado(s) encontrado(s)`,
  };
}
```

## 2. Declaration (adicionar em `tools/index.ts` → `toolDeclarations`)

```typescript
{
  name: 'nome_da_tool',
  description: 'Descreva claramente O QUE a tool faz e QUANDO o assistente deve usá-la.',
  parameters: {
    type: 'object',
    properties: {
      param_exemplo: {
        type: 'string',
        description: 'Descrição do parâmetro para o Gemini',
      },
    },
    required: ['param_exemplo'],
  },
},
```

## 3. Executor (adicionar case em `tools/index.ts` → `executeTool`)

```typescript
case 'nome_da_tool':
  return await executeNomeDaTool({
    param_exemplo: args.param_exemplo as string,
  });
```

## 4. System Prompt (se necessário, adicionar em `index.ts`)

```
## Fluxo: Nome da Tool
Quando o usuário pedir [trigger claro]:
1. Chame a tool `nome_da_tool` com os parâmetros adequados
2. Formate o resultado em WhatsApp markdown
3. Termine com próximo passo claro
```

## Checklist

- [ ] Handler valida todos os parâmetros antes de usar
- [ ] Logs com prefixo `[nina-orchestrator]`
- [ ] Sem secrets hardcoded
- [ ] Retorno é JSON serializável (sem circular refs)
- [ ] Description da tool é clara o suficiente para o Gemini decidir quando usá-la

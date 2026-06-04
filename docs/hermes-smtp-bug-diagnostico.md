# Diagnóstico: Bug no Envio SMTP do Hermes Report

## 🐛 Problema

O passo `hermes-report` do workflow `conciliacao-bancaria-mensal` falhou com:

```
send_smtp failed: 'HERMES_SMTP_SERVER'
```

## 🔍 Root Cause

O código do agente **Hermes** está tentando ler a variável de ambiente `HERMES_SMTP_SERVER`, mas essa variável **não existe**.

A configuração correta do servidor SMTP já está cadastrada no adapter da empresa (`adapterId: 7d7b8aae-3b4e-450a-85f8-9ea7eb9e0704`), no campo:

| Campo | Valor Padrão |
|-------|-------------|
| `smtp_host` | `smtpout.secureserver.net` |
| `smtp_port` | `465` |

## 📋 Mapeamento Correto de Campos (Adapter → Hermes)

Os campos configurados no adapter de e-mail devem ser usados pelo Hermes:

| Campo Adapter | Tipo | Significado | Uso no Hermes |
|--------------|------|-------------|---------------|
| `imap_host` | `text` | Servidor IMAP | — (não usado para envio) |
| `imap_port` | `number` | Porta IMAP | — (não usado para envio) |
| `email` | `text` | Endereço de E-mail | `SMTP_FROM` / remetente |
| `password` | `secret` | Senha / App Password | autenticação SMTP |
| `smtp_host` | `text` | Servidor SMTP (envio) | **servidor SMTP** |
| `smtp_port` | `number` | Porta SMTP (SSL) | **porta SMTP** |

## 🔧 Correção Necessária (código do Hermes)

O código do agente Hermes precisa ser alterado para **buscar a configuração do adapter** ao invés de variável de ambiente.

### ❌ Código Incorreto (atual)
```python
# PROBLEMA: lê de variável de ambiente
smtp_server = os.environ.get("HERMES_SMTP_SERVER")
if not smtp_server:
    raise Exception("send_smtp failed: 'HERMES_SMTP_SERVER'")
```

### ✅ Código Correto
```python
# CORREÇÃO: busca do adapter_config da empresa
adapter_config = await get_adapter_config(
    company_id=task.companyId,
    adapter_id="7d7b8aae-3b4e-450a-85f8-9ea7eb9e0704"  # email adapter
)

smtp_host = adapter_config.get("smtp_host", "smtpout.secureserver.net")
smtp_port = int(adapter_config.get("smtp_port", 465))
email_from = adapter_config.get("email")
email_password = adapter_config.get("password")

if not smtp_host:
    raise Exception("send_smtp failed: smtp_host not configured in adapter")

# Conexão SMTP SSL
server = smtplib.SMTP_SSL(smtp_host, smtp_port)
server.login(email_from, email_password)
server.sendmail(email_from, recipients, message.as_string())
server.quit()
```

## 🛠️ Alternativa Rápida (hotfix via variável de ambiente)

Se não for possível alterar o código do Hermes imediatamente, o hotfix é definir a variável de ambiente apontando para o mesmo valor do adapter:

```bash
export HERMES_SMTP_SERVER=smtpout.secureserver.net
export HERMES_SMTP_PORT=465
export HERMES_SMTP_USER=<email configurado no adapter>
export HERMES_SMTP_PASS=<senha do adapter>
```

> ⚠️ **Nota**: O hotfix é **temporário**. A solução definitiva é o Hermes ler do adapter_config, pois cada empresa pode ter um servidor SMTP diferente.

## 📊 Impacto

| Aspecto | Situação |
|---------|----------|
| Workflows afetados | Todos que usam o passo `hermes-report` |
| Empresas afetadas | Todas que dependem do adapter de e-mail |
| Workaround existente | Não — sem a variável de ambiente, o envio sempre falha |
| Severidade | 🔴 **Alta** — quebra todos os relatórios por e-mail |

## ✅ Checklist de Correção

- [ ] Alterar o agente Hermes para buscar `smtp_host`, `smtp_port`, `email`, `password` do `adapter_config`
- [ ] Remover dependência de `HERMES_SMTP_SERVER` (variável de ambiente hardcoded)
- [ ] Garantir que o campo `password` do adapter é descriptografado antes do uso
- [ ] Testar envio de e-mail em ambiente de staging
- [ ] Atualizar a task `536b6496-d276-459d-b047-980af7931257` para `pending` e reexecutar o workflow

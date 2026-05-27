# Arquitetura de Consulta à SEFAZ (NF-e / CT-e / MDF-e)

> Data: 2026-05-27
> Contexto: Certificado A1 da Vectra Cargo (CNPJ 59.650.913/0001-04) instalado no Windows, chave privada non-exportable.

---

## 1. O Problema Central

O certificado A1 da Vectra Cargo está **instalado no Windows** mas a **chave privada está bloqueada para exportação** (`non-exportable`). Isso significa que:

- ❌ Não podemos subir o `.pfx` para um servidor cloud (Supabase, VPS, etc.)
- ❌ Edge Functions não conseguem acessar o certificado do Windows
- ✅ Apenas aplicações rodando **localmente no Windows** podem usar o certificado

---

## 2. Webservices da SEFAZ (oficiais)

### NF-e — Consulta Protocolo (NFeConsultaProtocolo4)
- **Endpoint**: `https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx`
- **Protocolo**: SOAP 1.2
- **Autenticação**: Certificado A1 (mutual TLS)
- **Documentação**: [NT 2018.005](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=Jz/R0rWF2/g=)

### CT-e — Consulta Protocolo (CTeConsulta)
- **Endpoint**: varia por estado (SVRS, SVSP, etc.)
- **SC (Vectra)**: `https://cte.svrs.rs.gov.br/ws/cteConsultaV4/cteConsultaV4.asmx`
- **Protocolo**: SOAP 1.2
- **Autenticação**: Certificado A1 (mutual TLS)

### MDF-e — Consulta Protocolo
- **Endpoint**: `https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx`
- **Protocolo**: SOAP 1.2

---

## 3. Opções de Arquitetura

### Opção A — Servidor Proxy Local (Recomendada)

```
┌─────────────────┐      HTTP REST       ┌──────────────────────┐      SOAP+TLS       ┌─────────┐
│  Frontend React │  ←────────────────→  │  Proxy Local (.NET   │  ←───────────────→  │  SEFAZ  │
│  (navegador)    │   localhost:3333     │  ou Python) Windows  │    Certificado A1   │         │
└─────────────────┘                      └──────────────────────┘                     └─────────┘
```

**Vantagens:**
- Usa o certificado do Windows nativamente
- Frontend continua em React/Vite
- Seguro (roda localmente)
- Pode ser expandido para outros serviços da SEFAZ

**Desvantagens:**
- Precisa rodar um servidor local
- Só funciona no computador com o certificado

**Tecnologias sugeridas:**
- **.NET Minimal API** — melhor integração com Windows Certificate Store (`X509Store`)
- **Python + FastAPI** — mais simples, usa `requests` com `SChannel` via `pywin32`

---

### Opção B — Aplicação Desktop Integrada

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron / Tauri App                      │
│  ┌─────────────┐  ←────────────────────→  ┌───────────────┐ │
│  │    UI       │      IPC interno         │  Consultador  │ │
│  │  (React)    │                          │   SEFAZ       │ │
│  └─────────────┘                          │  (Node/Python)│ │
│                                           └───────────────┘ │
│                              Usa certificado A1 do Windows  │
└─────────────────────────────────────────────────────────────┘
```

**Vantagens:**
- Experiência unificada (não precisa de servidor separado)
- Acesso nativo ao sistema operacional

**Desvantagens:**
- Maior esforço de desenvolvimento
- Bundle maior

---

### Opção C — Exportar Certificado + Cloud

```
┌─────────────────┐      HTTP REST       ┌──────────────────────┐      SOAP+TLS       ┌─────────┐
│  Frontend React │  ←────────────────→  │  Supabase Edge Func  │  ←───────────────→  │  SEFAZ  │
│                 │                      │  ou VPS/EC2          │    .pfx upload      │         │
└─────────────────┘                      └──────────────────────┘                     └─────────┘
```

**Como exportar o certificado (se tiver acesso ao computador original):**
1. Vá no computador/navegador onde o certificado foi **emitido**
2. Chrome: `chrome://settings/certificates` → Exportar como `.pfx`
3. Ou use `certmgr.msc` → Pessoal → Exportar com chave privada
4. Marque **"Tornar a chave privada exportável"**
5. Suba o `.pfx` no Supabase Vault ou no servidor

**Vantagens:**
- Funciona de qualquer lugar
- Sem servidor local

**Desvantagens:**
- Requer exportação do certificado (não temos agora)
- Certificado A1 precisa de renovação anual

---

### Opção D — Serviço de Terceiros (API Paga)

| Serviço | Endpoint | Custo | Precisa de certificado próprio? |
|---------|----------|-------|--------------------------------|
| **Focus Consulta** | `api.focusnfe.com.br/v2/nfes_recebidas/{chave}` | ~R$0,05/consulta | ❌ Não |
| **WebMania** | `webmania.com.br/api/1/nfe/consulta/` | ~R$0,03/consulta | ❌ Não |
| **NFE.io** | `nfe.api.nfe.io/v2/productinvoices/{chave}` | ~R$0,05/consulta | ❌ Não |

**Vantagens:**
- Sem complexidade SOAP/TLS
- Sem certificado A1
- Alta disponibilidade

**Desvantagens:**
- Custo por consulta
- Dependência de terceiro

---

## 4. Recomendação para a Vectra Cargo

### Fase 1 — Hoje (já implementado)
✅ **Validação local** no sistema:
- Formato da chave de acesso (44 dígitos)
- Dígito verificador (mod11)
- Extração de metadados (UF, CNPJ, modelo, série, número)
- Parsing de XML (emitente, destinatário, valor, status)

### Fase 2 — Curto prazo (esta semana)
🔄 **Servidor Proxy Local (.NET)** rodando no computador do operacional:
- Recebe requisições do frontend via `localhost:3333`
- Consulta SEFAZ usando o certificado A1 do Windows
- Retorna JSON simples para o frontend

### Fase 3 — Médio prazo
📤 **Exportar certificado** quando for possível (computador original ou reemissão):
- Subir para Supabase Vault ou VPS
- Eliminar dependência do servidor local

---

## 5. Estrutura de Dados da Resposta SEFAZ

```json
{
  "chave": "42250459650913000104570010000000011000000150",
  "tipo": "cte",
  "status_sefaz": "100",
  "status_descricao": "Autorizado o uso do CT-e",
  "emitente": {
    "cnpj": "59.650.913/0001-04",
    "nome": "VECTRA CARGO LTDA",
    "ie": "263.450.562",
    "uf": "SC"
  },
  "destinatario": {
    "cnpj": "57.513.801/0001-78",
    "nome": "Guarucenter Academia de Musculacao",
    "uf": "SP"
  },
  "protocolo": "142250415820368",
  "data_autorizacao": "2025-04-22T12:43:29-03:00",
  "xml": "<?xml ...>"
}
```

---

## 6. Próximo Passo Imediato

Quer que eu implemente a **Opção A (Servidor Proxy Local)** agora?

Preciso saber:
1. Qual computador vai rodar o servidor? (este mesmo?)
2. Prefere **.NET** ou **Python**?
3. Quer que eu comece com **NF-e** ou **CT-e**?

> Nota: CT-e é mais prioritário para a Vectra Cargo (transportadora).

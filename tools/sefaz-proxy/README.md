# SEFAZ Proxy + Cloudflare Tunnel — Vectra Cargo



Consulta **oficial** NF-e / CT-e / MDF-e na SEFAZ (SOAP + certificado A1 no Windows), exposta à Edge Function `validate-document` via **Cloudflare Tunnel**.



## Arquitetura



```

Supabase validate-document  →  HTTPS  →  sefaz-proxy.vectracargo.com.br

                                              ↓ cloudflared (tunnel)

                                         127.0.0.1:3333 (dotnet proxy)

                                              ↓ cert A1 Windows

                                         SEFAZ SVRS (SOAP)

```



## 1. Pré-requisitos (PC com certificado A1)



- Windows + certificado A1 Vectra (`59.650.913/0001-04`) em **Pessoal → Certificados**

- [.NET 10 SDK](https://dotnet.microsoft.com/download) (ASP.NET Core runtime)

- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (já instalado se `cloudflared --version` funcionar)



## 2. Criar o túnel no Cloudflare (uma vez)



1. Acesse [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**

2. **Create a tunnel** → tipo **Cloudflared** → nome: `sefaz-proxy-vectra`

3. Em **Public Hostname**:

   - **Subdomain:** `sefaz-proxy`

   - **Domain:** `vectracargo.com.br`

   - **Service type:** HTTP

   - **URL:** `localhost:3333`

4. Copie o **token** do conector (string longa)



> Não habilite Cloudflare Access neste hostname — a Edge Function do Supabase precisa alcançar o proxy diretamente (autenticação via header `X-Sefaz-Proxy-Secret`).



## 3. Gerar secret compartilhado



```powershell

$env:SEFAZ_PROXY_SECRET = [guid]::NewGuid().ToString("N")

$env:SEFAZ_PROXY_SECRET

```



Guarde esse valor — será usado no proxy **e** no Supabase.



## 4. Subir proxy + tunnel

**Túnel criado:** `sefaz-proxy-vectra` — ID `2877141d-4c5d-4d85-8dd2-86057d11b88f`

### Se `cloudflared service is already installed` (seu caso)

O serviço Windows **Cloudflared** já roda outro túnel (`ollama-tunnel`). **Não** rode `cloudflared service install` de novo.

**Opção recomendada — 2 terminais:**

Terminal 1 — proxy .NET (certificado A1):

```powershell
$env:SEFAZ_PROXY_SECRET = "sua-chave"
cd C:\Users\marce\cargo-flow-navigator
.\scripts\start-sefaz-proxy.ps1
```

Terminal 2 — túnel SEFAZ em foreground (token do dashboard do `sefaz-proxy-vectra`, **não** é o Tunnel ID):

```powershell
.\scripts\start-sefaz-tunnel-foreground.ps1 -TunnelToken "<TOKEN_DO_DASHBOARD>"
```

**Opção alternativa — 1 só serviço:** no dashboard Cloudflare, abra o túnel que o serviço **já** usa (`ollama-tunnel`) e adicione Public Hostname `sefaz-proxy.vectracargo.com.br` → `http://localhost:3333`. Aí basta rodar só `start-sefaz-proxy.ps1`.

### Subir tudo junto (máquina sem serviço cloudflared)

```powershell
cd C:\Users\marce\cargo-flow-navigator
.\scripts\start-sefaz-stack.ps1 -TunnelToken "<TUNNEL_TOKEN>"
```



Teste público (após tunnel conectado):



```powershell

Invoke-RestMethod https://sefaz-proxy.vectracargo.com.br/health

```



## 5. Secrets no Supabase



```powershell

.\scripts\set-sefaz-supabase-secrets.ps1 `

  -ProxyUrl "https://sefaz-proxy.vectracargo.com.br" `

  -ProxySecret $env:SEFAZ_PROXY_SECRET

```



| Secret | Valor |

|--------|-------|

| `SEFAZ_PROXY_URL` | `https://sefaz-proxy.vectracargo.com.br` |

| `SEFAZ_PROXY_SECRET` | mesmo do passo 3 |

| `VECTRA_CNPJ` | `59650913000104` |



## 6. Validar NF no app



Em **Documentos** → ícone **🔑** ou **↻ Revalidar** na NF.



Status esperado: **SEFAZ OK** (cStat 100).



## Teste manual da consulta



```powershell

$headers = @{

  "Content-Type" = "application/json"

  "X-Sefaz-Proxy-Secret" = $env:SEFAZ_PROXY_SECRET

}

$body = @{ chave = "CHAVE_44_DIGITOS" } | ConvertTo-Json

Invoke-RestMethod `

  -Uri "https://sefaz-proxy.vectracargo.com.br/v1/consult" `

  -Method POST -Headers $headers -Body $body

```



## Produção contínua (opcional)

**Tunnel em foreground** — Agendador de Tarefas no logon: `start-sefaz-tunnel-foreground.ps1` + `start-sefaz-proxy.ps1`.

**`-InstallService`** só se **não** existir serviço Cloudflared (`Get-Service Cloudflared`). Se já existir, use a Opção A ou B da seção 4.



**Proxy no logon** — Agendador de Tarefas executando `scripts\start-sefaz-proxy.ps1` com `SEFAZ_PROXY_SECRET` definido.



## Apenas proxy local (sem tunnel)



```powershell

.\scripts\start-sefaz-proxy.ps1

# Health: http://127.0.0.1:3333/health

```



## Alternativa: Focus NFe



Se o PC com certificado estiver offline, configure `FOCUS_NFE_TOKEN` no Supabase (sem proxy). Ver `docs/sefaz-consulta/arquitetura-consulta-sefaz.md`.



## Troubleshooting



| Sintoma | Ação |

|---------|------|

| `503 Certificado A1 não encontrado` | Instale/renove cert no Windows; confira CNPJ em `VECTRA_CNPJ` |

| `502` na consulta | Certificado sem permissão ou SEFAZ indisponível — teste SOAP local |

| Tunnel offline / sem conexão | Rode `start-sefaz-tunnel-foreground.ps1` com token do dashboard |
| `service is already installed` | Não reinstale; use foreground ou adicione hostname no túnel existente |

| App: `SEFAZ: Consulta não configurada` | Secrets Supabase ausentes ou URL errada |

| `401 Não autorizado` | `SEFAZ_PROXY_SECRET` diferente entre proxy e Supabase |



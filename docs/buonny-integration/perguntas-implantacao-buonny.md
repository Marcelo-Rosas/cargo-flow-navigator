# Implantacao API Buonny — Questoes Tecnicas para Alinhamento

**De:** Vectra Cargo — Equipe de Desenvolvimento
**Para:** Buonny — Equipe de TI / Suporte Tecnico a Integracao
**Data:** 2026-03-09
**Assunto:** Alinhamento tecnico para implantacao completa das APIs Buonny no sistema Cargo Flow Navigator

---

Prezados,

Estamos em fase de implantacao da integracao com as APIs Buonny em nosso sistema de gestao logistica (Cargo Flow Navigator). Ja analisamos a documentacao disponibilizada no portal de Ajuda e iniciamos o desenvolvimento da camada de integracao.

Para darmos continuidade, precisamos de esclarecimentos tecnicos que organizamos por topico abaixo.

---

## 1. Credenciais e Ambientes

### 1.1. Credenciais de Homologacao
- Precisamos confirmar o recebimento do **Token de acesso** (32 caracteres) e do **CNPJ cliente** para o ambiente de homologacao.
- Esses dados ja foram fornecidos? Se sim, para qual contato foram enviados?

### 1.2. Diferenca de subdominio entre ambientes de homologacao
Identificamos que a documentacao referencia **dois subdominios distintos** para homologacao:

| API | Subdominio Homolog |
|-----|-------------------|
| Consulta Profissional | `tstportal.buonny.com.br` |
| Informacoes Viagem | `tstportal.buonny.com.br` |
| Consulta Veiculo por Entrega | `tstportal.buonny.com.br` |
| Status da Entrega | `tstapi.buonny.com.br` |
| Callback Retorno Ficha (REST) | `tstapi.buonny.com.br` |

**Pergunta:** Ambos os subdominios (`tstportal` e `tstapi`) estao ativos e acessiveis com as mesmas credenciais? Ou ha um unico ponto de entrada para homologacao?

### 1.3. Producao
- Em producao, todos convergem para `api.buonny.com.br`? Confirmam que nao ha variacao de subdominio?

---

## 2. Consulta Profissional — Parametros de Entrada

### 2.1. Tabela de Tipos de Carga (`carga_tipo`)
A documentacao menciona o campo `carga_tipo` como **obrigatorio** (ex: "1 - Verificar tabela de tipos de carga"), porem **a tabela de codigos nao foi incluida** na documentacao recebida.

**Pergunta:** Podem nos enviar a tabela completa de codigos de `carga_tipo` com suas descricoes? (Ex: 1 = Carga Geral, 2 = Granel Solido, 3 = Granel Liquido, etc.)

### 2.2. Produto (`produto`)
O campo aceita "1" (TELECONSULT STANDARD) ou "2" (TELECONSULT PLUS).

**Perguntas:**
- Qual a diferenca pratica entre STANDARD e PLUS em termos de profundidade da consulta e SLA de retorno?
- Qual produto esta associado ao nosso contrato?
- E possivel usar ambos os produtos com o mesmo token, ou cada um exige credenciais separadas?

### 2.3. Campo `carreteiro`
O campo espera "S" ou "N" para tipo de motorista.

**Pergunta:** Qual o criterio exato? Motorista autonomo (carreteiro) = "S" e motorista vinculado a transportadora = "N"? Ou refere-se ao tipo de veiculo (carreta)?

### 2.4. Formato do campo `pais_origem` / `pais_destino`
A documentacao indica `TAM: 3` e exemplo "0".

**Pergunta:** Qual o padrao esperado? Codigo IBGE? Codigo ISO 3166? Ou "0" = Brasil e o campo so e relevante para operacoes internacionais?

### 2.5. Formato de `cidade_origem` / `cidade_destino`
**Pergunta:** O nome da cidade deve ser exatamente como consta na base do IBGE (maiusculas, sem acento)? Ha alguma API ou tabela de referencia da Buonny para validar os nomes aceitos?

---

## 3. Status da Entrega / Consulta Veiculo por Entrega

### 3.1. Relacao entre as duas APIs
Ambas utilizam o WSDL `status_entrega.wsdl`, mas a documentacao "Consulta de Veiculo Por Entrega" e "Status Da Entrega" apresentam estruturas de resposta com campos diferentes (Status Da Entrega inclui `nome_motorista`, `cpf_motorista`, `celular_motorista`, `pedido`, `fim_real`, `data_cadastro`).

**Perguntas:**
- Sao a mesma operacao SOAP (`stat:consulta`) retornando campos diferentes conforme o contexto? Ou sao operacoes distintas no mesmo WSDL?
- A resposta varia de acordo com o estado da viagem (em andamento vs finalizada)?

### 3.2. Frequencia de consulta permitida
**Pergunta:** Ha limite de rate limiting para consultas de posicionamento? Qual a frequencia maxima recomendada para polling de posicao de veiculo em viagem? (Ex: a cada 5 min, 15 min?)

---

## 4. Informacoes Viagem (OrdemTransporte)

### 4.1. Campo `NroOrdTransp`
**Pergunta:** Este campo corresponde ao numero de pedido que nos (cliente) atribuimos ao criar a SM na Buonny? Ou e um numero interno gerado pela Buonny?

### 4.2. Pre-requisito
**Pergunta:** Para consultar informacoes de viagem, e necessario que a viagem ja tenha sido criada/agendada no sistema Buonny previamente? Ou esta API funciona de forma independente com base apenas no numero do pedido?

---

## 5. Callback e Webhook — Retorno de Ficha

### 5.1. Cadastro do Endpoint de Retorno
Conforme documentacao, o endpoint deve ser cadastrado em:
**Cadastro Buonny > Operacoes Clientes > Endpoint Retorno da Ficha**

**Perguntas:**
- E possivel cadastrar endpoints diferentes para homologacao e producao?
- O cadastro e feito por CNPJ ou por token?
- E possivel ter multiplos endpoints cadastrados simultaneamente (ex: um principal e um de contingencia)?

### 5.2. Autenticacao do Webhook
O portal oferece as opcoes: Nenhum, HTTP Auth Simples, Bearer Token, Cookie, Header personalizado.

**Perguntas:**
- Qual opcao e recomendada para seguranca?
- Se usarmos "Bearer Token", nos que definimos o token que a Buonny deve enviar? Ou a Buonny gera?
- Se usarmos "Header personalizado", qual formato? (ex: `X-Buonny-Secret: <valor>`)

### 5.3. Formato do campo `status_pesquisa`
A documentacao mostra `status_pesquisa: "3"` para perfil insuficiente.

**Pergunta:** Podem nos enviar a tabela completa de codigos de `status_pesquisa`? (Ex: 1 = Adequado, 2 = Divergente, 3 = Insuficiente, etc.)

### 5.4. Retentativa de envio do webhook
**Perguntas:**
- Se nosso endpoint estiver fora do ar no momento do envio, a Buonny faz retentativas automaticas?
- Se sim, qual o intervalo e o numero maximo de retentativas?
- Apos esgotadas as tentativas, o retorno fica disponivel apenas via Callback REST (operacao 5)?

### 5.5. Callback REST — Tempo de vida do token temporario
Na autenticacao do Callback (`/api/v3/auth/login`), o retorno e um token temporario.

**Perguntas:**
- Qual o tempo de expiracao (TTL) desse token?
- O corpo do POST de login deve conter apenas o token fixo? Em qual formato? (Ex: `{ "token": "..." }` ou `{ "access_token": "..." }`)
- Ha limite de chamadas por minuto neste endpoint de autenticacao?

---

## 6. Seguranca e Rede

### 6.1. IPs de origem do Webhook
**Pergunta:** A Buonny realiza chamadas ao nosso endpoint de callback a partir de IPs fixos? Se sim, podem nos informar a lista para configurarmos whitelist no nosso firewall/WAF?

### 6.2. IPs de destino (nossas chamadas para Buonny)
**Pergunta:** Nosso ambiente de execucao (Supabase Edge Functions / Deno Deploy) realiza chamadas de IPs dinamicos. Ha necessidade de cadastrar IPs de origem do nosso lado? Ou o acesso e liberado apenas por token?

### 6.3. TLS / Certificados
**Pergunta:** As APIs exigem TLS 1.2+ ? Ha requisitos de certificado client-side (mTLS)?

---

## 7. Limites, SLA e Custos

### 7.1. Rate Limiting
**Pergunta:** Qual o limite de requisicoes por minuto/hora para cada API? Ha diferenca entre homologacao e producao?

### 7.2. SLA de resposta
**Perguntas:**
- Qual o SLA contratado para retorno da Consulta Profissional? (tempo entre envio e resposta sincrona)
- Para fichas que retornam "EM ANALISE", qual o SLA para conclusao da analise e envio do webhook/callback?

### 7.3. Custos por consulta
**Perguntas:**
- Cada chamada a `Consulta Profissional` gera cobranca? Ou o modelo e por ficha/SM?
- Consultas de `Status da Entrega` e `Informacoes Viagem` sao cobradas separadamente?
- Ha relatorio de consumo disponivel no portal?

---

## 8. Dados Complementares Solicitados

Para completar nossa integracao, solicitamos o envio dos seguintes materiais:

| # | Material | Prioridade |
|---|----------|-----------|
| 1 | Tabela completa de codigos `carga_tipo` | Alta |
| 2 | Tabela completa de codigos `status_pesquisa` (webhook) | Alta |
| 3 | Exemplo de payload de login para Callback REST (`/api/v3/auth/login`) | Alta |
| 4 | Lista de IPs de origem dos webhooks (se aplicavel) | Media |
| 5 | Limites de rate limiting por API | Media |
| 6 | Documentacao de erros SOAP (fault codes) | Media |

---

## 9. Nosso Ambiente Tecnico (para referencia)

Para facilitar o suporte, seguem informacoes do nosso ambiente:

- **Plataforma**: Supabase Edge Functions (Deno runtime)
- **Protocolo de saida**: HTTPS (TLS 1.3)
- **IPs de origem**: Dinamicos (infraestrutura Supabase/Deno Deploy)
- **Endpoint para Webhook (proposto)**: `https://[projeto].supabase.co/functions/v1/buonny-callback-handler`
- **Formato esperado no webhook**: JSON (conforme documentacao)
- **Autenticacao preferida no webhook**: Bearer Token ou Header personalizado

---

## 10. Contatos para Alinhamento Tecnico

Nosso time tecnico esta disponivel para reuniao de alinhamento caso necessario.

**Contato tecnico:**
- Nome: [PREENCHER]
- E-mail: [PREENCHER]
- Telefone: [PREENCHER]

---

## 11. API AXA — Integrador Nstech (Criacao de Viagens)

Recebemos tambem a documentacao da **API AXA** (Integrador Nstech) para criacao de viagens/SM no sistema Buonny. Temos as seguintes duvidas:

### 11.1. Endpoint de Homologacao

A documentacao referencia o endpoint de homologacao como um **IP interno**: `https://10.19.0.45:8580/integrador/v1/viagens`.

**Perguntas:**
- Este endpoint e acessivel apenas pela rede interna da Buonny/Nstech? Nosso ambiente (Supabase Edge Functions / Deno Deploy) executa na nuvem e nao tem acesso a IPs internos.
- Existe um **endpoint publico** (subdominio) para homologacao da API AXA? (Ex: `https://tstintegrador.buonny.com.br/integrador/v1/viagens`)
- Em producao, qual sera o endpoint? Segue o mesmo padrao `api.buonny.com.br` ou e um dominio separado da Nstech?

### 11.2. Credenciais e Autenticacao

A documentacao menciona autenticacao via header `Authorization: Bearer {token}` fornecido pela Nstech.

**Perguntas:**
- O token da API AXA e o **mesmo** token de 32 caracteres usado nas APIs SOAP (Consulta Profissional, etc.)? Ou e uma credencial **separada** fornecida pela Nstech?
- Se for separado, precisamos solicitar esse token diretamente a Nstech ou via Buonny?
- O token tem validade/expiracao, ou e fixo como o token SOAP?

### 11.3. Codigos Internos de Referencia

A API AXA exige diversos codigos internos que **nao encontramos nas tabelas de referencia**:

| Campo | Descricao | Duvida |
|-------|-----------|--------|
| `cdcliente` | Codigo do cliente no Integrador | Qual o nosso codigo? Onde consultar? |
| `cdtransp` | Codigo da transportadora | Idem |
| `cdcidorigem` / `cdciddestino` | Codigo da cidade | E o codigo IBGE? Ou codigo interno Buonny? |
| `cdprod` | Codigo do produto | Relacao com `carga_tipo` do SOAP? Ou tabela separada? |
| `cdtipooperacao` | Tipo de operacao | Quais valores possiveis? (ex: 1=Coleta, 2=Entrega?) |
| `cdRotaModelo` | Rota modelo | Este campo e obrigatorio? Onde cadastrar rotas modelo? |
| `cdemprastrcavalo` | Empresa/estrutura do cavalo | Refere-se ao proprietario do veiculo? Como obter este codigo? |

**Perguntas:**
- A documentacao menciona um arquivo `Cidades.pdf` com os codigos de cidades. Podem nos enviar este arquivo?
- Existe uma API ou endpoint para consultar esses codigos programaticamente? Ou sao todos obtidos via portal/cadastro manual?
- Os codigos `cdcliente` e `cdtransp` sao fornecidos no momento da implantacao?

### 11.4. Campos Obrigatorios vs Opcionais

A documentacao lista muitos campos no JSON de criacao de viagem, mas nao indica claramente quais sao **obrigatorios**.

**Perguntas:**
- Podem nos enviar a lista de campos obrigatorios minimos para criar uma viagem via API AXA?
- O campo `ajudantes` (array) e obrigatorio mesmo quando nao ha ajudantes na viagem?
- Os campos de documentacao do motorista (`cnh`, `mopp`, `rg`, `dtValidadeCNH`) sao obrigatorios na criacao da viagem ou ja devem estar pre-cadastrados no sistema Buonny?

### 11.5. Resposta e Codigos de Erro

**Perguntas:**
- Qual o formato da resposta de sucesso da API AXA? A documentacao recebida nao inclui exemplo de response.
- Quais sao os codigos de erro HTTP possiveis? (ex: 400 para campos invalidos, 401 para token expirado, 409 para viagem duplicada?)
- A viagem criada via API AXA gera um `NroOrdTransp` que pode ser consultado nas APIs SOAP (Informacoes Viagem, Status da Entrega)?

### 11.6. Relacao entre API AXA e APIs SOAP

**Pergunta critica:**
- O fluxo correto e: **(1)** criar a viagem/SM via API AXA → **(2)** consultar motorista/veiculo via Consulta Profissional SOAP → **(3)** monitorar via Status da Entrega SOAP? Ou a Consulta Profissional deve ser feita **antes** da criacao da viagem?
- A criacao da viagem via API AXA ja dispara automaticamente a consulta de risco do motorista na Buonny?

---

## 12. SM ViV — Formato CSV de Importacao em Lote

Recebemos tambem a documentacao do formato **SM ViV** (arquivo CSV separado por ponto-e-virgula, 32 colunas) para criacao de SMs em lote.

### 12.1. Status do Formato ViV

**Perguntas:**
- O formato CSV ViV ainda e **ativo e suportado**? Ou esta sendo descontinuado em favor da API AXA?
- Caso ainda seja suportado, qual o mecanismo de upload? (Portal web? FTP? API de upload de arquivo?)
- Existe um retorno/resposta apos o processamento do arquivo? (ex: arquivo de retorno com status de cada linha)

### 12.2. Relacao com API AXA

**Perguntas:**
- O CSV ViV e uma alternativa a API AXA para o mesmo proposito (criacao de SM/viagem)?
- E possivel usar ambos simultaneamente? (ex: API AXA para criacao unitaria em tempo real, CSV ViV para carga em lote historica)
- Os codigos utilizados no CSV (colunas como `Cidade Origem`, `Cidade Destino`) seguem a mesma codificacao da API AXA (`cdcidorigem`) ou usam nomes por extenso?

---

## 13. Dados Complementares Solicitados (Atualizacao)

Alem dos materiais ja solicitados na Secao 8, incluimos os seguintes itens adicionais:

| # | Material | Prioridade |
|---|----------|-----------:|
| 7 | Endpoint publico de homologacao para API AXA (Integrador Nstech) | **Alta** |
| 8 | Token de autenticacao da API AXA (se diferente do token SOAP) | **Alta** |
| 9 | Arquivo `Cidades.pdf` (codigos de cidades do Integrador) | **Alta** |
| 10 | Tabela de codigos internos: `cdcliente`, `cdtransp`, `cdprod`, `cdtipooperacao` | **Alta** |
| 11 | Exemplo de response de sucesso/erro da API AXA | Media |
| 12 | Confirmacao se formato CSV ViV ainda e suportado | Baixa |

---

Agradecemos a atencao e ficamos no aguardo dos esclarecimentos para darmos continuidade a implantacao.

Atenciosamente,
**Equipe de Desenvolvimento — Vectra Cargo**

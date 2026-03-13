---
name: Dockerfile USER WORKDIR Agent
overview: O .cursor/Dockerfile já está com USER ubuntu e WORKDIR /home/ubuntu conforme recomenda a documentação do Cursor para agentes em nuvem. Este plano descreve o que foi feito e como garantir que funcione.
todos: []
isProject: false
---

# Configuração de USER e WORKDIR no Dockerfile para agentes Cursor

## Estado atual

O arquivo `[.cursor/Dockerfile](.cursor/Dockerfile)` já está configurado corretamente:

```13:16:.cursor/Dockerfile
# Non-root user (recommended by Cursor docs)
RUN useradd -m -s /bin/bash ubuntu
USER ubuntu
WORKDIR /home/ubuntu
```

## O que cada parte faz


| Diretiva                             | Função                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `RUN useradd -m -s /bin/bash ubuntu` | Cria o usuário não-root `ubuntu` com home em `/home/ubuntu` e shell bash              |
| `USER ubuntu`                        | Passa a executar os próximos comandos como o usuário `ubuntu` (não como root)         |
| `WORKDIR /home/ubuntu`               | Define o diretório de trabalho como o home do usuário, onde o agente clonará o código |


## Como o Cursor usa esse Dockerfile

- O Cursor procura o Dockerfile em `.cursor/Dockerfile` para ambientes de agentes em nuvem
- Nada precisa ser configurado em `environment.json` ou em `settings.json` para isso
- A ordem é importante: `useradd` roda como root; em seguida `USER` muda para `ubuntu`

## Verificação

Para validar o build:

```powershell
docker build -f .cursor/Dockerfile .
```

Após o build, você pode checar se o usuário e o workdir estão corretos com:

```powershell
docker run --rm -it <image-id> whoami
# Saída esperada: ubuntu

docker run --rm -it <image-id> pwd
# Saída esperada: /home/ubuntu
```

## Resumo

Nenhuma alteração é necessária. O Dockerfile já segue as práticas recomendadas pela documentação do [Cursor (environment-json-dockerfile.md)](https://cursor.com/environment-json-dockerfile.md).
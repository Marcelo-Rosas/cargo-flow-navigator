# CIOT Bridge

Microserviço isolado para orquestrar o `GeradorCIOT.exe` oficial da ANTT.

## Responsabilidade

- Receber requisições HTTP REST da Edge Function `generate-ciot`
- Validar payload com Pydantic
- Executar `GeradorCIOT.exe` via subprocess (Windows)
- Retornar JSON estruturado para a Edge Function

## Stack

- Python 3.10+
- FastAPI
- Pydantic v2
- Uvicorn

## Endpoints

### `POST /ciot`

Body:
```json
{
  "operation": "generate",
  "payload": {
    "cpfCnpj": "41942626000102",
    "transportadorCnpj": "00000000000191",
    "placa": "ABC1D23",
    "valorFrete": 2500.00,
    "pesoTotalKg": 15000.00,
    "ambiente": "homologacao"
  }
}
```

Response:
```json
{
  "success": true,
  "ciotNumber": "12345678901234567890",
  "status": "ATIVO",
  "message": "CIOT gerado com sucesso"
}
```

## Variáveis de Ambiente

| Var | Descrição | Default |
|-----|-----------|---------|
| `CIOT_EXE_PATH` | Caminho para `GeradorCIOT.exe` | `./GeradorCIOT.exe` |
| `CIOT_CERT_SUBJECT` | Subject do certificado digital | `-` |
| `CIOT_TIMEOUT` | Timeout do subprocess (s) | `30` |
| `PORT` | Porta HTTP | `8080` |

## Run

```bash
pip install -r requirements.txt
python main.py
```

## Docker

```bash
docker build -t ciot-bridge .
docker run -p 8080:8080 -e CIOT_EXE_PATH=/app/GeradorCIOT.exe ciot-bridge
```

> ⚠️ Este container requer base Windows para executar o `.exe` da ANTT.

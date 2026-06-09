"""
CIOT Bridge - Microserviço isolado para orquestrar GeradorCIOT.exe
"""

import os
import subprocess
import json
import logging
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, field_validator
from fastapi.responses import JSONResponse

# ─── Config ───────────────────────────────────────────────────────────────────

CIOT_EXE_PATH = os.getenv("CIOT_EXE_PATH", "./GeradorCIOT.exe")
CIOT_TIMEOUT = int(os.getenv("CIOT_TIMEOUT", "30"))
CIOT_CERT_SUBJECT = os.getenv("CIOT_CERT_SUBJECT", "")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("ciot-bridge")

app = FastAPI(title="CIOT Bridge", version="1.0.0")


# ─── Models ───────────────────────────────────────────────────────────────────

class CiotPayload(BaseModel):
    cpfCnpj: str = Field(min_length=11, max_length=14)
    transportadorCnpj: str = Field(min_length=14, max_length=14)
    placa: str = Field(min_length=7, max_length=7)
    valorFrete: float = Field(ge=0)
    pesoTotalKg: float = Field(ge=0)
    ambiente: Literal["homologacao", "producao"]
    distanciaKm: Optional[float] = Field(default=None, ge=0)
    serviceOrderId: Optional[str] = None
    quoteId: Optional[str] = None

    @field_validator("cpfCnpj", "transportadorCnpj")
    @classmethod
    def only_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("must contain only digits")
        return v

    @field_validator("placa")
    @classmethod
    def valid_plate(cls, v: str) -> str:
        import re
        if not re.match(r"^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$", v, re.I):
            raise ValueError("invalid plate format")
        return v.upper()


class CiotRequest(BaseModel):
    operation: Literal["generate", "query", "cancel"]
    payload: CiotPayload


class CiotResponse(BaseModel):
    success: bool
    ciotNumber: Optional[str] = None
    status: Optional[str] = None
    message: Optional[str] = None
    raw: Optional[dict] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def run_generador_ciot(payload: CiotPayload, operation: str) -> dict:
    """
    Executa GeradorCIOT.exe via subprocess.
    Stub: retorna mock quando o .exe não está disponível.
    """
    if not os.path.exists(CIOT_EXE_PATH):
        logger.warning("GeradorCIOT.exe not found at %s — returning stub", CIOT_EXE_PATH)
        # Stub para desenvolvimento/testes
        return {
            "success": True,
            "ciotNumber": f"STUB-{payload.placa}-{int(payload.valorFrete)}-{payload.ambiente.upper()}",
            "status": "ATIVO",
            "message": "CIOT gerado (stub — .exe não encontrado)",
        }

    # Build CLI args conforme DCS da ANTT
    args = [
        CIOT_EXE_PATH,
        "--operation", operation,
        "--cpfCnpj", payload.cpfCnpj,
        "--transportadorCnpj", payload.transportadorCnpj,
        "--placa", payload.placa,
        "--valorFrete", str(payload.valorFrete),
        "--pesoTotalKg", str(payload.pesoTotalKg),
        "--ambiente", payload.ambiente,
    ]
    if CIOT_CERT_SUBJECT:
        args.extend(["--certSubject", CIOT_CERT_SUBJECT])

    logger.info("Running: %s", " ".join(args))

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=CIOT_TIMEOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
    except subprocess.TimeoutExpired:
        logger.error("GeradorCIOT.exe timeout after %ss", CIOT_TIMEOUT)
        raise HTTPException(status_code=504, detail="CIOT generator timeout")
    except Exception as e:
        logger.error("Subprocess error: %s", e)
        raise HTTPException(status_code=500, detail=f"Subprocess error: {e}")

    if result.returncode != 0:
        logger.error("GeradorCIOT.exe error: %s", result.stderr)
        raise HTTPException(
            status_code=502,
            detail=f"GeradorCIOT.exe exited with code {result.returncode}: {result.stderr}",
        )

    # Parse JSON stdout
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        logger.error("Invalid JSON from GeradorCIOT.exe: %s", result.stdout)
        raise HTTPException(status_code=502, detail="Invalid JSON from CIOT generator")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/ciot", response_model=CiotResponse)
async def handle_ciot(req: CiotRequest):
    logger.info("CIOT %s requested for plate=%s", req.operation, req.payload.placa)

    raw = run_generador_ciot(req.payload, req.operation)

    return CiotResponse(
        success=raw.get("success", False),
        ciotNumber=raw.get("ciotNumber"),
        status=raw.get("status"),
        message=raw.get("message"),
        raw=raw,
    )


@app.get("/health")
async def health():
    exe_exists = os.path.exists(CIOT_EXE_PATH)
    return {
        "status": "ok",
        "exe_found": exe_exists,
        "exe_path": CIOT_EXE_PATH,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)

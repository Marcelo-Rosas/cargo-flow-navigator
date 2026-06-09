#!/usr/bin/env python3
"""
TableConvert API CLI — conversão global entre formatos de tabela.

Documentação: https://tableconvert.com/api/#overview
Endpoint base: https://api.tableconvert.com/convert/{converter}

Exemplos:
  tableconvert convert csv-to-markdown -i dados.csv -o tabela.md
  tableconvert convert csv-to-json --stdin < dados.csv
  echo "a,b\\n1,2" | tableconvert convert csv-to-markdown
  tableconvert config set-key SEU_API_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError as exc:  # pragma: no cover
    print(
        "Dependência ausente: requests\n"
        "Instale com: pip install requests",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc

API_BASE_URL = "https://api.tableconvert.com/convert"
CONFIG_DIR_NAME = "tableconvert"
CONFIG_FILE_NAME = "config.json"

POPULAR_CONVERTERS = [
    "csv-to-markdown",
    "csv-to-json",
    "csv-to-html",
    "csv-to-excel",
    "json-to-csv",
    "json-to-markdown",
    "json-to-excel",
    "excel-to-csv",
    "excel-to-json",
    "excel-to-markdown",
    "html-to-csv",
    "html-to-json",
    "html-to-markdown",
    "markdown-to-csv",
    "markdown-to-json",
    "markdown-to-html",
]


def config_dir() -> Path:
    if sys.platform == "win32":
        base = os.environ.get("APPDATA")
        if base:
            return Path(base) / CONFIG_DIR_NAME
    xdg = os.environ.get("XDG_CONFIG_HOME")
    if xdg:
        return Path(xdg) / CONFIG_DIR_NAME
    return Path.home() / ".config" / CONFIG_DIR_NAME


def config_path() -> Path:
    return config_dir() / CONFIG_FILE_NAME


def load_config() -> dict[str, Any]:
    path = config_path()
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Config inválido em {path}: {exc}") from exc


def save_config(data: dict[str, Any]) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def resolve_api_key(explicit: str | None = None) -> str:
    if explicit:
        return explicit.strip()
    env_key = os.environ.get("TABLECONVERT_API_KEY", "").strip()
    if env_key:
        return env_key
    file_key = str(load_config().get("api_key", "")).strip()
    if file_key:
        return file_key
    raise SystemExit(
        "API key não encontrada.\n"
        "Use uma das opções:\n"
        "  1. tableconvert config set-key SEU_API_KEY\n"
        "  2. export TABLECONVERT_API_KEY=SEU_API_KEY\n"
        "  3. tableconvert convert ... --api-key SEU_API_KEY"
    )


def read_input_bytes(args: argparse.Namespace) -> tuple[bytes, str | None]:
    if args.stdin:
        return sys.stdin.buffer.read(), None
    if args.data is not None:
        return args.data.encode("utf-8"), "data.txt"
    if args.input:
        path = Path(args.input)
        if not path.exists():
            raise SystemExit(f"Arquivo não encontrado: {path}")
        return path.read_bytes(), path.name
    raise SystemExit("Informe --input, --data ou --stdin.")


def convert_table(
    converter: str,
    payload: bytes,
    filename: str | None,
    api_key: str,
    extra_fields: dict[str, str],
) -> str:
    url = f"{API_BASE_URL}/{converter.strip().lstrip('/')}"
    headers = {"Authorization": f"Bearer {api_key}"}

    files: dict[str, Any] = {}
    data: dict[str, str] = dict(extra_fields)

    if filename:
        files["file"] = (filename, payload)
    else:
        data["data"] = payload.decode("utf-8")

    # multipart/form-data exige `files` (mesmo vazio) para bater com a API.
    response = requests.post(url, headers=headers, data=data, files=files or None, timeout=120)
    response.raise_for_status()

    try:
        body = response.json()
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Resposta não-JSON da API ({response.status_code}): {response.text[:500]}") from exc

    code = body.get("code", response.status_code)
    message = body.get("message", "")
    if code != 200:
        raise SystemExit(f"Erro da API ({code}): {message or body}")

    result = body.get("data")
    if result is None:
        raise SystemExit(f"API retornou sucesso sem conteúdo: {body}")
    if not isinstance(result, str):
        return json.dumps(result, ensure_ascii=False, indent=2)
    return result


def cmd_convert(args: argparse.Namespace) -> None:
    api_key = resolve_api_key(args.api_key)
    payload, filename = read_input_bytes(args)
    if not payload:
        raise SystemExit("Entrada vazia.")

    extra_fields = {}
    for item in args.field:
        if "=" not in item:
            raise SystemExit(f"Campo inválido (use chave=valor): {item}")
        key, value = item.split("=", 1)
        extra_fields[key.strip()] = value

    output = convert_table(args.converter, payload, filename, api_key, extra_fields)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        print(f"Salvo em {out_path}", file=sys.stderr)
    else:
        sys.stdout.write(output)
        if not output.endswith("\n"):
            sys.stdout.write("\n")


def cmd_config_set_key(args: argparse.Namespace) -> None:
    data = load_config()
    data["api_key"] = args.api_key.strip()
    save_config(data)
    print(f"API key salva em {config_path()}")


def cmd_config_show(_: argparse.Namespace) -> None:
    path = config_path()
    env_set = bool(os.environ.get("TABLECONVERT_API_KEY", "").strip())
    file_key = str(load_config().get("api_key", "")).strip()
    print(f"Config: {path}")
    print(f"Env TABLECONVERT_API_KEY: {'definida' if env_set else 'não definida'}")
    if file_key:
        masked = file_key[:4] + "..." + file_key[-4:] if len(file_key) > 8 else "***"
        print(f"Arquivo config: {masked}")
    else:
        print("Arquivo config: não definida")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="tableconvert",
        description="CLI global para a API TableConvert (370+ conversores).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    convert = sub.add_parser("convert", help="Converte dados entre formatos")
    convert.add_argument(
        "converter",
        help="Slug do conversor, ex.: csv-to-markdown, json-to-csv",
    )
    src = convert.add_mutually_exclusive_group(required=True)
    src.add_argument("-i", "--input", help="Arquivo de entrada")
    src.add_argument("-d", "--data", help="Conteúdo inline como string")
    src.add_argument("--stdin", action="store_true", help="Lê entrada do stdin")
    convert.add_argument("-o", "--output", help="Arquivo de saída (stdout se omitido)")
    convert.add_argument("--api-key", help="API key (sobrescreve env/config)")
    convert.add_argument(
        "-F",
        "--field",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="Campo extra multipart/form-data",
    )
    convert.set_defaults(func=cmd_convert)

    config = sub.add_parser("config", help="Gerencia configuração global")
    config_sub = config.add_subparsers(dest="config_command", required=True)

    set_key = config_sub.add_parser("set-key", help="Salva API key no config global")
    set_key.add_argument("api_key")
    set_key.set_defaults(func=cmd_config_set_key)

    show = config_sub.add_parser("show", help="Mostra origem da API key")
    show.set_defaults(func=cmd_config_show)

    path = config_sub.add_parser("path", help="Imprime caminho do arquivo de config")
    path.set_defaults(func=lambda _: print(config_path()))

    list_cmd = sub.add_parser("list", help="Lista conversores populares")
    list_cmd.set_defaults(
        func=lambda _: print("\n".join(POPULAR_CONVERTERS)),
    )

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

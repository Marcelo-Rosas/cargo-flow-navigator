#!/bin/bash
# review.sh — Revisão de decisões registradas em decisions.csv
#
# Uso:
#   bash scripts/review.sh                  # Todas as decisões
#   bash scripts/review.sh --pending        # Status != ACCEPTED
#   bash scripts/review.sh --recent 5       # Últimas 5 decisões
#   bash scripts/review.sh --category ai    # Filtrar por categoria
#   bash scripts/review.sh --due            # Revisões com data vencida

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CSV="$SCRIPT_DIR/../decisions.csv"

if [ ! -f "$CSV" ]; then
  echo "Erro: decisions.csv não encontrado em $(dirname "$CSV")"
  exit 1
fi

MODE=""
VALUE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --pending)   MODE="pending"; shift ;;
    --due)       MODE="due"; shift ;;
    --recent)    MODE="recent"; VALUE="${2:-5}"; shift 2 ;;
    --category)  MODE="category"; VALUE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Uso: review.sh [--pending|--due|--recent N|--category NOME]"
      exit 0
      ;;
    *) echo "Flag desconhecida: $1"; exit 1 ;;
  esac
done

TODAY=$(date +%Y-%m-%d)

case "$MODE" in
  pending)
    echo "=== DECISÕES PENDENTES (status != ACCEPTED) ==="
    awk -F',' 'NR>1 && $7!="ACCEPTED" {printf "%s | %-12s | %s | %s\n", $1, $2, $3, $7}' "$CSV"
    ;;
  due)
    echo "=== DECISÕES COM REVISÃO VENCIDA (data_revisao <= $TODAY) ==="
    awk -F',' -v today="$TODAY" 'NR>1 && $6<=today {printf "%s | %-12s | %s | revisao: %s | %s\n", $1, $2, $3, $6, $7}' "$CSV"
    ;;
  recent)
    echo "=== ÚLTIMAS $VALUE DECISÕES ==="
    tail -n "$VALUE" "$CSV" | awk -F',' '{printf "%s | %-12s | %s | %s\n", $1, $2, $3, $7}'
    ;;
  category)
    echo "=== DECISÕES NA CATEGORIA: $VALUE ==="
    awk -F',' -v cat="$VALUE" 'NR>1 && $2==cat {printf "%s | %-12s | %s | %s\n", $1, $2, $3, $7}' "$CSV"
    ;;
  *)
    echo "=== TODAS AS DECISÕES ==="
    awk -F',' 'NR>1 {printf "%s | %-12s | %s | %s\n", $1, $2, $3, $7}' "$CSV"
    ;;
esac

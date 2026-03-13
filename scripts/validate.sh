#!/usr/bin/env bash
set -euo pipefail

npm run lint
npm run build
npm run test:e2e

echo "Terminal-First Validation concluída com sucesso."

#!/bin/bash
# Validação de componentes e Design System

echo "🎨 Verificando integridade visual..."

# Impede o esquecimento de imports de componentes UI como o Badge
ERR_IMPORTS=$(grep -r "<Badge" src/components/ | xargs grep -L "import { Badge }")

if [ ! -z "$ERR_IMPORTS" ]; then
  echo "❌ ERRO: Componente Badge usado sem import em: $ERR_IMPORTS"
  exit 1
fi

# Garante o uso das cores da marca (primary) em vez de cores hexadecimais soltas
if grep -r "#" src/components/ --exclude-dir=ui | grep -v "color:"; then
  echo "⚠️ AVISO: Detectado uso de HEX direto. Use as classes tailwind da Vectra (ex: bg-primary)."
fi

echo "✅ Design System validado."
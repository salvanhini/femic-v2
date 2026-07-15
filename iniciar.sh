#!/bin/bash
# FEMIC v2 - Iniciar sistema
# Uso: bash iniciar.sh

cd "$(dirname "$0")"

# Instalar Node.js se não tiver
if ! command -v node &> /dev/null; then
    echo "Instalando Node.js..."
    sudo apt update -qq && sudo apt install -y -qq nodejs npm
fi

# Instalar dependências se não tiver
if [ ! -d "node_modules" ]; then
    echo "Instalando dependências..."
    npm install
fi

echo ""
echo "FEMIC v2 rodando em: http://localhost:5173/femic-v2/"
echo "Para parar: Ctrl+C"
echo ""

npm run dev

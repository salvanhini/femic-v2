#!/bin/bash
# FEMIC v2 - Deploy para Discloud
# Uso: bash deploy-discloud.sh

echo "================================"
echo "  FEMIC v2 - Deploy Discloud"
echo "================================"
echo ""

cd "$(dirname "$0")"

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "[/] Instalando Node.js..."
    sudo apt update -qq && sudo apt install -y -qq nodejs npm
fi

echo "[OK] Node.js $(node --version)"

# Instalar dependências
if [ ! -d "node_modules" ]; then
    echo "[/] Instalando dependências..."
    npm install
fi

# Build
echo "[/] Gerando build..."
npm run build

if [ $? -ne 0 ]; then
    echo "[X] Erro no build"
    exit 1
fi

echo "[OK] Build gerado em dist/"

# Criar zip para Discloud
echo "[/] Criando pacote para Discloud..."
rm -f femic-v2-discloud.zip
zip -r femic-v2-discloud.zip dist/ server.js discloud.config package.json package-lock.json

echo ""
echo "================================"
echo "  PRONTO!"
echo ""
echo "  Arquivo: femic-v2-discloud.zip"
echo ""
echo "  Para subir no Discloud:"
echo "  1. Acesse app.discloud.com"
echo "  2. Clique em 'Importar .zip'"
echo "  3. Selecione o arquivo femic-v2-discloud.zip"
echo "================================"

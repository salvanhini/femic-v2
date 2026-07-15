#!/bin/bash
# FEMIC v2 - Deploy para GitHub Pages
# Uso: bash github-deploy.sh

set -e

cd "$(dirname "$0")"

echo "================================"
echo "  FEMIC v2 - Deploy GitHub"
echo "================================"
echo ""

# 1. Configurar git
read -rp "Seu email do GitHub: " GIT_EMAIL
read -rp "Seu nome no GitHub: " GIT_NAME
git config --global user.email "$GIT_EMAIL"
git config --global user.name "$GIT_NAME"

echo ""
echo "Crie um Personal Access Token:"
echo "1. Acesse: https://github.com/settings/tokens"
echo "2. Clique: Generate new token (classic)"
echo "3. Marque: repo + workflow"
echo "4. Gere e copie o token"
echo ""
read -rsp "Cole o token (não vai aparecer): " TOKEN
echo ""

# 2. Remover remote antigo e configurar novo
git remote remove origin 2>/dev/null || true
git remote add origin "https://salvanhini@github.com/salvanhini/femic-v2.git"

# 3. Salvar token para não pedir de novo
git config --global credential.helper store
echo "https://salvanhini:${TOKEN}@github.com" > ~/.git-credentials
chmod 600 ~/.git-credentials

# 4. Commit e push
git add .
git commit -m "deploy: github pages" 2>/dev/null || echo "Nada novo para commit"
git push -u origin main --force

echo ""
echo "================================"
echo "  PRONTO! Acesse:"
echo "  https://salvanhini.github.io/femic-v2/"
echo "================================"

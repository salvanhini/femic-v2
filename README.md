# FEMIC v2

Sistema de gestão clínica para fisioterapia: agenda, pacientes, prontuário, serviços, pacotes e lembretes.

## Rodar no computador

É necessário ter o [Node.js LTS](https://nodejs.org/) instalado.

```bash
npm install
npm run dev
```

Abra o endereço exibido no terminal (normalmente `http://localhost:5173/femic-v2/`).

No primeiro acesso, informe a URL e a **anon key** do seu projeto Supabase. Essas informações ficam salvas apenas no navegador. Não use a `service_role key` no site.

## Publicar no GitHub — passo a passo simples

### 1. Criar o repositório

1. Entre em [github.com/new](https://github.com/new).
2. Use o nome `femic-v2` (o endereço e a configuração do aplicativo já usam esse nome).
3. Se o projeto já está nesta pasta, deixe desmarcadas as opções de adicionar README, `.gitignore` e licença.
4. Clique em **Create repository**.

### 2. Enviar o projeto

No terminal, dentro desta pasta, execute os comandos abaixo. Troque apenas `SEU_USUARIO` pelo seu usuário do GitHub.

```bash
git add .
git commit -m "Primeira versão do FEMIC"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/femic-v2.git
git push -u origin main
```

Se o repositório já tiver um `origin`, confira-o com `git remote -v`. Para trocá-lo, use:

```bash
git remote set-url origin https://github.com/SEU_USUARIO/femic-v2.git
git push -u origin main
```

> Nunca cole token/senha em scripts ou arquivos do projeto. Quando o GitHub solicitar autenticação, prefira entrar pelo navegador ou usar o GitHub Desktop.

### 3. Ativar o site

Depois do primeiro `push`:

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
3. Abra a aba **Actions** e aguarde o fluxo **Publicar no GitHub Pages** terminar.
4. O endereço será `https://SEU_USUARIO.github.io/femic-v2/`.

Nas próximas atualizações, basta executar:

```bash
git add .
git commit -m "Descreva sua alteração"
git push
```

O site será publicado automaticamente.

## Supabase no GitHub Pages (opcional)

Para não precisar preencher a configuração no primeiro acesso de cada navegador, crie os secrets do repositório em **Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Eles são incluídos no build pelo GitHub Actions. A anon key é apropriada para clientes web desde que as políticas RLS do Supabase estejam configuradas; a `service_role key` nunca deve ser usada aqui.

## Comandos úteis

```bash
npm run build      # cria a versão de produção em dist/
npm run lint       # verifica estilo do código
npm run typecheck  # verifica tipos TypeScript
npm run test:run   # executa os testes
```

## Tecnologias

- React 18, TypeScript e Vite
- Tailwind CSS e componentes Radix
- Supabase (autenticação e banco de dados)
- React Router, TanStack Query e date-fns

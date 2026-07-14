# FEMIC v2

Sistema de gestão clínica para fisioterapia — agenda inteligente, prontuário digital e integração Supabase.

## Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** (auth + banco de dados)
- **date-fns** (datas em português)
- **React Router** + **TanStack Query**

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

O deploy é feito automaticamente via GitHub Actions ao fazer push na branch `main`.

Configure os secrets no GitHub:
- `VITE_SUPABASE_URL` — URL do projeto Supabase
- `VITE_SUPABASE_ANON_KEY` — Anon key do Supabase

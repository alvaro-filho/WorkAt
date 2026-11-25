# WorkAt — frontend

Interface do WorkAt: perfil estilo GitHub, projetos (pessoal, cooperativo e corporativo com NDA), tarefas com
Canvas e entregas, e o feed Explorar.

Stack: React 19, TypeScript, Vite, TanStack Router/Start, Tailwind CSS e componentes Radix (shadcn/ui).

## Rodar localmente

Pré-requisito: o backend (`../backend`) rodando em `http://localhost:8080`.

```bash
npm install
npm run dev
```

O site abre em `http://localhost:8081` e o Vite repassa as chamadas `/api` para o backend.

## Build

```bash
npm run build
```

No computador, o build gera um servidor Node em `.output/`. No Vercel, o mesmo comando gera a saída do Vercel
automaticamente (o preset é detectado pelo ambiente).

## Deploy no Vercel

- **Root Directory:** `art-hub-canvas`
- **Framework Preset:** TanStack Start
- **Build / Output / Install:** padrão (não precisa sobrescrever)
- **Environment Variables:** `API_URL` = endereço público do backend, sem barra no final
  (ex.: `https://workat-api.exemplo.com`). As chamadas `/api/**` do site são repassadas para esse endereço.

Sem `API_URL`, o site abre, mas o login e os dados não funcionam, porque o backend Spring Boot não roda no Vercel.

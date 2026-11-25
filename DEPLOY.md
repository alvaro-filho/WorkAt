# Deploy do WorkAt (grátis)

| Peça | Onde | Endereço final (exemplo) |
| --- | --- | --- |
| Banco PostgreSQL | Neon (plano Free) | `ep-xxxx.sa-east-1.aws.neon.tech` |
| Backend Spring Boot | Render (Web Service, plano Free, Docker) | `https://workat-api.onrender.com` |
| Frontend | Vercel (plano Hobby) | `https://work-at.vercel.app` |

O frontend repassa tudo o que é `/api/**` para o backend (variável `API_URL` no Vercel), então o navegador só
fala com o Vercel e não há configuração de CORS.

> Os planos grátis mudam com o tempo: confira os limites atuais nas páginas de preço de cada serviço.

---

## 0. Antes de começar

1. Faça o merge do branch `new_dev_alvaro` no `master` (Pull Request no GitHub). O Render e o Vercel publicam
   o `master`.
2. No Lovable, desconecte o projeto do GitHub (o repositório não é mais compatível com ele).

## 1. Banco no Neon

1. Entre em [neon.tech](https://neon.tech) com a sua conta do GitHub e crie um projeto chamado `workat`.
   - Postgres: a versão padrão.
   - Região: a mais próxima do Brasil disponível (ex.: AWS São Paulo).
2. No painel do projeto, abra **Connect** (detalhes da conexão):
   - Deixe **Connection pooling desligado** (conexão direta, sem `-pooler` no host).
   - Anote o **host**, o **banco** (geralmente `neondb`), o **usuário** e a **senha**.
3. Monte o endereço JDBC (troque host e banco pelos seus):

   ```
   jdbc:postgresql://ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```

Não precisa criar tabelas: o backend cria tudo sozinho na primeira vez que liga.

## 2. Segredo do JWT

Gere um segredo aleatório no PowerShell e guarde (não coloque no GitHub):

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

## 3. Backend no Render

1. Entre em [render.com](https://render.com) com a sua conta do GitHub e autorize o acesso ao repositório.
2. Clique em **New → Blueprint** e escolha o repositório. O Render lê o arquivo `render.yaml` da raiz e
   mostra o serviço `workat-api` (Docker, plano Free, pasta `backend`).
3. Preencha as variáveis que ele pedir:

   | Variável | Valor |
   | --- | --- |
   | `DB_URL` | o endereço JDBC do passo 1 |
   | `DB_USERNAME` | o usuário do Neon |
   | `DB_PASSWORD` | a senha do Neon |
   | `ARTHUB_DEV_JWT_SECRET` | o segredo do passo 2 |

4. Clique em **Apply** e espere o primeiro deploy (o build do Docker leva alguns minutos).
5. Teste no navegador: `https://<nome-do-serviço>.onrender.com/api/v1/showcase/public`.
   A resposta esperada é `[]` (lista vazia) ou a lista de artes.

Sem o Blueprint (criando na mão): **New → Web Service**, repositório, **Root Directory** `backend`,
**Language** Docker, **Instance Type** Free, as mesmas variáveis e **Health Check Path**
`/api/v1/showcase/public`.

## 4. Frontend no Vercel

Na tela de importação do projeto:

- **Root Directory:** `art-hub-canvas`
- **Framework Preset:** TanStack Start
- **Build / Output / Install:** padrão
- **Environment Variables:** `API_URL` = `https://<nome-do-serviço>.onrender.com` (sem barra no final)

Clique em **Deploy**. Se o projeto já existir, adicione a variável em **Settings → Environment Variables** e
faça **Redeploy**.

Teste: abra o site, crie uma conta e um projeto.

## 5. Limites do plano grátis (importante para a apresentação)

- **O backend dorme** depois de ~15 min sem acesso. O primeiro acesso leva de 30 s a 1 min. No dia, abra o site
  uns 5 minutos antes e faça login para acordar o servidor.
- **Arquivos enviados são temporários**: o disco do Render grátis é apagado a cada deploy ou reinício. Projetos,
  tarefas e textos ficam no banco; imagens e entregas precisam ser enviadas de novo depois de um reinício.
  (Solução definitiva, para depois: guardar os arquivos num storage como Cloudflare R2 ou Supabase Storage.)
- **Memória**: o plano tem 512 MB; o `Dockerfile` já limita a JVM para caber.

## Plano B: backend no seu PC com túnel

Se o Render estiver lento na hora, rode o backend no seu computador e crie um endereço público temporário com a
Cloudflare (grátis, sem conta):

```powershell
winget install --id Cloudflare.cloudflared
```

```powershell
cloudflared tunnel --url http://localhost:8080
```

Copie o endereço `https://....trycloudflare.com` que aparecer, coloque em `API_URL` no Vercel e faça Redeploy.
O endereço muda toda vez que o comando roda, e o PC precisa ficar ligado.

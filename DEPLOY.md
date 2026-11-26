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
   - Região: AWS São Paulo (escolhida pela equipe). O Render grátis não tem servidor no Brasil e roda em
     Virginia, então cada consulta atravessa o continente: as telas ficam um pouco mais lentas, mas funcionam.
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
5. Teste no navegador: `https://<nome-do-serviço>.onrender.com/api/v1/health`.
   A resposta esperada é `{"status":"ok"}`.

Sem o Blueprint (criando na mão): **New → Web Service**, repositório, **Root Directory** `backend`,
**Language** Docker, **Instance Type** Free, as mesmas variáveis e **Health Check Path**
`/api/v1/health`. Em um serviço já criado, troque em **Settings → Health Check Path**.

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

- **O backend dorme** depois de ~15 min sem acesso, e o primeiro acesso leva de 30 s a 1 min. O site mostra
  "Acordando o servidor…" enquanto isso. Para ele não dormir, veja o passo 7.
- **Arquivos enviados**: sem o passo 6, ficam no disco do Render grátis, que é apagado a cada deploy ou
  reinício (imagens e entregas somem; projetos, tarefas e textos ficam no banco). Com o passo 6, ficam num
  bucket e sobrevivem a tudo.
- **Memória**: o plano tem 512 MB; o `Dockerfile` já limita a JVM para caber.

## 6. Arquivos permanentes (bucket compatível com S3)

O backend guarda os arquivos num bucket quando `ARTHUB_STORAGE_TYPE=s3`. Funciona com qualquer serviço
compatível com S3. Dois com plano grátis (confira os limites e se pedem cartão nas páginas de preço):

**Cloudflare R2**

1. No painel da Cloudflare: **R2 Object Storage → Create bucket**, nome `workat` (localização automática).
2. **R2 → Manage API tokens → Create API token**, permissão **Object Read & Write** só para o bucket `workat`.
   Anote o **Access Key ID**, o **Secret Access Key** e o endpoint
   `https://<ID-da-conta>.r2.cloudflarestorage.com`.
3. Variáveis no Render (**Environment**):

   | Variável | Valor |
   | --- | --- |
   | `ARTHUB_STORAGE_TYPE` | `s3` |
   | `ARTHUB_S3_ENDPOINT` | `https://<ID-da-conta>.r2.cloudflarestorage.com` |
   | `ARTHUB_S3_REGION` | `auto` |
   | `ARTHUB_S3_BUCKET` | `workat` |
   | `ARTHUB_S3_ACCESS_KEY` | o Access Key ID |
   | `ARTHUB_S3_SECRET_KEY` | o Secret Access Key |

**Supabase Storage**

1. No projeto do Supabase: **Storage → New bucket**, nome `workat`, **privado**.
2. **Storage → Settings → S3 Connection**: ative, anote o **Endpoint** e a **Region**, e crie uma
   **Access key** (anote o Access Key ID e o Secret).
3. Mesmas variáveis da tabela acima, com o endpoint e a região do Supabase.

Opcionais: `ARTHUB_S3_PREFIX` (pasta dentro do bucket, ex.: `uploads`) e `ARTHUB_S3_PATH_STYLE`
(`true` por padrão, que serve para R2, Supabase e MinIO).

Depois de salvar, o Render reinicia o serviço. No log deve aparecer
`Arquivos enviados ficam em: bucket S3 "workat"`. Se faltar alguma variável, o backend **não sobe** e o log
diz qual (melhor do que perder arquivos sem perceber). O bucket fica privado: as imagens públicas continuam
passando pelo backend, que confere quem pode ver cada uma.

Arquivos enviados antes de ligar o bucket não são copiados (no Render eles já se perdem a cada reinício);
envie de novo os que importam.

## 7. Manter o backend acordado

O workflow `.github/workflows/manter-acordado.yml` chama `/api/v1/health` a cada 10 minutos, e o Render grátis
não chega a dormir. Ele roda sozinho depois do merge no `master` (aba **Actions** do GitHub; dá para rodar na
mão em **Run workflow**).

- Por padrão chama `https://work-at-chi.vercel.app/api/v1/health`. Para outro endereço, crie a variável
  `WORKAT_HEALTH_URL` em **Settings → Secrets and variables → Actions → Variables**.
- `/api/v1/health` não usa o banco: o Neon continua dormindo quando ninguém usa (economiza as horas grátis).
- Ligado o mês todo, o serviço gasta ~720 das 750 horas grátis mensais do Render. Se houver outros serviços
  grátis na mesma conta, as horas são somadas.
- Se o repositório ficar 60 dias sem commits, o GitHub pausa o agendamento; reative na aba **Actions**.

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

"""
Auditoria local do WorkAt: cria um grupo de usuários e testa cada função da API.

Grupo:
  Empresa      aurora  (COMPANY)  -> projeto corporativo "Jogo Aurora" (NDA ligado) e "Campanha Aurora" (sem NDA)
  Contratados  bia, caio, duda (ARTIST) -> entram nos projetos da empresa
  Não contratados  eva, fabio (ARTIST) -> eva cria o cooperativo "Quadrinho Coop" e convida fabio

Uso (backend rodando em localhost:8080, banco de TESTE):
    python -I scripts/auditoria_local.py
Pode rodar de novo: os usuários são reaproveitados e os projetos ganham um sufixo novo.
Senha dos usuários de teste (só para o banco local): AUDIT_PASSWORD abaixo.
"""
import json, secrets, struct, sys, urllib.error, urllib.request, uuid, zlib
from datetime import date, timedelta

BASE = "http://localhost:8080/api/v1"
AUDIT_PASSWORD = "Auditoria#2026"
sfx = secrets.token_hex(2)
results = []  # (secao, label, ok, detalhe)
section = "geral"


def call(method, path, token=None, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, method=method, data=data)
    if data is not None:
        req.add_header("Content-Type", ctype)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            content = r.read()
            return r.status, decode(content, r.headers), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, decode(e.read(), e.headers), dict(e.headers)


def decode(content, headers):
    if "json" in (headers.get("Content-Type") or ""):
        try:
            return json.loads(content.decode())
        except Exception:
            pass
    if not content:
        return None
    try:
        return content.decode()
    except UnicodeDecodeError:
        return content


def sec(name):
    global section
    section = name
    print(f"\n== {name} ==")


def check(label, got, expected, extra=""):
    ok = got == expected
    results.append((section, label, ok, "" if ok else f"veio {got!r}, esperado {expected!r} {extra}".strip()))
    print(("OK    " if ok else "FALHOU"), f"{label}: {got!r}" + ("" if ok else f" (esperado {expected!r}) {extra}"))
    return ok


def upload(token, task, name, content, final=False):
    bnd = uuid.uuid4().hex
    body = (f"--{bnd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n"
            f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + (
        f"\r\n--{bnd}\r\nContent-Disposition: form-data; name=\"final\"\r\n\r\n"
        f"{'true' if final else 'false'}\r\n--{bnd}--\r\n").encode()
    return call("POST", f"/tasks/{task}/files", token, raw=body, ctype=f"multipart/form-data; boundary={bnd}")


def png(r=255, g=0, b=0, size=64):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    row = b"\x00" + bytes([r, g, b]) * size
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(row * size)) + chunk(b"IEND", b""))


def user(username, name, role):
    email = f"{username}@workat.test"
    s, b, _ = call("POST", "/auth/register", body={"fullName": name, "username": username, "email": email,
                                                    "password": AUDIT_PASSWORD, "role": role})
    if s != 201:
        s, b, _ = call("POST", "/auth/login", body={"email": email, "password": AUDIT_PASSWORD})
    if s not in (200, 201):
        print("Não consegui criar/entrar com", username, s, b)
        sys.exit(1)
    return b["token"], b["user"]


def invite_accept(owner_tok, pid, invitee_tok, invitee):
    s, inv, _ = call("POST", f"/projects/{pid}/invitations", owner_tok, {"email": invitee["email"]})
    s2, _, _ = call("POST", f"/invitations/{inv['id']}/accept", invitee_tok) if s == 201 else (s, None, None)
    return s, s2, inv


# ------------------------------------------------------------------ 1. Autenticação
sec("1. Cadastro e login")
s, _, _ = call("POST", "/auth/register", body={"fullName": "X", "username": f"x_{sfx}", "email": f"x{sfx}@workat.test",
                                              "password": "123", "role": "ARTIST"})
check("senha curta é recusada", s, 400)
s, _, _ = call("POST", "/auth/register", body={"fullName": "X", "username": f"x_{sfx}", "email": "nao-e-email",
                                              "password": AUDIT_PASSWORD, "role": "ARTIST"})
check("e-mail inválido é recusado", s, 400)
s, _, _ = call("POST", "/auth/register", body={"fullName": "X", "username": f"x_{sfx}", "email": f"x{sfx}@workat.test",
                                              "password": AUDIT_PASSWORD, "role": "ADMIN"})
check("papel inválido é recusado", s, 400)

ta, ua = user("aurora", "Estúdio Aurora", "COMPANY")
tb, ub = user("bia", "Bia Contratada", "ARTIST")
tc, uc = user("caio", "Caio Contratado", "ARTIST")
td, ud = user("duda", "Duda Contratada", "ARTIST")
te, ue = user("eva", "Eva Independente", "ARTIST")
tf, uf = user("fabio", "Fabio Independente", "ARTIST")
check("empresa tem papel COMPANY", ua["role"], "COMPANY")
check("artista tem papel ARTIST", ub["role"], "ARTIST")

s, _, _ = call("POST", "/auth/register", body={"fullName": "Dup", "username": f"dup_{sfx}", "email": ub["email"],
                                              "password": AUDIT_PASSWORD, "role": "ARTIST"})
check("e-mail repetido é recusado", s, 409)
s, _, _ = call("POST", "/auth/register", body={"fullName": "Dup", "username": "bia", "email": f"dup{sfx}@workat.test",
                                              "password": AUDIT_PASSWORD, "role": "ARTIST"})
check("username repetido é recusado", s, 409)
s, _, _ = call("POST", "/auth/login", body={"email": ub["email"], "password": "errada123"})
check("login com senha errada", s, 401)
s, _, _ = call("POST", "/auth/login", body={"email": "ninguem@workat.test", "password": AUDIT_PASSWORD})
check("login com e-mail inexistente", s, 401)
s, b, _ = call("POST", "/auth/login", body={"email": ub["email"].upper(), "password": AUDIT_PASSWORD})
check("login com e-mail em maiúsculas", s, 200)
s, b, _ = call("POST", "/auth/register", body={"fullName": "Gabi", "username": f"gabi_{sfx}",
                                              "email": f"Gabi.{sfx}@WorkAt.Test", "password": AUDIT_PASSWORD,
                                              "role": "ARTIST"})
check("cadastro com e-mail em maiúsculas salva em minúsculas", (s, (b or {}).get("user", {}).get("email")),
      (201, f"gabi.{sfx}@workat.test"))
s, _, _ = call("POST", "/auth/login", body={"email": f"  GABI.{sfx}@workat.test ", "password": AUDIT_PASSWORD})
check("login com maiúsculas e espaços", s, 200)
s, _, _ = call("POST", "/auth/register", body={"fullName": "Gabi2", "username": f"gabi2_{sfx}",
                                              "email": f"gabi.{sfx}@workat.test", "password": AUDIT_PASSWORD,
                                              "role": "ARTIST"})
check("mesmo e-mail com outra caixa é recusado", s, 409)
s, b, _ = call("POST", "/auth/login", body={"email": ub["email"], "password": "errada123"})
s2, b2, _ = call("POST", "/auth/login", body={"email": "ninguem@workat.test", "password": AUDIT_PASSWORD})
check("mesma mensagem p/ senha errada e e-mail inexistente", b == b2, True, f"{b!r} x {b2!r}")
s, _, _ = call("GET", "/projects")
check("rota protegida sem token", s in (401, 403), True)
s, _, _ = call("GET", "/projects", "token.invalido.aqui")
check("rota protegida com token inválido", s in (401, 403), True)

# ------------------------------------------------------------------ 2. Projetos
sec("2. Projetos")
s, corp, _ = call("POST", "/projects", ta, {"name": "Jogo Aurora", "slug": f"jogo-aurora-{sfx}", "type": "CORPORATE",
                                            "description": "Jogo de aventura (NDA)"})
check("empresa cria corporativo", (s, corp.get("type"), corp.get("myRole")), (201, "CORPORATE", "OWNER"))
s, camp, _ = call("POST", "/projects", ta, {"name": "Campanha Aurora", "slug": f"campanha-aurora-{sfx}",
                                            "type": "CORPORATE"})
check("empresa cria 2º corporativo (sem NDA)", s, 201)
s, coop, _ = call("POST", "/projects", te, {"name": "Quadrinho Coop", "slug": f"quadrinho-coop-{sfx}",
                                            "type": "COOPERATIVE", "description": "HQ feita a quatro mãos"})
check("não contratada cria cooperativo", (s, coop.get("type")), (201, "COOPERATIVE"))
s, pess, _ = call("POST", "/projects", tf, {"name": "Estudos do Fabio", "slug": f"estudos-fabio-{sfx}"})
check("projeto sem tipo vira PERSONAL", (s, pess.get("type")), (201, "PERSONAL"))
s, _, _ = call("POST", "/projects", tf, {"name": "Outro", "slug": f"estudos-fabio-{sfx}"})
check("slug repetido é recusado", s, 409)
s, _, _ = call("POST", "/projects", tf, {"name": "", "slug": f"vazio-{sfx}"})
check("nome vazio é recusado", s, 400)
s, _, _ = call("POST", "/projects", tb, {"name": "Corp da Bia", "slug": f"corp-bia-{sfx}", "type": "CORPORATE"})
check("artista pode criar corporativo? (regra de negócio)", s, 201, "(confirmar regra)")
if s == 201:
    bp = _
s, lst, _ = call("GET", "/projects", ta)
check("empresa lista seus 2 projetos", sorted(p["name"] for p in lst if p["id"] in (corp["id"], camp["id"])),
      ["Campanha Aurora", "Jogo Aurora"])
s, _, _ = call("GET", f"/projects/{corp['id']}", te)
check("quem não participa recebe 404", s, 404)
s, pr, _ = call("PATCH", f"/projects/{corp['id']}/settings", ta, {"ndaEnabled": True})
check("empresa liga NDA", (s, pr.get("ndaEnabled")), (200, True))
s, pr, _ = call("PATCH", f"/projects/{coop['id']}/settings", te, {"ndaEnabled": True})
check("NDA no cooperativo é ignorado/recusado", (s == 400) or (pr or {}).get("ndaEnabled") is False, True, f"status {s}")

# ------------------------------------------------------------------ 3. Convites
sec("3. Convites e membros")
for tok, u in ((tb, ub), (tc, uc), (td, ud)):
    s1, s2, _ = invite_accept(ta, corp["id"], tok, u)
    check(f"empresa convida e {u['username']} aceita (Jogo)", (s1, s2), (201, 200))
s1, s2, _ = invite_accept(ta, camp["id"], tc, uc)
check("caio também entra na Campanha", (s1, s2), (201, 200))
s, inv_f, _ = call("POST", f"/projects/{coop['id']}/invitations", te, {"email": uf["email"]})
check("eva convida fabio para o cooperativo", s, 201)
s, lst, _ = call("GET", "/invitations", tf)
check("fabio vê o convite pendente", [i["projectName"] for i in lst] if s == 200 else s, ["Quadrinho Coop"])
s, _, _ = call("POST", f"/invitations/{inv_f['id']}/accept", tb)
check("outra pessoa não aceita convite alheio", s in (403, 404), True, f"status {s}")
s, _, _ = call("POST", f"/invitations/{inv_f['id']}/accept", tf)
check("fabio aceita", s, 200)
s, inv_d, _ = call("POST", f"/projects/{coop['id']}/invitations", te, {"email": ud["email"]})
s2, _, _ = call("POST", f"/invitations/{inv_d['id']}/decline", td)
check("duda recusa convite do cooperativo", (s, s2), (201, 200))
s, _, _ = call("POST", f"/invitations/{inv_d['id']}/accept", td)
check("aceitar depois de recusar", s, 409)
s, _, _ = call("POST", f"/projects/{coop['id']}/invitations", te, {"email": ud["email"]})
check("pode convidar de novo quem recusou", s, 201)
s, _, _ = call("POST", f"/projects/{coop['id']}/invitations", te, {"email": uf["email"]})
check("convidar quem já é membro", s, 409)
s, _, _ = call("POST", f"/projects/{pess['id']}/invitations", tf, {"email": ue["email"]})
check("pessoal não aceita convite", s, 400)
s, _, _ = call("POST", f"/projects/{corp['id']}/invitations", tb, {"email": ue["email"]})
check("contratado não convida no corporativo", s, 403)
s, _, _ = call("POST", f"/projects/{coop['id']}/invitations", tf, {"email": ub["email"]})
check("membro convida no cooperativo? (regra)", s, 403, "(confirmar regra)")
s, _, _ = call("POST", f"/projects/{corp['id']}/invitations", ta, {"email": ta and ua["email"]})
check("dono convidar a si mesmo", s in (400, 409), True, f"status {s}")
s, invs, _ = call("GET", f"/projects/{corp['id']}/invitations", ta)
check("dono lista convites pendentes (todos já aceitos)", (s, len(invs) if isinstance(invs, list) else None), (200, 0))
s, mem, _ = call("GET", f"/projects/{corp['id']}/members", tb)
check("membro vê lista de membros (3 contratados)", sorted(m["user"]["username"] for m in mem
      if m["role"] == "MEMBER") if s == 200 else s, ["bia", "caio", "duda"])
s, lst, _ = call("GET", "/projects", tb)
check("bia vê Jogo Aurora como MEMBER", {p["id"]: p["myRole"] for p in lst}.get(corp["id"]), "MEMBER")

# ------------------------------------------------------------------ 4. Tarefas
sec("4. Tarefas e Kanban")
amanha = (date.today() + timedelta(days=1)).isoformat()
s, t_bia, _ = call("POST", f"/projects/{corp['id']}/tasks", ta, {"title": "Concept da heroína", "priority": "HIGH",
                                                                 "assigneeId": ub["id"], "deadline": amanha,
                                                                 "description": "Turnaround frente/costas"})
check("empresa cria tarefa atribuída a bia", (s, (t_bia.get("assignee") or {}).get("username")), (201, "bia"))
s, t_caio, _ = call("POST", f"/projects/{corp['id']}/tasks", ta, {"title": "Cenário da floresta", "priority": "MEDIUM",
                                                                  "assigneeId": uc["id"]})
s2, t_duda, _ = call("POST", f"/projects/{corp['id']}/tasks", ta, {"title": "Ícones de UI", "priority": "LOW"})
check("cria tarefas do caio e sem responsável", (s, s2), (201, 201))
s, _, _ = call("PATCH", f"/tasks/{t_duda['id']}/assignee", ta, {"userId": ud["id"]})
check("empresa atribui tarefa à duda", s, 200)
s, _, _ = call("PATCH", f"/tasks/{t_duda['id']}/assignee", ta, {"userId": ue["id"]})
check("não atribui a quem está fora do projeto", s, 400)
s, _, _ = call("POST", f"/projects/{corp['id']}/tasks", ta, {"title": "", "priority": "LOW"})
check("título vazio é recusado", s, 400)
s, _, _ = call("POST", f"/projects/{corp['id']}/tasks", ta, {"title": "x", "priority": "URGENTE"})
check("prioridade inválida é recusada", s, 400)
s, lst, _ = call("GET", f"/projects/{corp['id']}/tasks", tb)
check("bia só vê a própria tarefa (corporativo)", [t["title"] for t in lst] if s == 200 else s, ["Concept da heroína"])
s, _, _ = call("GET", f"/tasks/{t_caio['id']}", tb)
check("bia não abre tarefa do caio", s, 404)
s, _, _ = call("POST", f"/projects/{corp['id']}/tasks", tb, {"title": "x", "priority": "LOW"})
check("contratado não cria tarefa no corporativo", s, 403)
for st in ("IN_PROGRESS", "REVIEW", "DONE", "TODO"):
    s, t, _ = call("PATCH", f"/tasks/{t_bia['id']}/status", tb, {"status": st})
    check(f"bia move a própria tarefa para {st}", (s, (t or {}).get("status")), (200, st))
s, _, _ = call("PATCH", f"/tasks/{t_bia['id']}/status", tb, {"status": "ARQUIVADA"})
check("status inválido é recusado", s, 400)
s, _, _ = call("PATCH", f"/tasks/{t_caio['id']}/status", tb, {"status": "DONE"})
check("bia não move a tarefa do caio", s, 404)
s, _, _ = call("PATCH", f"/tasks/{t_bia['id']}/assignee", tb, {"userId": uc["id"]})
check("contratado não reatribui tarefa", s, 403)
s, _, _ = call("DELETE", f"/tasks/{t_bia['id']}", tb)
check("contratado não apaga tarefa", s, 403)
s, _, _ = call("PATCH", f"/projects/{corp['id']}/settings", ta, {"contractorsSeeAllTasks": True})
s2, lst, _ = call("GET", f"/projects/{corp['id']}/tasks", tb)
check("com 'ver todas' ligado, bia vê as 3", (s, len(lst) if s2 == 200 else s2), (200, 3))
s, _, _ = call("PATCH", f"/tasks/{t_caio['id']}/status", tb, {"status": "DONE"})
check("mas continua sem mover a do caio", s, 403)
call("PATCH", f"/projects/{corp['id']}/settings", ta, {"contractorsSeeAllTasks": False})

s, tc1, _ = call("POST", f"/projects/{coop['id']}/tasks", te, {"title": "Roteiro cap. 1", "priority": "HIGH",
                                                              "assigneeId": ue["id"]})
s2, tc2, _ = call("POST", f"/projects/{coop['id']}/tasks", tf, {"title": "Arte da capa", "priority": "HIGH",
                                                               "assigneeId": uf["id"]})
check("no cooperativo, eva e fabio criam tarefas", (s, s2), (201, 201))
s, _, _ = call("PATCH", f"/tasks/{tc1['id']}/status", tf, {"status": "IN_PROGRESS"})
check("fabio move tarefa da eva (cooperativo)", s, 200)
s, lst, _ = call("GET", f"/projects/{coop['id']}/tasks", tf)
check("fabio vê todas as tarefas do cooperativo", len(lst) if s == 200 else s, 2)
s, tp, _ = call("POST", f"/projects/{pess['id']}/tasks", tf, {"title": "Estudo de mãos", "priority": "LOW"})
check("fabio cria tarefa no pessoal", s, 201)
s, tmp, _ = call("POST", f"/projects/{coop['id']}/tasks", tf, {"title": "Temporária", "priority": "LOW"})
s2, _, _ = call("DELETE", f"/tasks/{tmp['id']}", te)
check("membro apaga tarefa no cooperativo", (s, s2), (201, 204))

# ------------------------------------------------------------------ 5. Arquivos
sec("5. Arquivos das tarefas")
s, f1, _ = upload(tb, t_bia["id"], "esboco.psd", b"8BPS" + b"0" * 200)
check("bia envia PSD", (s, (f1 or {}).get("version") if isinstance(f1, dict) else f1), (201, 1))
s, f2, _ = upload(tb, t_bia["id"], "heroina.png", png(200, 60, 160), final=True)
check("bia envia PNG como imagem final", (s, (f2 or {}).get("finalImage") if isinstance(f2, dict) else f2),
      (201, True))
s, f3, _ = upload(tb, t_bia["id"], "heroina.png", png(180, 40, 200))
check("cada envio na tarefa ganha a próxima versão", (s, (f3 or {}).get("version") if isinstance(f3, dict) else f3),
      (201, 3))
s, _, _ = upload(tb, t_bia["id"], "virus.exe", b"MZ")
check("recusa .exe", s, 415)
s, _, _ = upload(tb, t_caio["id"], "a.png", png())
check("bia não envia na tarefa do caio", s, 404)
s, files, _ = call("GET", f"/tasks/{t_bia['id']}/files", ta)
check("empresa lista os arquivos da bia", len(files) if s == 200 else s, 3)
s, c, h = call("GET", f"/files/{f2['id']}/content", ta)
check("empresa baixa a imagem", (s, c[:4] if isinstance(c, bytes) else type(c).__name__), (200, b"\x89PNG"))
s, _, _ = call("GET", f"/files/{f2['id']}/content", tc)
check("caio não baixa arquivo da bia", s, 404)
s, _, _ = call("GET", f"/files/{f2['id']}/content")
check("sem login não baixa", s in (401, 403), True)
s, ff, _ = call("POST", f"/files/{f3['id']}/final", tb)
check("bia troca a imagem final para a v2", (s, (ff or {}).get("finalImage")), (200, True))
s, files, _ = call("GET", f"/tasks/{t_bia['id']}/files", tb)
check("só uma imagem final por tarefa", sum(1 for f in files if f["finalImage"]), 1)
s, _, _ = call("DELETE", f"/files/{f1['id']}", tc)
check("caio não apaga arquivo da bia", s in (403, 404), True, f"status {s}")
s, _, _ = call("DELETE", f"/files/{f1['id']}", tb)
check("bia apaga o PSD", s, 204)
s, fe, _ = upload(tf, tc2["id"], "capa.png", png(30, 120, 220), final=True)
check("fabio envia a capa no cooperativo", s, 201)
s, fp, _ = upload(tf, tp["id"], "maos.png", png(90, 200, 90), final=True)
check("fabio envia no pessoal", s, 201)
s, fcaio, _ = upload(tc, t_caio["id"], "floresta.png", png(20, 160, 60), final=True)
check("caio envia o cenário", s, 201)

# ------------------------------------------------------------------ 6. Canvas
sec("6. Canvas")
s, cv, _ = call("GET", f"/tasks/{t_bia['id']}/canvas", tb)
check("canvas começa vazio", (s, (cv or {}).get("content")), (200, "[]"))
s, _, _ = call("PUT", f"/tasks/{t_bia['id']}/canvas", tb,
               {"content": '[{"id":"n1","type":"note","x":10,"y":20,"text":"paleta roxa"}]'})
check("bia salva o canvas", s, 200)
s, cv, _ = call("GET", f"/tasks/{t_bia['id']}/canvas", ta)
check("empresa lê o canvas salvo", (s, "paleta roxa" in (cv or {}).get("content", ""), (cv or {}).get("updatedByName")),
      (200, True, "Bia Contratada"))
s, _, _ = call("PUT", f"/tasks/{t_bia['id']}/canvas", tc, {"content": "[]"})
check("caio não salva canvas da bia", s, 404)
s, _, _ = call("PUT", f"/tasks/{t_bia['id']}/canvas", tb, {"content": "isso não é json"})
check("canvas com JSON inválido é recusado", s, 400)
s, _, _ = call("PUT", f"/tasks/{tc1['id']}/canvas", tf, {"content": '[{"id":"a","type":"note","x":0,"y":0,"text":"ok"}]'})
check("fabio edita canvas no cooperativo", s, 200)

# ------------------------------------------------------------------ 7. Publicações e Explorar (V3)
sec("7. Publicações, NDA e Explorar")


def new_post(token, name, content, title=None, subtitle=None):
    bnd = uuid.uuid4().hex
    body = b""
    for k, v in (("title", title), ("subtitle", subtitle)):
        if v:
            body += f"--{bnd}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    body += (f"--{bnd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n"
             f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + f"\r\n--{bnd}--\r\n".encode()
    return call("POST", "/posts", token, raw=body, ctype=f"multipart/form-data; boundary={bnd}")


def feed():
    s, f, _ = call("GET", "/feed?limit=50")
    return f if s == 200 else []


def api_path(url):
    return url.replace("/api/v1", "", 1)


s, _, _ = call("POST", f"/files/{f3['id']}/post", tb, {"subtitle": "Versão final"})
check("projeto com NDA: bia não publica a arte", s, 409)
s, pr, _ = call("PATCH", f"/projects/{corp['id']}/settings", ta, {"ndaReleaseDate": date.today().isoformat()})
check("empresa define liberação do NDA para hoje", s, 200)
s, post_bia, _ = call("POST", f"/files/{f3['id']}/post", tb, {"subtitle": "Versão final"})
check("liberado: bia publica a arte como post", (s, (post_bia or {}).get("isPublic")), (201, True))
check("post da bia aparece no Explorar", any(x["id"] == post_bia["id"] for x in feed()), True)
s, img, _ = call("GET", api_path(post_bia["images"][0]["url"]))
check("imagem do post é pública (sem login)", (s, img[1:4] if isinstance(img, bytes) else None), (200, b"PNG"))
s, _, _ = call("GET", f"/files/{f3['id']}/content")
check("mas o arquivo da tarefa continua privado", s in (401, 403), True)

s, pr, _ = call("PATCH", f"/projects/{coop['id']}/settings", te, {"autoWip": True})
check("eva liga o WIP automático no cooperativo", (s, (pr or {}).get("publiclyVisible")), (200, True))
anuncio = [x for x in feed() if x["kind"] == "PROJECT_PUBLISHED" and (x.get("project") or {}).get("id") == coop["id"]]
check("aviso de projeto público no Explorar", len(anuncio), 1)
s, fw, _ = upload(tf, tc2["id"], "capa_v2.png", png(40, 140, 230))
wips = [x for x in feed() if x["kind"] == "WIP" and (x.get("task") or {}).get("id") == tc2["id"]]
check("novo envio do fabio vira WIP no Explorar", (s, len(wips)), (201, 1))
s, pv, _ = call("GET", f"/projects/{coop['id']}/public")
check("visão pública do cooperativo sem login", s, 200)

s, post_pess, _ = call("POST", f"/files/{fp['id']}/post", tf, {"subtitle": "Estudo"})
check("fabio publica imagem do projeto pessoal", (s, (post_pess or {}).get("kind")), (201, "STANDALONE"))
s, loose, _ = new_post(tc, "esboco_livre.png", png(250, 200, 30), "Esboço livre", "Fora de projeto")
check("caio cria post avulso", (s, (loose or {}).get("kind")), (201, "STANDALONE"))
s, _, _ = new_post(tc, "contrato.pdf", b"%PDF-1.4", "PDF")
check("post avulso recusa o que não é imagem", s, 415)
s, _, _ = call("DELETE", f"/posts/{loose['id']}", tb)
check("outra pessoa não apaga o post", s, 403)
ids = [x["id"] for x in feed()]
check("Explorar tem os posts novos", all(i in ids for i in (post_bia["id"], post_pess["id"], loose["id"])), True)
check("Explorar ordena do mais recente", ids.index(loose["id"]) < ids.index(post_bia["id"]), True)

# ------------------------------------------------------------------ 8. Perfil
sec("8. Perfil público")
s, pf, _ = call("GET", "/users/bia/profile", te)
check("eva abre o perfil da bia", s, 200)
check("portfólio da bia mostra o post", [x["id"] for x in pf.get("portfolio", [])], [post_bia["id"]])
s, pf, _ = call("GET", "/users/fabio/profile", tb)
check("pessoal do fabio fica escondido para bia", (pf["hiddenPersonalProjects"],
      [p["name"] for p in pf["projects"]]), (1, ["Quadrinho Coop"]))
s, pf, _ = call("GET", "/users/fabio/profile", tf)
check("fabio vê o próprio perfil completo", (pf["me"], pf["hiddenPersonalProjects"], len(pf["projects"])), (True, 0, 2))
s, pf, _ = call("GET", "/users/aurora/profile", tf)
check("perfil da empresa abre", s, 200)
s, _, _ = call("GET", "/users/ninguem_aqui/profile", tf)
check("perfil inexistente = 404", s, 404)
s, pf, _ = call("GET", "/users/bia/profile")
check("perfil público sem login", s, 200)
if s == 200:
    check("sem login: NDA já liberado aparece normal", [p["name"] for p in pf["projects"] if p.get("nda")], [])
    check("sem login: me=false", pf.get("me"), False)
s, sec_p, _ = call("POST", "/projects", ta, {"name": "Projeto Secreto", "slug": f"secreto-{sfx}", "type": "CORPORATE"})
call("PATCH", f"/projects/{sec_p['id']}/settings", ta, {"ndaEnabled": True})
invite_accept(ta, sec_p["id"], tb, ub)
s, pf, _ = call("GET", "/users/bia/profile")
masked = [p for p in pf.get("projects", []) if p["masked"]]
check("sem login: projeto sob NDA mascarado, sem nome", (len(masked), masked[0]["name"] if masked else "-"), (1, None))
s, pf, _ = call("GET", "/users/bia/profile", tc)
check("caio (fora do Projeto Secreto) também vê mascarado", sum(1 for p in pf["projects"] if p["masked"]), 1)

# ------------------------------------------------------------------ 9. Atividade
sec("9. Atividade e dashboard")
s, _, _ = call("POST", "/activity", tb, {"type": "TASK_COMPLETED", "projectId": corp["id"]})
check("registra atividade", s, 201)
s, _, _ = call("POST", "/activity", tb, {"type": "TASK_COMPLETED", "projectId": coop["id"]})
check("não registra atividade em projeto alheio", s in (403, 404), True, f"status {s}")
s, _, _ = call("POST", "/activity", tb, {"type": "INVALIDO"})
check("tipo de atividade inválido", s, 400)
s, hm, _ = call("GET", "/activity/heatmap", tb)
hoje = date.today().isoformat()
check("heatmap da bia tem atividade hoje", (s, any(d.get("date") == hoje and d.get("count", 0) > 0 for d in hm or [])),
      (200, True))
s, dt, _ = call("GET", "/activity/delivery-trend", tb)
check("delivery-trend responde", s, 200)
print("   delivery-trend:", json.dumps(dt)[:300])
s, pf, _ = call("GET", "/users/bia/profile", te)
check("heatmap aparece no perfil público", any(d.get("count", 0) > 0 for d in pf.get("heatmap", [])), True)

# ------------------------------------------------------------------ 10. Saída, remoção e encerramento
sec("10. Membros, saída e encerramento")
s, _, _ = call("DELETE", f"/projects/{camp['id']}/members/{uc['id']}", tb)
check("membro não remove outro membro", s in (403, 404), True, f"status {s}")
s, _, _ = call("DELETE", f"/projects/{camp['id']}/members/{uc['id']}", ta)
check("empresa remove caio da Campanha", s, 204)
s, _, _ = call("GET", f"/projects/{camp['id']}", tc)
check("caio perde o acesso", s, 404)
s, _, _ = call("POST", f"/projects/{corp['id']}/leave", ta)
check("dono não pode sair", s, 400)
s, _, _ = call("POST", f"/projects/{corp['id']}/leave", td)
check("duda sai do Jogo Aurora", s, 204)
s, t, _ = call("GET", f"/tasks/{t_duda['id']}", ta)
check("tarefa da duda fica sem responsável", (s, (t or {}).get("assignee")), (200, None))
s, _, _ = call("PATCH", f"/projects/{camp['id']}/status", tb, {"status": "CLOSED"})
check("não-membro não encerra projeto", s in (403, 404), True)
s, _, _ = call("DELETE", f"/projects/{camp['id']}", ta)
check("apagar projeto ativo é recusado", s in (400, 409), True, f"status {s}")
s, p, _ = call("PATCH", f"/projects/{camp['id']}/status", ta, {"status": "CLOSED"})
check("empresa encerra a Campanha", (s, (p or {}).get("status")), (200, "CLOSED"))
s, _, _ = call("POST", f"/projects/{camp['id']}/tasks", ta, {"title": "x", "priority": "LOW"})
check("projeto encerrado não aceita tarefa", s, 409)
s, p, _ = call("PATCH", f"/projects/{camp['id']}/status", ta, {"status": "ACTIVE"})
check("empresa retoma a Campanha", (s, (p or {}).get("status")), (200, "ACTIVE"))
s, tx, _ = call("POST", f"/projects/{camp['id']}/tasks", ta, {"title": "Banner", "priority": "LOW"})
call("PATCH", f"/projects/{camp['id']}/status", ta, {"status": "CLOSED"})
s, _, _ = call("DELETE", f"/projects/{camp['id']}", ta)
check("empresa apaga a Campanha encerrada", s, 204)
s, _, _ = call("GET", f"/tasks/{tx['id']}", ta)
check("tarefas do projeto apagado somem", s, 404)

# ------------------------------------------------------------------ Resumo
fails = [r for r in results if not r[2]]
print(f"\nRESUMO: {len(results) - len(fails)} OK, {len(fails)} falhas, de {len(results)} verificações")
for sec_name, label, _, det in fails:
    print(f" - [{sec_name}] {label}: {det}")
with open(sys.argv[1] if len(sys.argv) > 1 else "auditoria_resultado.json", "w", encoding="utf-8") as fh:
    json.dump({"sufixo": sfx, "resultados": [dict(secao=a, verificacao=b, ok=c, detalhe=d) for a, b, c, d in results],
               "ids": {"corp": corp["id"], "coop": coop["id"], "pessoal": pess["id"], "post_bia": post_bia["id"],
                       "t_bia": t_bia["id"]}}, fh, ensure_ascii=False, indent=1)

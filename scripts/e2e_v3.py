"""Roteiro e2e da V3: publicações (post avulso, WIP automático, "Publicar como post") e visão pública do projeto.
Uso: com o backend rodando, `python scripts/e2e_v3.py` (ou passe outra URL base como argumento)."""
import json, secrets, struct, sys, urllib.request, urllib.error, uuid, zlib

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/api/v1"


def call(method, path, token=None, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(BASE + path, method=method, data=data)
    if data is not None:
        req.add_header("Content-Type", ctype)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req) as r:
            b = r.read()
            try:
                return r.status, json.loads(b) if b else None
            except Exception:
                return r.status, b
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            return e.code, json.loads(b)
        except Exception:
            return e.code, b


def multipart(fields, files):
    bnd = uuid.uuid4().hex
    out = b""
    for name, value in fields.items():
        out += f"--{bnd}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
    for name, (filename, content) in files.items():
        out += (f"--{bnd}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
                f"Content-Type: application/octet-stream\r\n\r\n").encode() + content + b"\r\n"
    out += f"--{bnd}--\r\n".encode()
    return out, f"multipart/form-data; boundary={bnd}"


def upload(token, task, name, content, final=False):
    raw, ctype = multipart({"final": "true" if final else "false"}, {"file": (name, content)})
    return call("POST", f"/tasks/{task}/files", token, raw=raw, ctype=ctype)


def new_post(token, name, content, title=None, subtitle=None):
    fields = {k: v for k, v in (("title", title), ("subtitle", subtitle)) if v}
    raw, ctype = multipart(fields, {"file": (name, content)})
    return call("POST", "/posts", token, raw=raw, ctype=ctype)


def png(seed=0):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    pixel = bytes([0, seed % 256, 0, 0])
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(pixel)) + chunk(b"IEND", b""))


def path_of(url):
    return url.replace("/api/v1", "")


ok_all = True


def check(label, got, expected):
    global ok_all
    ok = got == expected
    ok_all &= ok
    print(("OK  " if ok else "FALHOU"), f"{label}: {got} (esperado {expected})")


sfx = secrets.token_hex(3)
pw = "Teste#" + secrets.token_hex(8)


def reg(n):
    s, b = call("POST", "/auth/register", body={"fullName": f"T4 {n} {sfx}", "username": f"t4_{n}_{sfx}",
                                                "email": f"t4.{n}.{sfx}@arthub.test", "password": pw,
                                                "role": "ARTIST"})
    return b["token"], b["user"]


def feed_ids():
    s, feed = call("GET", "/feed?limit=50", None)
    return {x["id"]: x for x in feed}


ta, ua = reg("artista")
tv, uv = reg("visita")

# --- Projeto pessoal privado ---
s, p = call("POST", "/projects", ta, {"name": "Exploração de designs", "slug": f"ed-{sfx}",
                                      "description": "Do rascunho à ilustração"})
pid = p["id"]
check("projeto novo nasce privado", (p["autoWip"], p["publiclyVisible"]), (False, False))
s, t1 = call("POST", f"/projects/{pid}/tasks", ta, {"title": "Exploração vertical", "description": "Silhuetas altas", "priority": "LOW"})
s, t2 = call("POST", f"/projects/{pid}/tasks", ta, {"title": "Exploração horizontal", "priority": "LOW"})
s, f1 = upload(ta, t1["id"], "vertical_1.png", png(1))
check("envio em projeto privado", s, 201)
check("projeto privado: nada no feed", [x for x in feed_ids().values() if x["project"] and x["project"]["id"] == pid], [])
s, _ = call("GET", f"/projects/{pid}/public", tv)
check("visitante não vê projeto privado", s, 404)

# --- Post avulso ---
s, loose = new_post(ta, "lua.png", png(2), "Lua", "Estudo de luz")
check("post avulso criado", (s, loose["kind"], loose["isPublic"], len(loose["images"])), (201, "STANDALONE", True, 1))
check("post avulso no feed", loose["id"] in feed_ids(), True)
s, _ = call("GET", path_of(loose["images"][0]["url"]), None)
check("imagem do post avulso sem login", s, 200)
s, bad = new_post(ta, "contrato.pdf", b"%PDF-1.4", "PDF")
check("post avulso recusa não imagem", s, 415)
s, prof = call("GET", f"/users/{ua['username']}/profile", tv)
check("post avulso no portfólio", [x["id"] for x in prof["portfolio"]], [loose["id"]])
check("projeto pessoal privado escondido do visitante", prof["hiddenPersonalProjects"], 1)
s, _ = call("PATCH", f"/posts/{loose['id']}", tv, {"hiddenFromPortfolio": True})
check("outra pessoa não edita o post", s, 403)
s, _ = call("DELETE", f"/posts/{loose['id']}", tv)
check("outra pessoa não apaga o post", s, 403)
s, hid = call("PATCH", f"/posts/{loose['id']}", ta, {"hiddenFromPortfolio": True})
check("autor oculta do portfólio", hid["hiddenFromPortfolio"], True)
s, prof = call("GET", f"/users/{ua['username']}/profile", tv)
check("oculto sai do portfólio, fica nos posts", (len(prof["portfolio"]), loose["id"] in [x["id"] for x in prof["posts"]]), (0, True))

# --- Publicar como post a partir de projeto privado ---
s, fromtask = call("POST", f"/files/{f1['id']}/post", ta, {"subtitle": "Primeira silhueta"})
check("publica imagem de projeto privado como post", (s, fromtask["kind"], fromtask["title"], fromtask["isPublic"]),
      (201, "STANDALONE", "Exploração vertical", True))
s, _ = call("GET", path_of(fromtask["images"][0]["url"]), tv)
check("visitante vê a imagem publicada", s, 200)
s, _ = call("GET", f"/files/{f1['id']}/content", tv)
check("mas não baixa o arquivo da tarefa", s, 404)
s, _ = call("POST", f"/files/{f1['id']}/post", tv, {})
check("visitante não publica arquivo dos outros", s, 404)

# --- WIP automático ---
s, pr = call("PATCH", f"/projects/{pid}/settings", ta, {"autoWip": True})
check("liga WIP automático", (pr["autoWip"], pr["publiclyVisible"]), (True, True))
announce = [x for x in feed_ids().values() if x["project"] and x["project"]["id"] == pid and x["kind"] == "PROJECT_PUBLISHED"]
check("aviso de projeto público no feed, com a imagem existente", [(len(announce), len(announce[0]["images"]) if announce else 0)], [(1, 1)])
s, _ = call("PATCH", f"/projects/{pid}/settings", ta, {"autoWip": False})
s, _ = call("PATCH", f"/projects/{pid}/settings", ta, {"autoWip": True})
again = [x for x in feed_ids().values() if x["project"] and x["project"]["id"] == pid and x["kind"] == "PROJECT_PUBLISHED"]
check("desligar e ligar não repete o aviso", len(again), 1)
s, f2 = upload(ta, t1["id"], "vertical_2.png", png(3))
s, f3 = upload(ta, t1["id"], "vertical_3.png", png(4))
wips = [x for x in feed_ids().values() if x["kind"] == "WIP" and x["task"]["id"] == t1["id"]]
check("dois envios seguidos viram um WIP com 2 imagens", [(len(wips), len(wips[0]["images"]) if wips else 0)], [(1, 2)])
check("WIP tem título e subtítulo da tarefa", (wips[0]["title"], wips[0]["subtitle"], wips[0]["label"]), ("Exploração vertical", "Silhuetas altas", "WIP"))
call("POST", f"/files/{f3['id']}/final", ta)
wip1 = feed_ids()[wips[0]["id"]]
check("marcar a final muda o rótulo para Final", wip1["label"], "FINAL")
s, f4 = upload(ta, t2["id"], "horizontal_1.png", png(5))
wips2 = [x for x in feed_ids().values() if x["kind"] == "WIP" and x["task"]["id"] == t2["id"]]
check("outra tarefa gera outro WIP", len(wips2), 1)
before = len(feed_ids())
s, _ = upload(ta, t2["id"], "pacote.zip", b"PK\x03\x04")
check("arquivo que não é imagem não vira WIP", len(feed_ids()), before)

# --- Perfil e visão pública ---
s, prof = call("GET", f"/users/{ua['username']}/profile", tv)
pj = [x for x in prof["projects"] if x["id"] == pid]
check("projeto público aparece no perfil com capa", (len(pj), pj[0]["publicView"] if pj else None, bool(pj and pj[0]["coverUrl"])), (1, True, True))
check("projeto público não conta como escondido", prof["hiddenPersonalProjects"], 0)
s, pv = call("GET", f"/projects/{pid}/public", tv)
check("visão pública: 2 tarefas, mais antiga primeiro", (s, [u["taskId"] for u in pv["updates"]]), (200, [t1["id"], t2["id"]]))
check("tarefa 1 com 3 imagens e a final marcada", (len(pv["updates"][0]["images"]), [i["finalImage"] for i in pv["updates"][0]["images"]]), (3, [False, False, True]))
check("visão pública sem prazos nem prioridades", sorted(pv["updates"][0].keys()), sorted(["taskId", "title", "subtitle", "done", "firstImageAt", "lastImageAt", "images"]))
s, pvd = call("GET", f"/projects/{pid}/public?order=desc", tv)
check("ordem invertida", [u["taskId"] for u in pvd["updates"]], [t2["id"], t1["id"]])
s, _ = call("GET", path_of(pv["updates"][1]["images"][0]["url"]), None)
check("imagem da visão pública sem login", s, 200)

# --- Tarefa interna ---
s, hidden = call("PATCH", f"/tasks/{t2['id']}/visibility", ta, {"hiddenFromPublic": True})
check("marca tarefa como interna", hidden["hiddenFromPublic"], True)
s, pv = call("GET", f"/projects/{pid}/public", tv)
check("tarefa interna sai da visão pública", [u["taskId"] for u in pv["updates"]], [t1["id"]])
check("WIP da tarefa interna sai do feed", wips2[0]["id"] in feed_ids(), False)
s, _ = call("GET", f"/projects/{pid}/public/files/{f4['id']}", None)
check("imagem da tarefa interna não é pública", s, 404)
call("PATCH", f"/tasks/{t2['id']}/visibility", ta, {"hiddenFromPublic": False})

# --- Desligar o WIP automático ---
s, pr = call("PATCH", f"/projects/{pid}/settings", ta, {"autoWip": False})
check("desliga: projeto volta a ser privado", pr["publiclyVisible"], False)
s, _ = call("GET", f"/projects/{pid}/public", tv)
check("visitante perde a visão pública", s, 404)
check("WIPs somem do feed", wips[0]["id"] in feed_ids(), False)
check("post publicado da tarefa continua", fromtask["id"] in feed_ids(), True)
s, pr = call("PATCH", f"/projects/{pid}/settings", ta, {"autoWip": True})
check("religando, os WIPs voltam", wips[0]["id"] in feed_ids(), True)

# --- Apagar arquivo e projeto ---
s, _ = call("DELETE", f"/files/{f4['id']}", ta)
check("apaga a única imagem do WIP", s, 204)
s, _ = call("GET", f"/posts/{wips2[0]['id']}", ta)
check("WIP sem imagem some", s, 404)
call("PATCH", f"/projects/{pid}/status", ta, {"status": "CLOSED"})
s, _ = call("DELETE", f"/projects/{pid}", ta)
check("apaga o projeto com publicações", s, 204)
s, _ = call("GET", f"/posts/{fromtask['id']}", ta)
check("post publicado continua no portfólio depois de apagar o projeto", s, 200)
call("DELETE", f"/posts/{fromtask['id']}", ta)
s, still = call("GET", f"/posts/{loose['id']}", ta)
check("post avulso sem projeto continua", s, 200)
s, _ = call("DELETE", f"/posts/{loose['id']}", ta)
check("autor apaga o post avulso", s, 204)

print("\nRESULTADO:", "TUDO OK" if ok_all else "HÁ FALHAS")

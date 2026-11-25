import json, secrets, urllib.request, urllib.error, uuid, struct, zlib
BASE="http://localhost:8080/api/v1"
def call(method, path, token=None, body=None, raw=None, ctype="application/json"):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req=urllib.request.Request(BASE+path, method=method, data=data)
    if data is not None: req.add_header("Content-Type", ctype)
    if token: req.add_header("Authorization","Bearer "+token)
    try:
        with urllib.request.urlopen(req) as r:
            b=r.read(); h=dict(r.headers)
            try: return r.status, json.loads(b) if b else None, h
            except Exception: return r.status, b, h
    except urllib.error.HTTPError as e:
        b=e.read()
        try: return e.code, json.loads(b), {}
        except Exception: return e.code, b, {}
def upload(token, task, name, content, final=False):
    bnd=uuid.uuid4().hex
    body=(f"--{bnd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\nContent-Type: application/octet-stream\r\n\r\n").encode()+content+f"\r\n--{bnd}\r\nContent-Disposition: form-data; name=\"final\"\r\n\r\n{'true' if final else 'false'}\r\n--{bnd}--\r\n".encode()
    return call("POST",f"/tasks/{task}/files",token,raw=body,ctype=f"multipart/form-data; boundary={bnd}")
def png():
    def chunk(t,d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d))
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",1,1,8,2,0,0,0))+chunk(b"IDAT",zlib.compress(b"\x00\xff\x00\x00"))+chunk(b"IEND",b"")
ok_all=True
def check(label, got, expected):
    global ok_all
    ok=got==expected; ok_all&=ok; print(("OK  " if ok else "FALHOU"), f"{label}: {got} (esperado {expected})")
sfx=secrets.token_hex(3); pw="Teste#"+secrets.token_hex(8)
def reg(n,role):
    s,b,_=call("POST","/auth/register",body={"fullName":f"T {n} {sfx}","username":f"t2_{n}_{sfx}","email":f"t2.{n}.{sfx}@arthub.test","password":pw,"role":role}); return b["token"],b["user"]
ta,ua=reg("estudio","COMPANY"); tb,ub=reg("artista","ARTIST"); tc,uc=reg("outro","ARTIST")
s,p,_=call("POST","/projects",ta,{"name":"C","slug":f"c2-{sfx}","type":"CORPORATE"}); pid=p["id"]
for tok,u in ((tb,ub),(tc,uc)):
    s,inv,_=call("POST",f"/projects/{pid}/invitations",ta,{"email":u["email"]}); call("POST",f"/invitations/{inv['id']}/accept",tok)
s,t1,_=call("POST",f"/projects/{pid}/tasks",ta,{"title":"Da artista","priority":"HIGH","assigneeId":ub["id"]}); check("cria tarefa já atribuída",(s,t1["assignee"]["id"]),(201,ub["id"]))
s,t2,_=call("POST",f"/projects/{pid}/tasks",ta,{"title":"Do outro","priority":"LOW"}); call("PATCH",f"/tasks/{t2['id']}/assignee",ta,{"userId":uc["id"]})
s,t3,_=call("POST",f"/projects/{pid}/tasks",ta,{"title":"x","priority":"LOW","assigneeId":999999}); check("responsável de fora do projeto",s,400)
s,lst,_=call("GET",f"/projects/{pid}/tasks",tb); check("artista vê só a dela",[t["id"] for t in lst],[t1["id"]])
s,_,_=call("GET",f"/tasks/{t2['id']}",tb); check("tarefa do outro dá 404",s,404)
s,_,_=call("PATCH",f"/tasks/{t1['id']}/status",tb,{"status":"IN_PROGRESS"}); check("artista move a dela",s,200)
s,f1,_=upload(tb,t1["id"],"esboco.psd",b"8BPS"+b"0"*100); check("envia PSD",(s,f1.get("version") if isinstance(f1,dict) else f1),(201,1))
s,f2,_=upload(tb,t1["id"],"final.png",png(),True); check("envia PNG como final",(s,f2.get("finalImage") if isinstance(f2,dict) else f2),(201,True))
s,_,_=upload(tb,t1["id"],"virus.exe",b"MZ"); check("recusa .exe",s,415)
s,_,_=upload(tb,t2["id"],"a.png",png()); check("não envia na tarefa do outro",s,404)
s,files,_=call("GET",f"/tasks/{t1['id']}/files",ta); check("dono lista 2 arquivos",len(files),2)
s,content,h=call("GET",f"/files/{f2['id']}/content",ta); check("dono baixa a imagem",(s,content[:4] if isinstance(content,bytes) else None),(200,b"\x89PNG"))
check("nosniff",h.get("X-Content-Type-Options"),"nosniff")
s,_,_=call("GET",f"/files/{f2['id']}/content",tc); check("outro contratado não baixa",s,404)
s,_,_=call("GET",f"/files/{f2['id']}/content",None); check("sem token não baixa",s in (401,403),True)
s,_,_=call("PATCH",f"/projects/{pid}/settings",ta,{"contractorsSeeAllTasks":True}); check("dono libera ver todas",s,200)
s,lst,_=call("GET",f"/projects/{pid}/tasks",tc); check("agora o outro vê as duas",len(lst),2)
s,_,_=upload(tc,t1["id"],"b.png",png()); check("mas não envia na da artista",s,403)
s,_,_=call("DELETE",f"/files/{f1['id']}",tc); check("outro não apaga arquivo da artista",s,403)
s,_,_=call("DELETE",f"/files/{f1['id']}",ta); check("dono apaga arquivo",s,204)
call("PATCH",f"/projects/{pid}/status",ta,{"status":"CLOSED"}); s,_,_=call("DELETE",f"/projects/{pid}",ta); check("apaga projeto com arquivos",s,204)
print("\nRESULTADO:", "TUDO OK" if ok_all else "HÁ FALHAS")

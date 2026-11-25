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
    s,b,_=call("POST","/auth/register",body={"fullName":f"T3 {n} {sfx}","username":f"t3_{n}_{sfx}","email":f"t3.{n}.{sfx}@arthub.test","password":pw,"role":role}); return b["token"],b["user"]
ta,ua=reg("estudio","COMPANY"); tb,ub=reg("artista","ARTIST"); tv,uv=reg("visita","ARTIST")
s,p,_=call("POST","/projects",ta,{"name":"Jogo Secreto","slug":f"s3-{sfx}","type":"CORPORATE"}); pid=p["id"]
s,pp,_=call("POST","/projects",tb,{"name":"Estudos","slug":f"e3-{sfx}"})
s,pr,_=call("PATCH",f"/projects/{pid}/settings",ta,{"ndaEnabled":True}); check("liga NDA",pr.get("ndaEnabled"),True)
s,inv,_=call("POST",f"/projects/{pid}/invitations",ta,{"email":ub["email"]}); call("POST",f"/invitations/{inv['id']}/accept",tb)
s,t,_=call("POST",f"/projects/{pid}/tasks",ta,{"title":"Heroína","priority":"HIGH","assigneeId":ub["id"]})
s,_,_=call("POST",f"/tasks/{t['id']}/showcase",tb,{}); check("sem imagem final não envia",s,400)
s,f,_=upload(tb,t["id"],"heroina.png",png(),True)
s,art,_=call("POST",f"/tasks/{t['id']}/showcase",tb,{"title":"Heroína final"}); check("envia com NDA = travada",(s,art["ndaStatus"]),(201,"LOCKED_BY_NDA"))
s,_,_=call("GET",f"/showcase/{art['id']}/image",None); check("imagem travada sem login",s,404)
s,_,_=call("GET",f"/showcase/{art['id']}/image",tv); check("imagem travada p/ visitante",s,404)
s,img,_=call("GET",f"/showcase/{art['id']}/image",ta); check("contratante vê imagem travada",s,200)
s,_,_=call("DELETE",f"/files/{f['id']}",tb); check("não apaga imagem que está na vitrine",s,409)
s,prof,_=call("GET",f"/users/{ub['username']}/profile",tv)
mask=[x for x in prof["projects"] if x["masked"]]
check("visitante vê projeto NDA mascarado",(len(mask),mask[0]["name"] if mask else "-",mask[0]["ownerName"] if mask else "-"),(1,None,ua["fullName"]))
check("pessoal escondido p/ visitante",prof["hiddenPersonalProjects"],1)
s,prof2,_=call("GET",f"/users/{ub['username']}/profile",tb); check("dono do perfil vê tudo",(prof2["me"],len(prof2["projects"]),prof2["hiddenPersonalProjects"]),(True,2,0))
s,lst,_=call("GET",f"/projects/{pid}/showcase",ta); check("aba vitrine do dono",len(lst),1)
s,_,_=call("PATCH",f"/showcase/{art['id']}/nda-status",tb,{"status":"APPROVED_FOR_RELEASE"}); check("artista não libera a própria",s,404)
s,rej,_=call("PATCH",f"/showcase/{art['id']}/nda-status",ta,{"status":"LOCKED_BY_NDA","note":"Esperar trailer"}); check("contratante recusa com motivo",rej.get("reviewNote"),"Esperar trailer")
s,re,_=call("POST",f"/tasks/{t['id']}/showcase",tb,{"title":"Heroína v2"}); check("reenvio limpa motivo",(re["id"]==art["id"],re["reviewNote"]),(True,None))
s,ap,_=call("PATCH",f"/showcase/{art['id']}/nda-status",ta,{"status":"APPROVED_FOR_RELEASE"}); check("contratante (empresa) libera",ap.get("ndaStatus"),"APPROVED_FOR_RELEASE")
s,_,_=call("GET",f"/showcase/{art['id']}/image",None); check("liberada: imagem pública",s,200)
s,pub,_=call("GET","/showcase/public",None); check("aparece no Explorar",any(x["id"]==art["id"] for x in pub),True)
s,prof3,_=call("GET",f"/users/{ub['username']}/profile",tv); check("aparece no portfólio do artista",[x["id"] for x in prof3["portfolio"]],[art["id"]])
s,prof4,_=call("GET",f"/users/{ua['username']}/profile",tv); check("e no do estúdio",[x["id"] for x in prof4["portfolio"]],[art["id"]])
s,c,_=call("GET",f"/tasks/{t['id']}/canvas",tb); check("canvas vazio",c["content"],"[]")
s,c,_=call("PUT",f"/tasks/{t['id']}/canvas",tb,{"content":'[{"id":"n1","type":"note","x":1,"y":2,"text":"oi"}]'}); check("artista salva canvas",s,200)
s,c,_=call("GET",f"/tasks/{t['id']}/canvas",ta); check("dono lê canvas salvo",'"oi"' in c["content"],True)
s,_,_=call("PUT",f"/tasks/{t['id']}/canvas",tv,{"content":"[]"}); check("visitante não salva",s,404)
call("PATCH",f"/projects/{pid}/status",ta,{"status":"CLOSED"}); s,_,_=call("DELETE",f"/projects/{pid}",ta); check("apaga projeto com arte, canvas e arquivos",s,204)
call("PATCH",f"/projects/{pp['id']}/status",tb,{"status":"CLOSED"}); call("DELETE",f"/projects/{pp['id']}",tb)
print("\nRESULTADO:", "TUDO OK" if ok_all else "HÁ FALHAS")

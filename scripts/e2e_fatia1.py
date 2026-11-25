import json, secrets, urllib.request, urllib.error
BASE="http://localhost:8080/api/v1"
def call(method, path, token=None, body=None):
    req=urllib.request.Request(BASE+path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type","application/json")
    if token: req.add_header("Authorization","Bearer "+token)
    try:
        with urllib.request.urlopen(req) as r:
            raw=r.read().decode(); return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw=e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw
ok_all=True
def check(label, got, expected, extra=""):
    global ok_all
    ok = got==expected; ok_all &= ok
    print(("OK  " if ok else "FALHOU"), f"{label}: {got} (esperado {expected}) {extra}")
sfx=secrets.token_hex(3); pw="Teste#"+secrets.token_hex(8)
def register(name, role):
    s,b=call("POST","/auth/register",body={"fullName":f"Teste {name} {sfx}","username":f"teste_{name}_{sfx}","email":f"teste.{name}.{sfx}@arthub.test","password":pw,"role":role})
    check(f"cadastro {name}", s, 201, "" if s==201 else str(b)[:200]); return b["token"], b["user"]
ta,ua=register("estudio","COMPANY"); tb,ub=register("artista","ARTIST")

s,p=call("POST","/projects",ta,{"name":f"Corp {sfx}","slug":f"corp-{sfx}","type":"CORPORATE"}); check("empresa cria projeto corporativo",s,201,str(p)[:200] if s!=201 else f"type={p['type']} myRole={p['myRole']}")
corp=p["id"]
s,p2=call("POST","/projects",tb,{"name":f"Coop {sfx}","slug":f"coop-{sfx}","type":"COOPERATIVE"}); check("artista cria cooperativo",s,201); coop=p2["id"]
s,p3=call("POST","/projects",tb,{"name":f"Pessoal {sfx}","slug":f"pessoal-{sfx}"}); check("pessoal por padrão",p3.get("type"),"PERSONAL"); pess=p3["id"]

s,_=call("GET",f"/projects/{corp}",tb); check("artista de fora não vê o corporativo",s,404)
s,_=call("POST",f"/projects/{pess}/invitations",tb,{"email":ua["email"]}); check("pessoal não aceita convite",s,400)
s,inv=call("POST",f"/projects/{corp}/invitations",ta,{"email":ub["email"]}); check("empresa convida artista",s,201)
s,_=call("POST",f"/projects/{corp}/invitations",ta,{"email":ub["email"]}); check("convite duplicado",s,409)
s,_=call("POST",f"/projects/{corp}/invitations",ta,{"email":"ninguem."+sfx+"@arthub.test"}); check("e-mail sem conta",s,404)
s,lst=call("GET","/invitations",tb); check("artista vê o convite",len(lst) if s==200 else s,1)
s,_=call("POST",f"/invitations/{inv['id']}/accept",tb); check("artista aceita",s,200)
s,_=call("POST",f"/invitations/{inv['id']}/accept",tb); check("aceitar de novo",s,409)

s,lp=call("GET","/projects",tb); roles={x["id"]:x["myRole"] for x in lp}
check("lista do artista inclui o corporativo como MEMBER",roles.get(corp),"MEMBER")
s,m=call("GET",f"/projects/{corp}/members",tb); check("membro vê a lista de membros",len(m) if s==200 else s,1)
s,t=call("POST",f"/projects/{corp}/tasks",ta,{"title":"Concept do herói","priority":"HIGH"}); check("dono cria tarefa",s,201); tid=t["id"]
s,_=call("GET",f"/projects/{corp}/tasks",tb); check("contratado vê as tarefas",s,200)
s,_=call("POST",f"/projects/{corp}/tasks",tb,{"title":"x","priority":"LOW"}); check("contratado não cria tarefa no corporativo",s,403)
s,_=call("PATCH",f"/tasks/{tid}/status",tb,{"status":"DONE"}); check("contratado não move (até a fatia 2)",s,403)
s,_=call("PATCH",f"/projects/{corp}/status",tb,{"status":"CLOSED"}); check("membro não encerra o projeto",s,403)
s,_=call("POST",f"/projects/{corp}/invitations",tb,{"email":ua["email"]}); check("membro não convida",s,403)

s,inv2=call("POST",f"/projects/{coop}/invitations",tb,{"email":ua["email"]}); call("POST",f"/invitations/{inv2['id']}/accept",ta)
s,t2=call("POST",f"/projects/{coop}/tasks",ta,{"title":"Cenário","priority":"MEDIUM"}); check("membro cria tarefa no cooperativo",s,201)
s,_=call("PATCH",f"/tasks/{t2['id']}/status",ta,{"status":"IN_PROGRESS"}); check("membro move tarefa no cooperativo",s,200)

s,_=call("POST",f"/projects/{corp}/leave",ta); check("dono não pode sair",s,400)
s,_=call("POST",f"/projects/{corp}/leave",tb); check("contratado sai do projeto",s,204)
s,_=call("GET",f"/projects/{corp}",tb); check("depois de sair, não vê mais",s,404)

# limpeza: encerra e apaga os projetos de teste
for tok,pid in ((ta,corp),(tb,coop),(tb,pess)):
    call("PATCH",f"/projects/{pid}/status",tok,{"status":"CLOSED"})
    s,_=call("DELETE",f"/projects/{pid}",tok); check(f"apaga projeto de teste {pid}",s,204)
print("\nRESULTADO:", "TUDO OK" if ok_all else "HÁ FALHAS")

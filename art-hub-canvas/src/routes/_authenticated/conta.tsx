import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download, ImagePlus, Trash2 } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadWithAuth, type Account } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({ meta: [{ title: "Minha conta — WorkAt" }] }),
  component: AccountPage,
});

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Feedback({ ok, error }: { ok: string | null; error: string | null }) {
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="text-sm text-emerald-400">
        {ok}
      </p>
    );
  return null;
}

/** Perfil público, foto, espaço usado, senha, exportar dados e excluir conta. */
function AccountPage() {
  const { updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setAccount)
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Não foi possível carregar a conta."));
  }, []);

  const applyAccount = (next: Account) => {
    setAccount(next);
    updateUser({ fullName: next.fullName, avatarUrl: next.avatarUrl });
  };

  if (loadError)
    return (
      <AppLayout title="Minha conta">
        <div role="alert" className="glass mx-auto max-w-2xl rounded-2xl p-4 text-sm text-destructive">
          {loadError}
        </div>
      </AppLayout>
    );
  if (!account)
    return (
      <AppLayout title="Minha conta">
        <div className="glass mx-auto h-64 max-w-2xl animate-pulse rounded-2xl" />
      </AppLayout>
    );

  return (
    <AppLayout title="Minha conta" subtitle={`@${account.username} · ${account.email}`}>
      <div className="mx-auto max-w-2xl space-y-5">
        <ProfileSection account={account} onSaved={applyAccount} />
        <StorageSection account={account} />
        <PasswordSection />
        <DataSection
          onDeleted={() => {
            logout();
            void navigate({ to: "/login", replace: true });
          }}
        />
      </div>
    </AppLayout>
  );
}

function ProfileSection({ account, onSaved }: { account: Account; onSaved: (a: Account) => void }) {
  const [fullName, setFullName] = useState(account.fullName);
  const [bio, setBio] = useState(account.bio ?? "");
  const [specialties, setSpecialties] = useState(account.specialties.join(", "));
  const [links, setLinks] = useState(account.links.join("\n"));
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const run = async (action: () => Promise<Account>, message: string) => {
    setBusy(true);
    setOk(null);
    setError(null);
    try {
      onSaved(await action());
      setOk(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    void run(
      () =>
        api.updateProfile({
          fullName,
          bio,
          specialties: specialties.split(",").map((s) => s.trim()).filter(Boolean),
          links: links.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      "Perfil salvo.",
    );
  };

  return (
    <Section title="Perfil público" description="É o que aparece em /u/seu-usuario, para qualquer pessoa.">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar name={account.fullName} src={account.avatarUrl} size="lg" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run(() => api.uploadAvatar(file), "Foto atualizada.");
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}>
            <ImagePlus className="mr-1 size-4" /> {account.avatarUrl ? "Trocar foto" : "Enviar foto"}
          </Button>
          {account.avatarUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void run(() => api.removeAvatar(), "Foto removida.")}
            >
              Remover
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">PNG, JPG ou WEBP, até 5 MB.</p>
        </div>
      </div>
      <form onSubmit={save} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="accName">Nome</Label>
          <Input id="accName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="accBio">Bio</Label>
          <Textarea
            id="accBio"
            value={bio}
            maxLength={500}
            placeholder="Conte em poucas linhas o que você faz."
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">{bio.length}/500</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accSpecialties">Especialidades</Label>
          <Input
            id="accSpecialties"
            value={specialties}
            placeholder="Concept art, Ilustração, Personagens"
            onChange={(e) => setSpecialties(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Separe por vírgula. Até 8.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accLinks">Links</Label>
          <Textarea
            id="accLinks"
            value={links}
            placeholder={"https://www.artstation.com/seu-usuario\nhttps://instagram.com/seu-usuario"}
            onChange={(e) => setLinks(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Um por linha, começando com https://. Até 5.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
            {busy ? "Salvando..." : "Salvar perfil"}
          </Button>
          <Link to="/u/$username" params={{ username: account.username }} className="text-sm text-primary hover:underline">
            Ver meu perfil
          </Link>
        </div>
        <Feedback ok={ok} error={error} />
      </form>
    </Section>
  );
}

function StorageSection({ account }: { account: Account }) {
  const quota = account.storageQuotaBytes;
  const percent = quota > 0 ? Math.min(100, Math.round((account.storageUsedBytes / quota) * 100)) : 0;
  return (
    <Section title="Espaço usado" description="Arquivos que você enviou em tarefas e imagens dos seus posts.">
      {quota > 0 ? (
        <div className="space-y-2">
          <Progress value={percent} aria-label={`${percent}% do espaço usado`} />
          <p className="text-sm text-muted-foreground">
            {megabytes(account.storageUsedBytes)} de {megabytes(quota)} ({percent}%)
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{megabytes(account.storageUsedBytes)} usados, sem limite.</p>
      )}
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setOk(null);
    setError(null);
    if (next !== confirm) {
      setError("As duas senhas novas não são iguais.");
      return;
    }
    setBusy(true);
    try {
      setOk((await api.changePassword(current, next)).message);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível trocar a senha.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Senha" description="Mínimo de 8 caracteres, com maiúscula, minúscula e número.">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pwCurrent">Senha atual</Label>
          <Input id="pwCurrent" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pwNew">Nova senha</Label>
          <Input id="pwNew" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pwConfirm">Repita a nova</Label>
          <Input id="pwConfirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Trocar senha"}
          </Button>
        </div>
        <div className="sm:col-span-3">
          <Feedback ok={ok} error={error} />
        </div>
      </form>
    </Section>
  );
}

function DataSection({ onDeleted }: { onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async () => {
    setError(null);
    try {
      await downloadWithAuth("/me/export", "workat-dados.json");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível exportar.");
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAccount(password);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir a conta.");
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Seus dados" description="Baixe uma cópia ou exclua a conta (LGPD).">
      <Button type="button" variant="outline" onClick={() => void exportData()}>
        <Download className="mr-1 size-4" /> Baixar meus dados (.json)
      </Button>
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-destructive">Excluir conta</h3>
        <p className="text-sm text-muted-foreground">
          Apaga seus projetos sem membros, suas publicações e avisos, e tira você dos outros projetos. Projetos
          seus com membros precisam ser passados para alguém antes (aba Membros). Não dá para desfazer.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="deletePassword">Sua senha</Label>
            <Input
              id="deletePassword"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="button" variant="destructive" disabled={!password || busy} onClick={() => setConfirmOpen(true)}>
            <Trash2 className="mr-1 size-4" /> Excluir minha conta
          </Button>
        </div>
      </div>
      <Feedback ok={null} error={error} />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir sua conta?"
        description="Seu perfil sai do ar e você não consegue mais entrar. Não dá para desfazer."
        confirmLabel="Excluir conta"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
      />
    </Section>
  );
}

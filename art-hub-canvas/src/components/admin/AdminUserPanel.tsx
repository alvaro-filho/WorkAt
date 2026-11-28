import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, ShieldAlert, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";

import {
  ACTION_LABEL,
  ActionDialog,
  EVENT_LABEL,
  formatBytes,
  formatDate,
  STATUS_LABEL,
  type ActionInput,
} from "@/components/admin/AdminDialogs";
import { ArtImage } from "@/components/art/ArtPieces";
import { UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, type AdminUserDetail } from "@/lib/api";

type Pending =
  | { kind: "suspend" }
  | { kind: "reactivate" }
  | { kind: "ban" }
  | { kind: "purge" }
  | { kind: "remove"; postId: number; title: string }
  | null;

const statusClass: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-300",
  SUSPENDED: "bg-amber-500/15 text-amber-300",
  BANNED: "bg-red-500/15 text-red-300",
};

/** Ficha de uma conta no painel: ações, atividade (IP, aparelho), contas ligadas, publicações e provas. */
export function AdminUserPanel({
  userId,
  onOpenUser,
}: {
  userId: number;
  onOpenUser: (id: number) => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [quota, setQuota] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const apply = (next: AdminUserDetail) => {
    setDetail(next);
    setQuota(next.storageQuotaMb != null ? String(next.storageQuotaMb) : "");
    setNote(next.adminNote ?? "");
  };

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(null);
    setInfo(null);
    adminApi
      .user(userId)
      .then((loaded) => active && apply(loaded))
      .catch(
        (e: unknown) =>
          active && setError(e instanceof Error ? e.message : "Não foi possível abrir a conta."),
      );
    return () => {
      active = false;
    };
  }, [userId]);

  if (error) return <p className="p-4 text-sm text-destructive">{error}</p>;
  if (!detail) return <div className="m-4 h-64 animate-pulse rounded-2xl bg-white/5" />;

  const { user } = detail;
  const run = async (action: () => Promise<AdminUserDetail | void>, message: string) => {
    const result = await action();
    if (result) apply(result);
    else apply(await adminApi.user(userId));
    setInfo(message);
  };

  const confirm = async (input: ActionInput) => {
    if (!pending) return;
    if (pending.kind === "suspend")
      await run(() => adminApi.suspend(user.id, input.days, input.reason), "Conta suspensa.");
    if (pending.kind === "reactivate")
      await run(() => adminApi.reactivate(user.id, input.reason), "Conta reativada.");
    if (pending.kind === "ban")
      await run(
        () => adminApi.ban(user.id, input.reason, input.password),
        "Conta banida. A prova foi congelada.",
      );
    if (pending.kind === "purge")
      await run(
        () => adminApi.purge(user.id, input.password),
        "Conteúdo apagado. As provas continuam guardadas.",
      );
    if (pending.kind === "remove")
      await run(
        () => adminApi.removePost(pending.postId, input.reason),
        "Publicação removida e autor avisado.",
      );
  };

  const saveSettings = async (reset = false) => {
    setSaving(true);
    try {
      const quotaMb = reset ? -1 : quota.trim() === "" ? undefined : Number(quota);
      apply(await adminApi.update(user.id, { ...(quotaMb !== undefined && { quotaMb }), note }));
      setInfo("Salvo.");
    } catch (e) {
      setInfo(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const dialog =
    pending?.kind === "suspend"
      ? {
          title: `Suspender @${user.username}`,
          description:
            "A pessoa não entra mais, a sessão aberta cai na hora e o perfil e as publicações somem do público. Nada é apagado, e a prova fica guardada.",
          confirmLabel: "Suspender",
          askDays: true,
        }
      : pending?.kind === "reactivate"
        ? {
            title: `Reativar @${user.username}`,
            description: "A pessoa volta a entrar e o conteúdo volta a aparecer.",
            confirmLabel: "Reativar",
            askReason: false,
          }
        : pending?.kind === "ban"
          ? {
              title: `Banir @${user.username}`,
              description:
                "Definitivo. Bloqueia a conta e o e-mail para sempre, os aparelhos usados para sempre e os IPs por 90 dias. O conteúdo some do público mas fica guardado como prova (dá para apagar depois).",
              confirmLabel: "Banir",
              destructive: true,
              askPassword: true,
            }
          : pending?.kind === "purge"
            ? {
                title: "Apagar o conteúdo",
                description:
                  "Apaga publicações, imagens, comentários e Chamadas desta conta banida para liberar espaço. Antes, uma prova com o hash de cada imagem é congelada.",
                confirmLabel: "Apagar",
                destructive: true,
                askReason: false,
                askPassword: true,
              }
            : pending?.kind === "remove"
              ? {
                  title: `Remover "${pending.title}"`,
                  description:
                    "A publicação é apagada e o autor recebe o aviso de que ela quebrou as diretrizes da moderação, com o motivo.",
                  confirmLabel: "Remover",
                  destructive: true,
                }
              : null;

  return (
    <div className="space-y-6 p-4">
      <header className="flex flex-wrap items-start gap-3">
        <UserAvatar name={user.fullName} src={user.avatarUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{user.fullName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass[user.status]}`}
            >
              {STATUS_LABEL[user.status]}
              {user.suspendedUntil && ` até ${formatDate(user.suspendedUntil)}`}
            </span>
            {!detail.trusted && user.status !== "BANNED" && (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                Conta nova (em quarentena)
              </span>
            )}
            {user.admin && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                Administrador
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            <Link
              to="/u/$username"
              params={{ username: user.username }}
              className="hover:underline"
            >
              @{user.username}
            </Link>{" "}
            · {user.email} · {user.role === "COMPANY" ? "Estúdio" : "Artista"}
          </p>
          <p className="text-xs text-muted-foreground">
            Cadastro {formatDate(user.createdAt)} · Último login {formatDate(user.lastLoginAt)} ·
            Espaço {formatBytes(user.usedBytes)} de {formatBytes(user.quotaBytes)} ·{" "}
            {user.postCount} publicações
            {detail.pendingPosts > 0 && ` (${detail.pendingPosts} esperando aprovação)`}
          </p>
          {detail.suspensionReason && user.status === "SUSPENDED" && (
            <p className="mt-1 text-xs text-amber-300">
              Motivo da suspensão: {detail.suspensionReason}
            </p>
          )}
          {detail.banReason && (
            <p className="mt-1 text-xs text-red-300">
              Banida em {formatDate(detail.bannedAt)}: {detail.banReason}
            </p>
          )}
        </div>
      </header>

      {info && (
        <p role="status" className="rounded-xl border border-border p-3 text-sm">
          {info}
        </p>
      )}

      <section aria-label="Ações" className="flex flex-wrap gap-2">
        {user.status === "ACTIVE" && !user.admin && (
          <Button size="sm" variant="outline" onClick={() => setPending({ kind: "suspend" })}>
            <UserX className="size-4" /> Suspender
          </Button>
        )}
        {user.status === "SUSPENDED" && (
          <Button size="sm" variant="outline" onClick={() => setPending({ kind: "reactivate" })}>
            <UserCheck className="size-4" /> Reativar
          </Button>
        )}
        {user.status !== "BANNED" && !user.admin && (
          <Button size="sm" variant="destructive" onClick={() => setPending({ kind: "ban" })}>
            <ShieldAlert className="size-4" /> Banir
          </Button>
        )}
        {!detail.trusted && user.status === "ACTIVE" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void run(
                () => adminApi.trust(user.id),
                "Conta liberada: publica direto daqui em diante.",
              )
            }
          >
            <ShieldCheck className="size-4" /> Confiar na conta
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void adminApi.dossier(user.id, false).catch((e: Error) => setInfo(e.message))
          }
        >
          <Download className="size-4" /> Dossiê
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void adminApi.dossier(user.id, true).catch((e: Error) => setInfo(e.message))
          }
        >
          <Download className="size-4" /> Dossiê com imagens
        </Button>
        {user.status === "BANNED" && user.postCount > 0 && (
          <Button size="sm" variant="outline" onClick={() => setPending({ kind: "purge" })}>
            <Trash2 className="size-4" /> Apagar conteúdo
          </Button>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="space-y-1">
          <p className="text-sm font-medium">Cota desta conta (MB)</p>
          <Input
            value={quota}
            onChange={(e) => setQuota(e.target.value.replace(/\D/g, ""))}
            placeholder="padrão"
          />
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => void saveSettings(true)}
          >
            Voltar para a padrão
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Anotação interna (a pessoa não vê)</p>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 2000))}
            rows={2}
          />
        </div>
        <Button size="sm" className="w-fit" disabled={saving} onClick={() => void saveSettings()}>
          Salvar cota e anotação
        </Button>
      </section>

      {detail.publicPosts.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Publicações (só as de conteúdo público)</h3>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {detail.publicPosts.map((post) => (
              <li key={post.id} className="overflow-hidden rounded-xl border border-border">
                <ArtImage
                  src={post.images[0]?.url ?? null}
                  title={post.title ?? "Arte"}
                  className="aspect-square w-full object-cover"
                />
                <div className="space-y-1 p-2">
                  <p className="truncate text-xs font-medium">{post.title ?? "Sem título"}</p>
                  {post.pendingReview && (
                    <p className="text-[11px] text-amber-300">Esperando aprovação</p>
                  )}
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() =>
                      setPending({
                        kind: "remove",
                        postId: post.id,
                        title: post.title ?? "Sem título",
                      })
                    }
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Atividade (IP, aparelho e navegador)</h3>
        {detail.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem registros ainda (o registro começou na V3.1).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/[0.04] text-muted-foreground">
                <tr>
                  <th className="p-2">Quando</th>
                  <th className="p-2">O quê</th>
                  <th className="p-2">IP</th>
                  <th className="p-2">Aparelho</th>
                  <th className="p-2">Navegador</th>
                </tr>
              </thead>
              <tbody>
                {detail.events.map((event) => (
                  <tr key={event.id} className="border-t border-border">
                    <td className="p-2 whitespace-nowrap">{formatDate(event.createdAt)}</td>
                    <td className="p-2 whitespace-nowrap">
                      {EVENT_LABEL[event.type] ?? event.type}
                    </td>
                    <td className="p-2 font-mono">{event.ip ?? "—"}</td>
                    <td className="p-2 font-mono">
                      {event.deviceId ? event.deviceId.slice(0, 13) : "—"}
                    </td>
                    <td className="max-w-[260px] truncate p-2" title={event.userAgent ?? ""}>
                      {event.userAgent ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Contas ligadas (mesmo IP ou aparelho)</h3>
        {detail.related.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {detail.related.map((other) => (
              <li key={other.id}>
                <button
                  type="button"
                  onClick={() => onOpenUser(other.id)}
                  className="flex w-full items-center justify-between gap-2 p-2 text-left text-sm hover:bg-white/5"
                >
                  <span>
                    @{other.username} · {other.email}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[other.status]}`}>
                    {STATUS_LABEL[other.status]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.projects.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Projetos</h3>
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {detail.projects.map((project) => (
              <li key={project.id} className="flex flex-wrap justify-between gap-2 p-2">
                <span>
                  {project.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {project.role === "OWNER" ? "dirige" : "participa"} · {project.members}{" "}
                    pessoa(s)
                    {project.nda && " · NDA"}
                    {project.publicView && " · público"}
                    {project.status === "CLOSED" && " · encerrado"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{formatBytes(project.bytes)}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            O conteúdo de projetos privados e sob NDA não aparece aqui, para preservar o sigilo
            combinado.
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Provas congeladas</h3>
        {detail.evidences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma ainda. Suspender, banir e remover publicação congelam uma.
          </p>
        ) : (
          <ul className="space-y-1 text-xs">
            {detail.evidences.map((item) => (
              <li key={item.id} className="rounded-lg border border-border p-2">
                <span className="font-medium">{ACTION_LABEL[item.action] ?? item.action}</span> em{" "}
                {formatDate(item.createdAt)}
                {item.reason && ` · ${item.reason}`}
                <span className="block font-mono break-all text-muted-foreground">
                  SHA-256 {item.sha256}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.bans.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Bloqueios criados</h3>
          <ul className="space-y-1 text-xs">
            {detail.bans.map((ban) => (
              <li
                key={ban.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-border p-2"
              >
                <span>
                  {ban.kind === "IP" ? "IP" : ban.kind === "DEVICE" ? "Aparelho" : "E-mail"}:{" "}
                  <span className="font-mono">{ban.value}</span>
                </span>
                <span className="text-muted-foreground">
                  {ban.expiresAt ? `até ${formatDate(ban.expiresAt)}` : "para sempre"}
                  {!ban.active && " (expirou)"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.actions.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Histórico da moderação</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {detail.actions.map((action) => (
              <li key={action.id}>
                {formatDate(action.createdAt)} · {ACTION_LABEL[action.action] ?? action.action}
                {action.detail && ` (${action.detail})`}
                {action.reason && ` · ${action.reason}`} · por {action.adminEmail}
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog && (
        <ActionDialog
          open={pending !== null}
          onOpenChange={(next) => !next && setPending(null)}
          onConfirm={confirm}
          {...dialog}
        />
      )}
    </div>
  );
}

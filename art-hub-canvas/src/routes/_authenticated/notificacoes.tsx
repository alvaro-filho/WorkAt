import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Mail, X } from "lucide-react";

import { refreshMenuCounts } from "@/components/layout/AppSidebar";
import { AppLayout } from "@/components/layout/AppLayout";
import { relativeTime, UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import { api, type AppNotification, type ProjectInvitation } from "@/lib/api";
import { projectTypeInfo } from "@/lib/project-labels";

type Tab = "gerais" | "convites";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  head: () => ({ meta: [{ title: "Notificações — WorkAt" }] }),
  validateSearch: (search: Record<string, unknown>): { aba?: Tab } =>
    search["aba"] === "convites" ? { aba: "convites" } : {},
  component: NotificationsPage,
});

/** Avisos ligados a convites: recebi um convite, recusaram ou aceitaram (entrou no projeto). */
const INVITE_TYPES = new Set([
  "INVITE_SENT",
  "INVITE_DECLINED",
  "INVITE_CANCELLED",
  "MEMBER_JOINED",
]);

/**
 * Notificações em duas abas: Gerais (tarefas, revisões, comentários, prazos, membros) e Convites
 * (convites pendentes, com aceitar e recusar ali mesmo, e o histórico de convites).
 */
function NotificationsPage() {
  const navigate = useNavigate();
  const { aba } = Route.useSearch();
  const tab: Tab = aba ?? "gerais";
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyInvite, setBusyInvite] = useState<number | null>(null);
  const now = Date.now();

  const load = async () => {
    try {
      const [data, pending] = await Promise.all([api.notifications(), api.myInvitations()]);
      setItems(data.items);
      setInvitations(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const { general, invites } = useMemo(() => {
    const list = items ?? [];
    return {
      general: list.filter((item) => !INVITE_TYPES.has(item.type)),
      invites: list.filter((item) => INVITE_TYPES.has(item.type)),
    };
  }, [items]);
  const unreadGeneral = general.filter((item) => !item.read).length;
  const unreadInvites = invites.filter((item) => !item.read).length;
  const unread = unreadGeneral + unreadInvites;

  const setTab = (next: Tab) =>
    void navigate({ to: "/notificacoes", search: next === "convites" ? { aba: "convites" } : {} });

  const open = async (item: AppNotification) => {
    if (!item.read) {
      try {
        await api.readNotification(item.id);
        refreshMenuCounts();
      } catch {
        // Abrir o link é mais importante do que marcar como lida.
      }
    }
    if (item.link && !item.link.startsWith("/notificacoes")) void navigate({ to: item.link });
    else void load();
  };

  const readAll = async () => {
    try {
      await api.readAllNotifications();
      refreshMenuCounts();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível marcar como lidas.");
    }
  };

  const answer = async (invitation: ProjectInvitation, accept: boolean) => {
    setBusyInvite(invitation.id);
    setError(null);
    try {
      if (accept) await api.acceptInvitation(invitation.id);
      else await api.declineInvitation(invitation.id);
      // O aviso do convite respondido fica lido.
      await Promise.all(
        invites
          .filter((item) => !item.read && item.type === "INVITE_SENT")
          .map((item) => api.readNotification(item.id).catch(() => undefined)),
      );
      refreshMenuCounts();
      if (accept) {
        void navigate({
          to: "/projetos/$projectId",
          params: { projectId: String(invitation.projectId) },
        });
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível responder ao convite.");
    } finally {
      setBusyInvite(null);
    }
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "gerais", label: "Gerais", count: unreadGeneral },
    // O aviso "convidou você" já está representado pelo convite pendente: não conta duas vezes.
    {
      id: "convites",
      label: "Convites",
      count:
        invitations.length +
        invites.filter((item) => !item.read && item.type !== "INVITE_SENT").length,
    },
  ];

  return (
    <AppLayout
      title="Notificações"
      subtitle={
        unread || invitations.length
          ? `${unread} não lida(s) · ${invitations.length} convite(s) pendente(s)`
          : "Tudo em dia"
      }
      flush
      actions={
        <button
          type="button"
          disabled={unread === 0}
          onClick={() => void readAll()}
          aria-label="Marcar todas como lidas"
          title="Marcar todas como lidas"
          className="rounded-full p-2 hover:bg-white/10 disabled:opacity-40"
        >
          <CheckCheck className="size-5" />
        </button>
      }
    >
      <div role="tablist" aria-label="Tipo de notificação" className="flex border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className="flex h-[53px] flex-1 items-center justify-center text-[15px] transition-colors hover:bg-white/[0.06]"
          >
            <span
              className={`relative flex h-full items-center gap-2 ${tab === item.id ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}
            >
              {item.label}
              {item.count > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[11px] leading-[18px] font-bold text-primary-foreground">
                  {item.count}
                </span>
              )}
              {tab === item.id && (
                <span
                  className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="border-b border-border p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {items === null && !error && (
        <div className="m-4 h-40 animate-pulse rounded-2xl bg-white/5" />
      )}

      {items !== null && tab === "convites" && (
        <>
          {invitations.length > 0 && (
            <section aria-label="Convites pendentes" className="border-b border-border">
              <h2 className="px-4 pt-4 pb-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Esperando sua resposta
              </h2>
              <ul className="divide-y divide-border">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex gap-3 p-4">
                    <UserAvatar
                      name={invitation.invitedBy.fullName}
                      src={invitation.invitedBy.avatarUrl}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-5">
                        <Link
                          to="/u/$username"
                          params={{ username: invitation.invitedBy.username }}
                          className="font-bold hover:underline"
                        >
                          {invitation.invitedBy.fullName}
                        </Link>{" "}
                        convidou você para o projeto{" "}
                        <span className="font-bold">{invitation.projectName}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {projectTypeInfo(invitation.projectType).label} ·{" "}
                        {relativeTime(invitation.createdAt, now)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="gradient-primary rounded-full text-primary-foreground"
                          disabled={busyInvite !== null}
                          onClick={() => void answer(invitation, true)}
                        >
                          <Check className="size-4" /> Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          disabled={busyInvite !== null}
                          onClick={() => void answer(invitation, false)}
                        >
                          <X className="size-4" /> Recusar
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {invites.length > 0 && (
            <section aria-label="Histórico de convites">
              <h2 className="px-4 pt-4 pb-2 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Histórico
              </h2>
              <NotificationList items={invites} now={now} onOpen={(item) => void open(item)} />
            </section>
          )}
          {invitations.length === 0 && invites.length === 0 && (
            <Empty
              icon={<Mail className="mx-auto mb-3 size-8 text-muted-foreground" />}
              title="Nenhum convite"
              text="Quando alguém chamar você para um projeto, o convite aparece aqui para você aceitar ou recusar."
            />
          )}
        </>
      )}

      {items !== null &&
        tab === "gerais" &&
        (general.length === 0 ? (
          <Empty
            icon={<Bell className="mx-auto mb-3 size-8 text-muted-foreground" />}
            title="Nada por aqui ainda"
            text="Tarefas novas, revisões, comentários, prazos e mudanças na equipe aparecem aqui."
          />
        ) : (
          <NotificationList items={general} now={now} onOpen={(item) => void open(item)} />
        ))}
    </AppLayout>
  );
}

function NotificationList({
  items,
  now,
  onOpen,
}: {
  items: AppNotification[];
  now: number;
  onOpen: (item: AppNotification) => void;
}) {
  return (
    <ul className="divide-y divide-border border-b border-border">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item)}
            className={`flex w-full items-start gap-3 p-4 text-left hover:bg-white/[0.03] ${item.read ? "" : "bg-primary/[0.06]"}`}
          >
            <span
              aria-hidden="true"
              className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[15px] leading-5 ${item.read ? "text-muted-foreground" : ""}`}
              >
                {item.message}
              </span>
              <span className="text-xs text-muted-foreground">
                {relativeTime(item.createdAt, now)}
                {!item.read && <span className="sr-only"> · não lida</span>}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="mx-auto max-w-sm px-4 py-12 text-center">
      {icon}
      <p className="text-2xl font-extrabold">{title}</p>
      <p className="mt-2 text-[15px] text-muted-foreground">{text}</p>
    </div>
  );
}

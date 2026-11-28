import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Search, X } from "lucide-react";

import {
  ACTION_LABEL,
  ActionDialog,
  formatBytes,
  formatDate,
  STATUS_LABEL,
} from "@/components/admin/AdminDialogs";
import { AdminUserPanel } from "@/components/admin/AdminUserPanel";
import { ArtImage } from "@/components/art/ArtPieces";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import {
  ApiError,
  adminApi,
  type AdminActionRow,
  type AdminOverview,
  type AdminUserRow,
  type Post,
} from "@/lib/api";

type Tab = "geral" | "aprovacao" | "contas" | "registro";
const TABS: { id: Tab; label: string }[] = [
  { id: "geral", label: "Visão geral" },
  { id: "aprovacao", label: "Aprovação" },
  { id: "contas", label: "Contas" },
  { id: "registro", label: "Registro" },
];

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administração — WorkAt" }] }),
  validateSearch: (search: Record<string, unknown>): { aba?: Tab; conta?: number } => ({
    ...(typeof search["aba"] === "string" && TABS.some((t) => t.id === search["aba"])
      ? { aba: search["aba"] as Tab }
      : {}),
    ...(search["conta"] != null && !Number.isNaN(Number(search["conta"]))
      ? { conta: Number(search["conta"]) }
      : {}),
  }),
  component: AdminPage,
});

/**
 * Painel de administração. Só abre para os e-mails da lista do servidor: para os outros, o próprio backend
 * responde "não encontrado" e a página mostra isso.
 */
function AdminPage() {
  const { aba, conta } = Route.useSearch();
  const navigate = useNavigate();
  const tab: Tab = conta ? "contas" : (aba ?? "geral");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    adminApi
      .overview()
      .then(setOverview)
      .catch((e: unknown) => {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401 || e.status === 403))
          setDenied(true);
      });
  }, [aba, conta]);

  const go = (next: { aba?: Tab; conta?: number }) => void navigate({ to: "/admin", search: next });

  if (denied) {
    return (
      <AppLayout title="Página não encontrada" back>
        <div className="mx-auto max-w-md rounded-2xl border border-border p-8 text-center">
          <p className="font-semibold">Esta página não existe.</p>
          <Link
            to="/publicacoes"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            Voltar para o início
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Administração" subtitle="Só você vê esta página" layout="wide">
      <div role="tablist" aria-label="Seções do painel" className="flex border-b border-border">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => go({ aba: item.id })}
            className={`relative flex-1 py-3.5 text-sm transition-colors hover:bg-white/5 ${
              tab === item.id ? "font-bold" : "text-muted-foreground"
            }`}
          >
            {item.label}
            {item.id === "aprovacao" && overview && overview.pendingPosts > 0 && (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                {overview.pendingPosts}
              </span>
            )}
            {tab === item.id && (
              <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {tab === "geral" && (
        <OverviewTab overview={overview} onOpenUser={(id) => go({ conta: id })} />
      )}
      {tab === "aprovacao" && (
        <ReviewTab
          onOpenUser={(id) => go({ conta: id })}
          onChanged={() => void adminApi.overview().then(setOverview)}
        />
      )}
      {tab === "contas" &&
        (conta ? (
          <div>
            <button
              type="button"
              onClick={() => go({ aba: "contas" })}
              className="px-4 pt-3 text-sm text-primary hover:underline"
            >
              ← Todas as contas
            </button>
            <AdminUserPanel userId={conta} onOpenUser={(id) => go({ conta: id })} />
          </div>
        ) : (
          <UsersTab onOpenUser={(id) => go({ conta: id })} />
        ))}
      {tab === "registro" && <LogTab />}
    </AppLayout>
  );
}

function Meter({ label, used, limit }: { label: string; used: number | null; limit: number }) {
  const percent = used == null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">
        {formatBytes(used)}{" "}
        <span className="text-sm font-normal text-muted-foreground">de {formatBytes(limit)}</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${percent > 85 ? "bg-red-400" : percent > 60 ? "bg-amber-400" : "bg-emerald-400"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function OverviewTab({
  overview,
  onOpenUser,
}: {
  overview: AdminOverview | null;
  onOpenUser: (id: number) => void;
}) {
  if (!overview) return <div className="m-4 h-48 animate-pulse rounded-2xl bg-white/5" />;
  const stats = [
    {
      label: "Contas",
      value: overview.users.total,
      hint: `${overview.users.artists} artistas · ${overview.users.companies} estúdios`,
    },
    { label: "Novas em 30 dias", value: overview.users.newLast30Days },
    { label: "Suspensas", value: overview.users.suspended },
    { label: "Banidas", value: overview.users.banned },
    {
      label: "Publicações",
      value: overview.posts,
      hint: `${overview.pendingPosts} esperando aprovação`,
    },
    { label: "Projetos", value: overview.projects },
    { label: "Chamadas abertas", value: overview.openCalls },
  ];
  return (
    <div className="space-y-6 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-border p-4">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-extrabold">{item.value}</p>
            {item.hint && <p className="text-xs text-muted-foreground">{item.hint}</p>}
          </div>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Meter
          label="Imagens e arquivos (bucket)"
          used={overview.storage.usedBytes}
          limit={overview.storage.limitBytes}
        />
        <Meter
          label="Banco de dados"
          used={overview.database.usedBytes}
          limit={overview.database.limitBytes}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Cota padrão por pessoa: {overview.defaultQuotaMb} MB.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-2">
          <h3 className="font-semibold">Cadastros recentes</h3>
          <UserList users={overview.recentSignups} onOpenUser={onOpenUser} />
        </section>
        <section className="space-y-2">
          <h3 className="font-semibold">Últimas ações</h3>
          <ActionList actions={overview.recentActions} />
        </section>
      </div>
    </div>
  );
}

function UserList({
  users,
  onOpenUser,
}: {
  users: AdminUserRow[];
  onOpenUser: (id: number) => void;
}) {
  if (users.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma conta.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {users.map((user) => (
        <li key={user.id}>
          <button
            type="button"
            onClick={() => onOpenUser(user.id)}
            className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-white/5"
          >
            <UserAvatar name={user.fullName} src={user.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {user.fullName}{" "}
                <span className="font-normal text-muted-foreground">@{user.username}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user.email} · cadastro {formatDate(user.createdAt)} · {formatBytes(user.usedBytes)}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {STATUS_LABEL[user.status]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ActionList({ actions }: { actions: AdminActionRow[] }) {
  if (actions.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhuma ação ainda.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {actions.map((action) => (
        <li key={action.id} className="rounded-lg border border-border p-2">
          <span className="font-medium">{ACTION_LABEL[action.action] ?? action.action}</span> ·{" "}
          {action.targetLabel}
          <span className="block text-xs text-muted-foreground">
            {formatDate(action.createdAt)} · {action.adminEmail}
            {action.detail && ` · ${action.detail}`}
            {action.reason && ` · motivo: ${action.reason}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

function UsersTab({ onOpenUser }: { onOpenUser: (id: number) => void }) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState("recent");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      adminApi
        .users({ q: query, status, role, sort })
        .then((list) => active && setUsers(list))
        .catch(() => active && setUsers([]));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, status, role, sort]);

  const select = "h-10 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Buscar contas</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, @ ou e-mail"
            className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm"
          />
        </label>
        <select
          aria-label="Situação"
          className={select}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Todas</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
          <option value="banned">Banidas</option>
        </select>
        <select
          aria-label="Tipo"
          className={select}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">Artistas e estúdios</option>
          <option value="ARTIST">Artistas</option>
          <option value="COMPANY">Estúdios</option>
        </select>
        <select
          aria-label="Ordem"
          className={select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Cadastro mais recente</option>
          <option value="space">Mais espaço usado</option>
        </select>
      </div>
      {users === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <UserList users={users} onOpenUser={onOpenUser} />
      )}
    </div>
  );
}

function ReviewTab({
  onOpenUser,
  onChanged,
}: {
  onOpenUser: (id: number) => void;
  onChanged: () => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [removing, setRemoving] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    adminApi
      .review()
      .then(setPosts)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Não foi possível carregar a fila."),
      );

  useEffect(() => {
    void load();
  }, []);

  const approve = async (post: Post) => {
    try {
      await adminApi.approve(post.id);
      setPosts((list) => list?.filter((item) => item.id !== post.id) ?? null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível aprovar.");
    }
  };

  return (
    <div className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">
        Publicações de contas novas só vão ao ar depois da sua aprovação. Depois de 3 aprovadas, a
        conta passa a publicar direto; você também pode liberar a conta na ficha dela.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {posts === null && <div className="h-40 animate-pulse rounded-2xl bg-white/5" />}
      {posts?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nada esperando aprovação.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts?.map((post) => (
          <li key={post.id} className="overflow-hidden rounded-2xl border border-border">
            <div
              className={`grid gap-0.5 bg-black/40 ${post.images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {post.images.slice(0, 4).map((image) => (
                <ArtImage
                  key={image.id}
                  src={image.url}
                  title={post.title ?? "Arte"}
                  className="aspect-square w-full object-cover"
                />
              ))}
            </div>
            <div className="space-y-2 p-3">
              <p className="font-semibold">{post.title ?? "Sem título"}</p>
              {post.subtitle && <p className="text-sm text-muted-foreground">{post.subtitle}</p>}
              <button
                type="button"
                onClick={() => onOpenUser(Number(post.author.id))}
                className="text-xs text-primary hover:underline"
              >
                @{post.author.username} · ver a conta
              </button>
              <p className="text-xs text-muted-foreground">Enviada {formatDate(post.createdAt)}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void approve(post)}>
                  <Check className="size-4" /> Aprovar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setRemoving(post)}>
                  <X className="size-4" /> Recusar e remover
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <ActionDialog
        open={removing !== null}
        onOpenChange={(next) => !next && setRemoving(null)}
        title={`Recusar "${removing?.title ?? "Sem título"}"`}
        description="A publicação é apagada, a prova fica guardada e o autor recebe o aviso de que ela quebrou as diretrizes, com o motivo."
        confirmLabel="Recusar e remover"
        destructive
        onConfirm={async ({ reason }) => {
          if (!removing) return;
          await adminApi.removePost(removing.id, reason);
          setPosts((list) => list?.filter((item) => item.id !== removing.id) ?? null);
          onChanged();
        }}
      />
    </div>
  );
}

function LogTab() {
  const [actions, setActions] = useState<AdminActionRow[] | null>(null);
  useEffect(() => {
    adminApi
      .log(300)
      .then(setActions)
      .catch(() => setActions([]));
  }, []);
  return (
    <div className="space-y-2 p-4">
      <p className="text-sm text-muted-foreground">
        Tudo o que foi feito pelo painel. O painel não tem como apagar este registro.
      </p>
      {actions === null ? (
        <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <ActionList actions={actions} />
      )}
    </div>
  );
}

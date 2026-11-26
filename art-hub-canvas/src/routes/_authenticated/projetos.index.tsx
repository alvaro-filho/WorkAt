import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Check,
  Clock,
  FolderKanban,
  Globe,
  ListChecks,
  Lock,
  Mail,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { refreshMenuCounts } from "@/components/layout/AppSidebar";
import { relativeTime, UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  fetchFileBlob,
  type Project,
  type ProjectInvitation,
  type ProjectOverview,
  type ProjectTemplate,
  type ProjectType,
} from "@/lib/api";
import { makeSlug, PROJECT_TYPES, projectTypeInfo } from "@/lib/project-labels";

export const Route = createFileRoute("/_authenticated/projetos/")({
  head: () => ({ meta: [{ title: "Projetos — WorkAt" }] }),
  component: ProjectsPage,
});

type Filter = "todos" | "dirijo" | "participo" | ProjectType | "encerrados";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "dirijo", label: "Que dirijo" },
  { id: "participo", label: "Que participo" },
  { id: "PERSONAL", label: "Pessoais" },
  { id: "COOPERATIVE", label: "Cooperativos" },
  { id: "CORPORATE", label: "Corporativos" },
  { id: "encerrados", label: "Encerrados" },
];

function matchesFilter(item: ProjectOverview, filter: Filter) {
  const project = item.project;
  const closed = project.status === "CLOSED";
  if (filter === "encerrados") return closed;
  if (closed) return false;
  if (filter === "dirijo") return project.myRole === "OWNER";
  if (filter === "participo") return project.myRole === "MEMBER";
  if (filter === "todos") return true;
  return project.type === filter;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Projetos: busca, filtros, um resumo do que pede atenção e cartões com capa, progresso das tarefas,
 * atrasos, quem participa e a última atividade. Encerrados ficam no filtro próprio.
 */
function ProjectsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProjectOverview[] | null>(null);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<ProjectType>("PERSONAL");
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [overview, invitationList] = await Promise.all([
        api.projectsOverview(),
        api.myInvitations(),
      ]);
      setItems(overview);
      setInvitations(invitationList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar seus projetos.");
      setItems((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (type: ProjectType) => {
    setCreateType(type);
    setCreateOpen(true);
  };

  const active = useMemo(
    () => (items ?? []).filter((item) => item.project.status !== "CLOSED"),
    [items],
  );
  const totals = useMemo(
    () => ({
      active: active.length,
      mine: active.reduce((sum, item) => sum + item.mine, 0),
      overdue: active.reduce((sum, item) => sum + item.overdue, 0),
      review: active
        .filter((item) => item.project.myRole === "OWNER")
        .reduce((sum, item) => sum + item.taskInReview, 0),
    }),
    [active],
  );

  const visible = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return (items ?? []).filter((item) => {
      if (!matchesFilter(item, filter)) return false;
      if (words.length === 0) return true;
      const haystack = normalize(
        [item.project.name, item.project.description, item.project.owner?.fullName]
          .filter(Boolean)
          .join(" "),
      );
      return words.every((word) => haystack.includes(word));
    });
  }, [items, filter, query]);

  const counts = useMemo(() => {
    const result: Partial<Record<Filter, number>> = {};
    for (const option of FILTERS)
      result[option.id] = (items ?? []).filter((item) => matchesFilter(item, option.id)).length;
    return result;
  }, [items]);

  return (
    <AppLayout
      layout="wide"
      title="Projetos"
      subtitle="Pessoais, cooperativos e corporativos"
      actions={
        <Button
          className="gradient-primary rounded-full text-primary-foreground"
          onClick={() => openCreate("PERSONAL")}
        >
          <Plus className="size-4" /> Novo projeto
        </Button>
      }
    >
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-destructive/40 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {invitations.length > 0 && (
        <InvitationsPanel
          invitations={invitations}
          onAnswered={async (invitation, accepted) => {
            await load();
            if (accepted)
              navigate({
                to: "/projetos/$projectId",
                params: { projectId: String(invitation.projectId) },
              });
          }}
        />
      )}

      {/* O que pede atenção agora */}
      <section aria-label="Resumo" className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat
          icon={<FolderKanban className="size-4" />}
          label="Projetos ativos"
          value={totals.active}
        />
        <Stat
          icon={<UserRound className="size-4" />}
          label="Tarefas com você"
          value={totals.mine}
          to="/minhas-tarefas"
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label="Atrasadas"
          value={totals.overdue}
          tone={totals.overdue > 0 ? "danger" : undefined}
        />
        <Stat
          icon={<ListChecks className="size-4" />}
          label="Esperando sua revisão"
          value={totals.review}
          tone={totals.review > 0 ? "warn" : undefined}
        />
      </section>

      {/* Busca e filtros */}
      <div className="mb-5 space-y-3">
        <label className="relative block max-w-md">
          <span className="sr-only">Buscar projetos</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, descrição ou diretor"
            className="h-10 w-full rounded-full border border-border bg-white/5 pr-4 pl-10 text-sm outline-none focus:border-primary focus:bg-transparent"
          />
        </label>
        <div role="tablist" aria-label="Filtrar projetos" className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filter === option.id}
              onClick={() => setFilter(option.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                filter === option.id
                  ? "border-primary bg-primary/15 font-semibold text-foreground"
                  : "border-border text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {option.label}
              <span className="ml-1.5 text-muted-foreground tabular-nums">
                {counts[option.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Carregando projetos">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          filter={filter}
          searching={query.trim().length > 0}
          onCreate={() =>
            openCreate(filter === "COOPERATIVE" || filter === "CORPORATE" ? filter : "PERSONAL")
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ProjectCard key={item.project.id} item={item} />
          ))}
        </ul>
      )}

      <CreateProjectDialog
        open={createOpen}
        initialType={createType}
        onOpenChange={setCreateOpen}
        onCreated={(project) =>
          navigate({ to: "/projetos/$projectId", params: { projectId: String(project.id) } })
        }
      />
    </AppLayout>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "danger" | "warn" | undefined;
  to?: string;
}) {
  const color =
    tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-300" : "text-foreground";
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        {icon} {label}
      </span>
      <span className={`mt-1 block text-2xl font-extrabold tabular-nums ${color}`}>{value}</span>
    </>
  );
  const className = "block rounded-2xl border border-border p-3 transition-colors";
  return to ? (
    <Link to={to} className={`${className} hover:bg-white/[0.04]`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Capa do cartão: a imagem do projeto vem com login (arquivo privado), por isso é baixada como blob. */
function useCoverUrl(fileId: number | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (fileId === null) {
      setUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | null = null;
    fetchFileBlob(fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  return url;
}

function ProjectCard({ item }: { item: ProjectOverview }) {
  const { project } = item;
  const info = projectTypeInfo(project.type);
  const Icon = info.icon;
  const cover = useCoverUrl(item.coverFileId);
  const closed = project.status === "CLOSED";
  const progress = item.taskTotal === 0 ? 0 : Math.round((item.taskDone / item.taskTotal) * 100);
  const extraPeople = item.memberCount - item.people.length;
  const directing = project.myRole === "OWNER";

  return (
    <li>
      <Link
        to="/projetos/$projectId"
        params={{ projectId: String(project.id) }}
        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.02] transition-colors hover:border-primary/40 hover:bg-white/[0.04] ${
          closed ? "opacity-70" : ""
        }`}
      >
        {/* Capa */}
        <div className="relative h-36 overflow-hidden bg-gradient-to-br from-primary/30 via-primary/10 to-neon/20">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Icon className="size-10 text-white/40" />
            </div>
          )}
          <div className="absolute inset-x-0 top-0 flex flex-wrap items-center gap-1.5 p-2">
            <Chip>
              <Icon className="size-3" /> {info.label}
            </Chip>
            {project.ndaActive && (
              <Chip className="text-amber-300">
                <Lock className="size-3" /> NDA
              </Chip>
            )}
            {project.publiclyVisible && (
              <Chip className="text-neon">
                <Globe className="size-3" /> Público
              </Chip>
            )}
            {closed && <Chip>Encerrado</Chip>}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="truncate text-[17px] font-bold group-hover:text-primary">{project.name}</p>
          <p className="text-[13px] text-muted-foreground">
            {directing ? (
              "Você dirige este projeto"
            ) : (
              <>
                Diretor do projeto:{" "}
                <span className="text-foreground">{project.owner?.fullName ?? "—"}</span>
              </>
            )}
          </p>
          <p className="mt-2 line-clamp-2 min-h-[2.5em] text-[13px] text-muted-foreground">
            {project.description || "Sem descrição."}
          </p>

          {/* Progresso */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-muted-foreground">
                {item.taskTotal === 0
                  ? "Nenhuma tarefa ainda"
                  : `${item.taskDone} de ${item.taskTotal} ${item.taskTotal === 1 ? "tarefa concluída" : "tarefas concluídas"}`}
              </span>
              {item.taskTotal > 0 && (
                <span className="font-semibold tabular-nums">{progress}%</span>
              )}
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
              aria-hidden="true"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {(item.mine > 0 || item.overdue > 0 || item.taskInReview > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {item.mine > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                  {item.mine} com você
                </span>
              )}
              {item.overdue > 0 && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                  {item.overdue} {item.overdue === 1 ? "atrasada" : "atrasadas"}
                </span>
              )}
              {item.taskInReview > 0 && (
                <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-300">
                  {item.taskInReview} em revisão
                </span>
              )}
            </div>
          )}

          {/* Equipe e última atividade */}
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {item.people.map((person) => (
                  <span
                    key={person.id}
                    className="rounded-full ring-2 ring-background"
                    title={person.fullName}
                  >
                    <UserAvatar name={person.fullName} src={person.avatarUrl} size="sm" />
                  </span>
                ))}
              </div>
              {extraPeople > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">+{extraPeople}</span>
              )}
            </div>
            {item.lastActivityAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" /> {relativeTime(item.lastActivityAt, Date.now())}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm ${className}`}
    >
      {children}
    </span>
  );
}

function EmptyState({
  filter,
  searching,
  onCreate,
}: {
  filter: Filter;
  searching: boolean;
  onCreate: () => void;
}) {
  const typeInfo = PROJECT_TYPES.find((item) => item.value === filter);
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border p-10 text-center">
      <FolderKanban className="mx-auto mb-3 size-8 text-muted-foreground" />
      <p className="text-lg font-bold">
        {searching
          ? "Nenhum projeto encontrado"
          : filter === "encerrados"
            ? "Nenhum projeto encerrado"
            : typeInfo
              ? `Nenhum projeto ${typeInfo.adjective} ainda`
              : "Nenhum projeto aqui ainda"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {searching
          ? "Tente outras palavras ou outro filtro."
          : (typeInfo?.description ??
            "Crie um projeto para organizar tarefas, referências e entregas.")}
      </p>
      {!searching && filter !== "encerrados" && (
        <Button
          className="gradient-primary mt-4 rounded-full text-primary-foreground"
          onClick={onCreate}
        >
          <Plus className="size-4" /> Criar projeto
        </Button>
      )}
    </div>
  );
}

function InvitationsPanel({
  invitations,
  onAnswered,
}: {
  invitations: ProjectInvitation[];
  onAnswered: (invitation: ProjectInvitation, accepted: boolean) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const answer = async (invitation: ProjectInvitation, accept: boolean) => {
    setBusyId(invitation.id);
    setError(null);
    try {
      if (accept) await api.acceptInvitation(invitation.id);
      else await api.declineInvitation(invitation.id);
      refreshMenuCounts();
      await onAnswered(invitation, accept);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível responder ao convite.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      className="glass mb-8 rounded-2xl border border-primary/40 p-4"
      aria-label="Convites pendentes"
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Mail className="size-4 text-primary" /> Convites para você
      </h2>
      <ul className="space-y-2">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 p-3"
          >
            <p className="text-sm">
              <span className="font-medium">{invitation.invitedBy.fullName}</span> convidou você
              para o projeto <span className="font-medium">{invitation.projectName}</span>{" "}
              <span className="text-muted-foreground">
                ({projectTypeInfo(invitation.projectType).label.toLowerCase()})
              </span>
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busyId !== null}
                onClick={() => void answer(invitation, false)}
              >
                <X className="size-4" /> Recusar
              </Button>
              <Button
                size="sm"
                className="gradient-primary text-primary-foreground"
                disabled={busyId !== null}
                onClick={() => void answer(invitation, true)}
              >
                <Check className="size-4" /> Aceitar
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function CreateProjectDialog({
  open,
  initialType,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  initialType: ProjectType;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: Project) => void;
}) {
  const [type, setType] = useState<ProjectType>(initialType);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState("");
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setName("");
      setDescription("");
      setTemplate("");
      setError(null);
      if (templates.length === 0) {
        api
          .projectTemplates()
          .then(setTemplates)
          .catch(() => setTemplates([]));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType]);
  const chosenTemplate = templates.find((item) => item.id === template);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const project = await api.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        slug: makeSlug(name),
        type,
        template: template || undefined,
      });
      onOpenChange(false);
      onCreated(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o projeto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card sm:max-w-xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              Escolha o tipo. Ele define quem participa e o que cada um pode fazer.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="sr-only">Tipo de projeto</legend>
            {PROJECT_TYPES.map((option) => {
              const Icon = option.icon;
              const selected = option.value === type;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${
                    selected ? "border-primary bg-primary/10" : "border-border hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="projectType"
                    value={option.value}
                    checked={selected}
                    onChange={() => setType(option.value)}
                    className="sr-only"
                  />
                  <Icon
                    className={`mb-2 size-5 ${selected ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                </label>
              );
            })}
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="projectName">Nome do projeto</Label>
            <Input
              id="projectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="projectDescription">Descrição</Label>
            <Textarea
              id="projectDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {templates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="projectTemplate">Começar com um modelo</Label>
              <select
                id="projectTemplate"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Projeto em branco</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.tasks.length} tarefas)
                  </option>
                ))}
              </select>
              {chosenTemplate && (
                <p className="text-xs text-muted-foreground">
                  {chosenTemplate.description} Tarefas:{" "}
                  {chosenTemplate.tasks.map((t) => t.title).join(", ")}.
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={busy || !name.trim()}
              className="gradient-primary text-primary-foreground"
            >
              {busy ? "Criando..." : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

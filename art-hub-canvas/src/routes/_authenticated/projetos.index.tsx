import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Mail, Plus, X } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
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
import { api, type Project, type ProjectInvitation, type ProjectType } from "@/lib/api";
import { makeSlug, PROJECT_TYPES, projectTypeInfo, roleLabel } from "@/lib/project-labels";

export const Route = createFileRoute("/_authenticated/projetos/")({
  head: () => ({ meta: [{ title: "Projetos — WorkAt" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<ProjectType>("PERSONAL");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [projectList, invitationList] = await Promise.all([
        api.projects(),
        api.myInvitations(),
      ]);
      setProjects(projectList);
      setInvitations(invitationList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar seus projetos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (type: ProjectType) => {
    setCreateType(type);
    setCreateOpen(true);
  };

  return (
    <AppLayout title="Projetos" subtitle="Seus projetos pessoais, cooperativos e corporativos">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Cada projeto tem o seu quadro de tarefas. Em cada tarefa ficam a descrição, as referências
          no Canvas e os arquivos de entrega.
        </p>
        <Button
          className="gradient-primary text-primary-foreground"
          onClick={() => openCreate("PERSONAL")}
        >
          <Plus className="size-4" /> Novo projeto
        </Button>
      </div>

      {error && (
        <div role="alert" className="glass mb-4 rounded-2xl p-4 text-sm text-destructive">
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

      {loading ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando projetos...
        </div>
      ) : (
        <div className="space-y-8">
          {PROJECT_TYPES.map((typeInfo) => (
            <ProjectSection
              key={typeInfo.value}
              type={typeInfo.value}
              projects={projects.filter((project) => project.type === typeInfo.value)}
              onCreate={() => openCreate(typeInfo.value)}
            />
          ))}
        </div>
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

function ProjectSection({
  type,
  projects,
  onCreate,
}: {
  type: ProjectType;
  projects: Project[];
  onCreate: () => void;
}) {
  const info = projectTypeInfo(type);
  const Icon = info.icon;
  const sorted = [...projects].sort(
    (a, b) => Number(a.status === "CLOSED") - Number(b.status === "CLOSED"),
  );

  return (
    <section aria-labelledby={`section-${type}`}>
      <header className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h2 id={`section-${type}`} className="text-sm font-semibold">
          {info.section}
        </h2>
        <Badge variant="secondary" className="bg-white/10">
          {projects.length}
        </Badge>
      </header>
      {sorted.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="glass glass-hover w-full rounded-2xl border border-dashed border-border p-6 text-left"
        >
          <p className="text-sm font-medium">Nenhum projeto {info.adjective} ainda.</p>
          <p className="mt-1 text-xs text-muted-foreground">{info.description}</p>
          <p className="mt-3 text-xs font-medium text-primary">
            + Criar projeto {info.adjective}
          </p>
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const closed = project.status === "CLOSED";
  return (
    <Link
      to="/projetos/$projectId"
      params={{ projectId: String(project.id) }}
      className={`glass glass-hover block rounded-2xl p-4 ${closed ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-medium">{project.name}</p>
        <div className="flex shrink-0 gap-1">
          {closed && <Badge variant="outline">Encerrado</Badge>}
          {project.type !== "PERSONAL" && (
            <Badge
              variant="outline"
              className={project.myRole === "OWNER" ? "border-primary/50 text-primary" : ""}
            >
              {roleLabel(project.myRole, project.type)}
            </Badge>
          )}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {project.description || "Sem descrição."}
      </p>
      {project.myRole === "MEMBER" && project.owner && (
        <p className="mt-3 text-xs text-muted-foreground">
          {project.type === "CORPORATE" ? "Para " : "De "}
          <span className="text-foreground">{project.owner.fullName}</span>
        </p>
      )}
    </Link>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open, initialType]);

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

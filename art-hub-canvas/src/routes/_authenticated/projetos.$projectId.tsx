import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, Globe, Lock, LogOut, Mail, UserMinus } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { GanttView } from "@/components/kanban/GanttView";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  api,
  ApiError,
  type ApiPriority,
  type ApiTask,
  type ApiTaskStatus,
  type Project,
  type ProjectInvitation,
  type ProjectMember,
} from "@/lib/api";
import { logStatusActivity } from "@/lib/activity-api";
import { useAuth } from "@/lib/AuthContext";
import {
  canWorkOnTask,
  projectPermissions,
  projectTypeInfo,
  roleLabel,
} from "@/lib/project-labels";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — WorkAt" }] }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId: projectIdParam } = Route.useParams();
  const projectId = Number(projectIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [loadedProject, loadedTasks] = await Promise.all([
        api.project(projectId),
        api.tasks(projectId),
      ]);
      setProject(loadedProject);
      setTasks(loadedTasks);
      // Para o campo "Responsável" ao criar tarefa (só quem pode criar tarefas precisa da lista).
      if (loadedProject.type !== "PERSONAL") {
        api
          .members(projectId)
          .then(setMembers)
          .catch(() => setMembers([]));
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : "Não foi possível carregar o projeto.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (Number.isFinite(projectId)) void load();
    else {
      setNotFound(true);
      setLoading(false);
    }
  }, [projectId, load]);

  if (loading && !project) {
    return (
      <AppLayout title="Projeto">
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando projeto...
        </div>
      </AppLayout>
    );
  }

  if (notFound || !project) {
    return (
      <AppLayout title="Projeto">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-medium">{error ?? "Projeto não encontrado."}</p>
          {!error && (
            <p className="mt-1 text-sm text-muted-foreground">
              Ele pode ter sido apagado, ou você não participa dele.
            </p>
          )}
          <Button asChild variant="outline" className="mt-4">
            <Link to="/projetos">Voltar para Projetos</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const permissions = projectPermissions(project);
  const typeInfo = projectTypeInfo(project.type);
  const TypeIcon = typeInfo.icon;
  const closed = project.status === "CLOSED";

  const createTask = async (data: {
    title: string;
    description: string;
    priority: ApiPriority;
    deadline?: string;
    assigneeId?: number;
  }) => {
    const task = await api.createTask(project.id, data);
    setTasks((items) => [...items, task]);
  };

  const moveTask = async (taskId: number, status: ApiTaskStatus) => {
    const updated = await api.updateTaskStatus(taskId, status);
    logStatusActivity(status, project.id);
    setTasks((items) => items.map((task) => (task.id === taskId ? updated : task)));
    return updated;
  };

  const assigneeOptions =
    project.type === "PERSONAL"
      ? []
      : [
          ...(project.owner ? [{ id: project.owner.id, fullName: project.owner.fullName }] : []),
          ...members.map((member) => ({ id: member.user.id, fullName: member.user.fullName })),
        ];

  return (
    <AppLayout
      title={project.name}
      subtitle={`${typeInfo.label} · ${roleLabel(project.myRole, project.type)}`}
    >
      <Link
        to="/projetos"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Projetos
      </Link>

      <header className="glass mb-4 flex flex-wrap items-start gap-4 rounded-2xl p-4">
        <div className="gradient-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
          <TypeIcon className="size-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{project.name}</h2>
            <Badge variant="outline">{typeInfo.label}</Badge>
            {closed && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-300">
                Encerrado
              </Badge>
            )}
            <VisibilityBadge project={project} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description || "Sem descrição."}
          </p>
          {project.owner && project.myRole === "MEMBER" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Dono: <span className="text-foreground">{project.owner.fullName}</span>
            </p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/projetos/$projectId/publico" params={{ projectId: String(project.id) }}>
            <Eye className="mr-1 size-4" /> Ver como público
          </Link>
        </Button>
      </header>

      {error && (
        <div role="alert" className="glass mb-4 rounded-2xl p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="quadro">
        <TabsList className="bg-white/5">
          <TabsTrigger value="quadro">Quadro</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          {permissions.hasMembers && <TabsTrigger value="membros">Membros</TabsTrigger>}
          {permissions.owner && <TabsTrigger value="config">Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="quadro" className="mt-4">
          <KanbanBoard
            tasks={tasks}
            loading={loading}
            error={null}
            closed={closed}
            canManageTasks={permissions.canManageTasks}
            canMoveTask={(task) => canWorkOnTask(project, task, user?.id)}
            assigneeOptions={assigneeOptions}
            readOnlyHint={
              project.type === "CORPORATE" && !permissions.owner
                ? project.contractorsSeeAllTasks
                  ? "Você vê todas as tarefas do projeto, mas só move e envia arquivos nas atribuídas a você."
                  : "Aqui aparecem só as tarefas atribuídas a você. Abra uma para enviar seus arquivos."
                : undefined
            }
            onCreateTask={createTask}
            onMoveTask={moveTask}
            onOpenTask={(task) =>
              navigate({
                to: "/projetos/$projectId/tarefas/$taskId",
                params: { projectId: String(project.id), taskId: String(task.id) },
              })
            }
          />
        </TabsContent>

        <TabsContent value="cronograma" className="mt-4">
          <GanttView tasks={tasks} />
        </TabsContent>

        {permissions.hasMembers && (
          <TabsContent value="membros" className="mt-4">
            <MembersTab project={project} />
          </TabsContent>
        )}

        {permissions.owner && (
          <TabsContent value="config" className="mt-4">
            <SettingsTab project={project} onProjectChange={setProject} />
          </TabsContent>
        )}
      </Tabs>
    </AppLayout>
  );
}

function MembersTab({ project }: { project: Project }) {
  const navigate = useNavigate();
  const permissions = projectPermissions(project);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [pending, setPending] = useState<ProjectInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const memberLabel = project.type === "CORPORATE" ? "contratado" : "membro";

  const load = useCallback(async () => {
    try {
      const [memberList, invitationList] = await Promise.all([
        api.members(project.id),
        permissions.owner ? api.projectInvitations(project.id) : Promise.resolve([]),
      ]);
      setMembers(memberList);
      setPending(invitationList);
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "Não foi possível carregar os membros.",
      });
    }
  }, [project.id, permissions.owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const invitation = await api.invite(project.id, email.trim());
      setEmail("");
      setMessage({ kind: "ok", text: `Convite enviado para ${invitation.invitedUser.fullName}.` });
      await load();
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "Não foi possível enviar o convite.",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (member: ProjectMember) => {
    setMessage(null);
    try {
      await api.removeMember(project.id, member.user.id);
      await load();
    } catch (e) {
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "Não foi possível remover.",
      });
    }
  };

  const leave = async () => {
    try {
      await api.leaveProject(project.id);
      navigate({ to: "/projetos" });
    } catch (e) {
      setConfirmLeave(false);
      setMessage({
        kind: "error",
        text: e instanceof Error ? e.message : "Não foi possível sair do projeto.",
      });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section className="glass rounded-2xl p-4">
        <h3 className="mb-3 text-sm font-semibold">Quem participa</h3>
        <ul className="divide-y divide-border">
          {project.owner && (
            <PersonRow
              name={project.owner.fullName}
              username={project.owner.username}
              label="Dono"
              highlight
            />
          )}
          {members.map((member) => (
            <PersonRow
              key={member.user.id}
              name={member.user.fullName}
              username={member.user.username}
              label={roleLabel("MEMBER", project.type)}
              action={
                permissions.owner ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void remove(member)}
                    aria-label={`Remover ${member.user.fullName}`}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                ) : undefined
              }
            />
          ))}
        </ul>
        {members.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Ainda não há nenhum {memberLabel}.{" "}
            {permissions.canInvite ? "Convide alguém pelo e-mail ao lado." : ""}
          </p>
        )}
        {!permissions.owner && (
          <Button variant="outline" className="mt-4" onClick={() => setConfirmLeave(true)}>
            <LogOut className="size-4" /> Sair do projeto
          </Button>
        )}
      </section>

      {permissions.owner && (
        <section className="glass space-y-4 rounded-2xl p-4">
          <form onSubmit={invite} className="space-y-2">
            <Label htmlFor="inviteEmail">Convidar por e-mail</Label>
            <Input
              id="inviteEmail"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!permissions.canInvite}
              required
            />
            <p className="text-xs text-muted-foreground">
              {permissions.canInvite
                ? "A pessoa precisa já ter conta no WorkAt e vai ver o convite na tela de Projetos."
                : "Retome o projeto para convidar pessoas."}
            </p>
            <Button type="submit" disabled={busy || !permissions.canInvite} className="w-full">
              <Mail className="size-4" /> {busy ? "Enviando..." : "Enviar convite"}
            </Button>
          </form>
          {pending.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                Convites pendentes
              </h4>
              <ul className="space-y-1 text-sm">
                {pending.map((invitation) => (
                  <li key={invitation.id} className="flex justify-between gap-2">
                    <span className="truncate">{invitation.invitedUser.fullName}</span>
                    <span className="text-xs text-muted-foreground">aguardando</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {message && (
        <p
          role={message.kind === "error" ? "alert" : "status"}
          className={`text-sm lg:col-span-2 ${message.kind === "error" ? "text-destructive" : "text-neon"}`}
        >
          {message.text}
        </p>
      )}

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Você deixa de ver as tarefas deste projeto. Para voltar, o dono precisa convidar você
              de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void leave();
              }}
            >
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PersonRow({
  name,
  username,
  label,
  highlight = false,
  action,
}: {
  name: string;
  username: string;
  label: string;
  highlight?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
        {name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">@{username}</p>
      </div>
      <Badge variant="outline" className={highlight ? "border-primary/50 text-primary" : ""}>
        {label}
      </Badge>
      {action}
    </li>
  );
}

function SettingsTab({
  project,
  onProjectChange,
}: {
  project: Project;
  onProjectChange: (project: Project) => void;
}) {
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState<"close" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closed = project.status === "CLOSED";

  const setStatus = async (status: Project["status"]) => {
    setBusy(true);
    setError(null);
    try {
      onProjectChange(await api.updateProjectStatus(project.id, status));
      setConfirmation(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o projeto.");
    } finally {
      setBusy(false);
    }
  };

  const saveSetting = async (payload: {
    contractorsSeeAllTasks?: boolean;
    ndaEnabled?: boolean;
    autoWip?: boolean;
    ndaReleaseDate?: string;
  }) => {
    setBusy(true);
    setError(null);
    try {
      onProjectChange(await api.updateProjectSettings(project.id, payload));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a configuração.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteProject(project.id);
      navigate({ to: "/projetos" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar o projeto.");
      setBusy(false);
    }
  };

  return (
    <div className="glass max-w-2xl space-y-4 rounded-2xl p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {closed ? "Projeto encerrado" : "Encerrar projeto"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {closed
            ? "O projeto está somente leitura. Retome para voltar a mexer nas tarefas, ou apague de vez."
            : "Encerrar deixa o projeto somente leitura para todos. Dá para retomar depois."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {closed ? (
          <>
            <Button variant="outline" disabled={busy} onClick={() => void setStatus("ACTIVE")}>
              {busy ? "Aguarde..." : "Retomar projeto"}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => setConfirmation("delete")}>
              Apagar projeto
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled={busy} onClick={() => setConfirmation("close")}>
            Encerrar projeto
          </Button>
        )}
      </div>
      <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
        <div>
          <Label htmlFor="autoWip" className="text-sm font-semibold">
            WIP automático (projeto público)
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Ligado: o projeto aparece no portfólio de quem participa, qualquer pessoa vê a visão
            pública (as tarefas como título, descrição e imagens) e cada imagem enviada numa tarefa
            vira um WIP no feed Publicações. Desligado: só os participantes veem o projeto.
          </p>
          {project.autoWip && project.ndaActive && (
            <p className="mt-2 text-sm text-amber-300">
              O NDA ainda está ativo: nada aparece em público até a data de liberação.
            </p>
          )}
        </div>
        <Switch
          id="autoWip"
          checked={project.autoWip}
          disabled={busy}
          onCheckedChange={(checked) => void saveSetting({ autoWip: checked })}
        />
      </div>
      {project.type === "CORPORATE" && (
        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor="contractorsSeeAll" className="text-sm font-semibold">
              Contratados veem todas as tarefas
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Desligado: cada contratado vê só as tarefas atribuídas a ele. Ligado: todos veem o
              quadro inteiro, mas cada um só mexe nas suas.
            </p>
          </div>
          <Switch
            id="contractorsSeeAll"
            checked={project.contractorsSeeAllTasks}
            disabled={busy}
            onCheckedChange={(checked) => void saveSetting({ contractorsSeeAllTasks: checked })}
          />
        </div>
      )}
      {project.type === "CORPORATE" && (
        <div className="flex items-start justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor="ndaEnabled" className="text-sm font-semibold">
              Projeto sob NDA
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Ligado: nada do projeto é publicado (nem WIP, nem post) até a data de liberação, e o
              projeto aparece mascarado no perfil dos contratados.
            </p>
          </div>
          <Switch
            id="ndaEnabled"
            checked={project.ndaEnabled}
            disabled={busy}
            onCheckedChange={(checked) => void saveSetting({ ndaEnabled: checked })}
          />
        </div>
      )}
      {project.type === "CORPORATE" && project.ndaEnabled && (
        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="ndaReleaseDate" className="text-sm font-semibold">
            Data de liberação do NDA
          </Label>
          <p className="text-sm text-muted-foreground">
            A partir desta data o NDA deixa de valer: o projeto pode ficar público (com o WIP
            automático) e as imagens podem ser publicadas. Sem data, o NDA vale até você mudar.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="ndaReleaseDate"
              type="date"
              className="w-auto"
              value={project.ndaReleaseDate ?? ""}
              disabled={busy}
              onChange={(e) => void saveSetting({ ndaReleaseDate: e.target.value })}
            />
            {project.ndaReleaseDate && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void saveSetting({ ndaReleaseDate: "" })}
              >
                Tirar a data
              </Button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && !busy && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === "delete" ? "Apagar projeto?" : "Encerrar projeto?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation === "delete"
                ? "Esta ação é permanente: apaga todas as tarefas, membros e convites deste projeto."
                : "O projeto passará a ser somente leitura para todos. Você poderá retomá-lo depois."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (confirmation === "delete") void remove();
                else void setStatus("CLOSED");
              }}
              className={
                confirmation === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {busy
                ? "Aguarde..."
                : confirmation === "delete"
                  ? "Apagar permanentemente"
                  : "Encerrar projeto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Quem pode ver o projeto agora: público, privado ou sob NDA. */
function VisibilityBadge({ project }: { project: Project }) {
  if (project.ndaActive) {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-300">
        <Lock className="mr-1 size-3" />
        {project.ndaReleaseDate
          ? `NDA até ${new Date(`${project.ndaReleaseDate}T00:00:00`).toLocaleDateString("pt-BR")}`
          : "NDA"}
      </Badge>
    );
  }
  if (project.publiclyVisible) {
    return (
      <Badge variant="outline" className="border-neon/50 text-neon">
        <Globe className="mr-1 size-3" /> Público · WIP automático
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock className="mr-1 size-3" /> Privado
    </Badge>
  );
}

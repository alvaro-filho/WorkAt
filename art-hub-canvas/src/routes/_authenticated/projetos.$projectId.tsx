import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, Mail, UserMinus } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { GanttView } from "@/components/kanban/GanttView";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
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
import { projectPermissions, projectTypeInfo, roleLabel } from "@/lib/project-labels";

export const Route = createFileRoute("/_authenticated/projetos/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — Art Hub" }] }),
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId: projectIdParam } = Route.useParams();
  const projectId = Number(projectIdParam);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);
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
  }) => {
    const task = await api.createTask(project.id, data);
    setTasks((items) => [...items, task]);
  };

  const moveTask = async (taskId: number, status: ApiTaskStatus) => {
    const updated = await api.updateTaskStatus(taskId, status);
    setTasks((items) => items.map((task) => (task.id === taskId ? updated : task)));
    setSelectedTask((task) => (task?.id === taskId ? updated : task));
    return updated;
  };

  const deleteTask = async (taskId: number) => {
    await api.deleteTask(taskId);
    setTasks((items) => items.filter((task) => task.id !== taskId));
    setSelectedTask((task) => (task?.id === taskId ? null : task));
  };

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
            canMoveTasks={permissions.canMoveTasks}
            readOnlyHint={
              project.type === "CORPORATE" && !permissions.owner
                ? "Neste projeto corporativo, as tarefas são criadas e organizadas pelo contratante."
                : undefined
            }
            onCreateTask={createTask}
            onMoveTask={moveTask}
            onOpenTask={setSelectedTask}
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

      <TaskDetailModal
        task={selectedTask}
        readOnly={!permissions.canManageTasks}
        onDeleteTask={deleteTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
      />
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
                ? "A pessoa precisa já ter conta no Art Hub e vai ver o convite na tela de Projetos."
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
      {project.type === "CORPORATE" && (
        <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
          Em breve: ativar NDA neste projeto, para que as artes só sejam publicadas quando você
          liberar.
        </p>
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

import { useEffect, useState } from "react";
import { CalendarClock, GripVertical, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  type ApiPriority,
  type ApiTask,
  type ApiTaskStatus,
  type Project,
} from "@/lib/api";

type TaskStatus = "todo" | "progress" | "review" | "done";
const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "A Fazer" },
  { id: "progress", label: "Em Progresso" },
  { id: "review", label: "Em Revisão" },
  { id: "done", label: "Concluído" },
];

const toUiStatus: Record<ApiTaskStatus, TaskStatus> = {
  TODO: "todo",
  IN_PROGRESS: "progress",
  REVIEW: "review",
  DONE: "done",
};
const toApiStatus: Record<TaskStatus, ApiTaskStatus> = {
  todo: "TODO",
  progress: "IN_PROGRESS",
  review: "REVIEW",
  done: "DONE",
};
const priorities: Record<ApiPriority, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" };

function formatDeadline(value: string | null) {
  if (!value) return "Sem prazo";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR");
}

export function KanbanBoard({
  projects,
  selectedProjectId,
  onSelectProject,
  tasks,
  loading,
  error,
  onCreateProject,
  onCreateTask,
  onMoveTask,
  onOpenTask,
}: {
  projects: Project[];
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  tasks: ApiTask[];
  loading: boolean;
  error: string | null;
  onCreateProject: (data: {
    name: string;
    description: string;
    category: Project["category"];
  }) => Promise<void>;
  onCreateTask: (data: {
    title: string;
    description: string;
    priority: ApiPriority;
    deadline?: string;
  }) => Promise<void>;
  onMoveTask: (taskId: number, status: ApiTaskStatus) => Promise<ApiTask>;
  onOpenTask: (task: ApiTask) => void;
}) {
  const [localTasks, setLocalTasks] = useState(tasks);
  const [dragging, setDragging] = useState<number | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [projectForm, setProjectForm] = useState(false);
  const [taskForm, setTaskForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectCategory, setProjectCategory] = useState<Project["category"]>("PESSOAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<ApiPriority>("MEDIUM");
  const [deadline, setDeadline] = useState("");

  useEffect(() => setLocalTasks(tasks), [tasks]);

  const move = async (id: number, status: TaskStatus) => {
    const task = localTasks.find((item) => item.id === id);
    if (!task || toUiStatus[task.status] === status) return;
    const previous = localTasks;
    setLocalTasks((items) =>
      items.map((item) => (item.id === id ? { ...item, status: toApiStatus[status] } : item)),
    );
    setFormError(null);
    try {
      const updated = await onMoveTask(id, toApiStatus[status]);
      setLocalTasks((items) => items.map((item) => (item.id === id ? updated : item)));
    } catch (e) {
      setLocalTasks(previous);
      setFormError(e instanceof Error ? e.message : "Não foi possível mover a tarefa.");
    }
  };

  const submitProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await onCreateProject({
        name: projectName,
        description: projectDescription,
        category: projectCategory,
      });
      setProjectName("");
      setProjectDescription("");
      setProjectForm(false);
    } catch (e) {
      setFormError(
        e instanceof ApiError && e.status === 403
          ? "Seu perfil Empresa não pode criar projetos. Use uma conta de artista para esta ação."
          : e instanceof Error
            ? e.message
            : "Não foi possível criar o projeto.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      await onCreateTask({ title, description, priority, ...(deadline ? { deadline } : {}) });
      setTitle("");
      setDescription("");
      setDeadline("");
      setPriority("MEDIUM");
      setTaskForm(false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Não foi possível criar a tarefa.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="projectSelect">Projeto</Label>
          <select
            id="projectSelect"
            value={selectedProjectId ?? ""}
            onChange={(e) => onSelectProject(Number(e.target.value))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={!projects.length}
          >
            {!projects.length && <option value="">Nenhum projeto</option>}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setProjectForm((v) => !v);
            setTaskForm(false);
            setFormError(null);
          }}
        >
          <Plus className="size-4" /> Novo projeto
        </Button>
        <Button
          type="button"
          className="gradient-primary text-primary-foreground"
          disabled={!selectedProjectId}
          onClick={() => {
            setTaskForm((v) => !v);
            setProjectForm(false);
            setFormError(null);
          }}
        >
          <Plus className="size-4" /> Nova tarefa
        </Button>
        {projectForm && (
          <form
            onSubmit={submitProject}
            className="grid w-full gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label htmlFor="newProjectName">Nome do projeto</Label>
              <Input
                id="newProjectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newProjectCategory">Categoria</Label>
              <select
                id="newProjectCategory"
                value={projectCategory}
                onChange={(e) => setProjectCategory(e.target.value as Project["category"])}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="PESSOAL">Pessoal</option>
                <option value="EMPRESA">Empresa</option>
                <option value="ESTUDIO">Estúdio</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="newProjectDescription">Descrição</Label>
              <Textarea
                id="newProjectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Criando..." : "Criar projeto"}
            </Button>
          </form>
        )}
        {taskForm && (
          <form
            onSubmit={submitTask}
            className="grid w-full gap-3 border-t border-border pt-4 sm:grid-cols-2"
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="newTaskTitle">Título</Label>
              <Input
                id="newTaskTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="newTaskDescription">Descrição</Label>
              <Textarea
                id="newTaskDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTaskPriority">Prioridade</Label>
              <select
                id="newTaskPriority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as ApiPriority)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTaskDeadline">Prazo</Label>
              <Input
                id="newTaskDeadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Criando..." : "Criar tarefa"}
            </Button>
          </form>
        )}
        {formError && (
          <p role="alert" className="w-full text-sm text-destructive">
            {formError}
          </p>
        )}
      </div>

      {!projects.length && !loading && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto ainda. Crie um projeto para começar.
        </div>
      )}
      {error && (
        <div role="alert" className="glass rounded-2xl p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {loading && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando tarefas...
        </div>
      )}
      {!loading && selectedProjectId && !localTasks.length && !error && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Este projeto ainda não tem tarefas.
        </div>
      )}

      {selectedProjectId && !loading && (
        <div className="grid gap-4 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = localTasks.filter((task) => toUiStatus[task.status] === col.id);
            return (
              <section
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverColumn(col.id);
                }}
                onDragLeave={() => setOverColumn((c) => (c === col.id ? null : c))}
                onDrop={() => {
                  if (dragging !== null) void move(dragging, col.id);
                  setDragging(null);
                  setOverColumn(null);
                }}
                className={`glass rounded-2xl p-3 transition-colors ${overColumn === col.id ? "border-primary/60" : ""}`}
              >
                <header className="mb-3 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{col.label}</h2>
                  <Badge variant="secondary" className="bg-white/10">
                    {items.length}
                  </Badge>
                </header>
                <div className="flex min-h-40 flex-col gap-3">
                  {items.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      onClick={() => onOpenTask(task)}
                      className={`glass glass-hover cursor-pointer rounded-xl p-3 ${dragging === task.id ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <p className="min-w-0 text-sm font-medium">{task.title}</p>
                      </div>
                      {task.description && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={
                            task.priority === "HIGH"
                              ? "border-destructive/50 text-destructive"
                              : task.priority === "MEDIUM"
                                ? "border-primary/50 text-primary"
                                : "border-neon/50 text-neon"
                          }
                        >
                          {priorities[task.priority]}
                        </Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarClock className="size-3" />
                          {formatDeadline(task.deadline)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

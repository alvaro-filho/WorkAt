import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { InfiniteCanvas, type CanvasItem } from "@/components/canvas/InfiniteCanvas";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { logActivity } from "@/lib/activity-api";
import { api, type ApiTask, type Project } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { canWorkOnTask } from "@/lib/project-labels";

// Cada tarefa tem o seu Canvas (aberto pelo botão na tela da tarefa), salvo no servidor.
// O Canvas global do projeto e a sincronização em tempo real ficam como trabalho futuro.
export const Route = createFileRoute("/_authenticated/canvas")({
  validateSearch: (search: Record<string, unknown>): { task?: number } => {
    const raw = search["task"];
    const task = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(task) && task > 0 ? { task } : {};
  },
  head: () => ({
    meta: [
      { title: "Canvas Infinito — WorkAt" },
      {
        name: "description",
        content: "Painel infinito de referências de cada tarefa, estilo PureRef.",
      },
    ],
  }),
  component: CanvasPage,
});

type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

function parseItems(content: string): CanvasItem[] {
  try {
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as CanvasItem[]) : [];
  } catch {
    return [];
  }
}

function CanvasPage() {
  const { task: taskId } = Route.useSearch();
  const { user } = useAuth();
  const [task, setTask] = useState<ApiTask | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<CanvasItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loggedActivity = useRef(false);

  useEffect(() => {
    if (taskId === undefined) return;
    let active = true;
    (async () => {
      try {
        const loadedTask = await api.task(taskId);
        const [loadedProject, canvas] = await Promise.all([
          api.project(loadedTask.projectId),
          api.taskCanvas(taskId),
        ]);
        if (!active) return;
        setTask(loadedTask);
        setProject(loadedProject);
        setItems(parseItems(canvas.content));
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Tarefa não encontrada.");
      }
    })();
    return () => {
      active = false;
    };
  }, [taskId]);

  const save = useCallback(
    async (next: CanvasItem[]) => {
      if (taskId === undefined) return;
      setSaveState("saving");
      try {
        await api.saveTaskCanvas(taskId, JSON.stringify(next));
        setSaveState("saved");
        setSaveError(null);
        if (!loggedActivity.current && project) {
          logActivity("CANVAS_EDIT", project.id);
          loggedActivity.current = true;
        }
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : "Não foi possível salvar o Canvas.");
      }
    },
    [taskId, project],
  );

  // Salva um instante depois da última mudança (evita uma requisição por pixel arrastado).
  const handleChange = (next: CanvasItem[]) => {
    setItems(next);
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), 800);
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (taskId === undefined) {
    return (
      <AppLayout layout="wide" title="Canvas Infinito" subtitle="Referências por tarefa">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-medium">O Canvas fica dentro de cada tarefa.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Abra um projeto, entre em uma tarefa e use o botão “Abrir Canvas infinito”.
          </p>
          <Link to="/projetos" className="mt-4 inline-block text-sm text-primary hover:underline">
            Ir para Projetos
          </Link>
        </div>
      </AppLayout>
    );
  }

  const canEdit = Boolean(task && project && canWorkOnTask(project, task, user?.id));
  const statusText =
    saveState === "pending" || saveState === "saving"
      ? "Salvando..."
      : saveState === "saved"
        ? "Salvo"
        : saveState === "error"
          ? (saveError ?? "Erro ao salvar")
          : !canEdit && task
            ? "Somente leitura"
            : undefined;

  return (
    <AppLayout layout="wide" title="Canvas Infinito" subtitle={task ? task.title : "Carregando tarefa..."}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {task && (
          <Link
            to="/projetos/$projectId/tarefas/$taskId"
            params={{ projectId: String(task.projectId), taskId: String(task.id) }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Voltar para a tarefa
          </Link>
        )}
        {task?.deadline && (
          <Badge variant="outline" className="border-neon/50 text-neon">
            Prazo {new Date(`${task.deadline}T00:00:00`).toLocaleDateString("pt-BR")}
          </Badge>
        )}
      </div>
      {error ? (
        <div role="alert" className="glass rounded-2xl p-4 text-sm text-destructive">
          {error}
        </div>
      ) : items === null || !task ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando Canvas...
        </div>
      ) : (
        <InfiniteCanvas
          contextLabel={`Canvas da tarefa: ${task.title}`}
          items={items}
          canEdit={canEdit}
          onChange={handleChange}
          statusText={statusText}
        />
      )}
    </AppLayout>
  );
}

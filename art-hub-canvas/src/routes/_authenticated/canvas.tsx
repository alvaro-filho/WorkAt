import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { InfiniteCanvas } from "@/components/canvas/InfiniteCanvas";
import { Badge } from "@/components/ui/badge";
import { api, type ApiTask } from "@/lib/api";

// Cada tarefa tem o seu Canvas (aberto pelo botão na tela da tarefa).
// O Canvas global do projeto e a sincronização em tempo real ficam como trabalho futuro.
export const Route = createFileRoute("/_authenticated/canvas")({
  validateSearch: (search: Record<string, unknown>): { task?: number } => {
    const raw = search["task"];
    const task = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(task) && task > 0 ? { task } : {};
  },
  head: () => ({
    meta: [
      { title: "Canvas Infinito — Art Hub" },
      {
        name: "description",
        content: "Painel infinito de referências de cada tarefa, estilo PureRef.",
      },
    ],
  }),
  component: CanvasPage,
});

function CanvasPage() {
  const { task: taskParam } = Route.useSearch();
  const taskId = taskParam ?? null;
  const [task, setTask] = useState<ApiTask | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskId === null) return;
    let active = true;
    api
      .task(taskId)
      .then((loaded) => active && setTask(loaded))
      .catch(
        (e: unknown) =>
          active && setError(e instanceof Error ? e.message : "Tarefa não encontrada."),
      );
    return () => {
      active = false;
    };
  }, [taskId]);

  if (taskId === null) {
    return (
      <AppLayout title="Canvas Infinito" subtitle="Referências por tarefa">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-medium">O Canvas agora fica dentro de cada tarefa.</p>
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

  return (
    <AppLayout title="Canvas Infinito" subtitle={task ? task.title : "Carregando tarefa..."}>
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
      ) : (
        <InfiniteCanvas
          contextLabel={task ? `Canvas da tarefa: ${task.title}` : "Canvas da tarefa"}
        />
      )}
    </AppLayout>
  );
}

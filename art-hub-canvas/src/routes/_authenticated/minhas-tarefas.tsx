import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, FolderKanban } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { api, type ApiTask, type ApiTaskStatus } from "@/lib/api";
import { formatDay, todayString } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/minhas-tarefas")({
  head: () => ({ meta: [{ title: "Minhas tarefas — WorkAt" }] }),
  component: MyTasksPage,
});

const STATUS_LABEL: Record<ApiTaskStatus, string> = {
  TODO: "A Fazer",
  IN_PROGRESS: "Em Progresso",
  REVIEW: "Em Revisão",
  DONE: "Concluído",
};
const PRIORITY_LABEL = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;

type Group = { id: string; title: string; hint?: string; tasks: ApiTask[] };

/** Tudo o que está atribuído a mim e ainda está aberto, separado pela urgência do prazo. */
function MyTasksPage() {
  const [tasks, setTasks] = useState<ApiTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .myTasks()
      .then(setTasks)
      .catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar."));
  }, []);

  const groups = useMemo<Group[]>(() => {
    const today = todayString();
    const tomorrow = todayString(1);
    const week = todayString(7);
    const list = tasks ?? [];
    return [
      {
        id: "late",
        title: "Atrasadas",
        hint: "O prazo já passou",
        tasks: list.filter((t) => t.deadline && t.deadline < today),
      },
      {
        id: "soon",
        title: "Hoje e amanhã",
        tasks: list.filter((t) => t.deadline && t.deadline >= today && t.deadline <= tomorrow),
      },
      {
        id: "week",
        title: "Próximos 7 dias",
        tasks: list.filter((t) => t.deadline && t.deadline > tomorrow && t.deadline <= week),
      },
      { id: "later", title: "Mais para frente", tasks: list.filter((t) => t.deadline && t.deadline > week) },
      { id: "none", title: "Sem prazo", tasks: list.filter((t) => !t.deadline) },
    ].filter((group) => group.tasks.length > 0);
  }, [tasks]);

  return (
    <AppLayout title="Minhas tarefas" subtitle="O que está com você, em todos os projetos">
      <div className="mx-auto max-w-3xl space-y-6">
        {error && (
          <div role="alert" className="glass rounded-2xl p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        {tasks === null && !error && (
          <div className="glass h-40 animate-pulse rounded-2xl" aria-label="Carregando tarefas" />
        )}
        {tasks && tasks.length === 0 && (
          <div className="glass rounded-2xl p-8 text-center">
            <p className="font-medium">Nenhuma tarefa aberta com você.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando alguém atribuir uma tarefa a você, ela aparece aqui e em Notificações.
            </p>
            <Link to="/projetos" className="mt-4 inline-block text-sm text-primary hover:underline">
              Ver meus projetos
            </Link>
          </div>
        )}
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <h2
              id={`group-${group.id}`}
              className={`mb-2 flex items-center gap-2 text-sm font-semibold ${group.id === "late" ? "text-destructive" : ""}`}
            >
              {group.id === "late" && <AlertTriangle className="size-4" />}
              {group.title}
              <span className="font-normal text-muted-foreground">· {group.tasks.length}</span>
            </h2>
            <ul className="glass divide-y divide-border overflow-hidden rounded-2xl">
              {group.tasks.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/projetos/$projectId/tarefas/$taskId"
                    params={{ projectId: String(task.projectId), taskId: String(task.id) }}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-white/[0.03]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{task.title}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderKanban className="size-3" /> {task.projectName ?? "Projeto"}
                      </span>
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {STATUS_LABEL[task.status]}
                    </Badge>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                    <span
                      className={`flex shrink-0 items-center gap-1 text-xs ${group.id === "late" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      <CalendarClock className="size-3" /> {formatDay(task.deadline)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppLayout>
  );
}

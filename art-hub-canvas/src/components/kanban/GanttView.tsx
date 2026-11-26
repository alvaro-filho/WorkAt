import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ApiTask, ApiTaskStatus } from "@/lib/api";
import { isOverdue } from "@/lib/dates";

const STATUS_LABEL: Record<ApiTaskStatus, string> = {
  TODO: "A Fazer",
  IN_PROGRESS: "Em Progresso",
  REVIEW: "Em Revisão",
  DONE: "Concluído",
};

const WEEKS = 6;

/** Cronograma: 6 semanas por vez, com navegação; tarefas sem prazo ficam numa lista à parte. */
export function GanttView({ tasks }: { tasks: ApiTask[] }) {
  const [offset, setOffset] = useState(0);

  const start = new Date();
  start.setDate(start.getDate() - start.getDay() + offset * 7);
  // Meia-noite: um prazo no primeiro dia da semana também precisa aparecer.
  start.setHours(0, 0, 0, 0);
  const weeks = Array.from({ length: WEEKS }, (_, index) => {
    const week = new Date(start);
    week.setDate(start.getDate() + index * 7);
    return week;
  });
  const end = new Date(start);
  end.setDate(start.getDate() + WEEKS * 7);

  const dated = tasks
    .filter((task) => task.deadline)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const undated = tasks.filter((task) => !task.deadline);
  const parse = (value: string) => new Date(`${value}T00:00:00`);
  const before = dated.filter((task) => parse(task.deadline!) < start).length;
  const after = dated.filter((task) => parse(task.deadline!) >= end).length;
  const range = `${weeks[0]!.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${new Date(end.getTime() - 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-4">
      <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-3">
        <Button variant="outline" size="sm" aria-label="Semanas anteriores" onClick={() => setOffset((o) => o - WEEKS)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(0)}>
          Hoje
        </Button>
        <Button variant="outline" size="sm" aria-label="Próximas semanas" onClick={() => setOffset((o) => o + WEEKS)}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="text-sm font-medium">{range}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {before > 0 && `${before} antes · `}
          {after > 0 && `${after} depois · `}
          {undated.length} sem prazo
        </span>
      </div>

      <div className="glass overflow-x-auto rounded-2xl p-5">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[220px_repeat(6,1fr)] gap-2 border-b border-border pb-2 text-xs text-muted-foreground">
            <span>Tarefa</span>
            {weeks.map((week) => (
              <span key={week.toISOString()} className="text-center">
                {week.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
              </span>
            ))}
          </div>
          {dated.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma tarefa com prazo. Defina prazos nas tarefas para vê-las aqui.
            </p>
          )}
          {dated.map((task) => {
            const deadline = parse(task.deadline!);
            const position = weeks.findIndex(
              (week, i) => deadline >= week && deadline < (weeks[i + 1] ?? end),
            );
            const late = isOverdue(task.deadline, task.status);
            return (
              <div
                key={task.id}
                className="grid grid-cols-[220px_repeat(6,1fr)] items-center gap-2 border-b border-border/60 py-3"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className={`truncate text-xs ${late ? "text-destructive" : "text-muted-foreground"}`}>
                    {deadline.toLocaleDateString("pt-BR")}
                    {late && " · atrasada"}
                  </p>
                </div>
                {position === -1 ? (
                  <p className="col-span-6 text-xs text-muted-foreground">
                    {deadline < start ? "← prazo antes deste período" : "prazo depois deste período →"}
                  </p>
                ) : (
                  weeks.map((week, index) => (
                    <div key={week.toISOString()} className="h-8">
                      {position === index && (
                        <div
                          className={`flex h-8 items-center rounded-lg px-2 text-[11px] font-medium ${
                            late
                              ? "bg-destructive/70 text-destructive-foreground"
                              : task.status === "DONE"
                                ? "bg-white/15 text-foreground"
                                : "bg-primary/70 text-primary-foreground"
                          }`}
                        >
                          {STATUS_LABEL[task.status] ?? task.status}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {undated.length > 0 && (
        <section className="glass rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold">Sem prazo ({undated.length})</h3>
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {undated.map((task) => (
              <li key={task.id} className="flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/5">
                <span className="truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABEL[task.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

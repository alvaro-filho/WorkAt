import type { ApiTask } from "@/lib/api";

export function GanttView({ tasks }: { tasks: ApiTask[] }) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const weeks = Array.from({ length: 6 }, (_, index) => {
    const week = new Date(startOfWeek);
    week.setDate(startOfWeek.getDate() + index * 7);
    return week;
  });

  return (
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
        {!tasks.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa para exibir.
          </p>
        )}
        {tasks.map((task) => {
          const deadline = task.deadline ? new Date(`${task.deadline}T00:00:00`) : null;
          const position = deadline
            ? weeks.findIndex(
                (week, i) =>
                  deadline >= week &&
                  deadline < (weeks[i + 1] ?? new Date(week.getTime() + 7 * 86400000)),
              )
            : -1;
          return (
            <div
              key={task.id}
              className="grid grid-cols-[220px_repeat(6,1fr)] items-center gap-2 border-b border-border/60 py-3"
            >
              <div className="min-w-0 pr-2">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {deadline ? deadline.toLocaleDateString("pt-BR") : "Sem prazo"}
                </p>
              </div>
              {weeks.map((week, index) => (
                <div key={week.toISOString()} className="h-8">
                  {position === index && (
                    <div className="flex h-8 items-center rounded-lg bg-primary/70 px-2 text-[11px] font-medium text-primary-foreground">
                      {task.status.replace("_", " ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

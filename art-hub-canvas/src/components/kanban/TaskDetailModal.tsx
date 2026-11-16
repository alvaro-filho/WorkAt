import { CalendarClock, Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiTask } from "@/lib/api";

const priorityLabel = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;
const statusLabel = {
  TODO: "A Fazer",
  IN_PROGRESS: "Em Progresso",
  REVIEW: "Em Revisão",
  DONE: "Concluído",
} as const;

export function TaskDetailModal({
  task,
  onOpenChange,
}: {
  task: ApiTask | null;
  onOpenChange: (v: boolean) => void;
}) {
  const deadline = task?.deadline
    ? new Date(`${task.deadline}T00:00:00`).toLocaleDateString("pt-BR")
    : "Sem prazo";

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="glass sm:max-w-xl">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle>{task.title}</DialogTitle>
              <DialogDescription>{task.description || "Sem descrição."}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info icon={CalendarClock} label="Prazo" value={deadline} />
              <Info icon={Flag} label="Prioridade" value={priorityLabel[task.priority]} />
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-medium">{statusLabel[task.status]}</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Projeto</p>
                <p className="mt-1 text-sm font-medium">#{task.projectId}</p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit">
              Tarefa sincronizada com o servidor
            </Badge>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Flag; label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

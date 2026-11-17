import { useState } from "react";
import { CalendarClock, Flag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  readOnly = false,
  onDeleteTask,
}: {
  task: ApiTask | null;
  onOpenChange: (v: boolean) => void;
  readOnly?: boolean;
  onDeleteTask: (taskId: number) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
            <div className="space-y-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleting || readOnly}>
                    Apagar tarefa
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Apagar tarefa?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação apagará permanentemente esta tarefa.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleting}
                      onClick={(event) => {
                        event.preventDefault();
                        if (!task) return;
                        setDeleting(true);
                        setDeleteError(null);
                        void onDeleteTask(task.id)
                          .then(() => onOpenChange(false))
                          .catch((error: unknown) => {
                            setDeleteError(
                              error instanceof Error
                                ? error.message
                                : "Não foi possível apagar a tarefa.",
                            );
                          })
                          .finally(() => setDeleting(false));
                      }}
                    >
                      {deleting ? "Apagando..." : "Apagar tarefa"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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

import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  FileIcon,
  Frame,
  ImageIcon,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { CommentsSection, ReviewPanel } from "@/components/tasks/TaskWorkflow";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  ApiError,
  fetchFileBlob,
  uploadTaskFile,
  type ApiTask,
  type ApiTaskStatus,
  type Project,
  type ProjectMember,
  type TaskFile,
} from "@/lib/api";
import { logActivity, logStatusActivity } from "@/lib/activity-api";
import { useAuth } from "@/lib/AuthContext";
import { isOverdue } from "@/lib/dates";
import { canWorkOnTask, projectPermissions } from "@/lib/project-labels";

export const Route = createFileRoute("/_authenticated/projetos/$projectId_/tarefas/$taskId")({
  head: () => ({ meta: [{ title: "Tarefa — WorkAt" }] }),
  component: TaskPage,
});

const STATUS_OPTIONS: { value: ApiTaskStatus; label: string }[] = [
  { value: "TODO", label: "A Fazer" },
  { value: "IN_PROGRESS", label: "Em Progresso" },
  { value: "REVIEW", label: "Em Revisão" },
  { value: "DONE", label: "Concluído" },
];
const PRIORITY_LABEL = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta" } as const;
const ACCEPTED_EXTENSIONS =
  ".png,.jpg,.jpeg,.webp,.gif,.tif,.tiff,.psd,.kra,.clip,.ai,.blend,.fbx,.obj,.zip,.pdf";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Sem prazo";
  const date = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return withTime
    ? date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : date.toLocaleDateString("pt-BR");
}

function TaskPage() {
  const { projectId: projectIdParam, taskId: taskIdParam } = Route.useParams();
  const projectId = Number(projectIdParam);
  const taskId = Number(taskIdParam);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [task, setTask] = useState<ApiTask | null>(null);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentsKey, setCommentsKey] = useState(0);

  const loadFiles = useCallback(async () => {
    setFiles(await api.taskFiles(taskId));
  }, [taskId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedProject, loadedTask, loadedFiles] = await Promise.all([
          api.project(projectId),
          api.task(taskId),
          api.taskFiles(taskId),
        ]);
        if (!active) return;
        if (loadedTask.projectId !== loadedProject.id) {
          setNotFound(true);
          return;
        }
        setProject(loadedProject);
        setTask(loadedTask);
        setFiles(loadedFiles);
        if (loadedProject.type !== "PERSONAL") {
          api
            .members(projectId)
            .then((list) => active && setMembers(list))
            .catch(() => undefined);
        }
      } catch (e) {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Não foi possível carregar a tarefa.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, taskId]);

  if (loading) {
    return (
      <AppLayout title="Tarefa">
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Carregando tarefa...
        </div>
      </AppLayout>
    );
  }

  if (notFound || !project || !task) {
    return (
      <AppLayout title="Tarefa">
        <div className="glass rounded-2xl p-8 text-center">
          <p className="font-medium">{error ?? "Tarefa não encontrada."}</p>
          {!error && (
            <p className="mt-1 text-sm text-muted-foreground">
              Ela pode ter sido apagada, ou não está atribuída a você.
            </p>
          )}
          <Button asChild variant="outline" className="mt-4">
            <Link to="/projetos/$projectId" params={{ projectId: String(projectId) }}>
              Voltar para o projeto
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  const permissions = projectPermissions(project);
  const canWork = canWorkOnTask(project, task, user?.id);
  const finalImage = files.find((file) => file.finalImage) ?? null;
  const isCorporate = project.type === "CORPORATE";
  // No corporativo, quem conclui é o dono (ao aprovar) e só ele reabre uma tarefa aprovada.
  const contractorOnly = isCorporate && !permissions.owner;
  const closed = project.status === "CLOSED";
  const assigneeOptions = [
    ...(project.owner ? [{ id: project.owner.id, fullName: project.owner.fullName }] : []),
    ...members.map((member) => ({ id: member.user.id, fullName: member.user.fullName })),
  ];

  const changeStatus = async (status: ApiTaskStatus) => {
    setError(null);
    try {
      setTask(await api.updateTaskStatus(task.id, status));
      logStatusActivity(status, project.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível mudar o status.");
    }
  };

  const changeAssignee = async (value: string) => {
    setError(null);
    try {
      setTask(await api.assignTask(task.id, value ? Number(value) : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível mudar o responsável.");
    }
  };

  const deleteTask = async () => {
    try {
      await api.deleteTask(task.id);
      navigate({ to: "/projetos/$projectId", params: { projectId: String(project.id) } });
    } catch (e) {
      setConfirmDelete(false);
      setError(e instanceof Error ? e.message : "Não foi possível apagar a tarefa.");
    }
  };

  return (
    <AppLayout title={task.title} subtitle={project.name}>
      <Link
        to="/projetos/$projectId"
        params={{ projectId: String(project.id) }}
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> {project.name}
      </Link>

      {error && (
        <div role="alert" className="glass mb-4 rounded-2xl p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0 space-y-4">
          <section className="glass rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-xl font-semibold">{task.title}</h2>
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
                Prioridade {PRIORITY_LABEL[task.priority].toLowerCase()}
              </Badge>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {task.description || "Sem descrição."}
            </p>
          </section>

          <ReviewPanel
            task={task}
            isOwner={permissions.owner}
            isCorporate={isCorporate}
            canWork={canWork}
            closed={closed}
            onTaskChange={setTask}
            onReviewed={() => setCommentsKey((k) => k + 1)}
          />

          {finalImage && <FinalImage file={finalImage} />}

          <DeliveriesSection
            taskId={task.id}
            files={files}
            canUpload={canWork}
            canDelete={(file) =>
              project.status === "ACTIVE" &&
              (permissions.owner || String(file.uploadedBy.id) === String(user?.id))
            }
            onChanged={loadFiles}
            onUploaded={() => logActivity("FILE_UPLOAD", project.id)}
            onError={setError}
          />

          <CommentsSection
            taskId={task.id}
            files={files}
            currentUserId={user?.id}
            isOwner={permissions.owner}
            closed={closed}
            reloadKey={commentsKey}
          />
        </div>

        <aside className="space-y-4">
          <section className="glass space-y-3 rounded-2xl p-4">
            <h3 className="text-sm font-semibold">Referências</h3>
            <p className="text-xs text-muted-foreground">
              Monte o painel de referências desta tarefa no Canvas infinito, estilo PureRef.
            </p>
            <Button asChild className="gradient-primary w-full text-primary-foreground">
              <Link to="/canvas" search={{ task: task.id }}>
                <Frame className="size-4" /> Abrir Canvas infinito
              </Link>
            </Button>
          </section>

          <PublishCard
            project={project}
            task={task}
            imageFiles={files.filter((file) => file.image)}
            finalImage={finalImage}
            canPublish={canWork}
            canManage={permissions.canManageTasks}
            onTaskChange={setTask}
          />

          <section className="glass space-y-4 rounded-2xl p-4">
            <div className="space-y-2">
              <Label htmlFor="taskStatus">Status</Label>
              <select
                id="taskStatus"
                value={task.status}
                disabled={!canWork || (contractorOnly && task.status === "DONE")}
                onChange={(e) => void changeStatus(e.target.value as ApiTaskStatus)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={contractorOnly && option.value === "DONE" && task.status !== "DONE"}
                  >
                    {option.label}
                    {contractorOnly && option.value === "DONE" && task.status !== "DONE" ? " (o dono aprova)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {project.type !== "PERSONAL" && (
              <div className="space-y-2">
                <Label htmlFor="taskAssignee">Responsável</Label>
                {permissions.canManageTasks ? (
                  <select
                    id="taskAssignee"
                    value={task.assignee?.id ?? ""}
                    onChange={(e) => void changeAssignee(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem responsável</option>
                    {assigneeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.fullName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p id="taskAssignee" className="text-sm">
                    {task.assignee?.fullName ?? "Sem responsável"}
                  </p>
                )}
              </div>
            )}

            <div
              className={`flex items-center gap-2 text-sm ${isOverdue(task.deadline, task.status) ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              <CalendarClock className="size-4" /> Prazo: {formatDate(task.deadline)}
              {isOverdue(task.deadline, task.status) && " · atrasada"}
            </div>
          </section>

          {permissions.canManageTasks && (
            <Button
              variant="outline"
              className="w-full text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" /> Apagar tarefa
            </Button>
          )}
        </aside>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa e todos os arquivos enviados nela serão apagados. Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void deleteTask();
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

/** Imagem buscada com o token e mostrada por URL temporária do navegador. */
function useFileObjectUrl(fileId: number | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (fileId === null) return;
    let objectUrl: string | null = null;
    let active = true;
    fetchFileBlob(fileId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => active && setUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);
  return url;
}

function FinalImage({ file }: { file: TaskFile }) {
  const url = useFileObjectUrl(file.id);
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold">
        <Star className="size-4 text-primary" /> Imagem final
        <span className="text-xs font-normal text-muted-foreground">
          v{file.version} · {file.originalName}
        </span>
      </div>
      <div className="flex min-h-48 items-center justify-center p-4">
        {url ? (
          <img
            src={url}
            alt={`Imagem final: ${file.originalName}`}
            className="max-h-[480px] w-auto rounded-xl object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando imagem...</p>
        )}
      </div>
    </section>
  );
}

function DeliveriesSection({
  taskId,
  files,
  canUpload,
  canDelete,
  onChanged,
  onUploaded,
  onError,
}: {
  taskId: number;
  files: TaskFile[];
  canUpload: boolean;
  canDelete: (file: TaskFile) => boolean;
  onChanged: () => Promise<void>;
  onUploaded: () => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [markAsFinal, setMarkAsFinal] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  const send = async (file: File) => {
    onError(null);
    setUploadingName(file.name);
    setProgress(0);
    try {
      await uploadTaskFile(taskId, file, { markAsFinal, onProgress: setProgress });
      onUploaded();
      setMarkAsFinal(false);
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível enviar o arquivo.");
    } finally {
      setProgress(null);
      setUploadingName(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (file: TaskFile) => {
    onError(null);
    try {
      const blob = await fetchFileBlob(file.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.originalName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível baixar o arquivo.");
    }
  };

  const setFinal = async (file: TaskFile) => {
    onError(null);
    try {
      await api.markFinalFile(file.id);
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível marcar como final.");
    }
  };

  const remove = async (file: TaskFile) => {
    onError(null);
    try {
      await api.deleteFile(file.id);
      await onChanged();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível apagar o arquivo.");
    }
  };

  return (
    <section className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Entregas e arquivos de trabalho</h3>
        <span className="text-xs text-muted-foreground">{files.length} arquivo(s)</span>
      </div>

      {canUpload && (
        <div className="space-y-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => progress === null && inputRef.current?.click()}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && progress === null) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped && progress === null) void send(dropped);
            }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/10" : "border-border hover:bg-white/5"
            }`}
          >
            <UploadCloud className="size-6 text-primary" />
            <p className="text-sm font-medium">Arraste um arquivo ou clique para escolher</p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP, PSD, KRA, CLIP, AI, BLEND, FBX, OBJ, ZIP, PDF · até 500 MB
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="sr-only"
              aria-label="Escolher arquivo para enviar"
              onChange={(e) => {
                const chosen = e.target.files?.[0];
                if (chosen) void send(chosen);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="markAsFinal"
              checked={markAsFinal}
              onCheckedChange={(checked) => setMarkAsFinal(checked === true)}
            />
            <Label htmlFor="markAsFinal" className="text-xs font-normal text-muted-foreground">
              Este arquivo é a imagem final da tarefa (PNG, JPG, WEBP ou GIF)
            </Label>
          </div>
          {progress !== null && (
            <div role="status" className="space-y-1">
              <p className="truncate text-xs text-muted-foreground">
                Enviando {uploadingName}... {progress}%
              </p>
              <Progress value={progress} />
            </div>
          )}
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {canUpload ? "Nenhum arquivo enviado ainda." : "Nenhum arquivo enviado nesta tarefa."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-3 py-3">
              {file.image ? (
                <ImageIcon className="size-5 shrink-0 text-primary" />
              ) : (
                <FileIcon className="size-5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 truncate text-sm font-medium">
                  <span className="truncate">{file.originalName}</span>
                  <Badge variant="secondary" className="shrink-0 bg-white/10">
                    v{file.version}
                  </Badge>
                  {file.finalImage && (
                    <Badge variant="outline" className="shrink-0 border-primary/50 text-primary">
                      Final
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {formatSize(file.sizeBytes)} · {file.uploadedBy.fullName} ·{" "}
                  {formatDate(file.createdAt, true)}
                </p>
              </div>
              <div className="flex gap-1">
                {canUpload && file.image && !file.finalImage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void setFinal(file)}
                    aria-label={`Marcar ${file.originalName} como imagem final`}
                    title="Marcar como imagem final"
                  >
                    <Star className="size-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void download(file)}
                  aria-label={`Baixar ${file.originalName}`}
                  title="Baixar"
                >
                  <Download className="size-4" />
                </Button>
                {canDelete(file) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void remove(file)}
                    aria-label={`Apagar ${file.originalName}`}
                    title="Apagar"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Publicação a partir da tarefa: mostra se as imagens daqui viram WIP (projeto público), permite marcar a tarefa
 * como interna e publicar uma imagem como post avulso, mesmo com o projeto privado (menos sob NDA).
 */
function PublishCard({
  project,
  task,
  imageFiles,
  finalImage,
  canPublish,
  canManage,
  onTaskChange,
}: {
  project: Project;
  task: ApiTask;
  imageFiles: TaskFile[];
  finalImage: TaskFile | null;
  canPublish: boolean;
  canManage: boolean;
  onTaskChange: (task: ApiTask) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fileId, setFileId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const status = project.ndaActive
    ? "Projeto sob NDA: nada desta tarefa é publicado até a data de liberação."
    : task.hiddenFromPublic
      ? "Tarefa interna: fica fora da visão pública e não gera WIP."
      : project.autoWip
        ? "WIP automático ligado: cada imagem enviada aqui vira um WIP no feed Publicações."
        : "Projeto privado: as imagens ficam só aqui. Para mostrar uma peça, publique como post.";

  const openDialog = () => {
    setFileId((finalImage ?? imageFiles[0])?.id ?? null);
    setTitle(task.title);
    setSubtitle("");
    setError(null);
    setPublished(false);
    setOpen(true);
  };

  const toggleInternal = async (hidden: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onTaskChange(await api.setTaskHiddenFromPublic(task.id, hidden));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (fileId === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.publishFile(fileId, {
        title: title.trim(),
        ...(subtitle.trim() ? { subtitle: subtitle.trim() } : {}),
      });
      setPublished(true);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass space-y-3 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Publicação</h3>
        {project.ndaActive ? (
          <Badge variant="outline" className="border-amber-500/50 text-amber-300">
            NDA
          </Badge>
        ) : project.autoWip && !task.hiddenFromPublic ? (
          <Badge variant="outline" className="border-neon/50 text-neon">
            Pública
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Privada
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{status}</p>
      {canManage && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="taskInternal" className="text-xs">
            Tarefa interna (fora da visão pública)
          </Label>
          <Switch
            id="taskInternal"
            checked={task.hiddenFromPublic}
            disabled={busy}
            onCheckedChange={(checked) => void toggleInternal(checked)}
          />
        </div>
      )}
      {canPublish && !project.ndaActive && (
        <Button
          variant="outline"
          className="w-full"
          disabled={imageFiles.length === 0}
          onClick={openDialog}
        >
          Publicar como post
        </Button>
      )}
      {canPublish && !project.ndaActive && imageFiles.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Envie uma imagem nas entregas para publicar.
        </p>
      )}
      {published && (
        <p className="text-xs text-neon">Publicado! Aparece no feed e no seu portfólio.</p>
      )}
      {error && !open && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      <Dialog open={open} onOpenChange={(value) => !busy && setOpen(value)}>
        <DialogContent className="border-border bg-card">
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Publicar como post</DialogTitle>
              <DialogDescription>
                A imagem vai para o feed Publicações e para o seu portfólio, mesmo que o projeto
                continue privado. O resto do projeto não aparece.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="postFile">Imagem</Label>
              <select
                id="postFile"
                value={fileId ?? ""}
                onChange={(e) => setFileId(Number(e.target.value))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {imageFiles.map((file) => (
                  <option key={file.id} value={file.id}>
                    v{file.version} · {file.originalName}
                    {file.finalImage ? " (final)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postTitle">Título</Label>
              <Input
                id="postTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postSubtitle">Subtítulo</Label>
              <Textarea
                id="postSubtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={2000}
                placeholder="Opcional"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={busy || fileId === null}
                className="gradient-primary text-primary-foreground"
              >
                {busy ? "Publicando..." : "Publicar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

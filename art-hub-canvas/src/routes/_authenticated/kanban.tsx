import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { GanttView } from "@/components/kanban/GanttView";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { TaskDetailModal } from "@/components/kanban/TaskDetailModal";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type ApiPriority, type ApiTask, type ApiTaskStatus, type Project } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/kanban")({
  head: () => ({ meta: [{ title: "Kanban & Cronograma — Ateliê Studio" }] }),
  component: KanbanPage,
});

function makeSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

function KanbanPage() {
  const [view, setView] = useState("quadro");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [projectActionLoading, setProjectActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .projects()
      .then((items) => {
        if (!active) return;
        setProjects(items);
        setSelectedProjectId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Não foi possível carregar projetos.");
      })
      .finally(() => {
        if (active) setProjectsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadTasks = useCallback(async (projectId: number) => {
    setTasksLoading(true);
    setError(null);
    try {
      setTasks(await api.tasks(projectId));
    } catch (e) {
      setTasks([]);
      setError(e instanceof Error ? e.message : "Não foi possível carregar tarefas.");
    } finally {
      setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    setTasks([]);
    if (selectedProjectId !== null) void loadTasks(selectedProjectId);
  }, [selectedProjectId, loadTasks]);

  const createProject = async (data: {
    name: string;
    description: string;
    category: Project["category"];
  }) => {
    const project = await api.createProject({ ...data, slug: makeSlug(data.name) });
    setProjects((items) => [...items, project]);
    setSelectedProjectId(project.id);
  };

  const createTask = async (data: {
    title: string;
    description: string;
    priority: ApiPriority;
    deadline?: string;
  }) => {
    if (selectedProjectId === null) return;
    const task = await api.createTask(selectedProjectId, data);
    setTasks((items) => [...items, task]);
  };

  const moveTask = async (taskId: number, status: ApiTaskStatus) => {
    const updated = await api.updateTaskStatus(taskId, status);
    setTasks((items) => items.map((task) => (task.id === taskId ? updated : task)));
    setSelectedTask((task) => (task?.id === taskId ? updated : task));
    return updated;
  };

  const updateProjectStatus = async (status: Project["status"]) => {
    if (selectedProjectId === null) return;
    setProjectActionLoading(true);
    setError(null);
    try {
      const updated = await api.updateProjectStatus(selectedProjectId, status);
      setProjects((items) => items.map((project) => (project.id === updated.id ? updated : project)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível atualizar o projeto.");
      throw e;
    } finally {
      setProjectActionLoading(false);
    }
  };

  const deleteProject = async () => {
    if (selectedProjectId === null) return;
    setProjectActionLoading(true);
    setError(null);
    try {
      await api.deleteProject(selectedProjectId);
      const remaining = projects.filter((project) => project.id !== selectedProjectId);
      setProjects(remaining);
      setSelectedProjectId(remaining[0]?.id ?? null);
      setTasks([]);
      setSelectedTask(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível apagar o projeto.");
      throw e;
    } finally {
      setProjectActionLoading(false);
    }
  };

  const deleteTask = async (taskId: number) => {
    await api.deleteTask(taskId);
    setTasks((items) => items.filter((task) => task.id !== taskId));
    setSelectedTask((task) => (task?.id === taskId ? null : task));
  };

  const loading = projectsLoading || tasksLoading;

  return (
    <AppLayout title="Quadro & Cronograma" subtitle="Fluxo de tarefas dos seus projetos">
      <Tabs value={view} onValueChange={setView}>
        <TabsList className="bg-white/5">
          <TabsTrigger value="quadro">Visão Quadro (Kanban)</TabsTrigger>
          <TabsTrigger value="gantt">Visão Cronograma (Gantt)</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="fade-up mt-4">
        {view === "quadro" ? (
          <KanbanBoard
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(projectId) => {
              setSelectedProjectId(projectId);
              setSelectedTask(null);
            }}
            tasks={tasks}
            loading={loading}
            error={error}
            onCreateProject={createProject}
            onCreateTask={createTask}
            onMoveTask={moveTask}
            onOpenTask={setSelectedTask}
            onUpdateProjectStatus={updateProjectStatus}
            onDeleteProject={deleteProject}
            projectActionLoading={projectActionLoading}
          />
        ) : (
          <GanttView tasks={tasks} />
        )}
      </div>
      <TaskDetailModal
        task={selectedTask}
        readOnly={projects.find((project) => project.id === selectedProjectId)?.status === "CLOSED"}
        onDeleteTask={deleteTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
      />
    </AppLayout>
  );
}

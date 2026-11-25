export interface ApiUser {
  id: number | string;
  fullName: string;
  username: string;
  email: string;
  role: "ARTIST" | "COMPANY";
  userType?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: ApiUser;
}

export type ProjectType = "PERSONAL" | "COOPERATIVE" | "CORPORATE";
export type ProjectRole = "OWNER" | "MEMBER";

export interface UserSummary {
  id: number;
  fullName: string;
  username: string;
  role: ApiUser["role"];
}

export interface Project {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: ProjectType;
  status: "ACTIVE" | "CLOSED";
  /** Papel do usuário logado neste projeto. */
  myRole: ProjectRole;
  owner: UserSummary | null;
  /** Corporativo: contratados veem todas as tarefas (e não só as atribuídas a eles). */
  contractorsSeeAllTasks: boolean;
}

export interface TaskFile {
  id: number;
  taskId: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  version: number;
  finalImage: boolean;
  /** O navegador consegue mostrar como imagem (PNG, JPG, WEBP, GIF). */
  image: boolean;
  uploadedBy: UserSummary;
  createdAt: string;
}

export interface ProjectMember {
  user: UserSummary;
  role: ProjectRole;
  joinedAt: string;
}

export interface ProjectInvitation {
  id: number;
  projectId: number;
  projectName: string;
  projectType: ProjectType;
  invitedUser: UserSummary;
  invitedBy: UserSummary;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
}

export type NdaStatus = "LOCKED_BY_NDA" | "APPROVED_FOR_RELEASE";

export interface ShowcaseArt {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ndaStatus: NdaStatus;
  reviewNote: string | null;
  releaseDate: string | null;
  artistName: string;
  companyName: string;
  projectId: number | null;
  createdAt: string;
}

export interface PublicShowcaseArt {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  artistName: string;
  companyName: string;
  releaseDate: string | null;
}

export type ApiTaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type ApiPriority = "LOW" | "MEDIUM" | "HIGH";

export interface ApiTask {
  id: number;
  title: string;
  description: string | null;
  priority: ApiPriority;
  status: ApiTaskStatus;
  deadline: string | null;
  projectId: number;
  assignee: UserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let unauthorizedHandler: (() => void) | null = null;
let sessionVerification: Promise<void> | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function clearSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("authToken");
    window.localStorage.removeItem("userProfile");
  }
  unauthorizedHandler?.();
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: {
    authFailure?: "logout" | "verify-session" | "ignore";
    sendAuthorization?: boolean;
  } = {},
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("As chamadas à API só podem ser feitas no navegador.");
  }

  const headers = new Headers(init.headers);
  // FormData (upload) define o próprio Content-Type com o boundary; não pode ser sobrescrito.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");

  const token = window.localStorage.getItem("authToken");
  if (token && options.sendAuthorization !== false) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`/api/v1${path}`, { ...init, headers });
  const responseText = await response.text();
  let data: unknown;
  try {
    data = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    data = responseText;
  }

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data
        : data && typeof data === "object" && "message" in data && typeof data.message === "string"
          ? data.message
          : `A solicitação falhou (${response.status}).`;
    if (response.status === 401 || response.status === 403) {
      const method = (init.method ?? "GET").toUpperCase();
      const authEndpoint = path.startsWith("/auth/");
      const authFailure =
        options.authFailure ??
        (authEndpoint
          ? "ignore"
          : method === "GET" || method === "HEAD"
            ? "logout"
            : "verify-session");

      if (authFailure === "logout") clearSession();
      if (authFailure === "verify-session") await verifySession();
    }
    throw new ApiError(message || `A solicitação falhou (${response.status}).`, response.status);
  }

  return data as T;
}

function verifySession(): Promise<void> {
  if (sessionVerification) return sessionVerification;

  sessionVerification = (async () => {
    try {
      // This request must not enter the verification path again.
      await request<Project[]>("/projects", { method: "GET" }, { authFailure: "ignore" });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearSession();
      }
      // Network errors and other server errors do not prove that the session is invalid.
    }
  })().finally(() => {
    sessionVerification = null;
  });

  return sessionVerification;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      { authFailure: "ignore" },
    ),
  register: (payload: {
    username: string;
    fullName: string;
    email: string;
    password: string;
    role: ApiUser["role"];
  }) =>
    request<AuthResponse>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(payload) },
      { authFailure: "ignore" },
    ),
  projects: () => request<Project[]>("/projects"),
  // 403 aqui significa "sem permissão neste projeto", não sessão inválida: confere a sessão em vez de deslogar.
  project: (projectId: number) => request<Project>(`/projects/${projectId}`, {}, { authFailure: "verify-session" }),
  createProject: (payload: { name: string; slug: string; description?: string | undefined; type: ProjectType }) =>
    request<Project>(
      "/projects",
      { method: "POST", body: JSON.stringify(payload) },
      { authFailure: "verify-session" },
    ),
  tasks: (projectId: number) => request<ApiTask[]>(`/projects/${projectId}/tasks`),
  createTask: (
    projectId: number,
    payload: {
      title: string;
      description?: string;
      priority?: ApiPriority;
      deadline?: string;
      assigneeId?: number | undefined;
    },
  ) =>
    request<ApiTask>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTaskStatus: (taskId: number, status: ApiTaskStatus) =>
    request<ApiTask>(`/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteTask: (taskId: number) => request<void>(`/tasks/${taskId}`, { method: "DELETE" }),
  task: (taskId: number) => request<ApiTask>(`/tasks/${taskId}`, {}, { authFailure: "verify-session" }),
  assignTask: (taskId: number, userId: number | null) =>
    request<ApiTask>(`/tasks/${taskId}/assignee`, {
      method: "PATCH",
      body: JSON.stringify({ userId }),
    }),
  taskFiles: (taskId: number) =>
    request<TaskFile[]>(`/tasks/${taskId}/files`, {}, { authFailure: "verify-session" }),
  markFinalFile: (fileId: number) => request<TaskFile>(`/files/${fileId}/final`, { method: "POST" }),
  deleteFile: (fileId: number) => request<void>(`/files/${fileId}`, { method: "DELETE" }),
  updateProjectSettings: (projectId: number, payload: { contractorsSeeAllTasks: boolean }) =>
    request<Project>(`/projects/${projectId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateProjectStatus: (projectId: number, status: Project["status"]) =>
    request<Project>(`/projects/${projectId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteProject: (projectId: number) => request<void>(`/projects/${projectId}`, { method: "DELETE" }),
  members: (projectId: number) => request<ProjectMember[]>(`/projects/${projectId}/members`, {}, { authFailure: "verify-session" }),
  removeMember: (projectId: number, userId: number) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  leaveProject: (projectId: number) => request<void>(`/projects/${projectId}/leave`, { method: "POST" }),
  invite: (projectId: number, email: string) =>
    request<ProjectInvitation>(`/projects/${projectId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  projectInvitations: (projectId: number) =>
    request<ProjectInvitation[]>(`/projects/${projectId}/invitations`, {}, { authFailure: "verify-session" }),
  myInvitations: () => request<ProjectInvitation[]>("/invitations"),
  acceptInvitation: (invitationId: number) =>
    request<ProjectInvitation>(`/invitations/${invitationId}/accept`, { method: "POST" }),
  declineInvitation: (invitationId: number) =>
    request<ProjectInvitation>(`/invitations/${invitationId}/decline`, { method: "POST" }),
  createShowcaseArt: (payload: {
    title: string;
    description?: string;
    imageUrl?: string;
    companyEmail: string;
    projectId?: number;
  }) => request<ShowcaseArt>("/showcase", { method: "POST", body: JSON.stringify(payload) }),
  myShowcase: () => request<ShowcaseArt[]>("/showcase/mine"),
  showcaseInbox: () => request<ShowcaseArt[]>("/showcase/inbox"),
  updateShowcaseNdaStatus: (
    artId: number,
    payload: { status: NdaStatus; releaseDate?: string; note?: string },
  ) =>
    request<ShowcaseArt>(`/showcase/${artId}/nda-status`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  publicShowcase: () =>
    request<PublicShowcaseArt[]>(
      "/showcase/public",
      { method: "GET" },
      { authFailure: "ignore", sendAuthorization: false },
    ),
};

/**
 * Envia um arquivo para a tarefa com progresso (XHR, porque o fetch não informa o progresso do upload).
 */
export function uploadTaskFile(
  taskId: number,
  file: File,
  options: { markAsFinal?: boolean; onProgress?: (percent: number) => void } = {},
): Promise<TaskFile> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("final", String(Boolean(options.markAsFinal)));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/tasks/${taskId}/files`);
    const token = window.localStorage.getItem("authToken");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        data = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as TaskFile);
      else {
        const message =
          data && typeof data === "object" && "message" in data && typeof data.message === "string"
            ? data.message
            : `O envio falhou (${xhr.status}).`;
        reject(new ApiError(message, xhr.status));
      }
    };
    xhr.onerror = () => reject(new ApiError("Falha de rede ao enviar o arquivo.", 0));
    xhr.send(form);
  });
}

/** Baixa o conteúdo de um arquivo com o token (não existe link público para arquivo privado). */
export async function fetchFileBlob(fileId: number): Promise<Blob> {
  const token = window.localStorage.getItem("authToken");
  const response = await fetch(`/api/v1/files/${fileId}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError(`Não foi possível baixar o arquivo (${response.status}).`, response.status);
  return response.blob();
}

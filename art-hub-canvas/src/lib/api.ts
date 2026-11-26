export interface ApiUser {
  id: number | string;
  fullName: string;
  username: string;
  email: string;
  role: "ARTIST" | "COMPANY";
  userType?: string;
  avatarUrl?: string | null;
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
  /** Foto do perfil (null = mostrar a inicial do nome). */
  avatarUrl?: string | null;
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
  /** Corporativo: NDA ligado (nada é publicado até a data de liberação). */
  ndaEnabled: boolean;
  /** WIP automático: o projeto fica público e cada imagem enviada vira um WIP no feed. */
  autoWip: boolean;
  /** Corporativo com NDA: data a partir da qual o projeto pode aparecer em público (AAAA-MM-DD). */
  ndaReleaseDate: string | null;
  /** NDA ativo hoje (ligado e sem data de liberação alcançada). */
  ndaActive: boolean;
  /** O público vê o projeto agora (WIP automático ligado e sem NDA ativo). */
  publiclyVisible: boolean;
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
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED";
  createdAt: string;
}

export type PostKind = "WIP" | "STANDALONE" | "PROJECT_PUBLISHED";

/** Publicação: aparece no feed Publicações, no perfil e no portfólio. */
export interface Post {
  id: number;
  kind: PostKind;
  /** "WIP" ou "FINAL" (contém a imagem final da tarefa); null no post avulso e no aviso de projeto público. */
  label: "WIP" | "FINAL" | null;
  title: string | null;
  subtitle: string | null;
  author: UserSummary;
  project: { id: number; name: string; type: ProjectType } | null;
  task: { id: number; title: string; status: ApiTaskStatus } | null;
  images: { id: number; url: string }[];
  hiddenFromPortfolio: boolean;
  /** Falso quando só o autor e quem participa do projeto conseguem ver. */
  isPublic: boolean;
  createdAt: string;
}

/** Visão pública do projeto: cada tarefa vira título, subtítulo e imagens. */
export interface PublicProject {
  id: number;
  name: string;
  description: string | null;
  type: ProjectType;
  status: "ACTIVE" | "CLOSED";
  owner: UserSummary | null;
  members: UserSummary[];
  publicSince: string | null;
  isPublic: boolean;
  viewerParticipates: boolean;
  updates: {
    taskId: number;
    title: string;
    subtitle: string | null;
    done: boolean;
    firstImageAt: string;
    lastImageAt: string;
    images: { fileId: number; url: string; finalImage: boolean; createdAt: string }[];
  }[];
}

export interface ProfileProject {
  /** null quando o projeto está mascarado por NDA. */
  id: number | null;
  name: string | null;
  description: string | null;
  type: ProjectType;
  role: ProjectRole;
  status: "ACTIVE" | "CLOSED";
  nda: boolean;
  masked: boolean;
  ownerName: string | null;
  /** Projeto público: aparece no portfólio e tem visão pública. */
  publicView: boolean;
  coverUrl: string | null;
}

export interface Profile {
  user: UserSummary;
  me: boolean;
  memberSince: string | null;
  /** Posts avulsos que aparecem no portfólio. Os projetos públicos vêm em projects (publicView). */
  portfolio: Post[];
  /** Aba Posts: tudo o que a pessoa publicou e o visitante pode ver. */
  posts: Post[];
  projects: ProfileProject[];
  hiddenPersonalProjects: number;
  heatmap: { date: string; count: number }[];
  bio: string | null;
  specialties: string[];
  links: string[];
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
  /** Nome do projeto (útil em "Minhas tarefas"). */
  projectName?: string;
  assignee: UserSummary | null;
  createdAt: string;
  updatedAt: string;
  /** Tarefa interna: fora da visão pública e não gera WIP. */
  hiddenFromPublic: boolean;
}

export interface AppNotification {
  id: number;
  type: string;
  message: string;
  /** Caminho no site para abrir ao clicar. */
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface TaskComment {
  id: number;
  /** COMMENT, ou o registro da revisão: CHANGES_REQUESTED / APPROVED. */
  kind: "COMMENT" | "CHANGES_REQUESTED" | "APPROVED";
  body: string;
  author: UserSummary;
  fileId: number | null;
  fileVersion: number | null;
  fileName: string | null;
  createdAt: string;
}

export interface HistoryEntry {
  id: number;
  type: string;
  message: string;
  actor: UserSummary | null;
  taskId: number | null;
  createdAt: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  tasks: { title: string; description: string; priority: ApiPriority }[];
}

export interface Account {
  id: number;
  fullName: string;
  username: string;
  email: string;
  role: ApiUser["role"];
  avatarUrl: string | null;
  bio: string | null;
  specialties: string[];
  links: string[];
  createdAt: string | null;
  storageUsedBytes: number;
  storageQuotaBytes: number;
}

/** Texto do backend que não serve para quem usa o site vira uma frase clara, pelo código HTTP. */
export function friendlyError(status: number, message: string | null | undefined): string {
  const text = (message ?? "").trim();
  const technical =
    !text ||
    /^A solicitação falhou/.test(text) ||
    /^(Bad Request|Forbidden|Not Found|Internal Server Error|Unauthorized|Conflict)$/i.test(text) ||
    /Request processing failed|Exception|<html/i.test(text);
  if (!technical) return text;
  if (status === 0) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if (status === 400) return "Confira os dados informados e tente de novo.";
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  if (status === 403) return "Você não tem permissão para fazer isso.";
  if (status === 404) return "Não encontramos isso. Talvez tenha sido apagado.";
  if (status === 409) return "Isso mudou enquanto você estava na página. Atualize e tente de novo.";
  if (status === 410) return "Isso não está mais disponível.";
  if (status === 413) return "O arquivo é grande demais.";
  if (status === 415) return "Esse tipo de arquivo não é aceito.";
  if (status >= 500) return "O servidor teve um problema. Tente de novo em instantes.";
  return "Algo deu errado. Tente de novo.";
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

/**
 * Chamadas lentas em andamento. No plano grátis o backend "dorme" sem uso e leva até 1 minuto
 * para acordar; a tela mostra um aviso enquanto houver alguma chamada passando de SLOW_REQUEST_MS.
 */
const SLOW_REQUEST_MS = 4000;
let slowRequests = 0;
const slowListeners = new Set<() => void>();

export function subscribeSlowRequests(listener: () => void) {
  slowListeners.add(listener);
  return () => {
    slowListeners.delete(listener);
  };
}

export function getSlowRequestCount() {
  return slowRequests;
}

function setSlowRequests(next: number) {
  slowRequests = Math.max(0, next);
  slowListeners.forEach((listener) => listener());
}

function trackSlow<T>(promise: Promise<T>): Promise<T> {
  let flagged = false;
  const timer = setTimeout(() => {
    flagged = true;
    setSlowRequests(slowRequests + 1);
  }, SLOW_REQUEST_MS);
  return promise.finally(() => {
    clearTimeout(timer);
    if (flagged) setSlowRequests(slowRequests - 1);
  });
}

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

  let result: { response: Response; responseText: string };
  try {
    result = await trackSlow(
      fetch(`/api/v1${path}`, { ...init, headers }).then(async (res) => ({
        response: res,
        responseText: await res.text(),
      })),
    );
  } catch {
    throw new ApiError(friendlyError(0, null), 0);
  }
  const { response, responseText } = result;
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
    throw new ApiError(friendlyError(response.status, message), response.status);
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
  project: (projectId: number) =>
    request<Project>(`/projects/${projectId}`, {}, { authFailure: "verify-session" }),
  createProject: (payload: {
    name: string;
    slug: string;
    description?: string | undefined;
    type: ProjectType;
    /** Modelo com tarefas iniciais (ver projectTemplates). */
    template?: string | undefined;
  }) =>
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
  task: (taskId: number) =>
    request<ApiTask>(`/tasks/${taskId}`, {}, { authFailure: "verify-session" }),
  assignTask: (taskId: number, userId: number | null) =>
    request<ApiTask>(`/tasks/${taskId}/assignee`, {
      method: "PATCH",
      body: JSON.stringify({ userId }),
    }),
  taskFiles: (taskId: number) =>
    request<TaskFile[]>(`/tasks/${taskId}/files`, {}, { authFailure: "verify-session" }),
  markFinalFile: (fileId: number) =>
    request<TaskFile>(`/files/${fileId}/final`, { method: "POST" }),
  deleteFile: (fileId: number) => request<void>(`/files/${fileId}`, { method: "DELETE" }),
  updateProjectSettings: (
    projectId: number,
    payload: {
      contractorsSeeAllTasks?: boolean;
      ndaEnabled?: boolean;
      autoWip?: boolean;
      /** "" tira a data. */
      ndaReleaseDate?: string;
    },
  ) =>
    request<Project>(`/projects/${projectId}/settings`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateProjectStatus: (projectId: number, status: Project["status"]) =>
    request<Project>(`/projects/${projectId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteProject: (projectId: number) =>
    request<void>(`/projects/${projectId}`, { method: "DELETE" }),
  members: (projectId: number) =>
    request<ProjectMember[]>(
      `/projects/${projectId}/members`,
      {},
      { authFailure: "verify-session" },
    ),
  removeMember: (projectId: number, userId: number) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
  leaveProject: (projectId: number) =>
    request<void>(`/projects/${projectId}/leave`, { method: "POST" }),
  invite: (projectId: number, email: string) =>
    request<ProjectInvitation>(`/projects/${projectId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  projectInvitations: (projectId: number) =>
    request<ProjectInvitation[]>(
      `/projects/${projectId}/invitations`,
      {},
      { authFailure: "verify-session" },
    ),
  myInvitations: () => request<ProjectInvitation[]>("/invitations"),
  acceptInvitation: (invitationId: number) =>
    request<ProjectInvitation>(`/invitations/${invitationId}/accept`, { method: "POST" }),
  declineInvitation: (invitationId: number) =>
    request<ProjectInvitation>(`/invitations/${invitationId}/decline`, { method: "POST" }),
  profile: (username: string) =>
    request<Profile>(
      `/users/${encodeURIComponent(username)}/profile`,
      {},
      { authFailure: "verify-session" },
    ),
  setTaskHiddenFromPublic: (taskId: number, hiddenFromPublic: boolean) =>
    request<ApiTask>(`/tasks/${taskId}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ hiddenFromPublic }),
    }),
  taskCanvas: (taskId: number) =>
    request<{ content: string; updatedByName: string | null; updatedAt: string | null }>(
      `/tasks/${taskId}/canvas`,
      {},
      { authFailure: "verify-session" },
    ),
  saveTaskCanvas: (taskId: number, content: string) =>
    request<{ content: string; updatedByName: string | null; updatedAt: string | null }>(
      `/tasks/${taskId}/canvas`,
      { method: "PUT", body: JSON.stringify({ content }) },
    ),
  /** Feed Publicações: só o que é público, mais novo primeiro. before = id para a próxima página. */
  feed: (before?: number) =>
    request<Post[]>(
      `/feed${before ? `?before=${before}` : ""}`,
      { method: "GET" },
      { authFailure: "ignore", sendAuthorization: false },
    ),
  createPost: (file: File, title?: string, subtitle?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (title?.trim()) form.append("title", title.trim());
    if (subtitle?.trim()) form.append("subtitle", subtitle.trim());
    return request<Post>("/posts", { method: "POST", body: form });
  },
  /** "Publicar como post": uma imagem de tarefa vira post avulso. */
  publishFile: (fileId: number, payload: { title?: string; subtitle?: string } = {}) =>
    request<Post>(`/files/${fileId}/post`, { method: "POST", body: JSON.stringify(payload) }),
  updatePost: (
    postId: number,
    payload: { title?: string; subtitle?: string; hiddenFromPortfolio?: boolean },
  ) => request<Post>(`/posts/${postId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePost: (postId: number) => request<void>(`/posts/${postId}`, { method: "DELETE" }),
  // ---- Fluxo de trabalho ----
  myTasks: () => request<ApiTask[]>("/me/tasks"),
  reviewTask: (taskId: number, decision: "APPROVE" | "REQUEST_CHANGES", note?: string) =>
    request<ApiTask>(`/tasks/${taskId}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),
  comments: (taskId: number) =>
    request<TaskComment[]>(`/tasks/${taskId}/comments`, {}, { authFailure: "verify-session" }),
  addComment: (taskId: number, body: string, fileId?: number | null) =>
    request<TaskComment>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, fileId: fileId ?? null }),
    }),
  deleteComment: (commentId: number) => request<void>(`/comments/${commentId}`, { method: "DELETE" }),
  notifications: () =>
    request<{ unread: number; items: AppNotification[] }>("/notifications", {}, { authFailure: "verify-session" }),
  unreadNotifications: () =>
    request<{ unread: number }>("/notifications/unread-count", {}, { authFailure: "ignore" }),
  readNotification: (id: number) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () => request<void>("/notifications/read-all", { method: "POST" }),
  projectHistory: (projectId: number) =>
    request<HistoryEntry[]>(`/projects/${projectId}/history`, {}, { authFailure: "verify-session" }),
  transferProject: (projectId: number, userId: number) =>
    request<Project>(`/projects/${projectId}/transfer`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    }),
  cancelInvitation: (projectId: number, invitationId: number) =>
    request<void>(`/projects/${projectId}/invitations/${invitationId}`, { method: "DELETE" }),
  projectTemplates: () => request<ProjectTemplate[]>("/project-templates"),
  // ---- Conta ----
  me: () => request<Account>("/me"),
  updateProfile: (payload: {
    fullName?: string;
    bio?: string;
    specialties?: string[];
    links?: string[];
  }) => request<Account>("/me/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Account>("/me/avatar", { method: "POST", body: form });
  },
  removeAvatar: () => request<Account>("/me/avatar", { method: "DELETE" }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      { authFailure: "ignore", sendAuthorization: false },
    ),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>(
      "/auth/reset-password",
      { method: "POST", body: JSON.stringify({ token, newPassword }) },
      { authFailure: "ignore", sendAuthorization: false },
    ),
  deleteAccount: (password: string) =>
    request<void>("/me/delete", { method: "POST", body: JSON.stringify({ password }) }),
  publicProject: (projectId: number, order: "asc" | "desc" = "asc") =>
    request<PublicProject>(
      `/projects/${projectId}/public?order=${order}`,
      {},
      { authFailure: "verify-session" },
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
      if (event.lengthComputable)
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
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
  if (!response.ok)
    throw new ApiError(`Não foi possível baixar o arquivo (${response.status}).`, response.status);
  return response.blob();
}

/**
 * Baixa um arquivo que exige login (ex.: .zip das finais, exportação de dados) e salva com o nome
 * que o servidor mandar.
 */
export async function downloadWithAuth(path: string, fallbackName: string): Promise<void> {
  const token = window.localStorage.getItem("authToken");
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(friendlyError(0, null), 0);
  }
  if (!response.ok) {
    let message: string | null = null;
    try {
      const data = (await response.json()) as { message?: string };
      message = data.message ?? null;
    } catch {
      // Sem corpo JSON: fica a mensagem padrão do código HTTP.
    }
    throw new ApiError(friendlyError(response.status, message), response.status);
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const name = utf8 ? decodeURIComponent(utf8) : (plain ?? fallbackName);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

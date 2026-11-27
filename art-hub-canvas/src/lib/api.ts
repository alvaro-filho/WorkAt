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
  /** Comentários na página pública (desligados por padrão no corporativo). */
  commentsEnabled: boolean;
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
  /** coverUrl: só no aviso de projeto aberto ao público, a capa do projeto. */
  project: { id: number; name: string; type: ProjectType; coverUrl?: string | null } | null;
  task: { id: number; title: string; status: ApiTaskStatus } | null;
  images: { id: number; url: string }[];
  hiddenFromPortfolio: boolean;
  /** Falso quando só o autor e quem participa do projeto conseguem ver. */
  isPublic: boolean;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  /** Reações de quem está vendo (sempre falso sem login). */
  liked: boolean;
  reposted: boolean;
  saved: boolean;
  /** Comentários visíveis e se a publicação aceita novos. */
  commentCount: number;
  commentsEnabled: boolean;
}

/** Comentário de feedback (removido = apagado com respostas: sem autor nem texto). */
export interface FeedbackComment {
  id: number;
  author: UserSummary | null;
  body: string | null;
  removed: boolean;
  createdAt: string;
  canDelete: boolean;
  replies: FeedbackComment[];
}

export interface CommentThread {
  enabled: boolean;
  /** Quem está vendo pode ligar/desligar (autor da publicação ou diretor do projeto). */
  canToggle: boolean;
  count: number;
  comments: FeedbackComment[];
}

export type ReactionType = "like" | "repost" | "save";

// ---- Chamadas (vagas e jobs) ----
export type CallRole =
  "CONCEPT" | "ILUSTRACAO" | "MODELAGEM_3D" | "ANIMACAO" | "HQ" | "UI" | "OUTRO";
export type CallFormat = "FREELA" | "PROJETO" | "CLT" | "ESTAGIO";
export type CallLocation = "REMOTO" | "PRESENCIAL" | "HIBRIDO";
export type CallStatus = "OPEN" | "CLOSED" | "FILLED";
export type InterestStatus = "SENT" | "SEEN" | "INVITED" | "NOT_SELECTED";

export interface JobCall {
  id: number;
  title: string;
  role: CallRole;
  description: string;
  format: CallFormat;
  location: CallLocation;
  city: string | null;
  /** Faixa em reais, opcional (o estúdio decide se mostra). */
  payMin: number | null;
  payMax: number | null;
  closesOn: string;
  nda: boolean;
  status: CallStatus;
  createdAt: string;
  author: UserSummary;
  /** Sinais de confiança: há quanto tempo o estúdio está aqui e quantos projetos corporativos dirige. */
  authorSince: string | null;
  directedProjects: number;
  /** Quem está vendo é o autor. */
  mine: boolean;
  /** Só para o autor. */
  interestCount: number | null;
  myInterest: {
    id: number;
    status: InterestStatus;
    projectId: number | null;
    /** Mensagens na conversa com o estúdio (o artista só escreve depois que o estúdio começa). */
    messageCount: number;
  } | null;
}

export interface CallInterest {
  id: number;
  artist: UserSummary;
  message: string;
  status: InterestStatus;
  createdAt: string;
  works: Post[];
  projectId: number | null;
  messageCount: number;
}

export interface MyInterestItem {
  id: number;
  status: InterestStatus;
  createdAt: string;
  projectId: number | null;
  callId: number;
  callTitle: string;
  company: UserSummary;
  callStatus: CallStatus;
  messageCount: number;
}

/** Conversa da Chamada entre o estúdio e um candidato (presa à candidatura). */
export interface CallMessage {
  id: number;
  author: UserSummary;
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface CallConversation {
  messages: CallMessage[];
  canSend: boolean;
  /** Por que não dá para escrever agora (null quando dá). */
  blockedReason: string | null;
}

export interface CallInput {
  title?: string;
  role?: CallRole;
  description?: string;
  format?: CallFormat;
  location?: CallLocation;
  city?: string | null;
  payMin?: number | null;
  payMax?: number | null;
  closesOn?: string;
  nda?: boolean;
  status?: CallStatus;
}

/** Projeto na tela Projetos, com o resumo do que está acontecendo (só tarefas que a pessoa vê). */
export interface ProjectOverview {
  project: Project;
  taskTotal: number;
  taskDone: number;
  taskInReview: number;
  overdue: number;
  /** Tarefas abertas com quem está vendo. */
  mine: number;
  memberCount: number;
  /** Até 5 pessoas, diretor primeiro. */
  people: UserSummary[];
  /** Arquivo de imagem para a capa (baixado com login). */
  coverFileId: number | null;
  lastActivityAt: string | null;
}

/** Post avulso: até 6 imagens. Projetos não têm limite (cada etapa fica registrada). */
export const MAX_POST_IMAGES = 6;

/** Projeto aberto ao público, na aba Projetos do Explorar. */
export interface PublicProjectCard {
  id: number;
  name: string;
  description: string | null;
  type: ProjectType;
  director: UserSummary | null;
  coverUrl: string | null;
  imageCount: number;
  lastActivityAt: string | null;
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
  /** Arquivo escolhido como capa pelo diretor; null = imagem mais recente. */
  coverFileId: number | null;
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
  /** Publicação pública mais recente do projeto (ordena o portfólio). */
  lastActivityAt: string | null;
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
  /** Capa do perfil (null = degradê padrão). */
  bannerUrl: string | null;
  /** Publicações que a pessoa republicou. */
  reposts: { post: Post; repostedAt: string }[];
  /** Itens salvos (só a própria pessoa recebe). */
  saved: Post[];
  /** "Disponível para trabalho" (null quando desligado ou conta de estúdio). */
  availability: Availability | null;
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
  bannerUrl: string | null;
  /** Último enquadramento escolhido (JSON com centro e zoom), para reabrir o editor no mesmo lugar. */
  avatarCrop: string | null;
  bannerCrop: string | null;
  /** Outras pessoas podem convidar pelo @usuário (além do e-mail). */
  inviteByUsername: boolean;
  /** Disponível para trabalho (as escolhas ficam guardadas mesmo com o selo desligado). */
  availability: Availability;
}

/** "Disponível para trabalho": formatos aceitos, onde e uma linha livre. */
export interface Availability {
  available: boolean;
  formats: CallFormat[];
  location: CallLocation | null;
  city: string | null;
  note: string | null;
  updatedAt: string | null;
}

/** Artista no Explorar › Artistas e nas sugestões da Chamada. */
export interface ArtistCard {
  user: UserSummary;
  specialties: string[];
  /** null quando o selo está desligado. */
  availability: Availability | null;
  works: Post[];
  memberSince: string | null;
  /** Só nas sugestões: o estúdio já chamou a pessoa para ver a Chamada. */
  nudged: boolean;
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
  /** Tira a marca de imagem final (a tarefa fica sem imagem final). */
  unmarkFinalFile: (fileId: number) =>
    request<TaskFile>(`/files/${fileId}/final`, { method: "DELETE" }),
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
  /** Tela Projetos: cada projeto com progresso, atrasos, equipe e capa. */
  projectsOverview: () => request<ProjectOverview[]>("/projects/overview"),
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
  feed: (before?: number, limit?: number) =>
    request<Post[]>(
      `/feed?${new URLSearchParams({
        ...(before ? { before: String(before) } : {}),
        ...(limit ? { limit: String(limit) } : {}),
      }).toString()}`,
      { method: "GET" },
      { authFailure: "ignore" },
    ),
  /** Post avulso com 1 a 6 imagens. */
  createPost: (files: File[], title?: string, subtitle?: string) => {
    const form = new FormData();
    files.forEach((file) => form.append("file", file));
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
  /** Uma publicação (pública para quem não tem login, se ela for pública). */
  post: (postId: number) => request<Post>(`/posts/${postId}`, {}, { authFailure: "ignore" }),
  deletePost: (postId: number) => request<void>(`/posts/${postId}`, { method: "DELETE" }),
  /** Curtir, republicar ou salvar (on = true liga, false desliga). Devolve a publicação atualizada. */
  react: (postId: number, type: ReactionType, on: boolean) =>
    request<Post>(`/posts/${postId}/reactions/${type}`, { method: on ? "PUT" : "DELETE" }),
  /** Comentários de feedback: target "post" (publicação) ou "project" (página pública do projeto). */
  commentThread: (target: "post" | "project", id: number) =>
    request<CommentThread>(
      target === "post" ? `/posts/${id}/comments` : `/projects/${id}/public/comments`,
      {},
      { authFailure: "ignore" },
    ),
  addFeedback: (target: "post" | "project", id: number, body: string, parentId?: number | null) =>
    request<CommentThread>(
      target === "post" ? `/posts/${id}/comments` : `/projects/${id}/public/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body, parentId: parentId ?? null }),
      },
    ),
  setFeedbackEnabled: (target: "post" | "project", id: number, enabled: boolean) =>
    request<CommentThread>(
      target === "post" ? `/posts/${id}/comments/settings` : `/projects/${id}/comments/settings`,
      { method: "PUT", body: JSON.stringify({ enabled }) },
    ),
  deleteFeedback: (commentId: number) =>
    request<void>(`/post-comments/${commentId}`, { method: "DELETE" }),
  // ---- Chamadas ----
  calls: (
    filters: {
      role?: CallRole;
      format?: CallFormat;
      location?: CallLocation;
      author?: string;
    } = {},
  ) =>
    request<JobCall[]>(
      `/calls?${new URLSearchParams(
        Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
      ).toString()}`,
      {},
      { authFailure: "ignore" },
    ),
  call: (id: number) => request<JobCall>(`/calls/${id}`, {}, { authFailure: "ignore" }),
  createCall: (input: CallInput) =>
    request<JobCall>("/calls", { method: "POST", body: JSON.stringify(input) }),
  updateCall: (id: number, input: CallInput) =>
    request<JobCall>(`/calls/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  showInterest: (id: number, message: string, postIds: number[]) =>
    request<JobCall>(`/calls/${id}/interest`, {
      method: "POST",
      body: JSON.stringify({ message, postIds }),
    }),
  withdrawInterest: (id: number) => request<JobCall>(`/calls/${id}/interest`, { method: "DELETE" }),
  callInterests: (id: number) => request<CallInterest[]>(`/calls/${id}/interests`),
  inviteFromCall: (id: number, interestId: number, projectId: number | null) =>
    request<{ projectId: number; interest: CallInterest }>(
      `/calls/${id}/interests/${interestId}/invite`,
      {
        method: "POST",
        body: JSON.stringify({ projectId }),
      },
    ),
  declineInterest: (id: number, interestId: number) =>
    request<CallInterest>(`/calls/${id}/interests/${interestId}/decline`, { method: "POST" }),
  myInterests: () => request<MyInterestItem[]>("/me/interests"),
  callConversation: (id: number, interestId: number) =>
    request<CallConversation>(`/calls/${id}/interests/${interestId}/messages`),
  sendCallMessage: (id: number, interestId: number, body: string) =>
    request<CallConversation>(`/calls/${id}/interests/${interestId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  /** Aba Artistas do Explorar. */
  exploreArtists: (filters: { role?: CallRole; available?: boolean } = {}) =>
    request<ArtistCard[]>(
      `/explore/artists?${new URLSearchParams({
        ...(filters.role ? { role: filters.role } : {}),
        ...(filters.available ? { available: "true" } : {}),
      }).toString()}`,
      {},
      { authFailure: "ignore" },
    ),
  callSuggestions: (id: number) => request<ArtistCard[]>(`/calls/${id}/suggestions`),
  nudgeArtist: (id: number, username: string) =>
    request<void>(`/calls/${id}/suggestions/${encodeURIComponent(username)}/nudge`, {
      method: "POST",
    }),
  /** Aba Projetos do Explorar. */
  exploreProjects: () =>
    request<PublicProjectCard[]>(
      "/explore/projects",
      {},
      { authFailure: "ignore", sendAuthorization: false },
    ),
  /** O diretor escolhe a capa do projeto (null = imagem mais recente). */
  setProjectCover: (projectId: number, fileId: number | null) =>
    request<Project>(`/projects/${projectId}/cover`, {
      method: "PUT",
      body: JSON.stringify({ fileId }),
    }),
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
  deleteComment: (commentId: number) =>
    request<void>(`/comments/${commentId}`, { method: "DELETE" }),
  notifications: () =>
    request<{ unread: number; items: AppNotification[] }>(
      "/notifications",
      {},
      { authFailure: "verify-session" },
    ),
  unreadNotifications: () =>
    request<{ unread: number }>("/notifications/unread-count", {}, { authFailure: "ignore" }),
  readNotification: (id: number) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: "POST" }),
  readAllNotifications: () => request<void>("/notifications/read-all", { method: "POST" }),
  projectHistory: (projectId: number) =>
    request<HistoryEntry[]>(
      `/projects/${projectId}/history`,
      {},
      { authFailure: "verify-session" },
    ),
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
  /** Foto recortada; original e crop guardam a imagem inteira e o enquadramento para reajustar depois. */
  uploadAvatar: (file: File, original?: File, crop?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (original) form.append("original", original);
    if (crop) form.append("crop", crop);
    return request<Account>("/me/avatar", { method: "POST", body: form });
  },
  removeAvatar: () => request<Account>("/me/avatar", { method: "DELETE" }),
  uploadBanner: (file: File, original?: File, crop?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (original) form.append("original", original);
    if (crop) form.append("crop", crop);
    return request<Account>("/me/banner", { method: "POST", body: form });
  },
  removeBanner: () => request<Account>("/me/banner", { method: "DELETE" }),
  /** Aba Permissões: aceitar convites pelo @usuário ou só pelo e-mail. */
  updatePermissions: (payload: { inviteByUsername: boolean }) =>
    request<Account>("/me/permissions", { method: "PATCH", body: JSON.stringify(payload) }),
  updateAvailability: (payload: {
    available?: boolean;
    formats?: CallFormat[];
    location?: CallLocation;
    city?: string;
    note?: string;
  }) => request<Account>("/me/availability", { method: "PATCH", body: JSON.stringify(payload) }),
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

/** Imagem original da própria foto ou capa (para reajustar o enquadramento). */
export async function fetchProfileOriginal(kind: "avatar" | "banner"): Promise<Blob> {
  const token = window.localStorage.getItem("authToken");
  const response = await fetch(`/api/v1/me/${kind}/original`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok)
    throw new ApiError(`Não foi possível abrir a imagem (${response.status}).`, response.status);
  return response.blob();
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
    response = await fetch(`/api/v1${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
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

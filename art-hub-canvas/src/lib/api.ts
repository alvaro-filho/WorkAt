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

export interface Project {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: "EMPRESA" | "ESTUDIO" | "PESSOAL";
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
  options: { logoutOnForbidden?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  if (typeof window !== "undefined") {
    const token = window.localStorage.getItem("authToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

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
    const indicatesExpiredSession =
      response.status === 403 && /token|jwt|expirad|inválid|autentica|acesso negado/i.test(message);
    if (
      response.status === 403 &&
      (options.logoutOnForbidden !== false || indicatesExpiredSession)
    ) {
      clearSession();
    }
    throw new ApiError(message || `A solicitação falhou (${response.status}).`, response.status);
  }

  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: {
    username: string;
    fullName: string;
    email: string;
    password: string;
    role: ApiUser["role"];
  }) => request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  projects: () => request<Project[]>("/projects"),
  createProject: (payload: Omit<Project, "id">) =>
    request<Project>(
      "/projects",
      { method: "POST", body: JSON.stringify(payload) },
      { logoutOnForbidden: false },
    ),
  tasks: (projectId: number) => request<ApiTask[]>(`/projects/${projectId}/tasks`),
  createTask: (
    projectId: number,
    payload: { title: string; description?: string; priority?: ApiPriority; deadline?: string },
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
};

import { Building2, User, Users, type LucideIcon } from "lucide-react";

import type { Project, ProjectRole, ProjectType } from "@/lib/api";

export const PROJECT_TYPES: {
  value: ProjectType;
  label: string;
  /** Adjetivo usado em frases: "projeto pessoal", "projeto cooperativo"... */
  adjective: string;
  section: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "PERSONAL",
    label: "Meu projeto",
    adjective: "pessoal",
    section: "Meus projetos",
    description: "Só seu. Ideal para estudos e projetos pessoais.",
    icon: User,
  },
  {
    value: "COOPERATIVE",
    label: "Cooperativo",
    adjective: "cooperativo",
    section: "Cooperativos",
    description: "Você chama amigos e todos criam e movem tarefas juntos.",
    icon: Users,
  },
  {
    value: "CORPORATE",
    label: "Corporativo",
    adjective: "corporativo",
    section: "Corporativos",
    description:
      "Para estúdios e empresas: o dono cria as tarefas dos contratados e pode ativar NDA.",
    icon: Building2,
  },
];

export function projectTypeInfo(type: ProjectType) {
  return PROJECT_TYPES.find((item) => item.value === type) ?? PROJECT_TYPES[0]!;
}

/** Nome do papel como o usuário enxerga: no corporativo o membro é "Contratado". */
export function roleLabel(role: ProjectRole, type: ProjectType) {
  if (role === "OWNER") return "Dono";
  return type === "CORPORATE" ? "Contratado" : "Membro";
}

/** Espelha as regras do backend (ProjectAccessService). O backend continua sendo quem decide. */
export function projectPermissions(project: Project) {
  const owner = project.myRole === "OWNER";
  const active = project.status === "ACTIVE";
  const cooperative = project.type === "COOPERATIVE";
  return {
    owner,
    canManageTasks: active && (owner || cooperative),
    canMoveTasks: active && (owner || cooperative),
    canInvite: active && owner && project.type !== "PERSONAL",
    hasMembers: project.type !== "PERSONAL",
  };
}

export function makeSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto";
  return `${base}-${Math.random().toString(36).slice(2, 7)}`;
}

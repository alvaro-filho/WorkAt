import type {
  CallFormat,
  CallLocation,
  CallRole,
  CallStatus,
  InterestStatus,
  JobCall,
} from "@/lib/api";

export const CALL_ROLES: { value: CallRole; label: string }[] = [
  { value: "CONCEPT", label: "Concept art" },
  { value: "ILUSTRACAO", label: "Ilustração" },
  { value: "MODELAGEM_3D", label: "3D" },
  { value: "ANIMACAO", label: "Animação" },
  { value: "HQ", label: "HQ e quadrinhos" },
  { value: "UI", label: "UI e interface" },
  { value: "OUTRO", label: "Outra" },
];

export const CALL_FORMATS: { value: CallFormat; label: string }[] = [
  { value: "FREELA", label: "Freela" },
  { value: "PROJETO", label: "Contrato por projeto" },
  { value: "CLT", label: "CLT" },
  { value: "ESTAGIO", label: "Estágio" },
];

export const CALL_LOCATIONS: { value: CallLocation; label: string }[] = [
  { value: "REMOTO", label: "Remoto" },
  { value: "PRESENCIAL", label: "Presencial" },
  { value: "HIBRIDO", label: "Híbrido" },
];

export const roleLabel = (value: CallRole) =>
  CALL_ROLES.find((item) => item.value === value)?.label ?? value;
export const formatLabel = (value: CallFormat) =>
  CALL_FORMATS.find((item) => item.value === value)?.label ?? value;

export function locationLabel(call: Pick<JobCall, "location" | "city">) {
  const base = CALL_LOCATIONS.find((item) => item.value === call.location)?.label ?? call.location;
  return call.location === "REMOTO" || !call.city ? base : `${base} · ${call.city}`;
}

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Faixa de pagamento; null quando o estúdio não informou (o card não fala de pagamento). */
export function payLabel(call: Pick<JobCall, "payMin" | "payMax">) {
  if (call.payMin != null && call.payMax != null) {
    return call.payMin === call.payMax
      ? money(call.payMin)
      : `${money(call.payMin)} a ${money(call.payMax)}`;
  }
  if (call.payMin != null) return `A partir de ${money(call.payMin)}`;
  if (call.payMax != null) return `Até ${money(call.payMax)}`;
  return null;
}

export const CALL_STATUS_LABEL: Record<CallStatus, string> = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  FILLED: "Preenchida",
};

export const INTEREST_STATUS_LABEL: Record<InterestStatus, string> = {
  SENT: "Enviado",
  SEEN: "Visto pelo estúdio",
  INVITED: "Convidado",
  NOT_SELECTED: "Não selecionado",
};

/** "até 12 de dez." */
export function closesLabel(closesOn: string) {
  return new Date(`${closesOn}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

/** Há quanto tempo a conta existe ("na plataforma desde nov. de 2026"). */
export function sinceLabel(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

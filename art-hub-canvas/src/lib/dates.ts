/** Data local de hoje (AAAA-MM-DD), sem o problema de fuso do toISOString. */
export function todayString(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "2026-12-05" → "05/12/2026" (sem passar por Date, para não mudar o dia). */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "Sem prazo";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

/** Prazo vencido (antes de hoje) e tarefa ainda aberta. */
export function isOverdue(deadline: string | null | undefined, status: string): boolean {
  return Boolean(deadline) && status !== "DONE" && (deadline as string) < todayString();
}

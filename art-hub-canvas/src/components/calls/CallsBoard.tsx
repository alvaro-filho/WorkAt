import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Megaphone, Plus } from "lucide-react";

import { CallCard } from "@/components/calls/CallCard";
import { CallFormDialog } from "@/components/calls/CallFormDialog";
import { Button } from "@/components/ui/button";
import {
  api,
  type CallFormat,
  type CallLocation,
  type CallRole,
  type JobCall,
  type MyInterestItem,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { CALL_FORMATS, CALL_LOCATIONS, CALL_ROLES, INTEREST_STATUS_LABEL } from "@/lib/call-labels";

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const chipClass = (active: boolean) =>
  `shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
    active
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted-foreground hover:text-foreground"
  }`;

/**
 * Aba Chamadas do Explorar: Chamadas abertas dos estúdios, com filtros por função, formato e onde.
 * Estúdio vê "Nova Chamada"; artista vê as próprias candidaturas no topo.
 */
export function CallsBoard({ query }: { query: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<JobCall[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<CallRole | null>(null);
  const [format, setFormat] = useState<CallFormat | null>(null);
  const [location, setLocation] = useState<CallLocation | null>(null);
  const [creating, setCreating] = useState(false);
  const [mine, setMine] = useState<MyInterestItem[]>([]);

  useEffect(() => {
    let active = true;
    setCalls(null);
    setError(null);
    api
      .calls({ ...(role && { role }), ...(format && { format }), ...(location && { location }) })
      .then((list) => active && setCalls(list))
      .catch(
        (e: unknown) =>
          active &&
          setError(e instanceof Error ? e.message : "Não foi possível carregar as Chamadas."),
      );
    return () => {
      active = false;
    };
  }, [role, format, location]);

  useEffect(() => {
    if (user?.role !== "ARTIST") return;
    api
      .myInterests()
      .then(setMine)
      .catch(() => setMine([]));
  }, [user]);

  const visible = useMemo(() => {
    if (!calls) return [];
    const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (words.length === 0) return calls;
    return calls.filter((call) => {
      const haystack = normalize(
        [call.title, call.description, call.author.fullName, call.city].filter(Boolean).join(" "),
      );
      return words.every((word) => haystack.includes(word));
    });
  }, [calls, query]);

  const isCompany = user?.role === "COMPANY";
  const filtered = role !== null || format !== null || location !== null;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Trabalhos abertos de estúdios. Mostre interesse com seu portfólio; só o estúdio vê.
          </p>
          {isCompany && (
            <Button
              size="sm"
              className="shrink-0 gradient-primary text-primary-foreground"
              onClick={() => setCreating(true)}
            >
              <Plus className="size-4" /> Nova Chamada
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por função">
          {CALL_ROLES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={role === item.value}
              onClick={() => setRole(role === item.value ? null : item.value)}
              className={chipClass(role === item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CALL_FORMATS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={format === item.value}
              onClick={() => setFormat(format === item.value ? null : item.value)}
              className={chipClass(format === item.value)}
            >
              {item.label}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" aria-hidden="true" />
          {CALL_LOCATIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={location === item.value}
              onClick={() => setLocation(location === item.value ? null : item.value)}
              className={chipClass(location === item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {mine.length > 0 && (
        <details className="border-b border-border px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold">
            Minhas candidaturas{" "}
            <span className="font-normal text-muted-foreground">({mine.length})</span>
          </summary>
          <ul className="mt-2 space-y-1">
            {mine.map((item) => (
              <li key={item.id}>
                <Link
                  to="/chamadas/$callId"
                  params={{ callId: String(item.callId) }}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
                >
                  <span className="min-w-0 truncate">
                    {item.callTitle}{" "}
                    <span className="text-muted-foreground">· {item.company.fullName}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {INTEREST_STATUS_LABEL[item.status]}
                    {item.messageCount > 0 &&
                      ` · ${item.messageCount} ${item.messageCount === 1 ? "mensagem" : "mensagens"}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && (
        <p
          role="alert"
          className="m-4 rounded-2xl border border-border p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {calls === null && !error && (
        <div aria-label="Carregando Chamadas">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="m-4 h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      )}

      {calls !== null && visible.length === 0 && (
        <div className="mx-auto max-w-md p-10 text-center">
          <Megaphone className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="font-semibold">
            {query || filtered
              ? "Nenhuma Chamada com esses filtros."
              : "Nenhuma Chamada aberta agora."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCompany
              ? "Publique uma Chamada para encontrar artistas pelo portfólio."
              : "Quando um estúdio abrir uma vaga ou job, ela aparece aqui."}
          </p>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="divide-y divide-border">
          {visible.map((call) => (
            <CallCard key={call.id} call={call} />
          ))}
        </ul>
      )}

      <CallFormDialog
        open={creating}
        onOpenChange={setCreating}
        call={null}
        onSaved={(call) =>
          void navigate({ to: "/chamadas/$callId", params: { callId: String(call.id) } })
        }
      />
    </div>
  );
}

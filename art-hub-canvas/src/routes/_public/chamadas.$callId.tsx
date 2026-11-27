import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarClock,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Users,
  Wallet,
} from "lucide-react";

import { ArtImage } from "@/components/art/ArtPieces";
import { CallConversation } from "@/components/calls/CallConversation";
import { CallFormDialog } from "@/components/calls/CallFormDialog";
import { CallSuggestions } from "@/components/calls/CallSuggestions";
import { InterestDialog } from "@/components/calls/InterestDialog";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/layout/ConfirmDialog";
import { relativeTime, UserAvatar } from "@/components/posts/PostCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  api,
  ApiError,
  type CallInterest,
  type CallStatus,
  type JobCall,
  type Project,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import {
  CALL_STATUS_LABEL,
  closesLabel,
  formatLabel,
  INTEREST_STATUS_LABEL,
  locationLabel,
  payLabel,
  roleLabel,
  sinceLabel,
} from "@/lib/call-labels";

export const Route = createFileRoute("/_public/chamadas/$callId")({
  head: () => ({ meta: [{ title: "Chamada — WorkAt" }] }),
  component: CallPage,
});

/**
 * Página da Chamada: o que o estúdio procura e sinais de confiança. O artista mostra interesse com
 * portfólio; o estúdio edita, fecha e vê os interessados (convidar para projeto ou não selecionar).
 */
function CallPage() {
  const { callId } = Route.useParams();
  const { user } = useAuth();
  const [call, setCall] = useState<JobCall | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"withdraw" | CallStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setCall(null);
    setNotFound(false);
    setError(null);
    api
      .call(Number(callId))
      .then((loaded) => active && setCall(loaded))
      .catch((e: unknown) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Não foi possível carregar a Chamada.");
      });
    return () => {
      active = false;
    };
  }, [callId, user]);

  const runConfirm = async () => {
    if (!call || !confirm) return;
    setBusy(true);
    try {
      setCall(
        confirm === "withdraw"
          ? await api.withdrawInterest(call.id)
          : await api.updateCall(call.id, { status: confirm }),
      );
      setConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (notFound || (error && !call)) {
    return (
      <AppLayout title="Chamada" back>
        <div className="mx-auto max-w-md rounded-2xl border border-border p-8 text-center">
          <p className="font-semibold">{error ?? "Esta Chamada não existe mais."}</p>
          <Link to="/explorar" className="mt-3 inline-block text-sm text-primary hover:underline">
            Voltar para Explorar
          </Link>
        </div>
      </AppLayout>
    );
  }

  if (!call) {
    return (
      <AppLayout title="Chamada" back>
        <div className="m-4 h-64 animate-pulse rounded-2xl bg-white/5" />
      </AppLayout>
    );
  }

  const pay = payLabel(call);
  const since = sinceLabel(call.authorSince);
  const open = call.status === "OPEN";
  const isArtist = user?.role === "ARTIST";

  return (
    <AppLayout title={call.title} subtitle={call.author.fullName} back>
      <article className="space-y-5 p-4 sm:p-6">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <Link
              to="/u/$username"
              params={{ username: call.author.username }}
              aria-label={`Perfil de ${call.author.fullName}`}
            >
              <UserAvatar name={call.author.fullName} src={call.author.avatarUrl} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                to="/u/$username"
                params={{ username: call.author.username }}
                className="block truncate font-bold hover:underline"
              >
                {call.author.fullName}
              </Link>
              <p className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
                {since && <span>Na WorkAt desde {since}</span>}
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="size-3.5 text-primary" />
                  {call.directedProjects === 0
                    ? "Nenhum projeto dirigido ainda"
                    : `${call.directedProjects} ${call.directedProjects === 1 ? "projeto dirigido" : "projetos dirigidos"}`}
                </span>
              </p>
            </div>
          </div>
          <h1 className="text-2xl leading-tight font-extrabold">{call.title}</h1>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-primary/15 px-2.5 py-1 text-primary">
              {roleLabel(call.role)}
            </span>
            <span className="rounded-full border border-border px-2.5 py-1">
              {formatLabel(call.format)}
            </span>
            {call.nda && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2.5 py-1 text-amber-300">
                <Lock className="size-3" /> Sob NDA
              </span>
            )}
            <span
              className={`rounded-full px-2.5 py-1 ${open ? "bg-emerald-500/15 text-emerald-300" : "border border-border text-muted-foreground"}`}
            >
              {CALL_STATUS_LABEL[call.status]}
            </span>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="size-4" /> <dd>{locationLabel(call)}</dd>
            </div>
            {pay && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wallet className="size-4" /> <dd>{pay}</dd>
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="size-4" />{" "}
              <dd>Interesse até {closesLabel(call.closesOn)}</dd>
            </div>
          </dl>
        </header>

        <p className="text-[15px] leading-relaxed whitespace-pre-line">{call.description}</p>
        {call.nda && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
            Este trabalho é sob NDA: o projeto já nasce com NDA ligado e nada é publicado até a data
            de liberação combinada.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Publicada {relativeTime(call.createdAt, Date.now())}
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Lado do artista */}
        {!call.mine && (
          <section className="rounded-2xl border border-border p-4">
            {call.myInterest ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    Seu interesse: {INTEREST_STATUS_LABEL[call.myInterest.status]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {call.myInterest.status === "INVITED"
                      ? "O estúdio te convidou para o projeto. Aceite o convite nas notificações."
                      : call.myInterest.status === "NOT_SELECTED"
                        ? "Desta vez não foi. Seu portfólio continua visível para outras Chamadas."
                        : "O estúdio recebe sua mensagem e os trabalhos que você escolheu."}
                  </p>
                </div>
                {call.myInterest.status === "INVITED" && call.myInterest.projectId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/notificacoes">Ver convite</Link>
                  </Button>
                ) : (
                  call.myInterest.status !== "NOT_SELECTED" && (
                    <Button variant="outline" size="sm" onClick={() => setConfirm("withdraw")}>
                      Retirar interesse
                    </Button>
                  )
                )}
              </div>
            ) : null}
            {call.myInterest && (
              <div className="mt-4">
                <CallConversation
                  callId={call.id}
                  interestId={call.myInterest.id}
                  otherName={call.author.fullName}
                  studioView={false}
                />
              </div>
            )}
            {call.myInterest ? null : !user ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Entre com uma conta de artista para mostrar interesse.
                </p>
                <Button asChild size="sm" className="gradient-primary text-primary-foreground">
                  <Link to="/login">Entrar</Link>
                </Button>
              </div>
            ) : !isArtist ? (
              <p className="text-sm text-muted-foreground">
                Só contas de artista mostram interesse em Chamadas.
              </p>
            ) : !open ? (
              <p className="text-sm text-muted-foreground">
                Esta Chamada não recebe mais interessados.
              </p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Mande uma mensagem e até 6 trabalhos do seu portfólio. Só {call.author.fullName}{" "}
                  vê.
                </p>
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={() => setInterestOpen(true)}
                >
                  Tenho interesse
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Lado do estúdio */}
        {call.mine && (
          <>
            <section className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Editar
              </Button>
              {open && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setConfirm("FILLED")}>
                    Marcar como preenchida
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setConfirm("CLOSED")}>
                    Fechar
                  </Button>
                </>
              )}
              {call.status === "CLOSED" && (
                <Button variant="outline" size="sm" onClick={() => setConfirm("OPEN")}>
                  Reabrir
                </Button>
              )}
            </section>
            <InterestsSection call={call} />
            {open && <CallSuggestions call={call} />}
          </>
        )}
      </article>

      {isArtist && (
        <InterestDialog
          open={interestOpen}
          onOpenChange={setInterestOpen}
          call={call}
          onSent={setCall}
        />
      )}
      {call.mine && (
        <CallFormDialog open={editing} onOpenChange={setEditing} call={call} onSaved={setCall} />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        busy={busy}
        onConfirm={() => void runConfirm()}
        destructive={confirm === "withdraw" || confirm === "CLOSED"}
        title={
          confirm === "withdraw"
            ? "Retirar seu interesse?"
            : confirm === "FILLED"
              ? "Marcar como preenchida?"
              : confirm === "CLOSED"
                ? "Fechar a Chamada?"
                : "Reabrir a Chamada?"
        }
        description={
          confirm === "withdraw"
            ? "O estúdio deixa de ver sua candidatura. Você pode mandar de novo enquanto a Chamada estiver aberta."
            : confirm === "FILLED"
              ? "A Chamada para de receber interessados e quem ainda não foi chamado recebe um aviso de que não foi selecionado."
              : confirm === "CLOSED"
                ? "A Chamada para de receber interessados. Você pode reabrir até o prazo."
                : "A Chamada volta a receber interessados até o prazo."
        }
        confirmLabel={confirm === "withdraw" ? "Retirar" : "Confirmar"}
      />
    </AppLayout>
  );
}

/** Interessados (só o autor vê): mensagem, trabalhos escolhidos, Convidar e Não selecionar. */
function InterestsSection({ call }: { call: JobCall }) {
  const [items, setItems] = useState<CallInterest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState<CallInterest | null>(null);
  const [declining, setDeclining] = useState<CallInterest | null>(null);
  const [talking, setTalking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .callInterests(call.id)
      .then(setItems)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Não foi possível carregar os interessados."),
      );
  }, [call.id]);

  const replace = (updated: CallInterest) =>
    setItems(
      (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
    );

  const decline = async () => {
    if (!declining) return;
    setBusy(true);
    try {
      replace(await api.declineInterest(call.id, declining.id));
      setDeclining(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível concluir.");
      setDeclining(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="interessados" className="space-y-3">
      <h2 id="interessados" className="flex items-center gap-2 text-lg font-bold">
        <Users className="size-5" /> Interessados
        {items && (
          <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
        )}
      </h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {items === null && !error && <div className="h-32 animate-pulse rounded-2xl bg-white/5" />}
      {items?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Ninguém mostrou interesse ainda. Quem se candidatar aparece aqui, com mensagem e
          portfólio.
        </p>
      )}
      <ul className="space-y-3">
        {items?.map((item) => (
          <li key={item.id} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-start gap-3">
              <Link to="/u/$username" params={{ username: item.artist.username }}>
                <UserAvatar name={item.artist.fullName} src={item.artist.avatarUrl} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/u/$username"
                  params={{ username: item.artist.username }}
                  className="font-semibold hover:underline"
                >
                  {item.artist.fullName}
                </Link>{" "}
                <span className="text-sm text-muted-foreground">
                  @{item.artist.username} · {relativeTime(item.createdAt, Date.now())}
                </span>
                <p className="mt-1 text-sm whitespace-pre-line">{item.message}</p>
              </div>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {INTEREST_STATUS_LABEL[item.status]}
              </span>
            </div>
            {item.works.length > 0 && (
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {item.works.map((work) => (
                  <li key={work.id}>
                    <Link
                      to="/publicacao/$postId"
                      params={{ postId: String(work.id) }}
                      className="block aspect-square overflow-hidden rounded-lg bg-white/5"
                      aria-label={work.title ?? "Arte"}
                    >
                      <ArtImage
                        src={work.images[0]?.url ?? null}
                        title={work.title ?? "Arte"}
                        className="size-full object-cover"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant={talking === item.id ? "secondary" : "outline"}
                size="sm"
                aria-expanded={talking === item.id}
                onClick={() => setTalking(talking === item.id ? null : item.id)}
              >
                <MessageCircle className="size-4" />
                {talking === item.id ? "Fechar conversa" : "Conversar"}
                {item.messageCount > 0 && talking !== item.id && (
                  <span className="rounded-full bg-primary/20 px-1.5 text-xs text-primary">
                    {item.messageCount}
                  </span>
                )}
              </Button>
              {item.status === "INVITED" && item.projectId ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/projetos/$projectId" params={{ projectId: String(item.projectId) }}>
                    Abrir projeto
                  </Link>
                </Button>
              ) : item.status !== "NOT_SELECTED" ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setDeclining(item)}>
                    Não selecionar
                  </Button>
                  <Button
                    size="sm"
                    className="gradient-primary text-primary-foreground"
                    onClick={() => setInviting(item)}
                  >
                    Convidar para projeto
                  </Button>
                </>
              ) : null}
            </div>
            {talking === item.id && (
              <CallConversation
                callId={call.id}
                interestId={item.id}
                otherName={item.artist.fullName}
                studioView
                onCountChange={(count) =>
                  count !== item.messageCount && replace({ ...item, messageCount: count })
                }
              />
            )}
          </li>
        ))}
      </ul>

      <InviteDialog
        call={call}
        interest={inviting}
        suggestedProjectId={items?.find((item) => item.projectId !== null)?.projectId ?? null}
        onClose={() => setInviting(null)}
        onInvited={(updated) => {
          replace(updated);
          setInviting(null);
        }}
      />
      <ConfirmDialog
        open={declining !== null}
        onOpenChange={(next) => !next && setDeclining(null)}
        busy={busy}
        onConfirm={() => void decline()}
        title={`Não selecionar ${declining?.artist.fullName ?? ""}?`}
        description="A pessoa recebe um aviso educado de que não foi selecionada desta vez."
        confirmLabel="Não selecionar"
      />
    </section>
  );
}

/** Convidar: cria um projeto corporativo a partir da Chamada ou usa um que você já dirige. */
function InviteDialog({
  call,
  interest,
  suggestedProjectId,
  onClose,
  onInvited,
}: {
  call: JobCall;
  interest: CallInterest | null;
  /** Projeto já criado por um convite anterior desta Chamada: vem marcado para o time ficar junto. */
  suggestedProjectId: number | null;
  onClose: () => void;
  onInvited: (interest: CallInterest) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [target, setTarget] = useState<string>("new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!interest) return;
    setTarget("new");
    setError(null);
    api
      .projects()
      .then((list) => {
        const mine = list.filter(
          (p) => p.type === "CORPORATE" && p.myRole === "OWNER" && p.status === "ACTIVE",
        );
        setProjects(mine);
        if (suggestedProjectId !== null && mine.some((p) => p.id === suggestedProjectId)) {
          setTarget(String(suggestedProjectId));
        }
      })
      .catch(() => setProjects([]));
  }, [interest, suggestedProjectId]);

  const submit = async () => {
    if (!interest) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.inviteFromCall(
        call.id,
        interest.id,
        target === "new" ? null : Number(target),
      );
      onInvited(result.interest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível convidar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={interest !== null} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar {interest?.artist.fullName}</DialogTitle>
          <DialogDescription>
            A pessoa recebe um convite e entra como contratada quando aceitar.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="sr-only">Projeto</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary">
            <input
              type="radio"
              name="target"
              value="new"
              checked={target === "new"}
              onChange={() => setTarget("new")}
              className="mt-1"
            />
            <span>
              <span className="block font-medium">Novo projeto "{call.title}"</span>
              <span className="block text-xs text-muted-foreground">
                Corporativo{call.nda ? ", com NDA ligado" : ""}, com você como diretor.
              </span>
            </span>
          </label>
          {projects.map((project) => (
            <label
              key={project.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="target"
                value={project.id}
                checked={target === String(project.id)}
                onChange={() => setTarget(String(project.id))}
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{project.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {project.id === suggestedProjectId
                    ? "Criado por esta Chamada"
                    : "Projeto corporativo que você dirige"}
                  {project.ndaEnabled ? " · NDA" : ""}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy}
            className="gradient-primary text-primary-foreground"
          >
            {busy ? "Convidando..." : "Enviar convite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

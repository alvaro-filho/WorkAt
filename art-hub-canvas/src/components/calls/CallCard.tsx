import { Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, Lock, MapPin, Wallet } from "lucide-react";

import { UserAvatar } from "@/components/posts/PostCard";
import type { JobCall } from "@/lib/api";
import {
  CALL_STATUS_LABEL,
  closesLabel,
  formatLabel,
  INTEREST_STATUS_LABEL,
  locationLabel,
  payLabel,
  roleLabel,
} from "@/lib/call-labels";

/** Chamada na lista: estúdio, título, função, formato, onde, pagamento (se houver), prazo e NDA. */
export function CallCard({ call }: { call: JobCall }) {
  const pay = payLabel(call);
  return (
    <li>
      <Link
        to="/chamadas/$callId"
        params={{ callId: String(call.id) }}
        className="block p-4 transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-start gap-3">
          <UserAvatar name={call.author.fullName} src={call.author.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">{call.author.fullName}</span>
              {call.directedProjects > 0 && (
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="size-3.5 text-primary" /> {call.directedProjects}{" "}
                  {call.directedProjects === 1 ? "projeto dirigido" : "projetos dirigidos"}
                </span>
              )}
            </p>
            <h3 className="mt-0.5 text-[17px] leading-6 font-bold">{call.title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                {roleLabel(call.role)}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5">
                {formatLabel(call.format)}
              </span>
              {call.nda && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
                  <Lock className="size-3" /> NDA
                </span>
              )}
              {call.status !== "OPEN" && (
                <span className="rounded-full border border-border px-2 py-0.5 text-muted-foreground">
                  {CALL_STATUS_LABEL[call.status]}
                </span>
              )}
              {call.myInterest && (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                  Você: {INTEREST_STATUS_LABEL[call.myInterest.status]}
                </span>
              )}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {locationLabel(call)}
              </span>
              {pay && (
                <span className="inline-flex items-center gap-1">
                  <Wallet className="size-3.5" /> {pay}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" /> interesse até {closesLabel(call.closesOn)}
              </span>
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

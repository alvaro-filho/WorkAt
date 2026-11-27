import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { ArtImage } from "@/components/art/ArtPieces";
import { UserAvatar } from "@/components/posts/PostCard";
import type { ArtistCard as Artist } from "@/lib/api";
import { availabilityLine } from "@/lib/call-labels";

/**
 * Artista no Explorar e nas sugestões da Chamada: foto, nome, selo, especialidades, a linha de
 * disponibilidade e três trabalhos. action: um botão extra no rodapé (ex.: "Chamar para ver").
 */
export function ArtistCard({ artist, action }: { artist: Artist; action?: ReactNode }) {
  const { user, availability } = artist;
  return (
    <li className="flex flex-col overflow-hidden rounded-2xl border border-border bg-white/[0.02]">
      <div className="grid grid-cols-3 gap-0.5 bg-black/30">
        {Array.from({ length: 3 }, (_, index) => {
          const work = artist.works[index];
          return work ? (
            <Link
              key={work.id}
              to="/publicacao/$postId"
              params={{ postId: String(work.id) }}
              className="block aspect-square overflow-hidden"
              aria-label={`${work.title ?? "Arte"}, de ${user.fullName}`}
            >
              <ArtImage
                src={work.images[0]?.url ?? null}
                title={work.title ?? "Arte"}
                className="size-full object-cover transition-transform duration-300 hover:scale-105"
              />
            </Link>
          ) : (
            <div key={index} className="aspect-square bg-white/[0.03]" aria-hidden="true" />
          );
        })}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          to="/u/$username"
          params={{ username: user.username }}
          className="flex items-center gap-2.5 hover:underline"
        >
          <UserAvatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{user.fullName}</span>
            <span className="block truncate text-xs text-muted-foreground">@{user.username}</span>
          </span>
        </Link>
        {availability && (
          <p className="flex items-start gap-1.5 text-xs text-emerald-300">
            <span
              className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400"
              aria-hidden="true"
            />
            <span>
              Disponível · {availabilityLine(availability)}
              {availability.note && (
                <span className="block text-muted-foreground">{availability.note}</span>
              )}
            </span>
          </p>
        )}
        {artist.specialties.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Especialidades">
            {artist.specialties.slice(0, 4).map((item) => (
              <li key={item} className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px]">
                {item}
              </li>
            ))}
          </ul>
        )}
        {action && <div className="mt-auto pt-1">{action}</div>}
      </div>
    </li>
  );
}

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type LightboxImage = { url: string; alt: string; caption?: string };

/**
 * Imagem em tela cheia, sobre fundo escuro. Setas (ou ← →) passam as imagens, Esc ou clique fora fecha.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  /** null = fechado. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const open = index !== null && images.length > 0;
  const current = open ? images[Math.min(index, images.length - 1)]! : null;
  const many = images.length > 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && many) onIndexChange(((index ?? 0) + 1) % images.length);
      if (event.key === "ArrowLeft" && many)
        onIndexChange(((index ?? 0) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, index, images.length, many, onClose, onIndexChange]);

  if (!open || !current || typeof document === "undefined") return null;

  const go = (step: number) => onIndexChange(((index ?? 0) + step + images.length) % images.length);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.alt}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 p-3 text-sm text-white/80">
        <span className="tabular-nums">{many ? `${(index ?? 0) + 1} / ${images.length}` : ""}</span>
        <button
          type="button"
          aria-label="Fechar (Esc)"
          title="Fechar (Esc)"
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-16">
        <img
          src={current.url}
          alt={current.alt}
          className="max-h-full max-w-full object-contain select-none"
          onClick={(event) => event.stopPropagation()}
          draggable={false}
        />
        {many && (
          <>
            <button
              type="button"
              aria-label="Imagem anterior"
              onClick={(event) => {
                event.stopPropagation();
                go(-1);
              }}
              className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              aria-label="Próxima imagem"
              onClick={(event) => {
                event.stopPropagation();
                go(1);
              }}
              className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
            >
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>
      {current.caption && (
        <p
          className="px-4 pb-4 text-center text-sm text-white/70"
          onClick={(event) => event.stopPropagation()}
        >
          {current.caption}
        </p>
      )}
    </div>,
    document.body,
  );
}

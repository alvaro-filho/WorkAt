import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Enquadramento: ponto da imagem que fica no centro (0 a 1) e o zoom (1 = a imagem cobre o quadro). */
export type Crop = { cx: number; cy: number; zoom: number };

const MAX_ZOOM = 4;
const DEFAULT_CROP: Crop = { cx: 0.5, cy: 0.5, zoom: 1 };

export function parseCrop(value: string | null | undefined): Crop | null {
  if (!value) return null;
  try {
    const data = JSON.parse(value) as Partial<Crop>;
    if ([data.cx, data.cy, data.zoom].every((n) => typeof n === "number" && Number.isFinite(n))) {
      return { cx: data.cx!, cy: data.cy!, zoom: Math.min(MAX_ZOOM, Math.max(1, data.zoom!)) };
    }
  } catch {
    // Enquadramento antigo ou inválido: começa centralizado.
  }
  return null;
}

/**
 * Editor de enquadramento da foto (círculo) e da capa (3:1): arrastar posiciona, o controle (ou a roda do
 * mouse, ou + e −) dá zoom. Ao salvar, gera a imagem recortada no navegador e devolve também o original.
 */
export function ImageCropDialog({
  open,
  onOpenChange,
  source,
  aspect,
  round = false,
  initial,
  outputWidth,
  title,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Blob | null;
  aspect: number;
  round?: boolean;
  initial?: Crop | null;
  outputWidth: number;
  title: string;
  busy?: boolean;
  onConfirm: (cropped: File, crop: Crop, original: File) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [crop, setCrop] = useState<Crop>(initial ?? DEFAULT_CROP);
  const drag = useRef<{ x: number; y: number; crop: Crop } | null>(null);

  // Carrega a imagem escolhida.
  useEffect(() => {
    if (!source || !open) return;
    const objectUrl = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = objectUrl;
    setUrl(objectUrl);
    setCrop(initial ?? DEFAULT_CROP);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setImage(null);
      setUrl(null);
    };
  }, [source, open, initial]);

  // Largura do quadro na tela (muda com o tamanho da janela).
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setFrameWidth(node.clientWidth));
    observer.observe(node);
    setFrameWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [open, image]);

  const frameHeight = frameWidth / aspect;
  const baseScale = image
    ? Math.max(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight)
    : 1;
  const scale = baseScale * crop.zoom;
  const shownWidth = image ? image.naturalWidth * scale : 0;
  const shownHeight = image ? image.naturalHeight * scale : 0;

  /** Mantém a imagem cobrindo o quadro inteiro (sem sobrar fundo). */
  const clamp = useCallback(
    (next: Crop): Crop => {
      if (!image || !frameWidth) return next;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom));
      const s = baseScale * zoom;
      const halfX = frameWidth / (2 * image.naturalWidth * s);
      const halfY = frameHeight / (2 * image.naturalHeight * s);
      return {
        zoom,
        cx: Math.min(1 - halfX, Math.max(halfX, next.cx)),
        cy: Math.min(1 - halfY, Math.max(halfY, next.cy)),
      };
    },
    [image, frameWidth, frameHeight, baseScale],
  );

  useEffect(() => setCrop((current) => clamp(current)), [clamp]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, crop };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !shownWidth) return;
    const start = drag.current;
    setCrop(
      clamp({
        ...start.crop,
        cx: start.crop.cx - (event.clientX - start.x) / shownWidth,
        cy: start.crop.cy - (event.clientY - start.y) / shownHeight,
      }),
    );
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    setCrop((current) =>
      clamp({ ...current, zoom: current.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08) }),
    );
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 10 / Math.max(1, shownWidth);
    const moves: Record<string, Partial<Crop>> = {
      ArrowLeft: { cx: crop.cx + step },
      ArrowRight: { cx: crop.cx - step },
      ArrowUp: { cy: crop.cy + step },
      ArrowDown: { cy: crop.cy - step },
      "+": { zoom: crop.zoom * 1.1 },
      "=": { zoom: crop.zoom * 1.1 },
      "-": { zoom: crop.zoom / 1.1 },
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setCrop(clamp({ ...crop, ...move }));
    }
  };

  const confirm = async () => {
    if (!image || !source || !frameWidth) return;
    const outWidth = outputWidth;
    const outHeight = Math.round(outputWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    const sw = frameWidth / scale;
    const sh = frameHeight / scale;
    const sx = crop.cx * image.naturalWidth - sw / 2;
    const sy = crop.cy * image.naturalHeight - sh / 2;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return;
    const type = source.type || "image/jpeg";
    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    onConfirm(
      new File([blob], "recorte.jpg", { type: "image/jpeg" }),
      crop,
      source instanceof File ? source : new File([source], `original.${extension}`, { type }),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="border-border bg-card sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Arraste a imagem para escolher a parte que aparece e use o controle para aproximar.
          </DialogDescription>
        </DialogHeader>

        <div
          ref={frame}
          role="application"
          tabIndex={0}
          aria-label="Área de enquadramento: arraste para mover, setas movem, + e − dão zoom"
          className={`relative w-full touch-none overflow-hidden rounded-xl bg-black/60 outline-none select-none focus-visible:ring-2 focus-visible:ring-primary ${
            drag.current ? "cursor-grabbing" : "cursor-grab"
          } ${round ? "mx-auto max-w-[360px]" : ""}`}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
        >
          {url && image && (
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: shownWidth,
                height: shownHeight,
                left: frameWidth / 2 - crop.cx * shownWidth,
                top: frameHeight / 2 - crop.cy * shownHeight,
              }}
            />
          )}
          {/* Máscara: círculo para a foto, moldura para a capa */}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ${round ? "rounded-full" : "rounded-xl"}`}
            style={{
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              outline: "2px solid rgba(255,255,255,0.7)",
            }}
          />
          {!image && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Carregando imagem...
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Afastar"
            onClick={() => setCrop(clamp({ ...crop, zoom: crop.zoom / 1.15 }))}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            <Minus className="size-4" />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={crop.zoom}
            aria-label="Zoom"
            onChange={(e) => setCrop(clamp({ ...crop, zoom: Number(e.target.value) }))}
            className="flex-1 accent-[var(--primary)]"
          />
          <button
            type="button"
            aria-label="Aproximar"
            onClick={() => setCrop(clamp({ ...crop, zoom: crop.zoom * 1.15 }))}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Voltar ao centro"
            title="Voltar ao centro"
            onClick={() => setCrop(clamp(DEFAULT_CROP))}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Move className="size-3.5" /> A imagem inteira fica guardada: dá para reajustar depois.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void confirm()}
            disabled={!image || busy}
            className="gradient-primary text-primary-foreground"
          >
            {busy ? "Salvando..." : "Salvar enquadramento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

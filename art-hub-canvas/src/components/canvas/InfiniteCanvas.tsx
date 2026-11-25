import { useCallback, useEffect, useRef, useState } from "react";
import {
  Hand,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  StickyNote,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

/** Item salvo no Canvas da tarefa (coordenadas do "mundo", independentes de zoom e deslocamento). */
export type CanvasItem =
  | { id: string; type: "note"; x: number; y: number; text: string }
  | { id: string; type: "image"; x: number; y: number; width: number; src: string; name: string };

const MAX_IMAGE_SIDE = 1600;

/** Reduz a imagem no navegador antes de guardar (o Canvas é salvo como JSON no servidor). */
async function fileToItem(file: File, x: number, y: number): Promise<CanvasItem | null> {
  if (!file.type.startsWith("image/")) return null;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const src = canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
  return {
    id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "image",
    x,
    y,
    width: Math.min(360, canvas.width),
    src,
    name: file.name,
  };
}

export function InfiniteCanvas({
  contextLabel,
  items,
  canEdit,
  onChange,
  statusText,
}: {
  contextLabel: string;
  items: CanvasItem[];
  canEdit: boolean;
  onChange: (items: CanvasItem[]) => void;
  statusText?: string | undefined;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<
    | { kind: "item"; id: string; startX: number; startY: number; itemX: number; itemY: number }
    | { kind: "pan"; startX: number; startY: number; offsetX: number; offsetY: number }
    | null
  >(null);

  /** Ponto da tela convertido para coordenadas do Canvas. */
  const toWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = areaRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - offset.x) / zoom,
        y: (clientY - rect.top - offset.y) / zoom,
      };
    },
    [offset, zoom],
  );

  const center = () => {
    const rect = areaRef.current?.getBoundingClientRect();
    // Cada item novo cai um pouco deslocado, para não ficar exatamente em cima do anterior.
    const step = (items.length % 8) * 28;
    return rect
      ? toWorld(rect.left + rect.width / 2 - 120 + step, rect.top + rect.height / 2 - 80 + step)
      : { x: 80 + step, y: 80 + step };
  };

  const addImages = async (files: File[], at?: { x: number; y: number }) => {
    if (!canEdit) return;
    const origin = at ?? center();
    const created = (
      await Promise.all(
        files.map((file, index) => fileToItem(file, origin.x + index * 40, origin.y + index * 40)),
      )
    ).filter((item): item is CanvasItem => item !== null);
    if (created.length) onChange([...items, ...created]);
  };

  const addNote = () => {
    if (!canEdit) return;
    const at = center();
    const note: CanvasItem = {
      id: `note-${Date.now()}`,
      type: "note",
      x: at.x,
      y: at.y,
      text: "",
    };
    onChange([...items, note]);
    setSelected(note.id);
    setEditingNote(note.id);
  };

  const updateItem = (id: string, patch: Partial<CanvasItem>) =>
    onChange(items.map((item) => (item.id === id ? ({ ...item, ...patch } as CanvasItem) : item)));

  const removeSelected = useCallback(() => {
    if (!canEdit || !selected) return;
    onChange(items.filter((item) => item.id !== selected));
    setSelected(null);
  }, [canEdit, selected, items, onChange]);

  // Colar imagem (Ctrl+V) e apagar com Delete, como no PureRef.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length) {
        event.preventDefault();
        void addImages(files);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (editingNote) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
    };
  });

  const onPointerMove = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    if (current.kind === "pan") {
      setOffset({
        x: current.offsetX + event.clientX - current.startX,
        y: current.offsetY + event.clientY - current.startY,
      });
    } else {
      const dx = (event.clientX - current.startX) / zoom;
      const dy = (event.clientY - current.startY) / zoom;
      const id = current.id;
      // Atualiza só na tela durante o arraste; salva ao soltar.
      setLocalPositions((prev) => ({
        ...prev,
        [id]: { x: current.itemX + dx, y: current.itemY + dy },
      }));
    }
  };

  const [localPositions, setLocalPositions] = useState<Record<string, { x: number; y: number }>>(
    {},
  );

  const onPointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current?.kind === "item") {
      const position = localPositions[current.id];
      if (position) updateItem(current.id, position);
      setLocalPositions({});
    }
  };

  const zoomBy = (factor: number) => setZoom((value) => Math.min(3, Math.max(0.2, value * factor)));

  const selectedItem = items.find((item) => item.id === selected) ?? null;

  return (
    <div
      className={`relative h-[calc(100vh-11rem)] overflow-hidden rounded-2xl border bg-[oklch(0.17_0.02_265)] ${
        dropActive ? "border-primary" : "border-border"
      }`}
    >
      <div
        ref={areaRef}
        role="application"
        aria-label="Canvas infinito de referências"
        className="dot-grid absolute inset-0 touch-none"
        style={{
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${offset.x}px ${offset.y}px`,
          cursor: drag.current?.kind === "pan" ? "grabbing" : "grab",
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          setSelected(null);
          setEditingNote(null);
          drag.current = {
            kind: "pan",
            startX: event.clientX,
            startY: event.clientY,
            offsetX: offset.x,
            offsetY: offset.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={(event) => {
          // Ctrl + roda (ou pinça no trackpad) dá zoom; a roda sozinha desloca.
          if (event.ctrlKey || event.metaKey) {
            zoomBy(event.deltaY < 0 ? 1.1 : 0.9);
          } else {
            setOffset((value) => ({ x: value.x - event.deltaX, y: value.y - event.deltaY }));
          }
        }}
        onDragOver={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDropActive(false);
          void addImages(
            Array.from(event.dataTransfer.files),
            toWorld(event.clientX, event.clientY),
          );
        }}
      >
        <div
          className="pointer-events-none absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          {items.map((item) => {
            const position = localPositions[item.id] ?? { x: item.x, y: item.y };
            const isSelected = selected === item.id;
            return (
              <div
                key={item.id}
                className={`pointer-events-auto absolute select-none ${canEdit ? "cursor-move" : ""} ${
                  isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-transparent" : ""
                } rounded-lg`}
                style={{ left: position.x, top: position.y }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setSelected(item.id);
                  if (!canEdit || editingNote === item.id) return;
                  drag.current = {
                    kind: "item",
                    id: item.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    itemX: item.x,
                    itemY: item.y,
                  };
                  areaRef.current?.setPointerCapture(event.pointerId);
                }}
                onDoubleClick={() => canEdit && item.type === "note" && setEditingNote(item.id)}
              >
                {item.type === "note" ? (
                  editingNote === item.id ? (
                    <textarea
                      autoFocus
                      aria-label="Texto da nota"
                      defaultValue={item.text}
                      placeholder="Escreva a nota..."
                      onBlur={(event) => {
                        updateItem(item.id, { text: event.target.value });
                        setEditingNote(null);
                      }}
                      className="h-32 w-48 resize-none rounded-lg bg-[oklch(0.86_0.15_95)] p-3 text-sm text-[oklch(0.25_0.05_95)] shadow-lg outline-none"
                    />
                  ) : (
                    <div className="min-h-12 w-48 rounded-lg bg-[oklch(0.86_0.15_95)] p-3 text-sm whitespace-pre-wrap text-[oklch(0.25_0.05_95)] shadow-lg">
                      {item.text || <span className="opacity-50">Nota vazia (duplo clique)</span>}
                    </div>
                  )
                ) : (
                  <img
                    src={item.src}
                    alt={item.name}
                    draggable={false}
                    style={{ width: item.width }}
                    className="block max-w-none rounded-lg shadow-lg"
                  />
                )}
              </div>
            );
          })}
        </div>

        {items.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
            <div className="max-w-sm text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Canvas vazio</p>
              <p className="mt-1">
                {canEdit
                  ? "Arraste imagens do computador para cá, cole com Ctrl+V ou use a barra abaixo. Arraste o fundo para navegar e use Ctrl + roda para dar zoom."
                  : "Ainda não há referências nesta tarefa."}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="glass pointer-events-none absolute top-4 left-4 max-w-[60%] truncate rounded-xl px-3 py-2 text-xs text-muted-foreground">
        {contextLabel}
      </div>
      {statusText && (
        <div
          role="status"
          className="glass pointer-events-none absolute top-4 right-4 rounded-xl px-3 py-2 text-xs text-muted-foreground"
        >
          {statusText}
        </div>
      )}

      <div className="glass absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Navegar"
          title="Arraste o fundo para navegar"
        >
          <Hand className="size-4" />
        </Button>
        {canEdit && (
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Adicionar imagem"
              title="Adicionar imagem"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Nota adesiva"
              title="Nota adesiva"
              onClick={addNote}
            >
              <StickyNote className="size-4" />
            </Button>
          </>
        )}
        {canEdit && selectedItem?.type === "image" && (
          <>
            <span className="mx-1 h-6 w-px bg-border" />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Diminuir imagem"
              title="Diminuir imagem"
              onClick={() =>
                updateItem(selectedItem.id, { width: Math.max(80, selectedItem.width * 0.8) })
              }
            >
              <Minimize2 className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Aumentar imagem"
              title="Aumentar imagem"
              onClick={() =>
                updateItem(selectedItem.id, { width: Math.min(1600, selectedItem.width * 1.25) })
              }
            >
              <Maximize2 className="size-4" />
            </Button>
          </>
        )}
        {canEdit && selectedItem && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Apagar item selecionado"
            title="Apagar (Delete)"
            onClick={removeSelected}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <span className="mx-1 h-6 w-px bg-border" />
        <Button size="icon" variant="ghost" aria-label="Diminuir zoom" onClick={() => zoomBy(0.9)}>
          <Minus className="size-4" />
        </Button>
        <button
          type="button"
          className="w-12 text-center text-xs text-muted-foreground hover:text-foreground"
          title="Voltar ao 100%"
          onClick={() => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button size="icon" variant="ghost" aria-label="Aumentar zoom" onClick={() => zoomBy(1.1)}>
          <Plus className="size-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          className="sr-only"
          aria-label="Escolher imagens de referência"
          onChange={(event) => {
            void addImages(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Imagem servida pelo backend (/api/...), buscada com o token: publicações de projeto privado
 * só aparecem para o autor e para quem participa do projeto.
 */
export function ArtImage({
  src,
  title,
  className = "h-48 w-full object-cover",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const fromBackend = Boolean(src?.startsWith("/api/"));

  useEffect(() => {
    if (!src || !fromBackend) return;
    let active = true;
    let created: string | null = null;
    const token = window.localStorage.getItem("authToken");
    fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [src, fromBackend]);

  const finalSrc = fromBackend ? objectUrl : src;
  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 text-sm text-muted-foreground ${className}`}
      >
        Sem imagem
      </div>
    );
  }
  if (!finalSrc) {
    return (
      <div className={`animate-pulse bg-white/5 ${className}`} aria-label={`Carregando ${title}`} />
    );
  }
  return <img src={finalSrc} alt={title} className={className} />;
}

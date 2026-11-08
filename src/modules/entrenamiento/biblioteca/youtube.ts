// Utilidades para los vídeos de ejercicios en YouTube (Shorts verticales).

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Saca el id de 11 caracteres de un enlace de YouTube (shorts, youtu.be, watch, embed) o del id suelto. */
export function idDeYoutube(texto: string): string | null {
  const t = texto.trim();
  if (ID.test(t)) return t;
  let url: URL;
  try {
    url = new URL(t.startsWith('http') ? t : `https://${t}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const partes = url.pathname.split('/').filter(Boolean);
    if (partes[0] === 'shorts' || partes[0] === 'embed' || partes[0] === 'live') id = partes[1] ?? null;
    else if (partes[0] === 'watch') id = url.searchParams.get('v');
  }
  return id && ID.test(id) ? id : null;
}

/** Miniatura pública del vídeo. Para Shorts, YouTube la sirve en 4:3 con el vídeo centrado. */
export function miniatura(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Reproductor sin cookies de seguimiento, sin vídeos relacionados de otros canales. */
export function urlReproductor(id: string): string {
  const p = new URLSearchParams({ rel: '0', playsinline: '1', modestbranding: '1', autoplay: '1', loop: '1', playlist: id });
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
}

export function duracion(segundos: number | null): string {
  if (segundos == null) return '';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Título del vídeo desde YouTube (oEmbed). Si falla, devuelve null y el coach lo escribe. */
export async function tituloDeYoutube(id: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/shorts/${id}`)}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string };
    return j.title?.trim() || null;
  } catch {
    return null;
  }
}

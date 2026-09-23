/**
 * Consigna Beauty — otimização de imagens no navegador (antes do upload).
 *
 * - Redimensiona para caber em 1920x1080 (paisagem) ou 1080x1920 (retrato),
 *   mantendo a proporção e sem ampliar imagens pequenas.
 * - Corrige a orientação EXIF (fotos de celular "deitadas").
 * - Converte para WebP com qualidade ~80%.
 * - Fallback: navegadores que não codificam WebP via canvas (Safari/iOS)
 *   recebem JPEG 80% — continua sendo um ganho enorme sobre PNG/JPEG cru.
 *
 * Sem dependências: usa apenas Canvas API / OffscreenCanvas.
 */

export interface OptimizeImageOptions {
  /** Lado maior máximo (px). Padrão 1920. */
  maxLongSide?: number;
  /** Lado menor máximo (px). Padrão 1080. */
  maxShortSide?: number;
  /** Qualidade 0–1. Padrão 0.8. */
  quality?: number;
  /** Arquivos abaixo deste tamanho que já cabem nas dimensões são devolvidos sem reprocessar. Padrão 150 KB. */
  skipBelowBytes?: number;
  /**
   * Formato usado quando o navegador não gera WebP (Safari/iOS).
   * 'image/jpeg' (padrão) = menor; 'image/png' = preserva transparência (ex.: logos).
   */
  fallbackType?: 'image/jpeg' | 'image/png';
}

export class ImageOptimizationError extends Error {}

const PASSTHROUGH_TYPES = new Set(['image/gif', 'image/svg+xml']);

export async function optimizeImage(file: File, options: OptimizeImageOptions = {}): Promise<File> {
  const {
    maxLongSide = 1920,
    maxShortSide = 1080,
    quality = 0.8,
    skipBelowBytes = 150 * 1024,
    fallbackType = 'image/jpeg',
  } = options;

  if (!file.type.startsWith('image/')) {
    throw new ImageOptimizationError('O arquivo selecionado não é uma imagem.');
  }
  // GIF (pode ser animado) e SVG (vetor) não devem passar por canvas.
  if (PASSTHROUGH_TYPES.has(file.type)) return file;

  const source = await decode(file);
  try {
    const { width: srcW, height: srcH } = source;
    const { width, height } = fitInside(srcW, srcH, maxLongSide, maxShortSide);
    const alreadyFits = width === srcW && height === srcH;

    if (alreadyFits && file.size <= skipBelowBytes && isWebOptimizedType(file.type)) {
      return file;
    }

    let blob = await encode(source, width, height, 'image/webp', quality);

    // Safari/iOS devolve PNG quando não suporta WebP no canvas → usa o formato de fallback.
    if (blob.type !== 'image/webp') {
      blob = await encode(source, width, height, fallbackType, quality);
    }

    // Se o resultado ficou maior e a original já estava no tamanho certo, mantém a original.
    if (alreadyFits && blob.size >= file.size && isWebOptimizedType(file.type)) {
      return file;
    }

    const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
    return new File([blob], replaceExtension(file.name, ext), {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    if ('close' in source && typeof source.close === 'function') source.close();
  }
}

/* ---------------------------------------------------------------- helpers */

type Drawable = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* cai para <img> abaixo */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode(); // navegadores modernos aplicam EXIF automaticamente em <img>
    return img;
  } catch {
    throw new ImageOptimizationError(
      'Não foi possível ler esta imagem. Formatos como HEIC podem não ser suportados neste navegador — tente JPG ou PNG.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function fitInside(w: number, h: number, maxLong: number, maxShort: number) {
  const landscape = w >= h;
  const maxW = landscape ? maxLong : maxShort;
  const maxH = landscape ? maxShort : maxLong;
  const scale = Math.min(1, maxW / w, maxH / h); // nunca amplia
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function encode(
  source: Drawable,
  width: number,
  height: number,
  type: 'image/webp' | 'image/jpeg' | 'image/png',
  quality: number,
): Promise<Blob> {
  const opaque = type === 'image/jpeg'; // JPEG não tem alpha: pinta fundo branco

  if (typeof OffscreenCanvas !== 'undefined' && source instanceof ImageBitmap) {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { alpha: !opaque });
    if (!ctx) throw new ImageOptimizationError('Canvas indisponível.');
    draw(ctx, source, width, height, opaque);
    return canvas.convertToBlob({ type, quality });
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: !opaque });
  if (!ctx) throw new ImageOptimizationError('Canvas indisponível.');
  draw(ctx, source, width, height, opaque);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new ImageOptimizationError('Falha ao comprimir a imagem.'))),
      type,
      quality,
    ),
  );
}

function draw(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: Drawable,
  width: number,
  height: number,
  opaque: boolean,
) {
  if (opaque) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
}

function isWebOptimizedType(type: string) {
  return type === 'image/webp' || type === 'image/jpeg';
}

function replaceExtension(name: string, ext: string) {
  const base = name.replace(/\.[^./\\]+$/, '') || 'imagem';
  return `${base}.${ext}`;
}

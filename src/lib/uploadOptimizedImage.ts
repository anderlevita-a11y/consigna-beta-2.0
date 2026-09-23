import { supabase } from './supabase';
import { optimizeImage, type OptimizeImageOptions } from './imageOptimizer';

export interface UploadOptimizedImageOptions {
  /** Bucket do Supabase Storage (ex.: 'products'). */
  bucket: string;
  /** Pasta dentro do bucket (ex.: 'product-photos', 'store-settings', `reviews/${userId}`). */
  folder: string;
  /** Prefixo opcional do nome do arquivo (ex.: 'logo', 'banner', 'insta-0'). */
  prefix?: string;
  /** Ajustes de otimização (padrão: 1920x1080, WebP 80%). */
  optimize?: OptimizeImageOptions;
}

export interface UploadOptimizedImageResult {
  path: string;
  publicUrl: string;
  bytesBefore: number;
  bytesAfter: number;
}

/**
 * Otimiza a imagem no navegador (redimensiona + WebP ~80%) e envia ao Supabase Storage.
 * Devolve o caminho e a URL pública do arquivo enviado.
 */
export async function uploadOptimizedImage(
  file: File,
  { bucket, folder, prefix, optimize }: UploadOptimizedImageOptions,
): Promise<UploadOptimizedImageResult> {
  const optimized = await optimizeImage(file, optimize);
  const ext = optimized.name.split('.').pop()?.toLowerCase() || 'webp';
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const name = prefix ? `${prefix}-${id}` : id;
  const path = `${folder.replace(/\/+$/, '')}/${name}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, optimized, {
    contentType: optimized.type,
    cacheControl: '31536000', // nome único → cache de 1 ano
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  if (import.meta.env.DEV) {
    console.info(
      `[upload] ${file.name}: ${(file.size / 1024).toFixed(0)} KB → ${(optimized.size / 1024).toFixed(0)} KB (${optimized.type})`,
    );
  }

  return { path, publicUrl: data.publicUrl, bytesBefore: file.size, bytesAfter: optimized.size };
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
export const supabaseBucket = (process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'private-world-media').trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && supabaseBucket);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function uploadMedia(
  uri: string,
  objectPath: string,
  onProgress?: (value: number) => void,
): Promise<string> {
  if (!supabase) throw new Error('Supabase media storage is not configured.');

  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read the selected file (${response.status}).`);
  const blob = await response.blob();
  onProgress?.(0);

  const { error } = await supabase.storage.from(supabaseBucket).upload(objectPath, blob, {
    contentType: blob.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) throw new Error(`Media upload failed: ${error.message}`);

  onProgress?.(1);
  return supabase.storage.from(supabaseBucket).getPublicUrl(objectPath).data.publicUrl;
}

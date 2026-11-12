import { supabase } from './supabase';

const BUCKET = 'media';

const SAFE = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'file';

/** Build the owner-scoped object path (folder = user id, which the storage RLS policy checks). Pure. */
export function mediaPath(userId: string, name: string, now = Date.now(), rand = Math.random().toString(36).slice(2, 8)): string {
  return `${userId}/${now}-${rand}-${SAFE(name)}`;
}

/** Upload to the public `media` bucket and return a public URL that muapi and the web renderer can read. */
export async function uploadMedia(blob: Blob, name: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const path = mediaPath(user.id, name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || undefined, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

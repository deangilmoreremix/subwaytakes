import { supabase } from './supabase';

// its own bucket in a shared project (BYOK); the credits mode keeps the older `media` bucket
export const BUCKET = import.meta.env.VITE_BILLING_MODE === 'credits' ? 'media' : 'subwaytakes-media';

const SAFE = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || 'file';

/** 128 random bits as hex. Files in the bucket are readable by anyone with the exact URL (muapi and the exporter need that), so the name is the secret: it must not be guessable. */
export function randomToken(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

/** Build the owner-scoped object path (folder = user id, which the storage RLS policy checks). Pure apart from the default random token. */
export function mediaPath(userId: string, name: string, now = Date.now(), rand = randomToken()): string {
  return `${userId}/${now}-${rand}-${SAFE(name)}`;
}

/** Upload to the public media bucket and return a public URL that muapi and the web renderer can read. */
export async function uploadMedia(blob: Blob, name: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const path = mediaPath(user.id, name);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || undefined, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

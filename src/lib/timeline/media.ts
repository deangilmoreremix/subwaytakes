/** Read a video's real duration (seconds) from its metadata. Rejects on error/timeout so callers can fall back. */
export function probeDuration(url: string, timeoutMs = 8000): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const done = (fn: () => void) => { clearTimeout(t); v.removeAttribute('src'); v.load(); fn(); };
    const t = setTimeout(() => done(() => reject(new Error('probe timeout'))), timeoutMs);
    v.preload = 'metadata'; v.muted = true;
    v.onloadedmetadata = () => done(() => (Number.isFinite(v.duration) && v.duration > 0 ? resolve(v.duration) : reject(new Error('no duration'))));
    v.onerror = () => done(() => reject(new Error('probe failed')));
    v.src = url;
  });
}

/** Browser-only helpers that replace the ffmpeg steps in open-genjutsu: frame grabbing and the contact sheet. */

export interface SheetLayout { width: number; height: number; cells: Array<{ x: number; y: number; w: number; h: number; labelY: number }> }

/** Pure: grid for `n` images, `cols` per row, each cell `cell` px wide/high plus a label strip. */
export function contactSheetLayout(n: number, cols = 3, cell = { w: 480, h: 270 }, labelH = 34, pad = 12): SheetLayout {
  const c = Math.max(1, Math.min(cols, n || 1));
  const rows = Math.max(1, Math.ceil(n / c));
  const cells = Array.from({ length: n }, (_, i) => {
    const col = i % c, row = Math.floor(i / c);
    const x = pad + col * (cell.w + pad), y = pad + row * (cell.h + labelH + pad);
    return { x, y: y + labelH, w: cell.w, h: cell.h, labelY: y };
  });
  return { width: pad + c * (cell.w + pad), height: pad + rows * (cell.h + labelH + pad), cells };
}

/** Pure: fit an image of size (iw, ih) inside (w, h) keeping aspect, centred. */
export function containRect(iw: number, ih: number, w: number, h: number): { dx: number; dy: number; dw: number; dh: number } {
  if (!(iw > 0 && ih > 0)) return { dx: 0, dy: 0, dw: w, dh: h };
  const s = Math.min(w / iw, h / ih);
  const dw = Math.round(iw * s), dh = Math.round(ih * s);
  return { dx: Math.round((w - dw) / 2), dy: Math.round((h - dh) / 2), dw, dh };
}

const toBlob = (c: HTMLCanvasElement, q = 0.9) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not encode the image'))), 'image/jpeg', q));

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.playsInline = true;
    const timer = setTimeout(() => reject(new Error('The source video took too long to load.')), 30000);
    v.onloadeddata = () => { clearTimeout(timer); resolve(v); };
    v.onerror = () => { clearTimeout(timer); reject(new Error('The source video could not be loaded (check that it is public and CORS-enabled).')); };
    v.src = url;
  });
}

const seek = (v: HTMLVideoElement, t: number) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Seeking to ${t}s timed out.`)), 15000);
  v.onseeked = () => { clearTimeout(timer); resolve(); };
  v.currentTime = t;
});

/** Grab one JPEG per timestamp (seconds), longest side capped at `maxSide`. */
export async function extractFrames(videoUrl: string, seconds: number[], maxSide = 1280): Promise<Blob[]> {
  const v = await loadVideo(videoUrl);
  try {
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    const g = c.getContext('2d')!;
    const out: Blob[] = [];
    for (const t of seconds) {
      await seek(v, Math.min(Math.max(0, t), Math.max(0, v.duration - 0.05)));
      g.drawImage(v, 0, 0, c.width, c.height);
      out.push(await toBlob(c));
    }
    return out;
  } finally { v.removeAttribute('src'); v.load(); }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i); i.onerror = () => reject(new Error(`Could not load an image for the contact sheet (${url.slice(0, 60)}…).`));
    i.src = url;
  });
}

/** Labelled grid of reference images (what the prompt writer looks at). */
export async function buildContactSheet(items: Array<{ url: string; label: string }>): Promise<Blob> {
  const layout = contactSheetLayout(items.length);
  const imgs = await Promise.all(items.map(i => loadImage(i.url)));
  const c = document.createElement('canvas'); c.width = layout.width; c.height = layout.height;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  g.font = 'bold 20px sans-serif'; g.textBaseline = 'middle';
  items.forEach((it, i) => {
    const cell = layout.cells[i], img = imgs[i];
    g.fillStyle = '#111111'; g.fillText(it.label, cell.x, cell.labelY + 17);
    g.fillStyle = '#e9e9ee'; g.fillRect(cell.x, cell.y, cell.w, cell.h);
    const r = containRect(img.naturalWidth, img.naturalHeight, cell.w, cell.h);
    g.drawImage(img, cell.x + r.dx, cell.y + r.dy, r.dw, r.dh);
  });
  return toBlob(c, 0.88);
}

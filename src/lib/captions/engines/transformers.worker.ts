/// <reference lib="webworker" />
// Runs Whisper (ONNX) through Transformers.js off the main thread so the page stays responsive.
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;

type In = { type: 'run'; model: string; samples: Float32Array; language?: string; device: 'webgpu' | 'wasm' } | { type: 'probe' };
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

let cached: { key: string; asr: unknown } | null = null;

self.onmessage = async (ev: MessageEvent<In>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'probe') { post({ type: 'probe', webgpu: !!(self.navigator as Navigator & { gpu?: unknown }).gpu }); return; }
    const key = `${msg.model}|${msg.device}`;
    if (!cached || cached.key !== key) {
      const files = new Map<string, number>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const asr: any = await (pipeline as any)('automatic-speech-recognition', msg.model, {
        device: msg.device, dtype: msg.device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
        progress_callback: (p: { status: string; file?: string; progress?: number }) => {
          if (p.status === 'progress' && p.file) { files.set(p.file, p.progress ?? 0); const vals = [...files.values()]; post({ type: 'load', percent: vals.reduce((a, b) => a + b, 0) / vals.length }); }
        },
      });
      cached = { key, asr };
    }
    post({ type: 'transcribing' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any = await (cached.asr as any)(msg.samples, { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, ...(msg.language ? { language: msg.language, task: 'transcribe' } : {}) });
    post({ type: 'done', chunks: out.chunks ?? [], text: out.text ?? '' });
  } catch (e) { post({ type: 'error', message: e instanceof Error ? e.message : String(e) }); }
};

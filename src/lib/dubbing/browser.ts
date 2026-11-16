import * as client from '../muapi/client';
import * as jobs from '../muapi/jobs';
import { uploadMedia } from '../storage';
import { prepareAudio } from '../audio/prepare';
import type { DubDeps } from './pipeline';

/** Real dependencies for the browser: the gateway client, clip_jobs, and padding the new voice to the clip length. */
export const defaultDubDeps: DubDeps = {
  runModel: client.runModel,
  createJob: jobs.createJob,
  patchJob: jobs.patchJob,
  fitAudio: async (url, seconds) => { const a = await prepareAudio(url, seconds); return uploadMedia(a.blob, 'dub-voice.wav'); },
};

import { isSafeExternalHttpUrl } from "./muapi.ts";

/**
 * Minimal structural validator for the studio project JSONB, mirroring
 * src/studio/types.ts (which the edge runtime cannot import).
 *
 * It deliberately checks only what the renderer needs: tracks/clips with valid
 * ids, timeline positions and trims, http(s) asset URLs, timed captions, and a
 * branding block.
 */

export interface ProjectValidationResult {
  ok: boolean;
  errors: string[];
  /** The validated project JSON (same object reference when ok). */
  project?: Record<string, unknown>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateClips(
  track: Record<string, unknown>,
  trackIndex: number,
  errors: string[],
): void {
  if (!Array.isArray(track.clips)) {
    errors.push(`tracks[${trackIndex}].clips must be an array`);
    return;
  }

  track.clips.forEach((rawClip, clipIndex) => {
    const path = `tracks[${trackIndex}].clips[${clipIndex}]`;
    if (!rawClip || typeof rawClip !== "object") {
      errors.push(`${path} must be an object`);
      return;
    }
    const clip = rawClip as Record<string, unknown>;

    if (typeof clip.id !== "string" || clip.id.trim().length === 0) {
      errors.push(`${path}.id must be a non-empty string`);
    }
    if (typeof clip.assetUrl !== "string") {
      errors.push(`${path}.assetUrl must be a string`);
    } else if (!isSafeExternalHttpUrl(clip.assetUrl)) {
      errors.push(`${path}.assetUrl must be an http(s) URL (got "${clip.assetUrl}")`);
    }
    if (!isFiniteNumber(clip.start) || clip.start < 0) {
      errors.push(`${path}.start must be a number >= 0`);
    }
    if (!isFiniteNumber(clip.trimStart) || clip.trimStart < 0) {
      errors.push(`${path}.trimStart must be a number >= 0`);
    }
    if (!isFiniteNumber(clip.trimEnd)) {
      errors.push(`${path}.trimEnd must be a number`);
    } else if (isFiniteNumber(clip.trimStart) && clip.trimEnd <= clip.trimStart) {
      errors.push(`${path}.trimEnd (${clip.trimEnd}) must be greater than trimStart (${clip.trimStart})`);
    }
  });
}

function validateCaptions(captions: unknown, errors: string[]): void {
  if (!Array.isArray(captions)) {
    errors.push("captions must be an array");
    return;
  }
  captions.forEach((rawCaption, index) => {
    const path = `captions[${index}]`;
    if (!rawCaption || typeof rawCaption !== "object") {
      errors.push(`${path} must be an object`);
      return;
    }
    const caption = rawCaption as Record<string, unknown>;
    if (typeof caption.text !== "string") {
      errors.push(`${path}.text must be a string`);
    }
    if (!isFiniteNumber(caption.start) || caption.start < 0) {
      errors.push(`${path}.start must be a number >= 0`);
    }
    if (!isFiniteNumber(caption.end)) {
      errors.push(`${path}.end must be a number`);
    } else if (isFiniteNumber(caption.start) && caption.end <= caption.start) {
      errors.push(`${path}.end must be greater than start`);
    }
  });
}

export function validateProjectForRender(input: unknown): ProjectValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["project must be an object"] };
  }
  const project = input as Record<string, unknown>;

  if (!Array.isArray(project.tracks)) {
    errors.push("project.tracks must be an array");
  } else {
    let clipCount = 0;
    project.tracks.forEach((rawTrack, index) => {
      const path = `tracks[${index}]`;
      if (!rawTrack || typeof rawTrack !== "object") {
        errors.push(`${path} must be an object`);
        return;
      }
      const track = rawTrack as Record<string, unknown>;
      validateClips(track, index, errors);
      if (Array.isArray(track.clips)) clipCount += track.clips.length;
    });
    if (clipCount === 0) {
      errors.push("project has no clips to render");
    }
  }

  validateCaptions(project.captions, errors);

  const branding = project.branding;
  if (!branding || typeof branding !== "object") {
    errors.push("project.branding must be an object");
  } else if (typeof (branding as Record<string, unknown>).watermarkText !== "string") {
    errors.push("project.branding.watermarkText must be a string");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, errors: [], project };
}

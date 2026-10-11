/**
 * Remotion bridge entry for the render worker.
 *
 * WHY THIS EXISTS: the repo's remotion/src/Root.tsx imports the studio
 * composition with a wrong relative path:
 *
 *   import { SubwayEditorComposition } from "../src/studio/SubwayEditorComposition";
 *
 * From remotion/src/Root.tsx that resolves to remotion/src/studio/... which
 * does not exist — `remotion render remotion/src/index.ts <any-composition>`
 * therefore fails at BUNDLE time for every composition in this repo snapshot
 * (verified: `npx remotion compositions remotion/src/index.ts` fails the same
 * way). remotion/src/Root.tsx is owned by another agent and MUST NOT be
 * modified by the worker, so this bridge registers the exact same
 * "SubwayEditor" composition (same component, same calculateMetadata
 * semantics as Root.tsx) and imports it by its correct path.
 *
 * Once Root.tsx is fixed, switch back without touching render code:
 *   REMOTION_ENTRY=remotion/src/index.ts
 */
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import {
  SubwayEditorComposition,
  projectDurationInFrames,
} from '../../src/studio/SubwayEditorComposition';
import { parseProject, createEmptyProject } from '../../src/studio/types';
import type { StudioProject } from '../../src/studio/types';

const defaultEditorProject: StudioProject = createEmptyProject(
  'render-worker-default',
  'Subway Interview Studio',
);

const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SubwayEditor"
      component={SubwayEditorComposition}
      durationInFrames={projectDurationInFrames(defaultEditorProject)}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ project: defaultEditorProject }}
      calculateMetadata={({ props }) => {
        const parsed = parseProject((props as { project?: unknown }).project);
        const project = parsed.ok && parsed.project ? parsed.project : defaultEditorProject;
        return {
          durationInFrames: projectDurationInFrames(project),
          fps: project.fps,
          width: project.width,
          height: project.height,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);

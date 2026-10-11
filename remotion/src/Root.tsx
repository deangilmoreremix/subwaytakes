import { Composition } from "remotion";
import { SubwayTakesDemo } from "./SubwayTakesDemo";
import { SubwayTakesOverlay } from "./SubwayTakesOverlay";
import type { SubwayTakesOverlayProps } from "./SubwayTakesOverlay";
import { SubwayEditorComposition, projectDurationInFrames } from "../src/studio/SubwayEditorComposition";
import { parseProject, createEmptyProject } from "../src/studio/types";
import type { StudioProject } from "../src/studio/types";

const defaultOverlayProps: SubwayTakesOverlayProps = {
  episodeNumber: 634,
  hookQuestion: "If you come from a crazy family, dont make your partner meet them!!",
  handle: "@subwaytakes",
  captions: [
    { text: "Episode title", startFrame: 0, endFrame: 240, type: "title" as const },
    { text: "100% agree.", startFrame: 240, endFrame: 420, type: "reaction" as const },
  ],
  watermarkText: "@subwaytakes",
  watermarkPosition: "top-left",
  progressBarEnabled: true,
  progressBarColor: "#F59E0B",
};

const defaultEditorProject: StudioProject = createEmptyProject("demo-editor-project", "Subway Interview Studio");

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SubwayTakesDemo"
        component={SubwayTakesDemo}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{}}
      />
      <Composition
        id="SubwayTakesOverlay"
        component={SubwayTakesOverlay}
        durationInFrames={1080}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultOverlayProps}
      />
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
    </>
  );
};

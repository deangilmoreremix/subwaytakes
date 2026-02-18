import { Composition } from "remotion";
import { SubwayTakesDemo } from "./SubwayTakesDemo";
import { SubwayTakesOverlay } from "./SubwayTakesOverlay";
import type { SubwayTakesOverlayProps } from "./SubwayTakesOverlay";

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
    </>
  );
};

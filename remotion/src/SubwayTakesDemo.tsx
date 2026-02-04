import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TitleScene } from "./scenes/TitleScene";
import { ClipTypesScene } from "./scenes/ClipTypesScene";
import { AppShowcaseScene } from "./scenes/AppShowcaseScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { OutroScene } from "./scenes/OutroScene";

export const SubwayTakesDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene timings (in frames at 30fps)
  const titleEnd = 150; // 5 seconds
  const clipTypesEnd = 570; // 19 seconds total (14s for clip types)
  const appShowcaseEnd = 900; // 30 seconds total (11s for app showcase)
  const featuresEnd = 1500; // 50 seconds total (20s for features)
  const outroEnd = 1800; // 60 seconds total (10s for outro)

  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      {/* Title Scene */}
      {frame < titleEnd && <TitleScene frame={frame} fps={fps} />}

      {/* Clip Types Scene */}
      {frame >= titleEnd && frame < clipTypesEnd && (
        <ClipTypesScene frame={frame - titleEnd} fps={fps} />
      )}

      {/* App Showcase Scene */}
      {frame >= clipTypesEnd && frame < appShowcaseEnd && (
        <AppShowcaseScene frame={frame - clipTypesEnd} fps={fps} />
      )}

      {/* Features Scene */}
      {frame >= appShowcaseEnd && frame < featuresEnd && (
        <FeaturesScene frame={frame - appShowcaseEnd} fps={fps} />
      )}

      {/* Outro Scene */}
      {frame >= featuresEnd && frame < outroEnd && (
        <OutroScene frame={frame - featuresEnd} fps={fps} />
      )}
    </AbsoluteFill>
  );
};

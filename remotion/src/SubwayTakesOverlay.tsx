import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, OffthreadVideo } from "remotion";
import { BrandWatermark } from "./overlays/BrandWatermark";
import { EpisodeTitleCard } from "./overlays/EpisodeTitleCard";
import { ReactionCaption } from "./overlays/ReactionCaption";
import { ProgressBar } from "./overlays/ProgressBar";

interface CaptionEntry {
  text: string;
  startFrame: number;
  endFrame: number;
  type: "title" | "reaction" | "dialogue";
}

export interface SubwayTakesOverlayProps {
  videoSrc?: string;
  episodeNumber?: number;
  hookQuestion?: string;
  handle?: string;
  captions?: CaptionEntry[];
  watermarkText?: string;
  watermarkPosition?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  watermarkFontSize?: number;
  watermarkOpacity?: number;
  showLogo?: boolean;
  captionFontSize?: number;
  captionBgOpacity?: number;
  reactionFontSize?: number;
  reactionPosition?: "bottom-right" | "bottom-left" | "bottom-center";
  progressBarEnabled?: boolean;
  progressBarColor?: string;
}

export const SubwayTakesOverlay: React.FC<SubwayTakesOverlayProps> = ({
  videoSrc,
  episodeNumber,
  hookQuestion = "",
  handle = "@subwaytakes",
  captions = [],
  watermarkText = "@subwaytakes",
  watermarkPosition = "top-left",
  watermarkFontSize = 18,
  watermarkOpacity = 0.85,
  showLogo = true,
  captionFontSize = 40,
  captionBgOpacity = 0.6,
  reactionFontSize = 28,
  reactionPosition = "bottom-right",
  progressBarEnabled = true,
  progressBarColor = "#F59E0B",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleCaptions = captions.filter((c) => c.type === "title");
  const reactionCaptions = captions.filter((c) => c.type === "reaction");

  const titleShowFrom = titleCaptions.length > 0 ? titleCaptions[0].startFrame : 0;
  const titleShowUntil =
    titleCaptions.length > 0
      ? titleCaptions[titleCaptions.length - 1].endFrame
      : Math.min(fps * 8, durationInFrames);

  const currentReaction = reactionCaptions.find(
    (c) => frame >= c.startFrame && frame < c.endFrame
  );

  return (
    <AbsoluteFill>
      {videoSrc && (
        <OffthreadVideo
          src={videoSrc}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}

      {!videoSrc && (
        <AbsoluteFill
          style={{
            background: "linear-gradient(180deg, #18181b 0%, #27272a 50%, #18181b 100%)",
          }}
        />
      )}

      {progressBarEnabled && (
        <ProgressBar frame={frame} color={progressBarColor} />
      )}

      <BrandWatermark
        frame={frame}
        fps={fps}
        text={watermarkText}
        position={watermarkPosition}
        fontSize={watermarkFontSize}
        opacity={watermarkOpacity}
        showLogo={showLogo}
      />

      {hookQuestion && (
        <EpisodeTitleCard
          frame={frame}
          fps={fps}
          episodeNumber={episodeNumber}
          hookQuestion={hookQuestion}
          handle={handle}
          fontSize={captionFontSize}
          bgOpacity={captionBgOpacity}
          showFrom={titleShowFrom}
          showUntil={titleShowUntil}
        />
      )}

      {currentReaction && (
        <ReactionCaption
          frame={frame}
          fps={fps}
          text={currentReaction.text}
          position={reactionPosition}
          fontSize={reactionFontSize}
          showFrom={currentReaction.startFrame}
          showUntil={currentReaction.endFrame}
        />
      )}
    </AbsoluteFill>
  );
};

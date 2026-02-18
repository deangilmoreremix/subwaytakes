import React from "react";
import { interpolate, spring } from "remotion";

interface EpisodeTitleCardProps {
  frame: number;
  fps: number;
  episodeNumber?: number;
  hookQuestion: string;
  handle?: string;
  fontSize?: number;
  bgOpacity?: number;
  showFrom?: number;
  showUntil?: number;
}

export const EpisodeTitleCard: React.FC<EpisodeTitleCardProps> = ({
  frame,
  fps,
  episodeNumber,
  hookQuestion,
  handle = "@subwaytakes",
  fontSize = 40,
  bgOpacity = 0.6,
  showFrom = 0,
  showUntil = Infinity,
}) => {
  const localFrame = frame - showFrom;
  const isVisible = frame >= showFrom && frame < showUntil;

  if (!isVisible) return null;

  const fadeIn = interpolate(localFrame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });

  const slideUp = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 80, mass: 1.2 },
  });

  const fadeOut =
    showUntil !== Infinity
      ? interpolate(
          frame,
          [showUntil - fps * 0.3, showUntil],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 1;

  const titleText = episodeNumber
    ? `${handle} Episode ${episodeNumber}: ${hookQuestion}`
    : `${handle} ${hookQuestion}`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 0,
        right: 0,
        padding: "0 24px",
        opacity: fadeIn * fadeOut,
        transform: `translateY(${30 * (1 - slideUp)}px)`,
        zIndex: 10,
      }}
    >
      <div
        style={{
          background: `rgba(0, 0, 0, ${bgOpacity})`,
          backdropFilter: "blur(12px)",
          borderRadius: 16,
          padding: "20px 24px",
        }}
      >
        <p
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize,
            fontWeight: 700,
            color: "#FFFFFF",
            lineHeight: 1.25,
            margin: 0,
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {titleText}
        </p>
      </div>
    </div>
  );
};

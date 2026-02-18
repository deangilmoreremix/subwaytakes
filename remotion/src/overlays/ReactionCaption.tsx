import React from "react";
import { interpolate, spring } from "remotion";

interface ReactionCaptionProps {
  frame: number;
  fps: number;
  text: string;
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  fontSize?: number;
  showFrom?: number;
  showUntil?: number;
}

export const ReactionCaption: React.FC<ReactionCaptionProps> = ({
  frame,
  fps,
  text,
  position = "bottom-right",
  fontSize = 28,
  showFrom = 0,
  showUntil = Infinity,
}) => {
  const localFrame = frame - showFrom;
  const isVisible = frame >= showFrom && frame < showUntil;

  if (!isVisible || !text) return null;

  const popScale = spring({
    frame: localFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
  });

  const fadeIn = interpolate(localFrame, [0, fps * 0.15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const fadeOut =
    showUntil !== Infinity
      ? interpolate(
          frame,
          [showUntil - fps * 0.2, showUntil],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 1;

  const positionStyles: Record<string, React.CSSProperties> = {
    "bottom-right": { bottom: 200, right: 32, textAlign: "right" as const },
    "bottom-left": { bottom: 200, left: 32, textAlign: "left" as const },
    "bottom-center": {
      bottom: 200,
      left: 0,
      right: 0,
      textAlign: "center" as const,
    },
  };

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        padding: "0 24px",
        opacity: fadeIn * fadeOut,
        transform: `scale(${0.8 + 0.2 * popScale})`,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize,
          fontWeight: 700,
          color: "#FFFFFF",
          textShadow:
            "0 2px 6px rgba(0,0,0,0.7), 0 0 20px rgba(0,0,0,0.3)",
        }}
      >
        {text}
      </span>
    </div>
  );
};

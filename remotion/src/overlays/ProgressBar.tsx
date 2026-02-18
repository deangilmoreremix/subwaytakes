import React from "react";
import { useVideoConfig } from "remotion";

interface ProgressBarProps {
  frame: number;
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  frame,
  color = "#F59E0B",
  height = 3,
}) => {
  const { durationInFrames } = useVideoConfig();
  const progress = Math.min(frame / durationInFrames, 1);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height,
        backgroundColor: "rgba(255,255,255,0.1)",
        zIndex: 20,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress * 100}%`,
          backgroundColor: color,
          borderRadius: "0 2px 2px 0",
          transition: "width 0.03s linear",
        }}
      />
    </div>
  );
};

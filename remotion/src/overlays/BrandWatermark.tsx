import React from "react";
import { interpolate, spring } from "remotion";

interface BrandWatermarkProps {
  frame: number;
  fps: number;
  text?: string;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  fontSize?: number;
  opacity?: number;
  showLogo?: boolean;
  logoUrl?: string | null;
  logoWidth?: number;
  logoHeight?: number;
}

export const BrandWatermark: React.FC<BrandWatermarkProps> = ({
  frame,
  fps,
  text = "@subwaytakes",
  position = "top-left",
  fontSize = 18,
  opacity = 0.85,
  showLogo = true,
  logoUrl = null,
  logoWidth = 40,
  logoHeight = 40,
}) => {
  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const slideIn = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const positionStyles: Record<string, React.CSSProperties> = {
    "top-left": { top: 48, left: 32 },
    "top-right": { top: 48, right: 32 },
    "bottom-left": { bottom: 120, left: 32 },
    "bottom-right": { bottom: 120, right: 32 },
  };

  const isLeft = position.includes("left");
  const translateX = isLeft ? -40 * (1 - slideIn) : 40 * (1 - slideIn);

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyles[position],
        display: "flex",
        alignItems: "center",
        gap: 8,
        opacity: fadeIn * opacity,
        transform: `translateX(${translateX}px)`,
        zIndex: 10,
      }}
    >
      {showLogo && (
        logoUrl ? (
          <img
            src={logoUrl}
            style={{
              width: logoWidth,
              height: logoHeight,
              objectFit: "contain",
              borderRadius: 6,
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))",
            }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            🚇
          </div>
        )
      )}
      <span
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize,
          fontWeight: 600,
          color: "#FFFFFF",
          textShadow: "0 1px 4px rgba(0,0,0,0.6), 0 0 12px rgba(0,0,0,0.3)",
          letterSpacing: -0.3,
        }}
      >
        {text}
      </span>
    </div>
  );
};

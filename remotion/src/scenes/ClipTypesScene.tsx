import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  Easing,
} from "remotion";

interface ClipTypesSceneProps {
  frame: number;
  fps: number;
}

const clipTypes = [
  {
    icon: "🧓",
    name: "Wisdom Interview",
    description: "Life advice from 55+",
    color: "#f59e0b",
  },
  {
    icon: "💪",
    name: "Motivational",
    description: "High-energy inspiration",
    color: "#ef4444",
  },
  {
    icon: "🎤",
    name: "Street Interview",
    description: "Man-on-the-street takes",
    color: "#06b6d4",
  },
  {
    icon: "🚇",
    name: "Subway Interview",
    description: "NYC subway hot takes",
    color: "#8b5cf6",
  },
  {
    icon: "🎬",
    name: "Studio Interview",
    description: "Professional podcasts",
    color: "#10b981",
  },
];

export const ClipTypesScene: React.FC<ClipTypesSceneProps> = ({
  frame,
  fps,
}) => {
  // Title animation
  const titleOpacity = interpolate(frame, [0, 20], [0, 1]);
  const titleY = interpolate(frame, [0, 20], [-30, 0]);

  // Animated background waves
  const waveOffset = interpolate(frame, [0, 300], [0, 360]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${waveOffset}deg, #09090b 0%, #18181b 50%, #09090b 100%)`,
      }}
    >
      {/* Animated circles in background */}
      {[0, 1, 2].map((i) => {
        const circleScale = interpolate(
          Math.sin((frame + i * 40) / 30),
          [-1, 1],
          [0.8, 1.2]
        );
        const circleOpacity = interpolate(
          Math.sin((frame + i * 40) / 30),
          [-1, 1],
          [0.05, 0.15]
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 400 + i * 200,
              height: 400 + i * 200,
              borderRadius: "50%",
              border: `2px solid ${clipTypes[i].color}`,
              transform: `translate(-50%, -50%) scale(${circleScale})`,
              opacity: circleOpacity,
            }}
          />
        );
      })}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "80px 60px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: 64,
            fontWeight: "bold",
            color: "white",
            margin: "0 0 60px 0",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          5 Content Modes
        </h2>

        {/* Clip Type Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 30,
            width: "100%",
            maxWidth: "900px",
          }}
        >
          {clipTypes.map((clip, index) => {
            const cardDelay = 30 + index * 20;
            const cardSpring = spring({
              frame: Math.max(0, frame - cardDelay),
              fps,
              config: {
                damping: 100,
                stiffness: 200,
              },
            });

            const cardX = interpolate(cardSpring, [0, 1], [-200, 0]);
            const cardOpacity = interpolate(
              frame,
              [cardDelay, cardDelay + 15],
              [0, 1]
            );

            // Highlight effect when card is focused
            const isFocused =
              frame >= cardDelay + 20 && frame < cardDelay + 50;
            const focusScale = isFocused ? 1.05 : 1;
            const focusBorder = isFocused ? 3 : 1;

            return (
              <div
                key={clip.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 30,
                  padding: "30px 40px",
                  background: `linear-gradient(135deg, ${clip.color}15 0%, rgba(39, 39, 42, 0.5) 100%)`,
                  border: `${focusBorder}px solid ${clip.color}60`,
                  borderRadius: 20,
                  transform: `translateX(${cardX}px) scale(${focusScale})`,
                  opacity: cardOpacity,
                  transition: "transform 0.3s ease",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    fontSize: 80,
                    lineHeight: 1,
                  }}
                >
                  {clip.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontSize: 40,
                      fontWeight: "bold",
                      color: "white",
                      margin: "0 0 10px 0",
                    }}
                  >
                    {clip.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 28,
                      color: "#a1a1aa",
                      margin: 0,
                    }}
                  >
                    {clip.description}
                  </p>
                </div>

                {/* Indicator */}
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: clip.color,
                    opacity: isFocused ? 1 : 0.5,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

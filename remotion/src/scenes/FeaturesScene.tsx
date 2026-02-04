import React from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";

interface FeaturesSceneProps {
  frame: number;
  fps: number;
}

const features = [
  {
    icon: "✨",
    title: "AI-Powered",
    items: ["Keyword to video", "Smart presets", "Auto-optimization"],
  },
  {
    icon: "🎨",
    title: "60+ Effects",
    items: ["Animated captions", "Lower thirds", "Graphics & transitions"],
  },
  {
    icon: "🎯",
    title: "Enhancements",
    items: ["Crowd reactions", "Soundscapes", "Plot twists"],
  },
  {
    icon: "📊",
    title: "Episode Builder",
    items: ["Multi-shot episodes", "Beat scripting", "Auto-stitching"],
  },
];

export const FeaturesScene: React.FC<FeaturesSceneProps> = ({ frame, fps }) => {
  // Title animation
  const titleOpacity = interpolate(frame, [0, 20], [0, 1]);
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #09090b 0%, #18181b 50%, #09090b 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "80px 60px",
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: 64,
            fontWeight: "bold",
            color: "white",
            margin: "0 0 80px 0",
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            textAlign: "center",
          }}
        >
          Powerful Features
        </h2>

        {/* Feature Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 40,
            width: "100%",
            maxWidth: "900px",
          }}
        >
          {features.map((feature, index) => {
            const cardDelay = 30 + index * 25;
            const cardOpacity = interpolate(
              frame,
              [cardDelay, cardDelay + 20],
              [0, 1]
            );
            const cardY = interpolate(
              frame,
              [cardDelay, cardDelay + 20],
              [50, 0]
            );

            return (
              <div
                key={feature.title}
                style={{
                  padding: "40px",
                  background:
                    "linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  borderRadius: 24,
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    fontSize: 60,
                    marginBottom: 20,
                  }}
                >
                  {feature.icon}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "white",
                    margin: "0 0 24px 0",
                  }}
                >
                  {feature.title}
                </h3>

                {/* Items */}
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  {feature.items.map((item, i) => {
                    const itemDelay = cardDelay + 10 + i * 8;
                    const itemOpacity = interpolate(
                      frame,
                      [itemDelay, itemDelay + 10],
                      [0, 1]
                    );

                    return (
                      <li
                        key={item}
                        style={{
                          fontSize: 24,
                          color: "#d4d4d8",
                          marginBottom: 12,
                          opacity: itemOpacity,
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#8b5cf6",
                            flexShrink: 0,
                          }}
                        />
                        {item}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div
          style={{
            marginTop: 80,
            opacity: interpolate(frame, [200, 240], [0, 1]),
          }}
        >
          <div
            style={{
              padding: "24px 48px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              borderRadius: 16,
              fontSize: 32,
              fontWeight: "bold",
              color: "white",
              textAlign: "center",
            }}
          >
            Start Creating Today
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, spring, Easing } from "remotion";

interface AppShowcaseSceneProps {
  frame: number;
  fps: number;
}

const showcaseItems = [
  {
    title: "Dashboard",
    description: "Track your viral hits",
    features: ["Recent clips", "Episode library", "Quick stats"],
    color: "#8b5cf6",
  },
  {
    title: "Create Page",
    description: "Generate videos in seconds",
    features: ["Pick your style", "Enter keywords", "AI does the rest"],
    color: "#06b6d4",
  },
  {
    title: "Effects Library",
    description: "60+ professional effects",
    features: ["Animated captions", "Lower thirds", "Transitions"],
    color: "#f59e0b",
  },
];

export const AppShowcaseScene: React.FC<AppShowcaseSceneProps> = ({
  frame,
  fps,
}) => {
  const titleOpacity = interpolate(frame, [0, 20], [0, 1]);
  const titleY = interpolate(frame, [0, 20], [-40, 0]);

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, #09090b 0%, #18181b 30%, #27272a 50%, #18181b 70%, #09090b 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "60px 60px",
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: 64,
            fontWeight: "bold",
            color: "white",
            margin: "0 0 40px 0",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
          }}
        >
          See It In Action
        </h2>

        {/* Showcase Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 40,
            width: "100%",
            maxWidth: "900px",
          }}
        >
          {showcaseItems.map((item, index) => {
            const itemDelay = 40 + index * 80;
            const itemDuration = 70;

            // Each item animates in, stays, then animates out
            const isActive = frame >= itemDelay && frame < itemDelay + itemDuration;
            const isExiting = frame >= itemDelay + itemDuration && frame < itemDelay + itemDuration + 20;

            let cardOpacity = 0;
            let cardScale = 0.8;
            let cardX = 0;

            if (isActive) {
              cardOpacity = interpolate(
                frame,
                [itemDelay, itemDelay + 15],
                [0, 1]
              );
              cardScale = interpolate(
                frame,
                [itemDelay, itemDelay + 15],
                [0.8, 1],
                {
                  easing: Easing.out(Easing.back(1.5)),
                }
              );
            } else if (isExiting) {
              cardOpacity = interpolate(
                frame,
                [itemDelay + itemDuration, itemDelay + itemDuration + 20],
                [1, 0]
              );
              cardX = interpolate(
                frame,
                [itemDelay + itemDuration, itemDelay + itemDuration + 20],
                [0, -100]
              );
            }

            // Pulsing border effect while active
            const borderWidth = isActive
              ? interpolate(
                  Math.sin((frame - itemDelay) / 8),
                  [-1, 1],
                  [2, 4]
                )
              : 2;

            return (
              <div
                key={item.title}
                style={{
                  padding: "50px",
                  background: `linear-gradient(135deg, ${item.color}20 0%, rgba(39, 39, 42, 0.8) 100%)`,
                  border: `${borderWidth}px solid ${item.color}`,
                  borderRadius: 24,
                  opacity: cardOpacity,
                  transform: `scale(${cardScale}) translateX(${cardX}px)`,
                  boxShadow: isActive
                    ? `0 0 60px ${item.color}60`
                    : "none",
                  transition: "box-shadow 0.3s ease",
                }}
              >
                {/* Icon placeholder - could be replaced with actual screenshots */}
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 16,
                    background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}80 100%)`,
                    marginBottom: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                  }}
                >
                  {index === 0 ? "📊" : index === 1 ? "✨" : "🎨"}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: 44,
                    fontWeight: "bold",
                    color: "white",
                    margin: "0 0 16px 0",
                  }}
                >
                  {item.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontSize: 28,
                    color: "#a1a1aa",
                    margin: "0 0 24px 0",
                  }}
                >
                  {item.description}
                </p>

                {/* Features */}
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {item.features.map((feature, i) => {
                    const featureDelay = itemDelay + 20 + i * 8;
                    const featureOpacity = interpolate(
                      frame,
                      [featureDelay, featureDelay + 10],
                      [0, 1]
                    );

                    return (
                      <li
                        key={feature}
                        style={{
                          fontSize: 24,
                          color: "#d4d4d8",
                          opacity: isActive ? featureOpacity : 0,
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
                            background: item.color,
                            flexShrink: 0,
                          }}
                        />
                        {feature}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Bottom text */}
        <div
          style={{
            marginTop: 60,
            opacity: interpolate(frame, [260, 280], [0, 1]),
          }}
        >
          <p
            style={{
              fontSize: 32,
              color: "#8b5cf6",
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            Everything you need to go viral 🚀
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

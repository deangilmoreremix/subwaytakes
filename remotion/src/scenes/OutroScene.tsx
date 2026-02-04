import React from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";

interface OutroSceneProps {
  frame: number;
  fps: number;
}

export const OutroScene: React.FC<OutroSceneProps> = ({ frame, fps }) => {
  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 200 },
  });

  const logoOpacity = interpolate(frame, [0, 20], [0, 1]);

  // Text animations
  const textOpacity = interpolate(frame, [20, 40], [0, 1]);
  const textY = interpolate(frame, [20, 40], [30, 0]);

  // Gradient rotation
  const gradientRotation = interpolate(frame, [0, 150], [0, 360]);

  // Social handles fade in
  const socialOpacity = interpolate(frame, [60, 80], [0, 1]);

  // CTA animation
  const ctaScale = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { damping: 100, stiffness: 200 },
  });
  const ctaOpacity = interpolate(frame, [100, 120], [0, 1]);

  // Sparkle particles
  const sparkles = Array.from({ length: 30 }, (_, i) => ({
    x: (i * 36 + 50) % 1080,
    y: (i * 64 + 100) % 1920,
    delay: i * 8,
    size: 4 + (i % 3) * 4,
  }));

  return (
    <AbsoluteFill
      style={{
        background: `conic-gradient(from ${gradientRotation}deg at 50% 50%, #09090b 0deg, #1e1b4b 90deg, #09090b 180deg, #1e1b4b 270deg, #09090b 360deg)`,
        overflow: "hidden",
      }}
    >
      {/* Sparkle particles */}
      {sparkles.map((sparkle, i) => {
        const sparkleOpacity = interpolate(
          frame,
          [sparkle.delay, sparkle.delay + 20, sparkle.delay + 60, sparkle.delay + 80],
          [0, 1, 1, 0]
        );
        const sparkleScale = interpolate(
          Math.sin((frame + i * 15) / 10),
          [-1, 1],
          [0.5, 1.5]
        );
        const sparkleRotate = interpolate(frame, [sparkle.delay, sparkle.delay + 80], [0, 360]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: sparkle.x,
              top: sparkle.y,
              width: sparkle.size,
              height: sparkle.size,
              opacity: sparkleOpacity,
              transform: `scale(${sparkleScale}) rotate(${sparkleRotate}deg)`,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                background: i % 2 === 0 ? "#8b5cf6" : "#06b6d4",
                clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
                boxShadow: "0 0 10px currentColor",
              }}
            />
          </div>
        );
      })}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: "0 60px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 100,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            marginBottom: 40,
          }}
        >
          🚇
        </div>

        {/* Main text */}
        <h2
          style={{
            fontSize: 72,
            fontWeight: "bold",
            color: "white",
            margin: "0 0 30px 0",
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            textAlign: "center",
            background: "linear-gradient(135deg, #ffffff 0%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          SubwayTakes
        </h2>

        <p
          style={{
            fontSize: 36,
            color: "#a1a1aa",
            margin: "0 0 60px 0",
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            textAlign: "center",
          }}
        >
          Your Viral Video Platform
        </p>

        {/* Call to Action */}
        <div
          style={{
            opacity: ctaOpacity,
            transform: `scale(${ctaScale})`,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              padding: "24px 60px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)",
              borderRadius: 20,
              fontSize: 40,
              fontWeight: "bold",
              color: "white",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(139, 92, 246, 0.5)",
              border: "2px solid rgba(255, 255, 255, 0.2)",
            }}
          >
            Start Creating Today 🚀
          </div>
        </div>

        {/* Social/Contact Info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            opacity: socialOpacity,
            alignItems: "center",
          }}
        >
          <div
            style={{
              padding: "16px 40px",
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.5)",
              borderRadius: 12,
              fontSize: 28,
              color: "#c4b5fd",
            }}
          >
            github.com/yourproject/subwaytakes
          </div>

          <div
            style={{
              fontSize: 24,
              color: "#71717a",
            }}
          >
            Built with React, TypeScript & Supabase
          </div>
        </div>

        {/* Animated dots */}
        <div
          style={{
            position: "absolute",
            bottom: 80,
            display: "flex",
            gap: 12,
          }}
        >
          {[0, 1, 2].map((i) => {
            const dotOpacity = interpolate(
              Math.sin((frame + i * 20) / 15),
              [-1, 1],
              [0.3, 1]
            );

            return (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#8b5cf6",
                  opacity: dotOpacity,
                }}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

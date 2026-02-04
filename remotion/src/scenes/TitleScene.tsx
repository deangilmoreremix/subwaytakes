import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  Easing,
} from "remotion";

interface TitleSceneProps {
  frame: number;
  fps: number;
}

export const TitleScene: React.FC<TitleSceneProps> = ({ frame, fps }) => {
  // Logo animation - spring in from top
  const logoSpring = spring({
    frame,
    fps,
    config: {
      damping: 100,
      stiffness: 200,
      mass: 0.5,
    },
  });

  const logoY = interpolate(logoSpring, [0, 1], [-200, 0]);
  const logoOpacity = interpolate(frame, [0, 20], [0, 1]);

  // Tagline animation - fade in after logo
  const taglineOpacity = interpolate(frame, [30, 50], [0, 1]);
  const taglineY = interpolate(frame, [30, 50], [20, 0], {
    extrapolateRight: "clamp",
  });

  // Subway icon animation
  const iconRotation = interpolate(frame, [0, 120], [0, 360], {
    easing: Easing.bezier(0.33, 1, 0.68, 1),
  });

  // Background gradient pulse
  const gradientScale = interpolate(
    Math.sin(frame / 20),
    [-1, 1],
    [1, 1.1]
  );

  // Floating particles
  const particles = Array.from({ length: 20 }, (_, i) => ({
    x: (i * 54 + 100) % 1080,
    y: ((i * 97) % 1920),
    delay: i * 3,
    speed: 0.5 + (i % 3) * 0.3,
  }));

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.3) 0%, rgba(9, 9, 11, 1) 70%)`,
        transform: `scale(${gradientScale})`,
        overflow: "hidden",
      }}
    >
      {/* Floating particles */}
      {particles.map((particle, i) => {
        const particleY = interpolate(
          frame,
          [particle.delay, particle.delay + 150],
          [particle.y, particle.y - 400],
          { extrapolateRight: "clamp" }
        );
        const particleOpacity = interpolate(
          frame,
          [particle.delay, particle.delay + 30, particle.delay + 120, particle.delay + 150],
          [0, 1, 1, 0]
        );
        const particleScale = interpolate(
          Math.sin((frame + i * 10) / 15),
          [-1, 1],
          [0.8, 1.2]
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: particle.x,
              top: particleY,
              width: 8 + (i % 4) * 4,
              height: 8 + (i % 4) * 4,
              borderRadius: "50%",
              background: i % 3 === 0 ? "#8b5cf6" : i % 3 === 1 ? "#06b6d4" : "#f59e0b",
              opacity: particleOpacity,
              transform: `scale(${particleScale})`,
              boxShadow: "0 0 20px currentColor",
            }}
          />
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
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Subway Icon */}
        <div
          style={{
            fontSize: 120,
            transform: `translateY(${logoY}px) rotate(${iconRotation}deg)`,
            opacity: logoOpacity,
            marginBottom: 40,
          }}
        >
          🚇
        </div>

        {/* Logo Text */}
        <h1
          style={{
            fontSize: 84,
            fontWeight: "bold",
            color: "white",
            margin: 0,
            transform: `translateY(${logoY}px)`,
            opacity: logoOpacity,
            textAlign: "center",
            letterSpacing: "-2px",
            background: "linear-gradient(135deg, #ffffff 0%, #a78bfa 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          SubwayTakes
        </h1>

        {/* Tagline */}
        <p
          style={{
            fontSize: 36,
            color: "#a1a1aa",
            margin: "30px 0 0 0",
            transform: `translateY(${taglineY}px)`,
            opacity: taglineOpacity,
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: 1.4,
          }}
        >
          Create Viral Videos with AI
        </p>

        {/* Feature badges */}
        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 50,
            opacity: interpolate(frame, [60, 80], [0, 1]),
            transform: `translateY(${interpolate(frame, [60, 80], [20, 0])})`,
          }}
        >
          {["5 Clip Types", "AI-Powered", "60+ Effects"].map((badge, i) => (
            <div
              key={badge}
              style={{
                padding: "12px 24px",
                background: "rgba(99, 102, 241, 0.2)",
                border: "1px solid rgba(99, 102, 241, 0.5)",
                borderRadius: 20,
                fontSize: 20,
                color: "#c4b5fd",
                opacity: interpolate(frame, [60 + i * 5, 80 + i * 5], [0, 1]),
              }}
            >
              {badge}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

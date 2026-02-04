# SubwayTakes Demo Video

This folder contains the Remotion composition for creating a demo video showcasing the SubwayTakes platform.

## Structure

```
remotion/
├── src/
│   ├── index.ts              # Entry point
│   ├── Root.tsx              # Composition registration
│   ├── SubwayTakesDemo.tsx   # Main demo composition
│   └── scenes/
│       ├── TitleScene.tsx     # Opening title scene (4s)
│       ├── ClipTypesScene.tsx # Showcase 5 clip types (10s)
│       ├── FeaturesScene.tsx  # Feature highlights (11s)
│       └── OutroScene.tsx     # Closing scene (5s)
└── README.md
```

## Video Specifications

- **Duration:** 30 seconds (900 frames at 30fps)
- **Dimensions:** 1080x1920 (vertical video for TikTok/Reels)
- **Format:** MP4 (H264 codec)

## Scenes Breakdown

### 1. Title Scene (0-4s)
- Animated SubwayTakes logo with subway icon
- Gradient text effects
- Feature badges (5 Clip Types, AI-Powered, 60+ Effects)

### 2. Clip Types Scene (4-14s)
- Showcases all 5 content modes:
  - Wisdom Interview (55+)
  - Motivational
  - Street Interview
  - Subway Interview
  - Studio Interview
- Animated card reveals with spring animations

### 3. Features Scene (14-25s)
- Grid layout highlighting:
  - AI-Powered generation
  - 60+ Effects system
  - Enhancement features
  - Episode Builder
- Call-to-action button

### 4. Outro Scene (25-30s)
- SubwayTakes branding
- Project information
- Animated gradient background

## Available Scripts

### Open Remotion Studio (Preview with hot reload)
```bash
npm run remotion:studio
```

### Render the demo video
```bash
npm run remotion:render
```
This creates `demo-video.mp4` in the project root.

### Quick preview
```bash
npm run remotion:preview
```

## Customization

### Change Duration
Edit `remotion/src/Root.tsx`:
```typescript
durationInFrames={900} // Change this value (frames at 30fps)
```

### Modify Scene Timings
Edit `remotion/src/SubwayTakesDemo.tsx`:
```typescript
const titleEnd = 120;      // 4 seconds
const clipTypesEnd = 420;  // 14 seconds total
const featuresEnd = 750;   // 25 seconds total
const outroEnd = 900;      // 30 seconds total
```

### Update Colors
Each scene uses consistent colors:
- Primary: `#8b5cf6` (Purple)
- Accent: `#6366f1` (Indigo)
- Background: `#09090b` (Dark)
- Text: `#ffffff` (White), `#a1a1aa` (Gray)

### Change Video Dimensions
For different aspect ratios:
- **Square (1:1):** `width: 1080, height: 1080`
- **Landscape (16:9):** `width: 1920, height: 1080`
- **Vertical (9:16):** `width: 1080, height: 1920` (current)

## Development Tips

1. **Use Remotion Studio for live editing:**
   ```bash
   npm run remotion:studio
   ```
   - See changes in real-time
   - Scrub through timeline
   - Test different frame ranges

2. **Test individual scenes:**
   - Comment out scenes in `SubwayTakesDemo.tsx`
   - Focus on one scene at a time
   - Adjust timings and animations

3. **Performance optimization:**
   - Avoid heavy computations per frame
   - Use `interpolate` for smooth animations
   - Leverage `spring` for natural motion

## Export Options

### High Quality (Production)
```bash
remotion render remotion/src/index.ts SubwayTakesDemo demo-video.mp4 --codec=h264 --video-bitrate=8M
```

### Quick Preview (Draft)
```bash
remotion render remotion/src/index.ts SubwayTakesDemo demo-video.mp4 --scale=0.5
```

### GIF Export
```bash
remotion render remotion/src/index.ts SubwayTakesDemo demo-video.gif
```

## Troubleshooting

### Issue: "Cannot find module 'remotion'"
**Solution:** Make sure dependencies are installed:
```bash
npm install
```

### Issue: Render is slow
**Solution:** Use lower quality for testing:
```bash
remotion render remotion/src/index.ts SubwayTakesDemo demo-video.mp4 --scale=0.5
```

### Issue: TypeScript errors
**Solution:** Ensure TypeScript is configured:
```bash
npm run typecheck
```

## Learn More

- [Remotion Documentation](https://www.remotion.dev/)
- [Remotion API Reference](https://www.remotion.dev/docs/api)
- [Animation Techniques](https://www.remotion.dev/docs/animating-properties)

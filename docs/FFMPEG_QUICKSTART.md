# FFmpeg Quick Start Guide

Get FFmpeg integration running in 5 minutes.

## Quick Start with Docker (Recommended)

```bash
# 1. Start all services
docker-compose up -d

# 2. Check service health
curl http://localhost:3001/health

# 3. Test thumbnail generation
curl -X POST http://localhost:3001/generate-thumbnail \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://example.com/sample.mp4",
    "options": {
      "width": 1280,
      "height": 720,
      "timestamp": "00:00:01"
    }
  }'
```

## Manual Setup

### 1. Install FFmpeg

**macOS**:
```bash
brew install ffmpeg
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows**:
Download from https://ffmpeg.org/download.html

### 2. Setup Thumbnail Service

```bash
cd thumbnail-service
npm install
cp .env.example .env
npm start
```

### 3. Deploy Edge Function

```bash
supabase functions deploy process-video
supabase secrets set THUMBNAIL_SERVICE_URL=http://localhost:3001
```

### 4. Test in Your App

```typescript
import { generateThumbnail } from './lib/ffmpeg';

const thumbnailUrl = await generateThumbnail(videoUrl, {
  timestamp: '00:00:03',
  width: 1280,
  height: 720,
});
```

## Common Operations

### Generate Thumbnail
```typescript
const thumbnail = await generateThumbnail(videoUrl, {
  timestamp: '00:00:02',
  emoji: '🔥',
});
```

### Stitch Videos
```typescript
const stitched = await stitchVideos([url1, url2, url3]);
```

### Add Captions
```typescript
const captioned = await addCaptions(videoUrl, 'Hot Take!', {
  position: 'bottom',
  fontSize: 48,
});
```

### Convert Format
```typescript
const webm = await convertVideo(videoUrl, 'webm', 'high');
```

## Troubleshooting

**Service not responding?**
```bash
# Check if FFmpeg is installed
ffmpeg -version

# Check service logs
docker-compose logs thumbnail-service

# Restart service
docker-compose restart thumbnail-service
```

**Out of memory?**
- Reduce video quality settings
- Process smaller video files
- Increase Docker memory limit

**Slow processing?**
- Use lower quality settings
- Enable hardware acceleration
- Process videos asynchronously

## Next Steps

1. Read the [Full Documentation](./FFMPEG_SETUP.md)
2. Check the [API Reference](./FFMPEG_SETUP.md#api-reference)
3. Deploy to production hosting

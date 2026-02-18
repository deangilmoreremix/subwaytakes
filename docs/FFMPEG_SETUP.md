# FFmpeg Integration Guide

This guide explains how to use FFmpeg in the SubwayTakes application for video processing operations.

## Architecture

The FFmpeg integration has **3 layers**:

1. **Thumbnail Service** (Node.js + Express + FFmpeg) - Heavy processing
2. **Edge Function** (Supabase) - Request routing and coordination
3. **Client Library** (TypeScript) - Easy-to-use API for React

## 1. Thumbnail Service (Node.js)

### Location
`/thumbnail-service/`

### Features
- ✅ Generate thumbnails from videos
- ✅ Extract frames at specific timestamps
- ✅ Add emoji/text watermarks
- ✅ Stitch multiple videos together
- ✅ Burn captions into videos
- ✅ Convert video formats (mp4, webm, mov, avi)
- ✅ Trim videos to specific time ranges
- ✅ Get video metadata (duration, codec, resolution, etc.)

### Installation

```bash
cd thumbnail-service
npm install
```

### Dependencies
- `fluent-ffmpeg` - FFmpeg wrapper for Node.js
- `express` - HTTP server
- `axios` - HTTP client for downloading videos
- `multer` - File upload handling

### Environment Variables

Create `thumbnail-service/.env`:

```env
PORT=3001
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe
```

### Running the Service

```bash
# Development
npm run dev

# Production
npm start
```

### Docker Setup

```dockerfile
FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:

```bash
cd thumbnail-service
docker build -t thumbnail-service .
docker run -p 3001:3001 thumbnail-service
```

---

## 2. Edge Function (Supabase)

### Location
`/supabase/functions/process-video/`

### Purpose
- Routes video processing requests
- Handles authentication
- Coordinates between client and thumbnail service
- Provides fallback responses

### Deployment

```bash
supabase functions deploy process-video
```

### Environment Variables

Set in Supabase dashboard or via CLI:

```bash
supabase secrets set THUMBNAIL_SERVICE_URL=http://your-thumbnail-service:3001
```

---

## 3. Client Library (TypeScript)

### Location
`/src/lib/ffmpeg.ts`

### Usage

```typescript
import {
  generateThumbnail,
  stitchVideos,
  addCaptions,
  convertVideo,
  trimVideo,
  getVideoInfo,
} from '../lib/ffmpeg';

// Generate thumbnail
const thumbnailUrl = await generateThumbnail(videoUrl, {
  width: 1280,
  height: 720,
  timestamp: '00:00:03',
  emoji: '🔥',
  text: 'Hot Take!',
});

// Stitch multiple videos
const stitchedUrl = await stitchVideos([video1Url, video2Url, video3Url]);

// Add captions
const captionedUrl = await addCaptions(videoUrl, 'This is amazing!', {
  fontSize: 48,
  fontColor: 'white',
  position: 'bottom',
  backgroundColor: 'black@0.5',
});

// Convert format
const webmUrl = await convertVideo(videoUrl, 'webm', 'high');

// Trim video
const trimmedUrl = await trimVideo(videoUrl, '00:00:05', '00:00:15');

// Get video info
const info = await getVideoInfo(videoUrl);
console.log(`Duration: ${info.duration}s, Resolution: ${info.video.width}x${info.video.height}`);
```

---

## API Reference

### Generate Thumbnail

**Endpoint**: `POST /generate-thumbnail`

**Request**:
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "options": {
    "width": 1280,
    "height": 720,
    "timestamp": "00:00:01",
    "emoji": "🎬",
    "text": "Watch Now",
    "quality": 2
  }
}
```

**Response**:
```json
{
  "success": true,
  "thumbnail": "data:image/jpeg;base64,...",
  "thumbnailId": "uuid"
}
```

---

### Stitch Videos

**Endpoint**: `POST /stitch-videos`

**Request**:
```json
{
  "videoUrls": [
    "https://example.com/video1.mp4",
    "https://example.com/video2.mp4",
    "https://example.com/video3.mp4"
  ],
  "transitionType": "crossfade",
  "transitionDuration": 0.5
}
```

**Response**:
```json
{
  "success": true,
  "video": "data:video/mp4;base64,...",
  "stitchId": "uuid",
  "videoCount": 3
}
```

---

### Add Captions

**Endpoint**: `POST /add-captions`

**Request**:
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "captionText": "This is incredible!",
  "captionStyle": {
    "fontSize": 48,
    "fontColor": "white",
    "position": "bottom",
    "backgroundColor": "black@0.5"
  }
}
```

**Response**:
```json
{
  "success": true,
  "video": "data:video/mp4;base64,...",
  "captionId": "uuid"
}
```

---

### Convert Video

**Endpoint**: `POST /convert-video`

**Request**:
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "format": "webm",
  "quality": "high"
}
```

**Response**:
```json
{
  "success": true,
  "video": "data:video/webm;base64,...",
  "convertId": "uuid",
  "format": "webm"
}
```

---

### Trim Video

**Endpoint**: `POST /trim-video`

**Request**:
```json
{
  "videoUrl": "https://example.com/video.mp4",
  "startTime": "00:00:05",
  "endTime": "00:00:15"
}
```

**Response**:
```json
{
  "success": true,
  "video": "data:video/mp4;base64,...",
  "trimId": "uuid",
  "startTime": "00:00:05",
  "endTime": "00:00:15"
}
```

---

### Get Video Info

**Endpoint**: `POST /get-video-info`

**Request**:
```json
{
  "videoUrl": "https://example.com/video.mp4"
}
```

**Response**:
```json
{
  "success": true,
  "info": {
    "duration": 30.5,
    "size": 5242880,
    "bitrate": 1400000,
    "format": "mp4,mov,m4a",
    "video": {
      "codec": "h264",
      "width": 1080,
      "height": 1920,
      "fps": 30,
      "aspectRatio": "9:16"
    },
    "audio": {
      "codec": "aac",
      "sampleRate": 44100,
      "channels": 2
    }
  }
}
```

---

## Production Deployment Options

### Option 1: Separate Node.js Service (Recommended)

Deploy thumbnail service on:
- Railway
- Render
- DigitalOcean App Platform
- AWS ECS
- Google Cloud Run

**Pros**: Full FFmpeg support, fast processing
**Cons**: Additional infrastructure cost

---

### Option 2: Serverless with FFmpeg Layer

Use AWS Lambda with FFmpeg layer:

```bash
# Add FFmpeg layer to Lambda
arn:aws:lambda:us-east-1:123456789012:layer:ffmpeg:1
```

**Pros**: Auto-scaling, pay-per-use
**Cons**: 15-minute timeout limit

---

### Option 3: Cloud Video APIs

Use managed services:
- **Mux** - Video API with transcoding
- **Cloudinary** - Media management with transformations
- **AWS MediaConvert** - Professional video processing

**Pros**: Fully managed, scalable
**Cons**: More expensive for high volume

---

## Performance Considerations

### Video Size Limits
- **Thumbnail Generation**: Up to 500MB
- **Stitching**: Up to 1GB total
- **Caption Burning**: Up to 500MB
- **Format Conversion**: Up to 500MB

### Processing Time (Approximate)
- Thumbnail: 2-5 seconds
- Stitch (3 clips): 10-30 seconds
- Add Captions: 5-15 seconds
- Convert Format: 10-60 seconds
- Trim: 5-10 seconds

### Optimization Tips
1. **Use H.264 codec** for best compatibility
2. **Process videos in background** with job queues
3. **Cache thumbnails** in Supabase Storage
4. **Use CDN** for processed video delivery
5. **Implement retry logic** for failed operations

---

## Troubleshooting

### FFmpeg Not Found
```bash
# Install FFmpeg on Ubuntu/Debian
sudo apt-get update
sudo apt-get install ffmpeg

# Install FFmpeg on macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Out of Memory Errors
- Increase Node.js memory limit: `NODE_OPTIONS=--max-old-space-size=4096`
- Process videos in smaller chunks
- Use streaming for large files

### Slow Processing
- Use `-c copy` flag to avoid re-encoding when possible
- Lower quality settings for faster processing
- Use hardware acceleration if available: `-hwaccel cuda`

---

## Security Best Practices

1. **Validate video URLs** before processing
2. **Sanitize user inputs** (filenames, captions)
3. **Limit file sizes** to prevent abuse
4. **Rate limit API requests**
5. **Use authentication** for all endpoints
6. **Scan uploaded videos** for malware
7. **Clean up temporary files** after processing

---

## Example: Full Video Processing Workflow

```typescript
import {
  generateThumbnail,
  addCaptions,
  uploadVideoToStorage,
  processAndUploadVideo,
} from '../lib/ffmpeg';

async function processClipForPublication(clipId: string, videoUrl: string) {
  try {
    // 1. Generate thumbnail
    const thumbnailUrl = await generateThumbnail(videoUrl, {
      timestamp: '00:00:01',
      emoji: '🔥',
      width: 1280,
      height: 720,
    });

    // 2. Add captions
    const captionedUrl = await addCaptions(videoUrl, 'Hot Take Alert!', {
      fontSize: 48,
      fontColor: 'white',
      position: 'bottom',
    });

    // 3. Upload to storage
    const finalUrl = await processAndUploadVideo(captionedUrl, 'convert', {
      format: 'mp4',
      quality: 'high',
    });

    // 4. Update database
    await updateClip(clipId, {
      result_url: finalUrl,
      thumbnail_url: thumbnailUrl,
      status: 'done',
    });

    return { finalUrl, thumbnailUrl };
  } catch (error) {
    console.error('Processing failed:', error);
    throw error;
  }
}
```

---

## Next Steps

1. **Deploy thumbnail service** to production hosting
2. **Configure environment variables** in Supabase
3. **Test each operation** with sample videos
4. **Monitor performance** and adjust timeouts
5. **Set up error tracking** with Sentry or similar
6. **Implement background jobs** for long-running operations

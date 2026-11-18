# Notices

## Captions studio

The caption studio (style presets, motion engines, transcript editor, caption exports) was designed with two open-source projects as references.
No code was copied from either; this app re-implements the ideas in TypeScript and Remotion for in-browser rendering.

- **ai-video-captions** by Nicolai Gaina, MIT licence: https://github.com/nicolaigaina/ai-video-captions
  (upload-style-preview-burn pipeline, the six named styles Hormozi, MrBeast, Karaoke, Minimal, Bounce, Classic, draggable caption position, language-aware fonts)
- **Capite** by Muneeb Khan, MIT licence: https://github.com/muneebkhan08/Capite
  (the "Studio" transcript and motion editor: click-to-seek words, inline editing, timing nudges, find and replace, casing, seven motion engines, preset categories, SRT/VTT/TXT/ASS export)

The 33 presets in `src/lib/captions/presets.ts` are this app's own colour, font and motion settings (names and categories follow the references; the full Capite preset table was not reproduced).

## On-device speech recognition (free, runs in the browser)

- **Transformers.js** (`@huggingface/transformers`), Apache-2.0, running OpenAI Whisper ONNX conversions from the Hugging Face hub (`onnx-community/whisper-*_timestamped`).
- **whisper.cpp** compiled to WebAssembly through `@remotion/whisper-web` (Remotion licence: free for individuals and companies of up to three people; check https://remotion.dev/license if your team grows), models from `ggerganov/whisper.cpp`.
- **Web Speech API** (browser built-in) for optional dictation.
- Fonts: Google Fonts families through `@remotion/google-fonts` (SIL Open Font Licence / Apache-2.0).

## Scripture and verse library

- Bible texts in `src/lib/bible/verses.generated.ts`: **King James Version** and **World English Bible** (public domain) and the **Berean Standard Bible** (placed in the public domain by its publisher on 30 April 2023, https://berean.bible/licensing.htm).
- Every verse is kept only when independent sources agree: wldeh/bible-api (https://github.com/wldeh/bible-api), api.getbible.net, bible-api.com and the scrollmapper/bible_databases collection (https://github.com/scrollmapper/bible_databases, MIT for the database tooling; the texts used are public domain). See `scripts/build-verses.mjs`.
- Which verses are offered per theme draws on **OpenBible.info** topic scores, licensed CC BY 4.0 (https://www.openbible.info/topics/). Only verse references are used, never the ESV text that site displays. Attribution: "Topic data from OpenBible.info, CC BY 4.0".

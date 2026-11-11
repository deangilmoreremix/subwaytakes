// Fails if any slug in src/lib/muapi/registry.ts is missing from muapi's OpenAPI spec.
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/lib/muapi/registry.ts', import.meta.url), 'utf8');
const slugs = new Set([...src.matchAll(/(?:slug|upload|depth|vision|cleanFrames|characterSheet|prompt|full|lite|captions|whisper): '([^']+)'/g)].map(m => m[1]));
const spec = await (await fetch('https://api.muapi.ai/openapi.json')).json();
const missing = [...slugs].filter(s => !spec.paths[`/api/v1/${s}`]);
console.log(`${slugs.size} slugs checked`);
if (missing.length) { console.error('Missing from muapi:', missing); process.exit(1); }

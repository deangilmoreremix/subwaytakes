// Builds ONE self-contained file for the subwaytakes-byok edge function (no relative imports), so it can be deployed from the Supabase MCP/CLI/dashboard.
// Usage: node scripts/bundle-byok.mjs <out.ts>     then deploy that file as `index.ts` with verify_jwt = true.
import { readFileSync, writeFileSync } from 'node:fs';
const out = process.argv[2];
if (!out) { console.error('usage: node scripts/bundle-byok.mjs <out.ts>'); process.exit(2); }
const F = 'supabase/functions';
const strip = p => readFileSync(`${F}/${p}`, 'utf8').replace(/^import .*?;\n/gm, '').replace(/^export (async function|function|const|interface|type|class)/gm, '$1');
let byok = strip('_shared/byok.ts');
byok = byok.replaceAll('isObj', 'isObjB');                  // pricing.ts has its own isObj
let entry = readFileSync(`${F}/subwaytakes-byok/index.ts`, 'utf8')
  .replace(/import \{ handle, type ByokCaller, type ByokDeps \} from "..\/_shared\/byok.ts";\n/, '')
  .replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";\n', '')
  .replace('import { createClient } from "npm:@supabase/supabase-js@2";\n', '')
  .replace('import { corsHeadersFor, parseOrigins } from "../_shared/cors.ts";\n', '');
const head = 'import "jsr:@supabase/functions-js/edge-runtime.d.ts";\nimport { createClient } from "npm:@supabase/supabase-js@2";\n';
writeFileSync(out, `${head}\n// ---- bundled from _shared/{pricing,paths,safety,cors,byok}.ts\n${['pricing', 'paths', 'safety', 'cors'].map(n => strip(`_shared/${n}.ts`)).join('\n')}\n${byok}\n// ---- entrypoint\n${entry}`);
console.log('wrote', out);

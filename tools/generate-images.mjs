// Generates the site's icons/art with Gemini (Nano Banana). Usage: GEMINI_API_KEY=... node tools/generate-images.mjs [--force] [name ...]
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = 'gemini-nano-banana-2.1';
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error('GEMINI_API_KEY is not set'); process.exit(1); }

const ICON = 'A cute glossy 3D app-icon style illustration with soft rounded shapes and a tactile clay-like material, gentle warm glow, a single centered subject filling about 70% of the frame, on a solid deep navy (#0b1030) background with a subtle vignette. Square composition. No text, no watermark. Subject: ';
const items = [
  ['flower-0', ICON + 'a memorial bouquet of white chrysanthemums and lilies wrapped in paper'],
  ['flower-1', ICON + 'a blooming cherry blossom branch with falling petals'],
  ['flower-2', ICON + 'a single large yellow chrysanthemum with leaves'],
  ['flower-3', ICON + 'a bunch of red tulips tied with a ribbon'],
  ['flower-4', ICON + 'a sad wilted drooping rose with a few petals falling'],
  ['flower-5', ICON + 'a Japanese onigiri rice ball wrapped in nori seaweed'],
  ['flower-6', ICON + 'a cup of steaming Japanese green tea'],
  ['flower-7', ICON + 'a Japanese sake tokkuri bottle with a small ochoko cup'],
  ['icon-candle', ICON + 'a lit memorial candle with a bright warm flame in a small holder'],
  ['icon-koden', ICON + 'a Japanese condolence envelope (koden-bukuro) in black and silver with a mizuhiki knot, with a few tiny glowing coins floating above it'],
  ['icon-f', ICON + 'a small stone plaque with a glowing golden capital letter F engraved on it, and a tiny flower beside it'],
  ['icon-bell-on', ICON + 'a Japanese temple bell (orin) ringing, with golden sound waves'],
  ['icon-bell-off', ICON + 'a Japanese temple singing bowl (orin) with a bold red circle-and-diagonal-slash "no" prohibition symbol overlaid in front of it, silent'],
  ['icon-truck', ICON + 'a cute chubby kawaii delivery truck speeding fast with motion lines and sparkles, no people'],
  ['hero-bg', 'A serene wide dusk scene of a quiet Japanese memorial garden: stone lanterns glowing softly, snow gently falling and lightly covering the ground, mist, a large pale moon, deep navy and indigo palette, painterly, lots of dark empty space in the center for overlaid content. No text, no people.', '16:9'],
  ['og', 'A cute 3D rendered gravestone with no inscription, surrounded by lit candles, flowers and softly falling snow, a tiny glowing terminal prompt cursor symbol above it, deep navy night background with stars, warm candlelight glow, centered composition. No text, no watermark.', '16:9']
];

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const force = process.argv.includes('--force');

function findImage(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'image' && typeof node.data === 'string') return node;
  for (const v of Object.values(node)) {
    const r = findImage(v);
    if (r) return r;
  }
  return null;
}

async function generate([name, prompt, ratio = '1:1']) {
  const file = join(OUT, name + '.jpg');
  if (!force) { try { await access(file); console.log('skip', name); return; } catch { /* missing */ } }
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      store: false,
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: ratio, image_size: '1K' }
    })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${text.slice(0, 400)}`);
  const img = findImage(JSON.parse(text));
  if (!img) throw new Error(`${name}: no image in response`);
  await writeFile(file, Buffer.from(img.data, 'base64'));
  console.log('ok  ', name);
}

await mkdir(OUT, { recursive: true });
const queue = items.filter(([n]) => !only.length || only.includes(n));
let failed = 0;
for (let i = 0; i < queue.length; i += 3) {
  const results = await Promise.allSettled(queue.slice(i, i + 3).map(generate));
  for (const r of results) if (r.status === 'rejected') { failed++; console.error(String(r.reason.message ?? r.reason)); }
}
process.exit(failed ? 1 : 0);

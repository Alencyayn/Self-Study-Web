import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function prepareAssets() {
  const out = resolve(root, 'assets');
  await mkdir(resolve(out, 'pdfjs'), { recursive: true });
  await mkdir(resolve(out, 'katex'), { recursive: true });
  for (const file of ['pdf.mjs', 'pdf.worker.mjs']) await cp(resolve(root, 'node_modules/pdfjs-dist/build', file), resolve(out, 'pdfjs', file));
  for (const dir of ['cmaps', 'standard_fonts', 'wasm']) await cp(resolve(root, 'node_modules/pdfjs-dist', dir), resolve(out, 'pdfjs', dir), { recursive: true });
  for (const file of ['katex.mjs', 'katex.min.css', 'fonts']) await cp(resolve(root, 'node_modules/katex/dist', file), resolve(out, 'katex', file), { recursive: true });
  await cp(resolve(root, 'node_modules/pdfjs-dist/LICENSE'), resolve(out, 'pdfjs/LICENSE'));
  await cp(resolve(root, 'node_modules/katex/LICENSE'), resolve(out, 'katex/LICENSE'));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { await prepareAssets(); console.log('Local PDF and math assets prepared.'); }

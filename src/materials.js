import { newProgress, localDate } from './learning.js';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 2_000_000;
export function requiredPhases(mode = 'self') { return mode === 'class' ? [0, 2, 3] : [0, 1, 2, 3]; }
export function sectionComplete(progress, mode = 'self') { return requiredPhases(mode).every(i => progress.completed[i]); }
export function validateFile(file) {
  if (!file || !file.size) throw new Error('This file is empty. Choose a file with some content.');
  if (file.size > MAX_FILE_BYTES) throw new Error('This file is over 25 MB. Split it into smaller sections before importing.');
  if (!/\.(pdf|md|markdown|txt)$/i.test(file.name)) throw new Error('Please choose a PDF, Markdown or TXT file.');
}

function headingAt(lines, i, fenced) {
  if (fenced) return null;
  const line = lines[i].trim();
  const markdown = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
  if (markdown) return { level: markdown[1].length, title: markdown[2], skip: 0 };
  if (line && i + 1 < lines.length && /^\s*(={3,}|-{3,})\s*$/.test(lines[i + 1])) return { level: lines[i + 1].trim()[0] === '=' ? 1 : 2, title: line, skip: 1 };
  if (line.length < 110 && /^(?:\d+(?:\.\d+){1,3}[\s.、—–-]+\S|(?:Chapter|Section)\s+\d+\b|第[一二三四五六七八九十百零\d]+[章节部分])/.test(line)) return { level: 2, title: line, skip: 0 };
  return null;
}
function plainTitle(text) { return text.replace(/[*`#]/g, '').trim().slice(0, 240); }
export function splitStudyBlocks(content) {
  const parts = { key: '', example: '', practice: '', answer: '' };
  let current = 'key', fenced = false;
  for (const line of content.split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const header = !fenced && line.match(/^#{1,6}\s+(.+)$/);
    if (header) {
      const name = header[1].trim().toLowerCase();
      const target = /^(the key idea|key idea|核心概念|关键思路)$/.test(name) ? 'key' : /^(worked examples?|example|完整例题|例题|示例)$/.test(name) ? 'example' : /^(quick check(?:\s*\/.*)?|independent practice|练习|独立练习|自测)$/.test(name) ? 'practice' : /^(answer|solution|答案|解答|参考答案)$/.test(name) ? 'answer' : null;
      if (target) { current = target; continue; }
    }
    parts[current] += line + '\n';
  }
  for (const key of Object.keys(parts)) parts[key] = parts[key].trim();
  const match = parts.key.match(/^\s*(?:核心问题|Core question)\s*[:：]\s*(.+)\n?/im);
  parts.question = match?.[1] || '';
  if (match) parts.key = parts.key.replace(match[0], '').trim();
  return parts;
}
export function parseTextMaterial(text, filename = 'Learning material.md') {
  if (typeof text !== 'string' || !text.trim()) throw new Error('This material does not contain readable text.');
  if (text.length > MAX_TEXT_LENGTH) throw new Error('This text is too long. Split it into chapters before importing.');
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const headings = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) { fenced = !fenced; continue; }
    const h = headingAt(lines, i, fenced);
    if (h) { headings.push({ ...h, line: i }); i += h.skip; }
  }
  let title = filename.replace(/\.(md|markdown|txt|pdf)$/i, ''), start = 0;
  const first = headings[0];
  if (first?.level === 1 && headings.filter(h => h.level === 1).length === 1 && headings.length > 1) {
    title = plainTitle(first.title); start = first.line + 1 + first.skip; headings.shift();
  }
  const minimum = headings.length ? Math.min(...headings.map(h => h.level)) : 0;
  const toc = headings.filter(h => h.level === minimum);
  const introEnd = toc[0]?.line ?? lines.length;
  const intro = lines.slice(start, introEnd).join('\n').trim();
  const description = intro.split('\n').find(l => l.trim() && !l.startsWith('#'))?.replace(/[*`]/g, '').slice(0, 160) || 'From understanding to independent use, one small idea at a time.';
  let sections = [];
  if (toc.length) {
    if (intro && (start === 0 || intro.split('\n').length > 3)) sections.push({ title: 'Overview', body: intro });
    sections.push(...toc.map((h, i) => ({ title: plainTitle(h.title), body: lines.slice(h.line + 1 + h.skip, toc[i + 1]?.line ?? lines.length).join('\n').trim() })));
  } else {
    const body = lines.slice(start).join('\n').trim();
    // Long unstructured notes get real text segments, never invented chapter names.
    if (body.length > 18000) {
      let chunk = '';
      for (const paragraph of body.split(/\n\s*\n/)) {
        if (chunk.length > 12000) { sections.push({ title: `Part ${sections.length + 1}`, body: chunk }); chunk = ''; }
        chunk += paragraph + '\n\n';
      }
      if (chunk.trim()) sections.push({ title: `Part ${sections.length + 1}`, body: chunk.trim() });
    } else sections = [{ title: toc[0]?.title || title, body }];
  }
  return { title, description, sections: sections.map((s, i) => ({ id: `section-${i}`, ...s, blocks: splitStudyBlocks(s.body), progress: newProgress() })) };
}
export function createMaterial(parsed, filename, id, extra = {}) {
  return { id, title: parsed.title, description: parsed.description, filename, importedAt: new Date().toISOString(), selected: 0, phase: 0, reviews: [], ...extra, sections: parsed.sections };
}
export function materialReview(material, sectionId, offsets = [1, 3, 7], reason = 'Spaced recall', now = new Date()) {
  for (const offset of offsets) {
    const date = new Date(now); date.setDate(date.getDate() + offset);
    const due = localDate(date);
    if (!material.reviews.some(r => r.sectionId === sectionId && r.due === due && !r.done)) material.reviews.push({ id: `${sectionId}-${due}-${Date.now()}`, sectionId, due, reason, done: false });
  }
}

export async function parsePdfMaterial(bytes, filename, onProgress = () => {}) {
  const pdfjs = await import('/assets/pdfjs/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.mjs';
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes), cMapUrl: '/assets/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/assets/pdfjs/standard_fonts/', wasmUrl: '/assets/pdfjs/wasm/', isEvalSupported: false });
  let pdf;
  try {
    pdf = await task.promise;
    if (pdf.numPages > 300) throw new Error('This PDF has more than 300 pages. Split it into chapters first.');
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress(`Reading PDF · Page ${n} of ${pdf.numPages}`);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const rows = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const y = item.transform[5], x = item.transform[4];
        let row = rows.find(r => Math.abs(r.y - y) < 3);
        if (!row) { row = { y, items: [], size: 0 }; rows.push(row); }
        row.items.push({ text: item.str, x }); row.size = Math.max(row.size, Math.abs(item.height || item.transform[3]));
      }
      rows.sort((a, b) => b.y - a.y);
      for (const row of rows) row.text = row.items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ').trim();
      pages.push({ number: n, rows, text: rows.map(r => r.text).join('\n') });
      page.cleanup();
    }
    let outline = [];
    try { outline = await pdf.getOutline() || []; } catch { /* Page-based contents remain available. */ }
    const destinations = [];
    for (const entry of outline) {
      try {
        const dest = typeof entry.dest === 'string' ? await pdf.getDestination(entry.dest) : entry.dest;
        if (Array.isArray(dest) && dest[0] != null) {
          const pageIndex = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
          destinations.push({ title: plainTitle(entry.title), page: pageIndex + 1 });
        }
      } catch { /* A broken bookmark does not discard source pages. */ }
    }
    destinations.sort((a, b) => a.page - b.page);
    // Only use the PDF outline when it partitions actual pages without losing earlier content.
    const usableOutline = destinations.length > 0 && destinations.every((d, i) => i === 0 || d.page > destinations[i - 1].page);
    const textLength = pages.reduce((sum, p) => sum + p.text.length, 0);
    const title = filename.replace(/\.pdf$/i, '');
    let sections;
    if (usableOutline) {
      if (destinations[0].page > 1) destinations.unshift({ title: 'Overview', page: 1 });
      sections = destinations.map((d, i) => ({ title: d.title, page: d.page, body: pages.slice(d.page - 1, (destinations[i + 1]?.page ?? pdf.numPages + 1) - 1).map(p => p.text).join('\n\n') }));
    } else {
      sections = pages.map(page => {
        const sizes = page.rows.map(row => row.size).filter(Boolean).sort((a, b) => a - b);
        const normal = sizes[Math.floor(sizes.length / 2)] || 12;
        const heading = page.rows.find(row => row.text.length < 110 && row.size >= normal * 1.2);
        return { title: heading?.text || `Page ${page.number}`, page: page.number, body: page.text };
      });
    }
    if (textLength > MAX_TEXT_LENGTH) throw new Error('This PDF contains too much text. Split it into smaller files first.');
    return { title, description: usableOutline ? 'Your learning path, organised by the original PDF bookmarks.' : 'Your learning path, organised by the original PDF pages.', scanned: textLength < 20, sections: sections.map((s, i) => ({ ...s, id: `section-${i}`, blocks: splitStudyBlocks(s.body), progress: newProgress() })) };
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('This PDF is password-protected. Please export an unlocked copy first.');
    if (error.name === 'InvalidPDFException') throw new Error('This PDF could not be read. Check that the file is complete and try again.');
    throw error;
  } finally { await task.destroy(); }
}

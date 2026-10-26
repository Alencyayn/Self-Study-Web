import katex from '/assets/katex/katex.mjs';
import { escapeHTML as e } from './learning.js';
function math(value, display = false) {
  if (value.length > 4000) return `<code>${e(value)}</code>`;
  return katex.renderToString(value, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20 });
}
function inline(text) {
  const pattern = /`([^`\n]+)`|\$([^$\n]+)\$|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let result = '', index = 0;
  for (const match of text.matchAll(pattern)) {
    result += e(text.slice(index, match.index));
    if (match[1]) result += `<code>${e(match[1])}</code>`;
    else if (match[2]) result += math(match[2]);
    else if (match[3]) result += `<strong>${e(match[3])}</strong>`;
    else result += `<a href="${e(match[5])}" target="_blank" rel="noopener noreferrer">${e(match[4])}</a>`;
    index = match.index + match[0].length;
  }
  return result + e(text.slice(index));
}
export function markdown(text = '') {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let out = '', i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith('```')) {
      const code = []; i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      out += `<pre><code>${e(code.join('\n'))}</code></pre>`; i++; continue;
    }
    if (line.startsWith('$$')) {
      let expression = line.slice(2), closed = expression.endsWith('$$') && expression.length >= 2;
      if (closed) expression = expression.slice(0, -2);
      i++;
      while (!closed && i < lines.length) {
        const next = lines[i++];
        if (next.trim().endsWith('$$')) { expression += '\n' + next.slice(0, next.lastIndexOf('$$')); closed = true; }
        else expression += '\n' + next;
      }
      out += `<div class="math-block">${math(expression.trim(), true)}</div>`; continue;
    }
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) { out += `<h3>${inline(heading[1])}</h3>`; i++; continue; }
    if (/^(?:[-*+]\s+|\d+[.)]\s+)/.test(line)) {
      const ordered = /^\d/.test(line), items = [];
      const re = ordered ? /^\d+[.)]\s+/ : /^[-*+]\s+/;
      while (i < lines.length && re.test(lines[i].trim())) items.push(`<li>${inline(lines[i++].trim().replace(re, ''))}</li>`);
      out += `<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`; continue;
    }
    if (/^>/.test(line)) { out += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`; i++; continue; }
    const paragraph = [line]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\$\$|[-*+]\s|\d+[.)]\s|>)/.test(lines[i].trim())) paragraph.push(lines[i++].trim());
    out += `<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`;
  }
  return out;
}

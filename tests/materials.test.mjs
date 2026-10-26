import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseTextMaterial, splitStudyBlocks, createMaterial, materialReview, validateFile, sectionComplete, requiredPhases } from '../src/materials.js';
import { newProgress, completePhase } from '../src/learning.js';

test('a real study document yields its own three headings and separate answer blocks', async () => {
  const text = await readFile(new URL('../assets/sample-material.md', import.meta.url), 'utf8');
  const doc = parseTextMaterial(text, 'uploaded-notes.md');
  assert.equal(doc.title, 'Vector Spaces');
  assert.deepEqual(doc.sections.map(s => s.title), ['4.3 — Basis', '4.4 — Coordinates', '4.5 — Dimension & Linear Independence']);
  const s = doc.sections[2];
  assert.ok(s.blocks.key.includes('\\mathbb{R}^n'));
  assert.ok(s.blocks.practice.includes('6 个 polynomials'));
  assert.ok(s.blocks.answer.includes('4\\times6'));
  assert.ok(!s.blocks.key.includes('最多只能有'));
  assert.deepEqual(s.progress.completed, [false, false, false, false]);
});

test('plain notes and numbered chapters remain readable without invented content', () => {
  const plain = parseTextMaterial('这是我自己的第一段笔记。\n\n这也是我自己的内容。', '自己的笔记.txt');
  assert.equal(plain.sections.length, 1);
  assert.ok(plain.sections[0].body.includes('这也是我自己的内容'));
  const numbered = parseTextMaterial('4.3 — Basis\n向量组\n\n4.4 — Coordinates\n坐标系数', 'notes.txt');
  assert.equal(numbered.sections.length, 2);
  assert.equal(numbered.sections[1].title, '4.4 — Coordinates');
});

test('code fences do not create fake chapters or swallow answers', () => {
  const parsed = parseTextMaterial('# Python\n\n## 第一章\n```python\n# not a heading\n```\n\n## 第二章\n实际内容', 'code.md');
  assert.equal(parsed.sections.length, 2);
  assert.ok(parsed.sections[0].body.includes('# not a heading'));
  const blocks = splitStudyBlocks('核心问题：为什么？\n\n正文\n### ANSWER\n正确内容');
  assert.equal(blocks.question, '为什么？');
  assert.equal(blocks.answer, '正确内容');
});

test('unsupported, empty and oversized files are rejected clearly', () => {
  assert.throws(() => validateFile({ name: 'x.exe', size: 5 }), /支持 PDF/);
  assert.throws(() => validateFile({ name: 'x.md', size: 0 }), /空的/);
  assert.throws(() => validateFile({ name: 'x.pdf', size: 26 * 1024 * 1024 }), /25 MB/);
  assert.doesNotThrow(() => validateFile({ name: 'notes.PDF', size: 500 }));
});

test('free navigation can complete one phase without filling untouched phases', () => {
  const p = newProgress();
  p.drafts[3] = '这是我独立回忆的概念、理由和新应用，经过资料核对已经确认没有关键疑问。';
  p.recallReviewed = true;
  assert.equal(completePhase(p, 3, { unordered: true }), true);
  assert.deepEqual(p.completed, [false, false, false, true]);
  assert.equal(sectionComplete(p, 'self'), false);
  assert.equal(sectionComplete(p, 'class'), false);
});

test('classroom mode defers practice and recall and never pretends the example is complete', () => {
  const p = newProgress();
  p.drafts[0] = '4'; p.understandingReviewed = true;
  assert.equal(completePhase(p, 0, { unordered: true, understandingMinLength: 1 }), true);
  assert.equal(sectionComplete(p, 'class'), false);
  p.practicePassed = true;
  completePhase(p, 2, { unordered: true });
  p.drafts[3] = '一个空间的维度就是基向量的个数，坐标向量包含同样数量的分量。';
  p.recallReviewed = true; completePhase(p, 3, { unordered: true });
  assert.deepEqual(requiredPhases('class'), [0, 2, 3]);
  assert.equal(sectionComplete(p, 'class'), true);
  assert.equal(sectionComplete(p, 'self'), false);
  assert.equal(p.completed[1], false);
});

test('reviews use the actual material section and retain earlier hint reviews', () => {
  const material = createMaterial(parseTextMaterial('## 第一节\n原文内容', 'my.md'), 'my.md', 'my-id');
  const now = new Date(2026, 9, 30, 12);
  materialReview(material, 'section-0', [1], '提示后巩固', now);
  materialReview(material, 'section-0', [1, 3, 7], '间隔回忆', now);
  assert.deepEqual(material.reviews.map(r => r.due), ['2026-10-31', '2026-11-02', '2026-11-06']);
});

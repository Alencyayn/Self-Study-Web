import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const profile = await mkdtemp(join(tmpdir(), 'study-studio-browser-'));
const browser = spawn(process.env.CHROMIUM_PATH || 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-allow-origins=*', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
let captureFailure;
try {
  const debug = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Browser did not become ready: ' + output.slice(-1000))), 15000);
    browser.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    browser.on('error', reject);
  });
  const origin = debug.replace('ws://', 'http://').split('/').slice(0, 3).join('/');
  const targets = await (await fetch(origin + '/json/list')).json();
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const callbacks = new Map(), events = new Map(), errors = [];
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const callback = callbacks.get(msg.id); callbacks.delete(msg.id); msg.error ? callback?.reject(msg.error) : callback?.resolve(msg.result); }
    if (events.has(msg.method)) { const done = events.get(msg.method); events.delete(msg.method); done(); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || ''));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') errors.push(msg.params.entry.text);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const currentId = ++id;
    const timeout = setTimeout(() => { callbacks.delete(currentId); reject(new Error('CDP timeout: ' + method)); }, 12000);
    callbacks.set(currentId, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } });
    ws.send(JSON.stringify({ id: currentId, method, params }));
  });
  const run = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const navigation = async action => {
    const loaded = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { events.delete('Page.loadEventFired'); reject(new Error('Navigation timeout')); }, 12000);
      events.set('Page.loadEventFired', () => { clearTimeout(timeout); resolve(); });
    });
    await action();
    await loaded;
  };
  const wait = async expression => {
    for (let attempt = 0; attempt < 300; attempt++) {
      if (await run(expression)) return;
      await new Promise(r => setTimeout(r, 60));
    }
    throw new Error('Timed out waiting for ' + expression);
  };
  const click = selector => run(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el || el.disabled) throw new Error('Missing or disabled: ' + ${JSON.stringify(selector)}); el.click(); })()`);
  const fill = (selector, value) => run(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  const checkAll = type => run(`document.querySelectorAll('[data-check="${type}"]').forEach(el => { el.checked = true; el.dispatchEvent(new Event('change', {bubbles:true})); });`);
  const screenshot = async (path, full = false) => {
    const size = full ? (await send('Page.getLayoutMetrics')).cssContentSize : null;
    const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: size.width, height: size.height, scale: 1 } } : {}) });
    await writeFile(path, Buffer.from(data.data, 'base64'));
  };
  captureFailure = () => screenshot('/tmp/zhixu-test-failure.png');
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  await send('Network.enable');
  await send('Page.setInterceptFileChooserDialog', { enabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__toneCount = 0; if (window.AudioContext) { const original = AudioContext.prototype.createOscillator; AudioContext.prototype.createOscillator = function() { window.__toneCount++; return original.call(this); }; }` });
  // Print a real, three-page PDF; the upload test must exercise the actual PDF worker.
  const frameId = (await send('Page.getFrameTree')).frameTree.frame.id;
  await send('Page.setDocumentContent', { frameId, html: '<!doctype html><html><head><style>@page{size:A4;margin:25mm}body{font-family:Arial}section:not(:last-child){break-after:page}h1{font-size:25px}p{font-size:14px;line-height:2}</style></head><body><section><h1>Basis from a real PDF</h1><p>A basis is a linearly independent spanning set. This is original uploaded content.</p></section><section><h1>Coordinates</h1><p>A coordinate vector records coefficients relative to the ordered basis.</p></section><section><h1>Dimension</h1><p>Unique PDF sentence: dimension counts the vectors in a basis.</p></section></body></html>' });
  const printed = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  const pdfPath = join(profile, 'uploaded-course.pdf');
  await writeFile(pdfPath, Buffer.from(printed.data, 'base64'));
  const mdPath = join(profile, 'my-vector-notes.md');
  await writeFile(mdPath, await readFile(new URL('../assets/sample-material.md', import.meta.url)));
  const mobilePath = join(profile, 'mobile-notes.md');
  await writeFile(mobilePath, '# My own notes\n\n## First concept\nThis is my own material.\n\n## Second concept\nA new explanation.\n\n## Third concept\n<img src=x onerror="window.injected=true"> This content is text, never markup.');
  const invalidPath = join(profile, 'not-a-document.exe'); await writeFile(invalidPath, 'not a study document');
  const upload = async (path, filename) => {
    const document = await send('DOM.getDocument');
    const node = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#file-input' });
    await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [path] });
    if (filename) {
      await wait(`(document.querySelector('#document-name').textContent === ${JSON.stringify(filename)} && !document.querySelector('#workspace').hidden && !document.querySelector('#library-dialog').open) || !document.querySelector('#upload-error').hidden`);
      const error = await run(`document.querySelector('#upload-error').hidden ? '' : document.querySelector('#upload-error').textContent`);
      if (error) throw new Error('Upload failed: ' + error);
    }
  };
  const setMode = mode => run(`(() => { const select = document.querySelector('#mode-switch'); select.value = ${JSON.stringify(mode)}; select.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  const check = async value => {
    if (value !== null) await fill('#study-answer', value);
    await click('[data-action="check"]');
    await run(`document.querySelectorAll('[data-check]').forEach(input => { input.checked = true; input.dispatchEvent(new Event('change', {bubbles:true})); });`);
    await click('[data-action="continue"]');
  };
  const chapterDone = index => run(`document.querySelector('[data-section="${index}"] .chapter-marker').classList.contains('is-complete')`);
  const completedStages = () => run(`[...document.querySelectorAll('.stage-link')].filter(b => b.querySelector('.is-complete')).map(b => Number(b.dataset.phase))`);

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigation(() => send('Page.navigate', { url: base }));
  await wait(`document.querySelector('#open-studio') && document.querySelector('#upload-icon svg')`);
  await run('document.fonts.ready');
  assert.equal(await run('document.title'), 'study studio');
  assert.equal(await run(`document.querySelector('#open-studio').textContent.replace(/\.$/, '')`), 'study studio');
  assert.equal(await run(`document.querySelector('#workspace').hidden`), true);
  assert.equal(await run(`(() => { const r = document.querySelector('#open-studio').getBoundingClientRect(); return Math.abs(r.left+r.width/2-innerWidth/2)<2 && Math.abs(r.top+r.height/2-innerHeight/2)<2; })()`), true, 'the single bold name is centered');
  await screenshot('/tmp/study-studio-home.png');
  await click('#start-button');
  await run('document.fonts.ready');
  assert.equal(await run(`document.documentElement.lang`), 'en');
  assert.equal(await run(`document.fonts.check('16px Inter')`), true, 'self-hosted Inter has loaded');
  assert.equal(await run(`getComputedStyle(document.querySelector('#library-title')).fontFamily.includes('Inter')`), true);
  assert.equal(await run(`getComputedStyle(document.querySelector('.dialog-description')).fontSize`), '15px', 'dialog copy is readable');
  assert.equal(await run(`document.querySelector('.sample-options').open`), false, 'secondary samples start collapsed');
  assert.equal(await run(`document.querySelector('#library-dialog').scrollWidth <= document.querySelector('#library-dialog').clientWidth`), true);
  await screenshot('/tmp/study-studio-import.png');
  assert.equal(await run(`document.querySelectorAll('[name="import-mode"]').length`), 2);
  await upload(mdPath, 'my-vector-notes.md');
  assert.equal(await run(`document.querySelectorAll('.chapter-link').length`), 3, 'uploaded headings become the table of contents');
  assert.deepEqual(await completedStages(), []);
  assert.equal(await run(`/[\\u4e00-\\u9fff]/.test(document.querySelector('#workspace').innerText)`), false, 'English material has an entirely English interface');
  await click('#open-library');
  assert.equal(await run(`document.querySelector('.material-link small').textContent`), '3 sections · 0 complete');
  await screenshot('/tmp/study-studio-library.png');
  await click('#library-dialog [data-close]');
  await click('[data-section="2"]');
  assert.equal(await run(`document.querySelector('.article-heading h1').textContent`), 'Dimension & Linear Independence');
  assert.equal(await run(`document.querySelectorAll('.katex').length > 0`), true);
  await run('document.fonts.ready'); await screenshot('/tmp/study-studio-reading.png');
  const expandedWidth = await run(`document.querySelector('#reading').getBoundingClientRect().left`);
  await click('#toc-toggle');
  assert.equal(await run(`document.querySelector('#toc-toggle').getAttribute('aria-expanded')`), 'false');
  assert.equal(await run(`document.querySelector('#reading').getBoundingClientRect().left < ${expandedWidth}`), true);
  await click('#toc-toggle');
  // Finish recall first, then practice and example. Navigation must never fill skipped phases.
  await click('[data-phase="3"]');
  assert.deepEqual(await completedStages(), []);
  await check('一个空间的维度就是其基向量的数量。坐标向量有n个分量，因此多于n列时无法每列都有主元。');
  assert.deepEqual(await completedStages(), [3]); assert.equal(await chapterDone(2), false);
  await click('[data-phase="2"]');
  assert.equal(await run(`!!document.querySelector('.hints')`), false);
  await click('[data-action="hint"]');
  assert.equal(await run(`document.querySelectorAll('.hint').length`), 1);
  await check('矩阵有4行6列，因为P3的基有4个向量，每个坐标向量有4个分量，6个多项式对应6列。');
  assert.deepEqual(await completedStages(), [2, 3]); assert.equal(await chapterDone(2), false);
  await click('[data-phase="1"]'); await check(null);
  assert.deepEqual(await completedStages(), [1, 2, 3]); assert.equal(await chapterDone(2), false);
  await click('[data-phase="0"]');
  await check('每个坐标向量有四个分量，所以矩阵有4行6列。维度限制了可能线性无关的向量个数。');
  assert.equal(await chapterDone(2), true, 'only the actually completed module gets a solid circle');
  assert.equal(await chapterDone(0), false);
  assert.equal(await run(`getComputedStyle(document.querySelector('[data-section="2"] .chapter-marker')).backgroundColor`), 'rgb(2, 132, 199)');
  assert.equal(await run(`document.querySelector('#celebration').hidden`), false, 'completion triggers full-screen confetti');
  assert.equal(await run(`window.__toneCount`), 4, 'completion schedules the four-note celebration sound');
  await run('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  assert.equal(await run(`(() => { const canvas = document.querySelector('#celebration'); return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0); })()`), true, 'confetti is visibly drawn across the viewport');
  await screenshot('/tmp/study-studio-celebration.png');
  await click('[data-action="reviews"]');
  assert.equal(await run(`document.querySelectorAll('.review-row').length`), 3, 'hint review and 1/3/7 day reviews are deduplicated');
  await click('.review-row');
  assert.equal(await run(`document.querySelector('#study-answer').value`), '', 'a spaced review starts closed-book');
  assert.equal(await run(`document.querySelector('[data-action="continue"]').disabled`), true);
  await click('[data-section="1"]');
  await run('new Promise(resolve => setTimeout(resolve, 200))');
  await navigation(() => send('Page.reload'));
  await wait(`document.querySelectorAll('.chapter-link').length === 3`);
  assert.equal(await chapterDone(2), true, 'uploaded material and truthful completion survive refresh');
  await click('[data-action="sound"]');
  assert.equal(await run(`document.querySelector('[data-action="sound"]').getAttribute('aria-pressed')`), 'false');
  // Classroom mode has a short concept check and gathers all work at the end.
  await setMode('class');
  assert.equal(await run(`document.querySelectorAll('.stage-link').length`), 3);
  await click('[data-section="0"]');
  assert.equal(await chapterDone(0), false);
  await check('这是一组最小的向量，能表示空间中每个向量。');
  assert.equal(await chapterDone(0), false, 'a classroom concept check does not complete practice or recall');
  await click('[data-action="batch"]');
  assert.equal(await run(`document.querySelectorAll('.batch-card').length`), 3);
  await fill('#batch-answer-0', '任意(x,y)可由(x-y)(1,0)+y(1,1)表示，齐次组合只有零解，因此构成基。');
  await click('[data-batch-start="0"]'); await check(null);
  assert.equal(await run(`!!document.querySelector('.batch-list')`), true, 'classroom practice returns to the batch');
  assert.equal(await chapterDone(0), false);
  await click('[data-batch-phase="3"]');
  await fill('#batch-answer-0', '基是线性无关且张成整个空间的一组向量，每个向量的线性组合表示唯一，增减向量会破坏条件。');
  await click('[data-batch-start="0"]'); await check(null);
  assert.equal(await chapterDone(0), true);
  assert.equal(await run(`document.querySelector('#celebration').hidden`), false);
  assert.equal(await run(`window.__toneCount`), 0, 'muted celebration still shows confetti without sound after refresh');
  await setMode('self');
  assert.equal(await chapterDone(0), false, 'switching modes never marks an uncompleted worked-example phase complete');
  await click('[data-section="0"]'); await click('[data-phase="1"]');
  assert.equal(await run(`!!document.querySelector('[data-phase="1"] .is-complete')`), false);

  // Real PDF upload and persistence, not a sample substituted for the file.
  await click('#open-library'); await upload(pdfPath, 'uploaded-course.pdf');
  assert.equal(await run(`document.querySelectorAll('.chapter-link').length`), 3);
  assert.equal(await run(`document.querySelector('.prose').textContent.includes('original uploaded content')`), true);
  await click('[data-section="2"]');
  assert.equal(await run(`document.querySelector('.prose').textContent.includes('Unique PDF sentence')`), true);
  assert.equal(await run(`document.querySelector('.reading-meta a').href.startsWith('blob:')`), true);
  await run('new Promise(resolve => setTimeout(resolve, 200))');
  await navigation(() => send('Page.reload'));
  await wait(`document.querySelector('#document-name').textContent === 'uploaded-course.pdf'`);
  assert.equal(await run(`document.querySelector('.prose').textContent.includes('Unique PDF sentence')`), true, 'original PDF and page contents survive refresh');
  await click('#open-library'); await upload(invalidPath);
  await wait(`!document.querySelector('#upload-error').hidden`);
  assert.equal(await run(`document.querySelector('#upload-error').textContent.includes('PDF')`), true);
  await click('#library-dialog [data-close]');
  assert.equal(await run(`document.querySelector('#document-name').textContent`), 'uploaded-course.pdf');

  // Mobile controls: drawer, arbitrary chapters, safe text, and centered home.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('#upload-another');
  assert.equal(await run(`document.querySelector('#upload-error').hidden`), true, 'reopening the library clears a previous upload error');
  assert.equal(await run(`document.querySelector('#library-dialog').scrollWidth <= document.querySelector('#library-dialog').clientWidth`), true);
  await screenshot('/tmp/study-studio-mobile-import.png');
  await upload(mobilePath, 'mobile-notes.md');
  assert.equal(await run(`document.querySelector('#toc-toggle').getAttribute('aria-expanded')`), 'false');
  await click('#toc-toggle'); await click('[data-section="2"]');
  assert.equal(await run(`document.querySelector('#toc-toggle').getAttribute('aria-expanded')`), 'false');
  assert.equal(await run(`window.injected === undefined && !document.querySelector('.prose img')`), true);
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, '390px has no horizontal overflow');
  await screenshot('/tmp/study-studio-mobile.png');
  await click('#toc-toggle'); await screenshot('/tmp/study-studio-mobile-contents.png');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  assert.equal(await run(`document.querySelector('#toc-toggle').getAttribute('aria-expanded')`), 'false');
  await click('#toc-toggle'); await click('[data-phase="2"]');
  await click('[data-action="rest"]');
  assert.equal(await run(`document.querySelector('#rest-dialog').open`), true);
  await click('#resume-learning');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, '320px has no horizontal overflow');
  await click('#back-home');
  await click('#start-button');
  assert.equal(await run(`document.querySelector('#library-dialog').scrollWidth <= document.querySelector('#library-dialog').clientWidth`), true, '320px import panel has no horizontal overflow');
  await click('#library-dialog [data-close]');
  assert.equal(await run(`document.querySelector('#home').hidden`), false);
  await screenshot('/tmp/study-studio-mobile-home.png');
  // App-provided samples move to English without resetting the learner's work.
  await run(`(async () => {
    const { parseTextMaterial, createMaterial } = await import('/src/materials.js');
    const parsed = parseTextMaterial(await (await fetch('/assets/sample-material.md')).text(), 'Vector Spaces.md');
    const old = createMaterial(parsed, '旧的示例资料', 'sample-vector-spaces', {kind:'sample', mode:'self'});
    old.description = '旧版说明';
    old.sections[0].body = '旧版内容'; old.sections[0].blocks.key = '旧版内容';
    old.sections[0].progress.completed[0] = true;
    old.sections[0].progress.drafts[0] = 'My original explanation is preserved.';
    old.sections[0].progress.understandingReviewed = true;
    await new Promise((resolve, reject) => { const request = indexedDB.open('study-studio-materials', 1); request.onsuccess = () => { const db = request.result; const tx = db.transaction('materials', 'readwrite'); tx.objectStore('materials').put(old); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
  })()`);
  await navigation(() => send('Page.reload'));
  await wait(`document.querySelector('#upload-icon svg')`);
  await click('#start-button'); await click('.sample-options summary'); await click('#open-sample');
  await wait(`document.querySelector('#document-name').textContent === 'Vector Spaces · Sample' && !document.querySelector('#library-dialog').open`);
  assert.equal(await run(`document.querySelector('.source-section').textContent.includes('smallest complete coordinate language')`), true);
  assert.deepEqual(await completedStages(), [0], 'sample translation preserves the exact completed stages');
  assert.equal(await run(`document.querySelector('#study-answer').value`), 'My original explanation is preserved.');
  await click('#upload-another'); await click('#open-builtin');
  await wait(`document.querySelector('#document-name').textContent === 'Built-in lessons'`);
  assert.equal(await run(`document.querySelector('.article-heading h1').textContent`), 'The kernel of a transformation');
  assert.equal(await run(`/[\\u4e00-\\u9fff]/.test(document.querySelector('#workspace').innerText)`), false, 'built-in course content is also English');
  assert.deepEqual(errors, [], 'no browser JavaScript, worker, or asset errors');
  console.log('PASS: sky-blue English UI, self-hosted Inter, prominent start button, aligned simplified import dialog, preserved sample progress; centered home; actual Markdown and three-page PDF uploads; original-content rendering; math; persistent documents and drafts; collapsible responsive contents; both modes; batch classroom work; arbitrary stage/chapter access without false completion; theme-colored completed circles; full-screen confetti, sound and mute; reviews; mobile; safe file errors and HTML escaping.');
  console.log('Screenshots: /tmp/study-studio-{home,reading,celebration,mobile,mobile-contents}.png');
} catch (error) {
  await captureFailure?.();
  throw error;
} finally {
  ws?.close();
  if (browser.pid && browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill('SIGTERM'); await exited;
  }
  await rm(profile, { recursive: true, force: true });
}

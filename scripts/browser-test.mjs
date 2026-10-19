import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const base = process.env.TEST_URL || 'http://127.0.0.1:3000';
const profile = await mkdtemp(join(tmpdir(), 'zhixu-browser-'));
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
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
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
    for (let attempt = 0; attempt < 100; attempt++) {
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await navigation(() => send('Page.navigate', { url: base }));
  await wait(`document.querySelectorAll('.module-card').length === 3`);
  await run('localStorage.clear()');
  await navigation(() => send('Page.reload'));
  await wait(`document.querySelectorAll('.module-card').length === 3 && document.querySelector('#focus-title').textContent === '线性变换的核'`);
  await run('document.fonts.ready');
  await screenshot('/tmp/zhixu-desktop.png');
  await screenshot('/tmp/zhixu-desktop-full.png', true);
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, 'desktop has no horizontal overflow');
  await click('[data-filter="complete"]');
  assert.equal(await run(`document.querySelector('.filter-empty h3').textContent`), '掌握，是一步一步发生的。');
  await click('[data-filter="all"]');
  await click('#change-topic');
  await click('[data-topic="derivative"]');
  assert.equal(await run(`document.querySelector('#focus-title').textContent`), '导数的直觉');
  await click('#change-topic'); await click('[data-topic="kernel"]');
  await click('#start-learning');
  assert.equal(await run(`document.querySelector('[data-action="next"]').disabled`), true, 'cannot skip understanding');
  assert.equal(await run(`document.querySelector('[data-phase="2"]').disabled`), true, 'practice starts locked');
  await fill('#understanding-answer', '核是所有被变换映射到零向量的输入向量组成的集合，不是输出。');
  await click('[data-action="understanding-check"]'); await checkAll('understanding');
  await click('[data-action="close"]'); await click('#start-learning');
  assert.equal(await run(`document.querySelector('[data-check="understanding"]').checked`), true, 'understanding self check survives reopening');
  await click('[data-action="next"]');
  assert.equal(await run(`document.querySelector('.lesson-topbar>.eyebrow').textContent.includes('WORKED')`), true);
  await click('[data-action="pace"][data-pace="slow"]');
  assert.equal(await run(`!!document.querySelector('.deeper-note')`), true);
  await click('[data-action="next"]');
  assert.equal(await run(`!!document.querySelector('.hint-list')`), false, 'hints stay hidden initially');
  await click('[data-action="hint"]');
  assert.equal(await run(`document.querySelectorAll('.hint-card').length`), 1, 'only requested hint revealed');
  await fill('#practice-answer', 'ker(T) = {t(-2,1) | t为实数}，因为 x+2y=0，所以是一条过原点的直线。');
  await click('[data-action="practice-check"]'); await checkAll('practice'); await click('[data-action="practice-confirm"]');
  assert.equal(await run(`!!document.querySelector('.standard-answer')`), true);
  await click('[data-action="close"]'); await click('#start-learning');
  assert.equal(await run(`!!document.querySelector('.standard-answer')`), true, 'practice confirmation survives reopening');
  await screenshot('/tmp/zhixu-lesson.png');
  await click('[data-action="next"]');
  assert.equal(await run(`document.querySelector('#focus-status').textContent.startsWith('○')`), true, 'three phases do not mark module complete');
  await fill('#recall-answer', '核是映射到零向量的所有输入组成的集合。T(0)=0，所以零向量在核里。T(u)=T(v)则T(u-v)=0，若核只有零向量，则u=v。');
  await click('[data-action="recall-check"]'); await checkAll('recall'); await click('[data-action="finish"]');
  assert.equal(await run(`!!document.querySelector('.completion-mark')`), true);
  await click('[data-action="close"]');
  assert.equal(await run(`document.querySelector('#focus-status').textContent.startsWith('✓')`), true);
  assert.equal(await run(`document.querySelectorAll('.review-item').length`), 3, '1,3,7 day review schedule without duplicate hint review');
  await navigation(() => send('Page.reload'));
  await wait(`document.querySelector('#focus-status')?.textContent.startsWith('✓')`);
  assert.equal(await run(`document.querySelectorAll('.review-item').length`), 3, 'progress and reviews survive reload');
  await click('[data-review]');
  assert.equal(await run(`document.querySelector('#recall-answer').value`), '', 'new review does not leak saved recall');
  assert.equal(await run(`document.querySelector('[data-action="finish"]').disabled`), true);
  await fill('#recall-answer', '核是满足T(v)=0的输入向量的集合，零向量一定在里面。如果核只有零向量，则T(u)=T(v)说明u=v。');
  await click('[data-action="recall-check"]'); await checkAll('recall'); await click('[data-action="finish"]'); await click('[data-action="close"]');
  assert.equal(await run(`document.querySelectorAll('.review-item').length`), 2);
  await click('[data-course="recursion"]');
  await fill('#understanding-answer', '递归要有基本情况，调用时问题要变小，才能到达终止条件而不是无限调用。');
  await click('[data-action="understanding-check"]'); await checkAll('understanding');
  await click('[data-action="next"]'); await click('[data-action="next"]');
  for (let i = 0; i < 4; i++) await click('[data-action="hint"]');
  assert.equal(await run(`document.querySelectorAll('.hint-card').length`), 4);
  await fill('#practice-answer', 'factorial(4) = 24');
  await click('[data-action="practice-check"]'); await checkAll('practice');
  assert.equal(await run(`document.querySelector('[data-action="practice-confirm"]').disabled`), true, 'viewing full solution requires a new independent attempt');
  await click('[data-action="another"]');
  assert.equal(await run(`!!document.querySelector('.hint-list')`), false, 'new exercise starts without hints');
  await fill('#practice-answer', 'factorial(5) = 120，如果参数不减少就无法到达基本情况，会导致调用栈溢出。');
  await click('[data-action="practice-check"]'); await checkAll('practice'); await click('[data-action="practice-confirm"]');
  await click('[data-action="defer"]');
  await click('#timer-toggle');
  assert.equal(await run(`JSON.parse(localStorage.getItem('zhixu-study-v1')).timer.running`), true);
  await click('#timer-toggle');
  assert.equal(await run(`JSON.parse(localStorage.getItem('zhixu-study-v1')).timer.running`), false);
  await click('#reset-timer');
  assert.equal(await run(`document.querySelector('#timer-display').textContent`), '60:00');
  // A fresh mobile context also verifies that the saved desktop layout is not required.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await run('localStorage.clear()');
  await navigation(() => send('Page.reload'));
  await wait(`document.querySelectorAll('.module-card').length === 3 && document.querySelector('#focus-status').textContent.startsWith('○')`);
  await run('document.fonts.ready');
  await screenshot('/tmp/zhixu-mobile.png');
  await screenshot('/tmp/zhixu-mobile-full.png', true);
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, 'mobile has no horizontal overflow');
  await click('#start-learning');
  assert.equal(await run(`document.querySelector('#lesson-dialog').scrollWidth <= document.querySelector('#lesson-dialog').clientWidth`), true, 'mobile dialog has no horizontal overflow');
  await screenshot('/tmp/zhixu-mobile-lesson.png');
  await fill('#understanding-answer', '<img src=x onerror="window.injected=true"> 核是输入向量的集合。');
  await click('[data-action="rest"]');
  assert.equal(await run(`JSON.parse(localStorage.getItem('zhixu-study-v1')).timer.running`), false, 'rest pauses timer');
  await click('[data-action="resume"]');
  assert.equal(await run('window.injected === undefined'), true, 'draft content cannot inject HTML');
  assert.equal(await run(`document.querySelector('#understanding-answer').value.startsWith('<img')`), true, 'draft preserved across rest');
  await click('[data-action="defer"]');
  assert.equal(await run(`document.querySelectorAll('.review-item').length`), 1, 'deferral creates review without completion');
  assert.equal(await run(`document.querySelector('#focus-status').textContent.startsWith('○')`), true);
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, '320px has no horizontal overflow');
  assert.deepEqual(errors, [], 'browser has no JavaScript or asset errors');
  console.log('PASS: desktop/mobile layout, module filters, topic switching, four-stage gates, optional hints, pacing, recall, review scheduling/completion, persistence, timer, rest, deferral, and safe input.');
  console.log('Screenshots: /tmp/zhixu-{desktop,lesson,mobile,mobile-lesson}.png');
} catch (error) {
  await captureFailure?.();
  throw error;
} finally {
  ws?.close();
  browser.kill('SIGTERM');
  await new Promise(resolve => browser.once('exit', resolve));
  await rm(profile, { recursive: true, force: true });
}

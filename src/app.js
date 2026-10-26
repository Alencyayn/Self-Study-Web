import { courses, phases } from './courses.js';
import { newProgress, restoreState, STORAGE_KEY, nextPhase, completePhase, timerSeconds, formatTime, localDate, escapeHTML as e, evaluatePractice } from './learning.js';
import { validateFile, parseTextMaterial, parsePdfMaterial, createMaterial, materialReview, requiredPhases, sectionComplete } from './materials.js';
import { listMaterials, storeMaterial } from './storage.js';
import { markdown } from './markdown.js';
import { celebrate, soundEnabled, setSoundEnabled } from './celebration.js';

const $ = (selector, root = document) => root.querySelector(selector);
const icons = {
  sidebar: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m5-10-2 2 2 2"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m4-10 2 2-2 2"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>',
  bookmark: '<svg viewBox="0 0 20 20" fill="none"><path d="M5 17V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v13l-5-3-5 3Z"/></svg>',
  play: '<svg viewBox="0 0 20 20"><path d="m7 4 9 6-9 6Z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg viewBox="0 0 20 20"><path d="M6 4h3v12H6zm5 0h3v12h-3Z" fill="currentColor" stroke="none"/></svg>'
};
let materials = [], current = null, phase = 0, busy = false, transient = {}, sidebarOpen = !matchMedia('(max-width: 760px)').matches, pdfURL = null, reviewId = null;
let storageOkay = true, storageWarned = false, toastTimeout;
let timer = { remaining: 3600, running: false, endsAt: null };
try { timer = restoreState(localStorage.getItem(STORAGE_KEY)).timer; } catch { /* Browser storage is optional. */ }
let writes = Promise.resolve();
let importMode = 'self';
const isDone = (p, mode = current?.mode || 'self') => sectionComplete(p, mode);
const nextRequired = p => requiredPhases(current?.mode).find(i => !p.completed[i]) ?? 3;
const section = () => current?.sections[current.selected];
const progress = () => section()?.progress;
const countDone = p => p.completed.filter(Boolean).length;
function toast(text) {
  clearTimeout(toastTimeout); $('#toast').textContent = text; $('#toast').hidden = false;
  toastTimeout = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}
function announce(text) { $('#announcer').textContent = text; }
function storageFailure() {
  storageOkay = false;
  if (!storageWarned) { storageWarned = true; toast('当前浏览器暂时无法保存资料，本次仍可学习，关闭页面后记录可能丢失。'); }
}
function save() {
  if (!current || !storageOkay) return;
  const copy = structuredClone(current);
  writes = writes.then(() => storeMaterial(copy)).catch(storageFailure);
}
function saveTimer() {
  try {
    const old = restoreState(localStorage.getItem(STORAGE_KEY)); old.timer = timer;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
  } catch { /* Timer remains usable without persistence. */ }
}
function currentDraft() { return reviewId && phase === 3 ? transient.reviewDraft || '' : progress().drafts[phase]; }
function stageChecks() {
  const s = section(), c = s.courseId && courses.find(c => c.id === s.courseId);
  if (c) return phase === 0 ? c.understandingChecks : phase === 1 ? ['我能解释示范中的关键步骤，以及每一步为什么必要。'] : phase === 2 ? c.variants[progress().variant].rubric : c.recallRubric;
  return [
    ['我能用自己的话解释这一节的核心概念。', '我能说明它为什么成立或在什么情况下有用。'],
    ['我能解释示范中各个关键步骤的理由。', '我能区分已理解的部分和仍需要补充的部分。'],
    ['我已独立写出完整思路，而不只是最后的结论。', '我已对照资料检查概念、推理和计算，修正了发现的问题。'],
    ['我没有看资料，独立复述了核心概念或方法。', '我能解释为什么，并举出一个不同于资料的应用情境。', '我已核对资料，确认没有尚未解决的关键疑问。']
  ][phase];
}
function checkedIndexes() {
  const p = progress();
  const confirmed = phase === 0 ? p.understandingReviewed : phase === 1 ? p.exampleReviewed : phase === 2 ? p.practicePassed : reviewId ? transient.reviewChecked : p.recallReviewed;
  return confirmed ? stageChecks().map((_, i) => i) : transient.checks || [];
}
function canContinue() {
  const p = progress();
  if (p.completed[phase] && !reviewId) return true;
  return phase === 0 ? p.understandingReviewed && p.drafts[0].trim().length >= (current.mode === 'class' ? 1 : 8) : phase === 1 ? p.exampleReviewed : phase === 2 ? p.practicePassed && p.hints < 4 : (reviewId ? transient.reviewChecked : p.recallReviewed) && currentDraft().trim().length >= 16;
}

function renderSidebar() {
  if (!current) return;
  const s = section(), p = progress(), totalDone = current.sections.filter(s => isDone(s.progress)).length;
  const reviews = current.reviews.filter(r => !r.done);
  $('#study-sidebar').innerHTML = `
    <div class="sidebar-intro"><p class="eyebrow">${e(current.title)} / STUDY BOOKMARK</p><h2>学习路线</h2><p class="sidebar-description">${e(current.description)}</p></div>
    <nav class="contents-nav" aria-label="章节目录">${current.sections.map((item, i) => {
      const done = isDone(item.progress), active = i === current.selected;
      const status = done ? '已完成 · 已通过回忆自检' : active ? `当前位置 · ${phases[phase].title}` : countDone(item.progress) > 0 ? `已学习 · 待${phases[nextRequired(item.progress)].title}` : '尚未开始';
      return `<button class="chapter-link ${active ? 'current' : ''}" data-section="${i}" ${active ? 'aria-current="location"' : ''}><span class="chapter-marker ${done ? 'status-circle is-complete' : active ? 'bookmark-icon' : 'status-circle'}" aria-label="${done ? '已完成' : '未完成'}">${!done && active ? icons.bookmark : ''}</span><span><strong>${e(item.title)}</strong><small>${status}</small></span></button>`;
    }).join('')}</nav>
    ${current.mode === 'class' ? '<button class="batch-link" data-action="batch">课后集中练习 <span>↗</span></button>' : ''}<div class="current-module"><p class="eyebrow">CURRENT MODULE / ${current.mode === 'class' ? '课上自学' : '自学'}</p><nav class="phase-nav" aria-label="当前模块的学习阶段">${phases.map((item, i) => !requiredPhases(current.mode).includes(i) ? '' : `<button class="stage-link ${phase === i ? 'current' : ''}" data-phase="${i}" ${reviewId && i !== 3 ? 'disabled' : ''} ${phase === i ? 'aria-current="step"' : ''}><span class="status-circle ${p.completed[i] ? 'is-complete' : phase === i ? 'is-current' : ''}" aria-label="${p.completed[i] ? '已完成' : '未完成'}"></span><span>0${requiredPhases(current.mode).indexOf(i) + 1} — ${['Understanding', 'Worked Examples', 'Independent Practice', 'Active Recall'][i]}</span></button>`).join('')}</nav><p class="progress-note">${current.mode === 'class' ? '课上理解，课后集中练习与回忆。<br>三个环节均完成后，模块圆点才会填满。' : '完成全部四阶段自检后，<br>模块圆点才会填满。'}</p><p class="progress-summary">${totalDone} / ${current.sections.length} 个模块已完成</p></div>
    <div class="sidebar-footer"><div class="focus-timer"><button class="timer-control" id="timer-toggle" aria-label="${timer.running ? '暂停专注计时' : '开始专注计时'}">${timer.running ? icons.pause : icons.play}</button><span id="timer-value">${formatTime(timerSeconds(timer))}</span><button class="plain-button reset-timer" data-action="reset-timer" aria-label="重置计时器">↺</button><button class="plain-button rest-button" data-action="rest">休息一下</button></div><button class="sidebar-review-link" data-action="reviews">复习安排 <span>${reviews.length ? String(reviews.length).padStart(2, '0') : '—'}</span></button><button class="sound-preference" data-action="sound" aria-pressed="${soundEnabled()}">庆祝音效 <span>${soundEnabled() ? '开' : '关'}</span></button></div>`;
  updateSidebar();
}
function updateSidebar() {
  const mobile = matchMedia('(max-width: 760px)').matches;
  $('#workspace').classList.toggle('sidebar-collapsed', !sidebarOpen);
  $('#workspace').classList.toggle('sidebar-open', sidebarOpen);
  $('#study-sidebar').inert = !sidebarOpen;
  $('#toc-toggle').innerHTML = sidebarOpen ? icons.sidebar : icons.expand;
  $('#toc-toggle').setAttribute('aria-expanded', String(sidebarOpen));
  $('#toc-toggle').setAttribute('aria-label', sidebarOpen ? '收起目录' : '展开目录');
  $('#sidebar-backdrop').hidden = !(mobile && sidebarOpen);
  document.body.classList.toggle('mobile-sidebar-open', mobile && sidebarOpen && !$('#workspace').hidden);
}
function toggleSidebar() { sidebarOpen = !sidebarOpen; updateSidebar(); }
function bodyForPhase() {
  const s = section(), c = s.courseId && courses.find(c => c.id === s.courseId), p = progress();
  if (c) {
    if (phase === 0) return `<p>${c.concise}</p><p>${c.deeper}</p>`;
    if (phase === 1) return `<p>${c.examplePrompt}</p><ol>${c.steps.map(([title, detail]) => `<li><strong>${title}</strong><p>${detail}</p></li>`).join('')}</ol>`;
    return '';
  }
  if (phase === 0) return markdown(s.blocks.key || s.body);
  if (phase === 1) return s.blocks.example ? markdown(s.blocks.example) : `<p class="source-note">这份资料没有单独标注完整例题。选一个其中的例子、证明或操作过程，逐步解释它为什么成立。</p>${markdown(s.blocks.key || s.body)}`;
  return '';
}
function questionForPhase() {
  const s = section(), c = s.courseId && courses.find(c => c.id === s.courseId);
  if (phase === 0 && current.mode === 'class') {
    const simple = c ? { kernel: '零向量一定在核里吗？用一句话解释为什么。', derivative: '物体的速度为零，就说明它的位置为零吗？', recursion: '阶乘函数遇到 n ≤ 1 就返回 1，这是终止条件，还是继续递归的步骤？' }[c.id] : current.id === 'sample-vector-spaces' ? ['标准基 {(1, 0), (0, 1)} 包含几个向量？', '若 v = 2b₁ + 3b₂，那么 [v]ᵦ 的两个坐标是什么？', 'P₃ 的标准基为 {1, t, t², t³}，它的维度是多少？'][current.selected] : `请用一句话解释「${s.title}」，并举一个最简单的例子。`;
    return markdown(simple);
  }
  if (c) return phase === 0 ? markdown(c.question) : phase === 1 ? '<p>试着用自己的话解释一个关键步骤。（选填）</p>' : phase === 2 ? markdown(c.variants[progress().variant].prompt) : `<ol>${c.recallQuestions.map(q => `<li>${e(q)}</li>`).join('')}</ol>`;
  if (phase === 0) return s.blocks.practice ? markdown(s.blocks.practice) : `<p>用自己的话解释「${e(s.title)}」的核心想法。为什么需要它？</p>`;
  if (phase === 1) return '<p>这个例子最重要的一步是什么？为什么这样做？（笔记选填）</p>';
  if (phase === 2) return s.blocks.practice ? markdown(s.blocks.practice) : `<p>先合上资料，为「${e(s.title)}」写一个新的例子或实际应用，并独立完成。记下你的推理与验证过程。</p>`;
  return `<ol><li>不看资料，用自己的话解释「${e(s.title)}」的核心概念。</li><li>回想一个重要结论或步骤，并说明为什么。</li><li>换一个新情境，你会怎样运用它？</li></ol>`;
}
function checksHTML() {
  const checked = checkedIndexes();
  return `<div class="self-checks">${stageChecks().map((text, i) => `<label><input type="checkbox" data-check="${i}" ${checked.includes(i) ? 'checked' : ''}><span>${e(text)}</span></label>`).join('')}</div>`;
}
function referenceAnswer() {
  const s = section(), c = s.courseId && courses.find(c => c.id === s.courseId);
  if (c) return phase === 3 ? e(c.recallAnswer) : markdown(c.variants[progress().variant].solution);
  return markdown(s.blocks.answer || s.blocks.key || s.body);
}
function feedbackHTML() {
  if (!transient.showCheck && !canContinue()) return '';
  const p = progress();
  if (phase === 1 && !transient.showCheck && !p.exampleReviewed) return '';
  const f = transient.feedback;
  const showReference = phase === 3 || phase === 2 && p.practicePassed;
  return `<section class="check-panel" aria-label="自检标准"><div class="block-label"><span>${f?.title ? e(f.title) : phase === 3 ? 'CHECK YOUR RECALL' : 'SELF CHECK'}</span><span>对照自检</span></div>${f ? `<p>${e(f.text)}</p>` : `<p>对照资料，确认自己能独立解释。尚不确定的部分，可以只回到对应阶段。</p>`}${showReference ? `<details class="reference-answer"><summary>展开参考内容</summary><div class="prose">${referenceAnswer()}</div></details>` : ''}${f?.status === 'retry' || f?.status === 'empty' ? '' : checksHTML()}${phase === 2 && progress().hints >= 4 ? '<p class="helper-note">你已看过完整参考。请先隐藏解答、重新独立尝试，再确认完成。</p><button class="secondary-button" data-action="retry">隐藏参考，重新尝试</button>' : ''}</section>`;
}
function hintsHTML() {
  const p = progress(), s = section(), c = s.courseId && courses.find(c => c.id === s.courseId);
  const hints = c ? c.variants[p.variant].hints : ['先回忆这一节的定义：对象是什么，需要满足什么条件？', '把已知条件与目标分别列出来，找一个能把两者连接起来的概念或步骤。', '回看本节示范中最接近的一步，再隐藏资料，尝试解释下一步应该怎样做。'];
  return p.hints ? `<div class="hints">${hints.slice(0, p.hints).map((hint, i) => `<div class="hint"><span>0${i + 1} / ${['概念', '方法', '下一步'][i]}提示</span><p>${e(hint)}</p></div>`).join('')}${p.hints >= 4 ? `<div class="hint"><span>04 / 参考内容</span><div class="prose">${referenceAnswer()}</div></div>` : ''}<p class="helper-note">使用提示的部分已加入明天复习，不代表整道题失败。</p></div>` : '';
}
function completeHTML() {
  return `<div class="completion"><span class="completion-circle"></span><p class="eyebrow">ONE SMALL STEP, TRULY YOURS.</p><h1 tabindex="-1">这一节，真正学会了。</h1><p>${e(section().title)} · ${current.mode === 'class' ? '课堂理解、集中练习和回忆已完成' : '四阶段自检已完成'}。<br>已安排第 1、3、7 天的间隔回忆。</p><div class="completion-days"><span>+1<small>天后回想</small></span><span>+3<small>天后巩固</small></span><span>+7<small>天后迁移</small></span></div><button class="primary-button" data-action="next-section">${current.selected < current.sections.length - 1 ? '继续下一个模块' : '回到这一节'} <span>→</span></button></div>`;
}
function renderBatch() {
  const target = transient.batchPhase || 2;
  $('#reading').innerHTML = `<div class="reading-meta"><span>AFTER CLASS / ALL CHAPTERS</span><span>课上自学</span></div><header class="article-heading"><h1 tabindex="-1">课后，把知识连起来。</h1><p>课堂里先理解。现在集中练习，再用闭卷回忆检查掌握。</p></header><div class="batch-tabs"><button data-batch-phase="2" aria-pressed="${target === 2}">独立练习</button><button data-batch-phase="3" aria-pressed="${target === 3}">闭卷回忆</button></div><div class="batch-list">${current.sections.map((s, i) => {
    const c = s.courseId && courses.find(c => c.id === s.courseId);
    const question = target === 3 ? `不看资料，解释「${s.title}」的核心概念、为什么成立，以及一个新情境中的应用。` : c ? c.variants[s.progress.variant].prompt : s.blocks.practice || `为「${s.title}」写一个新的例子或实际应用，并独立完成。`;
    return `<section class="batch-card"><div class="batch-card-heading"><span class="status-circle ${s.progress.completed[target] ? 'is-complete' : ''}"></span><h2>${e(s.title)}</h2></div><div class="prose">${markdown(question)}</div><label class="sr-only" for="batch-answer-${i}">第 ${i + 1} 节的${target === 2 ? '独立练习' : '闭卷回忆'}</label><textarea class="answer-input" id="batch-answer-${i}" data-batch-draft="${i}" maxlength="12000" rows="3" placeholder="${target === 3 ? '先不看资料，写下你能回想起来的……' : '写下你的独立思路……'}">${e(s.progress.drafts[target])}</textarea><button class="secondary-button" data-batch-start="${i}">${s.progress.completed[target] ? '回看这次自检' : '检查与继续'} ↗</button></section>`;
  }).join('')}</div>`;
}
function renderReading(focus = false) {
  if (!current) return;
  const s = section(), p = progress(), source = current.filename.replace(/\.[^.]+$/, '');
  if (transient.batch) { renderBatch(); return; }
  if (transient.complete) { $('#reading').innerHTML = completeHTML(); return; }
  const fullTitle = s.title.replace(/^\d+(?:\.\d+)*\s*[—–-]?\s*/, '');
  const headingQuestion = s.blocks.question || (phase === 0 ? '一次弄懂一个小知识点，把理解变成自己的能力。' : phases[phase].description);
  $('#reading').innerHTML = `
    ${transient.fromBatch ? '<button class="text-button batch-back" data-action="batch">← 返回集中练习</button>' : ''}<div class="reading-meta"><span>${e(s.page ? `${source} / PAGE ${String(s.page).padStart(2, '0')}` : `${source} / SECTION ${String(current.selected + 1).padStart(2, '0')}`)}</span>${pdfURL ? `<a href="${pdfURL}#page=${s.page || 1}" target="_blank" rel="noopener">查看原文件 ↗</a>` : '<span class="saved-indicator">本机保存</span>'}</div>
    <header class="article-heading"><h1 tabindex="-1">${e(fullTitle)}</h1><p>${phase === 0 && s.blocks.question ? '核心问题：' : ''}${e(headingQuestion)}</p></header>
    ${phase < 2 ? `<section class="source-section"><div class="block-label"><span>${phase === 0 ? 'THE KEY IDEA' : 'WORKED EXAMPLE'}</span><span>${phases[phase].title}</span></div>${current.scanned ? `<p class="source-note">这份 PDF 没有可提取的文字，先按原稿页码阅读。</p><iframe class="pdf-source" title="资料原页" src="${pdfURL}#page=${s.page || 1}&view=FitH"></iframe>` : `<div class="prose">${bodyForPhase()}</div>`}</section>` : ''}
    ${phase === 3 ? `<p class="recall-note">先合上资料，从记忆中写下来。完成后再核对。</p>` : ''}
    <section class="question-section"><div class="block-label"><span>${[current.mode === 'class' ? 'ONE SIMPLE CHECK' : 'QUICK CHECK / 01', 'YOUR UNDERSTANDING', 'TRY IT YOURSELF', reviewId ? 'SPACED RECALL' : 'ACTIVE RECALL'][phase]}</span><span>${['Understanding', 'Worked Examples', 'Independent Practice', 'Active Recall'][phase]}</span></div><div class="prose question-text">${questionForPhase()}</div><label class="sr-only" for="study-answer">${phases[phase].title}的回答</label><textarea id="study-answer" class="answer-input" maxlength="12000" rows="4" placeholder="${phase === 3 ? '合上资料，写下你记得的概念、理由与应用……' : '写下你的判断和理由……'}">${e(currentDraft())}</textarea><div class="answer-toolbar">${phase === 2 ? `<button class="text-button" data-action="hint" ${p.hints >= 4 ? 'disabled' : ''}>${p.hints === 0 ? '需要一点提示？' : p.hints === 3 ? '查看完整参考' : '再提示一点'}${p.hints ? ` (${p.hints}/4)` : ''}</button>` : '<span class="answer-note">用自己的话表达，不用追求完美。</span>'}<button class="secondary-button" data-action="check">${phase === 1 ? '我能解释关键步骤' : phase === 3 ? '写好了，对照自检' : '检查我的思路'} <span>↗</span></button></div>${phase === 2 ? hintsHTML() : ''}${feedbackHTML()}</section>
    <div class="learning-controls"><div class="pace-control"><span>学习节奏</span>${[['slow', '慢一点'], ['normal', '合适'], ['fast', '快一点']].map(([value, label]) => `<button data-pace="${value}" aria-pressed="${p.pace === value}">${label}</button>`).join('')}</div><button class="text-button" data-action="defer">这节先放一放 ↗</button></div>
    ${p.pace === 'slow' ? '<p class="pace-note">一次只处理一个问题。可以先写下已确定的部分，再找出最不清楚的一步。无需重学已经掌握的内容。</p>' : ''}
    <footer class="reading-footer"><span>${phase === 3 ? '独立练习与回忆自检完成后，模块圆点才会填满。' : '理解与自检确认后，再进入下一步。'}</span><button class="primary-button" data-action="continue" ${!canContinue() ? 'disabled' : ''}>${phase === 3 ? reviewId ? '完成这次复习' : '确认这次回忆' : current.mode === 'class' && phase === 0 ? '理解了 · 继续跟课' : current.mode === 'class' && phase === 2 ? '确认练习 · 返回集中练习' : ['继续 · 完整例题', '继续 · 独立练习', '继续 · 闭卷回忆'][phase]} <span>→</span></button></footer>`;
  if (focus) { window.scrollTo({ top: 0 }); $('h1', $('#reading'))?.focus({ preventScroll: true }); }
}
function render() { renderSidebar(); renderReading(); $('#document-name').textContent = current?.filename || ''; tickTimer(); }
function resetTransient() { transient = {}; }
function goPhase(index) {
  if (!Number.isInteger(index) || index < 0 || index > 3 || reviewId && index !== 3) return;
  if (matchMedia('(max-width:760px)').matches) sidebarOpen = false;
  phase = index; current.phase = index; resetTransient(); save(); renderSidebar(); renderReading(true);
}
function openSection(index) {
  if (!current.sections[index]) return;
  reviewId = null; current.selected = index; phase = current.mode === 'class' || isDone(progress()) ? 0 : nextPhase(progress()); current.phase = phase;
  resetTransient(); if (matchMedia('(max-width:760px)').matches) sidebarOpen = false;
  save(); render(); window.scrollTo({ top: 0 });
}
function openMaterial(material) {
  current = material; current.reviews ||= [];
  if (pdfURL) URL.revokeObjectURL(pdfURL);
  pdfURL = current.fileBlob ? URL.createObjectURL(current.fileBlob) : null;
  current.selected = Math.min(Math.max(0, current.selected || 0), current.sections.length - 1);
  current.mode ||= importMode; $('#mode-switch').value = current.mode; phase = Number.isInteger(current.phase) && current.phase >= 0 && current.phase <= 3 ? current.phase : 0; reviewId = null; resetTransient();
  importMode = current.mode;
  if (current.mode === 'class' && phase === 1) phase = 0;
  $('#home').hidden = true; $('#workspace').hidden = false;
  $('#library-dialog').close(); $('#upload-error').hidden = true;
  sidebarOpen = !matchMedia('(max-width:760px)').matches;
  render(); window.scrollTo({ top: 0 });
  try { sessionStorage.setItem('study-studio-current', current.id); } catch { /* Optional resume. */ }
}
function home() {
  save(); $('#workspace').hidden = true; $('#home').hidden = false; document.body.classList.remove('mobile-sidebar-open');
  try { sessionStorage.removeItem('study-studio-current'); } catch { /* Optional resume. */ }
  $('#open-studio').focus(); window.scrollTo({ top: 0 });
}
function renderLibrary() {
  const visible = [...materials].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  $('#saved-materials').innerHTML = visible.length ? `<p class="eyebrow library-label">YOUR MATERIALS</p>${visible.map(m => `<button class="material-link" data-material="${e(m.id)}"><span class="material-initial">${m.kind === 'pdf' ? 'PDF' : m.id === 'builtin-courses' ? 'ABC' : 'TXT'}</span><span><strong>${e(m.title)}</strong><small>${m.sections.length} 个模块 · ${m.sections.filter(s => isDone(s.progress, m.mode)).length} 个完成</small></span><span aria-hidden="true">↗</span></button>`).join('')}` : '';
}
function showLibrary() {
  renderLibrary();
  document.querySelectorAll('[name="import-mode"]').forEach(input => { input.checked = input.value === importMode; });
  $('#library-dialog').showModal();
}
async function fileId(bytes) {
  if (crypto.subtle) { const hash = await crypto.subtle.digest('SHA-256', bytes); return 'file-' + [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join(''); }
  return `file-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
async function importFile(file) {
  if (busy || !file) return;
  busy = true; $('#pick-file').disabled = true; $('#upload-error').hidden = true;
  if (!$('#library-dialog').open) showLibrary();
  $('#upload-status').hidden = false; $('#upload-status-text').textContent = '正在读取资料…';
  try {
    validateFile(file);
    const bytes = await file.arrayBuffer(), id = await fileId(bytes);
    const previous = materials.find(m => m.id === id);
    if (previous) { openMaterial(previous); toast('已打开这份资料，上次的进度已保留。'); return; }
    let parsed;
    const pdf = /\.pdf$/i.test(file.name);
    if (pdf) parsed = await parsePdfMaterial(bytes, file.name, text => { $('#upload-status-text').textContent = text; });
    else {
      let text = new TextDecoder('utf-8').decode(bytes);
      if ((text.match(/\uFFFD/g)?.length || 0) > 2) text = new TextDecoder('gb18030').decode(bytes);
      parsed = parseTextMaterial(text, file.name);
    }
    const material = createMaterial(parsed, file.name, id, { kind: pdf ? 'pdf' : 'text', mode: importMode, scanned: !!parsed.scanned, ...(pdf ? { fileBlob: new Blob([bytes], { type: 'application/pdf' }) } : {}) });
    materials.push(material); current = material; save(); await writes;
    openMaterial(material); announce(`已导入 ${file.name}，生成 ${material.sections.length} 个目录项`);
  } catch (error) {
    $('#upload-error').textContent = error.message || '资料读取失败，请换一份文件重试。'; $('#upload-error').hidden = false;
  } finally { busy = false; $('#pick-file').disabled = false; $('#upload-status').hidden = true; $('#file-input').value = ''; }
}
async function openSample() {
  const existing = materials.find(m => m.id === 'sample-vector-spaces');
  if (existing) { openMaterial(existing); return; }
  try {
    const response = await fetch('/assets/sample-material.md');
    if (!response.ok) throw new Error('示例资料暂时无法读取。');
    const parsed = parseTextMaterial(await response.text(), 'Vector Spaces.md');
    const material = createMaterial(parsed, 'Vector Spaces · 示例资料', 'sample-vector-spaces', { kind: 'sample', mode: importMode });
    materials.push(material); current = material; save(); openMaterial(material);
  } catch (error) { toast(error.message); }
}
function openBuiltin() {
  let existing = materials.find(m => m.id === 'builtin-courses');
  if (!existing) {
    let legacy;
    try { legacy = restoreState(localStorage.getItem(STORAGE_KEY)); } catch { legacy = restoreState(); }
    existing = createMaterial({ title: '三个小知识点', description: '线性变换的核、导数的直觉与递归。原有学习记录会继续保留。', sections: courses.map(c => ({ id: c.id, title: c.title, courseId: c.id, body: c.concise, blocks: { question: c.description }, progress: legacy.modules[c.id] || newProgress() })) }, '内置练习', 'builtin-courses', { kind: 'builtin', mode: importMode });
    existing.reviews = legacy.reviews.map(r => ({ ...r, sectionId: r.moduleId }));
    materials.push(existing); current = existing; save();
  }
  openMaterial(existing);
}
function continueLearning() {
  const p = progress();
  if (!canContinue()) return;
  if (reviewId) {
    const review = current.reviews.find(r => r.id === reviewId); if (review) review.done = true;
    reviewId = null; resetTransient(); save(); pauseTimer(); render(); toast('这一次回忆已完成，记录已保存。'); return;
  }
  const wasDone = isDone(p);
  if (!completePhase(p, phase, { unordered: true, understandingMinLength: current.mode === 'class' ? 1 : 8 })) return;
  if (isDone(p) && !wasDone) {
    if (!wasDone) materialReview(current, section().id);
    transient.complete = true; pauseTimer(); save(); render(); celebrate(); announce('模块已完成，目录圆点已填为主题色。');
  } else if (current.mode === 'class') {
    save();
    if (phase === 0 && current.selected < current.sections.length - 1) { openSection(current.selected + 1); phase = 0; current.phase = 0; save(); render(); }
    else { transient = { batch: true, batchPhase: phase === 3 ? 3 : 2 }; render(); window.scrollTo({ top: 0 }); }
  } else { phase = phase < 3 ? phase + 1 : nextPhase(p); current.phase = phase; resetTransient(); save(); render(); window.scrollTo({ top: 0 }); }
}
function tickTimer() {
  const seconds = timerSeconds(timer);
  if (timer.running && seconds === 0) { timer.running = false; timer.remaining = 0; timer.endsAt = null; saveTimer(); toast('专注时间到了。休息一下，再检查今天留下了什么。'); }
  if ($('#timer-value')) $('#timer-value').textContent = formatTime(seconds);
  if ($('#timer-toggle')) { $('#timer-toggle').innerHTML = timer.running ? icons.pause : icons.play; $('#timer-toggle').setAttribute('aria-label', timer.running ? '暂停专注计时' : '开始专注计时'); }
}
function toggleTimer() {
  if (timer.running) { timer.remaining = timerSeconds(timer); timer.running = false; timer.endsAt = null; }
  else { if (!timer.remaining) timer.remaining = 3600; timer.endsAt = Date.now() + timer.remaining * 1000; timer.running = true; }
  saveTimer(); tickTimer();
}
function pauseTimer() { if (timer.running) toggleTimer(); }
function showReviews() {
  const items = current.reviews.filter(r => !r.done).sort((a, b) => a.due.localeCompare(b.due));
  $('#reviews-list').innerHTML = items.length ? items.map(r => `<button class="review-row" data-review="${e(r.id)}"><span>${e(r.due.slice(5).replace('-', ' / '))}</span><span><strong>${e(current.sections.find(s => s.id === r.sectionId)?.title || '')}</strong><small>${e(r.reason)} · ${r.due <= localDate() ? '可以开始了' : '也可以提前回忆'}</small></span><span>↗</span></button>`).join('') : '<p class="empty-note">完成一个模块后，这里会安排第 1、3、7 天的回忆。使用过提示的部分，也会单独加入复习。</p>';
  $('#reviews-dialog').showModal();
}

$('#reading').addEventListener('input', event => {
  if (event.target.matches('[data-batch-draft]')) {
    const p = current.sections[Number(event.target.dataset.batchDraft)].progress, i = transient.batchPhase;
    p.drafts[i] = event.target.value; if (i === 2) p.practicePassed = false; else p.recallReviewed = false; save(); return;
  }
  if (event.target.id !== 'study-answer') return;
  const p = progress(), value = event.target.value;
  if (reviewId && phase === 3) transient.reviewDraft = value; else p.drafts[phase] = value;
  if (phase === 0) p.understandingReviewed = false;
  if (phase === 1) p.exampleReviewed = false;
  if (phase === 2) p.practicePassed = false;
  if (phase === 3) { p.recallReviewed = false; transient.reviewChecked = false; }
  transient.showCheck = false; transient.checks = []; transient.feedback = null;
  $('.check-panel')?.remove();
  $('[data-action="continue"]').disabled = !canContinue();
  save();
});
$('#reading').addEventListener('change', event => {
  if (!event.target.matches('[data-check]')) return;
  const checked = [...$('#reading').querySelectorAll('[data-check]:checked')].map(input => Number(input.dataset.check));
  transient.checks = checked;
  const all = checked.length === stageChecks().length, p = progress();
  if (phase === 0) p.understandingReviewed = all;
  if (phase === 1) p.exampleReviewed = all;
  if (phase === 2) p.practicePassed = all && p.hints < 4;
  if (phase === 3) { if (reviewId) transient.reviewChecked = all; else p.recallReviewed = all; }
  if (phase === 2 && p.practicePassed && !$('.reference-answer')) {
    $('.check-panel').insertAdjacentHTML('beforeend', `<details class="reference-answer"><summary>核对标准思路</summary><div class="prose">${referenceAnswer()}</div></details>`);
  }
  $('[data-action="continue"]').disabled = !canContinue(); save();
});
$('#workspace').addEventListener('click', event => {
  const batchTab = event.target.closest('[data-batch-phase]'), batchStart = event.target.closest('[data-batch-start]');
  if (batchTab) { transient.batchPhase = Number(batchTab.dataset.batchPhase); renderReading(); return; }
  if (batchStart) { const i = Number(batchStart.dataset.batchStart), target = transient.batchPhase; current.selected = i; phase = target; current.phase = phase; transient = { fromBatch: true }; save(); render(); window.scrollTo({ top: 0 }); return; }
  const chapter = event.target.closest('[data-section]'), stage = event.target.closest('[data-phase]'), action = event.target.closest('[data-action]'), pace = event.target.closest('[data-pace]');
  if (chapter) { openSection(Number(chapter.dataset.section)); return; }
  if (stage) { goPhase(Number(stage.dataset.phase)); return; }
  if (pace) { progress().pace = pace.dataset.pace; save(); renderReading(); toast(progress().pace === 'slow' ? '放慢一点，只处理当前这个问题。' : progress().pace === 'fast' ? '精简引导，按熟悉的节奏前进。' : '保持合适的节奏。'); return; }
  if (event.target.closest('#timer-toggle')) { toggleTimer(); return; }
  if (!action) return;
  const p = progress();
  switch (action.dataset.action) {
    case 'check':
      if (phase !== 1 && currentDraft().trim().length < (phase === 3 ? 16 : phase === 0 && current.mode === 'class' ? 1 : 8)) { toast(phase === 3 ? '先闭卷写下你的回忆，至少 16 个字，再核对。' : current.mode === 'class' && phase === 0 ? '先写下这道简单题的回答。' : '先写一点自己的尝试，至少 8 个字，再来检查。'); $('#study-answer').focus(); return; }
      transient.showCheck = true; transient.checks = [];
      if (phase === 2 && section().courseId) transient.feedback = evaluatePractice(section().courseId, p.variant, currentDraft());
      renderReading(); $('.check-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'continue': continueLearning(); break;
    case 'hint':
      if (p.hints >= 4) return;
      p.hints++; p.practicePassed = false; transient.checks = []; materialReview(current, section().id, [1], '提示后巩固'); save(); renderReading(); $('.hints')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'retry':
      p.hints = 0; p.drafts[2] = ''; p.practicePassed = false;
      if (section().courseId) p.variant = p.variant === 0 ? 1 : 0;
      resetTransient(); save(); renderReading(); $('#study-answer').focus(); break;
    case 'defer': materialReview(current, section().id, [1], '稍后再学'); pauseTimer(); save(); renderSidebar(); toast('已留到明天。其他进度保留，不必从头开始。'); break;
    case 'rest': pauseTimer(); save(); $('#rest-dialog').showModal(); break;
    case 'reset-timer': timer = { remaining: 3600, running: false, endsAt: null }; saveTimer(); tickTimer(); break;
    case 'reviews': showReviews(); break;
    case 'sound': setSoundEnabled(!soundEnabled()); renderSidebar(); break;
    case 'batch': transient = { batch: true, batchPhase: phase === 3 ? 3 : 2 }; render(); window.scrollTo({ top: 0 }); break;
    case 'next-section': if (current.mode === 'class') { transient = { batch: true, batchPhase: 3 }; render(); break; } openSection(current.selected < current.sections.length - 1 ? current.selected + 1 : current.selected); break;
  }
});
$('#mode-switch').addEventListener('change', event => { current.mode = event.target.value; importMode = current.mode; if (current.mode === 'class' && phase === 1) phase = 0; resetTransient(); save(); render(); toast(current.mode === 'class' ? '课上自学：概念配一道简单题，练习与复习放到课后集中做。' : '自学：保留四阶段学习，目录与阶段都可以自由选择。'); });
document.querySelectorAll('[name="import-mode"]').forEach(input => input.addEventListener('change', () => { importMode = input.value; }));
$('#open-studio').addEventListener('click', showLibrary);
$('#back-home').addEventListener('click', home);
$('#open-library').addEventListener('click', showLibrary);
$('#pick-file').addEventListener('click', () => $('#file-input').click());
$('#upload-another').innerHTML = icons.upload;
$('#upload-another').addEventListener('click', () => { showLibrary(); $('#file-input').click(); });
$('#upload-icon').innerHTML = icons.upload;
$('#file-input').addEventListener('change', event => importFile(event.target.files[0]));
$('#open-sample').addEventListener('click', openSample);
$('#open-builtin').addEventListener('click', openBuiltin);
$('#saved-materials').addEventListener('click', event => { const button = event.target.closest('[data-material]'); if (button) openMaterial(materials.find(m => m.id === button.dataset.material)); });
$('#toc-toggle').addEventListener('click', toggleSidebar);
$('#sidebar-backdrop').addEventListener('click', toggleSidebar);
$('#resume-learning').addEventListener('click', () => $('#rest-dialog').close());
$('#reviews-list').addEventListener('click', event => {
  const button = event.target.closest('[data-review]'); if (!button) return;
  const r = current.reviews.find(r => r.id === button.dataset.review);
  current.selected = current.sections.findIndex(s => s.id === r.sectionId); phase = 3; reviewId = r.id; resetTransient();
  $('#reviews-dialog').close(); render(); window.scrollTo({ top: 0 });
});
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { if (!busy) button.closest('dialog').close(); }));
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (!busy && event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });
});
let dragDepth = 0;
document.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; $('#drop-overlay').hidden = false; } });
document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
document.addEventListener('dragleave', event => { if (event.dataTransfer?.types.includes('Files')) { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#drop-overlay').hidden = true; } });
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; if (event.dataTransfer.files.length > 1) toast('一次先专注一份资料，已读取第一个文件。'); importFile(event.dataTransfer.files[0]); });
document.addEventListener('keydown', event => {
  if (matchMedia('(max-width:760px)').matches && sidebarOpen && !$('#workspace').hidden) {
    if (event.key === 'Escape') { sidebarOpen = false; updateSidebar(); $('#toc-toggle').focus(); }
    if (event.key === 'Tab') {
      const elements = [$('#toc-toggle'), ...$('#study-sidebar').querySelectorAll('button:not(:disabled)')];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
});
matchMedia('(max-width:760px)').addEventListener('change', event => { sidebarOpen = !event.matches; updateSidebar(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTimer(); });
setInterval(tickTimer, 1000);
async function init() {
  try { materials = (await listMaterials()).filter(m => m && Array.isArray(m.sections) && m.sections.length); }
  catch { storageFailure(); }
  try { const id = sessionStorage.getItem('study-studio-current'); const old = materials.find(m => m.id === id); if (old) openMaterial(old); } catch { /* Home still works. */ }
}
init();

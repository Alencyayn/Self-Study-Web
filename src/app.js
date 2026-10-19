import { courses, phases, art } from './courses.js';
import { STORAGE_KEY, restoreState, nextPhase, isMastered, completePhase, localDate, addReview, scheduleReviews, timerSeconds, formatTime, escapeHTML as e, evaluatePractice } from './learning.js';

const $ = (selector, root = document) => root.querySelector(selector);
let storageAvailable = true;
let stored;
try { stored = localStorage.getItem(STORAGE_KEY); } catch { storageAvailable = false; }
const state = restoreState(stored);
let activeFilter = 'all';
let lesson = null;
let toastTimeout;
function save() {
  if (!storageAvailable) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {
    storageAvailable = false;
    toast('浏览器暂时无法保存记录。本次学习仍可继续，关闭页面后记录可能丢失。');
  }
}
function toast(message) {
  const element = $('#toast');
  clearTimeout(toastTimeout);
  element.textContent = message;
  element.hidden = false;
  toastTimeout = setTimeout(() => { element.hidden = true; }, 4800);
}
function announce(message) { $('#announcer').textContent = message; }
const getCourse = id => courses.find(c => c.id === id);
const selectedCourse = () => getCourse(state.selected);
const countDone = p => p.completed.filter(Boolean).length;

function drawTorus() {
  const point = (u, v) => {
    const radius = 83 + 31 * Math.cos(v);
    const x = radius * Math.cos(u), y = radius * Math.sin(u), z = 31 * Math.sin(v);
    const y1 = y * Math.cos(1.0) - z * Math.sin(1.0);
    const angle = -.42;
    return [(x * Math.cos(angle) - y1 * Math.sin(angle)) * 1.43 + 222, (x * Math.sin(angle) + y1 * Math.cos(angle)) * 1.43 + 124];
  };
  let paths = '';
  const path = points => points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join('') + 'Z';
  for (let j = 0; j < 34; j++) {
    const u = j / 34 * Math.PI * 2;
    paths += `<path d="${path(Array.from({ length: 65 }, (_, k) => point(u, k / 64 * Math.PI * 2)))}"/>`;
  }
  for (let j = 0; j < 15; j++) {
    const v = j / 15 * Math.PI * 2;
    paths += `<path d="${path(Array.from({ length: 101 }, (_, k) => point(k / 100 * Math.PI * 2, v)))}"/>`;
  }
  $('#torus').innerHTML = `<g fill="none" stroke="currentColor" stroke-width=".56" opacity=".69">${paths}</g><path d="M42 213h27m-13-13v26" stroke="currentColor" stroke-width=".7" opacity=".4"/><text x="364" y="44" font-family="Georgia" font-size="11" font-style="italic" fill="currentColor" opacity=".6">∞</text>`;
}

function renderFocus() {
  const course = selectedCourse();
  const p = state.modules[course.id];
  $('#focus-subject').textContent = course.subject;
  $('#focus-title').textContent = course.title;
  $('#focus-english').textContent = course.english;
  $('#focus-description').textContent = course.description;
  $('#focus-visual').innerHTML = art[course.id];
  $('#focus-progress').innerHTML = phases.map((phase, i) => `<div class="phase-item ${p.completed[i] ? 'done' : i === nextPhase(p) ? 'current' : ''}"><span>PHASE 0${i + 1}</span><div><b>${p.completed[i] ? '✓' : '○'}</b>${phase.title}</div></div>`).join('');
  const started = countDone(p) > 0 || p.drafts.some(Boolean);
  $('#focus-status').textContent = isMastered(p) ? '✓ 已完成回忆自检 · 4 / 4' : started ? `○ 正在${phases[nextPhase(p)].title} · ${countDone(p)} / 4` : '○ 尚未开始 · 4 个学习阶段';
  $('#start-learning').innerHTML = `${isMastered(p) ? '回顾这个知识点' : started ? '继续今天的学习' : '开始今天的学习'} <span aria-hidden="true">↗</span>`;
}
function renderModules() {
  const visible = courses.filter(c => {
    const p = state.modules[c.id];
    return activeFilter === 'all' || activeFilter === 'complete' && isMastered(p) || activeFilter === 'progress' && !isMastered(p) && (countDone(p) > 0 || p.drafts.some(Boolean));
  });
  $('#module-grid').innerHTML = visible.length ? visible.map(course => {
    const p = state.modules[course.id];
    const started = countDone(p) > 0 || p.drafts.some(Boolean);
    return `<article class="module-card ${course.id === state.selected ? 'selected' : ''}"><div class="module-card-top"><span>${course.number} / ${course.subject}</span><span class="module-state"><b>${isMastered(p) ? '✓' : '○'}</b>${isMastered(p) ? '已掌握' : started ? '学习中' : '待探索'}</span></div><div class="module-body"><div><h3>${course.title}</h3><p>${course.short}</p></div><div class="module-art">${art[course.id]}</div></div><div class="module-bottom"><div class="mini-progress" aria-label="已完成 ${countDone(p)} 个阶段，共 4 个">${p.completed.map(done => `<i class="${done ? 'done' : ''}"></i>`).join('')}</div><button data-course="${course.id}">${isMastered(p) ? '回顾学习' : started ? '继续学习' : '开始探索'} <span aria-hidden="true">↗</span></button></div></article>`;
  }).join('') : `<div class="filter-empty"><span>○</span><h3>${activeFilter === 'complete' ? '掌握，是一步一步发生的。' : '你的下一步，从好奇开始。'}</h3><p>${activeFilter === 'complete' ? '完成四个阶段和回忆自检，模块才会出现在这里。' : '挑一个想弄懂的小问题，开始第一段学习。'}</p><button class="text-button" id="show-all-modules">看看全部模块 <span>↗</span></button></div>`;
}
function renderReviews() {
  const pending = state.reviews.filter(r => !r.done).sort((a, b) => a.due.localeCompare(b.due));
  const dueCount = pending.filter(r => r.due <= localDate()).length;
  $('#review-count').hidden = !dueCount;
  $('#review-count').textContent = dueCount;
  $('#review-list').innerHTML = pending.length ? pending.map(review => {
    const course = getCourse(review.moduleId);
    const date = new Date(review.due + 'T12:00:00');
    const due = review.due <= localDate();
    return `<article class="review-item"><div class="review-day">${date.getDate()}<small>${date.getMonth() + 1} 月</small></div><div><h4>○ ${course.title}</h4><p>${due ? '现在就可以温故' : date.toLocaleDateString('zh-CN', { weekday: 'long' })} · ${e(review.reason)}</p></div><button data-review="${e(review.id)}">${due ? '开始回忆' : '提前回忆'} ↗</button></article>`;
  }).join('') : `<div class="review-empty"><div class="empty-flower" aria-hidden="true"><svg class="spark-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M20 4v32M4 20h32M8.7 8.7l22.6 22.6M8.7 31.3 31.3 8.7"/></svg></div><h4>还没有待复习的知识点</h4><p>安心完成今天的小目标。<br>值得记住的知识，我们会陪你再遇见。</p><button class="text-button" id="review-start">先学一点新东西 <span aria-hidden="true">↗</span></button></div>`;
}
function renderHome() { renderFocus(); renderModules(); renderReviews(); }
function setFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === filter);
    button.setAttribute('aria-pressed', button.dataset.filter === filter);
  });
  renderModules();
}
function selectTopic(id) {
  state.selected = id;
  save(); renderHome();
}
function renderTopics() {
  $('#topic-options').innerHTML = courses.map(course => `<button class="topic-option ${course.id === state.selected ? 'selected' : ''}" data-topic="${course.id}"><span>${course.id === state.selected ? '✓' : '○'}</span><div><h3>${course.title}</h3><p>${course.subject} · 约 60 分钟</p></div><span aria-hidden="true">↗</span></button>`).join('');
}

function tickTimer() {
  const seconds = timerSeconds(state.timer);
  if (state.timer.running && seconds === 0) {
    state.timer.running = false; state.timer.remaining = 0; state.timer.endsAt = null;
    save(); toast('这一段专注结束了。伸个懒腰，再看看哪些知识真正留了下来。');
  }
  const formatted = formatTime(seconds);
  $('#timer-display').textContent = formatted;
  $('#timer-caption').textContent = state.timer.running ? '专注当下，不必赶路' : seconds === 0 ? '给自己一点休息时间' : seconds < 3600 ? '暂停一下，也是一种进步' : '按自己的节奏，也很好';
  $('#timer-toggle').setAttribute('aria-label', state.timer.running ? '暂停专注计时' : seconds === 0 ? '重新开始专注计时' : '开始专注计时');
  $('#timer-toggle').innerHTML = state.timer.running ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4h3v12H6zm5 0h3v12h-3z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 9 6-9 6Z" fill="currentColor"/></svg>';
  if ($('#lesson-clock')) $('#lesson-clock').textContent = formatted;
  if ($('#lesson-timer-toggle')) $('#lesson-timer-toggle').textContent = state.timer.running ? '暂停' : '继续';
}
function toggleTimer() {
  if (state.timer.running) {
    state.timer.remaining = timerSeconds(state.timer); state.timer.running = false; state.timer.endsAt = null;
  } else {
    if (!state.timer.remaining) state.timer.remaining = 3600;
    state.timer.endsAt = Date.now() + state.timer.remaining * 1000; state.timer.running = true;
  }
  save(); tickTimer();
}
function pauseTimer() {
  if (state.timer.running) toggleTimer();
}

function openLesson(id, reviewId = null) {
  if (!getCourse(id)) return;
  selectTopic(id);
  const review = reviewId ? state.reviews.find(r => r.id === reviewId) : null;
  const p = state.modules[id], c = getCourse(id);
  lesson = { id, phase: review ? 3 : isMastered(p) ? 0 : nextPhase(p), reviewId: review?.id || null, view: 'content', checks: {
    understanding: p.understandingReviewed ? c.understandingChecks.map((_, i) => i) : [],
    practice: p.practicePassed ? c.variants[p.variant].rubric.map((_, i) => i) : [],
    recall: !review && p.recallReviewed ? c.recallRubric.map((_, i) => i) : []
  }, feedback: p.practicePassed ? { status: 'recognized', title: '你的练习自检已保存。', text: '可以核对标准思路，然后进入闭卷回忆。' } : null, understandingOpen: false, recallOpen: false, reviewDraft: '', reviewChecked: false };
  renderLesson();
  $('#lesson-dialog').showModal();
  if (!state.timer.running && state.timer.remaining === 3600) toggleTimer();
}
function closeLesson() { $('#lesson-dialog').close(); lesson = null; renderHome(); }
const phaseLabel = index => `0${index + 1} / ${phases[index].english}`;
function lessonFrame(content) {
  const c = getCourse(lesson.id), p = state.modules[c.id];
  return `<div class="lesson-shell"><aside class="lesson-sidebar"><a href="#" class="lesson-brand" data-action="close">知序<span style="font-family:var(--latin);font-size:13px;letter-spacing:0;margin-left:9px">study studio</span></a><span class="eyebrow">YOUR LEARNING PATH</span><h3>${c.title}</h3><nav class="lesson-stage-nav" aria-label="学习阶段">${phases.map((phase, i) => `<button class="lesson-stage-button ${i === lesson.phase ? 'current' : ''}" data-action="phase" data-phase="${i}" ${i > nextPhase(p) && !lesson.reviewId ? 'disabled' : ''} ${lesson.reviewId && i !== 3 ? 'disabled' : ''} ${i === lesson.phase ? 'aria-current="step"' : ''}><span>${p.completed[i] ? '✓' : '○'}</span>${phase.title}<span>${phase.minutes}′</span></button>`).join('')}</nav><div class="sidebar-bottom"><p>不急着走完，<br>只认真走好每一步。</p><button class="text-button" data-action="defer">把这个知识点留到明天 ↗</button><div class="local-label">内置课程引导 · 本机保存<br>学习记录由你的练习与自检确认</div></div></aside><div class="lesson-main"><div class="lesson-topbar"><span class="eyebrow">${lesson.reviewId ? 'SPACED REPETITION / 温故知新' : phaseLabel(lesson.phase)}</span><div class="lesson-tools"><span class="lesson-clock" id="lesson-clock">${formatTime(timerSeconds(state.timer))}</span><button class="lesson-pause" id="lesson-timer-toggle" data-action="timer">${state.timer.running ? '暂停' : '继续'}</button><button class="icon-button" data-action="close" aria-label="关闭学习面板">×</button></div></div>${content}</div></div>`;
}
function paceControls() {
  const p = state.modules[lesson.id];
  return `<div class="pace-selector"><span>目前的节奏，对你来说怎么样？</span>${[['slow', '慢一点'], ['normal', '刚刚好'], ['fast', '快一点']].map(([value, label]) => `<button data-action="pace" data-pace="${value}" aria-pressed="${p.pace === value}">${label}</button>`).join('')}<button data-action="rest">休息一下 ↗</button></div>`;
}
function checksHTML(items, type) {
  return `<div class="self-checks">${items.map((text, i) => `<label><input type="checkbox" data-check="${type}" data-index="${i}" ${lesson.checks[type]?.includes(i) ? 'checked' : ''}/><span>${text}</span></label>`).join('')}</div>`;
}
function allChecked(type, length) { return lesson.checks[type]?.length === length; }
function understandingHTML() {
  const c = getCourse(lesson.id), p = state.modules[c.id];
  return `<h2 id="lesson-title" class="lesson-title">${c.conceptTitle}</h2><p class="lesson-subtitle">${phases[0].description} 今天只需要弄懂这一件事。</p><div class="concept-block"><h4>${c.title}</h4>${p.pace === 'fast' ? `<p>${c.concise}</p>` : c.concept}<div class="concept-visual">${art[c.id]}<p>${c.visualCaption}</p></div></div>${p.pace === 'slow' ? `<p class="deeper-note">${c.deeper}</p>` : ''}<div class="self-question"><label for="understanding-answer">先停一下，试着解释给自己听。</label><p>${c.question}</p><textarea id="understanding-answer" class="answer-input" data-draft="0" maxlength="12000" placeholder="不用追求完美，用自己的话写下你的理解……">${e(p.drafts[0])}</textarea><div class="answer-actions"><span class="dialog-footnote" style="margin:0">写下来，能帮你发现真正的卡点。</span><button class="secondary-button" data-action="understanding-check">对照自检 ↗</button></div></div>${lesson.understandingOpen || p.understandingReviewed ? `<div class="feedback-box"><h4>把概念放回自己的语言里。</h4><p>${c.understandingChecks[0]}</p>${checksHTML(c.understandingChecks, 'understanding')}</div>` : ''}${paceControls()}<div class="lesson-footer"><p>○ 理解后再继续，无需赶时间。</p><button class="primary-button" data-action="next" ${!(p.understandingReviewed && p.drafts[0].trim().length >= 8) && !p.completed[0] ? 'disabled' : ''}>理解了，看看例题 <span>↗</span></button></div>`;
}
function exampleHTML() {
  const c = getCourse(lesson.id), p = state.modules[c.id];
  return `<h2 id="lesson-title" class="lesson-title">看见答案背后的思考。</h2><p class="lesson-subtitle">不急着记住步骤。先试着解释：这一步，为什么要这样做？</p><div class="practice-question">${c.examplePrompt}</div><ol class="example-steps">${c.steps.map(([title, detail]) => `<li><strong>${title}</strong>${p.pace !== 'fast' ? `<p>${detail}</p>` : `<p>${detail.split('。')[0]}。</p>`}</li>`).join('')}</ol>${p.pace === 'slow' ? `<p class="deeper-note">如果有一步卡住，先回到“建立理解”看一看。不用把已经懂的部分重新学一遍。</p>` : ''}${paceControls()}<div class="lesson-footer"><p>确认能解释每一步后，再开始尝试。</p><button class="primary-button" data-action="next">我理解了，自己试试 <span>↗</span></button></div>`;
}
function practiceHTML() {
  const c = getCourse(lesson.id), p = state.modules[c.id], v = c.variants[p.variant];
  const feedback = lesson.feedback;
  const canCheck = feedback && ['recognized', 'manual'].includes(feedback.status);
  return `<h2 id="lesson-title" class="lesson-title">这一次，把思考交给自己。</h2><p class="lesson-subtitle">答案先收好。遇到困难，先写下确定的那一步，再按需查看提示。</p><div class="practice-question">${v.prompt}<p>请写出完整思路，不只是最终答案。</p></div><label class="answer-label" for="practice-answer">我的解题过程</label><textarea id="practice-answer" class="answer-input" data-draft="2" maxlength="12000" rows="5" placeholder="在这里自由书写。可以分行、列式，也可以先描述你的想法。">${e(p.drafts[2])}</textarea><div class="answer-actions"><button class="secondary-button" data-action="hint" ${p.hints >= 4 ? 'disabled' : ''}>${p.hints === 0 ? '给我一点提示' : p.hints === 3 ? '确实需要，查看完整解答' : p.hints >= 4 ? '提示已全部展开' : '再提示一点'} <span>${Math.min(p.hints, 4)} / 4</span></button><button class="primary-button" data-action="practice-check">检查我的思路 <span>↗</span></button></div>${p.hints > 0 ? `<div class="hint-list">${v.hints.slice(0, p.hints).map((hint, i) => `<div class="hint-card"><small>${['01 / 概念提示', '02 / 方法提示', '03 / 下一步提示'][i]}</small>${hint}</div>`).join('')}${p.hints === 4 ? `<div class="hint-card"><small>04 / 完整解答</small><p style="white-space:pre-line">${v.solution}</p></div>` : ''}</div><p class="hint-notice">用过提示的部分值得再见一次，已加入明天的复习。它不代表整道题失败。${p.hints === 4 ? '看过解答后，请换一道题独立尝试，再确认完成。' : ''}</p>` : ''}${feedback ? `<div class="feedback-box" role="status"><h4>${feedback.title}</h4><p>${feedback.text}</p>${canCheck && !p.practicePassed ? `${checksHTML(v.rubric, 'practice')}<button class="secondary-button" data-action="practice-confirm" ${!allChecked('practice', v.rubric.length) || p.hints === 4 ? 'disabled' : ''}>我已逐项确认</button>` : ''}${p.practicePassed ? `<div class="standard-answer"><strong>✓ 已完成练习自检 · 标准思路</strong>\n${v.solution}</div><div class="next-choices"><button class="primary-button" data-action="next">进入闭卷回忆 <span>↗</span></button><button class="secondary-button" data-action="another">再练一道题</button></div><p class="practice-benefit">再练一题的预计收益：${p.hints ? '高' : p.variant === 0 ? '中' : '低'}。${p.variant === 0 ? '换一组条件，检验能否迁移方法，补足“看懂但还不熟练”的部分。' : '同类问题的收益正在降低，可以优先进入回忆阶段。'}</p>` : ''}</div>` : ''}${p.hints === 4 ? '<button class="secondary-button" data-action="another">换一道题，独立尝试 ↗</button>' : ''}<div class="weakness-options"><button data-action="weakness" data-weakness="concept">概念还不清楚</button><button data-action="weakness" data-weakness="method">步骤卡住了</button><button data-action="defer">这题先放一放</button><button data-action="rest">有点累了，休息一下</button></div>`;
}
function recallHTML() {
  const c = getCourse(lesson.id), p = state.modules[c.id];
  const draft = lesson.reviewId ? lesson.reviewDraft : p.drafts[3];
  const reviewed = lesson.reviewId ? lesson.reviewChecked : p.recallReviewed;
  return `${lesson.reviewId ? '<span class="review-session-label">间隔复习 · 每次回想，都在加深连接</span>' : ''}<h2 id="lesson-title" class="lesson-title">合上资料，看看留下了什么。</h2><p class="lesson-subtitle">不用一字不差。能独立解释，并在新情境里使用，才是这一次的目标。</p><div class="recall-start"><span aria-hidden="true">↺</span><h4>先回忆，再核对。</h4><p>暂时不翻前面的内容。试着从记忆中，回答这三个问题。</p></div><ol class="recall-prompts">${c.recallQuestions.map(q => `<li>${q}</li>`).join('')}</ol><label class="answer-label" for="recall-answer">此刻，我能想起来的</label><textarea id="recall-answer" class="answer-input" data-draft="3" maxlength="12000" rows="5" placeholder="用自己的话写下来。忘记的部分也值得记录，复习会更有方向。">${e(draft)}</textarea><div class="answer-actions"><button class="text-button" data-action="defer">还不够熟，留到明天 ↗</button><button class="secondary-button" data-action="recall-check">写好了，对照自检 ↗</button></div>${lesson.recallOpen || reviewed ? `<div class="feedback-box"><h4>先诚实地检查，再认可自己的进步。</h4><p>${c.recallAnswer}</p>${checksHTML(c.recallRubric, 'recall')}<p>若有一项还不确定，回到对应阶段即可，不必全部重新开始。</p></div><div class="weakness-options"><button data-action="weakness" data-weakness="concept">只补一下概念</button><button data-action="weakness" data-weakness="method">再看一遍例题</button></div>` : ''}<div class="lesson-footer"><p>${lesson.reviewId ? '本次回忆也需要独立完成与自检。' : '四阶段均确认后，模块才会由 ○ 变为 ✓。'}</p><button class="primary-button" data-action="finish" ${!reviewed || draft.trim().length < 16 ? 'disabled' : ''}>${lesson.reviewId ? '完成这次复习' : '确认掌握，完成模块'} <span>✓</span></button></div>`;
}
function completionHTML() {
  const c = getCourse(lesson.id);
  return `<div class="completion"><div class="completion-mark">✓</div><h2 id="lesson-title">这一步，真正属于你了。</h2><p>${c.title} · ${lesson.reviewId ? '本次回忆已完成' : '四个阶段已完成自检'}<br>${lesson.reviewId ? '每次主动回想，都让知识更容易被再次唤起。' : '从直觉到独立运用，今天的认真已经留下痕迹。接下来，让时间帮你加深记忆。'}</p>${!lesson.reviewId ? '<div class="completion-reviews"><span>+1<small>明天再回想</small></span><span>+3<small>几天后巩固</small></span><span>+7<small>一周后迁移</small></span></div><p>复习已经安排好。无需重学一遍，只温故需要的部分。</p>' : ''}<button class="primary-button" data-action="close">回到我的学习空间 <span>↗</span></button></div>`;
}
function restHTML() { return `<div class="rest-panel"><div class="rest-symbol" aria-hidden="true"><svg class="spark-icon" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M20 4v32M4 20h32M8.7 8.7l22.6 22.6M8.7 31.3 31.3 8.7"/></svg></div><h3 id="lesson-title">暂停，也在学习的节奏里。</h3><p>放下肩膀，看看远处，慢慢呼吸。<br>计时已暂停，写下的内容也已保存。<br>不需要现在解决每一个问题。</p><button class="primary-button" data-action="resume">准备好了，继续学习 <span>↗</span></button><div style="margin-top:20px"><button class="text-button" data-action="close">今天先到这里，稍后继续 ↗</button></div></div>`; }
function renderLesson(scroll = false) {
  if (!lesson) return;
  const content = lesson.view === 'complete' ? completionHTML() : lesson.view === 'rest' ? restHTML() : [understandingHTML, exampleHTML, practiceHTML, recallHTML][lesson.phase]();
  $('#lesson-root').innerHTML = lessonFrame(content);
  if (scroll) {
    $('#lesson-dialog').scrollTo({ top: 0 });
    const title = $('#lesson-title');
    title?.setAttribute('tabindex', '-1');
    title?.focus({ preventScroll: true });
  }
}
function goToPhase(index) {
  const p = state.modules[lesson.id];
  if (lesson.reviewId && index !== 3 || index > nextPhase(p)) return;
  lesson.phase = index; lesson.view = 'content'; lesson.feedback = null;
  if (index === 2 && p.practicePassed) lesson.feedback = { status: 'recognized', title: '你的练习自检已保存。', text: '可以核对标准思路，然后进入闭卷回忆。' };
  renderLesson(true);
}
function moveNext() {
  const p = state.modules[lesson.id];
  if (!completePhase(p, lesson.phase)) { toast('先完成当前阶段的练习与自检，再继续。'); return; }
  const next = Math.min(lesson.phase + 1, 3);
  save(); renderHome(); goToPhase(next);
  announce(`已进入${phases[next].title}`);
}
function finish() {
  const p = state.modules[lesson.id];
  if (lesson.reviewId) {
    if (!lesson.reviewChecked || lesson.reviewDraft.trim().length < 16) return;
    const r = state.reviews.find(r => r.id === lesson.reviewId);
    if (r) r.done = true;
  } else {
    const wasMastered = isMastered(p);
    if (!completePhase(p, 3)) return;
    if (!wasMastered) scheduleReviews(state, lesson.id);
  }
  pauseTimer(); save(); renderHome(); lesson.view = 'complete'; renderLesson(true);
  announce(lesson.reviewId ? '本次复习已完成' : '模块已完成，已安排间隔复习');
}

$('#lesson-root').addEventListener('input', event => {
  const input = event.target.closest('[data-draft]');
  if (!input || !lesson) return;
  const p = state.modules[lesson.id];
  const phase = Number(input.dataset.draft);
  if (lesson.reviewId && phase === 3) lesson.reviewDraft = input.value;
  else p.drafts[phase] = input.value;
  if (phase === 0) {
    p.understandingReviewed = false;
    lesson.checks.understanding = [];
    document.querySelectorAll('[data-check="understanding"]').forEach(c => { c.checked = false; });
    const button = $('[data-action="next"]', $('#lesson-root'));
    if (button && !p.completed[0]) button.disabled = true;
  }
  if (phase === 2) {
    p.practicePassed = false;
    lesson.feedback = null;
    lesson.checks.practice = [];
    $('.feedback-box', $('#lesson-root'))?.remove();
  }
  if (phase === 3) {
    if (lesson.reviewId) lesson.reviewChecked = false;
    else p.recallReviewed = false;
    lesson.checks.recall = [];
    document.querySelectorAll('[data-check="recall"]').forEach(c => { c.checked = false; });
    const button = $('[data-action="finish"]');
    if (button) button.disabled = true;
  }
  save();
});
$('#lesson-root').addEventListener('change', event => {
  const input = event.target.closest('[data-check]');
  if (!input || !lesson) return;
  const c = getCourse(lesson.id), p = state.modules[lesson.id], type = input.dataset.check;
  lesson.checks[type] = [...$('#lesson-root').querySelectorAll(`[data-check="${type}"]:checked`)].map(c => Number(c.dataset.index));
  if (type === 'understanding') {
    p.understandingReviewed = allChecked(type, c.understandingChecks.length);
    $('[data-action="next"]').disabled = !p.understandingReviewed || p.drafts[0].trim().length < 8;
  }
  if (type === 'practice') $('[data-action="practice-confirm"]').disabled = !allChecked(type, c.variants[p.variant].rubric.length) || p.hints === 4;
  if (type === 'recall') {
    const checked = allChecked(type, c.recallRubric.length);
    if (lesson.reviewId) lesson.reviewChecked = checked;
    else p.recallReviewed = checked;
    $('[data-action="finish"]').disabled = !checked || (lesson.reviewId ? lesson.reviewDraft : p.drafts[3]).trim().length < 16;
  }
  save();
});
$('#lesson-root').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || !lesson) return;
  event.preventDefault();
  const c = getCourse(lesson.id), p = state.modules[c.id];
  switch (button.dataset.action) {
    case 'close': closeLesson(); break;
    case 'timer': toggleTimer(); break;
    case 'phase': goToPhase(Number(button.dataset.phase)); break;
    case 'pace': p.pace = button.dataset.pace; save(); renderLesson(); toast(p.pace === 'slow' ? '放慢一点。已补充直觉解释与思考提醒。' : p.pace === 'fast' ? '节奏加快了。保留关键逻辑，减少重复讲解。' : '保持现在的节奏，一步一步来。'); break;
    case 'rest': pauseTimer(); lesson.view = 'rest'; renderLesson(true); break;
    case 'resume': lesson.view = 'content'; if (!state.timer.running && state.timer.remaining > 0) toggleTimer(); renderLesson(true); break;
    case 'understanding-check':
      if (p.drafts[0].trim().length < 8) { toast('先用自己的话写一点理解，至少 8 个字。'); $('#understanding-answer').focus(); break; }
      lesson.understandingOpen = true; renderLesson(); $('.feedback-box')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'next': moveNext(); break;
    case 'hint':
      if (p.hints >= 4) break;
      p.hints += 1; p.practicePassed = false; addReview(state, c.id, 1, '提示后巩固');
      save(); renderReviews(); renderLesson(); $('.hint-list')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      announce(`已展开第 ${p.hints} 级提示`); break;
    case 'practice-check':
      lesson.feedback = evaluatePractice(c.id, p.variant, p.drafts[2]);
      lesson.checks.practice = [];
      save(); renderLesson(); $('.feedback-box')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'practice-confirm':
      if (!allChecked('practice', c.variants[p.variant].rubric.length) || p.hints === 4) break;
      p.practicePassed = true; save(); renderLesson(); $('.feedback-box')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'another':
      p.variant = p.variant === 0 ? 1 : 0; p.hints = 0; p.drafts[2] = ''; p.practicePassed = false;
      lesson.feedback = null; lesson.checks.practice = []; save(); renderLesson(true); break;
    case 'weakness':
      if (lesson.reviewId) { lesson.reviewId = null; lesson.reviewDraft = ''; lesson.reviewChecked = false; }
      goToPhase(button.dataset.weakness === 'concept' ? 0 : 1);
      p.pace = 'slow'; save(); renderLesson(true); toast('只回到需要巩固的部分。其他学习记录保留。'); break;
    case 'defer':
      addReview(state, c.id, 1, '稍后再学'); pauseTimer(); save(); closeLesson(); toast('已留到明天。写过的思路已保存，先给自己一点空间。'); break;
    case 'recall-check': {
      const draft = lesson.reviewId ? lesson.reviewDraft : p.drafts[3];
      if (draft.trim().length < 16) { toast('先闭卷写下你的回忆，至少 16 个字，再来核对。'); $('#recall-answer').focus(); break; }
      lesson.recallOpen = true; renderLesson(); $('.feedback-box')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    }
    case 'finish': finish(); break;
  }
});

$('#start-learning').addEventListener('click', () => openLesson(state.selected));
$('#change-topic').addEventListener('click', () => { renderTopics(); $('#topic-dialog').showModal(); });
$('#topic-options').addEventListener('click', event => {
  const option = event.target.closest('[data-topic]');
  if (!option) return;
  selectTopic(option.dataset.topic); $('#topic-dialog').close(); toast(`今天，就来弄懂「${selectedCourse().title}」。`);
});
$('#module-grid').addEventListener('click', event => {
  const course = event.target.closest('[data-course]');
  if (course) openLesson(course.dataset.course);
  if (event.target.closest('#show-all-modules')) setFilter('all');
});
$('.filter-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (button) setFilter(button.dataset.filter);
});
$('#review-list').addEventListener('click', event => {
  const button = event.target.closest('[data-review]');
  if (button) { const r = state.reviews.find(r => r.id === button.dataset.review); if (r) openLesson(r.moduleId, r.id); }
  if (event.target.closest('#review-start')) openLesson(state.selected);
});
$('#timer-toggle').addEventListener('click', toggleTimer);
$('#reset-timer').addEventListener('click', () => { state.timer = { remaining: 3600, running: false, endsAt: null }; save(); tickTimer(); toast('计时器已重置。学习进度仍然保留。'); });
document.querySelectorAll('.method-button').forEach(button => button.addEventListener('click', () => $('#method-dialog').showModal()));
document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  const r = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
}));
$('#lesson-dialog').addEventListener('close', () => {
  // A queued close event can arrive after the learner has already reopened it.
  if (!$('#lesson-dialog').open) { lesson = null; renderHome(); }
});
document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l === link));
}));
const observer = new IntersectionObserver(entries => {
  const section = entries.find(entry => entry.isIntersecting)?.target.id;
  if (section) document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.nav === section));
}, { rootMargin: '-5% 0px -60% 0px', threshold: 0 });
['today', 'modules', 'reviews'].forEach(id => observer.observe(document.getElementById(id)));
$('#today-date').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, ' / ');
document.addEventListener('visibilitychange', () => { if (!document.hidden) tickTimer(); });
drawTorus(); renderHome(); tickTimer(); setInterval(tickTimer, 1000);
if (!storageAvailable) toast('当前浏览器无法保存记录。你可以继续学习，本次进度只保留到页面关闭。');

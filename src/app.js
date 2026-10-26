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
  if (!storageWarned) { storageWarned = true; toast('This browser cannot save your material right now. You can keep learning, but this session may be lost when you close the page.'); }
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
  if (c) return phase === 0 ? c.understandingChecks : phase === 1 ? ['I can explain the key steps and why each one is necessary.'] : phase === 2 ? c.variants[progress().variant].rubric : c.recallRubric;
  return [
    ['I can explain the core idea in my own words.', 'I can explain why it works or when it is useful.'],
    ['I can explain the reasoning behind each key step.', 'I know which parts I understand and which need more work.'],
    ['I wrote out my own reasoning, not just the final result.', 'I checked my concepts, reasoning and calculations against the material.'],
    ['I recalled the core idea or method without looking at my notes.', 'I can explain why and apply it to a different situation.', 'I checked my recall and resolved the important gaps.']
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
    <div class="sidebar-intro"><p class="eyebrow">${e(current.title)} / STUDY BOOKMARK</p><h2>Learning path</h2><p class="sidebar-description">${e(current.description)}</p></div>
    <nav class="contents-nav" aria-label="Table of contents">${current.sections.map((item, i) => {
      const done = isDone(item.progress), active = i === current.selected;
      const status = done ? 'Complete · Recall checked' : active ? `Current · ${phases[phase].title}` : countDone(item.progress) > 0 ? `Next · ${phases[nextRequired(item.progress)].title}` : 'Not started';
      return `<button class="chapter-link ${active ? 'current' : ''}" data-section="${i}" ${active ? 'aria-current="location"' : ''}><span class="chapter-marker ${done ? 'status-circle is-complete' : active ? 'bookmark-icon' : 'status-circle'}" aria-label="${done ? 'Complete' : 'Not complete'}">${!done && active ? icons.bookmark : ''}</span><span><strong>${e(item.title)}</strong><small>${status}</small></span></button>`;
    }).join('')}</nav>
    ${current.mode === 'class' ? '<button class="batch-link" data-action="batch">After-class practice <span>↗</span></button>' : ''}<div class="current-module"><p class="eyebrow">CURRENT MODULE / ${current.mode === 'class' ? 'In class' : 'Self-study'}</p><nav class="phase-nav" aria-label="Learning stages for this section">${phases.map((item, i) => !requiredPhases(current.mode).includes(i) ? '' : `<button class="stage-link ${phase === i ? 'current' : ''}" data-phase="${i}" ${reviewId && i !== 3 ? 'disabled' : ''} ${phase === i ? 'aria-current="step"' : ''}><span class="status-circle ${p.completed[i] ? 'is-complete' : phase === i ? 'is-current' : ''}" aria-label="${p.completed[i] ? 'Complete' : 'Not complete'}"></span><span>0${requiredPhases(current.mode).indexOf(i) + 1} — ${['Understanding', 'Worked Examples', 'Independent Practice', 'Active Recall'][i]}</span></button>`).join('')}</nav><p class="progress-note">${current.mode === 'class' ? 'Learn along now. Practise and recall later.<br>Finish all three steps to complete a section.' : 'Complete all four steps to fill the circle.'}</p><p class="progress-summary">${totalDone} of ${current.sections.length} sections complete</p></div>
    <div class="sidebar-footer"><div class="focus-timer"><button class="timer-control" id="timer-toggle" aria-label="${timer.running ? 'Pause focus timer' : 'Start focus timer'}">${timer.running ? icons.pause : icons.play}</button><span id="timer-value">${formatTime(timerSeconds(timer))}</span><button class="plain-button reset-timer" data-action="reset-timer" aria-label="Reset timer">↺</button><button class="plain-button rest-button" data-action="rest">Take a break</button></div><button class="sidebar-review-link" data-action="reviews">Review schedule <span>${reviews.length ? String(reviews.length).padStart(2, '0') : '—'}</span></button><button class="sound-preference" data-action="sound" aria-pressed="${soundEnabled()}">Celebration sound <span>${soundEnabled() ? 'On' : 'Off'}</span></button></div>`;
  updateSidebar();
}
function updateSidebar() {
  const mobile = matchMedia('(max-width: 760px)').matches;
  $('#workspace').classList.toggle('sidebar-collapsed', !sidebarOpen);
  $('#workspace').classList.toggle('sidebar-open', sidebarOpen);
  $('#study-sidebar').inert = !sidebarOpen;
  $('#toc-toggle').innerHTML = sidebarOpen ? icons.sidebar : icons.expand;
  $('#toc-toggle').setAttribute('aria-expanded', String(sidebarOpen));
  $('#toc-toggle').setAttribute('aria-label', sidebarOpen ? 'Hide contents' : 'Show contents');
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
  if (phase === 1) return s.blocks.example ? markdown(s.blocks.example) : `<p class="source-note">This material does not label a worked example. Choose an example, proof or process from it and explain why each step works.</p>${markdown(s.blocks.key || s.body)}`;
  return '';
}
function questionForPhase() {
  const s = section(), c = s.courseId && courses.find(c => c.id === s.courseId);
  if (phase === 0 && current.mode === 'class') {
    const simple = c ? { kernel: 'Is the zero vector always in the kernel? Explain in one sentence.', derivative: 'If an object has zero velocity, must its position also be zero?', recursion: 'A factorial function returns 1 when n ≤ 1. Is this its base case or recursive step?' }[c.id] : current.id === 'sample-vector-spaces' ? ['How many vectors are in the standard basis {(1, 0), (0, 1)}?', 'If v = 2b₁ + 3b₂, what are the two coordinates of [v]ᵦ?', 'P₃ has standard basis {1, t, t², t³}. What is its dimension?'][current.selected] : `Explain “${s.title}” in one sentence and give one simple example.`;
    return markdown(simple);
  }
  if (c) return phase === 0 ? markdown(c.question) : phase === 1 ? '<p>Explain one key step in your own words. (Optional)</p>' : phase === 2 ? markdown(c.variants[progress().variant].prompt) : `<ol>${c.recallQuestions.map(q => `<li>${e(q)}</li>`).join('')}</ol>`;
  if (phase === 0) return s.blocks.practice ? markdown(s.blocks.practice) : `<p>Explain the main idea of “${e(s.title)}” in your own words. Why do we need it?</p>`;
  if (phase === 1) return '<p>What is the most important step in this example, and why? (Notes are optional.)</p>';
  if (phase === 2) return s.blocks.practice ? markdown(s.blocks.practice) : `<p>Close your notes. Create and solve a new example or real-world application of “${e(s.title)}”. Write out your reasoning and checks.</p>`;
  return `<ol><li>Without your notes, explain the core idea of “${e(s.title)}”.</li><li>Recall an important result or step and explain why it works.</li><li>How would you use it in a new situation?</li></ol>`;
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
  return `<section class="check-panel" aria-label="Self-check criteria"><div class="block-label"><span>${f?.title ? e(f.title) : phase === 3 ? 'CHECK YOUR RECALL' : 'SELF CHECK'}</span><span>Self-check</span></div>${f ? `<p>${e(f.text)}</p>` : `<p>Check your reasoning against the material. Revisit only the parts that need more work.</p>`}${showReference ? `<details class="reference-answer"><summary>Show reference</summary><div class="prose">${referenceAnswer()}</div></details>` : ''}${f?.status === 'retry' || f?.status === 'empty' ? '' : checksHTML()}${phase === 2 && progress().hints >= 4 ? '<p class="helper-note">You have viewed the full reference. Hide it and try independently before confirming completion.</p><button class="secondary-button" data-action="retry">Hide reference and try again</button>' : ''}</section>`;
}
function hintsHTML() {
  const p = progress(), s = section(), c = s.courseId && courses.find(c => c.id === s.courseId);
  const hints = c ? c.variants[p.variant].hints : ['Recall the definition. What are the objects, and which conditions must they satisfy?', 'List what you know and what you need to find. Which idea connects them?', 'Find the closest step in the example, then hide your notes and explain the next step yourself.'];
  return p.hints ? `<div class="hints">${hints.slice(0, p.hints).map((hint, i) => `<div class="hint"><span>0${i + 1} / ${['Concept', 'Method', 'Next step'][i]}</span><p>${e(hint)}</p></div>`).join('')}${p.hints >= 4 ? `<div class="hint"><span>04 / Reference</span><div class="prose">${referenceAnswer()}</div></div>` : ''}<p class="helper-note">This step is saved for review tomorrow. Using a hint is part of learning.</p></div>` : '';
}
function completeHTML() {
  return `<div class="completion"><span class="completion-circle"></span><p class="eyebrow">ONE SMALL STEP, TRULY YOURS.</p><h1 tabindex="-1">One idea. Made your own.</h1><p>${e(section().title)} · ${current.mode === 'class' ? 'Class learning, practice and recall complete' : 'All four learning steps complete'}.<br>Reviews are scheduled in 1, 3 and 7 days.</p><div class="completion-days"><span>+1<small>day · Recall</small></span><span>+3<small>days · Revisit</small></span><span>+7<small>days · Apply</small></span></div><button class="primary-button" data-action="next-section">${current.selected < current.sections.length - 1 ? 'Next section' : 'Back to this section'} <span>→</span></button></div>`;
}
function renderBatch() {
  const target = transient.batchPhase || 2;
  $('#reading').innerHTML = `<div class="reading-meta"><span>AFTER CLASS / ALL CHAPTERS</span><span>In class</span></div><header class="article-heading"><h1 tabindex="-1">After class. Put it together.</h1><p>You made room for understanding. Now practise, then see what you can recall.</p></header><div class="batch-tabs"><button data-batch-phase="2" aria-pressed="${target === 2}">Independent practice</button><button data-batch-phase="3" aria-pressed="${target === 3}">Active recall</button></div><div class="batch-list">${current.sections.map((s, i) => {
    const c = s.courseId && courses.find(c => c.id === s.courseId);
    const question = target === 3 ? `Without your notes, explain the core idea of “${s.title}”, why it works, and how to use it in a new situation.` : c ? c.variants[s.progress.variant].prompt : s.blocks.practice || `Create and solve a new example or application of “${s.title}” independently.`;
    return `<section class="batch-card"><div class="batch-card-heading"><span class="status-circle ${s.progress.completed[target] ? 'is-complete' : ''}"></span><h2>${e(s.title)}</h2></div><div class="prose">${markdown(question)}</div><label class="sr-only" for="batch-answer-${i}">Section ${i + 1}: ${target === 2 ? 'Independent practice' : 'Active recall'}</label><textarea class="answer-input" id="batch-answer-${i}" data-batch-draft="${i}" maxlength="12000" rows="3" placeholder="${target === 3 ? 'Start with what you can remember, without your notes…' : 'Write out your own reasoning…'}">${e(s.progress.drafts[target])}</textarea><button class="secondary-button" data-batch-start="${i}">${s.progress.completed[target] ? 'Revisit your check' : 'Check and continue'} ↗</button></section>`;
  }).join('')}</div>`;
}
function renderReading(focus = false) {
  if (!current) return;
  const s = section(), p = progress(), source = current.filename.replace(/\.[^.]+$/, '');
  if (transient.batch) { renderBatch(); return; }
  if (transient.complete) { $('#reading').innerHTML = completeHTML(); return; }
  const fullTitle = s.title.replace(/^\d+(?:\.\d+)*\s*[—–-]?\s*/, '');
  const headingQuestion = s.blocks.question || (phase === 0 ? 'One small idea at a time. Turn understanding into something you can use.' : phases[phase].description);
  $('#reading').innerHTML = `
    ${transient.fromBatch ? '<button class="text-button batch-back" data-action="batch">← Back to after-class practice</button>' : ''}<div class="reading-meta"><span>${e(s.page ? `${source} / PAGE ${String(s.page).padStart(2, '0')}` : `${source} / SECTION ${String(current.selected + 1).padStart(2, '0')}`)}</span>${pdfURL ? `<a href="${pdfURL}#page=${s.page || 1}" target="_blank" rel="noopener">Open original ↗</a>` : '<span class="saved-indicator">Saved locally</span>'}</div>
    <header class="article-heading"><h1 tabindex="-1">${e(fullTitle)}</h1><p>${phase === 0 && s.blocks.question ? 'Core question: ' : ''}${e(headingQuestion)}</p></header>
    ${phase < 2 ? `<section class="source-section"><div class="block-label"><span>${phase === 0 ? 'THE KEY IDEA' : 'WORKED EXAMPLE'}</span><span>${phases[phase].title}</span></div>${current.scanned ? `<p class="source-note">This PDF has no extractable text. Read the original pages below.</p><iframe class="pdf-source" title="Original document page" src="${pdfURL}#page=${s.page || 1}&view=FitH"></iframe>` : `<div class="prose">${bodyForPhase()}</div>`}</section>` : ''}
    ${phase === 3 ? `<p class="recall-note">Close your notes. Write from memory first, then check.</p>` : ''}
    <section class="question-section"><div class="block-label"><span>${[current.mode === 'class' ? 'ONE SIMPLE CHECK' : 'QUICK CHECK / 01', 'YOUR UNDERSTANDING', 'TRY IT YOURSELF', reviewId ? 'SPACED RECALL' : 'ACTIVE RECALL'][phase]}</span><span>${['Understanding', 'Worked Examples', 'Independent Practice', 'Active Recall'][phase]}</span></div><div class="prose question-text">${questionForPhase()}</div><label class="sr-only" for="study-answer">Your ${phases[phase].title} response</label><textarea id="study-answer" class="answer-input" maxlength="12000" rows="4" placeholder="${phase === 3 ? 'Close your notes. Recall the ideas, reasoning and applications…' : 'What do you think, and why?'}">${e(currentDraft())}</textarea><div class="answer-toolbar">${phase === 2 ? `<button class="text-button" data-action="hint" ${p.hints >= 4 ? 'disabled' : ''}>${p.hints === 0 ? 'Need a hint?' : p.hints === 3 ? 'Show full reference' : 'One more hint'}${p.hints ? ` (${p.hints}/4)` : ''}</button>` : '<span class="answer-note">Your own words are enough.</span>'}<button class="secondary-button" data-action="check">${phase === 1 ? 'I can explain the steps' : phase === 3 ? 'Ready to self-check' : 'Check my thinking'} <span>↗</span></button></div>${phase === 2 ? hintsHTML() : ''}${feedbackHTML()}</section>
    <div class="learning-controls"><div class="pace-control"><span>Pace</span>${[['slow', 'Slower'], ['normal', 'Just right'], ['fast', 'Faster']].map(([value, label]) => `<button data-pace="${value}" aria-pressed="${p.pace === value}">${label}</button>`).join('')}</div><button class="text-button" data-action="defer">Save this for later ↗</button></div>
    ${p.pace === 'slow' ? '<p class="pace-note">One question at a time. Start with what you know, then find the smallest step that feels unclear.</p>' : ''}
    <footer class="reading-footer"><span>${phase === 3 ? 'A solid circle means you have completed the required learning steps.' : 'Move on when you can explain it in your own words.'}</span><button class="primary-button" data-action="continue" ${!canContinue() ? 'disabled' : ''}>${phase === 3 ? reviewId ? 'Finish this review' : 'Confirm my recall' : current.mode === 'class' && phase === 0 ? 'Got it · Keep learning' : current.mode === 'class' && phase === 2 ? 'Confirm · Back to practice' : ['Next · Worked example', 'Next · Independent practice', 'Next · Active recall'][phase]} <span>→</span></button></footer>`;
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
  if (material.id === 'builtin-courses') {
    material.title = 'Three small ideas';
    material.filename = 'Built-in lessons';
    material.description = 'Explore kernels, derivatives and recursion. Your previous progress is preserved.';
    for (const item of material.sections) {
      const course = courses.find(c => c.id === item.courseId);
      if (course) { item.title = course.title; item.body = course.concise; item.blocks = { question: course.description }; }
    }
  }
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
  $('#saved-materials').innerHTML = visible.length ? `<p class="eyebrow library-label">Continue learning</p>${visible.map(m => `<button class="material-link" data-material="${e(m.id)}"><span class="material-initial">${m.kind === 'pdf' ? 'PDF' : m.id === 'builtin-courses' ? 'ABC' : /\.m(?:d|arkdown)$/i.test(m.filename) || m.kind === 'sample' ? 'MD' : 'TXT'}</span><span><strong>${e(m.id === 'builtin-courses' ? 'Three small ideas' : m.title)}</strong><small>${m.sections.length} sections · ${m.sections.filter(s => isDone(s.progress, m.mode)).length} complete</small></span><span aria-hidden="true">↗</span></button>`).join('')}` : '';
}
function showLibrary() {
  renderLibrary();
  $('#upload-error').hidden = true;
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
  $('#upload-status').hidden = false; $('#upload-status-text').textContent = 'Reading your material…';
  try {
    validateFile(file);
    const bytes = await file.arrayBuffer(), id = await fileId(bytes);
    const previous = materials.find(m => m.id === id);
    if (previous) { openMaterial(previous); toast('Welcome back. Your previous progress is here.'); return; }
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
    openMaterial(material); announce(`Imported ${file.name} with ${material.sections.length} sections.`);
  } catch (error) {
    $('#upload-error').textContent = error.message || 'This file could not be read. Please try another copy.'; $('#upload-error').hidden = false;
  } finally { busy = false; $('#pick-file').disabled = false; $('#upload-status').hidden = true; $('#file-input').value = ''; }
}
async function openSample() {
  const existing = materials.find(m => m.id === 'sample-vector-spaces');
  if (existing?.contentLocale === 'en') { openMaterial(existing); return; }
  try {
    const response = await fetch('/assets/sample-material.md');
    if (!response.ok) throw new Error('The sample could not be opened. Please try again.');
    const parsed = parseTextMaterial(await response.text(), 'Vector Spaces.md');
    const material = existing ? {
      ...existing, title: parsed.title, description: parsed.description, filename: 'Vector Spaces · Sample', contentLocale: 'en',
      sections: parsed.sections.map(s => ({ ...s, progress: existing.sections.find(old => old.id === s.id)?.progress || s.progress }))
    } : createMaterial(parsed, 'Vector Spaces · Sample', 'sample-vector-spaces', { kind: 'sample', mode: importMode, contentLocale: 'en' });
    if (existing) materials[materials.indexOf(existing)] = material; else materials.push(material);
    current = material; save(); openMaterial(material);
  } catch (error) { toast(error.message); }
}
function openBuiltin() {
  let existing = materials.find(m => m.id === 'builtin-courses');
  if (!existing) {
    let legacy;
    try { legacy = restoreState(localStorage.getItem(STORAGE_KEY)); } catch { legacy = restoreState(); }
    existing = createMaterial({ title: 'Three small ideas', description: 'Explore kernels, derivatives and recursion. Your previous progress is preserved.', sections: courses.map(c => ({ id: c.id, title: c.title, courseId: c.id, body: c.concise, blocks: { question: c.description }, progress: legacy.modules[c.id] || newProgress() })) }, 'Built-in lessons', 'builtin-courses', { kind: 'builtin', mode: importMode });
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
    reviewId = null; resetTransient(); save(); pauseTimer(); render(); toast('Review complete. Your progress is saved.'); return;
  }
  const wasDone = isDone(p);
  if (!completePhase(p, phase, { unordered: true, understandingMinLength: current.mode === 'class' ? 1 : 8 })) return;
  if (isDone(p) && !wasDone) {
    if (!wasDone) materialReview(current, section().id);
    transient.complete = true; pauseTimer(); save(); render(); celebrate(); announce('Section complete. Its progress circle is now filled.');
  } else if (current.mode === 'class') {
    save();
    if (phase === 0 && current.selected < current.sections.length - 1) { openSection(current.selected + 1); phase = 0; current.phase = 0; save(); render(); }
    else { transient = { batch: true, batchPhase: phase === 3 ? 3 : 2 }; render(); window.scrollTo({ top: 0 }); }
  } else { phase = phase < 3 ? phase + 1 : nextPhase(p); current.phase = phase; resetTransient(); save(); render(); window.scrollTo({ top: 0 }); }
}
function tickTimer() {
  const seconds = timerSeconds(timer);
  if (timer.running && seconds === 0) { timer.running = false; timer.remaining = 0; timer.endsAt = null; saveTimer(); toast('Your focus session is complete. Take a break and notice what stayed with you.'); }
  if ($('#timer-value')) $('#timer-value').textContent = formatTime(seconds);
  if ($('#timer-toggle')) { $('#timer-toggle').innerHTML = timer.running ? icons.pause : icons.play; $('#timer-toggle').setAttribute('aria-label', timer.running ? 'Pause focus timer' : 'Start focus timer'); }
}
function toggleTimer() {
  if (timer.running) { timer.remaining = timerSeconds(timer); timer.running = false; timer.endsAt = null; }
  else { if (!timer.remaining) timer.remaining = 3600; timer.endsAt = Date.now() + timer.remaining * 1000; timer.running = true; }
  saveTimer(); tickTimer();
}
function pauseTimer() { if (timer.running) toggleTimer(); }
function reviewReason(reason) { return ({ '间隔回忆': 'Spaced recall', '巩固回忆': 'Spaced recall', '提示后巩固': 'Hint follow-up', '稍后再学': 'Saved for later' })[reason] || reason; }
function showReviews() {
  const items = current.reviews.filter(r => !r.done).sort((a, b) => a.due.localeCompare(b.due));
  $('#reviews-list').innerHTML = items.length ? items.map(r => `<button class="review-row" data-review="${e(r.id)}"><span>${e(r.due.slice(5).replace('-', ' / '))}</span><span><strong>${e(current.sections.find(s => s.id === r.sectionId)?.title || '')}</strong><small>${e(reviewReason(r.reason))} · ${r.due <= localDate() ? 'Ready to revisit' : 'Revisit early if you like'}</small></span><span>↗</span></button>`).join('') : '<p class="empty-note">Complete a section to schedule reviews in 1, 3 and 7 days. Steps that needed a hint get their own review.</p>';
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
    $('.check-panel').insertAdjacentHTML('beforeend', `<details class="reference-answer"><summary>Compare with the worked solution</summary><div class="prose">${referenceAnswer()}</div></details>`);
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
  if (pace) { progress().pace = pace.dataset.pace; save(); renderReading(); toast(progress().pace === 'slow' ? 'A little slower. One question at a time.' : progress().pace === 'fast' ? 'Less guidance. Keep moving at a pace that suits you.' : 'Stay with the pace that feels right.'); return; }
  if (event.target.closest('#timer-toggle')) { toggleTimer(); return; }
  if (!action) return;
  const p = progress();
  switch (action.dataset.action) {
    case 'check':
      if (phase !== 1 && currentDraft().trim().length < (phase === 3 ? 16 : phase === 0 && current.mode === 'class' ? 1 : 8)) { toast(phase === 3 ? 'Write a short recall response first (at least 16 characters), then check.' : current.mode === 'class' && phase === 0 ? 'Write your answer to the quick check first.' : 'Start with your own attempt (at least 8 characters), then check.'); $('#study-answer').focus(); return; }
      transient.showCheck = true; transient.checks = [];
      if (phase === 2 && section().courseId) transient.feedback = evaluatePractice(section().courseId, p.variant, currentDraft());
      renderReading(); $('.check-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'continue': continueLearning(); break;
    case 'hint':
      if (p.hints >= 4) return;
      p.hints++; p.practicePassed = false; transient.checks = []; materialReview(current, section().id, [1], 'Hint follow-up'); save(); renderReading(); $('.hints')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); break;
    case 'retry':
      p.hints = 0; p.drafts[2] = ''; p.practicePassed = false;
      if (section().courseId) p.variant = p.variant === 0 ? 1 : 0;
      resetTransient(); save(); renderReading(); $('#study-answer').focus(); break;
    case 'defer': materialReview(current, section().id, [1], 'Saved for later'); pauseTimer(); save(); renderSidebar(); toast('Saved for tomorrow. Everything else stays right where you left it.'); break;
    case 'rest': pauseTimer(); save(); $('#rest-dialog').showModal(); break;
    case 'reset-timer': timer = { remaining: 3600, running: false, endsAt: null }; saveTimer(); tickTimer(); break;
    case 'reviews': showReviews(); break;
    case 'sound': setSoundEnabled(!soundEnabled()); renderSidebar(); break;
    case 'batch': transient = { batch: true, batchPhase: phase === 3 ? 3 : 2 }; render(); window.scrollTo({ top: 0 }); break;
    case 'next-section': if (current.mode === 'class') { transient = { batch: true, batchPhase: 3 }; render(); break; } openSection(current.selected < current.sections.length - 1 ? current.selected + 1 : current.selected); break;
  }
});
$('#mode-switch').addEventListener('change', event => { current.mode = event.target.value; importMode = current.mode; if (current.mode === 'class' && phase === 1) phase = 0; resetTransient(); save(); render(); toast(current.mode === 'class' ? 'Learn along: one quick check now, practice and recall after class.' : 'Self-study: four learning steps, with the freedom to choose where you start.'); });
document.querySelectorAll('[name="import-mode"]').forEach(input => input.addEventListener('change', () => { importMode = input.value; }));
$('#open-studio').addEventListener('click', showLibrary);
$('#start-button').addEventListener('click', showLibrary);
$('#back-home').addEventListener('click', home);
$('#open-library').addEventListener('click', showLibrary);
$('#pick-file').addEventListener('click', () => $('#file-input').click());
$('#upload-another').innerHTML = icons.upload;
$('#upload-another').addEventListener('click', () => { showLibrary(); $('#file-input').click(); });
$('#upload-icon').innerHTML = icons.upload;
$('#file-input').addEventListener('change', event => importFile(event.target.files[0]));
$('#open-sample').addEventListener('click', openSample);
$('#open-builtin').addEventListener('click', openBuiltin);
$('#saved-materials').addEventListener('click', event => {
  const button = event.target.closest('[data-material]');
  if (!button) return;
  if (button.dataset.material === 'sample-vector-spaces') openSample();
  else openMaterial(materials.find(m => m.id === button.dataset.material));
});
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
document.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; $('#drop-overlay').hidden = true; if (event.dataTransfer.files.length > 1) toast('One file at a time. Opening the first file you dropped.'); importFile(event.dataTransfer.files[0]); });
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
  try { const id = sessionStorage.getItem('study-studio-current'); const old = materials.find(m => m.id === id); if (old?.id === 'sample-vector-spaces') await openSample(); else if (old) openMaterial(old); } catch { /* Home still works. */ }
}
init();

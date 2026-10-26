export const STORAGE_KEY = 'zhixu-study-v1';
export const MODULE_IDS = ['kernel', 'derivative', 'recursion'];
export function newProgress() {
  return { completed: [false, false, false, false], drafts: ['', '', '', ''], hints: 0, variant: 0, pace: 'normal', understandingReviewed: false, practicePassed: false, recallReviewed: false };
}
export function initialState() {
  return { version: 1, selected: 'kernel', modules: Object.fromEntries(MODULE_IDS.map(id => [id, newProgress()])), reviews: [], timer: { remaining: 3600, running: false, endsAt: null } };
}
export function restoreState(raw) {
  const state = initialState();
  if (!raw) return state;
  let saved;
  try { saved = JSON.parse(raw); } catch { return state; }
  if (!saved || saved.version !== 1) return state;
  if (MODULE_IDS.includes(saved.selected)) state.selected = saved.selected;
  for (const id of MODULE_IDS) {
    const p = saved.modules?.[id];
    if (!p || typeof p !== 'object') continue;
    const progress = state.modules[id];
    // A later phase is never completed while an earlier phase is unfinished.
    let contiguous = true;
    progress.completed = progress.completed.map((_, i) => (contiguous = contiguous && p.completed?.[i] === true));
    progress.drafts = progress.drafts.map((_, i) => typeof p.drafts?.[i] === 'string' ? p.drafts[i].slice(0, 12000) : '');
    progress.hints = Number.isInteger(p.hints) ? Math.min(4, Math.max(0, p.hints)) : 0;
    progress.variant = p.variant === 1 ? 1 : 0;
    progress.pace = ['slow', 'normal', 'fast'].includes(p.pace) ? p.pace : 'normal';
    for (const key of ['understandingReviewed', 'practicePassed', 'recallReviewed']) progress[key] = p[key] === true;
  }
  if (Array.isArray(saved.reviews)) {
    state.reviews = saved.reviews.filter(r => r && MODULE_IDS.includes(r.moduleId) && typeof r.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.due) && Number.isFinite(new Date(r.due).getTime())).slice(0, 100).map(r => ({ id: r.id.slice(0, 100), moduleId: r.moduleId, due: r.due, done: r.done === true, reason: ['巩固回忆', '提示后巩固', '稍后再学'].includes(r.reason) ? r.reason : '巩固回忆' }));
  }
  const t = saved.timer;
  if (t && Number.isFinite(t.remaining)) {
    state.timer.remaining = Math.min(3600, Math.max(0, t.remaining));
    if (t.running && Number.isFinite(t.endsAt) && t.endsAt <= Date.now() + 3600000) {
      state.timer.endsAt = t.endsAt;
      state.timer.remaining = Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000));
      state.timer.running = state.timer.remaining > 0;
    }
  }
  return state;
}
export function nextPhase(progress) {
  const index = progress.completed.findIndex(done => !done);
  return index < 0 ? 3 : index;
}
export function isMastered(progress) { return progress.completed.every(Boolean); }
export function completePhase(progress, phase, { unordered = false, understandingMinLength = 8 } = {}) {
  if (!Number.isInteger(phase) || phase < 0 || phase > 3) return false;
  if (progress.completed[phase]) return true;
  if (!unordered && progress.completed.slice(0, phase).some(done => !done)) return false;
  if (phase === 0 && (!progress.understandingReviewed || progress.drafts[0].trim().length < understandingMinLength)) return false;
  if (phase === 2 && !progress.practicePassed) return false;
  if (phase === 3 && (!progress.recallReviewed || progress.drafts[3].trim().length < 16)) return false;
  progress.completed[phase] = true;
  return true;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addReview(state, moduleId, offset, reason = '巩固回忆', now = new Date()) {
  const due = new Date(now); due.setDate(due.getDate() + offset);
  const dueString = localDate(due);
  if (state.reviews.some(r => r.moduleId === moduleId && r.due === dueString && !r.done)) return;
  state.reviews.push({ id: `${moduleId}-${dueString}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, moduleId, due: dueString, done: false, reason });
}
export function scheduleReviews(state, moduleId, now = new Date()) { [1, 3, 7].forEach(day => addReview(state, moduleId, day, '巩固回忆', now)); }
export function timerSeconds(timer, now = Date.now()) { return timer.running ? Math.max(0, Math.ceil((timer.endsAt - now) / 1000)) : Math.max(0, Math.ceil(timer.remaining)); }
export function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
export function escapeHTML(value = '') { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
export function evaluatePractice(moduleId, variant, answer) {
  const a = answer.trim().replace(/[−–—]/g, '-').replace(/[（【]/g, '(').replace(/[）】]/g, ')').replace(/，/g, ',').replace(/\s/g, '').toLowerCase();
  if (!a) return { status: 'empty', title: 'Start with your own thinking.', text: 'Write out your attempt. Start with the part you feel sure about, even if it is incomplete.' };
  if (moduleId === 'kernel') {
    const patterns = variant === 0 ? [/\(-2,1\)/, /\(2,-1\)/, /\(-2t,t\)/, /\(2t,-t\)/, /x=-2y/, /x\+2y=0/] : [/\(1,-2\)/, /\(-1,2\)/, /\(t,-2t\)/, /y=-2x/, /2x\+y=0/];
    if (patterns.some(p => p.test(a))) return { status: 'recognized', title: 'You found the key relationship.', text: 'Your response includes the correct direction or equation. Check that it describes all solutions and explains why they form a line through the origin.' };
    if (/(只有|仅有|就是|只有一个).*\(0,0\)/.test(a) || a === '(0,0)') return { status: 'retry', title: 'The zero vector is in the kernel, but it is not alone.', text: 'Try finding a nonzero input that also maps to zero. Focus on that idea; you do not need to restart the whole problem.' };
  }
  if (moduleId === 'derivative') {
    const expected = variant === 0 ? '6' : '-4';
    if (a === expected || new RegExp(`(?:=|为|是|斜率[:：]?)(?:${expected})(?![0-9.])`).test(a)) return { status: 'recognized', title: 'You found the rate of change.', text: 'Check your explanation: this number is a tangent slope and an instantaneous rate, not a function value. Use the checklist to verify your reasoning.' };
    if (variant === 0 && /^(9|f\(3\)=9)[。.]?$/.test(a)) return { status: 'retry', title: 'You found the height of the curve.', text: 'f(3) = 9 is the function value. This question asks how fast the function changes at x = 3. Think about that distinction and try again.' };
  }
  if (moduleId === 'recursion') {
    const expected = variant === 0 ? '24' : '120';
    if (a === expected || new RegExp(`(?:=|为|是|返回|得到)${expected}(?![0-9.])`).test(a)) return { status: 'recognized', title: 'The return value is right. Now check the calls.', text: 'The number is only part of the answer. Explain where recursion stops and how results return through the calls.' };
  }
  return { status: 'manual', title: 'Your thinking is saved. Let’s check it.', text: 'This free-form response cannot be reliably checked automatically. Compare it with each criterion below. Revise your reasoning or open a hint if needed, and move on when you are confident.' };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, restoreState, completePhase, isMastered, scheduleReviews, addReview, timerSeconds, formatTime, evaluatePractice, escapeHTML } from '../src/learning.js';

test('completion requires all earlier phases, written work, and explicit self checks', () => {
  const p = initialState().modules.kernel;
  assert.equal(completePhase(p, 2), false);
  assert.equal(completePhase(p, 0), false);
  p.drafts[0] = '核是所有被映射到零的输入向量组成的集合。';
  p.understandingReviewed = true;
  assert.equal(completePhase(p, 0), true);
  assert.equal(completePhase(p, 1), true);
  assert.equal(completePhase(p, 2), false);
  p.practicePassed = true;
  assert.equal(completePhase(p, 2), true);
  assert.equal(isMastered(p), false);
  p.drafts[3] = '我能解释核的定义，所有映射到零的输入都在核中，且线性变换总把零映射到零。';
  assert.equal(completePhase(p, 3), false);
  p.recallReviewed = true;
  assert.equal(completePhase(p, 3), true);
  assert.equal(isMastered(p), true);
});

test('restoration rejects malformed data and prevents impossible progress', () => {
  assert.deepEqual(restoreState('broken JSON'), initialState());
  const state = restoreState(JSON.stringify({ version: 1, selected: 'other', modules: { kernel: { completed: [false, true, true, true], drafts: ['hello'], hints: 100 } }, reviews: [{ moduleId: 'unknown', id: 'x', due: '2026-10-20' }] }));
  assert.equal(state.selected, 'kernel');
  assert.deepEqual(state.modules.kernel.completed, [false, false, false, false]);
  assert.equal(state.modules.kernel.hints, 4);
  assert.equal(state.reviews.length, 0);
});

test('reviews follow local calendar dates and do not duplicate pending dates', () => {
  const state = initialState();
  const now = new Date(2026, 9, 30, 23, 30);
  addReview(state, 'kernel', 1, '提示后巩固', now);
  scheduleReviews(state, 'kernel', now);
  scheduleReviews(state, 'kernel', now);
  assert.deepEqual(state.reviews.map(r => r.due), ['2026-10-31', '2026-11-02', '2026-11-06']);
});

test('timer follows wall clock across suspended tabs and never becomes negative', () => {
  assert.equal(timerSeconds({ running: true, endsAt: 7000 }, 3000), 4);
  assert.equal(timerSeconds({ running: true, endsAt: 7000 }, 9000), 0);
  assert.equal(timerSeconds({ running: false, remaining: 50 }, 9000), 50);
  assert.equal(formatTime(3600), '60:00');
  assert.equal(formatTime(65), '01:05');
});

test('answer feedback identifies supported cases and avoids claiming to grade arbitrary prose', () => {
  assert.equal(evaluatePractice('kernel', 0, 'ker(T) = span{(-2, 1)}，是一条过原点的直线。').status, 'recognized');
  assert.equal(evaluatePractice('kernel', 0, '只有 (0,0)').status, 'retry');
  assert.equal(evaluatePractice('kernel', 0, '我把我的想法画成了一张图').status, 'manual');
  assert.equal(evaluatePractice('derivative', 0, 'f\'(3) = 6').status, 'recognized');
  assert.equal(evaluatePractice('derivative', 0, 'f(3)=9').status, 'retry');
  assert.equal(evaluatePractice('recursion', 0, 'factorial(4) = 24').status, 'recognized');
  assert.equal(evaluatePractice('kernel', 0, '').status, 'empty');
});

test('user-authored text is escaped before rendering', () => {
  assert.equal(escapeHTML('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const siteRoot = process.cwd();
const mainPath = path.join(siteRoot, 'app', 'main.js');
const lessonPath = path.join(siteRoot, 'data', 'lessons', 'lesson-13.json');

const elementStub = {
  addEventListener() {},
  classList: { add() {}, remove() {}, toggle() {} },
  querySelectorAll() { return []; },
  setAttribute() {},
  removeAttribute() {},
  innerHTML: ''
};

const context = vm.createContext({
  console,
  document: {
    body: elementStub,
    documentElement: elementStub,
    getElementById() { return elementStub; }
  },
  window: {
    addEventListener() {},
    innerWidth: 1440
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
  },
  navigator: { clipboard: { writeText: async () => {} } },
  setTimeout,
  clearTimeout
});

const source = await fs.readFile(mainPath, 'utf8');
const bootStart = source.indexOf('const boot = async');
assert.ok(bootStart > 0, 'Не найдена точка запуска приложения');

const testableSource = `${source.slice(0, bootStart)}\n` +
  'globalThis.__gradingTestApi = { gradeQuestion, getModuleResult, state };';
vm.runInContext(testableSource, context, { filename: mainPath });

const lesson = JSON.parse(await fs.readFile(lessonPath, 'utf8'));
const { gradeQuestion, getModuleResult, state } = context.__gradingTestApi;
state.data = { modules: [lesson] };

const correctAnswers = {
  1: { 1: 'A', 2: 'B', 3: 'C', 4: 'C', 5: 'D' },
  2: { 0: 5, 1: 2, 2: 1, 3: 3, 4: 4 },
  3: 'B',
  4: { 1: 'A', 2: 'D', 3: 'B', 4: 'C' },
  5: 'B',
  6: 'A',
  7: ['A', 'B', 'C', 'D', 'E'],
  8: 'C',
  9: 'C',
  10: ['A', 'B', 'C', 'D']
};

const resultFor = (answers) => {
  state.tests[lesson.id] = {
    answers,
    submitted: true,
    submittedAt: '2026-07-22T00:00:00.000Z'
  };
  return getModuleResult(lesson);
};

const fullResult = resultFor(correctAnswers);
assert.equal(fullResult.score, 10);
assert.equal(fullResult.passed, true);

const q3FailedResult = resultFor({ ...correctAnswers, 3: 'A' });
assert.equal(q3FailedResult.score, 9);
assert.equal(q3FailedResult.passed, false);
assert.deepEqual([...q3FailedResult.failedRequiredQuestionNumbers], [3]);

const q10FailedResult = resultFor({ ...correctAnswers, 10: ['A', 'B', 'C'] });
assert.equal(q10FailedResult.score, 9);
assert.equal(q10FailedResult.passed, false);
assert.deepEqual([...q10FailedResult.failedRequiredQuestionNumbers], [10]);

const sixCorrectAnswers = {
  ...correctAnswers,
  6: 'B',
  7: ['A'],
  8: 'A',
  9: 'A'
};
const thresholdResult = resultFor(sixCorrectAnswers);
assert.equal(thresholdResult.score, 6);
assert.equal(thresholdResult.passed, true);

const q1 = lesson.questions.find((question) => question.number === 1);
const q1WrongMandatory = gradeQuestion(q1, { 1: 'A', 2: 'B', 3: 'C', 4: 'C', 5: 'A' });
assert.equal(q1WrongMandatory.matchedPairs, 4);
assert.equal(q1WrongMandatory.requiredPairsSatisfied, false);
assert.equal(q1WrongMandatory.correct, false);

const q1ValidPartial = gradeQuestion(q1, { 1: 'B', 2: 'B', 3: 'C', 4: 'C', 5: 'D' });
assert.equal(q1ValidPartial.matchedPairs, 4);
assert.equal(q1ValidPartial.requiredPairsSatisfied, true);
assert.equal(q1ValidPartial.correct, true);

const q4 = lesson.questions.find((question) => question.number === 4);
const q4WrongMandatory = gradeQuestion(q4, { 1: 'A', 2: 'B', 3: 'B', 4: 'C' });
assert.equal(q4WrongMandatory.matchedPairs, 3);
assert.equal(q4WrongMandatory.requiredPairsSatisfied, false);
assert.equal(q4WrongMandatory.correct, false);

const q4ValidPartial = gradeQuestion(q4, { 1: 'A', 2: 'D', 3: 'A', 4: 'C' });
assert.equal(q4ValidPartial.matchedPairs, 3);
assert.equal(q4ValidPartial.requiredPairsSatisfied, true);
assert.equal(q4ValidPartial.correct, true);

console.log('OK: обязательные вопросы и обязательные пары проверены');

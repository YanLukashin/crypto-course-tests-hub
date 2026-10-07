import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-06.json', 'utf8'));
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));

// Accepted source hashes are pinned here; the private answer key is not deployed.
assert.equal(lesson.sourceSha256, 'b42e545b8002137b3fa04eef3b7fcc457588d724aeb579da91fd18a89673f468');
assert.equal(lesson.keySha256, '2af0a6cc2cd4a66f98eea772702ba4be0c9ae83dfe7f6bf3851d1b20a65a11ca');
assert.equal(lesson.courseId, 'cs15');
assert.equal(lesson.id, 'lesson-6');
assert.equal(lesson.number, 6);
assert.equal(lesson.contentVersion, '2026-10-01-recording');
assert.equal(lesson.questions.length, 10);
assert.deepEqual(lesson.questions.map((q) => q.number), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(lesson.questions.map((q) => q.interaction), [
  'single_choice','multi_choice','single_choice','single_choice','single_choice',
  'single_choice','single_choice','single_choice','single_choice','single_choice'
]);
assert.deepEqual(lesson.questions.map((q) => q.grading.mode), lesson.questions.map((q) => q.interaction));
assert.deepEqual(lesson.questions.map((q) => q.goalIds[0]), ['Ц1','Ц4','Ц5','Ц6','Ц2','Ц7','Ц8','Ц9','Ц10','Ц11']);
assert.deepEqual(lesson.questions.map((q) => q.bloomLevel), [
  'Знание','Понимание','Понимание','Знание','Применение',
  'Понимание','Применение','Понимание','Понимание','Понимание'
]);
assert.deepEqual(lesson.questions.map((q) => q.difficulty), [
  'Лёгкая','Средняя','Средняя','Лёгкая','Средняя',
  'Средняя','Средняя','Средняя','Средняя','Средняя'
]);
assert.ok(lesson.questions.every((q) => q.slideRefs.every((ref) => ref.startsWith('recording@'))));
assert.ok(lesson.assessmentMapFile.endsWith('method-recording/01_спецификация_теста_по_записи.md'));
assert.deepEqual(lesson.requiredQuestionNumbers, []);
assert.equal(lesson.passThresholdValue, 8);
assert.ok(lesson.questions.every((q) => !q.criticalAnswerKeys));
assert.deepEqual(built.modules.map((m) => m.number), [1,2,3,5,6,7,8,9]);
assert.deepEqual(built.modules.find((m) => m.number === 6), { ...lesson, totalQuestions: 10 });
assert.deepEqual(lesson.questions.map((q) => q.grading.correctKeys || q.grading.correctKey),
  ['B',['A','B'],'C','D','B','C','A','D','B','C']);

const element = { addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, innerHTML: '' };
const context = vm.createContext({
  console, URL, URLSearchParams, setTimeout, clearTimeout,
  document: { body: element, documentElement: element, getElementById() { return element; } },
  window: { addEventListener() {}, innerWidth: 1440, location: { search: '?course=cs15&lesson=6', href: 'http://localhost/?course=cs15&lesson=6' }, history: { replaceState() {} } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: { clipboard: { writeText: async () => {} } }
});
const source = await fs.readFile('app/main.js', 'utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0);
vm.runInContext(`${source.slice(0, boot)}\nglobalThis.api = { gradeQuestion, getModuleResult, state };`, context);
const { gradeQuestion, getModuleResult, state } = context.api;
state.courseId = 'cs15';
state.data = built;

const answers = Object.fromEntries(lesson.questions.map((q) => [
  q.number, q.interaction === 'single_choice' ? q.grading.correctKey : [...q.grading.correctKeys]
]));
const resultFor = (next) => {
  state.tests[lesson.id] = { answers: next, submitted: true, submittedAt: '2026-10-01T00:00:00.000Z' };
  return getModuleResult(lesson);
};
assert.equal(resultFor(answers).score, 10);
assert.equal(resultFor(answers).passed, true);
assert.equal(resultFor({ ...answers, 1: 'A', 3: 'A' }).score, 8);
assert.equal(resultFor({ ...answers, 1: 'A', 3: 'A' }).passed, true);
assert.equal(resultFor({ ...answers, 1: 'A', 3: 'A', 4: 'A' }).score, 7);
assert.equal(resultFor({ ...answers, 1: 'A', 3: 'A', 4: 'A' }).passed, false);
assert.equal(resultFor({ ...answers, 10: '' }).passed, true, '9/10 has no required questions');

for (const q of lesson.questions.filter((item) => item.interaction === 'multi_choice')) {
  const exact = [...q.grading.correctKeys];
  const missing = exact.slice(0, -1);
  const extra = q.options.find((option) => !exact.includes(option.key))?.key;
  assert.equal(gradeQuestion(q, exact).score, 1, `В${q.number}: exact`);
  assert.equal(gradeQuestion(q, [...exact].reverse()).score, 1, `В${q.number}: order independent`);
  assert.equal(gradeQuestion(q, missing).score, 0, `В${q.number}: missing`);
  assert.equal(gradeQuestion(q, [...exact, extra]).score, 0, `В${q.number}: extra`);
  assert.equal(gradeQuestion(q, []).score, 0, `В${q.number}: empty`);
}
console.log('OK: CS15 lesson 6 source hashes, metadata, В2 exact set, 10/8/7 and no required questions');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const element = { addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, innerHTML: '' };
const context = vm.createContext({
  console, URL, URLSearchParams, setTimeout, clearTimeout,
  document: { body: element, documentElement: element, getElementById() { return element; } },
  window: { addEventListener() {}, innerWidth: 1440, location: { search: '?course=cs15&lesson=3', href: 'http://localhost/?course=cs15&lesson=3' }, history: { replaceState() {} } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, navigator: { clipboard: { writeText: async () => {} } }
});
const source = await fs.readFile('app/main.js', 'utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0, 'Не найдена точка запуска приложения');
vm.runInContext(`${source.slice(0, boot)}\nglobalThis.api = { gradeQuestion, getModuleResult, buildResultText, state };`, context);
const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-03.json', 'utf8'));
const { gradeQuestion, getModuleResult, buildResultText, state } = context.api;
state.courseId = 'cs15';
state.data = { siteTitle: 'Тесты CS15', courseTitle: 'BlockCapital Crypto Summit — CS15', modules: [lesson] };

assert.equal(lesson.questions.length, 10);
assert.deepEqual(lesson.questions.map(q => q.interaction), ['single_choice','ordering','matching_text','single_choice','single_choice','single_choice','single_choice','single_choice','multi_choice','single_choice']);
assert.deepEqual(lesson.requiredQuestionNumbers, [8, 10]);
assert.equal(lesson.failureMessage, 'Нужно повторить блок');
assert.deepEqual(lesson.questions[1].ordering.items.map(item => item.key), ['A','B','C','D']);
assert.deepEqual(lesson.questions[1].grading.solution, [1,2,3,4]);
assert.equal(gradeQuestion(lesson.questions[1], { 0:1, 1:2, 2:3, 3:4 }).score, 1, 'Q2 exact ordering');
assert.equal(gradeQuestion(lesson.questions[1], { 0:1, 1:2, 2:4, 3:3 }).score, 0, 'Q2 rejects swapped steps');
const q3 = lesson.questions[2];
assert.equal(gradeQuestion(q3, { 1:'B', 2:'C', 3:'A' }).score, 1, 'Q3 exact matching');
assert.equal(gradeQuestion(q3, { 1:'B', 2:'A', 3:'C' }).score, 0, 'Q3 rejects wrong pair');
const q9 = lesson.questions[8];
assert.equal(gradeQuestion(q9, ['A','B','C','D']).score, 1, 'Q9 exact multichoice');
assert.equal(gradeQuestion(q9, ['A','B','C','D','E']).score, 0, 'Q9 rejects extra answer');

const correct = { 1:'A', 2:{ 0:1, 1:2, 2:3, 3:4 }, 3:{ 1:'B', 2:'C', 3:'A' }, 4:'C', 5:'A', 6:'C', 7:'A', 8:'C', 9:['A','B','C','D'], 10:'D' };
const resultFor = (answers) => {
  state.tests[lesson.id] = { answers, submitted: true, submittedAt: '2026-09-24T00:00:00.000Z' };
  return getModuleResult(lesson);
};
assert.equal(resultFor(correct).score, 10);
assert.equal(resultFor(correct).passed, true);
let result = resultFor({ ...correct, 8:'A' });
assert.equal(result.score, 9, 'Only Q8 is wrong');
assert.equal(result.passed, false, 'Q8 blocks passing at 9/10');
assert.deepEqual([...result.failedRequiredQuestionNumbers], [8]);
assert.match(buildResultText(lesson), /Статус: Нужно повторить блок/);
assert.match(buildResultText(lesson), /Обязательные вопросы с ошибкой: 8/);
result = resultFor({ ...correct, 10:'A' });
assert.equal(result.score, 9, 'Only Q10 is wrong');
assert.equal(result.passed, false, 'Q10 blocks passing at 9/10');
assert.deepEqual([...result.failedRequiredQuestionNumbers], [10]);
const eight = { ...correct, 1:'B', 4:'A' };
result = resultFor(eight);
assert.equal(result.score, 8);
assert.equal(result.passed, true, '8/10 passes when critical questions are correct');
result = resultFor({ ...correct, 1:'B', 4:'A', 5:'B' });
assert.equal(result.score, 7, '7/10 score');
assert.equal(result.passed, false, '7/10 does not pass');
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));
const builtLesson = built.modules.find(module => module.id === lesson.id);
assert.ok(builtLesson, 'Lesson 3 must be in compiled data');
for (const field of ['questions','estimatedTime','sourceSha256','keySha256','passThresholdValue','requiredQuestionNumbers','failureMessage']) {
  assert.deepEqual(builtLesson[field], lesson[field], `Build must preserve ${field}`);
}
console.log('OK: CS15 lesson 3 exact order/matching/multichoice and Q8/Q10 safety gates');

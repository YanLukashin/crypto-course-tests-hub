import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const element = { addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, innerHTML: '' };
const context = vm.createContext({
  console, URL, URLSearchParams, setTimeout, clearTimeout,
  document: { body: element, documentElement: element, getElementById() { return element; } },
  window: { addEventListener() {}, innerWidth: 1440, location: { search: '?course=cs15&lesson=5', href: 'http://localhost/?course=cs15&lesson=5' }, history: { replaceState() {} } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: { clipboard: { writeText: async () => {} } }
});
const source = await fs.readFile('app/main.js', 'utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0, 'Не найдена точка запуска приложения');
vm.runInContext(`${source.slice(0, boot)}\nglobalThis.api = { gradeQuestion, getModuleResult, getDisplayModules, getStructuredMatchingData, renderMatchingInput, state };`, context);
const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-05.json', 'utf8'));
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));
const { gradeQuestion, getModuleResult, getDisplayModules, getStructuredMatchingData, renderMatchingInput, state } = context.api;

assert.equal(lesson.courseId, 'cs15');
assert.equal(lesson.number, 5);
assert.equal(lesson.title, 'Анализ криптопроектов');
assert.equal(lesson.questions.length, 10);
assert.deepEqual(lesson.questions.map((q) => q.number), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(lesson.questions.map((q) => q.interaction), [
  'single_choice','single_choice','single_choice','matching_text','single_choice',
  'single_choice','single_choice','single_choice','multi_choice','single_choice'
]);
assert.deepEqual(lesson.requiredQuestionNumbers, []);
assert.equal(lesson.passThresholdValue, 8);
assert.ok(lesson.questions.every((q) => !q.criticalAnswerKeys), 'Занятие 5 без критических ответов');
assert.deepEqual(built.modules.map((module) => module.number), [1,2,3,5,6,7,8], 'Пропуск занятия 4 не меняет номера');
assert.deepEqual(built.modules.find((module) => module.number === 5), { ...lesson, totalQuestions: 10 }, 'Сборка сохраняет модуль 5');

assert.equal(lesson.sourceSha256, '43544893a612a034b513d671296962a7d428ae60d6fc0ef29005bc04b0491ab0');
assert.equal(lesson.keySha256, '302ed757ae4c5e12e1eb3b83791b43663b8d130a0fb55793c216b9887f7a9e41');

state.courseId = 'cs15';
state.data = built;
assert.deepEqual([...getDisplayModules()].map((module) => module.number), [1,2,3,5,6,7,8]);
const correct = { 1:'A', 2:'C', 3:'C', 4:{1:'A',2:'B',3:'C'}, 5:'B', 6:'D', 7:'B', 8:'D', 9:['B','D','E'], 10:'A' };
const resultFor = (answers) => {
  state.tests[lesson.id] = { answers, submitted: true, submittedAt: '2026-09-28T00:00:00.000Z' };
  return getModuleResult(lesson);
};
assert.equal(gradeQuestion(lesson.questions[3], correct[4]).score, 1);
assert.equal(getStructuredMatchingData(lesson.questions[3]).leftItems.length, 3, 'Q4 показывает три действия');
assert.equal((renderMatchingInput(lesson.questions[3], {}, false).match(/data-input-type="matching-select"/g) || []).length, 3, 'Q4 показывает три поля выбора');
assert.equal(gradeQuestion(lesson.questions[3], {1:'A',2:'B',3:'A'}).score, 0, 'Q4: две пары без третьей не дают балл');
assert.equal(gradeQuestion(lesson.questions[8], correct[9]).score, 1);
assert.equal(gradeQuestion(lesson.questions[8], ['B','D']).score, 0, 'Q9: два ответа без третьего не дают балл');
assert.equal(gradeQuestion(lesson.questions[8], ['B','D','E','A']).score, 0, 'Q9: лишний ответ снимает балл');
assert.equal(resultFor(correct).score, 10);
assert.equal(resultFor(correct).passed, true);
assert.equal(resultFor({ ...correct, 4:{1:'A',2:'B',3:'A'}, 9:['B','D'] }).score, 8);
assert.equal(resultFor({ ...correct, 4:{1:'A',2:'B',3:'A'}, 9:['B','D'] }).passed, true, '8/10 без обязательных вопросов проходит');
assert.equal(resultFor({ ...correct, 4:{1:'A',2:'B',3:'A'}, 9:['B','D'], 10:'B' }).score, 7);
assert.equal(resultFor({ ...correct, 4:{1:'A',2:'B',3:'A'}, 9:['B','D'], 10:'B' }).passed, false, '7/10 не проходит');
assert.equal(resultFor({ ...correct, 1:'B' }).passed, true, '9/10 проходит без скрытого критического условия');
console.log('OK: CS15 lesson 5 source hashes, gap navigation, exact Q4/Q9 and 8/10 threshold');

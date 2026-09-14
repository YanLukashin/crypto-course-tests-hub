import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the actual application grader with the accepted lesson 2 answers.
const element = { addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, innerHTML: '' };
const memory = new Map();
const context = vm.createContext({
  console, URL, URLSearchParams, setTimeout, clearTimeout,
  document: { body: element, documentElement: element, getElementById() { return element; } },
  window: { addEventListener() {}, innerWidth: 1440, location: { search: '?course=cs15&lesson=2', href: 'http://localhost:4185/?course=cs15&lesson=2' }, history: { replaceState() {} } },
  localStorage: { getItem(k) { return memory.get(k) ?? null; }, setItem(k,v) { memory.set(k,v); }, removeItem(k) { memory.delete(k); } },
  navigator: { clipboard: { writeText: async () => {} } }
});
const source = await fs.readFile('app/main.js', 'utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0);
vm.runInContext(source.slice(0, boot) + '\nglobalThis.api = { gradeQuestion, getModuleResult, buildResultText, renderFeedback, state };', context);
const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-02.json', 'utf8'));
const { gradeQuestion, getModuleResult, buildResultText, renderFeedback, state } = context.api;
state.courseId = 'cs15';
state.data = { siteTitle: 'Тесты CS15', modules: [lesson] };
const answers = { 1:'C', 2:'B', 3:{1:'C',2:'D',3:'A',4:'B',additionalChoice:'false'}, 4:'C', 5:'B', 6:'C', 7:'A', 8:['A','C','D'], 9:'B', 10:'A' };
const resultFor = changes => {
  state.tests[lesson.id] = { answers: {...answers, ...changes}, submitted: true, submittedAt: '2026-09-14T06:00:00Z' };
  return getModuleResult(lesson);
};
let cases = 0;
const check = (changes, score, passed, name) => {
  const r = resultFor(changes);
  assert.equal(r.score, score, `${name}: score`);
  assert.equal(r.passed, passed, `${name}: pass`);
  cases++;
};
check({}, 10, true, 'All correct');
check({1:'A',10:'B'}, 8, true, 'Exactly eight, no critical mistakes');
check({1:'A',9:'A',10:'B'}, 7, false, 'Below threshold');
for (const [number, correct] of [[2,'B'],[4,'C'],[5,'B'],[6,'C'],[7,'A']]) {
  for (const wrong of ['A','B','C','D'].filter(k=>k!==correct)) {
    check({[number]:wrong}, 9, false, `Critical Q${number} ${wrong} at 9/10`);
    check({[number]:wrong,1:'A'}, 8, false, `Critical Q${number} ${wrong} at 8/10`);
  }
  check({[number]:undefined}, 9, false, `Missing safety answer Q${number}`);
}
for (const ordinary of ['A','C']) check({9:ordinary,1:'A'}, 8, true, `Q9 ${ordinary} ordinary mistake`);
check({9:'D'}, 9, false, 'Q9 D critical at 9/10');
check({9:'D',1:'A'}, 8, false, 'Q9 D critical at 8/10');
check({9:undefined}, 9, true, 'Q9 missing answer is not selected dangerous action');
const q3 = lesson.questions.find(q=>q.number===3);
for (const additionalChoice of ['true', '', undefined]) {
  const r = gradeQuestion(q3, {...answers[3], additionalChoice});
  assert.equal(r.score, 0, `Q3 additional ${additionalChoice}`); cases++;
}
for (const pair of ['1','2','3','4']) {
  for (const wrong of ['', ...['A','B','C','D'].filter(k=>k!==answers[3][pair])]) {
    assert.equal(gradeQuestion(q3, {...answers[3],[pair]:wrong}).score, 0, `Q3 wrong pair ${pair}`); cases++;
  }
}
assert.equal(gradeQuestion(q3, answers[3]).score, 1);
for (const [additionalChoice, label] of [['false','засчитан'],['true','не засчитан'],[undefined,'не засчитан']]) {
  resultFor({3:{...answers[3],additionalChoice}});
  const feedback = renderFeedback(q3,lesson.id).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
  assert.match(feedback,new RegExp(`Ответ на дополнительное утверждение:\\s*${label}`),`Q3 feedback must grade the answer: ${additionalChoice}`);
  assert.doesNotMatch(feedback,/Дополнительное утверждение:\s*верно/,'Feedback must not call the unsafe hardware-wallet promise true');
  cases++;
}
const q8 = lesson.questions.find(q=>q.number===8);
for (let mask=0;mask<64;mask++) {
  const choices = ['A','B','C','D','E','F'].filter((_,i)=>mask&(1<<i));
  const expected = choices.join('')==='ACD' ? 1 : 0;
  assert.equal(gradeQuestion(q8, choices).score, expected, `Q8 exact set ${choices}`); cases++;
}
resultFor({9:'D'});
const text = buildResultText(lesson);
assert.match(text, /CS15/);
assert.match(text, /не сдан/);
assert.match(text, /9/);
assert.deepEqual(lesson.requiredQuestionNumbers, [2,4,5,6,7]);
assert.deepEqual(lesson.questions.find(q=>q.number===9).criticalAnswerKeys, ['D']);
assert.equal(lesson.questions.length, 10);
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));
const builtLesson = built.modules.find(m=>m.id===lesson.id);
assert.ok(builtLesson, 'CS15 lesson must be included in the browser data');
assert.deepEqual(builtLesson.questions, lesson.questions, 'Built data must preserve both Q3 parts and dangerous choices');
assert.equal(builtLesson.instructionsMarkdown, lesson.instructionsMarkdown, 'Learner grading rules must survive the build');
assert.equal(builtLesson.passThresholdValue, 8);
assert.deepEqual(builtLesson.requiredQuestionNumbers, [2,4,5,6,7]);
console.log(`OK: ${cases} CS15 grading scenarios; exact Q3/Q8, threshold and critical gates`);

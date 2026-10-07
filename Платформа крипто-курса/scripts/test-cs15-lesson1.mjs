import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Проверяем оценивание фактическим кодом приложения по независимо заданному ключу.
const element = { addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} }, querySelectorAll() { return []; }, setAttribute() {}, removeAttribute() {}, innerHTML: '' };
const context = vm.createContext({
  console, URL, URLSearchParams, setTimeout, clearTimeout,
  document: { body: element, documentElement: element, getElementById() { return element; } },
  window: { addEventListener() {}, innerWidth: 1440, location: { search: '?lesson=1', href: 'http://localhost/?lesson=1' }, history: { replaceState() {} } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  navigator: { clipboard: { writeText: async () => {} } }
});
const source = await fs.readFile('app/main.js', 'utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0);
vm.runInContext(source.slice(0, boot) + '\nglobalThis.api = { gradeQuestion, getModuleResult, buildResultText, state };', context);
const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-01.json', 'utf8'));
const { gradeQuestion, getModuleResult, buildResultText, state } = context.api;
state.courseId = 'cs15';
state.data = { siteTitle: 'Тесты CS15', modules: [lesson] };
const answers = { 1:{1:'B',2:'D',3:'C',4:'A'}, 2:'C', 3:{1:'A',2:'B',3:'C'}, 4:'A', 5:'D', 6:'C', 7:{1:'C',2:'D',3:'B',4:'A'}, 8:'D', 9:'C', 10:'C' };
let cases = 0;
for (let mask = 0; mask < 1024; mask++) {
  const attempt = {};
  let expectedScore = 0;
  for (let n = 1; n <= 10; n++) {
    if (mask & (1 << (n - 1))) { attempt[n] = answers[n]; expectedScore++; }
  }
  state.tests[lesson.id] = { answers: attempt, submitted: true, submittedAt: '2026-09-14T08:00:00Z' };
  const result = getModuleResult(lesson);
  assert.equal(result.score, expectedScore, `Attempt ${mask}: score`);
  assert.equal(result.passed, expectedScore >= 8, `Attempt ${mask}: pass without inherited safety gates`);
  cases++;
}
for (const n of [1,3,7]) {
  const q = lesson.questions.find(q => q.number === n);
  const pairKeys = Object.keys(answers[n]);
  const values = ['', 'A', 'B', 'C', 'D'];
  for (let code = 0; code < values.length ** pairKeys.length; code++) {
    let remainder = code;
    const answer = {};
    for (const key of pairKeys) {
      answer[key] = values[remainder % values.length];
      remainder = Math.floor(remainder / values.length);
    }
    const exact = pairKeys.every(key => answer[key] === answers[n][key]);
    assert.equal(gradeQuestion(q, answer).score, Number(exact), `Q${n}: matching ${JSON.stringify(answer)}`);
    cases++;
  }
}
for (const n of [2,4,5,6,8,9,10]) {
  const q = lesson.questions.find(q => q.number === n);
  for (const value of ['', 'A','B','C','D']) {
    assert.equal(gradeQuestion(q, value).score, Number(value === answers[n]), `Q${n}: ${value}`);
    cases++;
  }
}
assert.deepEqual(lesson.requiredQuestionNumbers, []);
assert.ok(lesson.questions.every(q => !q.criticalAnswerKeys));
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));
assert.deepEqual(built.modules.map(m => m.number), [1,2,3,5,6,7], 'All accepted CS15 tests must be present');
for (const module of built.modules) {
  const raw = JSON.parse(await fs.readFile(`data/cs15/lessons/lesson-${String(module.number).padStart(2,'0')}.json`, 'utf8'));
  for (const field of ['questions','instructionsMarkdown','sourceSha256','keySha256','assessmentMapFile','passThresholdValue','requiredQuestionNumbers']) {
    assert.deepEqual(module[field], raw[field], `L${module.number}: ${field} must survive compilation`);
  }
}
assert.match(buildResultText(lesson), /CS15/);
assert.match(buildResultText(lesson), /10\/10/);

// Следующие публикации не должны снова терять обязательную методическую карту.
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'cs15-build-'));
try {
  await fs.mkdir(path.join(fixture, 'data/lessons'), { recursive:true });
  await fs.mkdir(path.join(fixture, 'data/cs15/lessons'), { recursive:true });
  const legacy = await fs.readFile('data/lessons/lesson-01.json');
  await fs.writeFile(path.join(fixture, 'data/lessons/lesson-01.json'), legacy);
  const builder = path.resolve('scripts/build-course-data.mjs');
  const mutations = [
    ['valid', () => {}, true],
    ['missing goal', d => { delete d.questions[0].goalIds; }],
    ['missing rationale', d => { delete d.questions[0].bloomRationale; }],
    ['missing slide', d => { d.questions[0].slideRefs = []; }],
    ['difficulty confused with level', d => { d.questions[0].difficulty = 'Прикладной вопрос'; }],
    ['single level', d => { d.questions.forEach(q => { q.bloomLevel = 'Понимание'; }); }],
    ['single conservative level', d => { d.questions.forEach(q => { q.bloomMinimumLevel = 'Знание'; q.bloomLevelRange = ['Знание',q.bloomLevel]; }); }],
    ['invalid level range', d => { d.questions[0].bloomMinimumLevel = 'Анализ'; d.questions[0].bloomLevelRange = ['Знание']; }],
    ['duplicate question', d => { d.questions[1].number = 1; }],
    ['missing source hash', d => { delete d.sourceSha256; }]
  ];
  for (const [name, mutate, valid = false] of mutations) {
    const data = structuredClone(lesson); mutate(data);
    await fs.writeFile(path.join(fixture, 'data/cs15/lessons/lesson-01.json'), JSON.stringify(data));
    const run = spawnSync(process.execPath, [builder], { cwd:fixture, encoding:'utf8' });
    assert.equal(run.status === 0, valid, `Builder ${name}: ${run.stderr}`); cases++;
  }
} finally {
  await fs.rm(fixture, { recursive:true, force:true });
}
console.log(`OK: ${cases} lesson 1 scoring and assessment-data checks`);

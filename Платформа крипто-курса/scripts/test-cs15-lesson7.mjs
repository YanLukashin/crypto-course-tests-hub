import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-07.json', 'utf8'));
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));
assert.equal(lesson.sourceSha256, '9a9bc70a049cc8bd980d6903a37def3f21ce1e9c0b04dfd701677e3c30dd7cdf');
assert.equal(lesson.keySha256, '73efcffc4fccc7e8e807402cd82e9a068e7768f0de9800a2fd4926483916e04e');
assert.equal(lesson.courseId, 'cs15');
assert.equal(lesson.id, 'lesson-7');
assert.equal(lesson.number, 7);
assert.equal(lesson.contentVersion, '2026-10-05-recording');
assert.equal(lesson.questions.length, 10);
assert.deepEqual(lesson.questions.map(q => q.number), [1,2,3,4,5,6,7,8,9,10]);
assert.deepEqual(lesson.questions.map(q => q.goalIds), Array.from({length:10},(_,i)=>[`Ц${i+1}`]));
assert.deepEqual(lesson.questions.map(q => q.bloomLevel), ['Знание','Понимание','Применение','Понимание','Понимание','Знание','Знание','Понимание','Понимание','Применение']);
assert.deepEqual(lesson.questions.map(q => q.difficulty), ['Лёгкая','Средняя','Средняя','Средняя','Средняя','Лёгкая','Лёгкая','Средняя','Средняя','Средняя']);
assert.ok(lesson.questions.every(q => q.interaction === 'single_choice' && q.grading.mode === 'single_choice'));
assert.ok(lesson.questions.every(q => q.options.length === 4 && q.slideRefs.every(ref => ref.startsWith('recording@'))));
assert.deepEqual(lesson.questions.map(q => q.grading.correctKey), ['B','C','C','A','D','B','A','D','C','B']);
assert.deepEqual(lesson.requiredQuestionNumbers, []);
assert.equal(lesson.passThresholdValue, 8);
assert.deepEqual(built.modules.map(m => m.number), [1,2,3,5,6,7,8,9]);
assert.deepEqual(built.modules.find(m => m.number === 7), {...lesson,totalQuestions:10});
const element = {addEventListener(){},classList:{add(){},remove(){},toggle(){}},querySelectorAll(){return[];},setAttribute(){},removeAttribute(){},innerHTML:''};
const context = vm.createContext({console,URL,URLSearchParams,setTimeout,clearTimeout,
  document:{body:element,documentElement:element,getElementById(){return element;}},
  window:{addEventListener(){},innerWidth:1440,location:{search:'?course=cs15&lesson=7',href:'http://localhost/?course=cs15&lesson=7'},history:{replaceState(){}}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, navigator:{clipboard:{writeText:async()=>{}}}});
const source = await fs.readFile('app/main.js','utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0);
vm.runInContext(`${source.slice(0,boot)}\nglobalThis.api={gradeQuestion,getModuleResult,state};`,context);
const {gradeQuestion,getModuleResult,state} = context.api;
state.courseId='cs15'; state.data=built;
for(const q of lesson.questions){
  assert.equal(gradeQuestion(q,q.grading.correctKey).score,1,`Q${q.number} correct`);
  for(const option of q.options.filter(o=>o.key!==q.grading.correctKey)) assert.equal(gradeQuestion(q,option.key).score,0,`Q${q.number} wrong ${option.key}`);
  assert.equal(gradeQuestion(q,'').score,0,`Q${q.number} blank`);
}
// All 1024 correct/blank combinations: exact score and every 8/10 boundary.
for(let mask=0;mask<1024;mask++){
  const answers=Object.fromEntries(lesson.questions.map((q,index)=>[q.number,mask & (1<<index) ? q.grading.correctKey : '']));
  const expected=Object.values(answers).filter(Boolean).length;
  state.tests[lesson.id]={answers,submitted:true,submittedAt:'2026-10-05T00:00:00Z'};
  const result=getModuleResult(lesson);
  assert.equal(result.score,expected,`mask${mask}`);
  assert.equal(result.passed,expected>=8,`mask${mask}`);
}
console.log('OK: CS15 lesson7 accepted hashes, metadata, 50 option/blank checks, 1024 grading combinations and 8/10 boundary');

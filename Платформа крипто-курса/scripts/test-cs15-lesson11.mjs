import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const lesson = JSON.parse(await fs.readFile('data/cs15/lessons/lesson-11.json', 'utf8'));
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json', 'utf8'));
const KEYS = ['B','C','A','D','B','A','D','C','A','C','D','B','C','B','D'];
assert.equal(lesson.sourceSha256, '72012736c376fa2d9c5e33338b89a62c5758e13e351a95a06b2b2972b79f6116');
assert.equal(lesson.keySha256, 'da7af28cf1173c23185dfa7b4d2446fc3868aa566888b6f08bf1760038663b4c');
assert.equal(lesson.courseId, 'cs15');
assert.equal(lesson.id, 'lesson-11');
assert.equal(lesson.number, 11);
assert.equal(lesson.displayLabel, 'Занятия 11–13');
assert.equal(lesson.contentVersion, '2026-10-26-recording');
assert.equal(lesson.title, 'DEX, пулы ликвидности и концентрированная ликвидность');
assert.equal(lesson.testTitle, 'CS15 — Тест к занятиям 11–13 по записям');
assert.equal(lesson.questions.length, 15);
assert.deepEqual(lesson.questions.map(q => q.number), Array.from({length:15},(_,i)=>i+1));
assert.deepEqual(lesson.questions.map(q => q.goalIds), Array.from({length:15},(_,i)=>[`Ц${i+1}`]));
assert.deepEqual(lesson.questions.map(q => q.bloomLevel), ['Знание','Применение','Понимание','Применение','Понимание','Знание','Понимание','Применение','Применение','Понимание','Применение','Понимание','Понимание','Понимание','Понимание']);
assert.ok(lesson.questions.every(q => q.interaction === 'single_choice' && q.grading.mode === 'single_choice'));
assert.ok(lesson.questions.every(q => q.options.length === 4 && q.slideRefs.length > 0 && q.slideRefs.every(ref => /^З1[123]@\d\d:\d\d:\d\d–\d\d:\d\d:\d\d$/u.test(ref))));
assert.deepEqual(lesson.questions.map(q => q.grading.correctKey), KEYS);
assert.deepEqual(lesson.questions.map(q => q.correctAnswer), KEYS);
assert.deepEqual(lesson.requiredQuestionNumbers, []);
assert.equal(lesson.passThresholdValue, 12);
assert.equal(lesson.passThreshold, '12/15');
assert.deepEqual(built.modules.map(m => m.number), [1,2,3,5,6,7,8,10,11,14]);
assert.deepEqual(built.modules.find(m => m.number === 11), {...lesson,totalQuestions:15});
assert.equal(built.modules.filter(m => m.displayLabel).length, 1, 'displayLabel only on lesson 11');
const element = {addEventListener(){},classList:{add(){},remove(){},toggle(){}},querySelectorAll(){return[];},setAttribute(){},removeAttribute(){},innerHTML:''};
const context = vm.createContext({console,URL,URLSearchParams,setTimeout,clearTimeout,
  document:{body:element,documentElement:element,getElementById(){return element;}},
  window:{addEventListener(){},innerWidth:1440,location:{search:'?course=cs15&lesson=11',href:'http://localhost/?course=cs15&lesson=11'},history:{replaceState(){}}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, navigator:{clipboard:{writeText:async()=>{}}}});
const source = await fs.readFile('app/main.js','utf8');
const boot = source.indexOf('const boot = async');
assert.ok(boot > 0);
vm.runInContext(`${source.slice(0,boot)}\nglobalThis.api={gradeQuestion,getModuleResult,state,getModuleLabel};`,context);
const {gradeQuestion,getModuleResult,state} = context.api;
state.courseId='cs15'; state.data=built;
for(const q of lesson.questions){
  assert.equal(gradeQuestion(q,q.grading.correctKey).score,1,`Q${q.number} correct`);
  for(const option of q.options.filter(o=>o.key!==q.grading.correctKey)) assert.equal(gradeQuestion(q,option.key).score,0,`Q${q.number} wrong ${option.key}`);
  assert.equal(gradeQuestion(q,'').score,0,`Q${q.number} blank`);
}
// All 32768 correct/blank combinations: exact score and every 12/15 boundary.
const getModuleLabel = context.api.getModuleLabel;
assert.equal(getModuleLabel(lesson), 'Занятия 11–13');
assert.equal(getModuleLabel(built.modules.find(m => m.number === 10)), 'Занятие 10');
for(let mask=0;mask<32768;mask++){
  const answers=Object.fromEntries(lesson.questions.map((q,index)=>[q.number,mask & (1<<index) ? q.grading.correctKey : '']));
  const expected=Object.values(answers).filter(Boolean).length;
  state.tests[lesson.id]={answers,submitted:true,submittedAt:'2026-10-26T00:00:00Z'};
  const result=getModuleResult(lesson);
  assert.equal(result.score,expected,`mask${mask}`);
  assert.equal(result.passed,expected>=12,`mask${mask}`);
}
const scenario=(correct)=>{state.tests[lesson.id]={answers:Object.fromEntries(lesson.questions.map((q,i)=>[q.number,i<correct?q.grading.correctKey:q.options.find(o=>o.key!==q.grading.correctKey).key])),submitted:true};return getModuleResult(lesson);};
for(const [n,pass] of [[15,true],[13,true],[12,true],[11,false],[0,false]]){const r=scenario(n);assert.equal(r.score,n,`${n}/15 score`);assert.equal(r.total,15);assert.equal(r.passed,pass,`${n}/15 pass`);}
state.tests[lesson.id]={answers:{},submitted:true};{const r=getModuleResult(lesson);assert.equal(r.score,0);assert.equal(r.passed,false);}
console.log('OK: CS15 lesson11 accepted hashes, metadata, 75 option/blank checks, 32768 grading combinations and 12/15 boundary');

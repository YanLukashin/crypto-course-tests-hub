import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const built = JSON.parse(await fs.readFile('data/cs15/course-data.json','utf8'));
assert.deepEqual(built.modules.map(m=>m.number),[1,2,3,5,6,7,8,9]);
const element = {addEventListener(){},classList:{add(){},remove(){},toggle(){}},querySelectorAll(){return[];},setAttribute(){},removeAttribute(){},innerHTML:''};
const context=vm.createContext({console,URL,URLSearchParams,setTimeout,clearTimeout,
  document:{body:element,documentElement:element,getElementById(){return element;}},
  window:{addEventListener(){},innerWidth:1440,location:{search:'?course=cs15&lesson=8',href:'http://localhost/?course=cs15&lesson=8'},history:{replaceState(){}}},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}},navigator:{clipboard:{writeText:async()=>{}}}});
const source=await fs.readFile('app/main.js','utf8');
const boot=source.indexOf('const boot = async');
assert.ok(boot>0);
vm.runInContext(`${source.slice(0,boot)}\nglobalThis.api={gradeQuestion,getModuleResult,state};`,context);
const {gradeQuestion,getModuleResult,state}=context.api;
state.courseId='cs15'; state.data=built;
for(const number of [8,9]){
  const lesson=JSON.parse(await fs.readFile(`data/cs15/lessons/lesson-0${number}.json`,'utf8'));
  assert.equal(lesson.id,`lesson-${number}`);
  assert.equal(lesson.number,number);
  assert.equal(lesson.courseId,'cs15');
  assert.equal(lesson.contentVersion,'2026-10-07-prelesson');
  assert.equal(lesson.passThresholdValue,8);
  assert.deepEqual(lesson.requiredQuestionNumbers,[]);
  assert.equal(lesson.questions.length,10);
  assert.deepEqual(lesson.questions.map(q=>q.number),[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(built.modules.find(m=>m.number===number),{...lesson,totalQuestions:10});
  assert.equal(new Set(lesson.questions.map(q=>q.bloomLevel)).size,3);
  for(const q of lesson.questions){
    assert.equal(q.interaction,'single_choice');
    assert.equal(q.grading.mode,'single_choice');
    assert.equal(q.correctAnswer,q.grading.correctKey);
    assert.equal(q.options.length,3);
    assert.ok(q.goalIds.every(g=>g.startsWith(`${number}-`)));
    assert.ok(q.slideRefs.every(r=>/^S\d\d$/.test(r)));
    assert.equal(gradeQuestion(q,q.grading.correctKey).score,1);
    for(const option of q.options.filter(o=>o.key!==q.grading.correctKey)) assert.equal(gradeQuestion(q,option.key).score,0);
    assert.equal(gradeQuestion(q,'').score,0);
  }
  for(let mask=0;mask<1024;mask++){
    const answers=Object.fromEntries(lesson.questions.map((q,i)=>[q.number,mask & (1<<i) ? q.grading.correctKey : q.options.find(o=>o.key!==q.grading.correctKey).key]));
    const expected=lesson.questions.filter(q=>answers[q.number]===q.grading.correctKey).length;
    state.tests[lesson.id]={answers,submitted:true,submittedAt:'2026-10-07T00:00:00Z'};
    const result=getModuleResult(lesson);
    assert.equal(result.score,expected,`L${number} mask${mask}`);
    assert.equal(result.passed,expected>=8,`L${number} mask${mask}`);
  }
}
console.log('PASS: lessons8/9 all choices/blanks and 2048 grading combinations; threshold8/10, no required questions');

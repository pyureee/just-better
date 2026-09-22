const assert=require('assert/strict');
const {harness,Vec}=require('./lancer-harness.cjs');
const starts=h=>h.sent.filter(x=>x.name==='C_START_SKILL');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
 for(const [key,id] of [['spring',131100],['onslaught',30200]]){
  await test(key+': keyboard repeats cannot overwrite real aim or target',async()=>{
   const h=harness();h.cd(id,1000);h.mods.position.w=-1.5;
   const input={...h.input(id),w:2.7,target:55n,dest:new Vec(110,220,330)};
   h.dispatch('C_START_SKILL',input);
   for(let i=0;i<8;i++){await h.advance(100);h.mods.lancerEntrySkill.onHotkey(key);}
   await h.advance(800);
   const main=starts(h).find(x=>x.event.skill.id===id);
   assert(main);assert.equal(main.event.w,2.7);assert.equal(main.event.target,55n);
   assert.deepEqual(main.event.dest,input.dest);assert.equal(input.w,2.7);h.dispose();
  });
  await test(key+': keyboard-only requests use client heading and no inherited target',async()=>{
   const h=harness();h.cd(id,1000);
   h.mods.last.startSkill={...h.input(100300),w:-2,target:999n,targets:[{gameId:999n}],dest:new Vec(-300,30,30)};
   h.dispatch('C_PLAYER_LOCATION',{type:0,w:0.9,loc:new Vec()});
   h.mods.position.w=-2;h.mods.lancerEntrySkill.onHotkey(key);
   await h.advance(500);
   h.dispatch('C_PLAYER_LOCATION',{type:0,w:1.9,loc:new Vec()});
   h.dispatch('C_PLAYER_LOCATION',{type:0,w:-2,loc:new Vec()},true);
   await h.advance(1100);
   const main=starts(h).find(x=>x.event.skill.id===id);
   assert(main);assert.equal(main.event.w,1.9);assert.equal(main.event.target,0n);
   assert.equal(main.event.targets,undefined);assert.deepEqual(main.event.dest,{x:0,y:0,z:0});h.dispose();
  });
  await test(key+': real request replaces keyboard-only aim while queued',async()=>{
   const h=harness();h.cd(id,1000);h.mods.lancerEntrySkill.onHotkey(key);await h.advance(200);
   h.press(id,-0.8);h.mods.lancerEntrySkill.onHotkey(key);await h.advance(1500);
   assert.equal(starts(h).find(x=>x.event.skill.id===id).event.w,-0.8);h.dispose();
  });
 }
 await test('unrelated skills preserve side input, target and destination',async()=>{
  const h=harness();const event={...h.input(100300),w:-2.4,moving:true,target:77n,dest:new Vec(-10,20,30)};
  h.dispatch('C_START_SKILL',event);await h.advance(100);
  const sent=starts(h).find(x=>x.event.skill.id===100300).event;
  for(const field of ['w','moving','target'])assert.equal(sent[field],event[field]);
  assert.deepEqual(sent.dest,event.dest);h.dispose();
 });
 console.log('Passed '+passed+' entry-aim tests.');
})().catch(error=>{console.error(error);process.exitCode=1;});

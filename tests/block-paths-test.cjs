const assert=require('assert/strict');
const {harness,Vec}=require('./lancer-harness.cjs');
const guards=h=>h.sent.filter(x=>x.name==='C_PRESS_SKILL'&&x.event.skill.id===20200);
let passed=0;
async function test(name,fn){if(process.env.BLOCK_TEST_FILTER&&!name.includes(process.env.BLOCK_TEST_FILTER))return;await fn();passed++;console.log('PASS '+name);}
(async()=>{
 for(const input of ['skill','targeted','movement'])await test('cancel queued post-Counter Block with '+input,async()=>{
  const h=harness(1.59);h.mods.ping.ping=14;h.mods.ping.jitter=3;h.mods.settings.info.delay=4;
  h.previous(81100);
  h.dispatch('S_ACTION_STAGE',{gameId:1n,skill:{id:81100},id:501,stage:0,speed:1.59,loc:new Vec(),w:1,animSeq:[]});
  h.mods.skills.sendActionEnd(81100,0);
  await h.advance(4); // after the generated press enters PR, before it executes
  if(input==='skill')h.press(181100);
  if(input==='targeted'){const e={...h.input(151000),targets:[]};h.mods.last.startSkill=e;h.dispatch('C_START_TARGETED_SKILL',e);}
  if(input==='movement')h.dispatch('C_PLAYER_LOCATION',{type:0,w:1,loc:new Vec()});
  await h.advance(500);
  assert.equal(guards(h).filter(x=>x.event.press).length,0,'orphan press reached server');
  assert(!h.stages().some(x=>x.event.skill.id===20200),'orphan press predicted Block');h.dispose();
 });
 for(const interrupt of [false,true])await test('Auto Block source ends while press is queued'+(interrupt?' and new skill wins':''),async()=>{
  const h=harness(1.59,true);h.mods.ping.ping=14;h.mods.ping.jitter=43;h.mods.settings.info.delay=50;
  let intercepted=false;
  h.mod.hook('C_PRESS_SKILL',1,{order:-6,filter:{fake:true}},event=>{
   if(!event.press||intercepted)return;intercepted=true;
   h.mod.setTimeout(()=>h.mods.skills.sendActionEnd(30230,0),1);
   if(interrupt)h.mod.setTimeout(()=>h.press(181100),4);
  });
  h.previous(30230);await h.advance(3000);
  assert(intercepted,'test never reached automated Block');
  assert.deepEqual(guards(h).map(x=>x.event.press),interrupt?[]:[true,false]);
  if(!interrupt)assert.equal(h.mods.action.inAction,false,'Block remained active');
  h.dispose();
 });
 await test('manual held Block takes ownership from an automatic tap',async()=>{
  const h=harness(1.59,true);h.mods.settings.info.lancer_silent_block.enabled=false;
  let tookOver=false;
  h.mod.hook('S_ACTION_STAGE',1,{order:120,filter:{fake:true}},event=>{
   if(event.skill.id!==20200||event.stage!==0||tookOver)return;
   tookOver=true;h.dispatch('C_PRESS_SKILL',{...h.input(20200),press:true});
  });
  h.previous(30230);await h.advance(2500);
  assert(tookOver);assert.equal(guards(h).filter(x=>!x.event.press).length,0,'auto release cancelled manual hold');
  assert.equal(h.mods.action.inAction,true);h.dispose();
 });
 console.log('Passed '+passed+' block-path regression tests.');
})().catch(error=>{console.error(error);process.exitCode=1;});

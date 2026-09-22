const assert=require('assert/strict');
const {harness}=require('./lancer-harness.cjs');
(async()=>{
for(const cancel of [false,true]) {
 const h=harness(2.25,false);
 h.mods.ping.jitter=23;h.mods.ping.ping=151;
 h.previous(30230,610);h.mods.action.speed.real=3.3159375;
 h.mod.setTimeout(()=>{if(h.mods.action.stage.skill.id===30230)h.mods.skills.sendActionEnd(30230,0);},194);
 h.press(131100);
 if(cancel)h.mod.setTimeout(()=>h.mods.lancerEntrySkill.onHotkey('cancel'),200);
 await h.advance(1500);
 const packets=h.sent.filter(x=>x.name==='C_PRESS_SKILL'&&x.event.skill.id===20200);
 if(cancel) {
   assert.equal(packets.filter(x=>x.event.press).length,0,'cancelled delayed press must never execute');
 } else {
   assert.deepEqual(packets.map(x=>x.event.press),[true,false],'press must precede release');
   const stages=h.stages().filter(x=>x.event.stage===0).map(x=>x.event.skill.id);
   assert.deepEqual(stages,[30230,20200,181100,131130]);
   const release=packets.find(x=>!x.event.press);
   assert(h.stages().find(x=>x.event.skill.id===181100).at>=release.at);
 }
 h.dispose();
 console.log('PASS log timing overlap '+(cancel?'with cancellation':'completes Spring'));
}
})().catch(e=>{console.error(e);process.exitCode=1;});

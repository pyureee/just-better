const assert=require('assert/strict'),fs=require('fs');
const {harness}=require('./lancer-harness.cjs');
const root=require('path').resolve(__dirname,'..');
let count=0;
for(const [job,file,ids] of [[5,'Archer',[31100,41200]],[3,'Berserker',[31100,101100]]]) {
 const data=JSON.parse(fs.readFileSync(root+'/skills/female/elin/'+file+'.json'));
 const h=harness();h.mods.player.job=job;h.mods.skills._getInfo=id=>data[id];
 for(const id of ids) for(let stage=0;stage<4;stage++) for(const elapsed of [0,20,100,5000]) {
  Object.assign(h.mods.action,{inAction:true,speed:{real:2}});
  Object.assign(h.mods.action.stage,{skill:{id},stage,_stageTime:h.clock()-elapsed});
  const result=h.mods.skills.getNewSkillData(id,{press:false});
  assert.equal(result.skillId,data[id].animLength[stage][1]);
  assert.equal(result.charge,true);
  assert.equal(h.mods.skills.getRetryCount(id),4);
  assert.equal(h.mods.hardcoded.getRetryDelay(id),20);
  count++;
 }
 assert.equal(h.mods.cycloneChargePrediction,undefined);h.dispose();
}
console.log('PASS '+count+' charge-release cases across all four skills, including extended final-stage holds; default retries verified.');

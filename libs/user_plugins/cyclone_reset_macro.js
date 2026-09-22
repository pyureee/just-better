'use strict';
const BERSERKER=3,CYCLONE=10,LETHAL=18,RAZE=25,FLATTEN=4,CHAIN=401720;
const base=id=>Math.floor((id||0)/10000);
const clone=v=>v?.clone?v.clone():v&&typeof v==='object'?{...v}:v;
module.exports=function CycloneResetMacro(mod,mods){
  let pending=null,timer=null,emitting=null,destroyed=false,lethalCooldown=null;
  let raze=null,razeTimer=null;
  const enabled=()=>!destroyed&&mods.player.job===BERSERKER&&mods.player.alive!==false&&
    mods.utils.isEnabled()&&mods.utils.canCastSkill()&&!mods.action.inSpecialAction;
  const own=e=>mods.player.isMe(e.gameId??e.target);
  const reset=()=>{
    const s=pending;if(s)mods.log.debug('CYCLONE-MACRO','reset phase:'+s.phase);pending=null;mod.clearTimeout(timer);timer=null;
    if(s&&s.chargeLocal!==undefined&&mods.action.inAction&&mods.action.stage?.id===s.chargeLocal&&mods.action.stage.skill.id===s.cyclone)
      mods.skills.sendActionEnd(s.cyclone,6);
  };
  const active=s=>pending===s&&enabled()&&Date.now()<=s.deadline;
  const later=(s,fn,delay=10)=>{mod.clearTimeout(timer);timer=mod.setTimeout(()=>{timer=null;if(!active(s)){reset();return;}fn(s);},delay);};
  const highest=b=>Object.keys(mods.last.skillList?.skills||mods.skills.info.skillData).map(Number)
    .filter(id=>base(id)===b&&id%100===0&&mods.skills._getInfo(id)).reduce((a,b)=>Math.max(a,b),0);
  const cancelRaze=()=>{raze=null;mod.clearTimeout(razeTimer);razeTimer=null;};
  const followRaze=cast=>{
    if(raze!==cast||!enabled()||Date.now()>cast.deadline||!cast.serverConfirmed||
      !mods.action.inAction||mods.action.stage?.id!==cast.localId||base(mods.action.stage.skill.id)!==RAZE)
      return cancelRaze();
    const flatten=highest(FLATTEN),speed=mods.action.speed?.real;
    const start=mods.skills._getInfo(mods.action.stage.skill.id)?.cancels?.pendingStartTime;
    if(!flatten||!(speed>0)||!(cast.serverSpeed>0)||!Number.isFinite(start)||cooling(flatten))return cancelRaze();
    const serverReady=cast.serverTime+start/cast.serverSpeed-(mods.ping.ping||0)+
      (mods.ping.jitter||0)+15;
    const readyAt=Math.max(mods.action.stage._time+start/speed+20,serverReady);
    if(Date.now()<readyAt){razeTimer=mod.setTimeout(()=>followRaze(cast),Math.max(1,readyAt-Date.now()));return;}
    const data=resolve(flatten);
    if(!data.chain||base(data.skillId)!==FLATTEN||![30,31].includes(data.skillId%100)||
      !allowed(flatten,data)){
      razeTimer=mod.setTimeout(()=>followRaze(cast),10);return;
    }
    cancelRaze();
    mods.log.debug('CYCLONE-MACRO','Raze chain ready; casting Flatten '+flatten);
    cast.injectedAt=Date.now();
    emitting={s:cast,name:'C_START_SKILL',id:flatten,raze:true};
    try {mod.send(...mods.packet.get_all('C_START_SKILL'),{skill:{id:flatten,type:1},
      loc:clone(mods.position.loc||cast.event.loc),w:cast.event.w,dest:{x:0,y:0,z:0},
      moving:false,continue:false,target:0n,destPosOnAir:false,isPerfectCombo:false});}
    finally {emitting=null;}
  };
  const cooling=id=>{
    if(base(id)===LETHAL&&lethalCooldown!==null)return lethalCooldown>Date.now();
    const records=[mods.cooldown.getData(base(id),true),mods.cooldown.getData(id,true)].filter(Boolean);
    if(records.length){const latest=records.reduce((a,b)=>b.time>a.time?b:a);return latest.time+latest.cooldown>Date.now();}
    return mods.cooldown.isOnCooldown(id,id)||mods.cooldown.isOnCooldownBase(base(id));
  };
  const resolve=(id,press)=>mods.skills.getNewSkillData(id,{byGrant:false,press});
  const allowed=(id,data,press)=>mods.utils.isEnabled(id)&&!data.failed&&
    mods.skills.canCast(data,{originalSkillId:id,byGrant:false,press})>=-2;
  const readyInstant=s=>mods.effects.hasAbnormalityWithCategoryTypeValue(mods.skills.getCategories(s.cyclone),327);
  const send=(s,name,id,extra={})=>{
    const event={skill:{id,type:1},loc:clone(mods.position.loc||s.event.loc),
      w:s.aimW??s.event.w,dest:{x:0,y:0,z:0},moving:false,continue:false,
      target:0n,destPosOnAir:false,isPerfectCombo:false,...extra};
    const generation=s.generation=(s.generation||0)+1;
    emitting={s,name,id,generation};
    try{mod.send(...mods.packet.get_all(name),event);}finally{emitting=null;}
  };
  const run=s=>{
    if(!active(s))return reset();
    if(s.phase==='watch')return later(s,run,50);
    if(s.phase==='lethal-sent'||s.phase==='charging'||s.phase==='releasing')return later(s,run);
    const lethal=s.phase==='lethal',id=lethal?s.lethal:s.cyclone;
    if(cooling(id))return reset();
    if(!lethal&&s.phase==='cyclone'&&!readyInstant(s))return reset();
    const data=resolve(id,lethal?undefined:true);
    if(!allowed(id,data,lethal?undefined:true))return later(s,run);
    if(lethal){
      if(!data.chain||base(data.skillId)!==LETHAL)return reset();
      s.phase='lethal-sent';send(s,'C_START_SKILL',data.skillId);
    }else{
      s.phase='charging';send(s,'C_PRESS_SKILL',s.cyclone,{press:true});
    }
    if(pending===s)later(s,run);
  };
  const trigger=s=>{
    if(!active(s)||s.phase!=='watch'||!s.releaseConfirmed||s.stacks!==1||!s.resetSeen)return;
    if(!mods.action.inAction||mods.action.stage?.id!==s.localRelease)return reset();
    s.lethal=highest(LETHAL);
    mods.log.debug('CYCLONE-MACRO','reset confirmed; Lethal id:'+s.lethal+' cooling:'+(s.lethal?cooling(s.lethal):true));
    s.phase=s.lethal&&!cooling(s.lethal)?'lethal':'cyclone';
    s.deadline=Date.now()+Math.min(4000,Math.max(1500,4*(mods.ping.ping+mods.ping.jitter)+750));
    later(s,run,1);
  };
  mod.hook(...mods.packet.get_all('C_PRESS_SKILL'),{order:-20,filter:{fake:false}},event=>{
    cancelRaze();
    const id=event.skill.id;
    if(base(id)!==CYCLONE){reset();return;}
    if(!event.press){
      if(pending?.phase==='watch'){
        if(Number.isFinite(event.w))pending.aimW=event.w;
        return;
      }
      reset();return;
    }
    reset();
    if(!enabled()||id%100!==0||!mods.utils.isEnabled(id)||!Number.isFinite(event.w))return;
    pending={phase:'watch',cyclone:id,aimW:event.w,event:{...event,loc:clone(event.loc)},
      previousServer:mods.action.serverStage?.id,deadline:Date.now()+10000};
    later(pending,run,50);
  });
  mod.hook(...mods.packet.get_all('C_START_SKILL'),{order:-20,filter:{fake:false}},event=>{
    if(base(event.skill.id)===RAZE&&event.skill.id%100===0&&!event.continue&&enabled()){
      if(!raze)raze={event:{...event,loc:clone(event.loc)},deadline:Date.now()+1500};
    }else cancelRaze();
    if(pending?.phase==='watch'&&base(event.skill.id)===CYCLONE&&event.continue){
      if(Number.isFinite(event.w))pending.aimW=event.w;
      return;
    }
    reset();
  });
  for(const name of ['C_CANCEL_SKILL','C_START_TARGETED_SKILL','C_START_COMBO_INSTANT_SKILL',
    'C_START_INSTANCE_SKILL','C_START_INSTANCE_SKILL_EX','C_NOTIMELINE_SKILL'])
    mod.hook(...mods.packet.get_all(name),{order:-20,filter:{fake:false}},()=>{cancelRaze();reset();});
  for(const name of ['S_ABNORMALITY_BEGIN','S_ABNORMALITY_REFRESH'])
    mod.hook(...mods.packet.get_all(name),{order:-90,filter:{fake:false,silenced:null}},event=>{
      const s=pending;if(!s||!own(event)||event.id!==CHAIN||s.phase!=='watch')return;
      s.stacks=event.stacks;
      if(s.stacks!==1)return reset();
      trigger(s);
    });
  for(const name of ['S_START_COOLTIME_SKILL','S_DECREASE_COOLTIME_SKILL'])
    mod.hook(...mods.packet.get_all(name),{order:-90,filter:{fake:false,silenced:null}},event=>{
      if(mods.player.job===BERSERKER&&base(event.skill.id)===LETHAL&&Number.isFinite(event.cooldown)){lethalCooldown=Date.now()+Math.max(0,event.cooldown);return;}
      const s=pending;
      if(!s||s.phase!=='watch'||base(event.skill.id)!==CYCLONE||event.cooldown!==0||!s.releaseConfirmed)return;
      s.resetSeen=true;trigger(s);
    });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:110,filter:{fake:true,silenced:null}},event=>{
    if(raze&&own(event)&&event.stage===0&&base(event.skill.id)===RAZE){
      if(raze.localId===undefined)raze.localId=event.id;
      else if(raze.localId!==event.id)cancelRaze();
    }
    const s=pending;if(!s||!own(event))return;
    const b=base(event.skill.id);
    if(s.phase==='lethal-sent'&&event.id===s.localRelease)return;
    if(s.phase==='charging'&&s.chargeLocal===undefined&&event.id===(s.lethalLocal??s.localRelease))return;
    if(s.phase==='releasing'&&s.finalLocal===undefined&&event.id===s.chargeLocal)return;
    if(s.phase==='watch'&&b===CYCLONE){if(event.skill.id%100!==0)s.localRelease=event.id;return;}
    if(s.phase==='lethal-sent'&&b===LETHAL){s.lethalLocal=event.id;s.phase='after-lethal';later(s,run,1);return;}
    if(s.phase==='after-lethal'&&event.id===s.lethalLocal)return;
    if(s.phase==='charging'&&event.skill.id===s.cyclone){s.chargeLocal=event.id;return;}
    if(s.phase==='releasing'&&b===CYCLONE&&event.skill.id%100!==0){s.finalLocal=event.id;return;}
    if((s.phase==='lethal'||s.phase==='cyclone')&&event.id===s.localRelease)return;
    reset();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    if(raze&&own(event)&&event.stage===0&&base(event.skill.id)===RAZE&&
      raze.localId===mods.action.stage?.id){
      raze.serverConfirmed=true;
      raze.serverId=event.id;
      raze.serverTime=Date.now();
      raze.serverSpeed=event.speed;
      followRaze(raze);
    }
    const s=pending;if(!s||!own(event)||event.id===s.previousServer)return;
    const b=base(event.skill.id);
    if(s.phase==='watch'&&b===CYCLONE&&event.skill.id%100!==0&&event.stage===0){
      s.releaseConfirmed=true;s.releaseServer=event.id;trigger(s);
    }else if(s.phase==='after-lethal'&&b===LETHAL&&event.stage===0){s.lethalConfirmed=true;s.lethalServer=event.id;mods.log.debug('CYCLONE-MACRO','server confirmed Lethal');}
    else if(s.phase==='releasing'&&b===CYCLONE&&event.skill.id%100!==0&&event.stage===0&&event.id!==s.releaseServer)reset();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'),{order:110,filter:{fake:null,silenced:null}},(event,fake)=>{
    if(raze&&own(event)&&(fake&&event.id===raze.localId||!fake&&event.id===raze.serverId))cancelRaze();
    const s=pending;if(!s||!own(event))return;
    if(fake&&event.id===s.finalLocal)return reset();
    if(s.phase==='watch'&&event.id===(fake?s.localRelease:s.releaseServer))return reset();
    if(s.phase==='after-lethal'&&event.id===(fake?s.lethalLocal:s.lethalServer)&&event.type!==0)return reset();
  });
  mod.hook(...mods.packet.get_all('S_GRANT_SKILL'),{order:1000000,filter:{fake:null,silenced:null}},(event,fake)=>{
    const s=pending;if(!s||!['charging','releasing'].includes(s.phase)||base(event.skill.id)!==CYCLONE)return;
    if(s.phase==='charging'&&!fake){
      s.phase='releasing';
      const granted=event.skill.id;
      later(s,()=>{send(s,'C_START_SKILL',granted,{continue:true});if(pending===s)later(s,run);},1);
    }
    return false;
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    if(raze&&base(event.skill.id)===RAZE)cancelRaze();
    const s=pending;if(!s)return;
    if(base(event.skill.id)===LETHAL && ['lethal-sent','after-lethal','charging','releasing'].includes(s.phase)){
      mods.log.debug('CYCLONE-MACRO','server rejected Lethal; continuing to reset Cyclone');
      if(s.phase==='lethal-sent'){s.phase='after-lethal';later(s,run,1);}
      return;
    }
    if([CYCLONE,LETHAL].includes(base(event.skill.id)))reset();
  });
  mod.hook(...mods.packet.get_all('S_CREST_MESSAGE'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    if(event.type!==6||mods.player.job!==BERSERKER)return;
    const b=base(event.skill?.id??event.skill);
    if(b===LETHAL)lethalCooldown=0;
    if(b===CYCLONE&&pending?.phase==='watch'&&pending.releaseConfirmed){pending.resetSeen=true;trigger(pending);}
  });
  const sessionReset=()=>{cancelRaze();reset();lethalCooldown=null;};
  for(const name of ['S_LOGIN','S_LOAD_TOPO','S_RETURN_TO_LOBBY'])mod.hook(name,'raw',{filter:{fake:null}},sessionReset);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'),{filter:{fake:null}},event=>{if(own(event)&&!event.alive)sessionReset();});
  const onReaction=()=>{cancelRaze();reset();};
  mods.action.on('reaction',onReaction);
  const api={captureRequest(name,event,fake){
    if(!fake||!emitting||name!==emitting.name||event.skill.id!==emitting.id)return;
    const {s,generation,raze:razeFollowup}=emitting;
    return razeFollowup ? ()=>!destroyed&&mods.player.job===BERSERKER&&mods.player.alive!==false&&
      Date.now()-s.injectedAt<500&&[RAZE,FLATTEN].includes(base(mods.action.stage?.skill?.id)) :
      ()=>active(s)&&s.generation===generation;
  }};
  mods.cycloneResetMacro=api;
  this.destructor=()=>{destroyed=true;sessionReset();mods.action.off('reaction',onReaction);if(mods.cycloneResetMacro===api)delete mods.cycloneResetMacro;};
};

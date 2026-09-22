'use strict';



const PRIEST = 6, BLAST = 11, DIVINE_CHARGE = 28;
const REQUEST_VARIANTS = new Set([0,10,20]);
const canonical = id => id-id%100;
const PREDECESSORS = {16: new Set([11,27]), 27: new Set([11,40,16])};
const base = id => Math.floor((id || 0) / 10000);
const copy = value => value?.clone ? value.clone() : value && typeof value === 'object' ? {...value} : value;
const clone = event => ({...event,skill:copy(event.skill),loc:copy(event.loc),dest:copy(event.dest)});

module.exports = function PriestEntrySkill(mod, mods) {
  const settings = mods.settings.info;
  const entry = settings.priest_entry_precast ||= {enabled:true};
  if (entry.enabled === undefined) entry.enabled = true;
  if (settings.priest_divine_charge === undefined) settings.priest_divine_charge = true;
  if (settings.priest_sleep_emulation === undefined) settings.priest_sleep_emulation = true;
  let pending = null, timer = null, emitting = null, destroyed = false, finishDc = false;
  const enabled = id => !destroyed && entry.enabled !== false && mods.player.job === PRIEST &&
    mods.player.alive !== false && mods.utils.isEnabled(id) && mods.utils.canCastSkill() && !mods.action.inSpecialAction;
  const normalId = id => {
    const data=mods.skills._getInfo(canonical(id));
    const enhanced=data?.abnormalityRedirect?.find(x=>x.id===805800);
    return enhanced && mods.effects.getAbnormality(805800) ? enhanced.skill : data?.baseRedirect || id;
  };
  const resolve = id => mods.skills.getNewSkillData(normalId(id),{byGrant:false});
  const castable = (id,data=resolve(id)) => !data.failed && !mods.cooldown.isOnCooldownBase(base(id)) &&
    mods.skills.canCast(data,{byGrant:false,originalSkillId:id})>=-2;
  const budget = () => Math.min(3000,Math.max(1000,4*((mods.ping.ping||0)+(mods.ping.jitter||0))+500));
  const ownsEntry = cast => mods.action.inAction && mods.action.stage?.id===cast.localId && base(mods.action.stage?.skill?.id)===BLAST;
  const cancel = () => {
    const cast=pending;pending=null;mod.clearTimeout(timer);timer=null;

    if(cast && ownsEntry(cast))mods.skills.sendActionEnd(mods.action.stage.skill.id,6);
  };
  const later = (cast,fn,delay=10) => {
    mod.clearTimeout(timer);
    timer=mod.setTimeout(()=>{timer=null;if(pending===cast)fn(cast);},Math.max(1,delay));
  };
  const activeNativeChain = target => {
    const stage=mods.action.stage;
    if(!PREDECESSORS[base(target)]?.has(base(stage?.skill?.id)))return false;
    const length=mods.skills.getAnimationlengthForAllStages(stage.skill.id,mods.action.speed);
    const elapsed=Date.now()-stage._time;
    const data=mods.skills._getInfo(stage.skill.id);
    const end=data?.cancels?.pendingEndTime;
    const limit=end>=0 ? Math.min(length,end/mods.action.speed.real) : length;

    if(mods.action.inAction && Number.isFinite(limit) && limit>0 && elapsed>=0 && elapsed<limit)return true;
    const buff=base(target)===27 && mods.effects.getAbnormality(806104);
    if(!buff || !Number.isFinite(buff.duration) || buff.duration<=0 || buff.time<stage._time ||
      Date.now()<buff.time || Date.now()>=buff.time+buff.duration)return false;
    const result=resolve(target);
    return !result.failed && base(result.skillId)===27 && [11,21].includes(result.skillId%100);
  };
  const blastId = () => {
    const learned=mods.last.skillList?.skills;
    const ids=Object.keys(learned || mods.skills.info.skillData).map(Number);
    return ids.filter(id=>base(id)===BLAST && [0,1,2].includes(id%100) && mods.skills._getInfo(id))
      .map(canonical).filter(id=>mods.skills._getInfo(id))
      .reduce((best,id)=>Math.max(best,id),0);
  };
  const hasMana = (first,second) => {
    if(!Number.isFinite(mods.player.mp))return true;
    return mods.player.mp >= (mods.skills._getInfo(first)?.resourceUsage?.mp||0)+(mods.skills._getInfo(second)?.resourceUsage?.mp||0);
  };
  const send = (cast,id) => {
    const packet={...clone(cast.event),skill:{...cast.event.skill,id},loc:copy(mods.position.loc||cast.event.loc),continue:false};
    emitting={cast,id};
    try {mod.send(...mods.packet.get_all('C_START_SKILL'),packet);} finally {emitting=null;}
  };
  const transition = cast => {
    if(!enabled(cast.mainId) || Date.now()>cast.deadline || !ownsEntry(cast))return cancel();

    if(!cast.confirmed || !cast.cooldownConfirmed || Date.now()<cast.hitReadyAt)return later(cast,transition);
    const data=resolve(cast.mainId);
    if(base(data.skillId)!==base(cast.mainId) || !data.chain || !castable(cast.mainId,data))return later(cast,transition);
    cast.phase='main';cast.deadline=Date.now()+budget();
    later(cast,cancel,budget());
    send(cast,normalId(cast.mainId));
  };
  const startEntry = cast => {
    if(!enabled(cast.mainId) || Date.now()>cast.deadline)return cancel();
    if(!castable(cast.mainId,{skillId:cast.mainId,noAction:true}) || !hasMana(cast.entryId,cast.mainId))return cancel();
    if(mods.action.inAction && mods.action.stage?.id!==cast.sourceId)return cancel();
    if(!castable(cast.entryId))return later(cast,startEntry);
    cast.phase='entry';cast.previousServer=mods.action.serverStage?.id;
    later(cast,cancel,budget());
    send(cast,normalId(cast.entryId));
  };
  mod.hook(...mods.packet.get_all('C_START_SKILL'),{order:-15,filter:{fake:false}},event=>{
    const requested=event.skill.id,id=canonical(requested);
    if(!enabled(requested) || !PREDECESSORS[base(requested)] || !REQUEST_VARIANTS.has(requested%100) ||
      event.continue || !Number.isFinite(event.w)){cancel();return;}
    if(pending?.mainId===id){pending.event=clone(event);return false;}
    cancel();
    if(activeNativeChain(id) || mods.action.inAction && base(mods.action.stage?.skill?.id)===base(id))return;
    const first=blastId();
    if(!first || !enabled(first) || !castable(id,{skillId:id,noAction:true}) ||
      !castable(first,{skillId:first,noAction:true}) || !hasMana(first,id))return;

    const stage=mods.action.stage;
    const duration=mods.action.inAction && PREDECESSORS[base(id)].has(base(stage?.skill?.id)) &&
      mods.skills.getAnimationlengthForAllStages(stage.skill.id,mods.action.speed);
    if(duration>0 && Number.isFinite(duration) && Date.now()-stage._time>=duration)
      mods.skills.sendActionEnd(stage.skill.id,0);
    const cast={mainId:id,entryId:first,event:clone(event),phase:'waiting',
      sourceId:mods.action.inAction?mods.action.stage.id:undefined,deadline:Date.now()+budget()};
    pending=cast;startEntry(cast);return false;
  });
  for(const name of ['C_PRESS_SKILL','C_CANCEL_SKILL','C_START_TARGETED_SKILL',
    'C_START_COMBO_INSTANT_SKILL','C_START_INSTANCE_SKILL','C_START_INSTANCE_SKILL_EX'])
    mod.hook(...mods.packet.get_all(name),{order:-15,filter:{fake:false}},cancel);
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:110,filter:{fake:true}},event=>{
    if(!mods.player.isMe(event.gameId))return;
    const cast=pending;if(!cast)return;
    if(cast.phase==='waiting'){if(event.id!==cast.sourceId)cancel();return;}
    if(cast.phase==='entry') {
      if(base(event.skill.id)!==BLAST || cast.localId!==undefined && cast.localId!==event.id)return cancel();
      cast.localId=event.id;
      if(event.stage===0)later(cast,transition,1);
    } else if(base(event.skill.id)===base(cast.mainId)){cast.mainAction=event.id;}
    else cancel();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    const cast=pending;
    if(!cast || !mods.player.isMe(event.gameId) || event.id===cast.previousServer)return;
    if(base(event.skill.id)===BLAST && cast.phase==='entry'){
      if(!cast.confirmed){
        const data=mods.skills._getInfo(event.skill.id);
        const speed=mods.action.speed?.real;
        const hit=Math.max(data?.lastHit||0,data?.cooldown?.delay||0,...(data?.targeting||[]));
        if(!(speed>0) || !Number.isFinite(hit))return cancel();
        cast.hitReadyAt=Date.now()+hit/speed;
      }
      cast.confirmed=true;cast.serverId=event.id;
    }
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'),{order:110,filter:{fake:null,silenced:null}},(event,fake)=>{
    const cast=pending;if(!cast || !mods.player.isMe(event.gameId))return;
    if(fake && event.id===cast.localId && cast.phase==='entry' ||
      !fake && event.id===cast.serverId && cast.phase==='entry' || fake && event.id===cast.mainAction)cancel();
  });

  mod.hook(...mods.packet.get_all('S_START_COOLTIME_SKILL'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    if(pending?.phase==='entry' && pending.confirmed && base(event.skill.id)===BLAST && event.cooldown>0)
      pending.cooldownConfirmed=true;
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'),{order:-90,filter:{fake:null,silenced:null}},event=>{
    if(pending && [BLAST,base(pending.mainId)].includes(base(event.skill.id)))cancel();
  });
  const reset=()=>{cancel();finishDc=false;};
  for(const name of ['S_LOGIN','S_LOAD_TOPO','S_RETURN_TO_LOBBY'])mod.hook(name,'raw',{filter:{fake:null}},reset);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'),{filter:{fake:null}},event=>{if(mods.player.isMe(event.gameId)&&!event.alive)reset();});
  mods.action.on('reaction',cancel);
  const api={
    captureRequest(name,event,fake){
      if(!fake || name!=='C_START_SKILL' || !emitting || event.skill.id!==emitting.id)return;
      const {cast}=emitting;
      return ()=>pending===cast && enabled(cast.mainId);
    },
    divineChargeEnabled(){
      if(finishDc && (!mods.action.inAction || base(mods.action.stage?.skill?.id)!==DIVINE_CHARGE))finishDc=false;
      return settings.priest_divine_charge!==false || finishDc;
    }
  };
  mods.priestEntrySkill=api;
  mod.hook(...mods.packet.get_all('S_ACTION_END'),{order:120,filter:{fake:true}},event=>{
    if(mods.player.isMe(event.gameId) && base(event.skill.id)===DIVINE_CHARGE && event.type===0)finishDc=false;
  });
  mods.command.add('dc',()=>{
    const wasEnabled=api.divineChargeEnabled();
    settings.priest_divine_charge=!settings.priest_divine_charge;
    finishDc=!settings.priest_divine_charge && wasEnabled && mods.player.job===PRIEST &&
      mods.action.inAction && base(mods.action.stage?.skill?.id)===DIVINE_CHARGE;
    mods.command.message('Priest Divine Charge emulation: '+(settings.priest_divine_charge?'ON':'OFF')+(finishDc?' (after the current cast)':''));
  });
  mods.command.add('priest s',()=>{
    settings.priest_sleep_emulation=!settings.priest_sleep_emulation;
    mods.command.message("Priest Ishara's Lullaby emulation: "+(settings.priest_sleep_emulation?'ON':'OFF'));
  });
  const toggleEntry=()=>{entry.enabled=!entry.enabled;if(!entry.enabled)cancel();mods.command.message('Priest re-entry: '+(entry.enabled?'ON':'OFF'));};
  mods.command.add('priest entry',toggleEntry);
  mods.command.add('priestentry',toggleEntry);
  this.destructor=()=>{destroyed=true;cancel();mods.action.off('reaction',cancel);mods.command.remove('dc');mods.command.remove('priest s');mods.command.remove('priestentry');mods.command.remove('priest entry');if(mods.priestEntrySkill===api)delete mods.priestEntrySkill;};
};

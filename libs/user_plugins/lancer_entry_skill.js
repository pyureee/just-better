'use strict';




const PRIORITIES = {
  13: [181101, 181100, 210402, 210401, 100300],
  3: [50101, 50102, 181101, 181100, 11200]
};
const REAR_CANCEL = {181101: 200, 181100: 190, 210402: 400, 210401: 400,
  100300: 500, 50101: 454, 50102: 454, 11200: 0};
const MAIN = {13: 131100, 3: 30200};
const HOTKEY_SKILLS = {spring: 131100, onslaught: 30200};
const CANCEL_LOCK_MS = {13: 900, 3: 2545};
const base = id => Math.floor(id / 10000);

module.exports = function LancerEntryPrecaster(mod, mods) {
  const settings = mods.settings.info.lancer_entry_precast ||= {};
  if (settings.enabled === undefined) settings.enabled = true;
  const copy = value => value?.clone ? value.clone() : value && typeof value === 'object' ? {...value} : value;
  const cloneEvent = e => ({...e, skill: copy(e.skill), loc: copy(e.loc), dest: copy(e.dest)});
  let pending = null, timer = null, destroyed = false;
  let monitor = null;

  let clientHeading = null, skillHeading = null;
  const rememberHeading = event => {
    if (Number.isFinite(event.w)) clientHeading = event.w;
  };
  const enabled = id => !destroyed && settings.enabled !== false && mods.player.job === 1 &&
    mods.player.alive !== false && mods.utils.isEnabled(id) && mods.utils.canCastSkill() && !mods.action.inSpecialAction;
  const blockRequests = new WeakMap();
  let issuingBlock = null;
  const releaseBlock = cast => {
    if (!cast.blockStarted || cast.blockReleased) return;
    cast.blockReleased = true;
    mod.send(...mods.packet.get_all('C_PRESS_SKILL'), {...cast.blockPacket, press:false});
  };
  const cancel = () => {
    const cast=pending;
    mod.clearTimeout(timer); timer=null; pending=null;
    if (cast) releaseBlock(cast);
  };
  const later = (fn, ms) => {
    mod.clearTimeout(timer);
    timer = mod.setTimeout(() => {timer = null; fn();}, Math.max(1, Math.ceil(ms)));
  };
  const remaining = id => {
    const now = Date.now();
    const skillCooldown = mods.cooldown.getData(id);
    const baseCooldown = mods.cooldown.getData(base(id));

    const data = !skillCooldown ? baseCooldown : !baseCooldown ? skillCooldown :
      baseCooldown.time - skillCooldown.time > 0 ? baseCooldown : skillCooldown;
    if (!data) return mods.cooldown.isOnCooldown(id,id) || mods.cooldown.isOnCooldownBase(base(id)) ? Infinity : 0;
    if (data.usedStacks) {
      const max = mods.skills.getCooldownData(id)?.maxStack;
      if (!max) return Infinity;
      const used = data.usedStacks - (data.time + data.nextStackCooldown > now ? 0 : 1);
      return used >= max ? Math.max(0,data.time+data.nextStackCooldown-now) : 0;
    }
    return Math.max(0, data.time + data.cooldown - now);
  };
  const resolve = id => mods.skills.getNewSkillData(id,{byGrant:false,press:undefined});
  const allowed = (id, ignoreMainCooldown = false) => {
    if (!mods.skills._getInfo(id) || !enabled(id)) return false;
    const result = mods.skills.canCast({skillId:id,noAction:true},{byGrant:false,originalSkillId:id});
    return result >= -2 || ignoreMainCooldown && result === -12;
  };
  const choose = mainBase => {
    for (const candidate of PRIORITIES[mainBase]) {
      const cooldownId = base(candidate) === 18 ? 181100 : candidate;
      if (remaining(cooldownId) > 0 || !mods.skills._getInfo(candidate)) continue;

      let requestId = candidate === 181101 ? 181100 : candidate;
      const resolved = resolve(candidate);
      if (resolved.skillId === 50130) requestId = 50102;
      if (!allowed(requestId)) continue;
      const speed = mods.skills.getSpeed(requestId)?.real;
      if (!(speed > 0) || !Number.isFinite(speed)) continue;
      return {candidate,requestId,speed,rear:REAR_CANCEL[candidate]};
    }
    return null;
  };
  const packet = (cast,id) => ({...cloneEvent(cast.event),skill:{...cast.event.skill,id},
    loc:copy(mods.position.loc || cast.event.loc),
    w:cast.fromHotkey && Number.isFinite(cast.mainBase === 13 ? skillHeading : clientHeading) ?
      (cast.mainBase === 13 ? skillHeading : clientHeading) : cast.event.w,
    continue:false});
  const send = (cast,id) => mod.send(...mods.packet.get_all('C_START_SKILL'),packet(cast,id));
  const localId = () => mods.action.stage?.id;
  const currentBase = () => base(mods.action.stage?.skill?.id || 0);
  const ackWindow = () => Math.min(3000,Math.max(1000,4*((mods.ping.ping||0)+(mods.ping.jitter||0))+500));
  const lockRemaining = () => {
    if (!mods.action.inAction) return 0;
    const lock = CANCEL_LOCK_MS[currentBase()];
    const speed = mods.action.speed?.real;
    return lock && speed > 0 ? Math.max(0,mods.action.stage._time+lock/speed-Date.now()) : 0;
  };
  const finishEntry = cast => {
    if (pending !== cast) return;
    if (cast.phase !== 'entry' || !enabled(cast.mainId)) return cancel();
    if (!mods.action.inAction || localId() !== cast.entryAction) return cancel();
    if (Date.now() > cast.deadline) return cancel();


    const wait = Math.max(cast.readyAt-Date.now(),remaining(cast.mainId));
    if (!Number.isFinite(wait)) return cancel();
    if (wait > 0) return later(()=>finishEntry(cast),Math.min(wait,10));
    if (!allowed(cast.mainId)) return cancel();
    const resolved = resolve(cast.mainId);


    if (resolved.failed || resolved.skillId !== cast.mainId+30)
      return later(()=>finishEntry(cast),10);
    cast.phase = 'main';
    cast.deadline = Date.now()+ackWindow();
    send(cast,cast.mainId);
    if (pending === cast) later(cancel,ackWindow());
  };
  const startEntry = cast => {
    if (pending !== cast) return;
    if (!enabled(cast.mainId) || !allowed(cast.mainId,true)) return cancel();
    const entry = choose(cast.mainBase);
    if (!entry) return cancel();
    cast.entry = entry;
    cast.entryBase = base(entry.requestId);
    cast.phase = 'entry';
    cast.entryAction = undefined;
    cast.previousServer = mods.action.serverStage?.id;
    cast.deadline = Date.now()+ackWindow();

    later(cancel,ackWindow());
    send(cast,entry.requestId);
  };
  const run = cast => {
    if (!cast || pending !== cast) return;
    if (!enabled(cast.mainId) || !allowed(cast.mainId,true)) return cancel();
    if (Date.now() > cast.expires) return cancel();
    if (cast.phase === 'block') {


      if (cast.blockEnded) return startEntry(cast);
      return later(()=>run(cast),10);
    }
    const entry = choose(cast.mainBase);
    if (!entry) return cancel();
    const wait = Math.max(0,remaining(cast.mainId)-entry.rear/entry.speed-100);
    if (!Number.isFinite(wait) || wait > 1500) return cancel();
    if (wait > 0) return later(()=>run(cast),Math.min(wait,25));
    const lock = lockRemaining();
    if (lock > 0) return later(()=>run(cast),Math.min(lock,25));
    if (mods.action.inAction && currentBase() === cast.mainBase) return cancel();
    if (mods.action.inAction && currentBase() !== 2) {
      if (!allowed(20200)) return cancel();
      cast.phase = 'block';

      const block={skill:{id:20200,type:1},press:true,loc:copy(mods.position.loc),w:packet(cast,cast.mainId).w};
      cast.blockPacket=block;
      blockRequests.set(block,cast);
      issuingBlock=cast;
      try {mod.send(...mods.packet.get_all('C_PRESS_SKILL'),block);}
      finally {issuingBlock=null;}
      if (pending === cast && !cast.blockStarted) later(()=>run(cast),1);
      return;
    }
    startEntry(cast);
  };
  const input = (event, fromHotkey = false) => {
    if (!fromHotkey) {rememberHeading(event);if (Number.isFinite(event.w)) skillHeading=event.w;}
    const id = event.skill.id, mainBase = base(id);
    if (!MAIN[mainBase] || id !== MAIN[mainBase] || event.continue || !enabled(id) || !Number.isFinite(event.w)) {
      cancel(); return;
    }
    if (pending?.mainId === id) {
      if (!fromHotkey) {pending.event=cloneEvent(event);pending.fromHotkey=false;}
      return false;
    }
    cancel();
    if (mods.action.inAction && currentBase() === mainBase) return;
    const resolved=resolve(id);
    if (resolved.skillId === id+30 && remaining(id) === 0) return;
    if (!allowed(id,true)) return;
    const entry=choose(mainBase);
    if (!entry) return;
    const wait=Math.max(0,remaining(id)-entry.rear/entry.speed-100);
    if (!Number.isFinite(wait) || wait>1500) return;
    const cast={mainId:id,mainBase,event:cloneEvent(event),fromHotkey,phase:'waiting',
      sourceAction:mods.action.inAction ? localId() : undefined,
      expires:Date.now()+wait+ackWindow()};
    pending=cast;
    run(cast);
    return false;
  };
  const realInput={order:-15,filter:{fake:false,silenced:false}};
  mod.hook(...mods.packet.get_all('C_START_SKILL'),realInput,event=>input(event));
  mod.hook(...mods.packet.get_all('C_PRESS_SKILL'),realInput,event=>{
    if(Number.isFinite(event.w))skillHeading=event.w;
  });
  mod.hook(...mods.packet.get_all('C_PLAYER_LOCATION'),
    {order:-100,filter:{fake:false,silenced:null}},rememberHeading);
  for(const name of ['C_PRESS_SKILL','C_CANCEL_SKILL','C_START_TARGETED_SKILL',
    'C_START_COMBO_INSTANT_SKILL','C_START_INSTANCE_SKILL','C_START_INSTANCE_SKILL_EX'])
    mod.hook(...mods.packet.get_all(name),realInput,cancel);
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:110,filter:{fake:true}},event=>{
    const cast=pending;
    if (!cast || !mods.player.isMe(event.gameId)) return;
    const skillBase=base(event.skill.id);
    if (cast.phase==='waiting') {
      if (event.id!==cast.sourceAction && skillBase!==2) cancel();
      return;
    }
    if (cast.phase==='block') {
      if (skillBase!==2 && event.id!==cast.sourceAction) cancel();
      if (skillBase===2 && event.stage===0) {
        cast.blockStarted=true;
        cast.blockAction=event.id;

        later(()=>{if(pending===cast){releaseBlock(cast);if(pending===cast)later(()=>run(cast),1);}},1);
      }
      return;
    }
    if (cast.phase==='main') {
      if (skillBase!==cast.mainBase) cancel();
      return;
    }
    if (skillBase!==cast.entryBase) return cancel();
    if (cast.entryAction!==undefined) {if(event.id!==cast.entryAction)cancel();return;}
    if (event.stage!==0) return;
    const speed=mods.action.speed?.real;
    if (!(speed>0)) return cancel();
    cast.entryAction=event.id;
    cast.readyAt=Date.now()+Math.max(1,cast.entry.rear/speed-20);
    later(()=>finishEntry(cast),Math.max(1,cast.readyAt-Date.now()));
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    const cast=pending;
    if (cast?.phase==='main' && mods.player.isMe(event.gameId) && event.stage===0 &&
      event.id!==cast.previousServer && base(event.skill.id)===cast.mainBase) cancel();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'),{order:110,filter:{fake:true}},event=>{
    if (!mods.player.isMe(event.gameId)) return;
    if (pending?.phase==='block' && event.id===pending.blockAction) {
      pending.blockEnded=true;
      const cast=pending;
      later(()=>run(cast),1);
    }
    if (pending?.phase==='entry' && event.id===pending.entryAction) cancel();
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'),{order:-90,filter:{fake:null,silenced:null}},event=>{
    if (!pending || pending.phase==='waiting') return;
    const expected=pending.phase==='block'?2:pending.phase==='entry'?pending.entryBase:pending.mainBase;
    if (base(event.skill.id)===expected) cancel();
  });
  for(const name of ['S_LOGIN','S_LOAD_TOPO','S_RETURN_TO_LOBBY'])
    mod.hook(name,'raw',{filter:{fake:null}},()=>{clientHeading=null;skillHeading=null;cancel();});
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'),{filter:{fake:null}},event=>{
    if (mods.player.isMe(event.gameId) && !event.alive) cancel();
  });
  mods.action.on('reaction',cancel);

  const coordination={
    captureBlockRequest(event) {
      if (issuingBlock && event.press === true && base(event.skill.id) === 2) blockRequests.set(event,issuingBlock);
    },
    isStaleBlockRequest(event) {
      const cast=blockRequests.get(event);
      return !!cast && (pending!==cast || cast.phase!=='block');
    },
    shouldSuppressAutoBlock(event) {
      return !!pending && (pending.phase==='block' || pending.phase==='entry' && base(event.skill.id)===pending.entryBase);
    },
    onAutoBlock() {const cast=pending;if(cast?.phase==='waiting')later(()=>run(cast),1);},
    onHotkey(key) {
      if (key==='cancel') {cancel();return;}
      const id=HOTKEY_SKILLS[key];
      if (!id || !enabled(id) || !mods.position.loc || !Number.isFinite(mods.position.w)) return;


      if (!pending && remaining(id)===0 && !mods.action.inAction) return;

      if (pending?.mainId===id) return;
      const loc=copy(mods.position.loc);
      // Movement heading can point backward while the real skill request faces forward.
      if (id===MAIN[13] && !Number.isFinite(skillHeading)) return;
      const heading=id===MAIN[13] ? skillHeading : clientHeading;
      const w=Number.isFinite(heading) ? heading : mods.position.w;

      input({skill:{id,type:1},loc,dest:{x:0,y:0,z:0},w,continue:false,
        moving:false,target:0n,unk:true,unk2:false,
        destPosOnAir:true,isPerfectCombo:false},true);
    }
  };
  mods.lancerEntrySkill=coordination;
  const startMonitor = () => {
    if (destroyed || monitor || settings.enabled===false || !settings.keyboard?.enabled || mods.player.job!==1) return;
    const fs=require('fs'),path=require('path');
    const executable=settings.keyboard.ahkPath;
    if (!executable || !fs.existsSync(executable)) {
      mods.log.error('LANCER-PRECAST','AutoHotkey path is missing; cooldown-key precasting cannot start.');return;
    }
    const keys=[settings.keyboard.spring,settings.keyboard.onslaught,settings.keyboard.backstep,settings.keyboard.block];
    if (keys.some(key=>typeof key!=='string' || !key.trim() || /[\r\n]/.test(key))) {
      mods.log.error('LANCER-PRECAST','Spring, Onslaught, Backstep and Block keys must be configured.');return;
    }
    const child=require('child_process').spawn(executable,['/ErrorStdOut',path.join(__dirname,'lancer_precast_keys.ahk'),...keys,String(process.pid)],
      {windowsHide:true,stdio:['ignore','pipe','pipe']});
    monitor=child;
    let buffered='';
    child.stdout.on('data',chunk=>{
      buffered+=chunk.toString();
      const lines=buffered.split(/\r?\n/);buffered=lines.pop();
      for(const line of lines)if(monitor===child)coordination.onHotkey(line.trim());
      if(buffered.length>1024)buffered='';
    });
    child.stderr.on('data',chunk=>mods.log.error('LANCER-PRECAST',chunk.toString().trim()));
    child.on('error',error=>{if(monitor===child)monitor=null;cancel();mods.log.error('LANCER-PRECAST',error.message);});
    child.on('exit',()=>{if(monitor===child){monitor=null;cancel();}});
  };
  const stopMonitor = () => {const child=monitor;monitor=null;if(child)child.kill();};
  mods.command.add("lancer entry",()=>{
    settings.enabled=!settings.enabled;
    if(settings.enabled)startMonitor();else {cancel();stopMonitor();}
    mods.command.message("Lancer Entry: "+(settings.enabled?"ON":"OFF"));
  });
  this.loaded=()=>{if(mods.player.job!==1)stopMonitor();else startMonitor();};
  mod.hook('S_LOGIN','event',{order:110},this.loaded);
  startMonitor();
  this.destructor=()=>{
    destroyed=true;cancel();stopMonitor();mods.command.remove("lancer entry");mods.action.off('reaction',cancel);
    if(mods.lancerEntrySkill===coordination)delete mods.lancerEntrySkill;
  };
};

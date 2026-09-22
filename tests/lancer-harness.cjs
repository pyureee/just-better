'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const EventEmitter = require('events');
const {createRequire} = require('module');
const root = path.resolve(__dirname, '..');
const Skills = require(root + '/libs/classes/skills');
const Hardcoded = require(root + '/libs/classes/hardcoded');
const Utils = require(root + '/libs/classes/utils');
const Cooldown = require(root + '/libs/classes/cooldown');
const data = JSON.parse(fs.readFileSync(root + '/skills/female/elin/Lancer.json'));
let now = 10000;
const realNow = Date.now;
Date.now = () => now;
class Vec {
  constructor(x = 1, y = 2, z = 3) { Object.assign(this, {x, y, z}); }
  clone() { return new Vec(this.x, this.y, this.z); }
  dist2D(other) { return Math.hypot(this.x - other.x, this.y - other.y); }
}
function harness(speed=2,autoBlock=false) {
  now = 10000;
  let nextTimer = 0;
  const timers = new Map(), hooks = [], sent = [], commands = {}, errors = [];
  const mod = {
    unhook(h) {const i=hooks.indexOf(h);if(i>=0)hooks.splice(i,1);},
    hook(name, version, options, fn) {
      if (typeof options === 'function') { fn = options; options = {}; }
      const hook = {name, options: options || {}, fn}; hooks.push(hook); return hook;
    },
    setTimeout(fn, delay, ...args) { const id = ++nextTimer; timers.set(id, {at: now + Math.max(1, delay), fn, args}); return id; },
    clearTimeout(id) { timers.delete(id); },
    send(name, version, event) { if(name === "C_START_SKILL") {event={...event};delete event.press;} if (typeof event.skill === "number") event = {...event, skill: {id:event.skill,type:1}}; return dispatch(name, event, true); }
  };
  const action = new EventEmitter();
  Object.assign(action, {inAction: false, inSpecialAction: false, serverInAction: false,
    stage: {id: 0, skill: {id: 0}, stage: 0, _time: now, loc: new Vec()},
    serverStage: {id: 9, skill: {id: 11200}, stage: 0, _time: now - 500},
    end: {_time: now - 500, type: 0}, speed: {real: speed},
  });
  let harmony = false, cooling = false, disabled = false, weapon = true, serverCd = null, recovery = false;
  const mods = {
    settings: {info: {ninja_shima: true, delay: 0}}, action, position: {loc: new Vec(10,20,30), w: 0},
    player: {job: 1, inCombat: true, alive: true, gameId: 1n, stamina: 10000, inven: {weapon}, isMe: id => id === 1n},
    ping: {ping: 157, jitter: 10}, packet: {get_all: name => [name, 1]},
    effects: {
      getAbnormality: id => harmony && id === 10154482 ? {time: now - 1000} : null,
      getServerAbnormality: () => null, getPassivity: () => false,
      getAppliedEffects: () => ({stamina: 0}), hasAbnormalityWithTypeValue: () => false,
      hasAbnormalityWithCategoryTypeValue: () => false, isCategoryEnabled: () => true
    },
    cooldown: {isOnCooldown: () => cooling, getData: (id, server) => server ? serverCd : null},
    crowd_control: {canCastSkill: () => 0},
    last: {block: {_time: 0}, packet: () => null, instantMove: {}, startSkill: {}},
    log: {debug: () => {}, error: (...args) => errors.push(args)},
    command: {add: (name, fn) => commands[name] = fn, remove: name => delete commands[name], message: () => {}},
    library: {jsonStringify: obj => JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value)},
    utils: {
      isEnabled: () => !disabled, canCastSkill: () => true, getPacketBuffer: () => 350,
      round: value => Math.round(value), sleep: delay => new Promise(resolve => mod.setTimeout(resolve, delay)),
      getSkillInfo: id => ({id, skill: Math.floor(id / 10000), sub: id % 100}),
    }
  };
  mods.cooldown = new Cooldown(mod,mods);
  mods.last.cachePacket = name => event => { mods.last.startSkill = {...event, _name: name}; };
  mods.skills = new Skills(mod, mods);
  mods.utils.getSkillInfo = new Utils(mod, mods).getSkillInfo;
  mods.skills.info.skillData = data;
  mods.hardcoded = new Hardcoded(mod, mods);
  // Use real Skills resolver and canCast. Stub only packet construction and
  // speed services; emulate the same action-state hooks as PR's Action class.
  mods.skills.getSpeed = () => ({real: speed});
  mods.skills.sendActionStage = ({skillId, continuation, stage}) => mod.send('S_ACTION_STAGE', 1, {
    gameId: 1n, skill: {id: skillId}, stage: stage ?? (continuation ? action.stage.stage + 1 : 0),
    id: continuation ? action.stage.id : ++mods.skills.info.skillIdCounter,
    loc: new Vec(10, 20, 30), w: 0, speed, animSeq: []
  });
  mods.skills.sendActionEnd = (id, type) => mod.send('S_ACTION_END', 1, {
    gameId: 1n, skill: {id}, id: action.stage.id, type, loc: action.stage.loc, w: 0
  });
  const originalArrow = mods.skills.sendConnectSkillArrow;
  let arrows = 0;
  mods.skills.sendConnectSkillArrow = (id, byGrant) => { arrows++; return originalArrow(id, byGrant); };
  function dispatch(name, event, fake = false) {
    let blocked = false;
    for (const hook of hooks.filter(h => h.name === name).sort((a, b) => (a.options.order || 0) - (b.options.order || 0))) {
      const filter = hook.options.filter || {};
      if (filter.fake !== null && fake !== (filter.fake === true)) continue;
      if (blocked && filter.silenced !== null && filter.silenced !== true) continue;
      if (hook.fn(event, fake) === false) blocked = true;
    }
    if (!blocked) sent.push({name, event: {...event, skill: event.skill && {...event.skill}}, fake, at: now});
    return !blocked;
  }
  mod.hook('S_ACTION_STAGE', 1, {order: 95, filter: {fake: true}}, event => {
    if (event.gameId !== 1n) return;
    action.inAction = true;
    event._time = event.stage === 0 ? now : action.stage._time;
    action.stage = event; action.speed={real:event.speed};
  });
  mod.hook('S_ACTION_END', 1, {order: 95, filter: {fake: true}}, event => {
    action.inAction = false; action.end = {...event, _time: now};
  });
  mod.hook('S_ACTION_STAGE', 1, {order: -100}, event => {
    if (event.gameId !== 1n) return;
    action.serverStage = {...event, _time: now}; action.serverInAction = true;
  });

  const Precast = require(process.env.TEST_INSTALLED ? root+'/libs/user_plugins/lancer_entry_skill' : root+'/libs/user_plugins/lancer_entry_skill');
  const plugin = new Precast(mod,mods);
  const Emulation = require(root+'/libs/plugins/emulation');
  const emulation = new Emulation(mod,mods);
  let blockPlugin;
  if(autoBlock)blockPlugin=new (require(root+'/libs/user_plugins/lancer_auto_block'))(mod,mods);
  const input=id=>({skill:{id,type:1},continue:false,loc:new Vec(10,20,30),dest:new Vec(50,60,30),w:1.5,moving:true});
  const press=(id,heading=1.5)=>{const e={...input(id),w:heading};mods.last.startSkill={...e,_time:now};dispatch('C_START_SKILL',e);};
  const cd=(id,remaining)=>mods.cooldown.cooltimeSkill({skill:{id},cooldown:remaining},true);
  const advance=async ms=>{const end=now+ms;for(let steps=0;steps<10000;steps++){
    const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn(...next[1].args);await Promise.resolve();await Promise.resolve();
  }now=end;await Promise.resolve();await Promise.resolve();};
  return {mod,mods,plugin,emulation,blockPlugin,input,press,cd,advance,dispatch,sent,timers,errors,commands,
    clock:()=>now, stages:()=>sent.filter(x=>x.name==='S_ACTION_STAGE'&&x.fake),
    previous:(id,age=0)=>{mods.skills.sendActionStage({skillId:id});action.stage._time=now-age;},
    dispose:()=>{plugin.destructor();emulation.destructor();blockPlugin?.destructor();}};
}
module.exports={harness,Vec};

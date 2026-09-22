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
const factorySandbox={module:{exports:{}},require:createRequire(root+'/libs/plugins/emulation.js'),Date};
vm.runInNewContext(fs.readFileSync(root+'/libs/plugins/emulation.js','utf8')+'\nmodule.exports.factory=createNinjaShima;',factorySandbox);
const createHelper=factorySandbox.module.exports.factory;
const data = JSON.parse(fs.readFileSync(root + '/skills/female/elin/Ninja.json'));
let now = 10000;
const realNow = Date.now;
Date.now = () => now;
class Vec {
  constructor(x = 1, y = 2, z = 3) { Object.assign(this, {x, y, z}); }
  clone() { return new Vec(this.x, this.y, this.z); }
  dist2D(other) { return Math.hypot(this.x - other.x, this.y - other.y); }
}
function harness(integrated = false, baseline = false) {
  now = 10000;
  let nextTimer = 0;
  const timers = new Map(), hooks = [], sent = [], commands = {}, errors = [];
  const mod = {
    hook(name, version, options, fn) {
      if (typeof options === 'function') { fn = options; options = {}; }
      const hook = {name, options: options || {}, fn}; hooks.push(hook); return hook;
    },
    setTimeout(fn, delay, ...args) { const id = ++nextTimer; timers.set(id, {at: now + Math.max(1, delay), fn, args}); return id; },
    clearTimeout(id) { timers.delete(id); },
    send(name, version, event) { return dispatch(name, event, true); }
  };
  const action = new EventEmitter();
  Object.assign(action, {inAction: false, inSpecialAction: false, serverInAction: false,
    stage: {id: 0, skill: {id: 0}, stage: 0, _time: now, loc: new Vec()},
    serverStage: {id: 9, skill: {id: 11200}, stage: 0, _time: now - 500},
    end: {_time: now - 500, type: 0}, speed: {real: 2.25},
  });
  let harmony = false, cooling = false, disabled = false, weapon = true, serverCd = null;
  const mods = {
    settings: {info: {ninja_shima: true, delay: 0}}, action, position:{loc:new Vec(10,20,30),w:1.5},
    player: {job: 11, alive: true, gameId: 1n, stamina: 10000, inven: {weapon}, isMe: id => id === 1n},
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
  mods.skills = new Skills(mod, mods);
  mods.utils.getSkillInfo = new Utils(mod, mods).getSkillInfo;
  mods.skills.info.skillData = data;
  mods.hardcoded = new Hardcoded(mod, mods);
  // Use real Skills resolver and canCast. Stub only packet construction and
  // speed services; emulate the same action-state hooks as PR's Action class.
  mods.skills.getSpeed = () => ({real: 2.25});
  mods.skills.sendActionStage = ({skillId, continuation, stage}) => mod.send('S_ACTION_STAGE', 1, {
    gameId: 1n, skill: {id: skillId}, stage: stage ?? (continuation ? action.stage.stage + 1 : 0),
    id: continuation ? action.stage.id : ++mods.skills.info.skillIdCounter,
    loc: new Vec(10, 20, 30), w: 0, speed: 2.25, animSeq: []
  });
  mods.skills.sendActionEnd = (id, type) => mod.send('S_ACTION_END', 1, {
    gameId: 1n, skill: {id}, id: action.stage.id, type, loc: action.stage.loc
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
    action.stage = event;
  });
  mod.hook('S_ACTION_END', 1, {order: 95, filter: {fake: true}}, event => {
    action.inAction = false; action.end = {...event, _time: now};
  });
  mod.hook('S_ACTION_STAGE', 1, {order: -100}, event => {
    if (event.gameId !== 1n) return;
    action.serverStage = {...event, _time: now}; action.serverInAction = true;
  });
  const callbacks = {
    send: (name, event) => mod.send(name, 1, event),
    stop: cast => { callbacks.stopped = cast; },
    reconcile: (cast, event) => { callbacks.reconciled = event; }
  };
  let helper, plugin;
  if(integrated)plugin=new(require(root+'/libs/plugins/emulation'))(mod,mods);else helper=createHelper(mod,mods,callbacks);
  const input = id => ({skill: {id, type: 1}, continue: false, loc: new Vec(10, 20, 30),
    dest: new Vec(50, 60, 30), w: 1.5, moving: true});
  const previous = id => { action.inAction = true; action.stage = {id: 50, skill: {id}, stage: 0, _time: now, loc: new Vec()}; };
  const advance = async ms => {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn(...next[1].args);
      await Promise.resolve(); await Promise.resolve();
    }
    now = end; await Promise.resolve(); await Promise.resolve();
  };
  const begin = (id, requested = id) => {
    const event = input(requested);
    const cast = helper.prepare('C_START_SKILL', event, {skillId: id, chain: true}, 4);
    helper.direct(cast);
    mods.skills.sendActionStage({skillId: id});
    helper.start(cast);
    return cast;
  };
  return {mod, mods, helper, plugin, callbacks, dispatch, sent, timers, input, previous, advance, begin, errors, commands,
    harmony: value => harmony = value, cooling: value => cooling = value,
    disable: value => disabled = value, serverCooldown: value => serverCd = value, arrowCount: () => arrows};
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }
(async () => {
  await test('chain selection, IH, same-base protection, lower ranks, toggle and other classes', () => {
    const h = harness(); h.previous(190500);
    assert.equal(h.helper.resolve(220110).skillId, 220130);
    h.harmony(true); assert.equal(h.helper.resolve(220140).skillId, 220160);
    h.previous(141130); assert.equal(h.helper.resolve(220140).skillId, 220150);
    h.harmony(false); assert.equal(h.helper.resolve(220110).skillId, 220120);
    assert.equal(h.helper.resolve(190100).skillId, 190130);
    h.previous(220130); assert.equal(h.helper.resolve(220110).failed, true);
    h.mods.action.inAction = false; assert.equal(h.helper.resolve(220110), null);
    h.previous(190500); h.mods.player.job = 3; assert.equal(h.helper.resolve(220110), null);
    h.mods.player.job = 11; (h.mods.settings.info.ninja_shima=false); assert.equal(h.helper.resolve(220110), null);
  });
  await test('Chakra retries five times and retains confirmation tracking', async () => {
    const h = harness(); h.begin(190530, 190500); await h.advance(300);
    assert.equal(h.sent.filter(x => x.name === 'C_START_SKILL').length, 5);
    assert.ok(h.timers.size);
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 190530}, id: 101, stage: 0, loc: new Vec()});
    assert.equal(h.timers.size, 0);
  });
  await test('Quick Attack retries past 80ms, caps burst rate, stops at exact confirmation', async () => {
    const h = harness(); h.begin(220160, 220140); await h.advance(180);
    const requests = h.sent.filter(x => x.name === 'C_START_SKILL');
    assert.ok(requests.some(x => x.at > 10080));
    for (const request of requests) assert.ok(requests.filter(x => x.at >= request.at && x.at <= request.at + 50).length <= 4);
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 220160}, id: 101, stage: 0, loc: new Vec()});
    const count = h.sent.length; await h.advance(300); assert.equal(h.sent.length, count);
  });
  await test('real cooldown acknowledgement stops retries; fake cooldown does not', async () => {
    const h = harness(); h.begin(220130, 220110); h.cooling(true); await h.advance(100);
    assert.ok(h.sent.filter(x => x.name === 'C_START_SKILL').length > 4);
    h.serverCooldown({time: now, cooldown: 5000}); await h.advance(10);
    const count = h.sent.length; await h.advance(100); assert.equal(h.sent.length, count);
  });
  await test('delayed predecessor confirmation does not stop Quick Attack retries', async () => {
    const h = harness(); h.begin(220160, 220140); await h.advance(50);
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 190530}, id: 100, stage: 0, loc: new Vec()});
    const count = h.sent.length; await h.advance(100); assert.ok(h.sent.length > count);
  });
  await test('deadline is bounded and expires only the owned prediction', async () => {
    const h = harness(); const cast = h.begin(220130, 220110); await h.advance(4000);
    assert.equal(h.callbacks.stopped, cast); assert.equal(h.timers.size, 0);
  });
  await test('new action, natural end, cancel, death, reaction, zoning and unload stop retries', async () => {
    for (const reason of ['new', 'end', 'cancel', 'death', 'reaction', 'zone', 'unload', 'off']) {
      const h = harness(); const cast = h.begin(220160, 220140); await h.advance(30);
      if (reason === 'new') h.mods.skills.sendActionStage({skillId: 141130});
      if (reason === 'end') h.mods.skills.sendActionEnd(220160, 0);
      if (reason === 'cancel') h.dispatch('C_CANCEL_SKILL', {skill: {id: 220160}});
      if (reason === 'death') h.dispatch('S_CREATURE_LIFE', {gameId: 1n, alive: false});
      if (reason === 'reaction') h.mods.action.emit('reaction', {});
      if (reason === 'zone') h.dispatch('S_LOAD_TOPO', {});
      if (reason === 'unload') h.helper.dispose();
      if (reason === 'off') (h.mods.settings.info.ninja_shima=false);
      const count = h.sent.filter(x => x.name === 'C_START_SKILL').length;
      await h.advance(100); assert.equal(h.sent.filter(x => x.name === 'C_START_SKILL').length, count, reason);
      assert.equal(h.callbacks.stopped, undefined, reason);
    }
  });
  await test('late arrow / duplicate continuation suppression and server variant reconciliation', () => {
    const h = harness(); const cast = h.begin(220160, 220140);
    assert.equal(h.dispatch('S_CONNECT_SKILL_ARROW', {skill: {id: 220160}}), false);
    assert.equal(h.helper.beforeInput('C_START_SKILL', {...h.input(220160), continue: true}), true);
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 220150}, id: 101, stage: 0, loc: new Vec()});
    assert.equal(h.callbacks.reconciled.skill.id, 220150); assert.equal(h.timers.size, 0);
  });
  await test('projectile correction requires confirmed Quick Attack; resets and scopes to Ninja', () => {
    const h = harness(); h.begin(220130, 220110);
    let hit = {loc: new Vec(90, 90, 90)}; h.dispatch('C_HIT_USER_PROJECTILE', hit); assert.equal(hit.loc.x, 90);
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 220130}, id: 101, stage: 0, loc: new Vec(99, 99, 99)});
    h.dispatch('C_HIT_USER_PROJECTILE', hit); assert.equal(hit.loc.x, 10);
    const projectile = {skill: {id: 220199}, speed: 1000, projectileSpeed: 1};
    h.dispatch('S_START_USER_PROJECTILE', projectile); assert.ok(projectile.speed > 1250);
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 141130}, id: 102, stage: 0, loc: new Vec()});
    hit = {loc: new Vec(90)}; h.dispatch('C_HIT_USER_PROJECTILE', hit); assert.equal(hit.loc.x, 90);
    h.dispatch('S_LOAD_TOPO', {}); h.mods.player.job = 3;
    h.dispatch('C_HIT_USER_PROJECTILE', hit); assert.equal(hit.loc.x, 90);
  });
  await test('animation adjustment is after speed scaling and limited to the two skills', () => {
    const h = harness(); assert.equal(h.helper.animationLength(190530, 0, 232 / 2, {real: 2}), 116.5);
    assert.equal(h.helper.animationLength(220130, 0, 2266 / 2, {real: 2}), 1133);
    assert.equal(h.helper.animationLength(141130, 0, 900, {real: 2}), 900);
    (h.mods.settings.info.ninja_shima=false); assert.equal(h.helper.animationLength(220130, 0, 900, {real: 2}), 900);
  });
  await test('integrated early Chakra -> IH Quick Attack starts now, sends direct variant, no chain arrow', async () => {
    const h = harness(true); h.previous(190530); h.harmony(true);
    h.dispatch('C_START_SKILL', h.input(220140));
    await h.advance(0);
    const casts = h.sent.filter(x => x.name === 'C_START_SKILL');
    assert.deepEqual(casts.map(x => [x.event.skill.id, x.event.continue]), [[220140, false], [220160, true]]);
    assert.equal(h.sent.filter(x => x.name === 'S_CONNECT_SKILL_ARROW').length, 0);
    assert.equal(h.mods.action.stage.skill.id, 220160);
    assert.equal(h.mods.action.stage._time, 10000);
    await h.advance(180); assert.ok(h.sent.filter(x => x.name === 'C_START_SKILL').some(x => x.at > 10080));
    h.dispatch('S_ACTION_STAGE', {gameId: 1n, skill: {id: 220160}, id: 101, stage: 0, loc: new Vec(), animSeq: []});
    const count = h.sent.filter(x => x.name === 'C_START_SKILL').length;
    await h.advance(100); assert.equal(h.sent.filter(x => x.name === 'C_START_SKILL').length, count);
    assert.equal(h.errors.length, 0);
    h.plugin.destructor();
  });
  await test('integrated resource/cooldown restrictions still refuse local prediction', async () => {
    for (const cause of ['cooldown', 'weapon', 'cc']) {
      const h = harness(true); h.previous(190530); h.harmony(true);
      if (cause === 'cooldown') h.cooling(true);
      if (cause === 'weapon') h.mods.player.inven.weapon = false;
      if (cause === 'cc') h.mods.crowd_control.canCastSkill = () => -3737;
      h.dispatch('C_START_SKILL', h.input(220140)); await h.advance(0);
      assert.equal(h.sent.filter(x => x.name === 'S_ACTION_STAGE').length, 0, cause);
      assert.equal(h.sent.filter(x => x.name === 'C_START_SKILL' && x.event.continue).length, 0, cause);
      h.plugin.destructor();
    }
  });
  await test('standalone Chakra and Quick Attack preserve variants and predict immediately', async () => {
    for (const id of [190500, 220110, 220140]) {
      const h = harness(true); h.mods.action.end = null;
      h.dispatch('C_START_SKILL', h.input(id)); await h.advance(0);
      assert.equal(h.mods.action.stage.skill.id, id);
      assert.equal(h.mods.action.stage._time, 10000);
      h.plugin.destructor();
    }
  });
  await test('server arrow remains suppressed after chaining away from a direct cast', () => {
    const h = harness(); h.begin(220160, 220140);
    h.mods.skills.sendActionStage({skillId: 141130});
    assert.equal(h.dispatch('S_CONNECT_SKILL_ARROW', {skill: {id: 220160}}), false);
    assert.equal(h.dispatch('S_CONNECT_SKILL_ARROW', {skill: {id: 220150}}), true);
  });
  console.log('Passed ' + passed + ' tests.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = realNow; });


'use strict';

const BERSERKER = 3, RAZE = 25, FLATTEN = 4;
const base = id => Math.floor((id || 0) / 10000);
const copy = value => value?.clone ? value.clone() : value && typeof value === 'object' ? {...value} : value;
const clone = event => ({...event, skill:copy(event.skill), loc:copy(event.loc), dest:copy(event.dest)});

module.exports = function ZerkEntrySkill(mod, mods) {
  let pending = null, timer = null, emitting = null, destroyed = false;
  const enabled = id => !destroyed && mods.player.job === BERSERKER && mods.player.alive !== false &&
    mods.utils.isEnabled(id) && mods.utils.canCastSkill() && !mods.action.inSpecialAction;
  const windowMs = () => Math.min(3000, Math.max(1000, 4 * ((mods.ping.ping || 0) + (mods.ping.jitter || 0)) + 500));
  const ownedRaze = cast => mods.action.inAction && mods.action.stage?.id === cast.localId &&
    base(mods.action.stage?.skill?.id) === RAZE;
  const cancel = () => {pending = null; mod.clearTimeout(timer); timer = null;};
  const later = (cast, fn, ms = 10) => {
    mod.clearTimeout(timer);
    timer = mod.setTimeout(() => {timer = null; if (pending === cast) fn(cast);}, Math.max(1, ms));
  };
  const learnedRaze = () => Object.keys(mods.last.skillList?.skills || mods.skills.info.skillData)
    .map(Number).filter(id => base(id) === RAZE && id % 100 === 0 && mods.skills._getInfo(id))
    .reduce((highest, id) => Math.max(highest, id), 0);
  const cooling = id => mods.cooldown.isOnCooldown(id, id) || mods.cooldown.isOnCooldownBase(base(id));
  const resolved = id => mods.skills.getNewSkillData(id, {byGrant:false});
  const castable = (id, data = resolved(id)) => !data.failed && !cooling(id) &&
    mods.skills.canCast(data, {byGrant:false, originalSkillId:id}) >= -2;
  const realRazeChain = id => {
    const stage = mods.action.stage;
    if (!mods.action.inAction || base(stage?.skill?.id) !== RAZE) return false;
    const speed = mods.action.speed?.real, data = mods.skills._getInfo(stage.skill.id);
    const end = data?.cancels?.pendingEndTime;
    const length = mods.skills.getAnimationlengthForAllStages(stage.skill.id, mods.action.speed);
    const limit = end >= 0 && speed > 0 ? Math.min(length, end / speed) : length;
    const elapsed = Date.now() - stage._time;
    if (!Number.isFinite(limit) || !(limit > 0) || !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= limit) return false;
    const next = resolved(id);
    return next.chain && base(next.skillId) === FLATTEN && [30, 31].includes(next.skillId % 100);
  };
  const send = (cast, id) => {
    const event = {...clone(cast.event), skill:{...cast.event.skill, id},
      loc:copy(mods.position.loc || cast.event.loc), continue:false};
    emitting = {cast, id};
    try {mod.send(...mods.packet.get_all('C_START_SKILL'), event);} finally {emitting = null;}
  };
  const transition = cast => {
    if (!enabled(cast.mainId) || Date.now() > cast.deadline || !ownedRaze(cast)) return cancel();
    if (!cast.serverConfirmed) return later(cast, transition);
    const stage = mods.action.stage, speed = mods.action.speed?.real;
    const rear = mods.skills._getInfo(stage.skill.id)?.cancels?.pendingStartTime;
    if (!(speed > 0) || !(rear >= 0)) return cancel();
    const ready = Math.max(stage._time + rear / speed,
      cast.serverTime + rear / (cast.serverSpeed || speed) - (mods.ping.ping || 0));
    if (Date.now() < ready) return later(cast, transition, Math.min(10, ready - Date.now()));
    const next = resolved(cast.mainId);
    if (!next.chain || base(next.skillId) !== FLATTEN || ![30, 31].includes(next.skillId % 100) ||
      !castable(cast.mainId, next)) return later(cast, transition);
    cast.phase = 'main';
    cast.deadline = Date.now() + windowMs();
    send(cast, cast.mainId);
    if (pending === cast) later(cast, cancel, windowMs());
  };
  mod.hook(...mods.packet.get_all('C_START_SKILL'), {order:-15, filter:{fake:false}}, event => {
    const id = event.skill.id;
    if (!enabled(id) || base(id) !== FLATTEN || id % 100 !== 0 || event.continue ||
      !Number.isFinite(event.w)) {cancel(); return;}
    if (pending?.mainId === id) {pending.event = clone(event); return false;}
    cancel();
    if (realRazeChain(id) || mods.action.inAction && base(mods.action.stage?.skill?.id) === FLATTEN) return;
    const raze = learnedRaze();
    if (!raze || !enabled(raze) || cooling(raze) || !castable(id, {skillId:id, noAction:true}) ||
      !castable(raze, mods.action.inAction ? resolved(raze) : {skillId:raze, noAction:true})) return;
    if (mods.action.inAction && base(mods.action.stage.skill.id) === RAZE)
      mods.skills.sendActionEnd(mods.action.stage.skill.id, 0);
    const cast = {mainId:id, event:clone(event), phase:'entry',
      previousServer:mods.action.serverStage?.id, deadline:Date.now() + windowMs()};
    pending = cast;
    send(cast, raze);
    if (pending === cast) later(cast, cancel, windowMs());
    return false;
  });
  for (const name of ['C_PRESS_SKILL', 'C_CANCEL_SKILL', 'C_START_TARGETED_SKILL',
    'C_START_COMBO_INSTANT_SKILL', 'C_START_INSTANCE_SKILL', 'C_START_INSTANCE_SKILL_EX'])
    mod.hook(...mods.packet.get_all(name), {order:-15, filter:{fake:false}}, cancel);
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order:110, filter:{fake:true}}, event => {
    const cast = pending;
    if (!cast || !mods.player.isMe(event.gameId)) return;
    if (cast.phase === 'main') {if (base(event.skill.id) === FLATTEN) cast.mainAction = event.id; else cancel(); return;}
    if (base(event.skill.id) !== RAZE || cast.localId !== undefined && cast.localId !== event.id) return cancel();
    cast.localId = event.id;
    if (event.stage === 0) later(cast, transition, 1);
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order:-90, filter:{fake:false, silenced:null}}, event => {
    const cast = pending;
    if (!cast || cast.phase !== 'entry' || !mods.player.isMe(event.gameId) ||
      event.id === cast.previousServer || base(event.skill.id) !== RAZE || event.stage !== 0) return;
    cast.serverConfirmed = true;
    cast.serverId = event.id;
    cast.serverTime = Date.now();
    cast.serverSpeed = event.speed;
    later(cast, transition, 1);
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'), {order:110, filter:{fake:null, silenced:null}}, (event, fake) => {
    const cast = pending;
    if (!cast || !mods.player.isMe(event.gameId)) return;
    if (cast.phase === 'entry' && (fake && event.id === cast.localId || !fake && event.id === cast.serverId) ||
      cast.phase === 'main' && fake && event.id === cast.mainAction) cancel();
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'), {order:-90, filter:{fake:null, silenced:null}}, event => {
    if (pending && [RAZE, FLATTEN].includes(base(event.skill.id))) cancel();
  });
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter:{fake:null}}, cancel);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), {filter:{fake:null}}, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) cancel();
  });
  mods.action.on('reaction', cancel);
  const api = {captureRequest(name, event, fake) {
    if (!fake || name !== 'C_START_SKILL' || !emitting || event.skill.id !== emitting.id) return;
    const {cast} = emitting;
    return () => pending === cast && enabled(cast.mainId);
  }};
  mods.zerkEntrySkill = api;
  this.destructor = () => {
    destroyed = true; cancel(); mods.action.off('reaction', cancel);
    if (mods.zerkEntrySkill === api) delete mods.zerkEntrySkill;
  };
};

'use strict';

const LANCER = 1;
const protectedSkills = new Set([3, 13]);
const chainedSkills = new Set([3, 13, 25, 28]);
const base = id => Math.floor((id || 0) / 10000);
const copy = value => value?.clone ? value.clone() : value && typeof value === 'object' ? {...value} : value;

module.exports = function LancerDamageTickLock(mod, mods) {
  let chain = null, timer = null, destroyed = false;
  const clear = () => {
    mod.clearTimeout(timer);
    timer = null;
    chain = null;
  };
  const active = (allowNaturalEnd = false) => {
    const action = mods.action.stage;
    const ended = allowNaturalEnd && !mods.action.inAction &&
      mods.action.end?.id === action?.id && mods.action.end.type === 0 &&
      mods.action.serverInAction && mods.action.serverStage?.skill?.id === action?.skill?.id;
    if (destroyed || mods.player.job !== LANCER || mods.player.alive === false ||
        !(mods.action.inAction || ended) || !protectedSkills.has(base(action?.skill?.id))) return null;
    const lastHit = mods.skills._getInfo(action.skill.id)?.lastHit;
    const speed = mods.action.speed?.real;
    if (!(lastHit > 0) || !(speed > 0) || !Number.isFinite(action._time)) return null;
    return {action, lastHit, speed};
  };
  const readyAt = ({action, lastHit, speed}) => {
    const server = mods.action.serverStage;
    let time = action._time + lastHit / speed;
    if (mods.action.serverInAction && server?.skill?.id === action.skill.id &&
        server._time >= action._time && server.speed > 0) {
      time = Math.max(time, server._time + lastHit / server.speed - (mods.ping.ping || 0));
    } else {
      time += (mods.ping.ping || 0) + (mods.ping.jitter || 0);
    }
    return time + 5;
  };
  const coordination = {
    readyAtFor(event) {
      const state = active();
      return state && state.action.id === event.id ? readyAt(state) : 0;
    }
  };
  mods.lancerDamageTickLock = coordination;
  const flush = record => {
    timer = null;
    const state = active(true);
    if (chain !== record || !state || state.action.id !== record.actionId) return clear();
    const wait = readyAt(state) - Date.now();
    if (wait > 0) {
      timer = mod.setTimeout(() => flush(record), Math.max(1, Math.ceil(wait)));
      return;
    }
    clear();
    // The local Onslaught can end just before its last hit is safe to chain.
    // Keep its chain context for this one request while the server action is still active.
    const ended = !mods.action.inAction;
    if (ended && mods.action.info) mods.action.info.inAction = true;
    try {mod.send(...mods.packet.get_all('C_START_SKILL'), record.event);}
    finally {
      if (ended && mods.action.info && mods.action.stage?.id === record.actionId)
        mods.action.info.inAction = false;
    }
  };
  const schedule = record => {
    mod.clearTimeout(timer);
    const state = active(true);
    if (chain !== record || !state || state.action.id !== record.actionId) return clear();
    timer = mod.setTimeout(() => flush(record), Math.max(1, Math.ceil(readyAt(state) - Date.now())));
  };

  mod.hook(...mods.packet.get_all('C_START_SKILL'), {order: -31, filter: {fake: false}}, event => {
    clear();
    const state = active();
    if (!state || !chainedSkills.has(base(event.skill?.id)) || Date.now() >= readyAt(state)) return;
    const resolved = mods.skills.getNewSkillData?.(event.skill.id,
      {byGrant: event.continue, press: event.press});
    if (resolved?.failed || resolved?.skillId === event.skill.id || !resolved?.skillId) return;
    chain = {event: {...event, skill: copy(event.skill), loc: copy(event.loc),
      dest: copy(event.dest)}, actionId: state.action.id};
    schedule(chain);
    return false;
  });
  for (const name of ['C_PRESS_SKILL', 'C_START_TARGETED_SKILL',
    'C_START_COMBO_INSTANT_SKILL', 'C_START_INSTANCE_SKILL',
    'C_START_INSTANCE_SKILL_EX', 'C_CANCEL_SKILL'])
    mod.hook(...mods.packet.get_all(name), {order: -30, filter: {fake: false}}, clear);
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: -90, filter: {fake: false}}, event => {
    if (chain && mods.player.isMe(event.gameId)) schedule(chain);
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: 110, filter: {fake: true}}, event => {
    if (chain && mods.player.isMe(event.gameId) && event.stage === 0 && event.id !== chain.actionId)
      clear();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'), {order: 110, filter: {fake: null}}, (event, fake) => {
    if (!chain || !mods.player.isMe(event.gameId)) return;
    if (fake && event.id === chain.actionId) {
      if (event.type === 0) schedule(chain);
      else clear();
    } else if (!fake && mods.action.serverStage?.skill?.id === mods.action.stage?.skill?.id &&
        event.id === mods.action.serverStage.id) clear();
  });
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, clear);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), {filter: {fake: null}}, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) clear();
  });
  mods.action.on('reaction', clear);
  this.destructor = () => {
    destroyed = true; clear(); mods.action.off('reaction', clear);
    if (mods.lancerDamageTickLock === coordination) delete mods.lancerDamageTickLock;
  };
};

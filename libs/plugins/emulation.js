const BASE_VARIANTS = [0, 1];
const AVALANCHE_VARIANTS = [51, 52];
const BOOMERANG_SECOND_CASTS = [210111, 210113];
const NORMAL_OR_CANCEL_ENDS = [0, 4, 6];
const RETRYABLE_CAST_RESULTS = [-5, -12];
const BASE_AND_CHAIN_VARIANTS = [0, 30];
const QUICK_ATTACK_VARIANTS = [220110, 220120, 220130, 220140, 220150, 220160];
const QUICK_ATTACK_DIRECT_CHAINS = [220150, 220160];
const NINJA_TRANSITION_EXCLUSIONS = [2, 7, 10];
const CHAIN_OR_CANCEL_ENDS = [4, 6];
const NORMAL_ATTACK_TYPES = ['normal', 'connect'];
const NINJA_LATE_RETRY_BASES = [13,14,17];
const AVALANCHE_SKILLS = [80251,80252];
const NINJA_RETRY_INTERRUPTS = [2,10];
const BOOMERANG_BUFF_VARIANTS = [210150, 210151];
const SUPPRESSED_CAST_RESULTS = [-11, -3737, -17, -999];
const BOOMERANG_CANCEL_SKILLS = [210100, 210111, 210113];
const PREDICTED_ACTION_END_TYPES = [0, 1, 2, 3, 4, 5, 6, 10, 11, 34, 36, 51];

const hooks = require("../enums/hooks"),
  classes = require("../enums/classes");


const RingBuffer = (() => {
'use strict';


class RingBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('Invalid history capacity');
    this.capacity = capacity;
    this.clear();
  }

  clear() {
    this.values = new Array(this.capacity);
    this.start = 0;
    this.length = 0;
  }

  push(value) {
    this.values[(this.start + this.length) % this.capacity] = value;
    if (this.length < this.capacity) this.length++;
    else this.start = (this.start + 1) % this.capacity;
  }

  *[Symbol.iterator]() {
    for (let index = 0; index < this.length; index++) {
      yield this.values[(this.start + index) % this.capacity];
    }
  }
}

return RingBuffer;

})();


const TimerQueue = (() => {
'use strict';



class TimerQueue {
  constructor() {
    this.heap = [];
    this.nextId = 1;
    this.wakeHandle = null;
    this.wakeKind = null;
    this.running = false;
    this.closed = false;
  }

  set(callback, delay, args) {
    if (this.closed) return;
    const origin = new Error();
    delay = Number(delay);
    if (delay > 2147483647) {
      console.error('TimeoutOverflowWarning: ' + delay);
      console.error(origin.stack);
      delay = 2147483647;
    }
    if (!Number.isFinite(delay)) delay = 0;
    const timer = {
      cleared: false,
      id: this.nextId++,
      goal: Date.now() + delay,
      index: this.heap.length,
      _onTimeout: () => callback(...args),
      reportError: error => {
        console.log(origin.stack);
        console.log('----------------');
        console.log(error);
      }
    };
    this.heap.push(timer);
    this.siftUp(timer.index);
    if (timer.index === 0 && !this.running) this.schedule();
    return timer;
  }

  cancel(timer) {
    if (!timer || this.heap[timer.index] !== timer) return;
    const wasFirst = timer.index === 0;
    this.removeAt(timer.index);
    timer.cleared = true;
    if (wasFirst && !this.running) this.schedule();
  }

  before(left, right) {
    return left.goal < right.goal || left.goal === right.goal && left.id < right.id;
  }

  swap(left, right) {
    [this.heap[left], this.heap[right]] = [this.heap[right], this.heap[left]];
    this.heap[left].index = left;
    this.heap[right].index = right;
  }

  siftUp(index) {
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (!this.before(this.heap[index], this.heap[parent])) break;
      this.swap(index, parent);
      index = parent;
    }
    return index;
  }

  siftDown(index) {
    while (index * 2 + 1 < this.heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < this.heap.length && this.before(this.heap[child + 1], this.heap[child])) child++;
      if (!this.before(this.heap[child], this.heap[index])) break;
      this.swap(index, child);
      index = child;
    }
  }

  removeAt(index) {
    const removed = this.heap[index];
    const last = this.heap.pop();
    removed.index = -1;
    if (index < this.heap.length) {
      this.heap[index] = last;
      last.index = index;
      this.siftDown(this.siftUp(index));
    }
    return removed;
  }

  cancelWake() {
    if (this.wakeKind === 'immediate') clearImmediate(this.wakeHandle);
    else if (this.wakeKind === 'timeout') clearTimeout(this.wakeHandle);
    this.wakeHandle = null;
    this.wakeKind = null;
  }

  schedule() {
    this.cancelWake();
    if (this.closed || !this.heap.length) return;
    const remaining = this.heap[0].goal - Date.now();
    if (remaining > 15) {
      this.wakeKind = 'timeout';
      this.wakeHandle = setTimeout(this.wake, remaining - 15);
    } else {
      this.wakeKind = 'immediate';
      this.wakeHandle = setImmediate(this.wake);
    }
  }

  wake = () => {
    this.wakeHandle = null;
    this.wakeKind = null;
    if (this.closed || !this.heap.length) return;
    if (this.heap[0].goal > Date.now()) {
      this.schedule();
      return;
    }
    const timer = this.removeAt(0);
    timer.cleared = true;
    this.running = true;
    try {
      const result = timer._onTimeout();
      if (result && typeof result.then === 'function') Promise.resolve(result).catch(timer.reportError);
    } catch (error) {
      timer.reportError(error);
    } finally {
      this.running = false;

      this.schedule();
    }
  };

  close() {
    this.closed = true;
    this.cancelWake();
    for (const timer of this.heap) {
      timer.cleared = true;
      timer.index = -1;
    }
    this.heap.length = 0;
  }
}

return TimerQueue;

})();


const createFlattenChain = (() => {
'use strict';



return function createFlattenChain(mod, mods, callbacks) {
  const requests = new WeakMap();
  const settings = mods.settings.info;
  if (settings.flatten_chain === undefined) settings.flatten_chain = true;
  let recentRaze = null, current = null, timer = null;
  let supported = true, internalTransition = false, confirmedSpeed = null;
  const idOf = event => event.skill?.id ?? event.skill;
  const base = id => Math.floor(id / 10000);
  const enabled = () => settings.flatten_chain !== false && supported &&
    mods.player.job === 3 && mods.player.alive !== false &&
    mods.utils.isEnabled() && mods.utils.canCastSkill();
  const owns = attempt => attempt.localId !== undefined && mods.action.stage?.id === attempt.localId;
  const reset = () => {
    if (current) current.cancelled = true;
    current = null;
    recentRaze = null;
    mod.clearTimeout(timer);
    timer = null;
  };
  const serverCooldown = () => {
    const cd = mods.cooldown.getData(4, true);
    return cd && cd.time + cd.cooldown > Date.now();
  };
  const recover = attempt => {
    if (current !== attempt || attempt.cancelled) return;
    mod.clearTimeout(timer);
    if (!validRequest(attempt) || !owns(attempt) || serverCooldown()) { reset(); return; }
    if (attempt.phase === 'fallback') {
      reset();
      callbacks.stop(attempt);
      mods.log.debug('FLATTEN-CHAIN', 'Normal fallback was not confirmed');
      mods.log.save?.('flatten-last-result');
      return;
    }

    supported = false;
    attempt.phase = 'fallback';
    attempt.activeId = attempt.normalId;
    attempt.bindNextStage = true;
    requests.set(attempt.original, attempt);
    mods.log.debug('FLATTEN-CHAIN', 'Fast request unconfirmed; restoring normal Flatten', attempt.originalId);
    internalTransition = true;
    try { callbacks.fallback(attempt); }
    finally { internalTransition = false; }
    mods.log.save?.('flatten-last-result');
  };

  const validRequest = attempt => !attempt || (current === attempt && !attempt.cancelled &&
    settings.flatten_chain !== false && mods.player.job === 3 && mods.player.alive !== false &&
    mods.utils.isEnabled() && mods.utils.canCastSkill());
  const prepare = (packetName, event, fake) => {
    if (fake) return true;
    const id = idOf(event);
    if (current) {
      if (packetName === 'C_START_SKILL' && base(id) === 4 && validRequest(current)) return false;
      reset();
    }
    const source = recentRaze;
    recentRaze = null;
    if (!enabled() || packetName !== 'C_START_SKILL' || event.continue ||
        base(id) !== 4 || !BASE_VARIANTS.includes(id % 100) || mods.action.inAction || !source || serverCooldown()) return true;
    const age = Date.now() - source.ended;
    const server = mods.action.serverStage;
    if (!(age >= 0 && age <= 120) || mods.action.end?.id !== source.id ||
        mods.action.end.type !== 0 || mods.action.stage?.id !== source.id ||
        !mods.action.serverInAction || server?.skill?.id !== source.skill ||
        server._time < source.started) return true;
    const options = {byGrant: false, originalSkillId: id};
    const normal = mods.skills.getNewSkillData(id, options);
    if (!normal.noAction || mods.skills.canCast(normal, options) < -2) return true;
    const data = mods.skills._getInfo(normal.skillId);
    const chainSubs = mods.skills._getInfo(source.skill)?.chains?.[4] || [];
    let fastId;
    for (const sub of chainSubs) {
      const level = data?.connectSkills?.['4-' + sub];
      if (level !== undefined) { fastId = 40000 + level * 100 + sub; break; }
    }
    if (!fastId || !mods.utils.isEnabled(fastId)) return true;
    const fastData = mods.skills._getInfo(fastId);
    const fast = mods.skills.getNewSkillData(fastId, {...options, originalSkillId: fastId});
    if (!fastData || fast.skillId !== fastId || !fast.noAction ||
        mods.skills.canCast(fast, {...options, originalSkillId: fastId}) < -2) return true;
    const actionSpeed = mods.skills.getSpeed(fastId), speed = actionSpeed.real;
    const wait = Math.max(100, (Number(mods.ping.ping) || 0) + (Number(mods.ping.jitter) || 0) + 50);
    let firstSideEffect = Math.min(fastData.cooldown?.delay ?? Infinity,
      fastData.lastHit ?? Infinity, fastData.cancels?.rearStartTime ?? Infinity) / speed;
    for (const effect of fastData.abnormalityConsume?.stage || []) {
      if (mods.effects.getAbnormality(effect.id)) firstSideEffect = Math.min(firstSideEffect,
        effect.delay / (effect.fixed ? actionSpeed.fixed : actionSpeed.not_fixed));
    }
    for (const effect of fastData.abnormalityApply || []) firstSideEffect = Math.min(firstSideEffect,
      effect.delay / (effect.fixed ? actionSpeed.fixed : actionSpeed.not_fixed));


    if (!(speed > 0 && wait + 20 < firstSideEffect)) return true;
    const original = {...event, skill: {...event.skill}};
    const attempt = {original, originalId: id, normalId: normal.skillId, fastId, activeId: fastId,
      previousServerId: server.id, packetName, wait, phase: 'fast',
      started: Date.now(), bindNextStage: true, cancelled: false};
    current = attempt;
    requests.set(event, attempt);
    event.skill = {...event.skill, id: fastId};
    mods.log.debug('FLATTEN-CHAIN', 'Requesting late Raze follow-up', {from: id, to: fastId, lateBy: age});
    return true;
  };
  const start = attempt => {
    if (!attempt) return false;
    if (current === attempt && !attempt.cancelled) {
      mod.clearTimeout(timer);
      timer = mod.setTimeout(() => recover(attempt), attempt.wait);
    }
    return true;
  };
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),
    {order: 96, filter: {fake: true}}, event => {
      if (!confirmedSpeed || !mods.player.isMe(event.gameId) || idOf(event) !== idOf(confirmedSpeed)) return;
      const speed = confirmedSpeed.speed;
      if (!(speed > 0)) return;
      Object.assign(mods.action.info.speed, {real: speed, stage: speed,
        projectile: confirmedSpeed.projectileSpeed, not_fixed: speed,
        fixed: speed / mods.player.aspd});
    });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),
    {order: 110, filter: {fake: true}}, event => {
      if (!mods.player.isMe(event.gameId) || event.stage) return;
      const id = idOf(event);
      if (current && current.bindNextStage && id === current.activeId) {
        current.localId = event.id;
        current.bindNextStage = false;
      } else if (current) reset();
      recentRaze = mods.player.job === 3 && base(id) === 25 ?
        {id: event.id, skill: id, started: Date.now()} : null;
    });
  mod.hook(...mods.packet.get_all('S_ACTION_END'),
    {order: 110, filter: {fake: true}}, event => {
      if (!mods.player.isMe(event.gameId)) return;
      if (recentRaze?.id === event.id) {
        if (event.type === 0) recentRaze.ended = Date.now();
        else recentRaze = null;
      }
      if (!internalTransition && current?.localId === event.id && event.type !== 0) reset();
    });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),
    {order: -90, filter: {fake: false, silenced: null}}, event => {
      const attempt = current;
      if (!attempt || !mods.player.isMe(event.gameId) || event.stage || event.id === attempt.previousServerId) return;
      if (base(idOf(event)) !== 4) { reset(); return; }
      const owned = owns(attempt);
      const mismatch = idOf(event) !== mods.action.stage?.skill?.id || event.speed !== mods.action.stage?.speed;
      if (idOf(event) !== attempt.fastId) supported = false;
      mods.log.debug('FLATTEN-CHAIN', 'Server confirmed', idOf(event));
      reset();
      if (owned && mismatch) {
        confirmedSpeed = event;
        try { callbacks.confirm(attempt, event); }
        finally { confirmedSpeed = null; }
      }
      if (idOf(event) !== attempt.fastId) mods.log.save?.('flatten-last-result');
    });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'), {order: -10}, event => {
    const attempt = current;
    if (!attempt) return;
    const rejectedIds = attempt.phase === 'fast' ?
      [attempt.fastId, attempt.originalId, attempt.normalId] : [attempt.activeId, attempt.originalId];
    if (!rejectedIds.includes(idOf(event))) return;
    if (attempt.phase === 'fast') { recover(attempt); return false; }
    reset();
    callbacks.stop(attempt);
  });
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'), {order: -90}, event => {
    if (base(idOf(event)) === 4) reset();
  });
  const resetSession = () => { reset(); supported = true; };
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, resetSession);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), {order: -90, filter: {fake: null}}, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) reset();
  });
  mods.action.on('reaction', reset);
  return {prepare, start, get: event => requests.get(event), valid: validRequest,
    abandon: attempt => {if (current === attempt) reset();},
    reset: () => {reset(); mods.action.off('reaction', reset);}};
};

})();


const createBoomerangGuard = (() => {
'use strict';



return function createBoomerangGuard(mod, mods, resend) {
  let current = null, timer = null, expiryTimer = null;
  let lastDiagnostic = -Infinity;
  const isAvalanche = id => Math.floor(id / 10000) === 8 && AVALANCHE_VARIANTS.includes(id % 100);
  const isSecondCast = id => BOOMERANG_SECOND_CASTS.includes(id);
  const isSourceStage = (cast, stage) => {
    const id = stage?.skill?.id;



    if (!isAvalanche(id) || Math.floor(id / 100) !== Math.floor(cast.sourceSkill / 100) ||
        stage.id === undefined || !(stage._time >= cast.sourceTime)) return false;
    if (cast.sourceServerId === undefined) cast.sourceServerId = stage.id;
    return stage.id === cast.sourceServerId;
  };
  const reset = (reason = 'cancelled', saveDiagnostic = false) => {
    if (current) {
      const cast = current;
      mods.log.debug('BOOMERANG', reason, {
        skillId: cast.skillId, initialResult: cast.initialResult,
        elapsed: Date.now() - cast.started, predicted: cast.predicted,
        retries: cast.retries, retried: cast.retried,
        localSkill: mods.action.stage?.skill?.id, localAction: mods.action.stage?.id,
        serverSkill: mods.action.serverStage?.skill?.id, serverAction: mods.action.serverStage?.id,
        serverEnd: mods.action.serverEnd?.skill?.id, serverEndType: mods.action.serverEnd?.type,
        serverSecondBuff: !!mods.effects.getServerAbnormality(10154350),
        serverFinalBuff: !!mods.effects.getServerAbnormality(10154351)
      });
      if (saveDiagnostic && Date.now() - lastDiagnostic >= 1000 && mods.log.save) {
        lastDiagnostic = Date.now();
        try { mods.log.save('boomerang-last-failure'); }
        catch (error) { mods.log.error('BOOMERANG', 'Could not save diagnostic log', error); }
      }
    }
    mod.clearTimeout(timer);
    mod.clearTimeout(expiryTimer);
    timer = null;
    expiryTimer = null;
    current = null;
  };
  const confirmed = cast => {
    const stage = mods.action.serverStage;
    const finalBuff = mods.effects.getServerAbnormality(10154351);
    return (stage?.id !== cast.previousServerId && stage?.skill?.id === cast.skillId &&
      stage._time >= cast.started) || (finalBuff && finalBuff !== cast.previousFinalBuff);
  };
  const check = () => {
    mod.clearTimeout(timer);
    timer = null;
    const cast = current;
    if (!cast) return;
    if (confirmed(cast)) { reset('Second cast confirmed'); return; }
    if (Date.now() >= cast.deadline) { reset('Second cast remained unconfirmed', true); return; }
    if (mods.player.job !== 11 ||
        mods.player.alive === false || !mods.utils.isEnabled(cast.event.skill.id) ||
        !mods.utils.canCastSkill() || mods.action.stage?.id !== cast.localId ||
        mods.action.inSpecialAction) {
      reset('Recovery cancelled by player or action change',
        mods.action.stage?.id !== cast.localId && Date.now() >= cast.earliestRetry);
      return;
    }
    if (cast.retried) return;
    const stage = mods.action.serverStage, end = mods.action.serverEnd;
    const sourceMatches = isSourceStage(cast, stage);
    if (stage && stage.id !== cast.previousServerId && !sourceMatches &&
        stage._time >= cast.started) {
      reset('Server switched to a different action', true);
      return;
    }
    const avalancheEnded = !mods.action.serverInAction &&
      sourceMatches && end?.id === stage.id &&
      end.skill?.id === stage.skill.id && end._time >= stage._time;
    if (avalancheEnded && !NORMAL_OR_CANCEL_ENDS.includes(end.type)) {
      reset();
      return;
    }



    const retryInput = cast.retries < 4 && (avalancheEnded ||
      mods.action.serverInAction && sourceMatches);
    if (avalancheEnded || retryInput) {
      const serverCooldown = mods.cooldown.getData(cast.skillId, true);
      const localCooldown = mods.cooldown.getData(cast.skillId);
      const remaining = Math.max(retryInput ? cast.nextRetry : cast.earliestRetry,
        !retryInput && avalancheEnded ? end._time + 20 : 0,
        (serverCooldown?.time || 0) + (serverCooldown?.cooldown || 0),
        (localCooldown?.time || 0) + (localCooldown?.cooldown || 0)) - Date.now();
      if (remaining > 0) {
        mod.clearTimeout(timer);
        if (Date.now() + remaining < cast.deadline) timer = mod.setTimeout(check, remaining);
        return;
      }


      const secondBuff = mods.effects.getServerAbnormality(10154350);
      if (secondBuff && !mods.effects.getServerAbnormality(10154351)) {
        const options = { byGrant: cast.event.continue, press: cast.event.press,
          originalSkillId: cast.event.skill.id };
        const skillData = cast.predicted ? {skillId: cast.skillId, noAction: true} :
          mods.skills.getNewSkillData(cast.event.skill.id, options);
        const castResult = mods.skills.canCast(skillData, options);
        if (skillData.skillId !== cast.skillId) { reset('Second-cast window changed', true); return; }
        if (castResult < -2 || skillData.future && skillData.time < 0) {
          if (RETRYABLE_CAST_RESULTS.includes(castResult) || skillData.future && skillData.time < 0)
            timer = mod.setTimeout(check, cast.retryDelay);
          else reset('Recovery cast restricted', true);
          return;
        }
        if (!retryInput) {
          cast.retried = true;
          cast.deadline = Date.now() + Math.max(150, Math.min(1000, mods.utils.getPacketBuffer(150)));
          mod.clearTimeout(expiryTimer);
          expiryTimer = mod.setTimeout(check, cast.deadline - Date.now());
          mods.log.debug('BOOMERANG', 'Recovering unconfirmed second cast after Avalanche', cast.skillId);
        } else {
          cast.retries++;
          cast.nextRetry = Date.now() + cast.retryDelay;
          cast.earliestRetry = Date.now() + Math.max(20, mods.ping.ping + mods.ping.jitter + 20);
          mods.log.debug('BOOMERANG', 'Retrying unconfirmed second-cast input', {
            skillId: cast.skillId, retry: cast.retries, elapsed: Date.now() - cast.started
          });
          timer = mod.setTimeout(check, cast.retries < 4 ? cast.retryDelay :
            Math.max(20, mods.ping.ping + mods.ping.jitter + 20));
        }
        resend(cast.packetName, cast.event, cast.predicted ? null : skillData, castResult);
        return;
      }
    }
  };
  const canRecover = (packetName, event, skillData, castResult) => {
    if (mods.player.job !== 11 || packetName !== 'C_START_SKILL' || event.skill.id !== 210100 ||
        event.continue || !isSecondCast(skillData.skillId) ||
        (castResult < -2 && !RETRYABLE_CAST_RESULTS.includes(castResult))) return false;
    const source = mods.action.stage;
    if (!isAvalanche(source?.skill?.id)) return false;
    if (castResult < -2 && mods.action.inAction) {
      const remaining = mods.skills.getAnimationlengthForAllStages(source.skill.id, mods.action.speed) -
        (Date.now() - source._time);
      if (remaining > Math.max(50, Math.min(250, mods.ping.jitter + 50))) return false;
    }
    return true;
  };
  const capture = (packetName, event, skillData, castResult) => {
    if (!canRecover(packetName, event, skillData, castResult)) return null;
    const source = mods.action.stage;
    if (current && !current.predicted && current.localId === source.id && current.skillId === skillData.skillId) {
      current.event = event;
      return current;
    }
    reset();
    const started = Date.now();
    const retryDelay = Math.max(20, Math.min(50, Math.ceil((mods.ping.ping + mods.ping.jitter) / 4)));
    current = { packetName, event, skillId: skillData.skillId, started,
      sourceSkill: source.skill.id, sourceTime: source._time,
      sourceServerId: undefined,
      retryDelay, nextRetry: started + retryDelay, retries: 0,
      previousServerId: mods.action.serverStage?.id,
      previousFinalBuff: mods.effects.getServerAbnormality(10154351),
      earliestRetry: started + Math.max(20, mods.ping.ping + mods.ping.jitter + 20),
      deadline: started + Math.max(500, Math.min(1500, mods.utils.getPacketBuffer(350))),
      localId: source.id, predicted: false, retried: false, initialResult: castResult };
    isSourceStage(current, mods.action.serverStage);
    mods.log.debug('BOOMERANG', 'Tracking second cast', {
      skillId: skillData.skillId, castResult, sourceSkill: source.skill.id,
      sourceTime: source._time, started, ping: mods.ping.ping, jitter: mods.ping.jitter
    });
    return current;
  };
  const start = cast => {
    if (!cast || current !== cast) return false;
    if (expiryTimer === null) expiryTimer = mod.setTimeout(check, cast.deadline - Date.now());
    check();
    return true;
  };

  for (const name of ['S_ACTION_STAGE', 'S_ACTION_END', 'S_ABNORMALITY_BEGIN',
    'S_ABNORMALITY_REFRESH', 'S_ABNORMALITY_END', 'S_START_COOLTIME_SKILL', 'S_DECREASE_COOLTIME_SKILL'])
    mod.hook(...mods.packet.get_all(name), { order: 110, filter: { fake: false, silenced: null } }, () => {
      if (!current) return;
      mod.clearTimeout(timer);
      check();
    });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),
    { order: 110, filter: { fake: true } }, event => {
      if (!current || !mods.player.isMe(event.gameId)) return;
      if (!current.predicted && event.skill.id === current.skillId) {
        current.localId = event.id;
        current.predicted = true;
      } else if (event.id !== current.localId) reset('Local action changed before confirmation',
        Date.now() >= current.earliestRetry);
    });
  for (const name of ['S_ACTION_END', 'S_START_COOLTIME_SKILL', 'S_DECREASE_COOLTIME_SKILL'])
    mod.hook(...mods.packet.get_all(name), { order: 110, filter: { fake: true } }, () => {
      if (!current) return;
      mod.clearTimeout(timer);
      check();
    });
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', { filter: { fake: null } }, () => reset('Session changed'));
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), { filter: { fake: null } }, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) reset();
  });
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'), event => {
    if (!current) return;
    if ([current.skillId, current.event.skill.id].includes(event.skill.id) ||
        !current.predicted && event.skill.id === current.sourceSkill) reset('Cast cancelled');
  });
  mod.hook(...mods.packet.get_all('S_EACH_SKILL_RESULT'), event => {
    if (event.reaction?.enable && mods.player.isMe(event.target) && !mods.player.isMe(event.source)) reset();
  });
  const handleInput = (packetName, event) => {
    const cast = current;
    if (!cast) return false;
    if (confirmed(cast)) { reset('Second cast confirmed'); return false; }
    if (packetName !== cast.packetName || event.skill.id !== cast.event.skill.id || event.continue) {
      reset('Another input superseded recovery');
      return false;
    }


    if (mods.action.stage?.id !== cast.localId) return false;
    cast.event = event;
    check();
    return true;
  };
  return { canRecover, capture, start, reset, handleInput };
};

})();


const createNinjaShima = (() => {
'use strict';



return function createNinjaShima(mod, mods, callbacks) {
  const settings = mods.settings.info;
  if (settings.ninja_shima === undefined) settings.ninja_shima = true;
  const base = id => Math.floor(id / 10000);
  const idOf = event => event.skill?.id ?? event.skill;
  const supported = id => (base(id) === 19 && BASE_AND_CHAIN_VARIANTS.includes(id % 100)) ||
    QUICK_ATTACK_VARIANTS.includes(id);
  const enabled = id => settings.ninja_shima !== false && mods.player.job === 11 &&
    mods.player.alive !== false && mods.utils.isEnabled(id);
  const copyLoc = loc => loc?.clone ? loc.clone() : loc && {...loc};
  const copyEvent = event => ({...event, skill: {...event.skill},
    loc: copyLoc(event.loc), dest: copyLoc(event.dest)});
  let current = null, timer = null, confirmedStart = null, destroyed = false;
  const directArrows = new Map();
  let sentAt = [];
  const reset = () => {
    mod.clearTimeout(timer);
    timer = null;
    current = null;
  };
  const resetSession = () => { reset(); confirmedStart = null; sentAt = []; directArrows.clear(); };
  const owns = cast => cast.localId !== undefined && mods.action.stage?.id === cast.localId;
  const valid = cast => !destroyed && current === cast && enabled(cast.skillId) &&
    mods.utils.canCastSkill() && !mods.action.inSpecialAction && owns(cast) && mods.action.inAction;
  const resolve = (skillId, options = {}) => {
    if (!enabled(skillId) || !supported(skillId) || mods.action.inSpecialAction) return null;
    if (!mods.action.inAction) return null;
    const previous = mods.action.stage?.skill?.id;
    if (!previous || !mods.skills._getInfo(previous)) return null;
    if (base(previous) === base(skillId)) return {skillId, failed: true, shimaNinja: true};
    let resolved;
    if (base(skillId) === 19) resolved = skillId - skillId % 100 + 30;
    else {
      const harmony = !!mods.effects.getAbnormality(10154482);
      resolved = base(previous) === 19 ? (harmony ? 220160 : 220130) : (harmony ? 220150 : 220120);
    }
    if (!mods.skills._getInfo(resolved) || !mods.utils.isEnabled(resolved)) return null;
    return {skillId: resolved, chain: true, type: 4, time: 0, shimaNinja: true};
  };
  const animationLength = (id, stage, duration, speed) => {
    if (!enabled(id) || !supported(id) || duration < 0) return duration;

    return duration + (base(id) === 19 && stage === 0 ? 1 / speed.real : 0);
  };
  const prepare = (packetName, event, data, result) => {
    if (!enabled(data.skillId) || !supported(data.skillId) || packetName !== 'C_START_SKILL' ||
        result < -2 || data.cancel || data.charge) return null;
    reset();
    const now = Date.now();
    const latency = Math.max(0, Number(mods.ping.ping) || 0) + Math.max(0, Number(mods.ping.jitter) || 0);
    current = {
      skillId: data.skillId, packetName, event: copyEvent(event), started: now,
      previousServerId: mods.action.serverStage?.id, retries: 0,

      deadline: now + (latency + 540) * 4,
      direct: !!data.chain && !event.continue && QUICK_ATTACK_DIRECT_CHAINS.includes(data.skillId),
      confirmed: false, localId: undefined
    };
    return current;
  };
  const continuation = cast => ({...copyEvent(cast.event),
    skill: {...cast.event.skill, id: cast.skillId}, moving: false, continue: true});
  const direct = cast => {
    if (!cast?.direct || current !== cast) return false;
    directArrows.set(cast.skillId, cast.deadline);
    callbacks.send(cast.packetName, continuation(cast));
    sentAt.push(Date.now());
    return true;
  };
  const expire = cast => {
    if (current !== cast) return;
    const stop = !cast.confirmed && owns(cast);
    mods.log.debug('NINJA-SHIMA', 'Unconfirmed cast expired', {skillId: cast.skillId, retries: cast.retries});
    reset();
    if (stop) callbacks.stop(cast);
  };
  const tick = () => {
    timer = null;
    const cast = current;
    if (!cast || cast.confirmed) return;
    if (!valid(cast)) { reset(); return; }
    if (Date.now() >= cast.deadline) { expire(cast); return; }


    const cd = mods.cooldown.getData(base(cast.skillId), true);
    if (cd && cd.time >= cast.started && cd.cooldown > 0) {
      cast.confirmed = true;
      mods.log.debug('NINJA-SHIMA', 'Server cooldown acknowledged cast', cast.skillId);
      return;
    }
    const maximumReached = base(cast.skillId) === 19 && cast.retries >= 5;
    sentAt = sentAt.filter(time => Date.now() - time <= 50);
    const packets = cast.direct ? 2 : 1;
    if (!maximumReached && sentAt.length + packets <= 4) {
      callbacks.send(cast.packetName, {...copyEvent(cast.event),
        ...(cast.direct ? {continue: false} : {})});
      sentAt.push(Date.now());
      if (cast.direct) direct(cast);
      cast.retries++;
    }
    timer = mod.setTimeout(tick, maximumReached ? Math.min(50, cast.deadline - Date.now()) : 10);
  };
  const start = cast => {
    if (!cast || current !== cast) return false;
    cast.localId = mods.action.stage?.id;
    cast.origin = copyLoc(mods.action.stage?.loc || cast.event.loc);
    sentAt.push(Date.now());
    mods.log.debug('NINJA-SHIMA', 'Predicted cast', {skillId: cast.skillId, direct: cast.direct});
    timer = mod.setTimeout(tick, 10);
    return true;
  };
  const beforeInput = (packetName, event) => {
    if (!current) return false;

    if (current.direct && enabled(current.skillId) && event.continue &&
        idOf(event) === current.skillId && owns(current) && mods.action.inAction) return true;
    return false;
  };
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: -90, filter: {fake: false, silenced: null}}, event => {
    if (!mods.player.isMe(event.gameId) || event.stage !== 0) return;
    const cast = current;
    const matches = cast && event.id !== cast.previousServerId && base(idOf(event)) === base(cast.skillId);
    confirmedStart = {skillId: idOf(event), loc: copyLoc(matches ? cast.origin || cast.event.loc : event.loc)};
    if (!matches) return;
    cast.confirmed = true;
    mod.clearTimeout(timer);
    timer = null;
    mods.log.debug('NINJA-SHIMA', 'Server confirmed', {predicted: cast.skillId, actual: idOf(event),
      elapsed: Date.now() - cast.started, retries: cast.retries});
    if (idOf(event) !== cast.skillId && owns(cast) && mods.action.inAction) {
      reset();
      callbacks.reconcile(cast, event);
    }
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: 110, filter: {fake: true}}, event => {
    if (!current || !mods.player.isMe(event.gameId) || current.localId === undefined) return;
    if (event.id !== current.localId) reset();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'), {order: 110, filter: {fake: true}}, event => {
    if (current && mods.player.isMe(event.gameId) && event.id === current.localId) reset();
  });
  mod.hook(...mods.packet.get_all('S_CONNECT_SKILL_ARROW'), {order: -15}, event => {


    if (enabled(idOf(event)) && Date.now() <= (directArrows.get(idOf(event)) || 0)) return false;
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'), {order: -15}, event => {
    if (!current || current.confirmed || !valid(current) || base(idOf(event)) !== base(current.skillId)) return;
    if (Date.now() < current.deadline) return false;
  });
  mod.hook(...mods.packet.get_all('C_HIT_USER_PROJECTILE'), {order: -10}, event => {
    if (!enabled(confirmedStart?.skillId) || base(confirmedStart?.skillId) !== 22 || !confirmedStart.loc) return;
    event.loc = copyLoc(confirmedStart.loc);
    return true;
  });
  const compensateProjectile = event => {
    if (!enabled(confirmedStart?.skillId) || base(confirmedStart?.skillId) !== 22 || base(idOf(event)) !== 22) return;
    if (event.gameId !== undefined && !mods.player.isMe(event.gameId)) return;
    const travelTime = idOf(event) === 220199 ? 605 : 600;
    const ping = Math.max(0, Number(mods.ping.ping) || 0);

    if (event.speed > 0) event.speed *= (1 + ping / travelTime) * 1.25;
    if (event.projectileSpeed > 0) event.projectileSpeed *= (1 + ping * event.projectileSpeed / travelTime) * 1.25;
    return true;
  };
  for (const name of ['S_SPAWN_PROJECTILE', 'S_START_USER_PROJECTILE'])
    mod.hook(...mods.packet.get_all(name), {order: -10}, compensateProjectile);
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'), {order: -90}, event => {
    if (current && base(idOf(event)) === base(current.skillId)) reset();
  });
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), {order: -90}, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) resetSession();
  });
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, resetSession);
  mods.action.on('reaction', reset);
  return {resolve, animationLength, prepare, direct, start, beforeInput,
    handles: id => enabled(id) && supported(id),
    dispose: () => {
      destroyed = true;
      resetSession();
      mods.action.off('reaction', reset);

    }};
};

})();


const createNinjaTransitions = (() => {
'use strict';



return function (mod, mods, callbacks) {
  const settings = mods.settings.info;
  if (settings.ninja_transition_buffer === undefined)
    settings.ninja_transition_buffer = {enabled: true, maxWaitMs: 250, transitions: {}};
  if (settings.ninja_load_reduce === undefined) settings.ninja_load_reduce = true;
  const base = id => Math.floor(id / 10000);
  const excluded = id => NINJA_TRANSITION_EXCLUSIONS.includes(base(id));
  const active = id => mods.player.job === 11 && mods.player.alive !== false &&
    mods.utils.isEnabled(id) && !mods.action.inSpecialAction;
  const config = () => settings.ninja_transition_buffer || {};
  let pending = null, timer = null, hiddenEnd = null, disposed = false;
  const stats = {buffered: 0, released: 0, discarded: 0, reduced: 0};
  const reset = () => {
    if (pending) stats.discarded++;
    pending = null;
    mod.clearTimeout(timer);
    timer = null;
  };
  const signature = (name, event) => mods.library.jsonStringify({
    name, skill: event.skill, continue: event.continue, press: event.press,
    target: event.target, targets: event.targets
  });
  const observe = (name, event) => {
    if (pending && signature(name, event) !== pending.signature) reset();
  };
  const owns = item => mods.action.stage?.id === item.owner &&
    (mods.action.inAction || mods.action.end?.id === item.owner && mods.action.end.type === 0);
  const confirmed = item => {
    const stage = mods.action.serverStage;
    return stage && base(stage.skill.id) === base(item.from) &&
      stage._time >= item.sourceTime;
  };
  const poll = () => {
    timer = null;
    const item = pending;
    if (!item) return;
    if (disposed || config().enabled === false || !active(item.event.skill.id) ||
        !mods.utils.canCastSkill() || !owns(item)) { reset(); return; }
    const result = callbacks.evaluate(item.event);

    if (result.result < -2 && !(item.earlyChain && result.result === -5) ||
        result.data.cancel || result.data.charge) {
      reset(); return;
    }
    if (!result.data.failed && result.result >= -2 && result.delay <= 0 && (!item.confirm || confirmed(item))) {
      pending = null;
      stats.released++;
      callbacks.release(item.name, item.event, result.data, result.result);
      return;
    }
    if (Date.now() >= item.deadline) { reset(); return; }
    timer = mod.setTimeout(poll, Math.max(1, Math.min(10, item.deadline - Date.now(), result.delay > 0 ? result.delay : 10)));
  };
  const capture = (name, event, data, result, delay) => {
    const from = mods.action.stage?.skill?.id;
    if (disposed || config().enabled === false || !active(event.skill.id) || !mods.action.inAction ||
        !from || excluded(from) || excluded(event.skill.id) || base(event.skill.id) === 21 || data.shimaNinja ||
        base(from) === base(event.skill.id) || name !== 'C_START_SKILL' || event.continue ||
        data.cancel || data.charge || result < -2 && result !== -5) return false;
    const key = signature(name, event);
    if (pending?.signature === key) {

      pending.event = event;
      return true;
    }
    const rule = config().transitions?.[base(from) + '>' + base(data.skillId)] || {};
    const limit = Math.max(1, Math.min(1000, Number(rule.maxWaitMs ?? config().maxWaitMs) || 250));
    const source = mods.skills._getInfo(from);
    const pendingStart = source?.cancels?.pendingStartTime;
    const speed = mods.action.speed?.real;
    const untilWindow = pendingStart >= 0 && speed > 0 ?
      pendingStart / speed - (Date.now() - mods.action.stage._time) : Infinity;
    const earlyChain = result === -5 && data.failed &&
      source?.chains?.[base(event.skill.id)] !== undefined && untilWindow > 0 && untilWindow <= limit;
    if (data.failed && !earlyChain) return false;
    const needsConfirm = rule.confirm === true && !confirmed({from, sourceTime: mods.action.stage._time});
    if (!(earlyChain || delay > 0 && data.time < 0 || needsConfirm) || delay > limit) return false;
    reset();
    pending = {name, event, signature: key, owner: mods.action.stage.id,
      from, sourceTime: mods.action.stage._time, confirm: rule.confirm === true, earlyChain,
      deadline: Date.now() + limit};
    stats.buffered++;
    timer = mod.setTimeout(poll, Math.max(1, Math.min(10, delay > 0 ? delay : 10)));
    return true;
  };

  const near = (a, b) => a && b && [a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite) &&
    Math.hypot(a.x - b.x, a.y - b.y) < 17.5 && Math.abs(a.z - b.z) < 17.5;
  const handoff = (data, event, stageDelay, end, start) => {
    const previous = mods.action.stage;
    const info = mods.skills._getInfo(data.skillId);
    const eligible = !disposed && settings.ninja_load_reduce !== false && active(data.skillId) &&
      mods.action.inAction && previous && !excluded(previous.skill.id) && !excluded(data.skillId) &&
      !data.charge && !data.cancel && !stageDelay && CHAIN_OR_CANCEL_ENDS.includes(data.type) &&
      NORMAL_ATTACK_TYPES.includes(mods.skills.getType(previous.skill.id)) &&
      NORMAL_ATTACK_TYPES.includes(info?.type) &&
      (!Array.isArray(info.animLength) || info.animLength.length === 1) &&
      base(previous.skill.id) !== base(data.skillId) && near(mods.position.loc, event.loc);
    if (!eligible) { end(); start(); return; }



    hiddenEnd = {id: previous.id, skill: previous.skill.id, type: data.type,
      loc: event.loc, w: event.w};
    try { end(); } finally { hiddenEnd = null; }
    start();
  };
  mod.hook(...mods.packet.get_all('S_ACTION_END'), {order: 1000000, filter: {fake: true}}, event => {
    if (hiddenEnd && mods.player.isMe(event.gameId) && event.id === hiddenEnd.id &&
        event.skill.id === hiddenEnd.skill && event.type === hiddenEnd.type && near(event.loc, hiddenEnd.loc) &&
        Number.isFinite(event.w) && Number.isFinite(hiddenEnd.w) &&
        Math.abs(Math.atan2(Math.sin(event.w - hiddenEnd.w), Math.cos(event.w - hiddenEnd.w))) < 0.01) {
      stats.reduced++;
      return false;
    }
  });
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, reset);
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'), {order: -90}, reset);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), {order: -90}, e => {
    if (mods.player.isMe(e.gameId) && !e.alive) reset();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: 110, filter: {fake: true}}, e => {
    if (pending && mods.player.isMe(e.gameId) && e.id !== pending.owner) reset();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'), {order: 110, filter: {fake: true}}, e => {
    if (pending && mods.player.isMe(e.gameId) && e.id === pending.owner && e.type !== 0) reset();
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'), {order: -90}, e => {
    if (pending && base(e.skill.id) === base(pending.from)) reset();
  });
  mods.action.on('reaction', reset);
  return {observe, capture, handoff, reset, stats, dispose() {
    disposed = true; reset(); hiddenEnd = null;
    mods.action.off('reaction', reset);

  }};
};

})();


const createNinjaRetryPolicy = (() => {
'use strict';




const profiles = {
  "10100": {
    "PST": 150
  },
  "10101": {
    "PST": 100
  },
  "10102": {
    "PST": 75
  },
  "10103": {
    "PST": 75
  },
  "10104": {
    "PST": 75
  },
  "10105": {
    "PST": 125
  },
  "10106": {
    "PST": 150
  },
  "10130": {
    "PST": 150
  },
  "10140": {
    "PST": 150
  },
  "10141": {
    "PST": 100
  },
  "10142": {
    "PST": 75
  },
  "10143": {
    "PST": 75
  },
  "10144": {
    "PST": 75
  },
  "10145": {
    "PST": 125
  },
  "10146": {
    "PST": 150
  },
  "10170": {
    "PST": 150
  },
  "10200": {
    "PST": 150
  },
  "10201": {
    "PST": 100
  },
  "10202": {
    "PST": 75
  },
  "10203": {
    "PST": 75
  },
  "10204": {
    "PST": 75
  },
  "10205": {
    "PST": 125
  },
  "10206": {
    "PST": 150
  },
  "10230": {
    "PST": 150
  },
  "10240": {
    "PST": 150
  },
  "10241": {
    "PST": 100
  },
  "10242": {
    "PST": 75
  },
  "10243": {
    "PST": 75
  },
  "10244": {
    "PST": 75
  },
  "10245": {
    "PST": 125
  },
  "10246": {
    "PST": 150
  },
  "10270": {
    "PST": 150
  },
  "10300": {
    "PST": 150
  },
  "10301": {
    "PST": 100
  },
  "10302": {
    "PST": 75
  },
  "10303": {
    "PST": 75
  },
  "10304": {
    "PST": 75
  },
  "10305": {
    "PST": 125
  },
  "10306": {
    "PST": 150
  },
  "10330": {
    "PST": 150
  },
  "10340": {
    "PST": 150
  },
  "10341": {
    "PST": 100
  },
  "10342": {
    "PST": 75
  },
  "10343": {
    "PST": 75
  },
  "10344": {
    "PST": 75
  },
  "10345": {
    "PST": 125
  },
  "10346": {
    "PST": 150
  },
  "10370": {
    "PST": 150
  },
  "10400": {
    "PST": 150
  },
  "10401": {
    "PST": 100
  },
  "10402": {
    "PST": 75
  },
  "10403": {
    "PST": 75
  },
  "10404": {
    "PST": 75
  },
  "10405": {
    "PST": 125
  },
  "10406": {
    "PST": 150
  },
  "10430": {
    "PST": 150
  },
  "10440": {
    "PST": 150
  },
  "10441": {
    "PST": 100
  },
  "10442": {
    "PST": 75
  },
  "10443": {
    "PST": 75
  },
  "10444": {
    "PST": 75
  },
  "10445": {
    "PST": 125
  },
  "10446": {
    "PST": 150
  },
  "10470": {
    "PST": 150
  },
  "10500": {
    "PST": 150
  },
  "10501": {
    "PST": 100
  },
  "10502": {
    "PST": 75
  },
  "10503": {
    "PST": 75
  },
  "10504": {
    "PST": 75
  },
  "10505": {
    "PST": 125
  },
  "10506": {
    "PST": 150
  },
  "10530": {
    "PST": 150
  },
  "10540": {
    "PST": 150
  },
  "10541": {
    "PST": 100
  },
  "10542": {
    "PST": 75
  },
  "10543": {
    "PST": 75
  },
  "10544": {
    "PST": 75
  },
  "10545": {
    "PST": 125
  },
  "10546": {
    "PST": 150
  },
  "10570": {
    "PST": 150
  },
  "10600": {
    "PST": 150
  },
  "10601": {
    "PST": 100
  },
  "10602": {
    "PST": 75
  },
  "10603": {
    "PST": 75
  },
  "10604": {
    "PST": 75
  },
  "10605": {
    "PST": 125
  },
  "10606": {
    "PST": 150
  },
  "10630": {
    "PST": 150
  },
  "10640": {
    "PST": 150
  },
  "10641": {
    "PST": 100
  },
  "10642": {
    "PST": 75
  },
  "10643": {
    "PST": 75
  },
  "10644": {
    "PST": 75
  },
  "10645": {
    "PST": 125
  },
  "10646": {
    "PST": 150
  },
  "10670": {
    "PST": 150
  },
  "10700": {
    "PST": 150
  },
  "10701": {
    "PST": 100
  },
  "10702": {
    "PST": 75
  },
  "10703": {
    "PST": 75
  },
  "10704": {
    "PST": 75
  },
  "10705": {
    "PST": 125
  },
  "10706": {
    "PST": 150
  },
  "10730": {
    "PST": 150
  },
  "10740": {
    "PST": 150
  },
  "10741": {
    "PST": 100
  },
  "10742": {
    "PST": 75
  },
  "10743": {
    "PST": 75
  },
  "10744": {
    "PST": 75
  },
  "10745": {
    "PST": 125
  },
  "10746": {
    "PST": 150
  },
  "10770": {
    "PST": 150
  },
  "10800": {
    "PST": 150
  },
  "10801": {
    "PST": 100
  },
  "10802": {
    "PST": 75
  },
  "10803": {
    "PST": 75
  },
  "10804": {
    "PST": 75
  },
  "10805": {
    "PST": 125
  },
  "10806": {
    "PST": 150
  },
  "10830": {
    "PST": 150
  },
  "10840": {
    "PST": 150
  },
  "10841": {
    "PST": 100
  },
  "10842": {
    "PST": 75
  },
  "10843": {
    "PST": 75
  },
  "10844": {
    "PST": 75
  },
  "10845": {
    "PST": 125
  },
  "10846": {
    "PST": 150
  },
  "10870": {
    "PST": 150
  },
  "10900": {
    "PST": 150
  },
  "10901": {
    "PST": 100
  },
  "10902": {
    "PST": 75
  },
  "10903": {
    "PST": 75
  },
  "10904": {
    "PST": 75
  },
  "10905": {
    "PST": 125
  },
  "10906": {
    "PST": 150
  },
  "10930": {
    "PST": 150
  },
  "10940": {
    "PST": 150
  },
  "10941": {
    "PST": 100
  },
  "10942": {
    "PST": 75
  },
  "10943": {
    "PST": 75
  },
  "10944": {
    "PST": 75
  },
  "10945": {
    "PST": 125
  },
  "10946": {
    "PST": 150
  },
  "10970": {
    "PST": 150
  },
  "11000": {
    "PST": 150
  },
  "11001": {
    "PST": 100
  },
  "11002": {
    "PST": 75
  },
  "11003": {
    "PST": 75
  },
  "11004": {
    "PST": 75
  },
  "11005": {
    "PST": 125
  },
  "11006": {
    "PST": 150
  },
  "11030": {
    "PST": 150
  },
  "11040": {
    "PST": 150
  },
  "11041": {
    "PST": 100
  },
  "11042": {
    "PST": 75
  },
  "11043": {
    "PST": 75
  },
  "11044": {
    "PST": 75
  },
  "11045": {
    "PST": 125
  },
  "11046": {
    "PST": 150
  },
  "11070": {
    "PST": 150
  },
  "11100": {
    "PST": 150
  },
  "11101": {
    "PST": 100
  },
  "11102": {
    "PST": 75
  },
  "11103": {
    "PST": 75
  },
  "11104": {
    "PST": 75
  },
  "11105": {
    "PST": 125
  },
  "11106": {
    "PST": 150
  },
  "11130": {
    "PST": 150
  },
  "11140": {
    "PST": 150
  },
  "11141": {
    "PST": 100
  },
  "11142": {
    "PST": 75
  },
  "11143": {
    "PST": 75
  },
  "11144": {
    "PST": 75
  },
  "11145": {
    "PST": 125
  },
  "11146": {
    "PST": 150
  },
  "11170": {
    "PST": 150
  },
  "11200": {
    "PST": 150,
    "noRetry": true
  },
  "11201": {
    "PST": 100,
    "noRetry": true
  },
  "11202": {
    "PST": 75,
    "noRetry": true
  },
  "11203": {
    "PST": 75,
    "noRetry": true
  },
  "11204": {
    "PST": 75,
    "noRetry": true
  },
  "11205": {
    "PST": 125,
    "noRetry": true
  },
  "11206": {
    "PST": 150,
    "noRetry": true
  },
  "11230": {
    "PST": 150,
    "noRetry": true
  },
  "11240": {
    "PST": 150,
    "noRetry": true
  },
  "11241": {
    "PST": 100,
    "noRetry": true
  },
  "11242": {
    "PST": 75,
    "noRetry": true
  },
  "11243": {
    "PST": 75,
    "noRetry": true
  },
  "11244": {
    "PST": 75,
    "noRetry": true
  },
  "11245": {
    "PST": 125,
    "noRetry": true
  },
  "11246": {
    "PST": 150,
    "noRetry": true
  },
  "11270": {
    "PST": 150
  },
  "20100": {
    "PST": 374
  },
  "20130": {
    "PST": 374
  },
  "30100": {
    "PST": 181
  },
  "30130": {
    "PST": 181
  },
  "30200": {
    "PST": 181
  },
  "30230": {
    "PST": 181
  },
  "30300": {
    "PST": 181
  },
  "30330": {
    "PST": 181
  },
  "30400": {
    "PST": 181
  },
  "30430": {
    "PST": 181
  },
  "30500": {
    "PST": 181
  },
  "30530": {
    "PST": 181
  },
  "30600": {
    "PST": 181
  },
  "30630": {
    "PST": 181
  },
  "30700": {
    "PST": 181
  },
  "30730": {
    "PST": 181
  },
  "30800": {
    "PST": 454
  },
  "30830": {
    "PST": 454
  },
  "30840": {
    "PST": 454
  },
  "40101": {
    "PST": 30000
  },
  "40102": {
    "PST": 30000
  },
  "40110": {
    "PST": 200
  },
  "40111": {
    "PST": 100
  },
  "40201": {
    "PST": 30000
  },
  "40202": {
    "PST": 30000
  },
  "40210": {
    "PST": 200
  },
  "40211": {
    "PST": 100
  },
  "40301": {
    "PST": 30000
  },
  "40302": {
    "PST": 30000
  },
  "40310": {
    "PST": 200
  },
  "40311": {
    "PST": 100
  },
  "40401": {
    "PST": 30000
  },
  "40402": {
    "PST": 30000
  },
  "40410": {
    "PST": 200
  },
  "40411": {
    "PST": 100
  },
  "40501": {
    "PST": 30000
  },
  "40502": {
    "PST": 30000
  },
  "40510": {
    "PST": 200
  },
  "40511": {
    "PST": 100
  },
  "40601": {
    "PST": 30000
  },
  "40602": {
    "PST": 30000
  },
  "40610": {
    "PST": 200
  },
  "40611": {
    "PST": 100
  },
  "40701": {
    "PST": 30000
  },
  "40702": {
    "PST": 30000
  },
  "40710": {
    "PST": 200
  },
  "40711": {
    "PST": 100
  },
  "40801": {
    "PST": 30000
  },
  "40802": {
    "PST": 30000
  },
  "40810": {
    "PST": 200
  },
  "40811": {
    "PST": 100
  },
  "40901": {
    "PST": 30000
  },
  "40902": {
    "PST": 30000
  },
  "40910": {
    "PST": 200
  },
  "40911": {
    "PST": 100
  },
  "41001": {
    "PST": 0
  },
  "41002": {
    "PST": 0
  },
  "41010": {
    "PST": 200
  },
  "41011": {
    "PST": 100
  },
  "41101": {
    "PST": 0
  },
  "41102": {
    "PST": 0
  },
  "41110": {
    "PST": 200
  },
  "41111": {
    "PST": 100
  },
  "50100": {
    "PST": 416
  },
  "50120": {
    "PST": 250
  },
  "50130": {
    "PST": 416
  },
  "50200": {
    "PST": 416
  },
  "50220": {
    "PST": 250
  },
  "50230": {
    "PST": 416
  },
  "50300": {
    "PST": 416
  },
  "50320": {
    "PST": 250
  },
  "50330": {
    "PST": 416
  },
  "50400": {
    "PST": 416
  },
  "50420": {
    "PST": 250
  },
  "50430": {
    "PST": 416
  },
  "50500": {
    "PST": 416
  },
  "50520": {
    "PST": 250
  },
  "50530": {
    "PST": 416
  },
  "50600": {
    "PST": 416
  },
  "50620": {
    "PST": 250
  },
  "50630": {
    "PST": 416
  },
  "50700": {
    "PST": 416
  },
  "50720": {
    "PST": 250
  },
  "50730": {
    "PST": 416
  },
  "50800": {
    "PST": 416
  },
  "50820": {
    "PST": 250
  },
  "50830": {
    "PST": 416
  },
  "50900": {
    "PST": 416
  },
  "50920": {
    "PST": 250
  },
  "50930": {
    "PST": 416
  },
  "53100": {
    "PST": 416
  },
  "53120": {
    "PST": 250
  },
  "53130": {
    "PST": 416
  },
  "53200": {
    "PST": 416
  },
  "53220": {
    "PST": 250
  },
  "53230": {
    "PST": 416
  },
  "53300": {
    "PST": 416
  },
  "53320": {
    "PST": 250
  },
  "53330": {
    "PST": 416
  },
  "60100": {
    "PST": 3000
  },
  "60101": {
    "PST": 30000
  },
  "60110": {
    "PST": 500
  },
  "60130": {
    "PST": 3000
  },
  "60200": {
    "PST": 3000
  },
  "60201": {
    "PST": 30000
  },
  "60210": {
    "PST": 500
  },
  "60230": {
    "PST": 3000
  },
  "60300": {
    "PST": 3000
  },
  "60301": {
    "PST": 30000
  },
  "60310": {
    "PST": 500
  },
  "60330": {
    "PST": 3000
  },
  "60400": {
    "PST": 3000
  },
  "60401": {
    "PST": 30000
  },
  "60410": {
    "PST": 500
  },
  "60430": {
    "PST": 3000
  },
  "60500": {
    "PST": 3000
  },
  "60501": {
    "PST": 30000
  },
  "60510": {
    "PST": 500
  },
  "60530": {
    "PST": 3000
  },
  "60600": {
    "PST": 3000
  },
  "60601": {
    "PST": 30000
  },
  "60610": {
    "PST": 500
  },
  "60630": {
    "PST": 3000
  },
  "60700": {
    "PST": 3000
  },
  "60701": {
    "PST": 30000
  },
  "60710": {
    "PST": 500
  },
  "60730": {
    "PST": 3000
  },
  "60800": {
    "PST": 3000
  },
  "60801": {
    "PST": 30000
  },
  "60810": {
    "PST": 500
  },
  "60830": {
    "PST": 3000
  },
  "60900": {
    "PST": 3000
  },
  "60901": {
    "PST": 30000
  },
  "60910": {
    "PST": 500
  },
  "60930": {
    "PST": 3000
  },
  "61000": {
    "PST": 3000
  },
  "61001": {
    "PST": 30000
  },
  "61010": {
    "PST": 500
  },
  "61030": {
    "PST": 3000
  },
  "61100": {
    "PST": 0
  },
  "61101": {
    "PST": 0
  },
  "61110": {
    "PST": 500
  },
  "61130": {
    "PST": 0
  },
  "70100": {
    "PST": 300
  },
  "70200": {
    "PST": 300
  },
  "70300": {
    "PST": 300
  },
  "70400": {
    "PST": 300
  },
  "70500": {
    "PST": 300
  },
  "70600": {
    "PST": 300
  },
  "70700": {
    "PST": 300
  },
  "70800": {
    "PST": 300
  },
  "70900": {
    "PST": 300
  },
  "71000": {
    "PST": 300
  },
  "71100": {
    "PST": 300
  },
  "71200": {
    "PST": 300
  },
  "80100": {
    "PST": 500
  },
  "80101": {
    "PST": 500
  },
  "80102": {
    "PST": 500
  },
  "80130": {
    "PST": 500
  },
  "80201": {
    "PST": 500,
    "noRetry": true
  },
  "80202": {
    "PST": 500
  },
  "80203": {
    "PST": 500
  },
  "80230": {
    "PST": 500,
    "noRetry": true
  },
  "80231": {
    "PST": 500,
    "noRetry": true
  },
  "80251": {
    "PST": 2450
  },
  "80252": {
    "PST": 2450
  },
  "90100": {
    "PST": 410
  },
  "90130": {
    "PST": 410
  },
  "90131": {
    "PST": 410,
    "noRetry": true
  },
  "100100": {
    "PST": 500
  },
  "100200": {
    "PST": 500
  },
  "100300": {
    "PST": 500
  },
  "100400": {
    "PST": 500
  },
  "100500": {
    "PST": 500
  },
  "100600": {
    "PST": 500
  },
  "100700": {
    "PST": 500
  },
  "100800": {
    "PST": 500
  },
  "100900": {
    "PST": 500
  },
  "101000": {
    "PST": 500
  },
  "110100": {
    "PST": 200
  },
  "110150": {
    "PST": 200
  },
  "120101": {
    "PST": 200
  },
  "120102": {
    "PST": 200
  },
  "120130": {
    "PST": 200
  },
  "120201": {
    "PST": 200
  },
  "120202": {
    "PST": 200
  },
  "120230": {
    "PST": 200
  },
  "120301": {
    "PST": 200
  },
  "120302": {
    "PST": 200
  },
  "120330": {
    "PST": 200
  },
  "120401": {
    "PST": 200
  },
  "120402": {
    "PST": 200
  },
  "120430": {
    "PST": 200
  },
  "120501": {
    "PST": 200
  },
  "120502": {
    "PST": 200
  },
  "120530": {
    "PST": 200
  },
  "120601": {
    "PST": 200
  },
  "120602": {
    "PST": 200
  },
  "120630": {
    "PST": 200
  },
  "120701": {
    "PST": 200
  },
  "120702": {
    "PST": 200
  },
  "120730": {
    "PST": 200
  },
  "120801": {
    "PST": 200
  },
  "120802": {
    "PST": 200
  },
  "120830": {
    "PST": 200
  },
  "120901": {
    "PST": 200
  },
  "120902": {
    "PST": 200
  },
  "120930": {
    "PST": 200
  },
  "121001": {
    "PST": 200
  },
  "121002": {
    "PST": 200
  },
  "121030": {
    "PST": 200
  },
  "121101": {
    "PST": 200
  },
  "121102": {
    "PST": 200
  },
  "121130": {
    "PST": 200
  },
  "130101": {
    "PST": 200
  },
  "130102": {
    "PST": 200
  },
  "130130": {
    "PST": 200
  },
  "130201": {
    "PST": 200
  },
  "130202": {
    "PST": 200
  },
  "130230": {
    "PST": 200
  },
  "130301": {
    "PST": 200
  },
  "130302": {
    "PST": 200
  },
  "130330": {
    "PST": 200
  },
  "130401": {
    "PST": 200
  },
  "130402": {
    "PST": 200
  },
  "130430": {
    "PST": 200
  },
  "130501": {
    "PST": 200
  },
  "130502": {
    "PST": 200
  },
  "130530": {
    "PST": 200
  },
  "130601": {
    "PST": 200
  },
  "130602": {
    "PST": 200
  },
  "130630": {
    "PST": 200
  },
  "130701": {
    "PST": 200
  },
  "130702": {
    "PST": 200
  },
  "130730": {
    "PST": 200
  },
  "130801": {
    "PST": 200
  },
  "130802": {
    "PST": 200
  },
  "130830": {
    "PST": 200
  },
  "130901": {
    "PST": 200
  },
  "130902": {
    "PST": 200
  },
  "130930": {
    "PST": 200
  },
  "131001": {
    "PST": 200
  },
  "131002": {
    "PST": 200
  },
  "131030": {
    "PST": 200
  },
  "140101": {
    "PST": 200
  },
  "140102": {
    "PST": 200
  },
  "140130": {
    "PST": 200
  },
  "140201": {
    "PST": 200
  },
  "140202": {
    "PST": 200
  },
  "140230": {
    "PST": 200
  },
  "140301": {
    "PST": 200
  },
  "140302": {
    "PST": 200
  },
  "140330": {
    "PST": 200
  },
  "140401": {
    "PST": 200
  },
  "140402": {
    "PST": 200
  },
  "140430": {
    "PST": 200
  },
  "140501": {
    "PST": 200
  },
  "140502": {
    "PST": 200
  },
  "140530": {
    "PST": 200
  },
  "140601": {
    "PST": 200
  },
  "140602": {
    "PST": 200
  },
  "140630": {
    "PST": 200
  },
  "140701": {
    "PST": 200
  },
  "140702": {
    "PST": 200
  },
  "140730": {
    "PST": 200
  },
  "140801": {
    "PST": 200
  },
  "140802": {
    "PST": 200
  },
  "140830": {
    "PST": 200
  },
  "140901": {
    "PST": 200
  },
  "140902": {
    "PST": 200
  },
  "140930": {
    "PST": 200
  },
  "141001": {
    "PST": 200
  },
  "141002": {
    "PST": 200
  },
  "141030": {
    "PST": 200
  },
  "141101": {
    "PST": 200
  },
  "141102": {
    "PST": 200
  },
  "141130": {
    "PST": 200
  },
  "150100": {
    "PST": 200
  },
  "150101": {
    "PST": 100
  },
  "150102": {
    "PST": 100
  },
  "150103": {
    "PST": 100
  },
  "150104": {
    "PST": 100
  },
  "150105": {
    "PST": 100
  },
  "150106": {
    "PST": 100
  },
  "150107": {
    "PST": 100
  },
  "150108": {
    "PST": 100
  },
  "150109": {
    "PST": 100
  },
  "150200": {
    "PST": 200
  },
  "150201": {
    "PST": 100
  },
  "150202": {
    "PST": 100
  },
  "150203": {
    "PST": 100
  },
  "150204": {
    "PST": 100
  },
  "150205": {
    "PST": 100
  },
  "150206": {
    "PST": 100
  },
  "150207": {
    "PST": 100
  },
  "150208": {
    "PST": 100
  },
  "150209": {
    "PST": 100
  },
  "150300": {
    "PST": 200
  },
  "150301": {
    "PST": 100
  },
  "150302": {
    "PST": 100
  },
  "150303": {
    "PST": 100
  },
  "150304": {
    "PST": 100
  },
  "150305": {
    "PST": 100
  },
  "150306": {
    "PST": 100
  },
  "150307": {
    "PST": 100
  },
  "150308": {
    "PST": 100
  },
  "150309": {
    "PST": 100
  },
  "150400": {
    "PST": 200
  },
  "150401": {
    "PST": 100
  },
  "150402": {
    "PST": 100
  },
  "150403": {
    "PST": 100
  },
  "150404": {
    "PST": 100
  },
  "150405": {
    "PST": 100
  },
  "150406": {
    "PST": 100
  },
  "150407": {
    "PST": 100
  },
  "150408": {
    "PST": 100
  },
  "150409": {
    "PST": 100
  },
  "150500": {
    "PST": 200
  },
  "150501": {
    "PST": 100
  },
  "150502": {
    "PST": 100
  },
  "150503": {
    "PST": 100
  },
  "150504": {
    "PST": 100
  },
  "150505": {
    "PST": 100
  },
  "150506": {
    "PST": 100
  },
  "150507": {
    "PST": 100
  },
  "150508": {
    "PST": 100
  },
  "150509": {
    "PST": 100
  },
  "150600": {
    "PST": 200
  },
  "150601": {
    "PST": 100
  },
  "150602": {
    "PST": 100
  },
  "150603": {
    "PST": 100
  },
  "150604": {
    "PST": 100
  },
  "150605": {
    "PST": 100
  },
  "150606": {
    "PST": 100
  },
  "150607": {
    "PST": 100
  },
  "150608": {
    "PST": 100
  },
  "150609": {
    "PST": 100
  },
  "150701": {
    "PST": 200
  },
  "150702": {
    "PST": 100
  },
  "150703": {
    "PST": 100
  },
  "150704": {
    "PST": 100
  },
  "150705": {
    "PST": 100
  },
  "150706": {
    "PST": 100
  },
  "150707": {
    "PST": 100
  },
  "150708": {
    "PST": 100
  },
  "150709": {
    "PST": 100
  },
  "150710": {
    "PST": 100
  },
  "150731": {
    "PST": 1500
  },
  "150732": {
    "PST": 1500
  },
  "160100": {
    "PST": 700
  },
  "160130": {
    "PST": 700
  },
  "160200": {
    "PST": 700
  },
  "160230": {
    "PST": 700
  },
  "160300": {
    "PST": 700
  },
  "160330": {
    "PST": 700
  },
  "160400": {
    "PST": 700
  },
  "160430": {
    "PST": 700
  },
  "170100": {
    "PST": 200
  },
  "170130": {
    "PST": 200
  },
  "173100": {
    "PST": 200
  },
  "173130": {
    "PST": 200
  },
  "173200": {
    "PST": 200
  },
  "173230": {
    "PST": 200
  },
  "173300": {
    "PST": 200
  },
  "173330": {
    "PST": 200
  },
  "180100": {
    "PST": 200
  },
  "180130": {
    "PST": 200
  },
  "180200": {
    "PST": 200
  },
  "180230": {
    "PST": 200
  },
  "180300": {
    "PST": 200
  },
  "180330": {
    "PST": 200
  },
  "180400": {
    "PST": 200
  },
  "180430": {
    "PST": 200
  },
  "180500": {
    "PST": 200
  },
  "180530": {
    "PST": 200
  },
  "180600": {
    "PST": 200
  },
  "180630": {
    "PST": 200
  },
  "180700": {
    "PST": 200
  },
  "180730": {
    "PST": 200
  },
  "180800": {
    "PST": 200
  },
  "180830": {
    "PST": 200
  },
  "180900": {
    "PST": 200
  },
  "180930": {
    "PST": 200
  },
  "181000": {
    "PST": 200
  },
  "181030": {
    "PST": 200
  },
  "181100": {
    "PST": 200,
    "noRetry": true
  },
  "181130": {
    "PST": 200,
    "noRetry": true
  },
  "190100": {
    "PST": 150
  },
  "190130": {
    "PST": 150
  },
  "190200": {
    "PST": 150
  },
  "190230": {
    "PST": 150
  },
  "190300": {
    "PST": 150
  },
  "190330": {
    "PST": 150
  },
  "190400": {
    "PST": 150
  },
  "190430": {
    "PST": 150
  },
  "190500": {
    "PST": 150,
    "fixedRetry": 5
  },
  "190530": {
    "PST": 150,
    "fixedRetry": 5
  },
  "200100": {
    "PST": 300
  },
  "210100": {
    "PST": 588,
    "noRetry": true
  },
  "210111": {
    "PST": 588,
    "noRetry": true
  },
  "210112": {
    "PST": 588,
    "noRetry": true
  },
  "210113": {
    "PST": 588,
    "noRetry": true
  },
  "210115": {
    "PST": 588,
    "noRetry": true
  },
  "210116": {
    "PST": 588,
    "noRetry": true
  },
  "210117": {
    "PST": 588,
    "noRetry": true
  },
  "210118": {
    "PST": 588,
    "noRetry": true
  },
  "210150": {
    "PST": 880,
    "noRetry": true
  },
  "210151": {
    "PST": 880,
    "noRetry": true
  },
  "220110": {
    "PST": 450
  },
  "220120": {
    "PST": 450
  },
  "220130": {
    "PST": 400
  },
  "220140": {
    "PST": 400
  },
  "220150": {
    "PST": 400
  },
  "220160": {
    "PST": 400
  },
  "230100": {
    "PST": 416
  },
  "230130": {
    "PST": 416
  }
};
return function (mod, mods, send) {
  const settings = mods.settings.info;
  if (settings.ninja_retry_policy === undefined) settings.ninja_retry_policy = true;
  const base = id => Math.floor(id / 10000);


  const excluded = new Set([1, 7, 15, 19, 22]);
  let current = null, timer = null, destroyed = false, sentAt = [];
  const stats = {noRetry: 0, tracked: 0, retries: 0, confirmed: 0, cutoff: 0};
  const ping = () => Math.max(0, Number(mods.ping.ping) || 0);
  const latency = () => ping() + Math.max(0, Number(mods.ping.jitter) || 0);
  const enabled = id => !destroyed && settings.ninja_retry_policy !== false && mods.player.job === 11 &&
    mods.player.alive !== false && !excluded.has(base(id)) && mods.utils.isEnabled(id);
  const copy = event => ({...event, skill: {...event.skill},
    loc: event.loc?.clone ? event.loc.clone() : event.loc && {...event.loc},
    dest: event.dest?.clone ? event.dest.clone() : event.dest && {...event.dest}});
  const reset = () => { mod.clearTimeout(timer); timer = null; current = null; };
  const sessionReset = () => { reset(); sentAt = []; };
  const thirdQuartilePing = () => {
    const samples = mod.require?.ping?._ping_array;
    if (!Array.isArray(samples)) return latency();
    const sorted = samples.filter(x => Number.isFinite(x) && x >= 0).sort((a,b) => a-b);
    return sorted.length ? sorted[Math.floor((sorted.length-1)*0.75)] : latency();
  };
  const policyFor = id => {
    if (!enabled(id) || !profiles[id]) return null;
    const data = mods.skills._getInfo(id);
    if (!data) return null;
    if (profiles[id].noRetry) return {mode: 'none'};

    if (!NORMAL_ATTACK_TYPES.includes(data.type) || mods.skills.getRawAnimationLength(id) <= 0) return null;
    return {mode: profiles[id].fixedRetry ? 'fixed' : 'confirmation',
      maximum: profiles[id].fixedRetry || Infinity,
      lateWindow: NINJA_LATE_RETRY_BASES.includes(base(id)) ? Math.max(0, profiles[id].PST - 50) : null};
  };
  const capture = (name, event, data, result) => {
    const policy = policyFor(data.skillId);
    if (!policy || name !== 'C_START_SKILL' || result < -2 || data.cancel || data.charge) return null;
    const stage = mods.action.stage;

    if (policy.mode !== 'none' && mods.action.inAction && stage?.skill?.id === data.skillId) return null;
    const source = mods.action.inAction && stage ? {skillId: stage.skill.id, localTime: stage._time,
      confirmedAt: null, speed: null} : null;
    const server = mods.action.serverStage;
    if (source && server?.skill?.id === source.skillId && server._time >= source.localTime) {
      source.confirmedAt = server._time; source.speed = server.speed;
    }
    return {policy, name, event: copy(event), skillId: data.skillId, source,
      previousServerId: server?.id, started: Date.now(), deadline: Date.now() + (latency()+540)*4,
      retries: 0, localId: undefined, speed: null};
  };
  const owns = cast => mods.action.inAction && !mods.action.inSpecialAction && mods.action.stage?.id === cast.localId;
  const lateDeadline = cast => {
    if (cast.policy.lateWindow === null) return Infinity;
    let origin = cast.started;
    const source = cast.source;
    if (source?.confirmedAt !== null && source?.speed > 0 && profiles[source.skillId]?.PST) {
      origin = Math.max(origin, source.confirmedAt + profiles[source.skillId].PST/source.speed - thirdQuartilePing());
    }
    return origin + cast.policy.lateWindow / cast.speed;
  };
  const tick = () => {
    timer = null;
    const cast = current;
    if (!cast) return;
    if (!enabled(cast.skillId) || !owns(cast) || !mods.utils.canCastSkill()) { reset(); return; }
    if (Date.now() >= cast.deadline || Date.now() >= lateDeadline(cast) || cast.retries >= cast.policy.maximum) {
      stats.cutoff++; reset(); return;
    }

    const cd = mods.cooldown.getData(base(cast.skillId), true);
    if (cd && cd.time >= cast.started && cd.cooldown > 0) { stats.confirmed++; reset(); return; }
    const result = mods.skills.canCast({skillId: cast.skillId, noAction: true}, {
      byGrant: cast.event.continue, press: cast.event.press, originalSkillId: cast.event.skill.id
    });
    if (result < -2 && result !== -12) { reset(); return; }
    sentAt = sentAt.filter(time => Date.now()-time <= 50);
    const count = cast.event.continue ? 2 : 1;
    if (sentAt.length + count <= 4) {
      if (cast.event.continue) {
        send(cast.name, {...copy(cast.event), continue: false});
        send(cast.name, {...copy(cast.event), skill: {...cast.event.skill, id: cast.skillId}, moving: false, continue: true});
      } else send(cast.name, copy(cast.event));
      cast.retries++; stats.retries++;
    }
    timer = mod.setTimeout(tick, 10);
  };
  const start = cast => {
    if (!cast || !enabled(cast.skillId)) return false;
    reset();
    if (cast.policy.mode === 'none') { stats.noRetry++; return true; }

    if (mods.action.stage?.skill?.id !== cast.skillId || !mods.action.inAction) return false;
    cast.localId = mods.action.stage.id;
    cast.speed = mods.action.speed?.real;
    if (!(cast.speed > 0)) return false;
    current = cast; stats.tracked++;
    timer = mod.setTimeout(tick, 10);
    return true;
  };


  mod.hook(...mods.packet.get_all('C_START_SKILL'), {order: 1000000, filter: {fake: null}}, () => {
    sentAt = sentAt.filter(time => Date.now()-time <= 50); sentAt.push(Date.now());
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: -90, filter: {fake: false, silenced: null}}, event => {
    const cast = current;
    if (!cast || !mods.player.isMe(event.gameId) || event.stage !== 0) return;
    if (cast.source && cast.source.confirmedAt === null && event.skill.id === cast.source.skillId && event.speed > 0) {
      cast.source.confirmedAt = Date.now(); cast.source.speed = event.speed;
    }
    const avalancheVariant = AVALANCHE_SKILLS.includes(cast.skillId) && AVALANCHE_SKILLS.includes(event.skill.id);
    if (event.id !== cast.previousServerId && (event.skill.id === cast.skillId || avalancheVariant)) {
      stats.confirmed++; reset();
    }
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), {order: 110, filter: {fake: true}}, event => {
    if (current && mods.player.isMe(event.gameId) && event.id !== current.localId) reset();
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'), {order: 110, filter: {fake: true}}, event => {
    if (current && mods.player.isMe(event.gameId) && event.id === current.localId) reset();
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'), {order: -15}, event => {
    if (current && enabled(current.skillId) && owns(current) && event.skill.id === current.event.skill.id &&
        Date.now() < Math.min(current.deadline, lateDeadline(current))) return false;
  });
  mod.hook(...mods.packet.get_all('C_START_SKILL'), {order: -90}, event => {
    if (current && NINJA_RETRY_INTERRUPTS.includes(base(event.skill.id))) reset();
  });
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'), {order: -90}, reset);
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'), {order: -90}, event => {
    if (mods.player.isMe(event.gameId) && !event.alive) reset();
  });
  for (const name of ['S_LOGIN','S_LOAD_TOPO','S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, sessionReset);
  mods.action.on('reaction', reset);
  return {capture, start, policyFor, stats, dispose() {
    destroyed = true; sessionReset(); mods.action.off('reaction', reset);
  }};
};

})();


const createLancerSilentBlock = (() => {
'use strict';




return function createLancerSilentBlock(mod, mods, callbacks) {
  const settings=mods.settings.info.lancer_silent_block ||= {};
  for(const key of ['enabled','afterBlock','afterShieldCounter'])
    if(settings[key]===undefined)settings[key]=true;
  const id=e=>typeof e.skill==='number'?e.skill:e.skill?.id;
  const base=skill=>Math.floor((skill||0)/10000);
  const guard=skill=>base(skill)===2;
  const clone=v=>v?.clone?v.clone():v&&typeof v==='object'?{...v}:v;
  let block=null,counter=null,permit=null,timer=null,afterTimer=null;
  let internal=false,destroyed=false,held=false;
  const generatedPresses=new WeakMap();
  const allowed=()=>!destroyed && settings.enabled!==false && mods.player.job===1 &&
    mods.player.alive!==false && mods.player.inCombat===true && mods.player.stamina>=40 &&
    !mods.action.inSpecialAction && mods.utils.isEnabled(20200) && mods.utils.canCastSkill();
  const budget=()=>Math.min(3000,Math.max(1000,4*((mods.ping.ping||0)+(mods.ping.jitter||0))+500));
  const release=record=>{
    if(!record?.silent && !record?.released)return;
    internal=true;
    try{callbacks.sendRaw('C_PRESS_SKILL',{skill:record.skill,press:false,
      loc:clone(mods.position.loc||record.loc),w:mods.position.w??record.w});}
    finally{internal=false;}
  };
  const clear=(sendRelease=true,keepPermit=false)=>{
    const record=block;block=null;counter=null;
    if(!keepPermit)permit=null;
    mod.clearTimeout(timer);timer=null;mod.clearTimeout(afterTimer);afterTimer=null;
    if(sendRelease)release(record);
  };
  const watch=record=>{
    if(block!==record)return;
    if(!allowed() || !record.confirmed && Date.now()>record.started+budget()) {clear();return;}
    timer=mod.setTimeout(()=>watch(record),100);
  };
  const silence=record=>{
    if(block!==record || !record.released || !allowed())return;
    record.silent=true;

    if(record.localId!==undefined)callbacks.hide(record.localId);
    mod.clearTimeout(timer);timer=null;watch(record);
  };
  const makeBlock=(skill,loc,w)=>({skill,loc:clone(loc),w,started:Date.now(),
    previousServer:mods.action.serverStage?.id,localId:undefined,serverId:undefined,
    confirmed:false,released:false,silent:false,defendedAt:0});
  const afterCounter=record=>{
    if(counter!==record || !record.ended || !record.confirmed || held || !allowed() || settings.afterShieldCounter===false)return;
    mod.clearTimeout(afterTimer);
    afterTimer=mod.setTimeout(()=>{
      afterTimer=null;
      if(counter!==record || !allowed() || held || mods.action.inAction || mods.action.stage?.id!==record.localId)return;
      counter=null;
      const fresh=makeBlock(20200,mods.position.loc,mods.position.w);
      fresh.released=true;block=fresh;

      internal=true;
      try{mod.send(...mods.packet.get_all('C_PRESS_SKILL'),{skill:20200,press:true,loc:clone(fresh.loc),w:fresh.w});}
      finally{internal=false;}
      if(block===fresh){silence(fresh);}
    },1);
  };
  const beforeSkill=(name,event,fake)=>{
    if(internal) {

      if(name==='C_PRESS_SKILL' && event.press && guard(id(event)) && block)
        generatedPresses.set(event,block);
      return;
    }
    const skill=id(event);
    if(fake && base(skill)===8 && counter && mods.action.stage?.id===counter.localId)return;
    if(name==='C_PRESS_SKILL' && guard(skill)) {
      if(fake)return;
      held=event.press===true;
      if(event.press) {
        clear();
        if(allowed() && settings.afterBlock!==false)block=makeBlock(skill,event.loc,event.w);
        return;
      }
      if(!block || !allowed() || settings.afterBlock===false){clear();return;}
      block.released=true;silence(block);
      return false;
    }
    if(block?.silent || block?.released) {
      if(base(skill)===8 && block.defendedAt>=block.started && block.defendedAt>0)
        permit={started:block.started,defendedAt:block.defendedAt,expires:Date.now()+budget()};
      else permit=null;
      clear(true,base(skill)===8);
    } else {
      block=null;counter=null;mod.clearTimeout(afterTimer);afterTimer=null;
      if(base(skill)!==8)permit=null;
    }
  };
  for(const name of ['C_START_SKILL','C_PRESS_SKILL','C_START_TARGETED_SKILL',
    'C_START_COMBO_INSTANT_SKILL','C_START_INSTANCE_SKILL','C_START_INSTANCE_SKILL_EX'])
    mod.hook(...mods.packet.get_all(name),{order:-20,filter:{fake:null}},(event,fake)=>beforeSkill(name,event,fake));
  mod.hook(...mods.packet.get_all('C_CANCEL_SKILL'),{order:-20,filter:{fake:false}},()=>clear());
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:110,filter:{fake:true}},event=>{
    if(!mods.player.isMe(event.gameId))return;
    if(guard(event.skill.id) && block) {
      if(block.localId!==undefined && block.localId!==event.id) {clear();return;}
      block.localId=event.id;silence(block);return;
    }
    if(base(event.skill.id)===8 && event.stage===0 && allowed()) {
      counter={localId:event.id,started:Date.now(),previousServer:mods.action.serverStage?.id,confirmed:false,ended:false};
      permit=null;
    } else if(!guard(event.skill.id)) {
      if(block)clear();
      if(counter && counter.localId!==event.id)counter=null;
    }
  });
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    if(!mods.player.isMe(event.gameId))return;
    if(guard(event.skill.id) && block && event.id!==block.previousServer) {
      block.serverId=event.id;block.confirmed=true;
      if(block.released)return false;
    }
    if(counter && base(event.skill.id)===8 && event.id!==counter.previousServer && event.stage===0) {
      counter.confirmed=true;afterCounter(counter);
    }
  });

  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'),{order:1000000,filter:{fake:true}},event=>{
    if(block?.released && mods.player.isMe(event.gameId) && event.id===block.localId && guard(event.skill.id))return false;
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'),{order:110,filter:{fake:true}},event=>{
    if(!mods.player.isMe(event.gameId) || !counter || counter.localId!==event.id)return;
    if(event.type!==0){counter=null;return;}
    counter.ended=true;afterCounter(counter);
  });
  mod.hook(...mods.packet.get_all('S_ACTION_END'),{order:-90,filter:{fake:false,silenced:null}},event=>{
    if(block && mods.player.isMe(event.gameId) && event.id===block.serverId && guard(event.skill.id))clear(false);
  });
  mod.hook(...mods.packet.get_all('S_DEFEND_SUCCESS'),{order:-90,filter:{fake:false}},event=>{
    if(block && mods.player.isMe(event.gameId))block.defendedAt=Date.now();
  });
  mod.hook(...mods.packet.get_all('S_CANNOT_START_SKILL'),{order:-90,filter:{fake:null,silenced:null}},event=>{
    if(block && guard(event.skill.id))clear();
    if(base(event.skill.id)===8){counter=null;permit=null;}
  });
  mod.hook(...mods.packet.get_all('C_PLAYER_LOCATION'),{order:-20},event=>{

    if(event.type===0 && (block?.released || block?.silent))clear();
  });
  mod.hook(...mods.packet.get_all('S_CREATURE_LIFE'),{filter:{fake:null}},event=>{
    if(mods.player.isMe(event.gameId) && !event.alive){held=false;clear(false);}
  });
  for(const name of ['S_LOGIN','S_LOAD_TOPO','S_RETURN_TO_LOBBY'])
    mod.hook(name,'raw',{filter:{fake:null}},()=>{held=false;clear(false);});
  const reaction=()=>{held=false;clear();};
  mods.action.on('reaction',reaction);
  const api={
    isStaleBlockRequest(event) {
      const record=generatedPresses.get(event);
      return !!record && (destroyed || block!==record || !allowed());
    },
    canShieldCounter(skill) {
      const record=block?.silent?block:permit;
      return base(skill)===8 && allowed() && !!record && record.defendedAt>=record.started &&
        record.defendedAt>0 && (!record.expires || Date.now()<=record.expires);
    },
    dispose(){destroyed=true;clear();mods.command.remove('lancer sb');mods.action.off('reaction',reaction);if(mods.lancerSilentBlock===api)delete mods.lancerSilentBlock;}
  };
  mods.command.add("lancer sb",()=>{settings.enabled=!settings.enabled;if(!settings.enabled)clear();mods.command.message("Lancer Silent Block: "+(settings.enabled?"ON":"OFF"));});
  mods.lancerSilentBlock=api;
  return api;
};

})();


function createEmulationLifetime(mods) {
  const cleanups=[];
  let closed=false;
  return {
    get closed(){return closed;},
    defer(cleanup){cleanups.push(cleanup);},
    use(component,method='dispose'){cleanups.push(()=>component[method]());return component;},
    close(){
      if(closed)return;
      closed=true;
      for(const cleanup of cleanups.splice(0)) {
        try{cleanup();}catch(error){mods.log.error('EMULATION',error);}
      }
    }
  };
}

module.exports = function (mod, mods) {
  const lifetime=createEmulationLifetime(mods);
  const priestRequests = new WeakMap();
  let expectedSkillId = null,
    expectedEndType = null,
    castQueue = {
      arrived: 0,
      estimate: 0,
      counter: 0
    },
    sendingRetry = false,
    animationTimer = null,
    endLocation = null,
    connectArrowDeadline = 0,
    grantSkillDeadline = 0,
    skipSkillTimeAdjustment = false,
    lastRequestSignature = null,
    deferredPacket = null,
    queuedBoomerangCast = null;
  const lancerSilentBlock = lifetime.use(createLancerSilentBlock(mod, mods, {
    sendRaw: (name, event) => {
      const previous = sendingRetry;
      sendingRetry = true;
      try { mod.send(...mods.packet.get_all(name), event); }
      finally { sendingRetry = previous; }
    },
    hide: actionId => {
      if (!mods.action.inAction || mods.action.stage?.id !== actionId || Math.floor(mods.action.stage.skill.id / 10000) !== 2) return;
      mod.clearTimeout(animationTimer); animationTimer = null;
      mods.skills.sendActionEnd(mods.action.stage.skill.id, 51);
    }
  }), "dispose");
  const processingOffsetMs = 2;
  const ninjaShima = lifetime.use(createNinjaShima(mod, mods, {
    send: (name, event) => {
      sendingRetry = true;
      try { mod.send(...mods.packet.get_all(name), event); }
      finally { sendingRetry = false; }
    },
    stop: cast => {
      if (mods.action.stage?.id !== cast.localId) return;
      mod.clearTimeout(animationTimer);
      animationTimer = null;
      if (mods.action.inAction) mods.skills.sendActionEnd(mods.action.stage.skill.id, 6);
    },
    reconcile: (cast, event) => {
      if (mods.action.stage?.id !== cast.localId) return;
      mod.clearTimeout(animationTimer);
      mods.skills.sendActionEnd(mods.action.stage.skill.id, 6);
      expectedSkillId = event.skill.id;
      mod.send(...mods.packet.get_all('S_ACTION_STAGE'), {
        ...event, id: ++mods.skills.info.skillIdCounter
      });
      endLocation = null;
      const length = ninjaShima.animationLength(event.skill.id, event.stage,
        mods.skills.getAnimationLength(event.skill.id, event.stage, mods.action.speed), mods.action.speed);
      if (length !== -1) animationTimer = mod.setTimeout(advanceAnimation, length, event.skill.id, true);
    }
  }), "dispose");
  const ninjaRetryPolicy = lifetime.use(createNinjaRetryPolicy(mod, mods, (name, event) => {
    sendingRetry = true;
    try { mod.send(...mods.packet.get_all(name), event); }
    finally { sendingRetry = false; }
  }), "dispose");
  const getSkillData = (id, options) => {
    const data = ninjaShima.resolve(id, options) || mods.skills.getNewSkillData(id, options);
    if (!data.failed && ninjaShima.handles(data.skillId)) data.shimaNinja = true;
    return data;
  };
  const ninjaTransitions = lifetime.use(createNinjaTransitions(mod, mods, {
    evaluate: event => {
      const options = {byGrant: event.continue, press: event.press, originalSkillId: event.skill.id};
      const data = getSkillData(event.skill.id, options);
      const result = mods.skills.canCast(data, options);
      let delay = mods.ping.jitter + mods.settings.info.delay +
        mods.skills.getSkillDelayTime(data.skillId, options) - (data.time || 0);
      if (!mods.action.inAction) delay -= Date.now() - (mods.action.end?._time || 0);
      return {data, result, delay: data.shimaNinja ? 0 : Math.max(0, Math.floor(delay + processingOffsetMs))};
    },
    release: (name, event, data, result) => {
      expectedSkillId = data.skillId;
      if (data.type !== undefined) expectedEndType = data.type;
      mods.last.cachePacket(name)(event);
      executeCast(name, event, data, result);
    }
  }), "dispose");
  const stopFlattenPrediction = attempt => {
    if (attempt.localId === undefined || mods.action.stage?.id !== attempt.localId) return false;
    mod.clearTimeout(animationTimer);
    animationTimer = null;
    if (mods.action.inAction) mods.skills.sendActionEnd(mods.action.stage.skill.id, 6);
    return true;
  };
  const flattenChain = lifetime.use(createFlattenChain(mod, mods, {
    stop: stopFlattenPrediction,
    fallback: attempt => {
      if (!stopFlattenPrediction(attempt)) return;
      const options = {byGrant: false, originalSkillId: attempt.originalId};
      const data = mods.skills.getNewSkillData(attempt.originalId, options);
      const result = mods.skills.canCast(data, options);
      attempt.activeId = data.skillId;
      expectedSkillId = data.skillId;
      executeCast(attempt.packetName, attempt.original, data, result, true);
    },
    confirm: (attempt, event) => {
      if (!stopFlattenPrediction(attempt)) return;
      expectedSkillId = event.skill.id;
      expectedEndType = 0;


      mod.send(...mods.packet.get_all('S_ACTION_STAGE'), {
        ...event, id: ++mods.skills.info.skillIdCounter
      });
      endLocation = null;
      const length = mods.skills.getAnimationLength(event.skill.id, event.stage, mods.action.speed);
      if (length !== -1) animationTimer = mod.setTimeout(advanceAnimation, length, event.skill.id, true);
    }
  }), "reset");
  const boomerangGuard = lifetime.use(createBoomerangGuard(mod, mods, (packetName, event, skillData, castResult) => {
    if (skillData) {
      expectedSkillId = skillData.skillId;
      executeCast(packetName, event, skillData, castResult, true);
      return;
    }
    sendingRetry = true;
    try { mod.send(...mods.packet.get_all(packetName), event); }
    finally { sendingRetry = false; }
  }), "reset");
  const latencySamples = new RingBuffer(2000);
  mods.command.add("tracker", () => {
    let totalDelay = 0,
      totalJitter = 0,
      totalChainDelay = 0,
      chainSampleCount = 0;
    for (const latencySampleEntry of latencySamples) {
      totalDelay += latencySampleEntry.delay;
      totalJitter += latencySampleEntry.jitter;
      latencySampleEntry.excessTime !== undefined && (chainSampleCount++, totalChainDelay += Math.max(0, latencySampleEntry.excessTime));
    }
    const length2 = latencySamples.length,
      roundResult = mods.utils.round(length2 ? totalJitter / length2 : 0),
      roundResult2 = mods.utils.round(length2 ? totalDelay / length2 : 0),
      roundResult3 = mods.utils.round(chainSampleCount ? totalChainDelay / chainSampleCount : 0);
    mods.command.message("\nAfter " + length2 + " skills.\nAverage jitter: " + roundResult + "\nAverage delay: " + roundResult2 + "\nAverage chain delay: " + roundResult3);
  });
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.READ_REAL, event => {
    if (!mods.player.isMe(event.gameId)) return;
    expectedSkillId !== event.skill.id && mods.log.debug("EMULATION-VALIDATION", "NOT CORRECT IDS");
  });
  mod.hook(...mods.packet.get_all("S_ACTION_END"), hooks.READ_REAL, event2 => {
    if (!mods.player.isMe(event2.gameId)) return;
    if (!event2.type) return;
    expectedEndType !== event2.type && mods.log.debug("EMULATION-VALIDATION", "NOT CORRECT TYPE");
  });
  const requestSignature = (packetName, event3) => {
      const signatureFields = {
        name: packetName,
        ...event3
      };
      if (signatureFields.w) delete signatureFields.w;
      if (signatureFields.loc) delete signatureFields.loc;
      if (signatureFields.dest) delete signatureFields.dest;
      return mods.library.jsonStringify(signatureFields);
    },
    ownsQueuedBoomerang = queued => mods.action.stage?.id === queued.localId &&
      !mods.action.inSpecialAction && (mods.action.inAction ||
        mods.action.end?.id === queued.localId && mods.action.end.type === 0),
    cancelQueuedBoomerang = (reason, diagnostic = false) => {
      if (!queuedBoomerangCast) return;
      mods.log.debug("BOOMERANG", "Queued follow-up cancelled: " + reason, {
        age: Date.now() - queuedBoomerangCast.started,
        localSkill: mods.action.stage?.skill?.id,
        serverFinalBuff: !!mods.effects.getServerAbnormality(10154351),
        cooldown: mods.cooldown.getData(21, true)
      });
      queuedBoomerangCast = null;
      if (diagnostic && mods.log.save) {
        try { mods.log.save('boomerang-last-failure'); }
        catch (error) { mods.log.error('BOOMERANG', 'Could not save follow-up diagnostic', error); }
      }
    },
    needsBoomerangServerConfirmation = (event3, skillData) => mods.player.job === classes.NINJA &&
      event3.skill.id === 210100 && !event3.continue && BOOMERANG_BUFF_VARIANTS.includes(skillData.skillId) &&
      BOOMERANG_SECOND_CASTS.includes(mods.action.stage?.skill?.id) &&
      !!mods.effects.getAbnormality(10154351) && !mods.effects.getServerAbnormality(10154351),
    queueBoomerangCast = (packetName, event3) => {
      if (queuedBoomerangCast) {
        queuedBoomerangCast.packetName = packetName;
        queuedBoomerangCast.event = event3;
        return;
      }
      const queuedCast = {
        packetName,
        event: event3,
        localId: mods.action.stage.id,
        started: Date.now()
      };
      queuedBoomerangCast = queuedCast;
      const waitForServer = async () => {
        const deadline = queuedCast.started + 350;
        let reason = 'server confirmation timed out';
        while (queuedBoomerangCast === queuedCast && Date.now() < deadline) {
          if (mods.player.job !== classes.NINJA || mods.player.alive === false ||
              !mods.utils.isEnabled(queuedCast.event.skill.id) || !mods.utils.canCastSkill() ||
              !ownsQueuedBoomerang(queuedCast)) {
            cancelQueuedBoomerang('player or action changed');
            return;
          }
          const serverBuff = mods.effects.getServerAbnormality(10154351);


          if (serverBuff && Date.now() - serverBuff.time >= 5) {
            const castOptions = {
              byGrant: queuedCast.event.continue, press: queuedCast.event.press,
              originalSkillId: queuedCast.event.skill.id
            };
            const confirmedSkillData = mods.skills.getNewSkillData(queuedCast.event.skill.id, castOptions);
            const confirmedCastResult = mods.skills.canCast(confirmedSkillData, castOptions);
            const serverCoolingDown = [21, queuedCast.event.skill.id, confirmedSkillData.skillId].some(id => {
              const cd = mods.cooldown.getData(id, true);
              return cd && cd.time + cd.cooldown > Date.now();
            });
            if (BOOMERANG_BUFF_VARIANTS.includes(confirmedSkillData.skillId) &&
                confirmedCastResult >= -2 && !serverCoolingDown &&
                !(confirmedSkillData.future && confirmedSkillData.time < 0)) {
              queuedBoomerangCast = null;
              mods.log.debug("BOOMERANG", "Releasing ready queued final cast");
              executeCast(queuedCast.packetName, queuedCast.event, confirmedSkillData, confirmedCastResult);
              return;
            }
            reason = serverCoolingDown || confirmedCastResult === -12 ?
              'cooldown did not become ready' : 'follow-up did not become castable';
            if (confirmedCastResult < -2 && !RETRYABLE_CAST_RESULTS.includes(confirmedCastResult)) {
              cancelQueuedBoomerang('cast restricted: ' + confirmedCastResult);
              return;
            }
          }
          await mods.utils.sleep(5);
        }
        if (queuedBoomerangCast === queuedCast) cancelQueuedBoomerang(reason, true);
      };
      waitForServer().catch(error => mods.log.error("BOOMERANG", error));
    },
    advanceAnimation = (skillId2, continuation2, stageIndex) => {
      mod.clearTimeout(animationTimer);
      if (continuation2) {
        if (mods.action.stage.id !== mods.skills.counter) return;
        if (!mods.action.inAction) return;
        const stageCount = mods.skills.getStageCount(skillId2),
          stageCountAdjustedMatches = stageCount - 1 <= mods.action.stage.stage,
          skillType = mods.skills.getType(skillId2);
        if (stageCountAdjustedMatches) {
          if (skillType === "movingCharge") return;
          const endType = skillType === "dash" ? 39 : 0;
          expectedEndType = endType;
          mods.skills.sendActionEnd(mods.action.stage.skill.id, endType, endLocation, !!endLocation);
          return;
        }
      }
      mods.skills.sendActionStage({
        skillId: skillId2,
        continuation: continuation2,
        stage: stageIndex
      });
      endLocation = null;
      const delayMs = ninjaShima.animationLength(skillId2, mods.action.stage.stage,
        mods.skills.getAnimationLength(skillId2, mods.action.stage.stage, mods.action.speed), mods.action.speed);
      mods.log.debug("EMULATION", "Length for skill: " + skillId2 + "(" + mods.action.stage.stage + ") is " + delayMs);
      delayMs !== -1 && (mod.clearTimeout(animationTimer), animationTimer = mod.setTimeout(advanceAnimation, delayMs, skillId2, true, undefined));
    };
  let incrementNextSkillId = false;
  const executeCast = async (packetName2, event4, initialSkillData, initialCastResult, boomerangRecovery = false) => {
      if(lifetime.closed)return;
      if (priestRequests.has(event4) && !priestRequests.get(event4)()) return;
      if (mods.lancerEntrySkill?.isStaleBlockRequest?.(event4) ||
          lancerSilentBlock.isStaleBlockRequest(event4) ||
          mods.lancerAutoBlock?.isStaleBlockRequest?.(event4)) return;
      const flattenAttempt = flattenChain.get(event4);
      if (lifetime.closed || !flattenChain.valid(flattenAttempt)) return;
      deferredPacket && (sendingRetry = true, mod.send(...deferredPacket), sendingRetry = false, deferredPacket = null);
      const byGrant2 = event4["continue"],
        press2 = event4.press,
        unkn32 = event4.unkn3,
        skillData = getSkillData(event4.skill.id, {
          byGrant: byGrant2,
          press: press2
        });
      incrementNextSkillId && skillData.skillId++;
      incrementNextSkillId = false;
      if (skillData.type !== initialSkillData.type || skillData.skillId !== initialSkillData.skillId || skillData.failed !== initialSkillData.failed) {
        mods.log.debug("EMULATION", "newSkillData changed value:", skillData);
        if (skillData.failed !== initialSkillData.failed && (skillData.time || 0) < 0) {
          mods.log.debug("EMULATION", "Cancelling skill execution due to time being in the future");
          mod.send(...mods.packet.get_all("S_CANNOT_START_SKILL"), {
            skill: event4.skill
          });
          sendingRetry = true;
          mod.send(...mods.packet.get_all(packetName2), event4);
          sendingRetry = false;
          return;
        }
        let jitterPlusDelay = skillData.shimaNinja ? 0 : mods.ping.jitter + mods.settings.info.delay;
        jitterPlusDelay += mods.skills.getSkillDelayTime(skillData.skillId, {
          byGrant: byGrant2,
          press: press2
        });
        if (skillData.time) jitterPlusDelay -= skillData.time;
        if (!mods.action.inAction) jitterPlusDelay -= Date.now() - mods?.action?.end?._time || 0;
        jitterPlusDelay = skillData.shimaNinja ? 0 : Math.floor(jitterPlusDelay + processingOffsetMs);
        jitterPlusDelay > 0 && (await mods.utils.sleep(jitterPlusDelay));
      }
      if (lifetime.closed || !flattenChain.valid(flattenAttempt)) return;
      if (priestRequests.has(event4) && !priestRequests.get(event4)()) return;
      if (mods.lancerEntrySkill?.isStaleBlockRequest?.(event4) ||
          lancerSilentBlock.isStaleBlockRequest(event4) ||
          mods.lancerAutoBlock?.isStaleBlockRequest?.(event4)) return;
      const castResult = mods.skills.canCast(skillData, {
        byGrant: byGrant2,
        press: press2,
        originalSkillId: event4.skill.id
      });
      castResult !== initialCastResult && mods.log.debug("EMULATION", "cast changed value: " + castResult);
      const boomerangCast = boomerangRecovery ? null : boomerangGuard.capture(packetName2, event4, skillData, castResult);
      const ninjaCast = ninjaShima.prepare(packetName2, event4, skillData, castResult);
      const retryAttempt = ninjaRetryPolicy.capture(packetName2, event4, skillData, castResult);
      !SUPPRESSED_CAST_RESULTS.includes(castResult) && (sendingRetry = true, mod.send(...mods.packet.get_all(packetName2), event4), sendingRetry = false);
      if (mods.skills.getRawAnimationLength(skillData.skillId) === 0) {
        mods.log.debug("EMULATION", "Not sending animation for " + skillData.skillId);
        return;
      }
      if (castResult < -4) {
        flattenChain.abandon(flattenAttempt);
        boomerangGuard.start(boomerangCast);
        mod.send(...mods.packet.get_all("S_CANNOT_START_SKILL"), {
          skill: event4.skill
        });
        return;
      }
      if (castResult === -4) return;
      const {
          skillId: skillId3,
          cancel: cancel2,
          charge: charge2,
          type: type2,
          chain: chain2
        } = skillData,
        skillTypeMatches = mods.skills.getType(skillId3) === "movingCharge" && mods.effects.hasAbnormalityWithCategoryTypeValue(mods.skills.getCategories(skillId3), 327),
        stageIndex2 = skillTypeMatches ? mods.skills.getStageCount(skillId3) - 1 : 0;
      if (cancel2) {
        mods.skills.sendActionEnd(mods.action.stage.skill.id, type2);
        return;
      }
      if (!ninjaShima.direct(ninjaCast) && mods.skills.sendConnectSkillArrow(skillId3, byGrant2)) {
        if (boomerangCast) boomerangGuard.reset('Connect arrow requested');
        connectArrowDeadline = Date.now() + mods.utils.getPacketBuffer();
        mods.action.inAction && type2 && mods.skills.sendActionEnd(mods.action.stage.skill.id, type2);
        return;
      }
      if ((charge2 || skillTypeMatches) && !byGrant2) {
        mod.setTimeout(() => {
          if (unkn32) incrementNextSkillId = true;
          grantSkillDeadline = Date.now() + mods.utils.getPacketBuffer();
          mod.send(...mods.packet.get_all("S_GRANT_SKILL"), {
            skill: skillTypeMatches ? mods.skills.getChargeSkillId(skillId3, stageIndex2) : skillId3
          });
          deferredPacket = [...mods.packet.get_all(packetName2), event4];
          if (skillTypeMatches) skipSkillTimeAdjustment = true;
        }, skillTypeMatches ? 25 : 0);
        if (!skillTypeMatches) return;
      }
      const skillType2 = mods.skills.getType(mods?.action?.stage?.skill?.id);
      const delayMs2 = mods.skills.getActionStageDelay(skillId3);
      ninjaTransitions.handoff(skillData, event4, delayMs2,
        () => { mods.action.inAction && type2 && skillType2 !== "movingCharge" && mods.skills.sendActionEnd(mods.action.stage.skill.id, skillTypeMatches ? 6 : type2); },
        () => { delayMs2 ? mod.setTimeout(advanceAnimation, delayMs2, skillId3, false, stageIndex2) : advanceAnimation(skillId3, false, stageIndex2); });
      if (ninjaShima.start(ninjaCast)) return;
      if (flattenChain.start(flattenAttempt) || boomerangRecovery || boomerangGuard.start(boomerangCast)) return;
      if (ninjaRetryPolicy.start(retryAttempt)) return;
      if (priestRequests.has(event4)) return;
      const retryCount = mods.skills.getRetryCount(skillId3),
        retryDelayMs = mods.hardcoded.getRetryDelay(skillId3),
        allowThroughFutureRetry = mods.hardcoded.getAllowThroughFutureRetry(skillId3),
        id2 = mods?.action?.serverStage?.id,
        id3 = mods?.action?.stage?.id,
        timestamp = Date.now();
      for (let retryIndex = 0; retryIndex < retryCount; retryIndex++) {
        await mods.utils.sleep(retryDelayMs);
        if(lifetime.closed)return;
        if (mods?.action?.serverStage?.id !== id2) {
          const timeMinusTimestamp = mods.action.serverStage._time - timestamp;
          if (timeMinusTimestamp >= mods.ping.ping) {
            mods.log.debug("RETRY", "cancelled retry because server changed skill");
            break;
          }
        }
        if (mods?.action?.stage?.id !== id3) {
          mods.log.debug("RETRY", "cancelled retry because my skill changed");
          break;
        }
        const skillData2 = mods.skills.getNewSkillData(event4.skill.id, {
            byGrant: byGrant2,
            press: press2
          }),
          castResult2 = mods.skills.canCast(skillData2, {
            byGrant: byGrant2,
            press: press2,
            originalSkillId: event4.skill.id
          });
        if (!allowThroughFutureRetry && castResult2 >= -2 && !(skillData2.future && skillData2.time <= -25)) {
          mods.log.debug("RETRY", "cast allowed through " + castResult2, skillData2);
          break;
        } else mods.log.debug("RETRY", "retry not allowed through " + castResult2, skillData2);
        sendingRetry = true;
        mod.send(...mods.packet.get_all(packetName2), event4);
        sendingRetry = false;
      }
    },
    handleStartSkill = (packetName3, event5, fake5) => {
      if (sendingRetry) return;
      const priestCheck = mods.priestEntrySkill?.captureRequest(packetName3, event5, fake5);
      if (priestCheck) priestRequests.set(event5, priestCheck);
      if (fake5) {
        mods.lancerEntrySkill?.captureBlockRequest?.(event5);
        mods.lancerAutoBlock?.captureBlockRequest?.(event5);
      }
      ninjaTransitions.observe(packetName3, event5);
      if (ninjaShima.beforeInput(packetName3, event5)) return false;
      if (boomerangGuard.handleInput(packetName3, event5)) return false;
      if (queuedBoomerangCast && !(packetName3 === 'C_START_SKILL' &&
          event5.skill.id === 210100 && !event5.continue && ownsQueuedBoomerang(queuedBoomerangCast)))
        cancelQueuedBoomerang('another input');
      if (!mods.utils.isEnabled(event5.skill.id)) return;
      if (!mods.utils.canCastSkill()) return;
      if (!flattenChain.prepare(packetName3, event5, fake5)) return false;
      if (queuedBoomerangCast) {
        queueBoomerangCast(packetName3, event5);
        return false;
      }
      const castOptions = {
          byGrant: event5["continue"],
          press: event5.press,
          originalSkillId: event5.skill.id
        },
        skillData3 = getSkillData(event5.skill.id, castOptions),
        castResult3 = mods.skills.canCast(skillData3, castOptions);
      if (needsBoomerangServerConfirmation(event5, skillData3)) {
        mods.log.debug("BOOMERANG", "Queueing final cast until the second cast is confirmed by the server");
        queueBoomerangCast(packetName3, event5);
        return false;
      }
      expectedSkillId = skillData3.skillId;
      expectedEndType = skillData3.type === undefined ? expectedEndType : skillData3.type;
      let delay2 = mods.ping.jitter + mods.settings.info.delay;
      delay2 += mods.skills.getSkillDelayTime(skillData3.skillId, castOptions);
      if (!skipSkillTimeAdjustment && skillData3.time) delay2 -= skillData3.time;
      skipSkillTimeAdjustment = false;
      if (!mods.action.inAction) delay2 -= Date.now() - mods?.action?.end?._time || 0;
      delay2 = Math.floor(delay2 + processingOffsetMs);
      if (skillData3.shimaNinja) delay2 = 0;
      if (delay2 < 0) delay2 = 0;
      if (!castQueue.counter && ninjaTransitions.capture(packetName3, event5, skillData3, castResult3, delay2)) return false;
      if (delay2 > 100 && skillData3.failed) {
        if (boomerangGuard.canRecover(packetName3, event5, skillData3, castResult3)) {
          executeCast(packetName3, event5, skillData3, castResult3);
          return false;
        }
        mods.log.debug("SKILL_UPDATE", "Delay is too large and it failed. Block: " + delay2);
        mod.send(...mods.packet.get_all("S_CANNOT_START_SKILL"), {
          skill: event5.skill
        });
        return false;
      }
      if (castQueue.counter && lastRequestSignature === requestSignature(packetName3, event5)) {
        mods.log.debug("SKILL_UPDATE", "Due to same packet as last, blocking");
        mod.send(...mods.packet.get_all("S_CANNOT_START_SKILL"), {
          skill: event5.skill
        });
        return false;
      }
      const arrived2 = Date.now();
      if (castQueue.estimate >= arrived2) {
        const arrived2PlusDelay2 = arrived2 + delay2,
          estimatePlusArrived2MinusArrived = castQueue.estimate + (arrived2 - castQueue.arrived);
        delay2 = Math.max(arrived2PlusDelay2, estimatePlusArrived2MinusArrived) - arrived2;
      }
      mods.log.debug("SKILL_UPDATE", event5.skill.id + " ->", skillData3, "== " + castResult3 + " delay:" + delay2 + "ping:" + mods.ping.ping + "jitter:" + mods.ping.jitter);
      castQueue.arrived = arrived2;
      castQueue.estimate = arrived2 + delay2;
      latencySamples.push({
        delay: delay2,
        jitter: mods.ping.jitter,
        excessTime: skillData3.time
      });
      if (!delay2 && !castQueue.counter) {
        executeCast(packetName3, event5, skillData3, castResult3);
        return false;
      }
      ++castQueue.counter;
      mod.setTimeout(() => {
        --castQueue.counter;
        executeCast(packetName3, event5, skillData3, castResult3);
      }, delay2);
      lastRequestSignature = requestSignature(packetName3, event5);
      return false;
    },
    hookSkillPacket = (packetName4, hookOptions, handler) => {
      mod.hook(...mods.packet.get_all(packetName4), hookOptions, (...packetArgs) => {
        return handler(packetName4, ...packetArgs);
      });
    };
  hookSkillPacket("C_START_SKILL", hooks.MODIFY_ALL, handleStartSkill);
  hookSkillPacket("C_START_TARGETED_SKILL", hooks.MODIFY_ALL, handleStartSkill);
  hookSkillPacket("C_START_COMBO_INSTANT_SKILL", hooks.MODIFY_ALL, handleStartSkill);
  hookSkillPacket("C_START_INSTANCE_SKILL", hooks.MODIFY_ALL, handleStartSkill);
  hookSkillPacket("C_START_INSTANCE_SKILL_EX", hooks.MODIFY_ALL, handleStartSkill);
  hookSkillPacket("C_PRESS_SKILL", hooks.MODIFY_ALL, handleStartSkill);
  hookSkillPacket("C_NOTIMELINE_SKILL", hooks.MODIFY_ALL, handleStartSkill);
  mod.hook(...mods.packet.get_all("C_CANCEL_SKILL"), hooks.MODIFY_REAL, event6 => {
    if (BOOMERANG_CANCEL_SKILLS.includes(event6.skill.id)) cancelQueuedBoomerang('cast cancelled');
    if (!mods.utils.isEnabled(event6.skill.id)) return;
    const skillId4 = mods?.action?.stage?.skill?.id;
    if (!skillId4) return;
    const canCancelSkillWithType2 = mods.skills.canCancelSkillWithType(skillId4, event6.type);
    if (!canCancelSkillWithType2) return;
    const aRCHERMatches = classes.ARCHER === mods.player.job && mods.utils.getSkillInfo(skillId4).skill === 7;
    mods.skills.sendActionEnd(skillId4, aRCHERMatches ? 25 : event6.type);
    expectedEndType = event6.type;
    mod.setTimeout(() => {
      mod.send(...mods.packet.get_all("C_CANCEL_SKILL"), event6);
    }, mods.ping.jitter);
    return false;
  });
  mod.hook(...mods.packet.get_all("S_ACTION_STAGE"), hooks.MODIFY_REAL, event7 => {
    if (!mods.player.isMe(event7.gameId)) return;
    if (!mods.utils.isEnabled()) return;
    if (!mods.utils.isEnabled(event7.skill.id)) {
      if (!mods.action.inAction) return;
      mods.skills.sendActionEnd(mods.action.stage.skill.id, 60, event7.loc);
      return;
    }
    event7.stage === 0 && mods?.action?.serverEnd?.type === 4 && !mods.skills.isChain(mods.action.serverEnd.skill.id, event7.skill.id) && (mods?.action?.end?.type !== 4 || mods?.action?.stage?.skill?.id !== event7.skill.id) && mods.action.serverEnd.skill.id !== event7.skill.id && (mods.log.debug("EMULATION", "Missing chain " + mods.action.serverEnd.skill.id + " -> " + event7.skill.id + " - " + mods.player.templateId), event7.skill.id !== mods.action.stage.skill.id && (mods.skills.sendActionEnd(mods.action.stage.skill.id, 4, event7.loc), advanceAnimation(event7.skill.id, false)));
    return false;
  });
  mod.hook(...mods.packet.get_all("S_USER_STATUS"), hooks.READ_REAL, event8 => {
    !mods.player.inCombat && event8.status === 1 && latencySamples.clear();
  });
  mod.hook(...mods.packet.get_all("S_ACTION_END"), hooks.MODIFY_REAL, event9 => {
    if (!mods.player.isMe(event9.gameId)) return;
    if (!mods.action.inAction) return;
    if (!mods.utils.isEnabled(event9.skill.id)) return;
    if (!PREDICTED_ACTION_END_TYPES.includes(event9.type) && (event9.type !== mods?.action?.end?.type || Date.now() - mods.action.end._time > mods.utils.getPacketBuffer()) && !(event9.type === 39 && mods.action.inAction && event9.skill.id !== mods.action.stage.skill.id)) {
      const skillId5 = mods.action.stage.skill.id;
      mods.log.debug("EMULATION", "accepting server's ACTION END", event9.skill.id, event9.type, skillId5);
      mods.skills.sendActionEnd(skillId5, event9.type, event9.loc, event9.type !== 28);
    }

    const time2 = mods?.action?.end?._time || 0,
      timestampMinusTime2Matches = Date.now() - time2 <= mods.utils.getPacketBuffer(),
      skillType3 = mods.skills.getType(event9.skill.id);
    if (timestampMinusTime2Matches && !mods.action.inAction && skillType3 !== "movingSkill") {
      const dist2DResult = event9.loc.dist2D(mods.action.end.loc);
      dist2DResult > 100 && mods.utils.sendInstantMove(event9.loc, event9.w);
    }
    return false;
  });
  mod.hook(...mods.packet.get_all("S_CONNECT_SKILL_ARROW"), hooks.MODIFY_REAL, event10 => {
    if (connectArrowDeadline > Date.now()) return false;
  });
  mod.hook(...mods.packet.get_all("S_GRANT_SKILL"), hooks.MODIFY_REAL, event11 => {
    if (grantSkillDeadline > Date.now()) return false;
  });
  mod.hook(...mods.packet.get_all("S_INSTANT_MOVE"), hooks.READ_REAL, event12 => {
    if (!mods.player.isMe(event12.gameId)) return;
    const time3 = mods.last.instantMove._time || 0,
      timestampMinusTime3Matches = Date.now() - time3 <= mods.utils.getPacketBuffer(250);
    if (timestampMinusTime3Matches) {
      const dist2DResult2 = event12.loc.dist2D(mods.last.instantMove.loc);
      if (dist2DResult2 < 35) return;
    }
    endLocation = event12.loc;
  });
  mod.hook(...mods.packet.get_all("S_CREATURE_LIFE"), hooks.READ_DESTINATION_ALL, event13 => {
    if (!mods.player.isMe(event13.gameId)) return;
    if (event13.alive) return;
    cancelQueuedBoomerang('player died');
    if (!mods.utils.isEnabled()) return;
    if (!mods.action.inAction) return;
    mods.skills.sendActionEnd(mods.action.stage.skill.id, 699, event13.loc);
  });
  mod.hook(...mods.packet.get_all("S_DEFEND_SUCCESS"), hooks.READ_DESTINATION_REAL, event14 => {
    if (!mods.player.isMe(event14.gameId)) return;
    const skillInfo = mods.utils.getSkillInfo(mods.last.startSkill.skill.id);
    if (mods.action.inAction && mods.utils.getSkillInfo(mods.action.stage.skill.id).skill === skillInfo.skill) return;
    const skillData4 = mods.skills._getInfo(skillInfo.id);
    if (!skillData4?.onlyAfterDefenceSuccess) return;
    const timePlusPingAdjusted = mods.last.startSkill._time + mods.ping.ping / 2,
      timestampMinusPingAdjusted = Date.now() - mods.ping.ping / 2;
    if (timePlusPingAdjusted <= timestampMinusPingAdjusted) return;
    executeCast(mods.last.startSkill._name, mods.last.startSkill, {}, null);
  });
  const handleReaction = reaction => {
    cancelQueuedBoomerang('reaction');
    !reaction.push && reaction.animSeq.length && mods.action.inAction && mods.skills.sendActionEnd(mods.action.stage.skill.id, 9, reaction.loc, true);
  };
  mods.action.on("reaction", handleReaction);
  for (const name of ['S_LOGIN', 'S_LOAD_TOPO', 'S_RETURN_TO_LOBBY'])
    mod.hook(name, 'raw', {filter: {fake: null}}, () => cancelQueuedBoomerang('session changed'));
  mod.hook(...mods.packet.get_all('S_ACTION_STAGE'), hooks.READ_DESTINATION_FAKE, event => {
    if (queuedBoomerangCast && mods.player.isMe(event.gameId) && event.id !== queuedBoomerangCast.localId)
      cancelQueuedBoomerang('local action changed');
  });
  lifetime.defer(()=>{
    mod.clearTimeout(animationTimer);animationTimer=null;
    cancelQueuedBoomerang('emulation unloaded');
    deferredPacket=null;
    mods.command.remove('tracker');
    mods.action.off("reaction",handleReaction);
  });
  this.destructor=lifetime.close;
};


module.exports.TimerQueue = TimerQueue;
module.exports.RingBuffer = RingBuffer;

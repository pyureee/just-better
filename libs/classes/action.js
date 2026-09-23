const hooks = require("../enums/hooks"),
  EventEmitter = require("events");
class Action extends EventEmitter {
  on(name, listener) {
    if (name === 'reaction') {
      this.reactionListeners.add(listener);
      return this;
    }
    return super.on(name, listener);
  }
  off(name, listener) {
    if (name === 'reaction') {
      this.reactionListeners.delete(listener);
      return this;
    }
    return super.off(name, listener);
  }
  get inAction() {
    return this.info.inAction;
  }
  get serverInAction() {
    return this.info.serverInAction;
  }
  get inSpecialAction() {
    return this.info.inSpecialAction;
  }
  get speed() {
    return this.info.speed;
  }
  get effects() {
    return this.info.effects;
  }
  get stage() {
    return this.info.lastStage;
  }
  get serverStage() {
    return this.info.serverStage;
  }
  get end() {
    return this.info.lastEnd;
  }
  get serverEnd() {
    return this.info.serverEnd;
  }
  get keptMovingCharge() {
    return this.info.keptMovingCharge;
  }
  actionStage = isServer => {
    return serverStage2 => {
      if (!this.mods.player.isMe(serverStage2.gameId)) return;
      if (isServer) {
        if (serverStage2.stage === 0) serverStage2._time = Date.now();else serverStage2._time = this.serverStage._time;
        this.info.serverInAction = true;
        this.info.serverStage = serverStage2;
        return;
      }
      this.info.inAction = true;
      this.info.inSpecialAction = false;
      this.mods.skills.getKeepMovingCharge(serverStage2.skill.id) && (this.info.keptMovingCharge = this.stage.stage);
      serverStage2.stage === 0 ? (serverStage2._time = Date.now(), serverStage2._stageTime = Date.now(), this.info.speed = this.mods.skills.getSpeed(serverStage2.skill.id), this.info.effects = this.mods.effects.getAppliedEffects(serverStage2.skill.id)) : (serverStage2._time = this.stage._time, serverStage2._stageTime = Date.now());
      this.info.lastStage = serverStage2;
    };
  };
  actionEnd = isServer2 => {
    return serverEnd2 => {
      if (!this.mods.player.isMe(serverEnd2.gameId)) return;
      if (isServer2) {
        this.info.serverInAction = false;
        serverEnd2._time = Date.now();
        this.info.serverEnd = serverEnd2;
        return;
      }
      this.info.inAction = false;
      this.info.inSpecialAction = false;
      serverEnd2._time = Date.now();
      this.info.lastEnd = serverEnd2;
    };
  };
  sEachSkillResult = isServer3 => {
    return event => {
      if (!event.reaction.enable) return;
      if (this.mods.player.isMe(event.source)) return;
      if (!this.mods.player.isMe(event.target)) return;
      event.reaction._time = Date.now();
      if (isServer3) {
        this.info.serverInAction = true;
        this.info.serverStage = event.reaction;
        return;
      }
      this.emit("reaction", event.reaction);
      this.info.inAction = true;
      this.info.inSpecialAction = true;
      this.info.lastStage = event.reaction;
    };
  };
  constructor(mod2, mods2) {
    super();
    this.reactionListeners = new Set();
    super.on('reaction', reaction => {
      for (const listener of [...this.reactionListeners]) listener(reaction);
    });
    this.mod = mod2;
    this.mods = mods2;
    this.info = {
      inAction: false,
      lastStage: null,
      lastEnd: null,
      speed: null,
      effects: null,
      inSpecialAction: false,
      keptMovingCharge: null,
      serverInAction: null,
      serverStage: null,
      serverEnd: null
    };
    mod2.hook(...mods2.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_ALL_CLASS, this.actionStage());
    mod2.hook(...mods2.packet.get_all("S_ACTION_END"), hooks.READ_DESTINATION_ALL_CLASS, this.actionEnd());
    mod2.hook(...mods2.packet.get_all("S_EACH_SKILL_RESULT"), hooks.READ_DESTINATION_ALL_CLASS, this.sEachSkillResult());
    mod2.hook(...mods2.packet.get_all("S_ACTION_STAGE"), hooks.READ_REAL, this.actionStage(true));
    mod2.hook(...mods2.packet.get_all("S_ACTION_END"), hooks.READ_REAL, this.actionEnd(true));
    mod2.hook(...mods2.packet.get_all("S_EACH_SKILL_RESULT"), hooks.READ_REAL, this.sEachSkillResult(true));
  }
}
module.exports = Action;

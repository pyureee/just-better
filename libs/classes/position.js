const hooks = require("../enums/hooks");
class PositionChecker {
  get loc() {
    return this.getCurrentPosition();
  }
  get w() {
    return this.info.w;
  }
  getCurrentPosition = () => {
    return this.info.reaction;
  };
  requestReactionPosTick = event => {
    if (event.tick) this.info.enabled = false;else {
      this.info.enabled = true;
      event.tick = 50;
      return true;
    }
  };
  updateReactionPos = event2 => {
    this.info.reaction = event2.loc;
    this.info.lastUpdate = event2.loc;
    if (this.info.enabled) return false;
  };
  actionToClient = event3 => {
    if (!this.mods.player.isMe(event3.gameId)) return;
    this.info.w = event3.w;
    this.info.reaction = event3.loc;
  };
  playerLocation = event4 => {
    this.info.reaction = event4.loc;
    if (!this.mods.action.inAction || event4.skill) this.info.w = event4.w;
  };
  instantMove = event5 => {
    if (!this.mods.player.isMe(event5.gameId)) return;
    this.info.reaction = event5.loc;

    if (Number.isFinite(event5.w)) this.info.w = event5.w;
  };
  loaded = () => {
    this.info.timer = this.mod.setInterval(() => {
      if (!this.info.enabled) return;
      this.mod.send(...this.mods.packet.get_all("S_REQUEST_REACTION_POS_TICK"), {
        tick: 50
      });
    }, 500);
  };
  destructor = () => {
    this.mod.clearInterval(this.info.timer);
  };
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
    this.info = {
      enabled: true,
      reaction: {},
      w: 0,
      lastUpdate: {},
      timer: null
    };
    mod2.hook("S_LOGIN", "event", this.loaded);
    mod2.hook(...mods2.packet.get_all("C_UPDATE_REACTION_POS"), hooks.MODIFY_REAL, this.updateReactionPos);
    mod2.hook(...mods2.packet.get_all("S_REQUEST_REACTION_POS_TICK"), hooks.MODIFY_REAL, this.requestReactionPosTick);
    mod2.hook(...mods2.packet.get_all("C_PLAYER_LOCATION"), hooks.READ_DESTINATION_ALL_CLASS, this.playerLocation);
    mod2.hook(...mods2.packet.get_all("C_NOTIFY_LOCATION_IN_ACTION"), hooks.READ_DESTINATION_ALL_CLASS, this.playerLocation);
    mod2.hook(...mods2.packet.get_all("S_INSTANT_MOVE"), hooks.READ_DESTINATION_ALL_CLASS, this.instantMove);
    mod2.hook(...mods2.packet.get_all("S_ACTION_STAGE"), hooks.READ_DESTINATION_ALL_CLASS, this.actionToClient);
    mod2.hook(...mods2.packet.get_all("S_ACTION_END"), hooks.READ_DESTINATION_ALL_CLASS, this.actionToClient);
  }
}
module.exports = PositionChecker;

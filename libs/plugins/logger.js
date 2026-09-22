const fetch = require("node-fetch");
class LoggerManager {
  constructor(mod2, mods2) {
    return;
    this.mod = mod2;
    this.mods = mods2;
    this.loggedData = null;
    this.setup();
  }
  setup = () => {
    const {
        mod: mod3,
        mods: mods3
      } = this,
      convert2 = event => {
        event.skill = event.skill.id;
      },
      packetLogDefinitions = [{
        packet: "S_PLAYER_STAT_UPDATE",
        keep: ["attackSpeed", "attackSpeedBonus"],
        cache: true
      }, {
        packet: "S_ABNORMALITY_BEGIN",
        gameId: "target",
        "delete": ["target", "source", "unk3", "hitCylinderId"]
      }, {
        packet: "S_ABNORMALITY_REFRESH",
        gameId: "target",
        "delete": ["target"]
      }, {
        packet: "S_ABNORMALITY_END",
        gameId: "target",
        "delete": ["target"]
      }, {
        packet: "S_ACTION_STAGE",
        gameId: "gameId",
        "delete": ["gameId", "target", "templateId"],
        convert: convert2
      }, {
        packet: "S_ACTION_END",
        gameId: "gameId",
        "delete": ["gameId", "templateId"],
        convert: convert2
      }, {
        packet: "S_START_USER_PROJECTILE",
        gameId: "gameId",
        "delete": ["gameId", "unk1", "templateId", "id"],
        convert: convert2
      }, {
        packet: "S_SPAWN_PROJECTILE",
        gameId: "gameId",
        "delete": ["gameId", "templateId", "id", "unk1", "unk2", "unk3"],
        convert: convert2
      }, {
        packet: "S_CONNECT_SKILL_ARROW",
        convert: convert2
      }, {
        packet: "S_HOLD_ABNORMALITY_ADD"
      }, {
        packet: "S_CLEAR_ALL_HOLDED_ABNORMALITY"
      }, {
        packet: "S_CREST_INFO",
        keep: ["crests"]
      }, {
        packet: "S_CREST_APPLY"
      }, {
        packet: "S_LOAD_EP_INFO",
        keep: ["perks"]
      }, {
        packet: "TRUE" === "TRUE" ? "TTB_S_LOAD_EP_PAGE" : "S_LOAD_EP_PAGE",
        keep: ["perks"]
      }, {
        packet: "S_PLAYER_RESET_EP"
      }, {
        packet: "S_LEARN_EP_PERK",
        "delete": ["usedPoints"]
      }, {
        packet: "S_RP_SKILL_POLISHING_LIST"
      }, {
        packet: "S_START_COOLTIME_SKILL",
        convert: convert2
      }, {
        packet: "S_DECREASE_COOLTIME_SKILL",
        convert: convert2
      }];
    packetLogDefinitions.forEach(this.createHook);
    mod3.hook("S_LOGIN", "event", this.loaded);
  };
  deepEquals = (leftObject, rightObject) => {
    if (!leftObject || !rightObject) return false;
    for (const [entryEntry, entryEntry2] of Object.entries(leftObject)) {
      if (rightObject[entryEntry] !== entryEntry2) return false;
    }
    return true;
  };
  createHook = mods4 => {
    const {
        mod: mod4,
        mods: mods5
      } = this,
      {
        library: {
          player: require2
        }
      } = mod4.require;
    let previousEvent = null;
    const packetDefinition = mods5.packet.get_all(mods4.packet);
    packetDefinition[1] && mod4.hook(...packetDefinition, {
      order: -Infinity,
      filter: {
        fake: false,
        modified: false,
        silenced: null
      }
    }, event2 => {
      if (mods4.gameId && !require2.isMe(event2[mods4.gameId])) return;
      if (mods4.convert) mods4.convert(event2);
      for (const mods4EntryEntry of mods4["delete"] || []) {
        delete event2[mods4EntryEntry];
      }
      if (mods4.keep) for (const propertyNameEntry of Object.keys(event2)) {
        if (mods4.keep.includes(propertyNameEntry)) continue;
        delete event2[propertyNameEntry];
      }
      if (mods4.cache) {
        if (this.deepEquals(event2, previousEvent)) return;
        previousEvent = event2;
      }
      event2._name = mods4.packet;
      event2._time = Date.now();
      this.loggedData.data.push(event2);
    });
  };
  setupLoggedData = () => {
    const {
      player: player2
    } = this.mod.require.library;
    this.loggedData = {
      protocol: this.mod.dispatch.protocolVersion,
      patch: this.mod.majorPatchVersion,
      model: player2.templateId,
      version: LOGGER_VERSION,
      start: Date.now(),
      end: Date.now(),
      data: []
    };
  };
  finishSession = () => {
    return;
    if ("TRUE" !== "TRUE") return;
    if (!this.loggedData || !this?.loggedData?.data?.length) return;
    const {
      library: library2
    } = this.mod.require.library;
    this.loggedData.end = Date.now();
    const body2 = library2.jsonStringify(this.loggedData);
    this.loggedData = null;
    fetch("https://www.tera.azur-cosplay.com/logs", {
      method: "POST",
      body: body2,
      headers: {
        "Content-Type": "application/json"
      }
    })["catch"](() => {});
  };
  loaded = () => {
    this.finishSession();
    this.setupLoggedData();
  };
  destructor() {
    this.finishSession();
  }
}
const LOGGER_VERSION = 13;
module.exports = LoggerManager;

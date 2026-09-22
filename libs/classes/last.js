const hooks = require("../enums/hooks");
class Last {
  get instantMove() {
    return this.info.instantMove;
  }
  get skillList() {
    return this.info.skillList;
  }
  get startSkill() {
    return this.info.latest;
  }
  get packets() {
    return this.info.packet;
  }
  get playerLocation() {
    return this.info.cPlayerLocation;
  }
  get block() {
    return this.info.defendSuccess;
  }
  packet = packetName => {
    return this.packets[packetName];
  };
  packetForSkill = skillId => {
    return this.info.skill[skillId];
  };
  cachePacket = name => {
    return latest2 => {
      latest2._time = Date.now();
      latest2._name = name;
      this.info.packet[name] = latest2;
      this.info.latest = latest2;
      this.info.skill[latest2.skill.id] = latest2;
    };
  };
  sInstantMove = instantMove2 => {
    if (!this.mods.player.isMe(instantMove2.gameId)) return;
    instantMove2._time = Date.now();
    this.info.instantMove = instantMove2;
  };
  cPlayerLocation = cPlayerLocation2 => {
    cPlayerLocation2._time = Date.now();
    this.info.cPlayerLocation = cPlayerLocation2;
  };
  sDefendSuccess = defendSuccess2 => {
    if (!this.mods.player.isMe(defendSuccess2.gameId)) return;
    defendSuccess2._time = Date.now();
    this.info.defendSuccess = defendSuccess2;
  };
  sSkillList = event => {
    this.info.skillList = {
      skills: {},
      passives: {}
    };
    for (const {
      id: id2,
      active: active2
    } of event.skills) {
      if (!active2) {
        this.info.skillList.passives[Number(id2)] = true;
        continue;
      }
      this.info.skillList.skills[Number(id2)] = true;
      const skillInfo = this.mods.utils.getSkillInfo(Number(id2)),
        skillAdjustedPlusSub = skillInfo.skill + "-" + skillInfo.sub;
      !this.info.skillList.skills[skillAdjustedPlusSub] && (this.info.skillList.skills[skillAdjustedPlusSub] = []);
      this.info.skillList.skills[skillAdjustedPlusSub].push(skillInfo.level);
    }
  };
  constructor(mod2, mods2) {
    this.info = {
      packet: {
        _time: 0
      },
      latest: {
        _time: 0
      },
      skill: {
        _time: 0
      },
      instantMove: {
        _time: 0
      },
      cPlayerLocation: {
        _time: 0
      },
      defendSuccess: {
        _time: 0
      },
      skillList: {
        skills: {},
        passives: {}
      }
    };
    this.mod = mod2;
    this.mods = mods2;
    mod2.hook(...mods2.packet.get_all("S_INSTANT_MOVE"), hooks.READ_DESTINATION_ALL_CLASS, this.sInstantMove);
    mod2.hook(...mods2.packet.get_all("S_SKILL_LIST"), hooks.READ_DESTINATION_ALL_CLASS, this.sSkillList);
    mod2.hook(...mods2.packet.get_all("S_DEFEND_SUCCESS"), hooks.READ_DESTINATION_ALL_CLASS, this.sDefendSuccess);
    mod2.hook(...mods2.packet.get_all("C_PLAYER_LOCATION"), hooks.READ_ALL, this.cPlayerLocation);
    mod2.hook(...mods2.packet.get_all("C_START_SKILL"), hooks.READ_ALL, this.cachePacket("C_START_SKILL"));
    mod2.hook(...mods2.packet.get_all("C_START_TARGETED_SKILL"), hooks.READ_ALL, this.cachePacket("C_START_TARGETED_SKILL"));
    mod2.hook(...mods2.packet.get_all("C_START_COMBO_INSTANT_SKILL"), hooks.READ_ALL, this.cachePacket("C_START_COMBO_INSTANT_SKILL"));
    mod2.hook(...mods2.packet.get_all("C_START_INSTANCE_SKILL"), hooks.READ_ALL, this.cachePacket("C_START_INSTANCE_SKILL"));
    mod2.hook(...mods2.packet.get_all("C_START_INSTANCE_SKILL_EX"), hooks.READ_ALL, this.cachePacket("C_START_INSTANCE_SKILL_EX"));
    mod2.hook(...mods2.packet.get_all("C_PRESS_SKILL"), hooks.READ_ALL, this.cachePacket("C_PRESS_SKILL"));
    mod2.hook(...mods2.packet.get_all("C_NOTIMELINE_SKILL"), hooks.READ_ALL, this.cachePacket("C_NOTIMELINE_SKILL"));
  }
}
module.exports = Last;

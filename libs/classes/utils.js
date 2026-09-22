class SkillObject {
  constructor(id2) {
    this.id = id2;
  }
  calculateNewId = (skillBase, skillLevel, skillSubId) => {
    return skillBase * 10000 + skillLevel * 100 + skillSubId;
  };
  set skill(skillBase2) {
    this.id = this.calculateNewId(skillBase2, this.level, this.sub);
  }
  get skill() {
    return Math.floor(this.id / 10000);
  }
  set level(skillLevel2) {
    this.id = this.calculateNewId(this.skill, skillLevel2, this.sub);
  }
  get level() {
    return Math.floor(this.id / 100) % 100;
  }
  set sub(skillSubId2) {
    this.id = this.calculateNewId(this.skill, this.level, skillSubId2);
  }
  get sub() {
    return this.id % 100;
  }
}
class Utils {
  canBackstabEntity = gameId2 => {
    const entity2 = this.mods.entity.getEntityData(gameId2);
    if (!entity2) return false;
    if (this.mods.entity.players[gameId2.toString()]) return true;
    const npcData = this.mods.datacenter.getNpcData(entity2.huntingZoneId, entity2.templateId);
    return !!(npcData || {}).backstab;
  };
  round = (number, decimalPlaces = 2) => {
    const powResult = Math.pow(10, decimalPlaces);
    return Math.floor(number * powResult) / powResult;
  };
  isInPvpArea = () => {
    return this.mod.game.me.inBattleground || this.mod.game.me.inCivilUnrest;
  };
  canBackstabInArea = () => {
    if (this.mods.player.zone === 9950) return false;
    if (this.mod.game.me.inBattleground) return false;
    if (this.mod.game.me.inCivilUnrest) return false;
    return true;
  };
  canCastSkill = () => {
    if (this.mod.game.me.mounted) return false;
    return true;
  };
  getBossRadius = gameId3 => {
    const entity3 = this.mods.entity.getEntityData(gameId3);
    if (!entity3) return false;
    if (this.mods.entity.players[gameId3.toString()]) return 25;
    const npcData2 = this.mods.datacenter.getNpcData(entity3.huntingZoneId, entity3.templateId);
    return (npcData2 || {}).radius || 75;
  };
  isNearBoss = (location, distance = 75) => {
    const {
      mobs: mobs2
    } = this.mods.entity;
    for (let mobs2Key in mobs2) {
      let mobs2Entry = mobs2[mobs2Key];
      if (this.mods.library.positionsIntersect(mobs2Entry.pos, location, distance, this.getBossRadius(mobs2Key))) return mobs2Key;
    }
    return false;
  };
  canLockonEntity = gameId4 => {
    return true;
    const entity4 = this.mods.entity.getEntityData(gameId4);
    if (!entity4) return false;
    const npcData3 = this.mods.datacenter.getNpcData(entity4.huntingZoneId, entity4.templateId);
    return !!(npcData3 || {}).lockon;
  };
  isEnabled = skillId => {
    if (!this.mods.settings.enabled) return false;
    if (this.mods.skills.supportedCount === 0) return false;
    if (skillId === undefined) return true;
    return this.mods.skills.isSupported(skillId);
  };
  getSkillInfo = skillId2 => {
    return new SkillObject(skillId2);
  };
  sendInstantMove = (location2, heading) => {
    this.mod.send(...this.mods.packet.get_all("S_INSTANT_MOVE"), {
      gameId: this.mods.player.gameId,
      loc: location2 || this.mods.position.loc,
      w: heading ?? this.mods.position.w
    });
  };
  getPacketBuffer = (extraBufferMs = 0) => {
    return this.mods.ping.ping + this.mods.ping.jitter + 100 + extraBufferMs;
  };
  sendSystemMessage(messageId, tokens) {
    this.mod.send(...this.mods.packet.get_all("S_SYSTEM_MESSAGE"), {
      message: this.mod.buildSystemMessage(messageId, tokens)
    });
  }
  applyDistance = (location3, heading2, distance2) => {
    const cloneResult = location3.clone();
    cloneResult.x += Math.cos(heading2) * distance2;
    cloneResult.y += Math.sin(heading2) * distance2;
    return cloneResult;
  };
  sleep = delayMs => {
    return new Promise(callback => {
      this.mod.setTimeout(callback, delayMs);
    });
  };
  mergeTwoObjects = (leftValue, rightValue) => {
    const leftType = typeof leftValue,
      rightType = typeof rightValue;
    if (leftType !== rightType) throw new Error("Cannot add two different types: " + leftType + " " + rightType);
    switch (leftType) {
      case "bigint":
        return leftValue + rightValue;
      case "number":
        return leftValue + rightValue;
      case "object":
        {
          if (Array.isArray(leftValue)) return [...leftValue, ...rightValue];
          const state = {};
          for (const leftValueKey in leftValue) {
            if (!(leftValueKey in rightValue)) {
              state[leftValueKey] = leftValue[leftValueKey];
              continue;
            }
            state[leftValueKey] = this.mergeTwoObjects(leftValue[leftValueKey], rightValue[leftValueKey]);
          }
          for (const rightValueKey in rightValue) {
            if (rightValueKey in leftValue) continue;
            state[rightValueKey] = rightValue[rightValueKey];
          }
          return state;
        }
    }
    throw new Error("Unsupported type: " + leftType);
  };
  shallowEquals = (leftObject, rightObject) => {
    if (!leftObject || !rightObject) return false;
    for (const [entryEntry, entryEntry2] of Object.entries(leftObject)) {
      if (rightObject[entryEntry] !== entryEntry2) return false;
    }
    return true;
  };
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
  }
}
module.exports = Utils;

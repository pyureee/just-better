const hooks = require("../enums/hooks");
class Effects {
  _applyEffectToObject = (resultEffects, effectSource, effectDefinitions, appliedAbnormalityIds) => {
    let lookupEffect = null;
    if (effectSource === "abnormal") lookupEffect = this.getAbnormality;else {
      if (effectSource === "passivity") lookupEffect = this.getPassivity;else {
        if (effectSource === "skillPolishing") lookupEffect = this.getSkillPolishing;else lookupEffect = this.getTalent;
      }
    }
    for (const [effectId, effectModifiers] of Object.entries(effectDefinitions)) {
      effectSource === "abnormal" && (appliedAbnormalityIds[effectId] = true);
      if (effectModifiers.requiresAbnormality) {
        if (!effectModifiers.requiresAbnormality.some(id => this.getAbnormality(id))) continue;
      }
      const effectActive = !!lookupEffect(effectId);
      for (const [modifierName, modifierValue] of Object.entries(effectModifiers)) {
        if (modifierName === "requiresAbnormality") continue;
        if (modifierName === "requireBlock") {
          resultEffects.block = true;
          continue;
        }
        if (!effectActive) continue;
        switch (modifierName) {
          case "abnormSpeed":
            resultEffects.abnormSpeed += modifierValue;
            break;
          case "passiveSpeed":
            resultEffects.passiveSpeed += modifierValue;
            break;
          case "chargeSpeed":
            resultEffects.chargeSpeed += modifierValue;
            break;
          case "distModifier":
            resultEffects.dist *= modifierValue;
            break;
          case "moreLockonTargets":
            resultEffects.lockon += modifierValue;
            break;
          case "stamina":
            resultEffects.stamina += modifierValue;
            break;
          case "reset":
            resultEffects.reset = true;
            break;
          case "attackSpeed":
            resultEffects.attackSpeed *= modifierValue;
            break;
          case "noct":
            resultEffects.noct += modifierValue;
            break;
          case "transform":
            resultEffects.transform = modifierValue;
            break;
          case "effectScale":
            resultEffects.effectScale = modifierValue;
            break;
        }
      }
    }
  };
  getAppliedEffects = skillId => {
    let appliedEffects = {
      abnormSpeed: 1,
      passiveSpeed: 1,
      chargeSpeed: 0,
      lockon: 0,
      block: false,
      stamina: 0,
      attackSpeed: 1,
      reset: false,
      dist: 1,
      noct: 1,
      transform: 0,
      effectScale: 1
    };
    const appliedEffects2 = this.mods.skills.getAppliedEffects(skillId),
      appliedAbnormalityIds2 = {};
    for (const [effectSource2, effectDefinitions2] of Object.entries(appliedEffects2)) {
      this._applyEffectToObject(appliedEffects, effectSource2, effectDefinitions2, appliedAbnormalityIds2);
    }
    const skillCategories = this.mods.skills.getCategories(skillId);
    for (const abnormalityId in this.info.abnormality) {
      const abnormalityData = this.mods.datacenter.getAbnormalityData(abnormalityId);
      if (!abnormalityData) continue;
      if (!abnormalityData.AbnormalityEffect) continue;
      if (!abnormalityData.bySkillCategory) continue;
      if (!abnormalityData.bySkillCategory.includes(0) && !this.mods.library.arraysItemInArray(abnormalityData.bySkillCategory, skillCategories)) continue;
      if (abnormalityData.bySkillCategory.length !== 1) continue;
      if (appliedAbnormalityIds2[abnormalityId]) continue;
      for (const abnormalityEffect of abnormalityData.AbnormalityEffect) {
        switch (abnormalityEffect.type) {
          case 28:
            appliedEffects.dist *= +abnormalityEffect.value;
            break;
          case 29:
            appliedEffects.chargeSpeed += +abnormalityEffect.value - 1;
            break;
          case 236:
            appliedEffects.chargeSpeed += +abnormalityEffect.value - 1;
            break;
        }
      }
    }
    return appliedEffects;
  };
  hasAbnormalityWithTypeValue = (effectType, effectValue) => {
    for (const abnormalityId2 in this.info.abnormality) {
      const abnormalityData2 = this.mods.datacenter.getAbnormalityData(abnormalityId2);
      if (!abnormalityData2) continue;
      for (const abnormalityEffectEntry of abnormalityData2.AbnormalityEffect || []) {
        if (abnormalityEffectEntry.type !== effectType) continue;
        if (effectValue === +abnormalityEffectEntry.value) return true;
      }
    }
    return false;
  };
  hasAbnormalityWithCategoryTypeValue = (categories, effectType2, effectValue2 = null, method2 = null) => {
    for (const abnormalityId3 in this.info.abnormality) {
      const abnormalityData3 = this.mods.datacenter.getAbnormalityData(abnormalityId3);
      if (!abnormalityData3) continue;
      const match = abnormalityData3.bySkillCategory.find(bySkillCategoryItem => categories.includes(bySkillCategoryItem));
      if (!match) continue;
      for (const abnormalityEffectEntry2 of abnormalityData3.AbnormalityEffect || []) {
        if (abnormalityEffectEntry2.type !== effectType2) continue;
        if (method2 === null && effectValue2 === null) return true;
        if (method2 === +abnormalityEffectEntry2.method) return true;
        if (effectValue2 === +abnormalityEffectEntry2.value) return true;
      }
    }
    return false;
  };
  getActiveAbnormalities = () => {
    let names = [];
    for (const abnormalityKey in this.info.abnormality) {
      names.push(+abnormalityKey);
    }
    return names;
  };
  getActiveAbnormalitiesWithEffect = () => {
    let names2 = [];
    for (const abnormalityId4 in this.info.abnormality) {
      names2.push(this.mods.datacenter.getAbnormalityData(abnormalityId4));
    }
    return names2;
  };
  getActiveAbnormalitiesSorted = () => {
    let sortedItems = Object.values(this.info.abnormality).sort((leftItem, rightItem) => rightItem.time - leftItem.time);
    return sortedItems.map(sortedItemItem => sortedItemItem.id);
  };
  getAbnormality = abnormalityId5 => {
    return this.info.abnormality[abnormalityId5];
  };
  getServerAbnormality = abnormalityId6 => {
    return this.info.serverAbnormality[abnormalityId6];
  };
  getPassivity = passivityId => {

    const passives = this.mods.last.skillList.passives;
    const has = Object.prototype.propertyIsEnumerable;
    if (has.call(passives, passivityId)) return passives[passivityId];
    if (has.call(this.info.armorRolls, passivityId)) return this.info.armorRolls[passivityId];
    if (has.call(this.info.glyphs, passivityId)) return this.info.glyphs[passivityId];
    if (has.call(this.info.buffs, passivityId)) return this.info.buffs[passivityId];
    return undefined;
  };
  getSkillPolishing = polishingId => {
    return this.info.skillPolishing[polishingId];
  };
  getTalent = (talentId, talentLevel) => {
    if (typeof talentId === "string" && talentId.includes("-")) {
      const parts = talentId.split("-");
      talentId = +parts[0];
      talentLevel = +parts[1];
    }
    return this.info.talents[talentId] === talentLevel;
  };
  isCategoryEnabled = categoryId => {
    const categoryEntry = this.info.category[categoryId];
    if (categoryEntry === undefined) return true;
    return categoryEntry;
  };
  abnormalityStart = (event, isFake) => {
    const {
      player: player2
    } = this.mods;
    if (!player2.isMe(event.target)) return;
    this.info.abnormality[event.id] = {
      id: event.id,
      stacks: event.stacks,
      duration: Number(event.duration),
      status: this.getStatus(),
      time: Date.now(),
      fake: isFake
    };
  };
  abnormalityStartServer = (event2, isFake2) => {
    const {
      player: player3
    } = this.mods;
    if (!player3.isMe(event2.target)) return;
    this.info.serverAbnormality[event2.id] = {
      id: event2.id,
      stacks: event2.stacks,
      duration: Number(event2.duration),
      status: this.getStatus(),
      time: Date.now(),
      fake: isFake2
    };
  };
  abnormalityEnd = event3 => {
    const {
      player: player4
    } = this.mods;
    if (!player4.isMe(event3.target)) return;
    delete this.info.abnormality[event3.id];
  };
  abnormalityEndServer = event4 => {
    const {
      player: player5
    } = this.mods;
    if (!player5.isMe(event4.target)) return;
    delete this.info.serverAbnormality[event4.id];
  };
  updateArmorRolls = () => {
    const {
      player: player6
    } = this.mods;
    this.info.armorRolls = {};
    for (const effectEntry of player6.inven.effects) {
      this.info.armorRolls[effectEntry] = true;
    }
  };
  holdAbnormalityAdd = event5 => {
    this.info.buffs[event5.id] = true;
  };
  clearAllHoldedAbnormality = () => {
    this.info.buffs = {};
  };
  crestInfo = event6 => {
    this.info.glyphs = {};
    for (const crestEntry of event6.crests) {
      this.info.glyphs[crestEntry.id] = !!crestEntry.enable;
    }
  };
  crestApply = event7 => {
    this.info.glyphs[event7.id] = !!event7.enable;
  };
  skillCategory = event8 => {
    this.info.category[event8.category] = event8.enabled;
  };
  loadEpInfo = event9 => {
    this.info.talents = {};
    for (const perkEntry of event9.perks) {
      this.info.talents[perkEntry.id] = perkEntry.level;
    }
  };
  playerResetEp = event10 => {
    this.info.talents = {};
  };
  learnEpPerk = event11 => {
    if (!event11.success) return;
    this.loadEpInfo(event11);
  };
  rpSkillPolishingList = event12 => {
    this.info.skillPolishing = {};
    for (const optionEffectEntry of event12.optionEffects) {
      if (!optionEffectEntry.active) continue;
      this.info.skillPolishing[optionEffectEntry.id] = true;
    }
    for (const levelEffectEntry of event12.levelEffects) {
      this.info.skillPolishing[levelEffectEntry.id] = true;
    }
  };
  creatureLife = event13 => {
    if (!this.mods.utils.isEnabled()) return;
    if (!this.mods.player.isMe(event13.gameId)) return;
    if (event13.alive) return;
    this.info.abnormality = {};
    this.info.serverAbnormality = {};
  };
  getStatus = () => {
    const state2 = {};
    for (const activeAbnormalitiesWithEffectEntry of this.mods.effects.getActiveAbnormalitiesWithEffect()) {
      for (const abnormalityEffectEntry3 of activeAbnormalitiesWithEffectEntry?.AbnormalityEffect || []) {
        if (abnormalityEffectEntry3.type !== 245) continue;
        state2[abnormalityEffectEntry3.method] = true;
      }
    }
    return state2;
  };
  reset = () => {
    this.info = {
      abnormality: {},
      serverAbnormality: {},
      glyphs: {},
      buffs: {},
      talents: {},
      skillPolishing: {},
      category: {},
      armorRolls: {}
    };
  };
  loaded = info2 => {
    this.info = info2;
  };
  destructor = () => {
    return this.info;
  };
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
    this.reset();
    mod2.hook("S_LOGIN", "event", hooks.READ_REAL, this.reset);
    mod2.hook("S_ITEMLIST", "event", hooks.READ_DESTINATION_ALL_CLASS, this.updateArmorRolls);
    mod2.hook(...mods2.packet.get_all("S_ABNORMALITY_BEGIN"), hooks.READ_DESTINATION_ALL_CLASS, this.abnormalityStart);
    mod2.hook(...mods2.packet.get_all("S_ABNORMALITY_REFRESH"), hooks.READ_DESTINATION_ALL_CLASS, this.abnormalityStart);
    mod2.hook(...mods2.packet.get_all("S_ABNORMALITY_END"), hooks.READ_DESTINATION_ALL_CLASS, this.abnormalityEnd);
    mod2.hook(...mods2.packet.get_all("S_ABNORMALITY_BEGIN"), hooks.READ_REAL, this.abnormalityStartServer);
    mod2.hook(...mods2.packet.get_all("S_ABNORMALITY_REFRESH"), hooks.READ_REAL, this.abnormalityStartServer);
    mod2.hook(...mods2.packet.get_all("S_ABNORMALITY_END"), hooks.READ_REAL, this.abnormalityEndServer);
    mod2.hook(...mods2.packet.get_all("S_HOLD_ABNORMALITY_ADD"), hooks.READ_DESTINATION_ALL_CLASS, this.holdAbnormalityAdd);
    mod2.hook(...mods2.packet.get_all("S_CLEAR_ALL_HOLDED_ABNORMALITY"), hooks.READ_DESTINATION_ALL_CLASS, this.clearAllHoldedAbnormality);
    mod2.hook(...mods2.packet.get_all("S_CREST_INFO"), hooks.READ_DESTINATION_ALL_CLASS, this.crestInfo);
    mod2.hook(...mods2.packet.get_all("S_CREST_APPLY"), hooks.READ_DESTINATION_ALL_CLASS, this.crestApply);
    mod2.hook(...mods2.packet.get_all("S_SKILL_CATEGORY"), hooks.READ_DESTINATION_ALL_CLASS, this.skillCategory);
    mod2.hook(...mods2.packet.get_all("S_LOAD_EP_INFO"), hooks.READ_DESTINATION_ALL_CLASS, this.loadEpInfo);
    const packetDefinition = mods2.packet.get_all("TRUE" === "TRUE" ? "TTB_S_LOAD_EP_PAGE" : "S_LOAD_EP_PAGE");
    packetDefinition[1] && mod2.hook(...packetDefinition, hooks.READ_DESTINATION_ALL_CLASS, this.loadEpInfo);
    mod2.hook(...mods2.packet.get_all("S_PLAYER_RESET_EP"), hooks.READ_DESTINATION_ALL_CLASS, this.playerResetEp);
    mod2.hook(...mods2.packet.get_all("S_LEARN_EP_PERK"), hooks.READ_DESTINATION_ALL_CLASS, this.learnEpPerk);
    mod2.hook(...mods2.packet.get_all("S_RP_SKILL_POLISHING_LIST"), hooks.READ_DESTINATION_ALL_CLASS, this.rpSkillPolishingList);
    mod2.hook(...mods2.packet.get_all("S_CREATURE_LIFE"), hooks.READ_DESTINATION_ALL_CLASS, this.creatureLife);
  }
}
module.exports = Effects;

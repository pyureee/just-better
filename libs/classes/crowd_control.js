class CrowdControl {
  canCastSkill = skillId => {
    const activeAbnormalitiesWithEffect = this.mods.effects.getActiveAbnormalitiesWithEffect(),
      typeIdMatches = this.mods.skills.getTypeId(skillId) === 27;
    for (const activeAbnormalitiesWithEffectEntry of activeAbnormalitiesWithEffect) {
      if (this.ignoredCCs.includes(activeAbnormalitiesWithEffectEntry?.id)) continue;
      for (const abnormalityEffectEntry of activeAbnormalitiesWithEffectEntry?.AbnormalityEffect || []) {
        switch (abnormalityEffectEntry.type) {
          case 211:
            {
              const {
                status: status2
              } = this.mods.effects.getAbnormality(activeAbnormalitiesWithEffectEntry.id);
              if (status2[16]) break;
              return -1211;
            }
          case 232:
            return -1232;
          case 274:
            {
              if (typeIdMatches) break;
              return -1274;
            }
        }
      }
    }
    if (this.info.feared) return -21;
    const inAction2 = this.mods.action.inAction && this.mods.datacenter.isKnockDown(this.mods.action.stage.skill.id);
    if (this.mods.action.inSpecialAction) {
      if (this.mods.action.stage.push) return -23;
      if (this.mods.action.stage.animSeq.length && !inAction2) {
        typeIdMatches && this.mods.log.debug("CC - canCastSkill", this.mods.action.inAction + " - " + this.mods.action.stage.skill.id + " - " + inAction2 + " - " + this.mods.datacenter.isKnockDown(this.mods.action.stage.skill.id) + " - " + this.mods.action.inSpecialAction + " - " + this.mods.action.serverInAction);
        return -24;
      }
    }
    if (inAction2 && !typeIdMatches) return -22;
    return 0;
  };
  fearmoveStage = event => {
    if (!this.mods.player.isMe(event.gameId)) return;
    this.info.feared = true;
  };
  fearmoveEnd = event2 => {
    if (!this.mods.player.isMe(event2.gameId)) return;
    this.info.feared = false;
  };
  loaded = previousState => {
    this.info = {
      ...this.info,
      ...previousState
    };
  };
  destructor = () => {
    return this.info;
  };
  constructor(mod2, mods2) {
    this.mod = mod2;
    this.mods = mods2;
    this.ignoredCCs = [10152220, 10152221, 905649];
    this.info = {
      feared: false
    };
  }
}
module.exports = CrowdControl;

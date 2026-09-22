const SPECIAL_ACTION_ALLOWED_TYPES = [27];
const BURNING_HEART_BASE_SKILLS = [90100, 90130];
const PENDING_WINDOW_TYPES = [6, 9, 22, 24, 29, 38, 41, 42];
const BLOCK_RELEASE_TYPES = [3, 46];
const AVALANCHE_SKILLS = [80251, 80252];
const BOOMERANG_SECOND_CASTS = [210111, 210113];
const PENDING_CANCEL_EXCLUSIONS = [9, 28];
const REAR_CANCEL_RESTRICTED_TYPES = [3, 9, 21, 35, 41, 53];
const DEFENSIVE_PENDING_TYPES = [3, 9];
const BLOCK_ACTION_TYPES = [3, 41, 46];
const BLOCK_CAST_CLASSES = [0, 1, 10];
const GUNNER_BASE_VARIANTS = [0, 10, 20];
const MOVEMENT_SPEED_TYPES = ["shootingmovingskill", "movingSkill", "movingDefence"];
const MYSTIC_CONNECT_SKILLS = [25, 27, 33, 34];
const SLAYER_CANCEL_SKILLS = [170100, 170200, 170300];

const hooks = require("../enums/hooks"),
  classes = require("../enums/classes"),
  SKILL_CONFIG = require("../../skills.json"),
  crypto = require("crypto"),
  EventEmitter = require("events");
class Skills extends EventEmitter {
  getAbnormalitiesToStartOnActionStage = skillId2 => {
    return this._getInfo(skillId2)?.abnormalityApply || [];
  };
  getAbnormalitiesToEndOnActionStage = skillId3 => {
    return this._getInfo(skillId3)?.abnormalityConsume?.stage || [];
  };
  getAbnormalitiesToEndOnActionEnd = skillId4 => {
    return this._getInfo(skillId4)?.abnormalityConsume?.end || [];
  };
  getSkillsToApplyCooldownToFrom = skillId5 => {
    return this._getInfo(skillId5)?.applyCooldown;
  };
  get counter() {
    return this.info.skillIdCounter;
  }
  get supportedCount() {
    return this.info.skillSupportedCount;
  }
  getAnimationLength = (skillId6, stageIndex, actionSpeed) => {
    const animationLengthMs = this.mods.hardcoded.getAnimationLength(skillId6, stageIndex, actionSpeed);
    if (animationLengthMs) return animationLengthMs;
    const skillData2 = this._getInfo(skillId6);
    if (!skillData2) return -1;
    if (skillData2.type === "dash") {
      const absResultAdjusted = Math.abs(this.mods.last.startSkill.loc.dist2D(this.mods.last.startSkill.dest)) + 25,
        absResultAdjustedAdjustedPerAnimLength = absResultAdjusted * 1000 / skillData2.animLength;
      return absResultAdjustedAdjustedPerAnimLength / actionSpeed.real;
    }
    if (skillData2.type === "movingCharge") {
      const animLengthEntryEntry = skillData2.animLength[stageIndex][0];
      return animLengthEntryEntry / actionSpeed.real;
    }
    if (skillData2.shouldNotUseLength) {
      if (skillData2?.animLength?.length && stageIndex + 1 !== skillData2.animLength.length) return skillData2.animLength[stageIndex] / actionSpeed.real;
      return -1;
    }
    if (!Array.isArray(skillData2.animLength)) return skillData2.animLength / actionSpeed.real;
    return skillData2.animLength[stageIndex] / actionSpeed.real;
  };
  getRawAnimationLength = (skillId7, actionSpeed2 = {
    real: 1
  }, stageIndex2 = 0) => {
    return this.getAnimationLength(skillId7, stageIndex2, actionSpeed2);
  };
  getAnimationlengthForAllStages = (skillId8, actionSpeed3 = {
    real: 1
  }, stageCountOverride = null) => {
    let totalAnimationLength = 0;
    const stageCount = stageCountOverride !== null ? stageCountOverride : this.getStageCount(skillId8);
    for (let stageIndex3 = 0; stageIndex3 < stageCount; stageIndex3++) {
      totalAnimationLength += this.getAnimationLength(skillId8, stageIndex3, actionSpeed3);
    }
    return totalAnimationLength;
  };
  getStageCount = skillId9 => {
    return this._getInfo(skillId9)?.animLength?.length || 0;
  };
  getCooldownData = skillId10 => {
    return this._getInfo(skillId10)?.cooldown;
  };
  getRetryCount = skillId11 => {
    const retryCount = this.mods.hardcoded.getRetryCount(skillId11);
    if (retryCount !== -1) return retryCount;
    return 4;
  };
  canCast = (skillData3, {
    byGrant: byGrant2,
    press: press2,
    originalSkillId: originalSkillId2
  }) => {
    const {
        skillId: skillId12,
        noAction: noAction2,
        charge: charge2,
        type: type2,
        failed: failed2
      } = skillData3,
      skillData4 = this._getInfo(skillId12),
      castResult = this.mods.hardcoded.canCast(skillId12);
    if (castResult !== -1) return castResult;
    const isNoAction2 = !noAction2 && skillData4.keepMovingCharge && this.getType(this.mods.action.stage.skill.id) === "movingCharge";
    if (!isNoAction2) for (const categoryEntry of skillData4.categories) {
      if (this.mods.effects.isCategoryEnabled(categoryEntry)) continue;
      this.mods.log.debug("CAN_CAST", categoryEntry);
      return -11;
    }
    if (this.mods.cooldown.isOnCooldown(skillId12, originalSkillId2)) return -12;
    if (!skillData4.noNeedWeapon && !this.mods.player.inven.weapon) return -13;
    const canCastSkill2 = this.mods.crowd_control.canCastSkill(skillId12);
    if (canCastSkill2 !== 0) return canCastSkill2;
    if (type2 !== 5 && skillData4.typeId === 27) return -27;
    if (skillData4.onlyAfterDefenceSuccess && ((this?.mods?.action?.stage?._time || 0) > (this?.mods?.last?.block?._time || 0) || !this.mods.action.inAction) && !this.mods.lancerSilentBlock?.canShieldCounter(skillId12)) return -17;
    const appliedEffects2 = this.mods.effects.getAppliedEffects(skillId12);
    if (skillData4?.resourceUsage?.st + appliedEffects2.stamina > this.mods.player.stamina) return -14;
    if (this.mods.player.job === 4 && skillId12 === 360120) return -16;
    if (!charge2 && press2 === false && (noAction2 || skillId12 !== this.mods.action.stage.skill.id) && this._getInfo(this?.mods?.action?.stage?.skill?.id)?.typeId !== 7) return -15;
    if (skillData4.keepMovingCharge && this._getInfo(this?.mods?.action?.stage?.skill?.id)?.typeId !== 25) return -18;
    if (skillData4.type === "nocasting") return -4;
    if (noAction2) return -1;
    if (charge2) return -2;
    if (skillData4.type === "notimeline") return -3;
    if (failed2) return -5;
    if (this.mods.action.stage.skill.id && this.getType(this.mods.action.stage.skill.id) === "notimeline") return -6;
    if (this.mods.action.inSpecialAction && !SPECIAL_ACTION_ALLOWED_TYPES.includes(skillData4.typeId)) return -7;
    return type2;
  };
  canCancelSkillWithType = (skillId13, cancelType) => {
    if (!this.mods.action.inAction) return null;
    const skillData5 = this._getInfo(skillId13),
      {
        front = -1
      } = skillData5?.cancels || {},
      timestampMinusTimeTimesReal = (Date.now() - this.mods.action.stage._time) * this.mods.action.speed.real;
    switch (cancelType) {
      case 1:
        return skillData5?.typeId === 30;
      case 2:
        return front !== -1 && front > timestampMinusTimeTimesReal && this.mods.action.stage.stage === 0;
    }
  };
  _getWiggleRoom = () => {
    return global.TeraProxy ? 80 + this.mods.ping.jitter : this.mods.ping.jitter;
  };
  _calculateTime = (cancelTime, elapsedTime, actionSpeed4, skillId14 = null, stageCount2 = null, useWiggleRoom = true) => {
    const getWiggleRoomResult = useWiggleRoom ? this._getWiggleRoom() : 0,
      candidateTimes = [cancelTime];
    stageCount2 = skillId14 ? stageCount2 : this.mods.action.stage.stage + 1;
    skillId14 = skillId14 ? skillId14 : this.mods.action.stage.skill.id;
    const animationlengthForAllStages = this.getAnimationlengthForAllStages(skillId14, {
      real: 1
    }, stageCount2);
    candidateTimes.push(animationlengthForAllStages);
    const skillData6 = this._getInfo(skillId14);
    candidateTimes.push(...(skillData6?.targeting || []));
    const elapsedTimeMinusGetWiggleRoomResult = elapsedTime - getWiggleRoomResult,
      mappedItems = candidateTimes.map(candidateTimeItem => Math.abs(candidateTimeItem - elapsedTimeMinusGetWiggleRoomResult)),
      sortedItems = [...mappedItems].sort((leftItem, rightItem) => leftItem - rightItem),
      candidateTimesEntry = candidateTimes[mappedItems.indexOf(sortedItems[0])],
      roundedValueAdjusted = Math.floor((elapsedTime - candidateTimesEntry - getWiggleRoomResult) / actionSpeed4) - 1,
      candidateTimesEntryMatches = candidateTimesEntry === cancelTime;
    if (candidateTimesEntryMatches ? roundedValueAdjusted <= getWiggleRoomResult * -1 : roundedValueAdjusted <= -8) {
      for (const sortedItemEntry of sortedItems) {
        const candidateTimesEntry2 = candidateTimes[mappedItems.indexOf(sortedItemEntry)],
          roundedValueAdjusted2 = Math.floor((elapsedTime - candidateTimesEntry2 - getWiggleRoomResult) / actionSpeed4) - 1;
        if (roundedValueAdjusted2 >= 0) return roundedValueAdjusted2;
      }
      return 0;
    }
    return roundedValueAdjusted;
  };
  getNewSkillData = (skillId15, {
    byGrant: byGrant3,
    press: press3
  }) => {
    const originalSkillId3 = skillId15;
    !byGrant3 && this.mods.player.job === classes.NINJA && BURNING_HEART_BASE_SKILLS.includes(skillId15) && this.mods.effects.getPassivity(32065) && (skillId15 = 90131);
    const appliedEffects3 = this.mods.effects.getAppliedEffects(skillId15);
    appliedEffects3.transform && (skillId15 = appliedEffects3.transform);
    let requestedSkillData = this._getInfo(skillId15);
    if (!requestedSkillData) {
      this.mods.log.error("CRITICAL", "Failed to find skill info " + originalSkillId3 + " " + skillId15 + " " + this.mods.player.templateId + " 0");
      return {
        failed: true,
        skillId: skillId15,
        notFound: true
      };
    }
    let redirectAbnormality = false,
      redirectComplete;
    do {
      redirectComplete = true;
      for (const {
        id: id2,
        skill: skill2
      } of requestedSkillData?.abnormalityRedirect || []) {
        const abnormality = this.mods.effects.getAbnormality(id2);
        if (!abnormality) continue;
        const skillData7 = this._getInfo(skill2);
        if (!skillData7) continue;
        redirectComplete = false;
        if (Math.abs(skillId15 - skill2) > 10000) return this.getNewSkillData(skill2, {
          byGrant: byGrant3,
          press: press3
        });
        redirectAbnormality = abnormality;
        skillId15 = skill2;
        requestedSkillData = skillData7;
        break;
      }
    } while (!redirectComplete);
    [classes.NINJA, classes.BERSERKER].includes(this.mods.player.job) && redirectAbnormality && requestedSkillData.typeId === 28 && (this.mods.log.debug("NEW-SKILL-DATA", "Removing abnormality chain (28): " + skillId15), redirectAbnormality = false);
    requestedSkillData.connectNextSkill && this.mods.effects.hasAbnormalityWithTypeValue(334, requestedSkillData.baseId) && (skillId15 = requestedSkillData.connectNextSkill, requestedSkillData = this._getInfo(skillId15));
    if (this.mods.effects.hasAbnormalityWithCategoryTypeValue(requestedSkillData.categories, 239, null, 3)) {
      const skillInfo = this.mods.utils.getSkillInfo(skillId15);
      skillInfo.sub = 30;
      skillId15 = skillInfo.id;
      requestedSkillData = this._getInfo(skillId15);
    }
    if (byGrant3 && this.info.connectSkillArrow[originalSkillId3]) {
      const connectSkillArrowEntry = this.info.connectSkillArrow[originalSkillId3],
        inAction2 = this.mods.action.inAction && this.mods.action.stage?.skill?.id === connectSkillArrowEntry.skillId,
        timeMatches = connectSkillArrowEntry.time > Date.now() && !inAction2;
      if (timeMatches) return {
        skillId: connectSkillArrowEntry.skillId,
        byGrant: true,
        time: this.mods.ping.jitter - 1,
        noAction: true
      };
    }
    if (!this.mods.action.inAction) {
      let keptCharge = false;
      requestedSkillData.keptMovingCharge && requestedSkillData.type === "movingCharge" && (skillId15 = requestedSkillData.animLength[this.mods.action.keptMovingCharge][1], keptCharge = true);
      return {
        skillId: skillId15,
        charge: keptCharge,
        noAction: true
      };
    }
    if (requestedSkillData.type === "notimeline") return {
      skillId: skillId15,
      time: this.mods.ping.jitter,
      type: 9
    };
    const currentSkillId = this.mods.action.stage.skill.id,
      currentSkillInfo = this.mods.utils.getSkillInfo(currentSkillId),
      currentSkillData = this._getInfo(currentSkillId) || {};
    if (requestedSkillData.keepMovingCharge && currentSkillData.type === "movingCharge") return {
      skillId: skillId15,
      keepCharge: true,
      time: this.mods.ping.jitter - 1,
      type: 0
    };
    if ((byGrant3 || currentSkillId === skillId15) && currentSkillData.type === "movingCharge" && press3 === false) {
      const currentBaseSkill = this.mods.utils.getSkillInfo(currentSkillId).skill;
      const ngspBerserkerCharge = this.mods.settings.info.berserker_ngsp_charge === true &&
        this.mods.player.job === classes.BERSERKER && [3, 10].includes(currentBaseSkill);
      if (ngspBerserkerCharge) {
        const stages = currentSkillData.animLength;
        let stage = Math.min(this.mods.action.stage.stage, stages.length - 1);
        let elapsed = Math.max(0, Date.now() - this.mods.action.stage._stageTime);
        const speed = Math.max(0.01, this.mods.action.speed?.real || 1);
        while (stage + 1 < stages.length && elapsed >= stages[stage][0] / speed + 15) {
          elapsed -= stages[stage][0] / speed;
          stage++;
        }
        const serverStage = this.mods.action.serverStage;
        if (this.mods.settings.info.advancedChargesRelease === true &&
            this.mods.action.serverInAction && serverStage?.skill?.id === currentSkillId &&
            serverStage._time >= this.mods.action.stage._time &&
            Number.isInteger(serverStage.stage) && serverStage.stage >= 0) {
          stage = Math.min(stage, serverStage.stage);
        }
        const chargeJitter = this.mods.settings.info.jitterCompensationCharges === true ?
          Math.min(this.mods.settings.info.jitterCompensationChargesMax ?? 60,
            Math.max(this.mods.settings.info.jitterCompensationChargesMin ?? 0, this.mods.ping.jitter || 0)) : 0;
        return {
          skillId: stages[stage][1],
          time: chargeJitter ? -chargeJitter : 0,
          charge: true
        };
      }
      let chargeDelayMs = this.mods.ping.jitter;
      const elapsedChargeTime = Date.now() - this.mods.action.stage._stageTime - chargeDelayMs,
        remainingChargeTime = Math.abs(currentSkillData.animLength[this.mods.action.stage.stage][0] - (elapsedChargeTime + chargeDelayMs) * this.mods.action.speed.real);
      if (elapsedChargeTime <= 30) {
        chargeDelayMs = Math.abs(Math.min(elapsedChargeTime, 15)) * -1;
        this.mods.log.debug("CHARGE", "special charge 1; delaying by:", chargeDelayMs);
      } else remainingChargeTime <= 30 && (chargeDelayMs = Math.abs(remainingChargeTime) * -1 - 25, this.mods.log.debug("CHARGE", "special charge 2; delaying by:", chargeDelayMs));
      return {
        skillId: currentSkillData.animLength[this.mods.action.stage.stage][1],
        time: chargeDelayMs,
        charge: true
      };
    }
    if (requestedSkillData.onlyAfterDefenceSuccess && this.mods.last.block._time > this.mods.action.stage._time) return this.mods.action.serverStage._time >= this.mods.last.block._time ? (this.mods.log.debug("getNewSkillData", "Not allowing the skill through due to race condition"), {
      skillId: skillId15,
      failed: true,
      type: -999
    }) : {
      skillId: skillId15,
      chain: true,
      time: this.mods.last.block._time - this.mods.action.stage._time - 1,
      type: currentSkillData.typeId === 46 ? 6 : 3
    };
    const {
        rearStartTime = -1,
        pendingStartTime = -1,
        front = -1
      } = currentSkillData.cancels || {},
      wiggleRoomMs = this._getWiggleRoom(),
      currentActionSpeed = this?.mods?.action?.speed?.real || 1,
      elapsedActionTime = (Date.now() - this.mods.action.stage._time) * currentActionSpeed + wiggleRoomMs,
      inPendingWindow = this.isInPendingTime(elapsedActionTime, currentSkillData.cancels);
    if (currentSkillData.typeId === 25 && this.canFrontCancel(elapsedActionTime, currentSkillData.cancels)) return {
      skillId: skillId15,
      front: true,
      time: this._calculateTime(front, elapsedActionTime, currentActionSpeed),
      type: 2
    };
    if (currentSkillId === skillId15 && press3 === false && requestedSkillData.typeId === 41) return {
      skillId: skillId15,
      cancel: true,
      time: this.mods.ping.jitter - 1,
      type: 51
    };
    if (PENDING_WINDOW_TYPES.includes(requestedSkillData.typeId) && requestedSkillData.pendingType === 1 && inPendingWindow && !redirectAbnormality) return {
      skillId: skillId15,
      immediate: true,
      time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
      type: 6,
      code: 1
    };
    if (currentSkillData.typeId === 31 && requestedSkillData.pendingType === 1) return {
      skillId: skillId15,
      immediate: true,
      time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
      type: 6,
      code: 3
    };
    const requestedSkillInfo = this.mods.utils.getSkillInfo(skillId15),
      canChain = inPendingWindow && currentSkillData?.chains?.[requestedSkillInfo.skill] !== undefined,
      sameBaseChain = requestedSkillInfo.skill === currentSkillInfo.skill && requestedSkillData.pendingType === 3 && currentSkillData.pendingType === 3 && currentSkillData?.chains?.[requestedSkillInfo.skill] !== undefined;
    if (canChain || redirectAbnormality || sameBaseChain) {
      let chainResult = {
          chain: canChain,
          time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
          type: 4
        },
        forceNormalCast = false;
      if (requestedSkillData.type === "movingCharge") {
        chainResult.charge = true;
        requestedSkillInfo.id = requestedSkillData.overChargeConnectSkill || requestedSkillInfo.id;
      } else {
        if (canChain || sameBaseChain) {
          if (requestedSkillData.type === "connect") {
            forceNormalCast = true;
            for (const sub2 of currentSkillData.chains[requestedSkillInfo.skill]) {
              const skillAdjustedPlusSub2 = requestedSkillInfo.skill + "-" + sub2;
              if (requestedSkillData?.connectSkills?.[skillAdjustedPlusSub2] !== undefined) {
                requestedSkillInfo.sub = sub2;
                requestedSkillInfo.level = requestedSkillData.connectSkills[skillAdjustedPlusSub2];
                forceNormalCast = false;
                break;
              }
            }
          } else {
            forceNormalCast = true;
            for (const sub3 of currentSkillData.chains[requestedSkillInfo.skill]) {
              if (sub3 === requestedSkillInfo.sub) {
                forceNormalCast = false;
                break;
              }
              const skillAdjustedPlusSub3 = requestedSkillInfo.skill + "-" + sub3;
              if (requestedSkillData?.connectSkills?.[skillAdjustedPlusSub3] !== undefined) {
                requestedSkillInfo.sub = sub3;
                requestedSkillInfo.level = requestedSkillData.connectSkills[skillAdjustedPlusSub3];
                forceNormalCast = false;
                break;
              }
            }
          }
        }
      }
      if (canChain ? redirectAbnormality && forceNormalCast : redirectAbnormality) {
        forceNormalCast = false;
        const timestamp = Date.now();
        chainResult.time = Math.floor(timestamp - redirectAbnormality.time);
        if (requestedSkillInfo.id === this.mods.action.stage.skill.id) {
          const isIncludesResult = !(currentSkillData?.abnormalityRedirectToMe || []).includes(redirectAbnormality.id);
          !isIncludesResult && (timestamp - this.mods.action.stage._time >= 500 ? chainResult.time = Math.min(chainResult.time, timestamp - this.mods.action.stage._time - 501) : inPendingWindow ? (requestedSkillInfo.id = originalSkillId3, chainResult.time = this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed), chainResult.type = 6, chainResult.code = 666, delete chainResult.chain) : forceNormalCast = true);
        }
      }
      chainResult.skillId = requestedSkillInfo.id;
      if (!forceNormalCast) return chainResult;
    }
    if (currentSkillId === skillId15 && BLOCK_RELEASE_TYPES.includes(currentSkillData.typeId) && !press3) return {
      skillId: skillId15,
      cancel: true,
      time: this.mods.ping.jitter - 1,
      type: currentSkillData.typeId === 46 ? 51 : 10
    };
    if (currentSkillId === skillId15 && requestedSkillData.type === "drain") return {
      skillId: requestedSkillData.nextSkill,
      chain: true,
      time: this.mods.ping.jitter - 1,
      type: 11
    };
    if (currentSkillInfo.skill === this.mods.utils.getSkillInfo(skillId15).skill && !!currentSkillData.lockon) return {
      skillId: skillId15,
      chain: true,
      time: this.mods.ping.jitter - 1,
      type: 36
    };
    if (requestedSkillData.pendingType === 3 && !(currentSkillData.typeId === 9 && currentSkillData.pendingType === 0) && currentSkillInfo.skill !== requestedSkillInfo.skill) return {
      skillId: skillId15,
      "super": true,
      time: this.mods.ping.jitter - 1,
      type: 6
    };
    if (requestedSkillData.typeId === 25 && press3 && requestedSkillData.pendingType === 1 && inPendingWindow) return {
      skillId: skillId15,
      immediate: true,
      time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
      type: 6,
      code: 2
    };
    if (requestedSkillData.typeId === 31 && requestedSkillData.pendingType === 1 && inPendingWindow) return {
      skillId: skillId15,
      immediate: true,
      time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
      type: 6,
      code: 4
    };
    const canRearCancel2 = this.canRearCancel(elapsedActionTime, currentSkillData.cancels);
    if (currentSkillData.typeId === 30 && currentSkillData.pendingType === 0 && canRearCancel2) return {
      skillId: skillId15,
      immediate: true,
      time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
      type: 6,
      code: 5
    };
    if (currentSkillData.typeId === 30 && requestedSkillData.pendingType === 1 && inPendingWindow) return {
      skillId: skillId15,
      immediate: true,
      time: this._calculateTime(pendingStartTime, elapsedActionTime, currentActionSpeed),
      type: 6,
      code: 6
    };
    const typeIdMatches = currentSkillData.typeId === 29 && requestedSkillData.typeId !== 29 && (currentSkillData.dashRedirect === skillId15 || currentSkillData.dashRedirectFail === skillId15);


    const boomerangAfterAvalanche = this.mods.player.job === classes.NINJA &&
      AVALANCHE_SKILLS.includes(currentSkillId) && BOOMERANG_SECOND_CASTS.includes(skillId15);
    if ((requestedSkillData.pendingType === 2 && !PENDING_CANCEL_EXCLUSIONS.includes(requestedSkillData.typeId) || boomerangAfterAvalanche) && (currentSkillData.typeId > 36 || !REAR_CANCEL_RESTRICTED_TYPES.includes(currentSkillData.typeId) || currentSkillData.typeId === 9 && 3 !== requestedSkillData.typeId) && (canRearCancel2 || typeIdMatches) && !(currentSkillData.pendingType === 0 && requestedSkillData.typeId === 1)) {
      let time2 = this._calculateTime(rearStartTime, elapsedActionTime, currentActionSpeed);
      if (typeIdMatches) time2 = -1;
      return {
        skillId: skillId15,
        rear: true,
        code: 1,
        time: time2,
        type: 6
      };
    }
    if (requestedSkillData.pendingType === 2 && DEFENSIVE_PENDING_TYPES.includes(requestedSkillData.typeId) && canRearCancel2 && currentSkillData.typeId !== requestedSkillData.typeId && !(this.mods.player.job === classes.LANCER && currentSkillInfo.skill === 26 && requestedSkillInfo.skill === 2)) return {
      skillId: skillId15,
      rear: true,
      code: 2,
      time: this._calculateTime(rearStartTime, elapsedActionTime, currentActionSpeed),
      type: 6
    };
    if (requestedSkillData.canCastDuringBlock && BLOCK_ACTION_TYPES.includes(currentSkillData.typeId) && canRearCancel2 && BLOCK_CAST_CLASSES.includes(this.mods.player.job)) return {
      skillId: skillId15,
      block: true,
      time: this._calculateTime(rearStartTime, elapsedActionTime, currentActionSpeed),
      type: 6
    };
    if (typeIdMatches) return {
      skillId: skillId15,
      dash: true,
      time: -1,
      type: 6
    };
    if (currentSkillData.lockon && currentSkillData.typeId === 30 && requestedSkillInfo.skill !== currentSkillInfo.skill) return {
      skillId: skillId15,
      lockon: true,
      time: this.mods.ping.jitter - 1,
      type: 6
    };
    if (requestedSkillData.typeId === 27 && (this.mods.datacenter.isKnockDown(currentSkillId) || this.mods.action.stage.air || this.mods.action.stage.airChain)) return {
      skillId: skillId15,
      kd: true,
      time: this.mods.ping.jitter - 1,
      type: 5
    };
    const animationlengthForAllStages2 = this.getAnimationlengthForAllStages(currentSkillId);
    if (!currentSkillData.shouldNotUseLength && currentSkillData.typeId !== 29 && elapsedActionTime >= animationlengthForAllStages2 && this.isSupported(currentSkillId)) {
      const calculateTimeResult = this._calculateTime(animationlengthForAllStages2, elapsedActionTime, currentActionSpeed);
      if (calculateTimeResult >= 0) this.mods.log.debug("FUTURE", "Future is bigger than 0. " + calculateTimeResult);else return {
        skillId: skillId15,
        noAction: true,
        future: true,
        time: calculateTimeResult - 5
      };
    }
    return {
      skillId: skillId15,
      failed: true
    };
  };
  getSpeed = skillId16 => {
    const skillData8 = this._getInfo(skillId16),
      appliedEffects4 = this.mods.effects.getAppliedEffects(skillId16);
    let fixed2 = 1,
      not_fixed2 = this.mods.player.aspd;
    const skillInfo2 = this.mods.utils.getSkillInfo(skillId16),
      valueMatches = this.mod.patch <= 93 && this.mods.player.job === classes.GUNNER && skillInfo2.skill === 5 && !GUNNER_BASE_VARIANTS.includes(skillInfo2.sub);
    let real2 = skillData8?.fixedSpeed || valueMatches || false ? 1 : this.mods.player.aspd,
      stage2 = real2,
      projectile2 = real2;
    if (MOVEMENT_SPEED_TYPES.includes(skillData8?.type)) real2 = this.mods.player.aspd;
    const typeMatches = skillData8?.type === "movingCharge";
    !typeMatches && (stage2 *= appliedEffects4.abnormSpeed * appliedEffects4.passiveSpeed);
    real2 *= appliedEffects4.abnormSpeed * appliedEffects4.passiveSpeed;
    projectile2 *= appliedEffects4.abnormSpeed * appliedEffects4.passiveSpeed;
    fixed2 *= appliedEffects4.abnormSpeed * appliedEffects4.passiveSpeed;
    not_fixed2 *= appliedEffects4.abnormSpeed * appliedEffects4.passiveSpeed;
    real2 *= appliedEffects4.noct;
    stage2 *= appliedEffects4.noct;
    projectile2 *= appliedEffects4.noct;
    fixed2 *= appliedEffects4.noct;
    not_fixed2 *= appliedEffects4.noct;
    typeMatches && (real2 += appliedEffects4.chargeSpeed, projectile2 += appliedEffects4.chargeSpeed, fixed2 += appliedEffects4.chargeSpeed, not_fixed2 += appliedEffects4.chargeSpeed, projectile2 *= skillData8.timeRate);
    skillData8?.lockon && (stage2 = 1);
    return {
      real: real2,
      stage: stage2,
      projectile: projectile2,
      fixed: fixed2,
      not_fixed: not_fixed2
    };
  };
  isSupported = skillId17 => {
    if (this.mods.player.job === classes.PRIEST && Math.floor(skillId17 / 10000) === 28 &&
        !(this.mods.priestEntrySkill?.divineChargeEnabled() ?? this.mods.settings.info.priest_divine_charge !== false)) return false;
    if (this.mods.player.job === classes.PRIEST && Math.floor(skillId17 / 10000) === 33 &&
        this.mods.settings.info.priest_sleep_emulation === false) return false;
    const isSupported2 = this.mods.hardcoded.isSupported(skillId17);
    if (isSupported2 !== undefined) return isSupported2;
    const skillInfo3 = this.mods.utils.getSkillInfo(skillId17);
    if (this?.info?.loadedSkillConfig?.[skillInfo3.skill]?.[skillInfo3.sub] === false) return false;
    return !!this._getInfo(skillId17);
  };
  getAppliedEffects = skillId18 => {
    return this._getInfo(skillId18)?.appliedEffects || {};
  };
  getKeepMovingCharge = skillId19 => {
    return this._getInfo(skillId19)?.keepMovingCharge;
  };
  getKeptMovingCharge = skillId20 => {
    return this._getInfo(skillId20)?.keptMovingCharge;
  };
  getCategories = skillId21 => {
    return this._getInfo(skillId21)?.categories || [];
  };
  getType = skillId22 => {
    return this._getInfo(skillId22)?.type;
  };
  getTypeId = skillId23 => {
    return this._getInfo(skillId23)?.typeId;
  };
  getArrowChain = skillId24 => {
    return this._getInfo(skillId24)?.arrowChain;
  };
  getChargeSkillId = (skillId25, stageIndex4) => {
    return this._getInfo(skillId25)?.animLength?.[stageIndex4]?.[1];
  };
  getLockonData = skillId26 => {
    return this._getInfo(skillId26)?.lockon;
  };
  getSkillDelayTime = (skillId27, {
    byGrant: byGrant4,
    press: press4
  }) => {
    const skillDelayMs = this.mods.hardcoded.getSkillDelayTime(skillId27, {
      byGrant: byGrant4,
      press: press4
    });
    if (skillDelayMs) return skillDelayMs;
    const skillData9 = this._getInfo(skillId27);
    if (skillData9.typeId === 29) return 30;
    if (press4 && skillData9.typeId === 25) return 30;
    if (skillData9.typeId === 30 && !!skillData9.lockon) return 30;
    if (this.mods.player.job === classes.LANCER && BLOCK_RELEASE_TYPES.includes(skillData9.typeId) && press4) return 5;
    return 0;
  };
  getActionDest = ({
    skillId: skillId28,
    stage: stageIndex5,
    effects: appliedEffects5,
    loc: location,
    w: heading
  }) => {
    const skillData10 = this._getInfo(skillId28),
      packetResult = this.mods.last.packet("C_START_INSTANCE_SKILL");
    if (skillData10.useDest[stageIndex5] === 1) return location;
    if (packetResult?.skill?.id === skillId28 && packetResult.endpoints.length && skillData10.useDest[stageIndex5] === 2) return packetResult.endpoints[0];
    const distanceEntry = skillData10?.distance?.[stageIndex5] || 0;
    if (distanceEntry === 0 || skillData10.useDest[stageIndex5] === 0) return {
      x: 0,
      y: 0,
      z: 0
    };
    const directionModifierEntry = skillData10?.directionModifier?.[stageIndex5] || 0;
    return this.mods.utils.applyDistance(location, heading + directionModifierEntry, distanceEntry * appliedEffects5.dist);
  };
  getActionAnimSeq = (skillId29, stageIndex6, actionSpeed5) => {
    const skillData11 = this._getInfo(skillId29);
    if (this.mods.player.job === classes.ARCHER && (this.mod.patch >= 114 ? [340101, 340102] : [340100]).includes(skillId29)) actionSpeed5.dist = 0;
    const holdIfNotMoving2 = skillData11?.holdIfNotMoving && !this.mods.last.packet("C_START_SKILL")?.moving;
    if (actionSpeed5.dist === 1 && !holdIfNotMoving2) return [];
    const parsedData = JSON.parse(JSON.stringify(skillData11?.animSeq?.[stageIndex6] || []));
    for (const parsedDataEntry of parsedData) {
      parsedDataEntry.distance *= actionSpeed5.dist * (holdIfNotMoving2 ? 0 : 1);
    }
    return parsedData;
  };
  sendActionStage = ({
    skillId: skillId30,
    continuation: continuation2,
    stage: stage3
  }) => {
    const {
      player: player2
    } = this.mods;
    let actionSpeed6, id3, effects2;
    continuation2 ? (stage3 = this.mods.action.stage.stage + 1, actionSpeed6 = this.mods.action.speed, id3 = this.mods.action.stage.id, effects2 = this.mods.action.effects) : (stage3 = stage3 || 0, actionSpeed6 = this.getSpeed(skillId30), this.mods.log.debug("SPEED", "R:" + actionSpeed6.real + " S:" + actionSpeed6.stage + " P:" + actionSpeed6.projectile + " F:" + actionSpeed6.fixed + " NF:" + actionSpeed6.not_fixed), id3 = ++this.info.skillIdCounter, effects2 = this.mods.effects.getAppliedEffects(skillId30));
    let effectScale2 = effects2.effectScale;
    if (this.mods.player.job === 7 && MYSTIC_CONNECT_SKILLS.includes(this.mods.utils.getSkillInfo(skillId30).skill)) for (let connectActionId = 16084501; connectActionId <= 16084560; connectActionId++) {
      if (!this.mods.effects.getSkillPolishing(connectActionId)) continue;
      effectScale2 += connectActionId % 16084500 / 100;
    }
    const w2 = stage3 ? this.mods.position.w : this.mods.last.startSkill.w,
      loc2 = stage3 ? this.mods.position.loc : this.mods.last.startSkill.loc || this.mods.position.loc;
    this.mod.send(...this.mods.packet.get_all("S_ACTION_STAGE"), {
      gameId: player2.gameId,
      loc: loc2,
      w: w2,
      templateId: player2.templateId,
      skill: skillId30,
      stage: stage3,
      speed: actionSpeed6.stage,
      projectileSpeed: actionSpeed6.projectile,
      id: id3,
      effectScale: effectScale2,
      moving: false,
      dest: this.getActionDest({
        skillId: skillId30,
        stage: stage3,
        effects: effects2,
        loc: loc2,
        w: w2
      }),
      target: 0x0n,
      animSeq: this.getActionAnimSeq(skillId30, stage3, effects2)
    });
  };
  sendActionEnd = (skill3, type3, location2, useLocation) => {
    const {
        player: player3
      } = this.mods,
      skillPacket = {
        gameId: player3.gameId,
        loc: location2 || this.mods.position.loc,
        w: this.mods.position.w,
        templateId: player3.templateId,
        skill: skill3,
        type: type3,
        id: this.mods.action.stage.id
      };
    this.mod.send(...this.mods.packet.get_all("S_ACTION_END"), {
      ...skillPacket,
      loc: this.mods.position.loc
    });
    useLocation && this.mod.send(...this.mods.packet.get_all("S_INSTANT_MOVE"), skillPacket);
  };
  sendConnectSkillArrow = (skillId31, byGrant5) => {
    if (byGrant5) return false;
    const sub4 = this.getArrowChain(skillId31);
    if (sub4 === null || sub4 === undefined) return false;
    if (!this.mods.action.inAction) {
      this.mods.log.debug("SKILL ARROW", "didn't send due to not being in a skill");
      return false;
    }
    const skillInfo4 = this.mods.utils.getSkillInfo(skillId31);
    skillInfo4.sub = sub4;
    this.info.connectSkillArrow[skillInfo4.id] = {
      skillId: skillId31,
      time: Date.now() + 200
    };
    this.mod.send(...this.mods.packet.get_all("S_CONNECT_SKILL_ARROW"), {
      templateId: this.mods.player.templateId,
      unk1: 0,
      skill: skillInfo4.id,
      unk2: 1
    });
    return true;
  };
  isInPendingTime = (elapsedTime2, cancelWindows = {}) => {
    const {
      pendingStartTime = -1,
      pendingEndTime = -1
    } = cancelWindows;
    if (pendingStartTime === -1) return false;
    if (elapsedTime2 < pendingStartTime) return false;
    if (pendingEndTime !== -1 && elapsedTime2 > pendingEndTime) return false;
    return true;
  };
  canFrontCancel = (elapsedTime3, cancelWindows2 = {}) => {
    const {
      front = -1
    } = cancelWindows2;
    if (front === -1) return false;
    if (elapsedTime3 < front) return false;
    return true;
  };
  canRearCancel = (elapsedTime4, cancelWindows3 = {}) => {
    const {
      rearStartTime = -1,
      rearEndTime = -1
    } = cancelWindows3;
    if (rearStartTime === -1) return false;
    if (elapsedTime4 < rearStartTime) return false;
    if (rearEndTime !== -1 && elapsedTime4 > rearEndTime) return false;
    return true;
  };
  isChain = (skillId32, skillId33) => {
    const skillInfo5 = this.mods.utils.getSkillInfo(skillId33),
      skillData12 = this._getInfo(skillId32);
    return skillData12?.chains?.[skillInfo5.skill] !== undefined;
  };
  getDirectionModifier = (skillId34, direction) => {
    return this._getInfo(skillId34)?.directionModifier?.[direction] || 0;
  };
  getActionStageDelay = skillId35 => {
    if (this.mods.player.job === classes.SLAYER && SLAYER_CANCEL_SKILLS.includes(skillId35)) return 30;
    return 0;
  };
  _getInfo = skillId36 => {
    return this.info.skillData[skillId36];
  };
  loaded = previousState => {
    if (previousState) {
      this.info.skillIdCounter = previousState.counter || 0;
      for (const eventsKey in previousState.events) {
        if (Array.isArray(previousState.events[eventsKey])) for (const eventsEntryEntry of previousState.events[eventsKey]) {
          this.on(eventsKey, eventsEntryEntry);
        } else this.on(eventsKey, previousState.events[eventsKey]);
      }
    }
    const {
      class: classValue,
      gender: gender2,
      race: race2
    } = this.mods.datacenter.getUserData(this.mods.player.templateId);
    let readFileResult = null;
    try {
      readFileResult = this.mods.library.readFile(__dirname, "../../skills/" + gender2 + "/" + race2 + "/" + classValue + ".json");
    } catch (error2) {
      this.mods.log.debug("LOADING", "No support for the class: " + this.mods.player.templateId);
      this.info.skillData = {};
      this.info.skillSupportedCount = 0;
      this.info.loadedSkillConfig = {};
      return;
    }
    try {
      this.info.skillData = JSON.parse(readFileResult);
      this.info.skillSupportedCount = Object.keys(this.info.skillData).length;
      this.info.loadedSkillConfig = SKILL_CONFIG[classValue.toLowerCase()];
      if (!global.PR) global.PR = {};
      global.PR[this.mods.player.templateId] = true;
      this.emit("loaded");
    } catch (error3) {
      try {
        readFileResult = readFileResult.slice(2);
        const encodedKey = "MTIsNDgsMTE1LDQzLDYsOTUsMTMwLDExMywyMTQsMTk1LDQ2LDEzOSwyMTMsMTAxLDIzLDEyOA==",
          encodedIv = "MTAzLDUsMTUzLDE5MywyMDEsMTQ0LDE4NiwxMjEsMjQ3LDIxOSw1NCw4MCwyMTUsODgsMTQsNw==",
          mappedItems2 = Buffer.from(encodedKey, "base64").toString().split(",").map(Number),
          mappedItems3 = Buffer.from(encodedIv, "base64").toString().split(",").map(Number);
        let createDecipherivResult = crypto.createDecipheriv("aes-128-cbc", Buffer.from(mappedItems2), Buffer.from(mappedItems3));
        createDecipherivResult.setAutoPadding(0);
        let updateResult = createDecipherivResult.update(readFileResult, "utf8", "utf-8");
        while (updateResult.indexOf("\0") !== -1) updateResult = updateResult.replace("\0", "");
        this.info.skillData = JSON.parse(updateResult);
        this.info.skillSupportedCount = Object.keys(this.info.skillData).length;
        this.info.loadedSkillConfig = SKILL_CONFIG[classValue.toLowerCase()];
        if (!global.PR) global.PR = {};
        global.PR[this.mods.player.templateId] = true;
        this.emit("loaded");
      } catch (error4) {
        this.mods.log.error("LOADING", "failed loading config", error4);
        this.info.skillData = {};
        this.info.skillSupportedCount = 0;
        this.info.loadedSkillConfig = {};
      }
    }
  };
  destructor = () => {
    if (global.PR) delete global.PR;
    return {
      counter: this.info.skillIdCounter,
      events: this._events
    };
  };
  constructor(mod2, mods2) {
    super();
    this.mod = mod2;
    this.mods = mods2;
    this.info = {
      skillData: {},
      skillIdCounter: 0,
      connectSkillArrow: {},
      skillSupportedCount: 0,
      loadedSkillConfig: {}
    };
    mod2.hook("S_LOGIN", "event", hooks.READ_REAL, this.loaded);
  }
}
module.exports = Skills;

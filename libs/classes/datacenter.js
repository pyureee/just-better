class Datacenter {
  getDisabledCategoriesInZone = zoneId => {
    const continentChannelTypeEntry = this.info.continentChannelType[zoneId];
    return this.info.skillConfigInfo[continentChannelTypeEntry];
  };
  isKnockDown = skillBase => {
    const {
      player: player2
    } = this.mods;
    return this.info.knockdownInfo[player2.job].includes(skillBase);
  };
  getCcInfo = abnormalityId => {
    return this.info.ccInfo[abnormalityId];
  };
  getAbnormalityData = abnormalityId2 => {
    return this.info.abnormality[abnormalityId2];
  };
  getPassivityData = passivityId => {
    return this.info.passivity[passivityId];
  };
  getNpcData = (huntingZoneId2, templateId) => {
    return this.info.npcData[huntingZoneId2][templateId];
  };
  getUserData = templateId2 => {
    return this.info.userData[templateId2];
  };
  async __query(query, ...queryArgs) {
    queryArgs = [...queryArgs];
    try {
      return await this.mod.queryData(query, queryArgs, queryArgs.length != 0);
    } catch (error) {
      console.log("FATAL ERROR in Library. Failed to execute query:", query);
      throw new Error(error);
    }
  }
  async __queryM(queries) {
    let queryResults = [];
    for (const [queryEntry, ...queryEntry2] of queries) {
      queryResults.push(await this.mod.queryData(queryEntry, queryEntry2, true));
    }
    return queryResults.reduce((combinedResults, queryResult) => {
      combinedResults.push(...queryResult);
      return combinedResults;
    }, []);
  }
  async __queryF(query2, mergeResults = true, queryOption = true, queryOption2 = true, queryFilter = null) {
    let queryResult2;
    try {
      queryResult2 = await this.mod.queryData(query2, [], queryOption, queryOption2, queryFilter);
    } catch (error2) {
      console.log("FATAL ERROR in Library. Failed to execute query:", query2);
      throw new Error(error2);
    }
    let dataNode = {
      attributes: {},
      children: []
    };
    if (mergeResults) for (const dataNode2 of Array.isArray(queryResult2) ? queryResult2 : [queryResult2]) {
      dataNode.attributes = {
        ...dataNode.attributes,
        ...dataNode2.attributes
      };
      dataNode.children.push(...dataNode2.children);
    } else dataNode = queryResult2;
    return dataNode;
  }
  _getUserData = async () => {
    const queryFResult = await this.__queryF("/UserData/");
    for (const {
      attributes: attributes2
    } of queryFResult.children) {
      attributes2.race === "popori" && attributes2.gender === "female" && (attributes2.race = "elin");
      attributes2.name = attributes2["class"];
      attributes2["class"] = {
        warrior: "Warrior",
        lancer: "Lancer",
        slayer: "Slayer",
        berserker: "Berserker",
        sorcerer: "Sorcerer",
        archer: "Archer",
        priest: "Priest",
        elementalist: "Mystic",
        soulless: "Reaper",
        engineer: "Gunner",
        fighter: "Brawler",
        assassin: "Ninja",
        glaiver: "Valkyrie"
      }[attributes2["class"]];
      this.info.userData[attributes2.id] = attributes2;
    }
  };
  _getSkillConfig = async () => {
    const queryFResult2 = await this.__queryF("/WorldData/SkillConfig/");
    for (const childrenEntry of queryFResult2.children) {
      const name2 = childrenEntry.name;
      if (!name2.startsWith("DisableIn")) continue;
      const toLowerCaseResult = name2.replace("DisableIn", "").toLowerCase(),
        queryResult3 = await this.__query("/ContinentData/Continent@channelType=?/", toLowerCaseResult);
      for (const {
        attributes: attributes3
      } of queryResult3) {
        this.info.continentChannelType[attributes3.id] = toLowerCaseResult;
      }
      if (!this.info.skillConfigInfo[toLowerCaseResult]) this.info.skillConfigInfo[toLowerCaseResult] = [];
      this.info.skillConfigInfo[toLowerCaseResult].push(childrenEntry.attributes.id);
    }
  };
  _getAbnormalityData = async () => {
    const queryMResult = await this.__queryM([["/Abnormality/Abnormal@id>=?", 100000], ["/Abnormality/Abnormal@id<?", 100000]]);
    for (const {
      attributes: attributes4,
      children: children2
    } of queryMResult) {
      let attributes42 = attributes4;
      for (const {
        name: name3,
        attributes: attributes5
      } of children2) {
        if (!attributes42[name3]) attributes42[name3] = [];
        attributes42[name3].push(attributes5);
      }
      const parts = (attributes42.bySkillCategory || "").split(",");
      attributes42.bySkillCategory = [];
      for (const partEntry of parts) {
        if (partEntry !== "") attributes42.bySkillCategory.push(+partEntry);
      }
      this.info.abnormality[attributes42.id] = attributes42;
    }
  };
  _getAbnormalityEffects = () => {
    const ignoredAbnormalityIds = [10152220, 10152221, 905649],
      state = {
        211: "stunned"
      };
    for (const entriesKey of Object.values(this.info.abnormality)) {
      for (const abnormalityEffectEntry of entriesKey.AbnormalityEffect || []) {
        switch (abnormalityEffectEntry.type) {
          case 211:
            {
              if (ignoredAbnormalityIds.includes(entriesKey.id)) break;
              this.info.ccInfo[entriesKey.id] = {
                dur: +entriesKey.time,
                categories: entriesKey.bySkillCategory,
                type: state[abnormalityEffectEntry.type]
              };
              break;
            }
        }
      }
    }
  };
  _getPassivityData = async () => {
    const queryMResult2 = await this.__queryM([["/Passivity/Passive@id>=?", 100000], ["/Passivity/Passive@id<?", 100000]]);
    for (const {
      attributes: attributes6,
      children: children3
    } of queryMResult2) {
      let attributes62 = attributes6;
      for (const {
        name: name4,
        attributes: attributes7
      } of children3) {
        if (!attributes62[name4]) attributes62[name4] = [];
        attributes62[name4].push(attributes7);
      }
      const parts2 = (attributes62.conditionCategory || "").split(",");
      attributes62.conditionCategory = [];
      for (const parts2Entry of parts2) {
        if (parts2Entry !== "") attributes62.conditionCategory.push(+parts2Entry);
      }
      this.info.passivity[attributes62.id] = attributes62;
    }
  };
  _getNpcData = async () => {
    const queryMResult3 = await this.__queryM([["/NpcData@huntingZoneId>=?", 780], ["/NpcData@huntingZoneId<?", 780]]);
    for (const {
      attributes: {
        huntingZoneId: queryMResult3Entry
      },
      children: children4
    } of queryMResult3) {
      for (const {
        attributes: attributes8
      } of children4) {
        const backstab2 = !attributes8.cannotPassThrough,
          lockon2 = !!!(attributes8.isObjectNpc || attributes8.villager || attributes8.isServant),
          resourceSize2 = attributes8.resourceSize || 100,
          scale2 = attributes8.scale || 1,
          size2 = attributes8.size,
          sizeScale = size2 == "medium" ? 0.25 : size2 == "small" ? 0.125 : 1,
          radius2 = Math.max(75, resourceSize2 / scale2 * sizeScale);
        if (!this.info.npcData[queryMResult3Entry]) this.info.npcData[queryMResult3Entry] = {};
        this.info.npcData[queryMResult3Entry][attributes8.id] = {
          backstab: backstab2,
          lockon: lockon2,
          radius: radius2
        };
      }
    }
  };
  _getKnockdownData = async () => {
    const _set = new Set();
    for (const entryEntry of Object.values(this.info.userData)) {
      _set.add(entryEntry.name.toLowerCase());
    }
    const skillHotKeyQuery = "/SkillHotKeyData/HotKey@class=?",
      queryMResult4 = await this.__queryM([..._set].map(itemItem => [skillHotKeyQuery, itemItem]));
    for (const {
      attributes: attributes9,
      children: children5
    } of queryMResult4) {
      const toLowerCaseResult2 = attributes9["class"].toLowerCase(),
        mappedItems = children5.filter(children5Item => children5Item.name == "Reaction").map(matcheItem => +matcheItem.attributes.id);
      for (const [entryEntry2, entryEntry3] of Object.entries(this.info.userData)) {
        if (toLowerCaseResult2 !== entryEntry3.name.toLowerCase()) continue;
        this.info.knockdownInfo[(+entryEntry2 - 10101) % 100] = mappedItems;
      }
    }
  };
  __loadData = async () => {
    await this._getUserData().then(this._getSkillConfig).then(this._getAbnormalityData).then(this._getAbnormalityEffects).then(this._getNpcData).then(this._getKnockdownData);
    "TRUE" !== "TRUE" && (await this._getPassivityData());
  };
  constructor(mod2, mods2) {
    const isMods2 = !mods2;
    this.mod = mod2;
    this.mods = mods2;
    this.info = {
      userData: {},
      continentChannelType: {},
      skillConfigInfo: {},
      abnormality: {},
      passivity: {},
      ccInfo: {},
      npcData: {},
      knockdownInfo: {},
      loaded: false
    };
    if (isMods2) mod2.clientInterface.once("ready", () => {
      this.__loadData().then(() => {
        console.log("ping-remover has loaded data");
        this.info.loaded = true;
      })["catch"](mod3 => {
        console.log(mod3);
        this.info.loaded = true;
      });
    });else mods2.utils ? this.__loadData().then(() => console.log("ping-remover has loaded data"))["catch"](console.log) : (async () => {
      while (!mod2.clientMod.info.loaded) await new Promise(callback => setTimeout(callback, 50));
      this.info = mod2.clientMod.info;
    })();
  }
}
module.exports = Datacenter;

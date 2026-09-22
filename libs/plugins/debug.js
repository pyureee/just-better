const hooks = require("../enums/hooks");
module.exports = function (mod, mods) {
  const packetDebugDefinitions = [{
      name: "S_ACTION_STAGE",
      fields: ["skill", "stage", "speed", "projectileSpeed", "effectScale", "w", "loc", "dest", "animSeq"],
      gameId: "gameId",
      fieldSelector: {
        skill: "id"
      },
      fieldRename: {
        projectileSpeed: "ps",
        effectScale: "es"
      }
    }, {
      name: "S_ACTION_END",
      fields: ["skill", "type", "loc"],
      gameId: "gameId",
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_START_COOLTIME_SKILL",
      fields: ["skill", "cooldown", "usedStacks", "nextStackCooldown"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_DECREASE_COOLTIME_SKILL",
      fields: ["skill", "cooldown", "usedStacks", "nextStackCooldown"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_ABNORMALITY_BEGIN",
      fields: ["id", "stacks", "duration"],
      gameId: "target"
    }, {
      name: "S_ABNORMALITY_REFRESH",
      fields: ["id", "stacks", "duration"],
      gameId: "target"
    }, {
      name: "S_ABNORMALITY_END",
      fields: ["id"],
      gameId: "target"
    }, {
      name: "C_START_COMBO_INSTANT_SKILL",
      fields: ["skill", "w", "loc", "targets", "endpoints"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_START_INSTANCE_SKILL",
      fields: ["skill", "continue", "w", "loc", "targets", "endpoints", "unkn1", "unkn2"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_START_INSTANCE_SKILL_EX",
      fields: ["skill", "projectile", "unk", "w", "loc", "dest"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_START_SKILL",
      fields: ["skill", "continue", "moving", "unk", "unk2", "w", "loc", "dest"],
      fieldSelector: {
        skill: "id"
      },
      fieldRename: {
        unk2: "isPerfectCombo",
        unk: "destPosOnAir",
        "continue": "byGrant"
      }
    }, {
      name: "C_START_TARGETED_SKILL",
      fields: ["skill", "w", "loc", "dest", "targets"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_PRESS_SKILL",
      fields: ["skill", "press", "w", "loc", "unkn1", "unkn2", "unkn3"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_NOTIMELINE_SKILL",
      fields: ["skill"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_CANCEL_SKILL",
      fields: ["skill", "type"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_SKILL_CATEGORY",
      fields: ["category", "enabled"]
    }, {
      name: "S_GRANT_SKILL",
      fields: ["skill"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_INSTANT_DASH",
      fields: ["target", "unk", "w", "loc"],
      gameId: "gameId"
    }, {
      name: "S_CONNECT_SKILL_ARROW",
      fields: ["skill", "unk1", "unk2"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_CANNOT_START_SKILL",
      fields: ["skill"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "C_PLAYER_LOCATION",
      fields: ["type", "w", "loc"]
    }, {
      name: "C_NOTIFY_LOCATION_IN_ACTION",
      fields: ["skill", "stage", "w", "loc"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_INSTANT_MOVE",
      fields: ["w", "loc"],
      gameId: "gameId"
    }, {
      name: "S_INSTANCE_ARROW",
      fields: ["skill", "actionId", "targets", "endpoints"],
      gameId: "gameId",
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_EACH_SKILL_RESULT",
      fields: ["push", "air", "airChain", "skill", "stage", "w", "loc", "animSeq"],
      gameId: "target",
      overrideEvent: "reaction",
      requiresValue: {
        enable: true
      },
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_PLAYER_STAT_UPDATE",
      fields: ["attackSpeed", "attackSpeedBonus", "fireEdge", "iceEdge", "lightningEdge"],
      cache: true
    }, {
      name: "S_DEFEND_SUCCESS",
      fields: ["skill", "perfect", "unk4"],
      fieldSelector: {
        skill: "id"
      },
      gameId: "gameId"
    }, {
      name: "C_CAN_LOCKON_TARGET",
      fields: ["skill", "unk", "target"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_CAN_LOCKON_TARGET",
      fields: ["skill", "success", "unk", "target"],
      fieldSelector: {
        skill: "id"
      }
    }, {
      name: "S_CREATURE_LIFE",
      fields: ["alive", "inShuttle", "loc"],
      gameId: "gameId"
    }, {
      name: "C_HIT_USER_PROJECTILE",
      fields: ["id", "end", "loc"]
    }, {
      name: "S_START_USER_PROJECTILE",
      fields: ["skill", "id", "loc", "dest", "curve", "distance", "speed", "projectileSpeed"],
      gameId: "gameId",
      fieldSelector: {
        skill: "id"
      }
    }],
    formatDebugValue = valueToFormat => {
      if (valueToFormat.x !== undefined && valueToFormat.y !== undefined && valueToFormat.z !== undefined) {
        valueToFormat.x = Math.round(valueToFormat.x);
        valueToFormat.y = Math.round(valueToFormat.y);
        valueToFormat.z = Math.round(valueToFormat.z);
        return valueToFormat.x + ":" + valueToFormat.y + ":" + valueToFormat.z;
      }
      for (let valueToFormatKey in valueToFormat) {
        const valueToFormatEntry = valueToFormat[valueToFormatKey];
        switch (typeof valueToFormatEntry) {
          case "number":
            valueToFormat[valueToFormatKey] = +valueToFormatEntry.toFixed(3);
            break;
          case "object":
            {
              const formatDebugValueResult = formatDebugValue(valueToFormatEntry);
              if (typeof formatDebugValueResult === "string") valueToFormat[valueToFormatKey] = formatDebugValueResult;else valueToFormat[valueToFormatKey] = mods.library.jsonStringify(formatDebugValueResult);
              break;
            }
          case "boolean":
            valueToFormat[valueToFormatKey] = +valueToFormatEntry;
            break;
          case "bigint":
            break;
          case "string":
            break;
          case "undefined":
            return null;
          default:
            {
              throw new Error("Unsupported type " + valueToFormatEntry);
              break;
            }
        }
      }
      return valueToFormat;
    },
    registerDebugHook = ({
      name: packetName,
      fields: fieldNames,
      gameId = null,
      overrideEvent = null,
      fieldSelector = {},
      fieldRename = {},
      requiresValue = {},
      cache: cacheEnabled
    }) => {
      let lastMessage = null;
      mod.hook(...mods.packet.get_all(packetName), hooks.READ_ALL, (event, event2) => {
        if (gameId && !mods.player.isMe(event[gameId])) return;
        if (overrideEvent) event = event[overrideEvent];
        for (const requiresValueKey in requiresValue) {
          if (requiresValue[requiresValueKey] !== event[requiresValueKey]) return;
        }
        let fieldValues = [];
        for (const fieldNameEntry of fieldNames) {
          let eventEntry = event[fieldNameEntry];
          fieldSelector[fieldNameEntry] && (eventEntry = eventEntry[fieldSelector[fieldNameEntry]]);
          fieldValues.push(eventEntry);
        }
        formatDebugValue(fieldValues);
        const packetOrigin = event2 ? "F" : "R",
          packetOriginAdjusted = packetName[0] === "C" ? packetOrigin + "->" : "<-" + packetOrigin;
        fieldValues = packetOriginAdjusted + " " + fieldValues.map((fieldValueItem, index) => (fieldRename[fieldNames[index]] || fieldNames[index]) + ":" + fieldValueItem).join(" ");
        if (cacheEnabled && lastMessage === fieldValues) return;
        lastMessage = fieldValues;
        mods.log.debug(packetName, fieldValues);
      });
    };
  packetDebugDefinitions.map(registerDebugHook);
};

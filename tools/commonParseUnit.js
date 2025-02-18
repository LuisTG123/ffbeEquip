var console = require('console');

var stats = ["HP","MP","ATK","DEF","MAG","SPR"];
var baseStats = ["hp","mp","atk","def","mag","spr"];
var elements = ["fire", "ice", "lightning", "water", "wind", "earth", "light", "dark"];
var ailments = ["poison", "blind", "sleep", "silence", "paralysis", "confuse", "disease", "petrification"];

var typeMap = {
    1: 'dagger',
    2: 'sword',
    3: 'greatSword',
    4: 'katana',
    5: 'staff',
    6: 'rod',
    7: 'bow',
    8: 'axe',
    9: 'hammer',
    10: 'spear',
    11: 'harp',
    12: 'whip',
    13: 'throwing',
    14: 'gun',
    15: 'mace',
    16: 'fist',
    30: 'lightShield',
    31: 'heavyShield',
    40: 'hat',
    41: 'helm',
    50: 'clothes',
    51: 'lightArmor',
    52: 'heavyArmor',
    53: 'robe',
    60: 'accessory'
}

var raceMap = {
    1: 'beast',
    2: 'bird',
    3: 'aquatic',
    4: 'demon',
    5: 'human',
    6: 'machine',
    7: 'dragon',
    8: 'spirit',
    9: 'bug',
    10: 'stone',
    11: 'plant',
    12: 'undead'
}

var ailmentsMap = {
    "Poison": "poison",
    "Blind": "blind",
    "Sleep": "sleep",
    "Silence": "silence",
    "Paralyze": "paralysis",
    "Confusion": "confuse",
    "Disease": "disease",
    "Petrify": "petrification",
    "Death": "death"
}

var elementsMap = {
    1: 'fire',
    2: 'ice',
    3: 'lightning',
    4: 'water',
    5: 'wind',
    6: 'earth',
    7: 'light',
    8: 'dark'
}

var unlockedSkills = {
    "100011705": "225960",
    "100011805": "226000",
    "100012005": "225990",
    "100012405": "226010",
    "100011905": "225980",
    "100012505": "225970"
}



function getPassives(unitId, skillsIn, skills, lbs, enhancements, maxRarity, unitData, unitOut, latentSkillsByUnitId) {
    var baseEffects = {};
    var skillsOut = [baseEffects];
    var skillsOutSave = skillsOut;
    unitOut.passives = [];
    unitOut.actives = [];
    unitOut.magics = [];
    
    for (skillIndex in skillsIn) {
        if (skillsIn[skillIndex].rarity > maxRarity) {
            continue; // don't take into account skills for a max rarity not yet released
        }
        var skillId = skillsIn[skillIndex].id.toString();
        if (skillId == "0") {
            console.log(skillsIn[skillIndex]);
            continue;
        }
        manageSkill(skills, skillId, unitOut, enhancements, lbs, skillsOut, baseEffects, skillsIn[skillIndex].rarity, skillsIn[skillIndex].level, false);
    }
    if (latentSkillsByUnitId && latentSkillsByUnitId[unitId]) {
        latentSkillsByUnitId[unitId].forEach(skillId => {
            manageSkill(skills, skillId, unitOut, enhancements, lbs, skillsOut, baseEffects, unitOut.min_rarity, 1, true);
        });
    }
    if (unlockedSkills[unitId]) {
        var skillId = unlockedSkills[unitId];
        var skillIn = skills[skillId];
        if (!(skillIn.requirements && skillIn.requirements[0][0] == "SWITCH")) { // Do not manage skills already managed generically
            manageUnlockableSkill(skillIn, skillId, unitOut, skills, lbs);    
        }
        
    }
    unitOut.innates = {};
    addElementalResist(baseEffects, unitData.element_resist);
    addAilmentResist(baseEffects, unitData.status_resist);
    addElementalResist(unitOut.innates, unitData.element_resist);
    addAilmentResist(unitOut.innates, unitData.status_resist);
    
    if (Object.keys(baseEffects).length === 0) {
        skillsOut.splice(0,1);
    }
    
    if (unitData.limitburst_id && lbs[unitData.limitburst_id]) {
        var lb = lbs[unitData.limitburst_id];
        unitOut.lb = parseLb(lb, unitOut, skills);
    }
    
    return skillsOut;
}

function manageSkill(skills, skillId, unitOut, enhancements, lbs, skillsOut, baseEffects, rarity,  level, latentSkill) {
    var skillIn = skills[skillId];
    var skill;
    if (skillIn.active && skillIn.type != "MAGIC") {
        skill = parseActiveSkill(skillId, skillIn, skills, unitOut);
        skill.rarity = rarity;
        skill.level = level;
        unitOut.actives.push(skill);
        if (enhancements && enhancements[skillId]) {
            var enhancementLevel = 0;
            while (enhancements[skillId]) {
                enhancementLevel++;
                skillId = enhancements[skillId];
                skillIn = skills[skillId];
                skill = parseActiveSkill(skillId, skillIn, skills, unitOut, enhancementLevel);
                skill.rarity = rarity;
                skill.level = level;
                unitOut.actives.push(skill);
            }
        }
    } else if (skillIn.type == "MAGIC") {
        unitOut.magics.push(parseActiveSkill(skillId, skillIn, skills, unitOut));
        if (enhancements && enhancements[skillId]) {
            var enhancementLevel = 0;
            while (enhancements[skillId]) {
                enhancementLevel++;
                skillId = enhancements[skillId];
                skillIn = skills[skillId];
                skill = parseActiveSkill(skillId, skillIn, skills, unitOut, enhancementLevel);
                skill.rarity = rarity;
                skill.level = level;
                unitOut.magics.push(skill);
            }
        }
    } else if (enhancements && enhancements[skillId]) {
        if (!unitOut.enhancements) {
            unitOut.enhancements = [];
        }
        var enhancementData = {"name": skills[skillId].name, "levels": []}
        if (latentSkill) {
            enhancementData.levels.push([]);
        }
        var enhancementBaseEffects = {};
        var enhancementSkillsOut = [enhancementBaseEffects];
        skill = getPassive(skillIn, skillId, enhancementBaseEffects, enhancementSkillsOut, skills, unitOut, lbs);
        skill.rarity = rarity;
        skill.level = level;
        unitOut.passives.push(skill);
        if (Object.keys(enhancementBaseEffects).length === 0) {
            enhancementSkillsOut.splice(0, 1);
        }
        if (level > 101) {
            for (var i = enhancementSkillsOut.length; i--;) {
                enhancementSkillsOut[i].levelCondition = level;
            }
        }
        enhancementData.levels.push(enhancementSkillsOut);
        var enhancementLevel = 0;
        while (enhancements[skillId]) {
            enhancementLevel++;
            skillId = enhancements[skillId];
            skillIn = skills[skillId];
            var enhancementBaseEffects = {};
            var enhancementSkillsOut = [enhancementBaseEffects];
            skill = getPassive(skills[skillId], skillId, enhancementBaseEffects, enhancementSkillsOut, skills, unitOut, lbs);
            skill.rarity = rarity;
            skill.level = level;
            skill.name = skill.name + " +" + enhancementLevel;
            unitOut.passives.push(skill);

            if (Object.keys(enhancementBaseEffects).length === 0) {
                enhancementSkillsOut.splice(0, 1);
            }
            if (level > 101) {
                for (var i = enhancementSkillsOut.length; i--;) {
                    enhancementSkillsOut[i].levelCondition = level;
                }
            }
            enhancementData.levels.push(enhancementSkillsOut);
        }
        var empty = true;
        for (var i = enhancementData.levels.length; i--;) {
            if (Object.keys(enhancementData.levels[i]).length > 0) {
                empty = false;
                break;
            }
        }
        if (!empty) {
            unitOut.enhancements.push(enhancementData);
        }
    } else if (level > 101) {
        baseEffectsLevelCondition = {};
        skillsOutLevelCondition = [baseEffectsLevelCondition];
        skill = getPassive(skillIn, skillId, baseEffectsLevelCondition, skillsOutLevelCondition, skills, unitOut, lbs);
        skill.rarity = rarity;
        skill.level = level;
        if (!(Object.keys(skillsOutLevelCondition[0]).length === 0)) {
            baseEffectsLevelCondition.levelCondition = level;
            skillsOut.push(baseEffectsLevelCondition);
        }
        for (var i = 1, len = skillsOutLevelCondition.length; i < len; i++) {
            skillsOutLevelCondition[i].levelCondition = level;
            skillsOut.push(skillsOutLevelCondition[i]);
        }
        unitOut.passives.push(skill);
    } else if (skills[skillId].requirements && skills[skillId].requirements[0][0] == "SWITCH") {
        manageUnlockableSkill(skillIn, skillId, unitOut, skills, lbs);
    } else {
        skill = getPassive(skillIn, skillId, baseEffects, skillsOut, skills, unitOut, lbs);
        skill.rarity = rarity;
        skill.level = level;
        unitOut.passives.push(skill);
    }
}

function manageUnlockableSkill(skillIn, skillId, unitOut, skills, lbs) {
    if (!unitOut.enhancements) {
        unitOut.enhancements = [];
    }
    var enhancementData = {"name":skillIn.name, "levels":[[]]}
    var enhancementBaseEffects = {};
    var enhancementSkillsOut = [enhancementBaseEffects];
    var skill = getPassive(skillIn, skillId, enhancementBaseEffects, enhancementSkillsOut, skills, unitOut, lbs);
    skill.rarity = unitOut.min_rarity;
    skill.level = 1;
    unitOut.passives.push(skill);
    if (Object.keys(enhancementBaseEffects).length === 0) {
        enhancementSkillsOut.splice(0,1);
    }
    enhancementData.levels.push(enhancementSkillsOut);
    unitOut.enhancements.push(enhancementData);
}

function getPassive(skillIn, skillId, baseEffects, skillsOut, skills, unit, lbs) {
    var skill = {"name" : skillIn.name, "id":skillId, "icon": skillIn.icon, "effects": []};
    var tmrAbilityEffects = [];
    
    for (var rawEffectIndex in skillIn["effects_raw"]) {
        var rawEffect = skillIn["effects_raw"][rawEffectIndex];

        var effects = parsePassiveRawEffet(rawEffect, skills, unit, lbs);
        if (effects) {
            if (skillIn.requirements && skillIn.requirements[0][0] == "EQUIP") {
                tmrAbilityEffects = tmrAbilityEffects.concat(effects);
            } else { 
                addEffectsToEffectList(skillsOut, effects);
            }
            for (var i = 0, len = effects.length; i < len; i++) {
                skill.effects.push({"effect":effects[i], "desc": skillIn.effects[rawEffectIndex]});    
            }
        } else {
            skill.effects.push({"effect":null, "desc": skillIn.effects[rawEffectIndex]});    
        }
    }
    if (skillIn.requirements && skillIn.requirements[0][0] == "EQUIP") {
        if (skillIn.requirements.length == 1) {
            skill.equipedConditions = [skillIn.requirements[0][1].toString()]    
        } else {
            skill.equipedConditions = [skillIn.requirements.map(a => a[1].toString())];
        }
                                                           
        var condensedSkills = [{}];
        addEffectsToEffectList(condensedSkills, tmrAbilityEffects);
        for (var i = 0, len = condensedSkills.length; i < len; i++) {
            if (!condensedSkills[i].equipedConditions) {
                condensedSkills[i].equipedConditions = [];
            }
            condensedSkills[i].equipedConditions = condensedSkills[i].equipedConditions.concat(skill.equipedConditions);
            skillsOut.push(condensedSkills[i]);    
        }
    }
    
    return skill;
}

function addEffectsToEffectList(effectList, effects) {
    for (var effectIndex = 0, lenEffectIndex = effects.length; effectIndex < lenEffectIndex; effectIndex++) {
        var effect = effects[effectIndex];
        if (effect.equipedConditions || effect.exclusiveUnits || effect.exclusiveSex) {
            effectList.push(effect);
        } else {
            
            for (var i = baseStats.length; i--;) {
                if (effect[baseStats[i]]) {
                    addToStat(effectList[0], baseStats[i], effect[baseStats[i]]);
                }
                if (effect[baseStats[i] + "%"]) {
                    addToStat(effectList[0], baseStats[i] + "%", effect[baseStats[i] + "%"]);
                }
            }
            if (effect.special) {
                for (var i = 0, len = effect.special.length; i < len; i++) {
                    addToList(effectList[0],"special",effect.special[i]);
                }
            }
            if (effect.element) {
                for (var i = 0, len = effect.element.length; i < len; i++) {
                    addToList(effectList[0],"element",effect.element[i]);
                }
            }   
            if (effect.killers) {
                for (var i = 0, len = effect.killers.length; i < len; i++) {
                    addKiller(effectList[0], effect.killers[i].name, effect.killers[i].physical || 0, effect.killers[i].magical || 0);
                }
            }
            if (effect.resist) {
                for (var i = 0, len = effect.resist.length; i < len; i++) {
                    addToResistList(effectList[0], effect.resist[i]);
                }
            }
            if (effect.ailments) {
                for (var i = 0, len = effect.ailments.length; i < len; i++) {
                    addToAilmentsList(effectList[0], effect.ailments[i]);
                }
            }
            if (effect.improvedDW) {
                effectList[0].improvedDW = true;
            }
            const simpleValues = ["evoMag", "accuracy", "jumpDamage","lbFillRate", "mpRefresh", "lbDamage"];
            for (var i = simpleValues.length; i--;) {
                if (effect[simpleValues[i]]) {
                    addToStat(effectList[0], simpleValues[i], effect[simpleValues[i]]);
                }
            }
            const baseStatsBasedValues = ["singleWielding","singleWieldingOneHanded","dualWielding","esperStatsBonus"];
            const baseStatsWithAccuracy = baseStats.concat(["accuracy"]);
            for (var i = baseStatsBasedValues.length; i--;) {
                if (effect[baseStatsBasedValues[i]]) {
                    if (!effectList[0][baseStatsBasedValues[i]]) {
                        effectList[0][baseStatsBasedValues[i]] = {};
                    }
                    for (var j = baseStatsWithAccuracy.length; j--;) {
                        if (effect[baseStatsBasedValues[i]][baseStatsWithAccuracy[j]]) {
                            addToStat(effectList[0][baseStatsBasedValues[i]], baseStatsWithAccuracy[j], effect[baseStatsBasedValues[i]][baseStatsWithAccuracy[j]]);
                        }
                    }
                }
            }
            if (effect.evade) {
                if (!effectList[0].evade) {
                    effectList[0].evade = {};
                }
                addToStat(effectList[0].evade, "physical", effect.evade.physical);
                addToStat(effectList[0].evade, "magical", effect.evade.magical);
            }
            if (effect.lbPerTurn) {
                if (!effectList[0].lbPerTurn) {
                    effectList[0].lbPerTurn = {};
                }
                addToStat(effectList[0].lbPerTurn, "min", effect.lbPerTurn.min);
                addToStat(effectList[0].lbPerTurn, "max", effect.lbPerTurn.max);
            }
            if (effect.partialDualWield) {
                for (var i = 0, len = effect.partialDualWield.length; i < len; i++) {
                    addToList(effectList[0],"partialDualWield",effect.partialDualWield[i]);
                }
            }
            if (effect.drawAttacks) {
                addToStat(effectList[0], "drawAttacks", effect.drawAttacks);
            }
            if (effect.autoCastedSkill) {
                for (var autoCastedSkillIndex = effect.autoCastedSkill.effects.length; autoCastedSkillIndex--;) {
                    var autoCastedEffect = effect.autoCastedSkill.effects[autoCastedSkillIndex];
                    if (autoCastedEffect.effect && autoCastedEffect.effect.resist && autoCastedEffect.effect.turns == -1) {
                        addEffectsToEffectList(effectList, [autoCastedEffect.effect]);
                    }
                }
            }
            if (effect.skillEnhancement) {
                if (!effectList[0].skillEnhancement) {
                    effectList[0].skillEnhancement = {};
                }
                for (var skillId in effect.skillEnhancement) {
                    if (!effectList[0].skillEnhancement[skillId]) {
                        effectList[0].skillEnhancement[skillId] = 0;
                    }
                    effectList[0].skillEnhancement[skillId] += effect.skillEnhancement[skillId];
                }
            }
            if (effect.replaceLb) {
                effectList[0].replaceLb = effect.replaceLb;
            }
        }
    }
}

function parsePassiveRawEffet(rawEffect, skills, unit, lbs) {
    var result = {};
    // stat bonus
    if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 1) {               
        var effectData = rawEffect[3];
        addToStat(result, "hp%", effectData[4]);
        addToStat(result, "mp%", effectData[5]);
        addToStat(result, "atk%", effectData[0]);
        addToStat(result, "def%", effectData[1]);
        addToStat(result, "mag%", effectData[2]);
        addToStat(result, "spr%", effectData[3]);
        return [result];

    // DW
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 14) {               
        var types = rawEffect[3]
        if (types.length == 1 && types[0] == "none") {
            addToList(result,"special","dualWield");
        } else {
            for(var partialDualWieldIndex in types) {
                addToList(result,"partialDualWield",typeMap[types[partialDualWieldIndex]]);
            }                    
        }
        return [result];
    }

    // Killers
    else if (((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 11) ||
        (rawEffect[0] == 1 && rawEffect[1] == 1 && rawEffect[2] == 11)) {
        var killerData = rawEffect[3];
        
        var killerRaces = killerData[0];
        var physicalPercents = killerData[1];
        var magicalPercents = killerData[2];
        
        if (!Array.isArray(killerRaces)) {
            killerRaces = [killerRaces];
            physicalPercents = [physicalPercents];
            magicalPercents = [magicalPercents];
        } else {
            if (!Array.isArray(physicalPercents)) {
                physicalPercents = Array(killerRaces.length).fill(physicalPercents)
            }
            if (!Array.isArray(magicalPercents)) {
                magicalPercents = Array(killerRaces.length).fill(magicalPercents)
            }
        }
        
        for (var raceIndex = 0; raceIndex < killerRaces.length; raceIndex++) {
            addKiller(result, raceMap[killerRaces[raceIndex]], physicalPercents[raceIndex], magicalPercents[raceIndex]);    
        }
        
        return [result];
    }

    // physical evade
    else if (rawEffect[1] == 3 && rawEffect[2] == 22) {
        result.evade = {"physical":rawEffect[3][0]}
        return [result];
    }

    // magical evade
    else if (rawEffect[1] == 3 && rawEffect[2] == 54 && rawEffect[3][0] == -1) {
        result.evade = {"magical":rawEffect[3][1]}
        return [result];
    }

    // Mastery
    else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 6) {
        var masteryEffect = rawEffect[3];
        var masteryType = typeMap[masteryEffect[0]];
        var result = {"equipedConditions":[masteryType]};

        if (masteryEffect.length > 5) {
            if (masteryEffect[5]) {
                result["hp%"] = masteryEffect[5]
            }
            if (masteryEffect[6]) {
                result["mp%"] = masteryEffect[6]
            }
        }
        if (masteryEffect[1]) {
            result["atk%"] = masteryEffect[1]
        }
        if (masteryEffect[2]) {
            result["def%"] = masteryEffect[2]
        }
        if (masteryEffect[3]) {
            result["mag%"] = masteryEffect[3]
        }
        if (masteryEffect[4]) {
            result["spr%"] = masteryEffect[4]
        }
        return [result];
    }

    // unarmed
    else if (rawEffect[1] == 3 && rawEffect[2] == 19) {
        var masteryEffect = rawEffect[3];    
        var result = {"equipedConditions":["unarmed"]};

        if (masteryEffect[0]) {
            result["atk%"] = masteryEffect[0]
        }
        if (masteryEffect[1]) {
            result["def%"] = masteryEffect[1]
        }
        if (masteryEffect[2]) {
            result["mag%"] = masteryEffect[2]
        }
        if (masteryEffect[3]) {
            result["spr%"] = masteryEffect[3]
        }
        return [result];
    }

    // element based mastery
    else if (rawEffect[1] == 3 && rawEffect[2] == 10004) {
        var masteryEffect = rawEffect[3];
        result = [];
        var result = {};
        if (Array.isArray(masteryEffect[0])) {
            result.equipedConditions = [masteryEffect[0].map(x => elementsMap[x])]
        } else {
            result.equipedConditions = [elementsMap[masteryEffect[0]]];
        }
        if (masteryEffect[3]) {
            result["atk%"] = masteryEffect[3];
        }
        if (masteryEffect[5]) {
            result["def%"] = masteryEffect[5];
        }
        if (masteryEffect[4]) {
            result["mag%"] = masteryEffect[4];
        }
        if (masteryEffect[6]) {
            result["spr%"] = masteryEffect[6];
        }
        if (masteryEffect[1]) {
            result["hp%"] = masteryEffect[1];
        }
        if (masteryEffect[2]) {
            result["mp%"] = masteryEffect[2];
        }
        return [result];
    }

    //doublehand
    else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 13) {
        if (rawEffect[3].length == 3 && rawEffect[3][2] == 2) {
            result.singleWielding = {};
            addToStat(result.singleWielding, "atk", rawEffect[3][0]);
            addToStat(result.singleWielding, "accuracy", rawEffect[3][1]);
        } else {
            result.singleWieldingOneHanded = {};
            addToStat(result.singleWieldingOneHanded, "atk", rawEffect[3][0]);
            addToStat(result.singleWieldingOneHanded, "accuracy", rawEffect[3][1]);
        }
        return [result];
    }
    else if (rawEffect[1] == 3 && rawEffect[2] == 10003) {
        var doublehandResult = {};
        var doublehandEffect = rawEffect[3];
        if (doublehandEffect.length == 7 && doublehandEffect[6] == 1) {
            result.singleWielding = {};
            doublehandResult = result.singleWielding;
        } else {
            result.singleWieldingOneHanded = {};
            doublehandResult = result.singleWieldingOneHanded;
        }
        if (doublehandEffect[2]) {
            addToStat(doublehandResult, "atk", doublehandEffect[2]);
        }
        if (doublehandEffect[4]) {
            addToStat(doublehandResult, "def", doublehandEffect[4]);
        }
        if (doublehandEffect[3]) {
            addToStat(doublehandResult, "mag", doublehandEffect[3]);
        }
        if (doublehandEffect[5]) {
            addToStat(doublehandResult, "spr", doublehandEffect[5]);
        }
        if (doublehandEffect[0]) {
            addToStat(doublehandResult, "hp", doublehandEffect[0]);
        }
        if (doublehandEffect[1]) {
            addToStat(doublehandResult, "mp", doublehandEffect[1]);
        }
        return [result];

    // MAG DH
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 70) {
        if (rawEffect[3][2] == 0) {
            result.singleWieldingOneHanded = {};
            addToStat(result.singleWieldingOneHanded,"mag",rawEffect[3][0]);    
        } else if (rawEffect[3][2] == 2) {
            result.singleWielding = {};
            addToStat(result.singleWielding,"mag",rawEffect[3][0]);    
        }
        return [result];
        
    // +EQ stat when dual wielding
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 69) {
        result.dualWielding = {};
        var stat;
        if (rawEffect[3][0] == 1) {
            stat = "atk";
        } else if (rawEffect[3][0] == 2) {
            stat = "def";
        } else if (rawEffect[3][0] == 3) {
            stat = "mag";
        } else if (rawEffect[3][0] == 4) {
            stat = "spr";
        }
        addToStat(result.dualWielding, stat, rawEffect[3][1]);
        return [result];

    // Element Resist
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 3) {
        addElementalResist(result, rawEffect[3]);
        return [result];

    // Ailments Resist
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 2) {
        addAilmentResist(result, rawEffect[3]);
        return [result];

    // MP refresh
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 32) {
        var mpRefresh = rawEffect[3][0];
        addToStat(result, "mpRefresh", mpRefresh);
        return [result];

    // LB/turn
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 33) {
        var lbPerTurn = rawEffect[3][0]/100;
        addLbPerTurn(result, lbPerTurn, lbPerTurn);
        return [result];

    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 125) {
        var lbPerTurnMin = rawEffect[3][0]/100;
        var lbPerTurnMax = rawEffect[3][1]/100;
        addLbPerTurn(result, lbPerTurnMin, lbPerTurnMax);
        return [result];

    // LB fill rate
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 31) {
        var lbFillRate = rawEffect[3][0];
        addToStat(result, "lbFillRate", lbFillRate);
        return [result];

    // +Jump damage
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 17) {
        var jumpDamage = rawEffect[3][0];
        addToStat(result, "jumpDamage", jumpDamage);
        return [result];
    
    // +LB Damage
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 68) {
        var lbDamage = rawEffect[3][0];
        addToStat(result, "lbDamage", lbDamage);
        return [result];

    // +EVO Mag
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 21) {
        var evoMag = rawEffect[3][0];
        addToStat(result, "evoMag", evoMag);
        return [result];

    // +Stats from espers boost
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 63) {
        var esperStatsBonus = rawEffect[3];
        result.esperStatsBonus = {};
        addToStat(result.esperStatsBonus, "hp", esperStatsBonus[0]);
        addToStat(result.esperStatsBonus, "mp", esperStatsBonus[1]);
        addToStat(result.esperStatsBonus, "atk", esperStatsBonus[2]);
        addToStat(result.esperStatsBonus, "def", esperStatsBonus[3]);
        addToStat(result.esperStatsBonus, "mag", esperStatsBonus[4]);
        addToStat(result.esperStatsBonus, "spr", esperStatsBonus[5]);
        return [result];

    // Counter
    } else if (rawEffect[2] == 49) { 
        result = {};
        var skillIn = skills[rawEffect[3][2]];
        if (skillIn) {
            result.counterSkill = parseActiveSkill(rawEffect[3][2], skillIn, skills, unit);
            result.counterType = "physical";
            result.percent = rawEffect[3][0];
            return [result];
        }
        
    } else if (rawEffect[2] == 50) { 
        result = {};
        var skillIn = skills[rawEffect[3][2]];
        result.counterSkill = parseActiveSkill(rawEffect[3][2], skillIn, skills, unit);
        result.counterType = "magical";
        result.percent = rawEffect[3][0];
        return [result];
        
    // Gilgamesh multi equip skill
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 74) {
        var result = [];
        var conditions = rawEffect[3][0];
        if (!Array.isArray(rawEffect[3][0])) {
            conditions = [rawEffect[3][0]];
        }
        for (var i = conditions.length; i--;) {
            var gilgameshSkill = {"equipedConditions":[conditions[i].toString()]};
            gilgameshSkill["atk%"] = rawEffect[3][1];
            gilgameshSkill["def%"] = rawEffect[3][2];
            gilgameshSkill["mag%"] = rawEffect[3][3];
            gilgameshSkill["spr%"] = rawEffect[3][4];
            gilgameshSkill["hp%"] = rawEffect[3][5];
            gilgameshSkill["mp%"] = rawEffect[3][6];
            result.push(gilgameshSkill);
        }
        return result;

    // equipment type conditionned killers
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 75) {
        var typeArray;
        if (Array.isArray(rawEffect[3][0])) {
            typeArray = rawEffect[3][0];
        } else {
            typeArray = [rawEffect[3][0]];
        }
        result = [];
        for (var i = typeArray.length; i--;) {
            var conditionnedKillerSKill = {"equipedConditions":[typeMap[typeArray[i]]]};
            var killerData = rawEffect[3];

            var killerRace = raceMap[killerData[1]];
            var physicalPercent = killerData[2];
            var magicalPercent = killerData[3];
            addKiller(conditionnedKillerSKill, killerRace, physicalPercent, magicalPercent);

            result.push(conditionnedKillerSKill);
        }
        return result;

    // equipment type conditionned element resistance
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 76) {
        var typeArray;
        if (Array.isArray(rawEffect[3][0])) {
            typeArray = rawEffect[3][0];
        } else {
            typeArray = [rawEffect[3][0]];
        }
        result = [];
        for (var i = typeArray.length; i--;) {
            var conditionnedElementalResistSKill = {"equipedConditions":[typeMap[typeArray[i]]]};

            var elementalResist = rawEffect[3].slice();
            elementalResist.splice(0,1);
            addElementalResist(conditionnedElementalResistSKill, elementalResist);

            result.push(conditionnedElementalResistSKill);
        }
        return result;
    
    // Auto cast at start of fight
    } else if (rawEffect[2] == 56) { 
        result = {};
        var skillIn = skills[rawEffect[3][0]];
        if (skillIn) {
            var autoCastedSkill = parseActiveSkill(rawEffect[3][0], skillIn, skills, unit);
            result.autoCastedSkill = autoCastedSkill;
            return [result];
        }
        
    // Draw attacks
    } else if ((rawEffect[0] == 0 || rawEffect[0] == 1) && rawEffect[1] == 3 && rawEffect[2] == 24) {
        var drawAttacks = rawEffect[3][0];
        addToStat(result, "drawAttacks", drawAttacks);
        return [result];
    
    // ST Cover
    } else if (rawEffect[2] == 8) {
        result.stCover = {};
        if (rawEffect[3][0] == 1) {
            result.stCover.exclusiveSex = "female";    
        }
        result.stCover.chance = rawEffect[3][4];
        result.stCover.mitigation = {"min": rawEffect[3][2], "max": rawEffect[3][3]};
        return [result];


        // Break, stop and charm resistance
    } else if (rawEffect[2] == 55) {
        result = {resist:[]};
        if (rawEffect[3][0]) {
            result.resist.push({"name":"break_atk", "percent":rawEffect[3][0]})
        }
        if (rawEffect[3][1]) {
            result.resist.push({"name":"break_def", "percent":rawEffect[3][1]})
        }
        if (rawEffect[3][2]) {
            result.resist.push({"name":"break_mag", "percent":rawEffect[3][2]})
        }
        if (rawEffect[3][3]) {
            result.resist.push({"name":"break_spr", "percent":rawEffect[3][3]})
        }
        if (rawEffect[3][4]) {
            result.resist.push({"name":"stop", "percent":rawEffect[3][4]})
        }
        if (rawEffect[3][5]) {
            result.resist.push({"name":"charm", "percent":rawEffect[3][5]})
        }
        return [result];

    // Skill enhancement
    } else if (rawEffect[2] == 73) {
        result.skillEnhancement = {};
        if (Array.isArray(rawEffect[3][0])) {
            for (var i = rawEffect[3][0].length; i--;) {
                result.skillEnhancement[rawEffect[3][0][i].toString()] = rawEffect[3][3] / 100;
            }
        } else {
            result.skillEnhancement[rawEffect[3][0].toString()] = rawEffect[3][3] / 100;
        }
        return [result];
    
    // Dualcast
    } else if (rawEffect[2] == 45) {
        return [{
            "multicast": {
                "time": 2,
                "type": "magic"
            }
        }];
        
    // Dual White Magic
    } else if (rawEffect[2] == 52) {
        var magicType = "";
        if (rawEffect[3][0] ==  0) {
            magicType = "magic";
        } else if (rawEffect[3][0] ==  1) {
            magicType = "blackMagic";
        } else if (rawEffect[3][0] ==  2) {
            magicType = "whiteMagic";
        }
        return [{
            "multicast": {
                "time": rawEffect[3][1],
                "type": magicType
            }
        }];
    
    // Dual Black Magic
    } else if (rawEffect[2] == 44) {
        return [{
            "multicast": {
                "time": 2,
                "type": "blackMagic"
            }
        }]
        
    // Skill multicast
    } else if (rawEffect[2] == 53) {
        result = {
            "multicast": {
                "time": rawEffect[3][0],
                "type": "skills",
                "skills":[]
            }
        }
        for (var i = 0, len = rawEffect[3][3].length; i < len; i++) {
            var skill = skills[rawEffect[3][3][i]];
            if (!skill) {
                console.log('Unknown skill : ' + rawEffect[3][3][i] + ' - ' + JSON.stringify(rawEffect));
                continue;
            }
            result.multicast.skills.push({"id": rawEffect[3][3][i].toString(), "name":skill.name});
        }
        return [result];
        
    // Replace LB
    } else if (rawEffect[2] == 72) {
        
        var lbIn = lbs[rawEffect[3][0]];
        console.log(JSON.stringify(rawEffect));
        var lb = parseLb(lbIn, unit, skills);
        result = {
            "replaceLb": lb
        }
        return [result];
        
    // Increase maximum true double-wield bonus to 200%, Allow unit to reach 6x chain modifier, when using two one-handed weapons
    } else if (rawEffect[3] && rawEffect[2] == 81) {
        
        result = {
            "improvedDW": true
        }
        return [result];
    }
    return null;
}

function parseActiveSkill(skillId, skillIn, skills, unit, enhancementLevel = 0) {
    var skill = {"id": skillId , "name" : skillIn.name, "icon": skillIn.icon, "effects": []};
    if (skillIn.type == "MAGIC") {
        skill.magic = skillIn.magic_type.toLocaleLowerCase();
    }
    if (enhancementLevel) {
        skill.name += " +" + enhancementLevel;
    }
    
    for (var rawEffectIndex in skillIn["effects_raw"]) {
        var rawEffect = skillIn["effects_raw"][rawEffectIndex];

        var effect = parseActiveRawEffect(rawEffect, skillIn, skills, unit, skillId, enhancementLevel);
        if (effect && effect.id) {
            if (skillIn["effects_raw"].lenght > 1) {
                console.error("Exited skill before parsing all effects");
                console.error(skillIn);
            }
            return effect;
        }
        skill.effects.push({"effect":effect, "desc": skillIn.effects[rawEffectIndex]});
    }
    return skill;
}

function parseLb(lb, unit, skills) {
    var lbOut = {"name": lb.name, minEffects: [], "maxEffects":[]}
    for (var rawEffectIndex in lb.levels[0][1]) {
        var rawEffect = lb.levels[0][1][rawEffectIndex];

        var effect = parseActiveRawEffect(rawEffect, lb, skills, unit, 0);
        lbOut.minEffects.push({"effect":effect, "desc": lb.min_level[rawEffectIndex]});
    }
    for (var rawEffectIndex in lb.levels[lb.levels.length - 1][1]) {
        var rawEffect = lb.levels[lb.levels.length - 1][1][rawEffectIndex];

        var effect = parseActiveRawEffect(rawEffect, lb, skills, unit, 0);
        lbOut.maxEffects.push({"effect":effect, "desc": lb.max_level[rawEffectIndex]});
    }
    return lbOut;
}

function parseActiveRawEffect(rawEffect, skillIn, skills, unit, skillId, enhancementLevel = 0) {
    var result = null;
    
    // break
    if (rawEffect[2] == 24) { 
        result = {};
        if (rawEffect[1] == 1) {
            addBreak(result, rawEffect[3]);
        } else {
            addStatsBuff(result, rawEffect[3]);
        }
    
    // Randomly use skills
    } else if (rawEffect[2] == 29) { 
        result = {"randomlyUse": []};
        for (var i = 0, len = rawEffect[3].length; i < len; i++) {
            var data = rawEffect[3][i];
            if (data && data[0] && skills[data[0]]) {
                var skillIn = skills[data[0]];
                var skill = parseActiveSkill(data[0], skillIn, skills, unit);
                result.randomlyUse.push({"skill":skill, "percent":data[1]});
            }
        }
        
    // Imperil
    } else if (rawEffect[2] == 33) { 
        result = {};
        var imperilData = rawEffect[3];
        if (rawEffect[1] == 1) {
            addImperil(result, imperilData);
        } else {
            addElementalResist(result, imperilData);
            result.turns = imperilData[9];
        }
    
    // Status ailment resistance
    } else if (rawEffect[2] == 7) { 
        result = {};
        var ailmentsData = rawEffect[3];
        addAilmentResist(result, ailmentsData);
        result.turns = ailmentsData[9];
        
    // Break, stop and charm resistance with turn number
    } else if (rawEffect[2] == 89 || rawEffect[2] == 55) {
        result = {resist:[]};
        if (rawEffect[3][0]) {
            result.resist.push({"name":"break_atk", "percent":rawEffect[3][0]})
        }
        if (rawEffect[3][1]) {
            result.resist.push({"name":"break_def", "percent":rawEffect[3][1]})
        }
        if (rawEffect[3][2]) {
            result.resist.push({"name":"break_mag", "percent":rawEffect[3][2]})
        }
        if (rawEffect[3][3]) {
            result.resist.push({"name":"break_spr", "percent":rawEffect[3][3]})
        }
        if (rawEffect[3][4]) {
            result.resist.push({"name":"stop", "percent":rawEffect[3][4]})
        }
        if (rawEffect[3][5]) {
            result.resist.push({"name":"charm", "percent":rawEffect[3][5]})
        }
        result.turns = rawEffect[3][6];

    // Killers
    } else if (rawEffect[2] == 92) { 
        result = {};
        var killersData = rawEffect[3];
        for (var i = 0; i < 8; i++) {
            if (killersData[i] == -1) {
                break;
            }
            addKiller(result, raceMap[killersData[i][0]], killersData[i][1], 0);
        }
        result.turns = killersData[8];
    } else if (rawEffect[2] == 93) { 
        result = {};
        var killersData = rawEffect[3];
        for (var i = 0; i < 8; i++) {
            if (killersData[i] == -1) {
                break;
            }
            addKiller(result, raceMap[killersData[i][0]], 0, killersData[i][1]);
        }
        result.turns = killersData[8];
        
        
    // Imbue
    } else if (rawEffect[2] == 95) { 
        result = {"imbue":[]};
        var imbueData = rawEffect[3];
        for (var index in elements) {
            if (imbueData[index]) {
                result.imbue.push(elements[index]);
            }
        }
        result.turns = imbueData[8];
        
    // Cooldown skills
    } else if (rawEffect[2] == 130) { 
        
        var skillIn = skills[rawEffect[3][0]];
        if (skillIn) {
            result = {};
            result.cooldownSkill = parseActiveSkill(rawEffect[3][0], skillIn, skills, unit);
            result.cooldownTurns = rawEffect[3][2][0] + 1;
            result.startTurn = result.cooldownTurns - rawEffect[3][2][1];
        }
    
    // Draw attacks
    } else if (rawEffect[2] == 61) {
        result = {"drawAttacks":rawEffect[3][0], "turns": rawEffect[3][1]};
        
    // Stat buff
    } else if (rawEffect[2] == 3) {
        result = {};
        addStatsBuff(result, rawEffect[3]);
        
    // AOE Cover
    } else if (rawEffect[2] == 96) {
        result = {"aoeCover":{}, "turns": rawEffect[3][6]};
        result.aoeCover.type = (rawEffect[3][rawEffect[3].length - 1] == 1 ? "physical": "magical");
        result.aoeCover.mitigation = {"min": rawEffect[3][2], "max": rawEffect[3][3]};
        result.aoeCover.chance = rawEffect[3][4];
    
    // Conditional skills
    } else if (rawEffect[2] == 99) {
        result = {};
        
        var skillId1 = rawEffect[3][5].toString();
        var skillIn1 = skills[skillId1];
        var skill1 = parseActiveSkill(skillId1, skillIn1, skills, unit, enhancementLevel);
        
        var skillId2 = rawEffect[3][3].toString();
        var skillIn2 = skills[skillId2];
        var skill2 = parseActiveSkill(skillId2, skillIn2, skills, unit, enhancementLevel);
        skill2.ifUsedLastTurn = [];
        if (Array.isArray(rawEffect[3][1])) {
            for (var i = 0, len = rawEffect[3][1].length; i < len; i++) {
                var skill = skills[rawEffect[3][1][i]];
                skill2.ifUsedLastTurn.push({"id":rawEffect[3][1][i], "name":skill.name});
            }
        } else {
            var skill = skills[rawEffect[3][1]];
            skill2.ifUsedLastTurn.push({"id":rawEffect[3][1], "name":skill.name});
        }
        addUnlockedSkill(skillId1, skill2, unit);
        return skill1;
        
    // Magical Damage
    } else if (rawEffect[2] == 15) {
        if (rawEffect[3].length != 6 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0 && rawEffect[3][2] != 0 && rawEffect[3][3] != 0 && rawEffect[3][4] != 0) {
            console.log("Strange Magic damage");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"magical", "damageType":"mind", "coef":rawEffect[3][5]/100}};
        
    // Physical Damage
    } else if (rawEffect[2] == 1) {
        if (rawEffect[3].length != 7 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0 && rawEffect[3][2] != 0 && rawEffect[3][3] != 0 && rawEffect[3][4] != 0  && rawEffect[3][5] != 0) {
            console.log("Strange Physic damage");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][6]/100}};
        
    // Physical Damage with ignore DEF
    } else if (rawEffect[2] == 21) {
        if (rawEffect[3].length != 4 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0) {
            console.log("Strange Physic damage with ignoe DEF");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][2]/100, "ignore":{"def":-rawEffect[3][3]}}};
        
    // Magical Damage with ignore SPR
    } else if (rawEffect[2] == 70) {
        if (rawEffect[3].length != 4 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0) {
            console.log("Strange Magic damage with ignoe SPR");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"magical", "damageType":"mind", "coef":rawEffect[3][2]/100, "ignore":{"spr":rawEffect[3][3]}}};
    
    // Physical Damage from DEF
    } else if (rawEffect[2] == 102) {
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][2]/100, use: {"stat":"def", "percent":rawEffect[3][0], "max":rawEffect[3][1]}}};
        
    // Magical Damage from SPR
    } else if (rawEffect[2] == 103) {
        result = {"damage":{"mecanism":"magical", "damageType":"mind", "coef":rawEffect[3][2]/100, use: {"stat":"spr", "percent":rawEffect[3][0], "max":rawEffect[3][1]}}};
        
    // Magical Damage with stacking
    } else if (rawEffect[2] == 72) {
        result = {"damage":{"mecanism":"magical", "damageType":"mind", "coef":(rawEffect[3][2] + rawEffect[3][3])/100, "stack":rawEffect[3][4]/100, "maxStack":rawEffect[3][5] - 1}};    
        
    // Physical Damage with stacking
    } else if (rawEffect[2] == 126) {
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":(rawEffect[3][3] + rawEffect[3][4])/100, "stack":rawEffect[3][5]/100, "maxStack":rawEffect[3][6] - 1}};    
        
    // Jump damage
    } else if (rawEffect[2] == 52) {
        if (rawEffect[3].length != 5 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0 && rawEffect[3][2] != rawEffect[3][3]) {
            console.log("Strange Jump damage");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][4]/100, "jump":true, delay:rawEffect[3][3]}};
        
    // Delayed damage
    } else if (rawEffect[2] == 13) {
        if (rawEffect[3].length != 6 && rawEffect[3][1] != 0 && rawEffect[3][2] != 0) {
            console.log("Strange Delayed damage");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][5]/100, delay:rawEffect[3][0]}};
        
    // Timed Jump
    } else if (rawEffect[2] == 134) {
        if (rawEffect[3].length != 5 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0 && rawEffect[3][2] != rawEffect[3][3]) {
            console.log("Strange Timed Jump damage");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][4]/100, "jump":true, delay:rawEffect[3][2]}};
        
    // Combo damage
    } else if (rawEffect[2] == 42) {
        if (rawEffect[3].length != 5 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0) {
            console.log("Strange Combo");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][4]/100, "combo": true, "minTime":rawEffect[3][2], "maxTime":rawEffect[3][3]}};    
        
    // Hybrid damage
    } else if (rawEffect[2] == 40) {
        if (rawEffect[3].length != 10 && rawEffect[3][0] != 0 && rawEffect[3][1] != 0 && rawEffect[3][2] != 0 && rawEffect[3][3] != 0 && rawEffect[3][4] != 0 && rawEffect[3][5] != 0 && rawEffect[3][6] != 0 && rawEffect[3][7] != 0 && rawEffect[3][8] != rawEffect[3][9]) {
            console.log("Strange hybrid damage");
            console.log(rawEffect);
        }
        result = {"damage":{"mecanism":"hybrid", "coef":rawEffect[3][8]/100}};    
    // Evo Damage
    } else if(rawEffect[2] == 124){
        result = {"damage":{"mecanism":"summonerSkill", "damageType":"evoke", "magCoef":rawEffect[3][7]/100, "sprCoef":rawEffect[3][8]/100, "magSplit":0.5, "sprSplit":0.5}};
        if (rawEffect[3].length >= 10 && Array.isArray(rawEffect[3][9])) {
            result.damage.magSplit = rawEffect[3][9][0] / 100;
            result.damage.sprSplit = rawEffect[3][9][1] / 100;
        }
    // Healing
    } else if(rawEffect[2] == 2){
        result= {"heal":{"base":rawEffect[3][2], "coef":rawEffect[3][3]/100}}
    // Healing over time
    } else if(rawEffect[2] == 8){
        result={"heal":{"base":rawEffect[3][2], "coef":rawEffect[3][0]/100, "split":rawEffect[3][3]}}
    // Damage increased against a race
    } else if (rawEffect[2] == 22) {
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":1, "ifUsedAgain":{"race":raceMap[rawEffect[3][0]], "coef":rawEffect[3][3]/100}}};

    // Critical Physical Damage
    } else if (rawEffect[2] == 43) {
        result = {"damage":{"mecanism":"physical", "damageType":"body", "coef":rawEffect[3][2]*1.5/100}};

    // inflict status
    } else if (rawEffect[2] == 6) {
        result = {"noUse":true};
        
    // inflict stop
    } else if (rawEffect[2] == 88) {
        result = {"noUse":true};

        // inflict charm
    } else if (rawEffect[2] == 60) {
        result = {"noUse":true};

        // recover MP
    } else if (rawEffect[2] == 17) {
        result = {"noUse":true};

       //Global mitigation
    } else if (rawEffect[2] == 101) {
        result = {"noUse":true, "globalMitigation":rawEffect[3][0], "turns":rawEffect[3][1]};
        //Magical mitigation
    } else if (rawEffect[2] == 19) {
        result = {"noUse":true, "magicalMitigation":rawEffect[3][0], "turns":rawEffect[3][1]};
        //Physical mitigation
    } else if (rawEffect[2] == 18) {
        result = {"noUse":true, "physicalMitigation":rawEffect[3][0], "turns":rawEffect[3][1]};
        // recover HP/MP percentage
    } else if (rawEffect[2] == 65) {
        result = {"noUse":true};

        // auto cast skill later
    } else if (rawEffect[2] == 132) {
        result = {"noUse":true};
        
    // cure breaks
    } else if (rawEffect[2] == 111) {
        result = {"noUse":true};
        
        // auto reraise
    } else if (rawEffect[2] == 27) {
        result = {"noUse":true};
    
        // Dodge x physical attacks
    } else if (rawEffect[2] == 54) {
        result = {"noUse":true};
        
        // HP barrier
    } else if (rawEffect[2] == 127) {
        result = {"noUse":true};
        
        // Dualcast
    } else if (rawEffect[2] == 45) {
        return {
            "multicast": {
                "time": 2,
                "type": "magic"
            }
        };
        
    
    // Dual Black Magic
    } else if (rawEffect[2] == 44) {
        return {
            "multicast": {
                "time": 2,
                "type": "blackMagic"
            }
        }
        
    // +LB damage
    } else if (rawEffect[2] == 120) {
        result = {"statsBuff":{"lbDamage":rawEffect[3][0]}, "turns":rawEffect[3][1]};
        
    // +LB
    } else if (rawEffect[2] == 125) {
        result = {"lbFill":{"min":rawEffect[3][0]/100, "max":rawEffect[3][1]/100}};    
    
        
        
        
    // Gain Skill
    } else if (rawEffect[2] == 97) {
        
        let magicType;
        let magicTypeLabel
        if (rawEffect[3][0] == 0) {
            magicType = "magic";
            magicTypeLabel = "magic";
        } else if(rawEffect[3][0] == 1) {
            magicType = "blackMagic";
            magicTypeLabel = "black magic";
        } else if(rawEffect[3][0] == 2) {
            magicType = "whiteMagic";
            magicTypeLabel = "white magic";
        }
        var gainedSkillId = rawEffect[3][2].toString();
        var gainedSkill = skills[gainedSkillId];
        
        var multicastskill = {
            "id":gainedSkillId,
            "name":gainedSkill.name,
            "icon":gainedSkill.icon,
            "effects":[{
                    "effect":{
                        "multicast":{"time":rawEffect[3][1],"type":magicType}
                    },
                    "desc":"Enable unit to cast " + rawEffect[3][1] + " " + magicTypeLabel + " spells"
            }]
        };
        
        result = {
            "gainSkills": {
                "turns": rawEffect[3][4] - 1,
                "skills": [multicastskill]
            }
        }
        
        addUnlockedSkill(gainedSkillId, multicastskill, unit, skillIn);
            
        return result;
        
    // Gain Skill
    } else if (rawEffect[2] == 100) {
        result = {
            "gainSkills": {
                "turns": rawEffect[3][4] - 1,
                "skills": []
            }
        }
        var gainedSkillIds;
        if (Array.isArray(rawEffect[3][1])) {
            gainedSkillIds = rawEffect[3][1];
        } else {
            gainedSkillIds = [rawEffect[3][1]];
        }
        for (var i = 0, len = gainedSkillIds.length; i < len; i++) {
            var gainedSkill = skills[gainedSkillIds[i].toString()];
            var gainedSkillName;
            if (!gainedSkill) {
                gainedSkillName = "UNKNOWN SKILL";
            } else {
                gainedSkillName = gainedSkill.name;
            }
            result.gainSkills.skills.push({
                "id":gainedSkillIds[i].toString(),
                "name":gainedSkillName
            });
            
            if (gainedSkill) {
                if (!unit.unlockedSkillAdded) {
                    unit.unlockedSkillAdded = [];
                }
                if (!unit.unlockedSkillAdded.includes(gainedSkillIds[i].toString())) {
                    unit.unlockedSkillAdded.push(gainedSkillIds[i].toString())
                    addUnlockedSkill(gainedSkillIds[i].toString(), parseActiveSkill(gainedSkillIds[i].toString(), gainedSkill, skills, unit), unit, skillIn);
                }
            }
        }
        
    // Gain Multicast ability
    } else if (rawEffect[2] == 98) {
        var gainedSkillId = rawEffect[3][1].toString();
        
        var gainedSkill = skills[gainedSkillId];
        if (gainedSkill) {
            gainedEffect = {
                "multicast": {
                    "time": rawEffect[3][0],
                    "type": "skills",
                    "skills":[]
                }
            }
            for (var i = 0, len = rawEffect[3][3].length; i < len; i++) {
                var skill = skills[rawEffect[3][3][i]];
                gainedEffect.multicast.skills.push({"id": rawEffect[3][3][i].toString(), "name":skill.name});
            }
            var parsedSkill = {"id": gainedSkillId , "name" : gainedSkill.name, "icon": gainedSkill.icon, "effects": [
                {
                    "effect":gainedEffect, 
                    "desc": gainedSkill.effects[0]
                }
            ]}
            addUnlockedSkill(gainedSkillId, parsedSkill, unit, skillIn);

            return {
                "gainSkills": {
                    "turns": rawEffect[3][4] - 1,
                    "skills": [{
                        "id": gainedSkillId,
                        "name": gainedSkill.name
                    }]
                }
            }
        }
    
    // skill enhancement
    } else if (rawEffect[2] == 136) {
        let result = {'skillEnhancement':{}};
        let increase = rawEffect[3][3] / 100;
        let skillIds = rawEffect[3][0];
        if (!Array.isArray(skillIds)) {
            skillIds = [skillIds];
        }
        skillIds.forEach(enhancedSkillId => result.skillEnhancement[enhancedSkillId] = increase);
        result.turn = rawEffect[3][4];
        return result;
    }
    
    if (result && result.damage) {
        if (skillIn.attack_type) {
            result.damage.mecanism = skillIn.attack_type.toLocaleLowerCase();    
        } else {
            result.damage.mecanism = skillIn.damage_type.toLocaleLowerCase();
        }
        if (result.damage.mecanism == "magic") {
            result.damage.mecanism = "magical";
        }
        if(result.damage.damageType == "evoke"){
            result.damage.mecanism = "summonerSkill";
        }
        
        if (skillIn.element_inflict) {
            result.damage.elements = [];
            for (var elementIndex = skillIn.element_inflict.length; elementIndex--;) {
                result.damage.elements.push(skillIn.element_inflict[elementIndex].toLocaleLowerCase());
            }
        }
    }

    if (result) {
        if (rawEffect[0] == 0) {
            result.area = "SELF";
        } else if (rawEffect[0] == 1) {
            result.area = "ST";
        } else if (rawEffect[0] == 2) {
            result.area = "AOE";
        } else {
            result.area = "RND";
        }
        
        if (rawEffect[1] == 0) {
            result.target = "SELF";
        } else if (rawEffect[1] == 1) {
            result.target = "ENEMY";
        } else if (rawEffect[1] == 2) {
            result.target = "ALLY";
        } else if (rawEffect[1] == 3) {
            result.target = "SELF";
            result.area = "SELF";
        } else if (rawEffect[1] == 4) {
            result.target = "ALLY";
        } else if (rawEffect[1] == 5) {
            result.target = "ALLY_BUT_SELF";
        } else if (rawEffect[1] == 6) {
            result.target = "ANY";
        } else {
            console.log("unknown target : " + JSON.stringify(rawEffect));
        }
    }
    return result;
}

function addUnlockedSkill(gainedSkillId, gainedSkill, unit, unlockedBy) {
    var alreadyAdded = false;
    var activesAndMagics = unit.actives.concat(unit.magics);
    for (var i = activesAndMagics.length; i--;) {
        if (activesAndMagics[i].id == gainedSkillId) {
            alreadyAdded = true;
            if (unlockedBy) {
                if (!activesAndMagics[i].unlockedBy) {
                    activesAndMagics[i].unlockedBy = [];
                }
                activesAndMagics[i].unlockedBy.push(unlockedBy.name);
            }
            break;
        }
    }
    if (!alreadyAdded) {
        if (unlockedBy) {
            gainedSkill.unlockedBy = [unlockedBy.name];
        }
        if (gainedSkill.magic) {
            unit.magics.push(gainedSkill);
        } else {
            unit.actives.push(gainedSkill);
        }
    }
}

function addToStat(skill, stat, value) {
    if (value) {
        if (!skill[stat]) {
            skill[stat] = value;
        } else {
            skill[stat] += value;
        }
    }
}
    
function addToList(skill, listName, value) {
    if (!skill[listName]) {
        skill[listName] = [value];
    } else {
        if (!skill[listName].includes(value)) {
            skill[listName].push(value);
        }
    }
}

function addKiller(skill, race, physicalPercent, magicalPercent) {
    if (!skill.killers) {
        skill.killers = [];
    }
    var killerData;
    for (var index in skill.killers) {
        if (skill.killers[index].name == race) {
            killerData = skill.killers[index];
            break;
        }
    }
    
    if (!killerData) {
        killerData = {"name":race};
        skill.killers.push(killerData);
    }
    if (physicalPercent != 0) {
        if (killerData.physical) {
            killerData.physical += physicalPercent;
        } else {
            killerData.physical = physicalPercent;
        }
    }
    if (magicalPercent != 0) {
        if (killerData.magical) {
            killerData.magical += magicalPercent;
        } else {
            killerData.magical = magicalPercent;
        }
    }
}

function addToResistList(item, resist) {
    if (!item.resist) {
        item.resist = [];
    }
    for (var i = 0, len = item.resist.length; i < len; i++) {
        if (item.resist[i].name == resist.name) {
            item.resist[i].percent += resist.percent;
            return;
        }
    }
    item.resist.push(resist);
}

function addToAilmentsList(item, ailment) {
    if (!item.ailments) {
        item.ailments = [];
    }
    for (var i = item.ailments.length; i--;) {
        if (item.ailments[i].name == ailment.name) {
            item.ailments[i].percent += ailment.percent;
            return;
        }
    }
    item.ailments.push(ailment);
}

function addElementalResist(item, values) {
    for (var index in elements) {
        if (values[index]) {
            addToResistList(item, {"name":elements[index],"percent":values[index]});
        }
    }
}

function addAilmentResist(item, values) {
    for (var index in ailments) {
        if (values[index]) {
            addToResistList(item, {"name":ailments[index],"percent":values[index]});
        }
    }
}

function addImperil(item, values) {
    if (!item.imperil) {
        item.imperil = {};
    }
    for (var index in elements) {
        if (values[index]) {
            item.imperil[elements[index]] = -values[index];
            if (values[index] > 0) {
                console.log("Positive imperil !");
                console.log(values);
            }
        }
    }
    item.turns = values[9];
}

function addBreak(item, values) {
    if (!item.break) {
        item.break = {};
    }
    if (values[0]) {
        item.break.atk = -values[0];
    }
    if (values[1]) {
        item.break.def = -values[1];
    }
    if (values[2]) {
        item.break.mag = -values[2];
    }
    if (values[3]) {
        item.break.spr = -values[3];
    }
    item.turns = values[4];
}

function addStatsBuff(item, values) {
    if (!item.statsBuff) {
        item.statsBuff = {};
    }
    if (values[0]) {
        item.statsBuff.atk = values[0];
    }
    if (values[1]) {
        item.statsBuff.def = values[1];
    }
    if (values[2]) {
        item.statsBuff.mag = values[2];
    }
    if (values[3]) {
        item.statsBuff.spr = values[3];
    }
    item.turns = values[4];
}

function addLbPerTurn(item, min, max) {
    if (!item.lbPerTurn) {
        item.lbPerTurn = {"min":0, "max":0};
    }
    item.lbPerTurn.min += min;
    item.lbPerTurn.max += max;
}

function getEquip(equipIn) {
    var equip = [];
    for(var equipIndex in equipIn) {
        if (equipIn[equipIndex] != 60) {
            equip.push(typeMap[equipIn[equipIndex]]);
        }
    }
    return equip;
}

var properties = ["id","name","jpname","type","hp","hp%","mp","mp%","atk","atk%","def","def%","mag","mag%","spr","spr%","evoMag","evade","singleWielding","singleWieldingOneHanded","dualWielding","improvedDW","damageVariance","jumpDamage","lbFillRate", "lbPerTurn","element","partialDualWield","resist","ailments","killers","mpRefresh","lbDamage","esperStatsBonus","drawAttacks","skillEnhancement","replaceLb","special","exclusiveSex","exclusiveUnits","equipedConditions", "equipedConditionIsOr","levelCondition","tmrUnit","access","icon"];

function formatOutput(units) {
    var result = "{\n";
    var first = true;
    for (var unitId in units) {
        var unit = units[unitId]
        if (first) {
            first = false;
        } else {
            result += ",";
        }
        result += "\n\t\"" + unitId + "\": {";
        result += formatUnit(unit);
        
        result += "\n\t}";
    }
    result += "\n}";
    return result;
}

function formatUnit(unit, prefix = "", sixStarForm = false) {
    result = getUnitBasicInfo(unit,prefix, sixStarForm) + ",";
    if (unit.enhancements && unit.enhancements.length > 0) {
        result += "\n\t\t\"enhancements\": [";
        for (var i = 0, len = unit.enhancements.length; i < len; i++) {
            result += "\n\t\t\t" + JSON.stringify(unit.enhancements[i]);
            if (i < unit.enhancements.length - 1) {
                result += ",";
            }
        }
        result += "\n\t\t],";
    }
    result += "\n" + prefix + "\t\t\"skills\": [";
    var firstSkill = true;
    for (var skillIndex in unit.skills) {
        var skill = unit.skills[skillIndex];
        if (firstSkill) {
            firstSkill = false;
        } else {
            result+= ",";
        }
        result+= "\n" + formatSkill(skill, prefix + "\t\t\t");
    }
    result += "\n" + prefix + "\t\t]";
    if (unit["6_form"]) {
        result += ",\n\t\t\"6_form\": {" + formatUnit(unit["6_form"], "\t", true) + "\n\t\t}";
    }
    return result;
}

function formatSkill(skill, prefix) {
    var result = prefix + "{"
    var firstProperty = true;
    for (var propertyIndex in properties) {
        var property = properties[propertyIndex];
        if (skill[property]) {
            if (firstProperty) {
                firstProperty = false;
            } else {
                result += ", ";
            }
            result+= "\"" + property + "\":" + JSON.stringify(skill[property]);
        }
    }
    result+= "}";
    return result;
}

function formatSimpleOutput(units) {
    var result = "{\n";
    var first = true;
    for (var unitId in units) {
        var unit = units[unitId]
        if (first) {
            first = false;
        } else {
            result += ",";
        }
        result += "\n\t\"" + unitId + "\": {";
        result += getUnitBasicInfo(unit);
        if (unit["6_form"]) {
            result += ",\n\t\t\"6_form\": {" + getUnitBasicInfo(unit["6_form"], "\t", true) + "\n\t\t}";
        }
        result += "\n\t}";
    }
    result += "\n}";
    return result;
}

function getUnitBasicInfo(unit, prefix = "", sixStarForm = false) {
    var result = "\n" + prefix + "\t\t\"name\":\"" + unit.name + "\",";
    if (unit.jpname) {
        result += "\n" + prefix + "\t\t\"jpname\":\"" + unit.jpname + "\",";
    }
    if (unit.wikiEntry) {
        result += "\n" + prefix + "\t\t\"wikiEntry\":\"" + unit.wikiEntry + "\",";
    }
    result += "\n" + prefix + "\t\t\"id\":\"" + unit.id + "\",";
    if (sixStarForm) {
        result += "\n" + prefix + "\t\t\"sixStarForm\":true,";
    }
    if (unit.unreleased7Star) {
        result += "\n" + prefix + "\t\t\"unreleased7Star\":true,";
    }
    result += "\n" + prefix + "\t\t\"max_rarity\":\"" + unit.max_rarity + "\",";
    result += "\n" + prefix + "\t\t\"min_rarity\":\"" + unit.min_rarity + "\",";
    result += "\n" + prefix + "\t\t\"sex\":\"" + unit.sex + "\",";
    if (unit.materiaSlots || unit.materiaSlots == 0) {
        result += "\n" + prefix + "\t\t\"materiaSlots\":" + unit.materiaSlots + ","
    }
    if (unit.mitigation) {
        result += "\n\t\t\"mitigation\":" + JSON.stringify(unit.mitigation) + ","
    }
    result += "\n" + prefix + "\t\t\"stats\": {";
    result += "\n" + prefix + "\t\t\t\"maxStats\":" + JSON.stringify(unit.stats.maxStats) + ",";
    result += "\n" + prefix + "\t\t\t\"minStats\":" + JSON.stringify(unit.stats.minStats) + ",";
    result += "\n" + prefix + "\t\t\t\"pots\":" + JSON.stringify(unit.stats.pots);
    result += "\n" + prefix + "\t\t},";
    result += "\n" + prefix + "\t\t\"stats_pattern\":" + unit.stats_pattern + ",";
    result += "\n" + prefix + "\t\t\"equip\":" + JSON.stringify(unit.equip);
    if (unit.enhancementSkills.length > 0) {
        result += ",\n" + prefix + "\t\t\"enhancementSkills\":" + JSON.stringify(unit.enhancementSkills);
    }
    
    return result;
}

function formatForSearch(units) {
    var result = "[\n";
    var first = true;
    for (var unitId in units) {
        var unit = units[unitId];
        if (unit.unreleased7Star) {
            unit = unit["6_form"];
        }
        if (unit.id) {
            var unitOut = {"passives":{}, "actives":{"SELF":{}, "ST":{},"AOE":{}}, "lb":{"SELF":{}, "ST":{},"AOE":{}}, "counter":{"SELF":{}, "ST":{},"AOE":{}}};
            unitOut.equip = unit.equip;
            unitOut.id = unit.id;
            unitOut.minRarity = unit.min_rarity;
            unitOut.maxRarity = unit.max_rarity;
            
            
            if (unit.innates.resist) {
                for (var resistIndex = unit.innates.resist.length; resistIndex--;) {
                    var resist = unit.innates.resist[resistIndex];
                    if (elements.includes(resist.name)) {
                        if (!unitOut.passives.elementalResist) {
                            unitOut.passives.elementalResist = {};
                        }
                        addToStat(unitOut.passives.elementalResist, resist.name, resist.percent);
                    } else {
                        if (!unitOut.passives.ailmentResist) {
                            unitOut.passives.ailmentResist = {};
                        }
                        addToStat(unitOut.passives.ailmentResist, resist.name, resist.percent);
                    }
                }
            }
            
            var passivesWithOnlyBestEnhancements = [];
            for (var i = 0, leni = unit.passives.length; i < leni; i++) {
                var skill = unit.passives[i];
                if (passivesWithOnlyBestEnhancements.length != 0) {
                    if (!skill.name) {
                        console.log(JSON.stringify(skill));
                    }
                    if (skill.name.endsWith("+1")) {
                        continue;
                    }
                    if (skill.name.endsWith("+2")) {
                        passivesWithOnlyBestEnhancements[passivesWithOnlyBestEnhancements.length - 1] = skill;
                        continue;
                    }
                }
                passivesWithOnlyBestEnhancements.push(skill);
            }
            
            for (var i = passivesWithOnlyBestEnhancements.length; i--;) {
                var skill = passivesWithOnlyBestEnhancements[i];
                addSkillEffectToSearch(skill.effects, unitOut, "passives");
            }
            var activeAndMagic = unit.actives.concat(unit.magics);
            for (var i = activeAndMagic.length; i--;) {
                var skill = activeAndMagic[i];
                addSkillEffectToSearch(skill.effects, unitOut, "actives");
            }
            if (unit.lb) {
                addSkillEffectToSearch(unit.lb.maxEffects, unitOut, "lb");
            }
            if (first) {
                first = false;
            } else {
                result += ",\n";
            }
            result += "\t" + JSON.stringify(unitOut);
        }
    }
    result += "\n]";
    return result;
}

function addSkillEffectToSearch(effects, unitOut, effectType) {
    for (var i = effects.length; i--;) {
        var effect = effects[i];
        if (effect.effect) {
            var effectOut;
            if (effectType == "passives") {
                effectOut = unitOut.passives;
            } else {
                effectOut = unitOut[effectType][effect.effect.area];
                if (!effectOut) {
                    continue;
                }
            }
            
            if (effect.effect.imperil) {
                if (!effectOut.imperil) {
                    effectOut.imperil = {};
                }
                var imperiledElements = Object.keys(effect.effect.imperil);
                for (var j = imperiledElements.length; j--;) {
                    var element = imperiledElements[j];
                    if (!effectOut.imperil[element] || effectOut.imperil[element] < effect.effect.imperil[element]) {
                        effectOut.imperil[element] = effect.effect.imperil[element];
                    }
                }
             } else if (effect.effect.resist) {
                for (var j = effect.effect.resist.length; j--;) {
                    if (elements.includes(effect.effect.resist[j].name)) {
                        if (!effectOut.elementalResist) {effectOut.elementalResist = {};}
                        if (effectType == "passives") {
                            if (!effectOut.elementalResist[effect.effect.resist[j].name]) {effectOut.elementalResist[effect.effect.resist[j].name] = 0;}
                            effectOut.elementalResist[effect.effect.resist[j].name] += effect.effect.resist[j].percent;
                        } else {
                            if (!effectOut.elementalResist[effect.effect.resist[j].name] || effectOut.elementalResist[effect.effect.resist[j].name] < effect.effect.resist[j].percent) {
                                effectOut.elementalResist[effect.effect.resist[j].name] = effect.effect.resist[j].percent;
                            }    
                        }
                        
                    } else {
                        if (!effectOut.ailmentResist) {effectOut.ailmentResist = {};}
                        if (effectType == "passives") {
                            if (!effectOut.ailmentResist[effect.effect.resist[j].name]) {effectOut.ailmentResist[effect.effect.resist[j].name] = 0;}
                            effectOut.ailmentResist[effect.effect.resist[j].name] += effect.effect.resist[j].percent;
                        } else {
                            if (!effectOut.ailmentResist[effect.effect.resist[j].name] || effectOut.ailmentResist[effect.effect.resist[j].name] < effect.effect.resist[j].percent) {
                                effectOut.ailmentResist[effect.effect.resist[j].name] = effect.effect.resist[j].percent;
                            }
                        }
                    }
                    
                }
            } else if (effect.effect.killers) {
                for (var j = 0, lenj = effect.effect.killers.length; j < lenj; j++) {
                    if (effect.effect.killers[j].physical) {
                        if (!effectOut.physicalKillers) {effectOut.physicalKillers = {};}
                        if (effectType == "passives") {
                            if (!effectOut.physicalKillers[effect.effect.killers[j].name]) {effectOut.physicalKillers[effect.effect.killers[j].name] = 0;}
                            effectOut.physicalKillers[effect.effect.killers[j].name] += effect.effect.killers[j].physical;
                        } else {
                            if (!effectOut.physicalKillers[effect.effect.killers[j].name] || effectOut.physicalKillers[effect.effect.killers[j].name] < effect.effect.killers[j].physical) {
                                effectOut.physicalKillers[effect.effect.killers[j].name] = effect.effect.killers[j].physical;
                            }
                        }
                    } 
                    if (effect.effect.killers[j].magical) {
                        if (!effectOut.magicalKillers) {effectOut.magicalKillers = {};}
                        if (effectType == "passives") {
                            if (!effectOut.magicalKillers[effect.effect.killers[j].name]) {effectOut.magicalKillers[effect.effect.killers[j].name] = 0;}
                            effectOut.magicalKillers[effect.effect.killers[j].name] += effect.effect.killers[j].magical;
                        } else {
                            if (!effectOut.magicalKillers[effect.effect.killers[j].name] || effectOut.magicalKillers[effect.effect.killers[j].name] < effect.effect.killers[j].magical) {
                                effectOut.magicalKillers[effect.effect.killers[j].name] = effect.effect.killers[j].magical;
                            }    
                        }
                    } 
                }
            } else if (effect.effect.randomlyUse) {
                for (var j = 0, len = effect.effect.randomlyUse.length; j < len; j++) {
                    addSkillEffectToSearch(effect.effect.randomlyUse[j].skill.effects, unitOut, effectType);
                }
            } else if (effect.effect.break) {
                if (!effectOut.break) {
                    effectOut.break = {};
                }
                if (!effectOut.break.atk || effectOut.break.atk < effect.effect.break.atk) {
                    effectOut.break.atk = effect.effect.break.atk;
                }
                if (!effectOut.break.def || effectOut.break.def < effect.effect.break.def) {
                    effectOut.break.def = effect.effect.break.def;
                }
                if (!effectOut.break.mag || effectOut.break.atk < effect.effect.break.mag) {
                    effectOut.break.mag = effect.effect.break.mag;
                }
                if (!effectOut.break.spr || effectOut.break.spr < effect.effect.break.spr) {
                    effectOut.break.spr = effect.effect.break.spr;
                }
            } else if (effect.effect.statsBuff) {
                if (!effectOut.statsBuff) {
                    effectOut.statsBuff = {};
                }
                if (!effectOut.statsBuff.atk || effectOut.statsBuff.atk < effect.effect.statsBuff.atk) {
                    effectOut.statsBuff.atk = effect.effect.statsBuff.atk;
                }
                if (!effectOut.statsBuff.def || effectOut.statsBuff.def < effect.effect.statsBuff.def) {
                    effectOut.statsBuff.def = effect.effect.statsBuff.def;
                }
                if (!effectOut.statsBuff.mag || effectOut.statsBuff.atk < effect.effect.statsBuff.mag) {
                    effectOut.statsBuff.mag = effect.effect.statsBuff.mag;
                }
                if (!effectOut.statsBuff.spr || effectOut.statsBuff.spr < effect.effect.statsBuff.spr) {
                    effectOut.statsBuff.spr = effect.effect.statsBuff.spr;
                }
            } else if (effect.effect.globalMitigation){
                if(!effectOut.globalMitigation){
                    effectOut.globalMitigation = effect.effect.globalMitigation
                }
            } else if (effect.effect.magicalMitigation){
                if(!effectOut.magicalMitigation){
                    effectOut.magicalMitigation = effect.effect.magicalMitigation
                }
            } else if(effect.effect.physicalMitigation){
                if(!effectOut.physicalMitigation){
                    effectOut.physicalMitigation = effect.effect.physicalMitigation
                } 
            } else if (effect.effect.imbue) {
                if (!effectOut.imbue) {
                    effectOut.imbue = [];
                }
                for (var j = 0, lenj = effect.effect.imbue.length; j < lenj; j++) {
                    if (!effectOut.imbue.includes(effect.effect.imbue[j])) {
                        effectOut.imbue.push(effect.effect.imbue[j]);
                    }
                }
            } else if (effect.effect.cooldownSkill) {
                addSkillEffectToSearch(effect.effect.cooldownSkill.effects, unitOut, effectType)
            } else if (effect.effect.drawAttacks) {
                if (!effectOut.drawAttacks || effectOut.drawAttacks < effect.effect.drawAttacks) {
                    effectOut.drawAttacks = effect.effect.drawAttacks;
                }
            } else if (effect.effect.aoeCover) {
                var meanMitigation = (effect.effect.aoeCover.mitigation.min + effect.effect.aoeCover.mitigation.max) / 2;
                if (effect.effect.aoeCover.type == "physical") {
                    if (!effectOut.physicalAoeCover || effectOut.physicalAoeCover < meanMitigation) {
                        effectOut.physicalAoeCover = meanMitigation;
                    }
                } else {
                    if (!effectOut.magicalAoeCover || effectOut.magicalAoeCover < meanMitigation) {
                        effectOut.magicalAoeCover = meanMitigation;
                    }
                }
            } else if (effect.effect.stCover) {
                
                var meanMitigation = (effect.effect.stCover.mitigation.min + effect.effect.stCover.mitigation.max) / 2;
                if (!effectOut.stCover || effectOut.stCover < meanMitigation) {
                    effectOut.stCover = meanMitigation;
                }
            } else if (effect.effect.autoCastedSkill) {
                addSkillEffectToSearch(effect.effect.autoCastedSkill.effects, unitOut, "passives");    
            } else if (effect.effect.counterSkill) {
                addSkillEffectToSearch(effect.effect.counterSkill.effects, unitOut, "counter");
            }
        }
    }
}

function formatForSkills(units) {
    var result = "{\n";
    var first = true;
    for (var unitId in units) {
        var unit = units[unitId];
        if (unit.unreleased7Star) {
            unit = unit["6_form"];
        }
        if (first) {
            first = false;
        } else {
            result += ",";
        }
        result += "\n\t\"" + unitId + "\": {";
        result += getUnitBasicInfo(unit) + ",";
        result += "\n" + "\t\t\"lb\": " + JSON.stringify(unit.lb) + ",";
        if (Object.keys(unit.innates).length > 0) {
            result += "\n" + "\t\t\"innate\": " + JSON.stringify(unit.innates) + ",";
        }
        
        result += "\n" + "\t\t\"passives\": [";
        var firstPassive = true;
        for (var skillIndex in unit.passives) {
            var passive = unit.passives[skillIndex];
            if (firstPassive) {
                firstPassive = false;
            } else {
                result+= ",";
            }
            result+= "\n\t\t\t" + JSON.stringify(passive);
        }
        result += "\n" + "\t\t]";
        
        result += ",\n" + "\t\t\"actives\": [";
        var firstActive = true;
        for (var skillIndex in unit.actives) {
            var active = unit.actives[skillIndex];
            if (firstActive) {
                firstActive = false;
            } else {
                result+= ",";
            }
            result+= "\n\t\t\t" + JSON.stringify(active);
        }
        result += "\n" + "\t\t]";
        
        result += ",\n" + "\t\t\"magics\": [";
        var firstMagic = true;
        for (var skillIndex in unit.magics) {
            var magic = unit.magics[skillIndex];
            if (firstMagic) {
                firstMagic = false;
            } else {
                result+= ",";
            }
            result+= "\n\t\t\t" + JSON.stringify(magic);
        }
        result += "\n" + "\t\t]";
        
        result += "\n\t}";
    }
    result += "\n}";
    return result;
    
}


module.exports = {
    getPassives: getPassives,
    addElementalResist: addElementalResist,
    addAilmentResist: addAilmentResist,
    getEquip: getEquip,
    formatSimpleOutput: formatSimpleOutput,
    formatOutput: formatOutput,
    formatForSearch:formatForSearch,
    formatForSkills:formatForSkills,
    stats: stats,
    elements: elements,
    ailments: ailments
}

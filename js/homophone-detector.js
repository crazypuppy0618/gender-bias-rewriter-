const HOMOPHONE_GROUPS = [
  {
    id: "homo-nvquan",
    base: "女权",
    variants: ["女拳", "女全", "女犬"],
    pinyin: ["nǚ quán", "nǚ quán", "nǚ quán"],
    note_zh: "\"女权\"被谐音替换为\"女拳/女全\",意在污名化女权主义者。",
    note_en: "Homophone swap of 'feminism' (nǚ quán) to mock feminists.",
    type: "explicit",
    rewrite_zh: "(建议直接删除)",
    rewrite_en: "(recommend deletion)",
  },
  {
    id: "homo-shengnv",
    base: "胜女",
    variants: ["剩女", "圣女"],
    pinyin: ["shèng nǚ"],
    note_zh: "\"剩女\"的\"剩\"与\"胜\"同音,实为对单身女性的污名化。",
    note_en: "'Leftover women' pun on 'victorious women' — stigmatising single women.",
    type: "explicit",
    rewrite_zh: "单身女性",
    rewrite_en: "single women",
  },
  {
    id: "homo-fudi",
    base: "扶弟",
    variants: ["扶弟魔", "伏地魔", "扶弟"],
    pinyin: ["fú dì", "fú dì"],
    note_zh: "\"扶弟魔\"以《哈利波特》\"伏地魔\"谐音,讽刺被要求扶持弟弟的女性。",
    note_en: "Harry Potter 'Voldemort' homophone, used to mock sisters forced to support brothers.",
    type: "explicit",
    rewrite_zh: "家中子女不应被工具化",
    rewrite_en: "Children in a family should not be instrumentalised",
  },
  {
    id: "homo-niuma",
    base: "女马",
    variants: ["母马"],
    pinyin: ["mǔ mǎ"],
    note_zh: "以\"母马\"作女性侮辱性称呼。",
    note_en: "Mare used as gendered insult.",
    type: "explicit",
    rewrite_zh: "(强烈建议删除侮辱性词汇)",
    rewrite_en: "(strongly recommend deletion)",
  },
  {
    id: "homo-ying",
    base: "婴",
    variants: ["赔钱货"],
    pinyin: ["péi qián huò"],
    note_zh: "将女儿视为家庭经济负担。",
    note_en: "Frames daughters as a financial loss.",
    type: "explicit",
    rewrite_zh: "家中子女不应被工具化",
    rewrite_en: "Children should not be instrumentalised",
  },
  {
    id: "homo-biao",
    base: "婊",
    variants: ["婊子", "绿茶婊", "圣母婊"],
    pinyin: ["biǎo zi"],
    note_zh: "针对女性的严重侮辱性词汇,与\"表\"同音但字不同。",
    note_en: "Severe gendered insult; homophone with unrelated character.",
    type: "explicit",
    rewrite_zh: "(建议删除该侮辱性词汇)",
    rewrite_en: "(recommend deletion)",
  },
  {
    id: "homo-gongzhu",
    base: "公主",
    variants: ["公主病"],
    pinyin: ["gōng zhǔ bìng"],
    note_zh: "\"公主病\"常用于嘲讽对伴侣有高期待的女性,本质是污名化。",
    note_en: "'Princess syndrome' — used to mock women with expectations.",
    type: "implicit",
    rewrite_zh: "(建议以具体行为描述替代标签)",
    rewrite_en: "(describe specific behaviours instead)",
  },
  {
    id: "homo-fendang",
    base: "分当",
    variants: ["坟头", "粉当"],
    pinyin: ["fén tóu"],
    note_zh: "网络攻击用语,与性器官相关谐音。",
    note_en: "Online slur via character substitution.",
    type: "explicit",
    rewrite_zh: "(建议删除)",
    rewrite_en: "(recommend deletion)",
  },
  {
    id: "homo-lu",
    base: "驴",
    variants: ["婚驴"],
    pinyin: ["hūn lǘ"],
    note_zh: "\"婚驴\"是针对已婚/再婚女性的侮辱性标签。",
    note_en: "'Marriage mule' — slur against remarried women.",
    type: "explicit",
    rewrite_zh: "(建议删除)",
    rewrite_en: "(recommend deletion)",
  },
  {
    id: "homo-sheng",
    base: "生",
    variants: ["生儿子", "传宗接代", "延续香火", "养儿防老"],
    pinyin: ["shēng ér zi"],
    note_zh: "\"生儿子/传宗接代\"等表达体现重男轻女的文化。",
    note_en: "'Must have a son / continue the family line' — entrenched son preference.",
    type: "implicit",
    rewrite_zh: "子女价值不取决于性别",
    rewrite_en: "A child's value does not depend on gender",
  },
];

export function detectHomophones(text, patterns) {
  if (!text) return [];
  const findings = [];
  const textLower = text.toLowerCase();
  for (const group of HOMOPHONE_GROUPS) {
    const candidates = [group.base, ...(group.variants || [])];
    for (const phrase of candidates) {
      if (!phrase) continue;
      let fromIdx = 0;
      while (true) {
        const idx = textLower.indexOf(phrase.toLowerCase(), fromIdx);
        if (idx === -1) break;
        findings.push({
          id: group.id,
          type: group.type,
          phrase: text.substr(idx, phrase.length),
          start: idx,
          end: idx + phrase.length,
          isHomophone: true,
          base: group.base,
          variants: group.variants,
          rewrite_zh: group.rewrite_zh,
          rewrite_en: group.rewrite_en,
          reason_zh: group.note_zh,
          reason_en: group.note_en,
          source: "homophone",
          confidence: 0.9,
        });
        fromIdx = idx + phrase.length;
      }
    }
  }
  if (patterns) {
    for (const p of patterns) {
      if (!p.isHomophone) continue;
      const all = [...(p.patterns || []), ...(p.patterns_en || [])];
      for (const phrase of all) {
        if (!phrase) continue;
        let fromIdx = 0;
        while (true) {
          const idx = textLower.indexOf(phrase.toLowerCase(), fromIdx);
          if (idx === -1) break;
          const already = findings.some(
            (f) => f.start === idx && f.end === idx + phrase.length
          );
          if (!already) {
            findings.push({
              id: p.id,
              type: p.type,
              phrase: text.substr(idx, phrase.length),
              start: idx,
              end: idx + phrase.length,
              isHomophone: true,
              rewrite_zh: p.rewrite_zh,
              rewrite_en: p.rewrite_en,
              reason_zh: p.reason_zh,
              reason_en: p.reason_en,
              source: "homophone-custom",
              confidence: 0.85,
            });
          }
          fromIdx = idx + phrase.length;
        }
      }
    }
  }
  findings.sort((a, b) => a.start - b.start);
  return dedupeOverlaps(findings);
}

function dedupeOverlaps(items) {
  const result = [];
  let lastEnd = -1;
  for (const it of items) {
    if (it.start >= lastEnd) {
      result.push(it);
      lastEnd = it.end;
    }
  }
  return result;
}

export function mergeFindings(...lists) {
  const all = [].concat(...lists);
  all.sort((a, b) => a.start - b.start);
  return dedupeOverlaps(all);
}

export function listHomophoneGroups() {
  return HOMOPHONE_GROUPS.map((g) => ({ id: g.id, base: g.base, variants: g.variants }));
}

const UNIVERSAL_CLAIMS = [
  ["天理", "gender_norm_naturalization", "将性别规范包装为不可违抗的「天理」,赋予其超然权威。"],
  ["天性", "gender_norm_naturalization", "将性别特质归于「天性」,本质上是自然化偏见。"],
  ["本能", "gender_norm_naturalization", "将性别化行为归因于「本能」,掩盖社会建构。"],
  ["天经地义", "gender_norm_naturalization", "断言性别分工/规范为「天经地义」,拒绝批判性审视。"],
  ["理所应当", "gender_norm_naturalization", "将性别角色分配包装为理所当然,实质是封闭讨论。"],
  ["从来如此", "tradition_justification", "用「从来如此」为性别歧视背书,以传统压制变革。"],
  ["自古以来", "tradition_justification", "借「自古以来」将性别规范历史化,赋予其不可动摇的假象。"],
  ["历来如此", "tradition_justification", "以「历来如此」拒绝反思性别不平等的历史根源。"],
  ["古今皆然", "tradition_justification", "以时空普适性宣称性别规范不可改变。"],
  ["老祖宗", "tradition_justification", "假借「老祖宗」权威为当代性别歧视辩护。"],
  ["传统", "tradition_justification", "将「传统」作为不加审视的性别规范依据。"],
  ["古训", "tradition_justification", "引用「古训」将性别等级制合法化。"],
  ["古来", "tradition_justification", "以「古来如此」为性别不平等寻找历史合法性。"],
  ["自然规律", "gender_norm_naturalization", "将性别差异包装为「自然规律」,实质是封闭讨论。"],
  ["阴阳", "gender_norm_naturalization", "借阴阳哲学为性别等级提供所谓宇宙论依据。"],
  ["男主外女主内", "tradition_justification", "将性别分工固化为传统规范。"],
];

const IDENTITY_LABELS = [
  ["龟男", "animal_metaphor+identity", "用一个动物标签否定人的所有复杂性,属于身份定义而非行为描述。"],
  ["婚驴", "animal_metaphor+identity", "以动物意象物化已婚女性,将其角色简化为单一功能。"],
  ["easy girl", "identity_label", "用一个标签贬低女性的性自主权,否认个体差异。"],
  ["接盘侠", "identity_label", "用一个标签污名化与有婚史女性结婚的男性。"],
  ["普信男", "identity_label", "用标签嘲讽普通男性的自信,本质是身份定义。"],
  ["国男", "identity_label", "用一个民族标签对全体男性进行负面定性。"],
  ["小仙男", "identity_label", "反讽式标签,本质是将性别与矫情绑定。"],
  ["田园女拳", "identity_label", "将女权主义污名化为极端标签。"],
  ["女拳师", "identity_label", "同「女拳」的变体,用于污名化女权主义者。"],
  ["屌丝", "identity_label", "身份定义式标签,否定人的社会价值和复杂性。"],
  ["直男", "identity_label", "用于嘲讽时,属于身份定义而非行为描述。"],
  ["直男癌", "identity_label", "用疾病隐喻对男性进行身份定义式攻击。"],
];

const OBJECT_METAPHORS = [
  ["赔钱货", "object_metaphor+identity", "将女性比作经济负担,以物化方式定义其身份。"],
  ["生育机器", "object_metaphor+identity", "将女性简化为生育功能,完全剥夺人的复杂性。"],
  ["提款机", "object_metaphor+identity", "将男性简化为经济功能,是物化的性别想象。"],
  ["工具人", "object_metaphor+identity", "以「工具」定义人在关系中的角色,属于物化。"],
  ["垃圾桶", "object_metaphor+identity", "将人比作情感垃圾桶,消解主体性。"],
  ["生育工具", "object_metaphor+identity", "同「生育机器」,将人工具化。"],
  ["行走的", "object_metaphor+identity", "以「行走的XX」格式将人降格为单一属性载体。"],
];

const ANIMAL_METAPHORS = [
  ["母猪", "animal_metaphor", "以猪侮辱女性,彻底剥夺人格尊严。"],
  ["老母猪", "animal_metaphor", "同「母猪」,加重年龄羞辱。"],
  ["母狗", "animal_metaphor", "以狗作性别侮辱,属严重人格贬损。"],
  ["公狗", "animal_metaphor", "以狗侮辱男性,将人动物化。"],
  ["老牛吃嫩草", "animal_metaphor", "以牛喻人,将年龄差亲密关系动物化。"],
  ["恐龙", "animal_metaphor", "以外貌+远古动物恐吓化侮辱女性。"],
  ["坦克", "animal_metaphor", "将超重女性比作军事装备,以物化+动物化双重贬损。"],
  ["金丝雀", "animal_metaphor", "将被供养的女性比作笼中鸟,虽是宠物但剥夺主体性。"],
];

const HISTORICAL_NORMATIVE_TRIGGERS = [
  ["古代女子都", "normative_history", "以「古代女子都」为模板,将历史标准套用于当代女性。"],
  ["古代女人都", "normative_history", "以古代为名对现代女性提出规范要求。"],
  ["以前的女人", "normative_history", "以「以前的女人」作为评判当代女性的标准。"],
  ["过去的女子", "normative_history", "将历史女性行为作为规范模板。"],
  ["古代就是这样", "normative_history", "以历史事实为由拒绝改变性别规范。"],
  ["老祖宗传下来的", "normative_history", "以传统传承为名维护现存性别秩序。"],
  ["传统就是这样", "normative_history", "以传统为名拒绝批判性别不平等。"],
  ["不是说古代", "normative_history", "以古代制度为参照对比来贬低/规范当代女性。"],
];

const ENCRYPTED_SLURS = [
  ["nvq", "女拳", "缩写「nvq」解码为污名化女权的「女拳」。"],
  ["nq", "女拳", "缩写「nq」解码为污名化女权的「女拳」。"],
  ["fq", "女拳", "缩写「fq」解码为污名化女权的「女拳」。"],
  ["tg", "坦克", "缩写「tg」解码为侮辱超重女性的「坦克」。"],
  ["hlv", "婚驴", "拼音缩写「hlv」解码为侮辱已婚女性的「婚驴」。"],
  ["ht", "婚驴/婚托", "缩写「ht」解码为对婚姻中女性的侮辱。"],
  ["bch", "赔钱货", "缩写「bch」解码为物化女性的「赔钱货」。"],
  ["fdm", "扶弟魔", "缩写「fdm」解码为「扶弟魔」,侮辱被要求支持兄弟的女性。"],
  ["pyq", "女拳", "拼音变体「pyq」解码为污名化女权的「女拳」。"],
];

function findPhrases(text, dictionary) {
  const results = [];
  const lower = text.toLowerCase();
  for (const [phrase, category, reason] of dictionary) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(phrase.toLowerCase(), from);
      if (idx === -1) break;
      results.push({
        phrase: text.substr(idx, phrase.length),
        start: idx,
        end: idx + phrase.length,
        category,
        reason_zh: reason,
        confidence: 0.85,
        source: "deep-analyzer",
      });
      from = idx + phrase.length;
    }
  }
  return results;
}

export function analyzeUniversalClaims(text) {
  return findPhrases(text, UNIVERSAL_CLAIMS);
}

export function analyzeIdentityLabels(text) {
  return findPhrases(text, IDENTITY_LABELS);
}

export function analyzeObjectMetaphors(text) {
  return findPhrases(text, OBJECT_METAPHORS);
}

export function analyzeAnimalMetaphors(text) {
  return findPhrases(text, ANIMAL_METAPHORS);
}

export function analyzeHistoricalNormative(text) {
  return findPhrases(text, HISTORICAL_NORMATIVE_TRIGGERS);
}

export function analyzeEncryptedSlurs(text) {
  const results = [];
  const lower = text.toLowerCase();
  for (const [abbr, decoded, reason] of ENCRYPTED_SLURS) {
    if (!abbr.includes(" ")) {
      const idx = lower.indexOf(abbr.toLowerCase());
      if (idx !== -1) {
        results.push({
          phrase: text.substr(idx, abbr.length),
          start: idx,
          end: idx + abbr.length,
          decoded,
          category: "encrypted_slur",
          reason_zh: reason,
          confidence: 0.9,
          source: "deep-analyzer",
        });
      }
    }
  }
  return results;
}

export function analyzeAll(text) {
  const all = [
    ...analyzeUniversalClaims(text),
    ...analyzeIdentityLabels(text),
    ...analyzeObjectMetaphors(text),
    ...analyzeAnimalMetaphors(text),
    ...analyzeHistoricalNormative(text),
    ...analyzeEncryptedSlurs(text),
  ];
  all.sort((a, b) => a.start - b.start);
  const deduped = [];
  let lastEnd = -1;
  for (const f of all) {
    if (f.start >= lastEnd) { deduped.push(f); lastEnd = f.end; }
  }
  return deduped;
}

export function isIdentityDefinition(finding) {
  return finding.category && finding.category.includes("identity");
}

export function isMetaphor(finding) {
  return finding.category && finding.category.includes("metaphor");
}

export function isUniversalClaim(finding) {
  return finding.category && finding.category.includes("naturalization");
}

export function isHistoricalNormative(finding) {
  return finding.category && finding.category.includes("normative_history") || finding.category && finding.category.includes("tradition_justification");
}

export function isEncryptedSlur(finding) {
  return finding.category === "encrypted_slur";
}

export function decodeSlur(finding) {
  if (finding.decoded) return finding.decoded;
  return "";
}

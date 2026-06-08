export const CONFIG = {
  hfEndpoint: "https://api-inference.huggingface.co/models",
  defaultModel: "uer/roberta-base-finetuned-dianping-chinese",
  negativeThreshold: 0.7,
  requestTimeoutMs: 8000,
  enableCloudDetection: true,
  storageKey: "gbr_api_key",
  langStorageKey: "gbr_lang",
  patternFile: "data/bias-patterns.json",
  typeLabels: {
    explicit: { "zh-CN": "显式性别歧视", "en-US": "Explicit sexism" },
    implicit: { "zh-CN": "隐式偏见", "en-US": "Implicit bias" },
    benevolent: { "zh-CN": "善意性别歧视", "en-US": "Benevolent sexism" },
  },
  badgeLabels: {
    online: { "zh-CN": "在线模式", "en-US": "Online" },
    offline: { "zh-CN": "离线模式", "en-US": "Offline" },
  },
};

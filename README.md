# Gender-Bias Rewriter · 性别偏见预发布改写提示

A single-page web demo implementing the **Pre-Publication Rewriting Prompt** approach proposed in the academic poster *"How Pre-Publication Rewriting Prompts Stop Gender-Discriminatory Content on Chinese Social Media"* (Xiao Yan, CE2403, 202413000627, ALS2-DCP).

## 功能 Features

- **A · Demo Input** 模拟微博/小红书发帖框,输入中文或英文文本
- **B · 5-Step Workflow** 可视化 "用户输入 → 轻量BERT → 偏置标记 → 中性改写 → 用户选择"
- **C · Result Comparison** 原文(高亮偏置短语)与中性改写并排对比
  - 三色高亮:显式 / 隐式 / 善意
  - Accept / Ignore / Learn more 三选项
  - "Learn more" 弹出每条偏置的解释
- **D · Impact Statistics** 100% → 68% 偏置触达率下降条 + 本次会话统计
- **E · Current vs Solution** 现状(关键词过滤)与本方案对比 + 优势列表
- **F · Context & Homophone** 否定/转述/反驳语境识别 + 谐音/俚语/缩写/变形拼写检测
- **G · Detection Log** 本地 IndexedDB 全部历史记录,支持导出/导入/清空
- **H · Custom Patterns** 自定义词条:增/改/删/启用/停用,本机持久化
- **I · Shared Library & Corpus** 🆕 **匿名共享池**:所有访客的检测摘要、自定义词条、语料汇集
  - 5 个统计卡:总记录 / 共享词条 / 共享语料 / 检测记录 / 历史版本数
  - "提交语料" 表单
  - "共享词条(只读)" 列表
  - "最近共享语料" 列表,一键载入输入区
- **中英双语切换** 顶栏语言下拉
- **离线兜底** 未配置 API Key 时使用内置 CORGI-PM 启发模式库

## 共享池架构 Shared Pool Architecture

```
                            Visitor Browser (anywhere)
                                    │
                          ┌─────────┴─────────┐
                          │  index.html + JS  │
                          │  (anonymous, no   │
                          │   login/account)  │
                          └─────────┬─────────┘
                                    │  POST /api/records
                                    │  GET  /api/records
                                    ▼
                          ┌─────────────────────┐
                          │  server.py (Python) │
                          │  ─────────────────  │
                          │  • static files     │
                          │  • /api/records     │
                          │  • /api/patterns    │
                          │  • /api/corpus      │
                          │  • /api/stats       │
                          └─────────┬───────────┘
                                    │ atomic write
                                    ▼
                          ┌─────────────────────┐
                          │  shared_data.json   │  ← source of truth,
                          │  (append-only)      │     preserved across
                          │                     │     site updates
                          │  ┌───────────────┐  │
                          │  │ records[]     │  │  schema v1
                          │  │  • id         │  │
                          │  │  • type       │  │  (detection,
                          │  │  • appVersion │  │   customPattern,
                          │  │  • ts         │  │   corpus, edit)
                          │  │  • data{}     │  │
                          │  └───────────────┘  │
                          └─────────────────────┘
```

### 匿名与隐私 Anonymity

| 记录类型 | 上传字段 | 不上传字段 |
|---|---|---|
| `detection` | `language`, `findingCount`, `findingPhrases[]`, `findingTypes[]`, `userChoice`, `rewriteApplied`, `textLength`, `textHash`(末 8 位) | 完整原文 / 时间戳精确到分 / IP / UA / 任何用户标识 |
| `customPattern` | 词条全字段(`patterns`, `homophones`, `rewrite_*`, `reason_*` 等) | 邮箱 / 作者名 / IP |
| `corpus` | 文本 + 语言 + 标签 + 备注 | 作者名 / IP |
| `edit` | 目标 ID + 新字段 | 编辑者身份 |

服务端 `sanitize_record()` 主动删除 `author/email/userId/name/ip` 等字段,即使客户端误传也不会写入。

### 版本保留 Version Preservation

每条记录带 `appVersion` 字段(当前为 `3.0`)。**网站更新时绝不删除旧记录**,只在末尾追加带新 `appVersion` 的新记录。Section I 的 `历史版本数` 卡片会显示历史 `appVersion` 的种类数。`stats.byAppVersion` 给出按版本聚合的统计。

### 容量与归档

- `MAX_RECORDS = 100,000`(超过则截断到一半)
- `MAX_FILE_BYTES = 50 MB`(超过则自动归档为 `shared_data.json.archive.<ts>.json`,新数据写入新文件)
- 线程锁保证并发写安全
- 写入用 `tmp + os.replace` 原子替换,中断不损坏文件

## 运行 Run

```bash
cd /Users/yanxiao/gender-bias-rewriter
python3 server.py
# 默认监听 0.0.0.0:8765
# 自定义端口:PORT=9000 python3 server.py
```

浏览器访问:`http://localhost:8765`

## 文件结构 File Layout

```
gender-bias-rewriter/
├── server.py                # Python 后端 (静态文件 + API)
├── shared_data.json         # 🆕 共享数据存储 (append-only, 自动创建)
├── index.html
├── css/style.css
├── js/
│   ├── app.js               # 主控制器
│   ├── config.js            # HF API 配置
│   ├── i18n.js              # 中英双语
│   ├── detector.js          # HF + 本地模式匹配
│   ├── context-detector.js  # 上下文打分
│   ├── homophone-detector.js# 谐音/俚语/缩写
│   ├── rewriter.js          # 高亮 + 改写
│   ├── storage.js           # IndexedDB (本地历史)
│   ├── admin.js             # G/H 区 UI
│   ├── shared-store.js      # 🆕 共享池客户端
│   └── shared-ui.js         # 🆕 Section I UI
├── data/
│   └── bias-patterns.json
├── README.md
└── DEPLOY.md
```

## API Endpoints

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | 健康检查,返回 `{ok, version, ts}` |
| GET | `/api/stats` | 聚合统计 `{total, byType, byAppVersion, byLanguage}` |
| GET | `/api/patterns?limit=N` | 共享词条(最新 N 条) |
| GET | `/api/corpus?limit=N` | 共享语料(最新 N 条) |
| GET | `/api/records?type=X&limit=N` | 全部记录(可选类型过滤) |
| GET | `/api/export` | 导出全量数据 |
| POST | `/api/records` | 提交新记录 `{type, data}` |

## HF API Key 配置(可选)

1. 前往 https://huggingface.co/settings/tokens 申请免费 token
2. 在页面顶栏的 **HF API Key** 输入框粘贴(以 `hf_` 开头)并点击 **保存**
3. Key 仅存于浏览器 `localStorage`,不会上传
4. 留空则自动使用本地模式库

## 测试用例 Test Cases

在输入框粘贴以下文本,点击 **检测并改写**:

| 输入 | 预期 |
|---|---|
| `女人太情绪化,不适合做领导` | 标记 2 处隐式偏置 |
| `剩女就知道花钱` | 标记 1 处显式偏置 |
| `男人应该养家,女人不需要那么努力` | 标记 2 处(1 善意 + 1 隐式) |
| `Women are too emotional to be leaders` | 标记 1 处隐式偏置(英文) |
| `她不是女拳,只是在为女性发声` | 谐音 + 否定 → 置信度下降 |
| `tī yuán nǚ quán` | 拼音绕过 → 标记 田园女权 |

## 与论文对齐 Alignment with the Paper

| 海报元素 | 本 Demo 实现 |
|---|---|
| 5 步工作流 | Section B 横向流程卡片 |
| Accept / Ignore / Learn more | Section C 三按钮 |
| 100% → 68% 偏置触达率 | Section D 进度条 |
| Current vs Solution | Section E 双栏对比 |
| 显式/隐式/善意三类偏置 | 三色高亮 + 图例 |
| 隐私:无惩罚性删除 | 仅作提示,用户决定 Accept/Ignore |
| 协同 / 社区贡献 | 🆕 Section I 共享池 |

## 引用 References

- Wang, X. L., et al. (2024). 融合帖文属性的性别歧视言论检测模型. *Computer Science*, 51(6), 338-345.
- Wu, C., et al. (2025). From detection to mitigation. arXiv:2509.07889.
- Rahman, M. M., et al. (2025). CUET_Ignite@LT-EDI-2025. ACL Anthology.
- CORGI-PM (2023). A Chinese corpus for gender bias probing. arXiv:2301.00395.
- Central Cyberspace Administration of China. (2025). "清朗" 专项行动.
- Golunova, V. (2025). A misogynistic glitch? *Law, Technology and Humans*, 7(2), 40-52.
- Bai, J. Y. (2025). "信息茧房"对性别对立的负效应. *Education and Traditional Culture*.

## License

MIT

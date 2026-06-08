# Deploy · 部署

EquiWrite 由两部分组成:
- **前端** — HTML + JS + CSS (客户端检测)
- **后端** — `server.py` (为共享池 Section I 提供持久化 API)

---

## 推荐: Render.com (免费 · 永久 · 完整功能)

一键部署,获得永久 `.onrender.com` 域名。共享池数据存在 Persistent Disk,重启/更新不丢。

### 前提
1. 一个 [GitHub](https://github.com) 账号
2. 一个 [Render](https://dashboard.render.com) 账号 (GitHub 登录,免费)

### 步骤

```bash
# 1. 初始化 Git (如果还没做)
cd /Users/yanxiao/gender-bias-rewriter
git init
git add -A
git commit -m "Initial commit"

# 2. 在 GitHub 创建仓库
#    https://github.com/new
#    名称: gender-bias-rewriter

# 3. 推送到 GitHub
git remote add origin https://github.com/YOUR_USERNAME/gender-bias-rewriter.git
git push -u origin main

# 4. 在 Render 部署
#    打开 https://dashboard.render.com/select-repo
#    → Connect GitHub → 选择 gender-bias-rewriter
#    → Render 会自动识别 render.yaml
#    → 点击 Apply → 等 2 分钟
```

### 部署后
```
你的网站: https://gender-bias-detector.onrender.com
```

共享池数据保存在 `/data/shared_data.json` (1GB Persistent Disk),永久保留。

### 注意事项
- 免费实例 15 分钟无访问会休眠,首次访问需等 ~15 秒唤醒
- 唤醒后一切功能正常,包括共享池
- 升级网站: `git push` 即可,Render 自动重新部署,数据不丢

---

## 备选: 本地运行 + 临时隧道

适合快速演示,不需要注册。

```bash
cd /Users/yanxiao/gender-bias-rewriter
python3 server.py
# 服务运行在 http://localhost:8765

# 另一个终端:
npx cloudflared tunnel --url http://localhost:8765
# 会打印 https://xxx.trycloudflare.com
```

> ⚠️ 本地隧道依赖 Mac 开机+网络,关机会失效,URL 每次重启变化。

---

## 验证清单

部署完成后,在新设备/手机浏览器测试:

- [ ] 页面加载正常
- [ ] 输入 "女人太情绪化" → 检测到橙色标记 → 显示改写
- [ ] 切换英文 -> 全部文本变为英文
- [ ] Section I 显示「🟢 已连接共享池」
- [ ] Section I 提交一条语料,刷新后仍在
- [ ] 输入 "nvq又在闹了" → 检测到 `nvq` → 解码为「女拳」
- [ ] 输入 "男主外女主内是天经地义的" → 深度分析标记「传统正当化」
- [ ] Section J 粘贴博文 → 扫描全文 → 显示风险评分 + 逐句分析

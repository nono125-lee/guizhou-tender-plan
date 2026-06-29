# 贵州招标计划查询

本项目生成贵州省公共资源交易云工程建设 `AP1` 招标计划静态查看页。

本地更新：

```bash
python3 ~/.codex/skills/tender-plan-intelligence/scripts/collect_plan.py \
  --site-dir /Users/nonolee/Documents/超长期标讯/site/tender-plan \
  --pub-date l3m
```

页面入口：

- 本地：`site/tender-plan/index.html`
- GitHub Pages：发布 `site/` 目录后访问站点根目录或 `/tender-plan/`

展示口径：

- `latest.json` 保留公告级原始记录及每条公告链接。
- 页面按标准化后的项目名称分组，默认只展示发布时间最新的版本；其余公告可从卡片内的“历史版本”展开查看。
- “今日新增”、筛选结果数和资金来源分布按去重后的项目口径展示。

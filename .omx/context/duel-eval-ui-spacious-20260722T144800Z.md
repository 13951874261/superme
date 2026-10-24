# Context Snapshot: 实操对决评估 UI 空旷优化

## Task Statement
优化「人机对抗沙盘」推演完成后的「实操对决评估」面板 UI，解决右侧/大片背景空旷问题。

## Desired Outcome
结果页信息密度与版面利用合理，不再出现大片空白。

## Stated Solution
用户附 redesign-skill + deep-interview，要求先访谈再改。

## Probable Intent
当前结果挤在窄栏，宽屏剩余区域只有模糊背景，观感像“没做完”。

## Known Facts [from-code][auto-confirmed]
- 文件：`src/components/modules/GameTheoryModule.tsx`
- 推演有结果时：表单区 `lg:col-span-7`，结果区 `lg:col-span-3`（约 1341–1478 行）
- 结果内容：得分卡、利益/动机/弱点、因果链、人性归档、战略点拨 — 全部垂直堆在窄栏
- 高管案例研判 Tab 有类似 `lg:col-span-7` + `lg:col-span-3` 模式（约 544/766）
- 栈：React + Tailwind + motion；DESIGN.md 存在于仓库根

## Constraints
- AGENTS.md：确认后才改代码；中文沟通
- redesign：不换框架；小步改进；不破坏功能
- deep-interview：本阶段不实施

## Unknowns
- 空旷应通过「加宽结果区 / 双栏重排内容 / 结果替换表单全宽」哪条路径解决
- 推演完成后表单是否仍需常驻可见
- 是否同时改高管案例研判的同类右侧窄栏

## Decision Boundaries (Unresolved)
- 布局范式选择
- 首版 scope 边界

## Likely Touchpoints
- `GameTheoryModule.tsx` 人机对抗沙盘结果面板（~1106–1478）

## Prompt-Safe Summary Status
not_needed

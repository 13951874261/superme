# 长文生成 API key 配置部署核验

## 范围

仅更新服务器 `/etc/super-agent/vocab.env` 中的 `DIFY_LONG_AUDIO_API_KEY`，使其与用户指定值一致。本文不记录凭据值。未部署本地其他代码改动。

## 部署结果

- 更新前：systemd 环境文件未定义该变量；后台目录 `.env` 已匹配指定值。
- 更新：在 systemd 环境文件中显式配置该变量，其他配置内容保持不变。
- 更新前备份：`/etc/super-agent/vocab.env.backup-long-key-1791457700401`，权限 `0600`。
- 重启：`super-agent-vocab.service`，状态 `active`。

## 验证结果

| 检查 | 实际结果 |
| --- | --- |
| 重启后进程环境中的长文 key | 与指定值一致，仅输出匹配结果 |
| `GET http://127.0.0.1:3001/api/vocab/health` | HTTP 200，`success=true`，`ok=true` |
| 使用实际进程 key 请求 Dify `GET /info` | HTTP 200 |
| Dify 应用名称 | `materail_generate_url_enhanced` |

## 验证边界

以上证明配置已加载、后台健康、Dify 应用鉴权成功。不证明长文生成成功，也不证明连续 300 秒无数据的流空闲超时已解决。未重新运行截图中的失败任务，未调用会生成内容的 Dify 接口。

## Git 交付

仅提交本核验记录；不提交 `.env`、API key、服务器备份文件，以及工作区中与本次任务无关的代码修改。

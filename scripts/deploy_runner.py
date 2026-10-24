#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Super-Agent One-Click Deploy Runner using Paramiko
Supports password auth, SFTP recursive directory sync, remote execution, and key registration.
"""

import os
import sys
import argparse
import subprocess
import paramiko
from pathlib import Path

# Force UTF-8 output if possible, else replace unencodable characters
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PROJECT_ROOT = Path(r"D:\cursor\work\super-agent")
SERVER_HOST = "150.158.34.217"
SERVER_USER = "ubuntu"
DEFAULT_PASSWORD = "19890430@lmq"
REMOTE_WEB_ROOT = "/var/www/super-agent"
REMOTE_API_ROOT = "/var/www/super-agent/vocab-server"

def print_banner():
    print("============================================================")
    print(" [Deploy] Super-Agent 自动化智能部署 (Paramiko SSH/SFTP 引擎)")
    print("============================================================")

def run_local(cmd, cwd=PROJECT_ROOT):
    print(f"  -> 本地执行: {cmd}")
    res = subprocess.run(cmd, shell=True, cwd=cwd)
    if res.returncode != 0:
        raise RuntimeError(f"本地命令执行失败 (退出码 {res.returncode}): {cmd}")

def sftp_makedirs(sftp, remote_dir):
    dirs = []
    head, tail = os.path.split(remote_dir)
    while len(tail) > 0:
        dirs.insert(0, tail)
        head, tail = os.path.split(head)
    current = "/" if remote_dir.startswith("/") else ""
    for d in dirs:
        current = os.path.join(current, d).replace("\\", "/")
        try:
            sftp.stat(current)
        except IOError:
            try:
                sftp.mkdir(current)
            except IOError:
                pass

def sftp_upload_file(sftp, local_path, remote_path):
    remote_dir = os.path.dirname(remote_path).replace("\\", "/")
    sftp_makedirs(sftp, remote_dir)
    print(f"  -> 上传: {local_path} -> {remote_path}")
    sftp.put(str(local_path), remote_path)

def sftp_upload_tree(sftp, local_dir, remote_dir):
    local_dir = Path(local_dir)
    for root, _, files in os.walk(local_dir):
        for f in files:
            full_local = Path(root) / f
            rel_path = full_local.relative_to(local_dir)
            full_remote = (Path(remote_dir) / rel_path).as_posix()
            sftp_upload_file(sftp, full_local, full_remote)

def exec_remote(ssh, cmd):
    print(f"  -> 远端执行: {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, get_pty=True)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    status = stdout.channel.recv_exit_status()
    if out.strip():
        for line in out.strip().splitlines():
            print(f"     [Remote] {line}")
    if status != 0:
        print(f"     [Error] {err}")
        raise RuntimeError(f"远端命令失败 (退出码 {status}): {cmd}")
    return out

def register_ssh_key(ssh):
    pub_key_path = Path.home() / ".ssh" / "id_rsa.pub"
    if pub_key_path.exists():
        try:
            pub_key = pub_key_path.read_text(encoding="utf-8").strip()
            if pub_key:
                print("  -> 正在将本地 id_rsa.pub 注册到远端 authorized_keys...")
                cmd = f"mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && grep -q '{pub_key[:40]}' ~/.ssh/authorized_keys || echo '{pub_key}' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
                exec_remote(ssh, cmd)
                print("  [OK] 本机公钥已成功绑定远端，后续支持免密连接！")
        except Exception as e:
            print(f"  [提示] 公钥注册跳过: {e}")

def main():
    parser = argparse.ArgumentParser(description="Super-Agent Deployment Script")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="SSH password")
    parser.add_argument("--skip-frontend", action="store_true", help="Skip pnpm build")
    parser.add_argument("--message", default="feat(xf-feed-02): upload book/video mindmap deepen and hardness gates", help="Git commit message")
    args = parser.parse_args()

    print_banner()

    # 1. 前端构建
    if not args.skip_frontend:
        print("\n[1/5] 本地构建前端 (pnpm build)...")
        run_local("pnpm build")
        print("  [OK] 前端构建完成！")
    else:
        print("\n[1/5] 跳过前端构建，直接同步现有产物...")

    # 2. 连接 SSH
    print("\n[2/5] 连接远端服务器 (150.158.34.217)...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(SERVER_HOST, username=SERVER_USER, password=args.password, timeout=15)
    sftp = client.open_sftp()
    print("  [OK] SSH 与 SFTP 连接成功！")

    register_ssh_key(client)

    # 3. 准备远端目录并上传前端产物
    print("\n[3/5] 上传前端与静态资源...")
    exec_remote(client, f"sudo mkdir -p /var/log/nginx && mkdir -p {REMOTE_WEB_ROOT}/dist/assets {REMOTE_WEB_ROOT}/dist/images {REMOTE_API_ROOT}/services {REMOTE_API_ROOT}/tests")
    
    dist_dir = PROJECT_ROOT / "dist"
    if (dist_dir / "index.html").exists():
        sftp_upload_file(sftp, dist_dir / "index.html", f"{REMOTE_WEB_ROOT}/dist/index.html")
    if (dist_dir / "assets").exists():
        sftp_upload_tree(sftp, dist_dir / "assets", f"{REMOTE_WEB_ROOT}/dist/assets")
    if (dist_dir / "images").exists():
        sftp_upload_tree(sftp, dist_dir / "images", f"{REMOTE_WEB_ROOT}/dist/images")
    print("  [OK] 前端静态文件上传完毕")

    # 4. 后端本轮核心代码上传
    print("\n[4/5] 上传后端核心服务与门禁代码...")
    exec_remote(client, f"cp {REMOTE_API_ROOT}/server.js {REMOTE_API_ROOT}/server.js.bak || true")

    backend_sync_files = [
        "vocab-server/server.js",
        "vocab-server/services/vaultRefine.js",
        "vocab-server/services/vaultRefineDepthQuality.js",
        "vocab-server/services/moduleHardnessQuality.js",
        "vocab-server/services/gameTheoryKnowledge.js",
        "vocab-server/services/gameTheoryCasePushService.js",
        "vocab-server/services/knowledgeTheoryNodes.js",
        "vocab-server/services/knowledgeVaultExtra.js",
        "vocab-server/services/gtCaseQuality.js",
        "vocab-server/services/insightSpeakProxy.js",
        "vocab-server/tests/vaultRefineDepth.test.js",
        "vocab-server/tests/moduleHardnessQuality.test.js",
        "vocab-server/tests/vaultRefine.test.js",
        "vocab-server/tests/vaultFeedContract.test.js",
        "vocab-server/tests/gameTheoryKnowledge.test.js",
        "vocab-server/tests/knowledgeTheoryNodes.test.js"
    ]

    for f in backend_sync_files:
        local_f = PROJECT_ROOT / f
        if local_f.exists():
            rel = f.replace("vocab-server/", "")
            remote_f = f"{REMOTE_API_ROOT}/{rel}"
            sftp_upload_file(sftp, local_f, remote_f)

    # 5. 远端校验、Nginx 重载与服务热重启
    print("\n[5/5] 执行远端语法单测、重载 Nginx 并重启 Node 服务...")
    exec_remote(client, f"cd {REMOTE_API_ROOT} && node --check server.js && node tests/vaultRefineDepth.test.js && node tests/moduleHardnessQuality.test.js")
    exec_remote(client, "sudo mkdir -p /var/log/nginx && sudo nginx -t && sudo systemctl reload nginx")
    exec_remote(client, "sudo systemctl restart super-agent-vocab.service")
    status_out = exec_remote(client, "sudo systemctl is-active super-agent-vocab.service")
    print(f"  [OK] 远端服务运行状态: {status_out.strip()}")

    sftp.close()
    client.close()

    # 6. 本地 Git 提交与推送
    print("\n[Git] 提交并推送本地改动...")
    try:
        run_local(f'git add -A && git commit -m "{args.message}" || true')
        branch = subprocess.check_output("git branch --show-current", shell=True, cwd=PROJECT_ROOT).decode().strip()
        run_local(f"git push origin {branch}")
        print(f"  [OK] 代码已推送至 GitHub: {branch}")
    except Exception as e:
        print(f"  [提示] Git push 提示: {e}")

    print("\n" + "=" * 60)
    print(" [Success] 部署全部顺利完成！")
    print(" 访问地址: https://app.liujingzhuwo.site/")
    print(" 建议在浏览器中按 Ctrl + Shift + R 强制刷新缓存。")
    print("=" * 60)

if __name__ == "__main__":
    main()

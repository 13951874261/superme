import paramiko, sys

host = "127.0.0.1"
port = 2222
user = "root"
pwd  = "2QVm2tJ9lH7Ks5Lw4w"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=user, password=pwd, timeout=10)
print("Connected successfully.\n")

cmds = [
    "ls -la /root/aow2api/",
    "find /root/aow2api/ -maxdepth 2 -name '*.py' -o -name '*.js' -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' -o -name 'Dockerfile' -o -name '.env' -o -name '*.conf' -o -name '*.cfg' -o -name '*.toml' | head -50",
    "cat /root/aow2api/docker-compose.yml 2>/dev/null || cat /root/aow2api/compose.yml 2>/dev/null || echo 'NO_COMPOSE_FILE'",
    "cat /root/aow2api/Dockerfile 2>/dev/null || echo 'NO_DOCKERFILE'",
    "cat /root/aow2api/.env 2>/dev/null || echo 'NO_ENV_FILE'",
    "cat /root/aow2api/package.json 2>/dev/null || echo 'NO_PACKAGE_JSON'",
    "cat /root/aow2api/requirements.txt 2>/dev/null || echo 'NO_REQUIREMENTS'",
    "cat /root/aow2api/app.py 2>/dev/null || echo 'NO_APP_PY'",
    "cat /root/aow2api/main.py 2>/dev/null || echo 'NO_MAIN_PY'",
    "cat /root/aow2api/server.py 2>/dev/null || echo 'NO_SERVER_PY'",
    "cat /root/aow2api/index.js 2>/dev/null || echo 'NO_INDEX_JS'",
    "ls -la /root/aow2api/src/ 2>/dev/null || echo 'NO_SRC_DIR'",
    "netstat -tlnp 2>/dev/null | head -30 || ss -tlnp | head -30",
    "docker ps 2>/dev/null || echo 'NO_DOCKER'",
    "ip addr show | grep 'inet ' || hostname -I",
]

for cmd in cmds:
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=10)
        out = stdout.read().decode(errors="ignore").strip()
        err = stderr.read().decode(errors="ignore").strip()
        if out or err:
            print(f"=== {cmd} ===")
            if out:
                print(out)
            if err:
                print(f"[STDERR] {err}")
            print()
    except Exception as e:
        print(f"=== {cmd} === ERROR: {e}\n")

client.close()

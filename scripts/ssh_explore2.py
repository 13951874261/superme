import paramiko

host = "127.0.0.1"
port = 2222
user = "root"
pwd  = "2QVm2tJ9lH7Ks5Lw4w"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=user, password=pwd, timeout=10)

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode(errors="ignore").strip()
    err = stderr.read().decode(errors="ignore").strip()
    print(f"=== {cmd} ===")
    if out:
        print(out)
    if err:
        print(f"[STDERR] {err}")
    print()

run("ls -la /root/aow2api/")
run("cat /root/aow2api/docker-compose.yml")
run("cat /root/aow2api/Dockerfile")
run("cat /root/aow2api/.env")
run("cat /root/aow2api/requirements.txt")
run("cat /root/aow2api/config.py")
run("cat /root/aow2api/main.py")
run("cat /root/aow2api/aow_client.py")
run("cat /root/aow2api/restart.sh")
run("netstat -tlnp 2>/dev/null | grep -E 'LISTEN|State' || ss -tlnp | head -30")
run("docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || echo 'NO_DOCKER'")
run("iptables -L INPUT -n 2>/dev/null | head -20 || echo 'NO_IPTABLES'")
run("ufw status 2>/dev/null || echo 'NO_UFW'")
run("cat /etc/nginx/nginx.conf 2>/dev/null | head -50 || echo 'NO_NGINX'")
run("ls /etc/nginx/sites-enabled/ 2>/dev/null || echo 'NO_NGINX_SITES'")

client.close()

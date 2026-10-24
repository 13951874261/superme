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

run("cat /root/aow2api/main.py")
run("cat /root/aow2api/config.py")
run("cat /root/aow2api/restart.sh")
run("ss -tlnp | head -30")
run("docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'")
run("iptables -L INPUT -n 2>/dev/null | head -30 || echo 'NO_IPTABLES'")
run("ufw status 2>/dev/null || echo 'NO_UFW'")
run("cat /etc/nginx/sites-enabled/default 2>/dev/null || echo 'NO_NGINX_DEFAULT'")
run("ls /etc/nginx/sites-enabled/ 2>/dev/null || echo 'NO_NGINX_SITES'")
run("ip addr show | grep 'inet '")

client.close()

import paramiko
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

host = "127.0.0.1"
port = 2222
user = "root"
pwd  = "2QVm2tJ9lH7Ks5Lw4w"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=user, password=pwd, timeout=10)

def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    print(f"=== {cmd} ===")
    if out:
        print(out)
    if err:
        print(f"[STDERR] {err}")
    print()

run("cat /etc/nginx/sites-enabled/9router-origin")
run("cat /etc/nginx/sites-enabled/aow2.234124123.xyz.conf")
run("curl -s -o /dev/null -w '%{http_code}' http://localhost:38000/")
run("curl -s http://localhost:38000/")

client.close()

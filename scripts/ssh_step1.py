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

run("cat /root/aow2api/docker-compose.yml")
run("cat /root/aow2api/Dockerfile")
run("cat /root/aow2api/.env")
run("cat /root/aow2api/requirements.txt")

client.close()

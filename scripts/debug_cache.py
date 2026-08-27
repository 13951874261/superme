import sys
import paramiko

def debug_cache():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    cmd1 = '''cd /var/www/super-agent/vocab-server && sqlite3 /var/www/super-agent/vocab.db "SELECT word, user_id, created_at, substr(response_payload,1,300) FROM dict_query_log ORDER BY created_at DESC LIMIT 10;"'''
    stdin, stdout, stderr = client.exec_command(cmd1)
    print("=== dict_query_log ===")
    print(stdout.read().decode('utf-8'))
    
    cmd2 = '''cd /var/www/super-agent/vocab-server && sqlite3 /var/www/super-agent/vocab.db "SELECT word, user_id, substr(payload,1,400) FROM vocabulary WHERE word IN ('vibe','bitch') ORDER BY added_at DESC;"'''
    stdin, stdout, stderr = client.exec_command(cmd2)
    print("=== vocabulary (vibe/bitch) ===")
    print(stdout.read().decode('utf-8'))
    
    client.close()

if __name__ == '__main__':
    debug_cache()

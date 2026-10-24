import sys
import paramiko
import base64

def debug():
    sys.stdout.reconfigure(encoding='utf-8')
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect('150.158.34.217', 22, 'ubuntu', '19890430@lmq')

    # Test the regex pattern directly
    cmd = '''
    node -e "
    const pattern = /^(uk|us|your browser|[\\/]\\w+[\\/]|add to word list|idioms?|noun|verb|adjective|adverb|pronoun|preposition|conjunction|exclamation|determiner|modal verb|phrasal verb)(?:\\s*\\[[^\\]]+\\])?$/i;
    
    const lines = [
      'uk',
      'Your browser doesn\\'t support HTML5 audio',
      '/mʌd/',
      'B2',
      'earth that has been mixed with water',
      '泥， 泥土; 烂泥， 泥浆; 淤泥'
    ];
    
    lines.forEach((line, i) => {
      console.log(i + ': test=' + pattern.test(line) + ' => ' + line);
    });
    "
    '''
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8')
    err = stderr.read().decode('utf-8')
    print("OUT:", out)
    if err.strip():
        print("ERR:", err)
    client.close()

if __name__ == '__main__':
    debug()
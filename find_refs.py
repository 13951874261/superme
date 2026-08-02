import yaml, re
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    content = f.read()

matches = re.findall(r'\{\{#[^}]+#\}\}', content)
for m in set(matches):
    print(m)

import yaml, json
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

nodes = data["workflow"]["graph"]["nodes"]
start_node = next(n for n in nodes if n['id'] == '1780382595776')
print("=== Start Node Variables ===")
print(json.dumps(start_node['data'].get('variables', []), indent=2, ensure_ascii=False))

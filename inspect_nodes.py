import yaml
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)
nodes = data["workflow"]["graph"]["nodes"]
# Print the parameter-extractor and LLM nodes configs
for nid in ['1780387351165', '1780389832514', '1780396257514']:
    node = next(n for n in nodes if n['id'] == nid)
    print(f"=== Node {nid} ({node['data'].get('type')}) ===")
    print(yaml.dump(node, allow_unicode=True, default_flow_style=False))

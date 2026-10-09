import yaml, re
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

nodes = data["workflow"]["graph"]["nodes"]

for node in nodes:
    nid = node["id"]
    ntype = node["data"].get("type")
    node_str = yaml.dump(node, allow_unicode=True)
    refs = re.findall(r'\{\{#[^}]+#\}\}', node_str)
    if refs:
        print(f"Node {nid} ({ntype}) references:")
        for ref in sorted(set(refs)):
            print(f"  {ref}")

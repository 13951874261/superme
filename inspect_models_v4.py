import yaml
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)
nodes = data["workflow"]["graph"]["nodes"]
for node in nodes:
    ntype = node['data'].get('type')
    if ntype in ['llm', 'parameter-extractor']:
        model = node['data'].get('model', {})
        print(f"Node {node['id']} ({ntype}): name={model.get('name')}, provider={model.get('provider')}")

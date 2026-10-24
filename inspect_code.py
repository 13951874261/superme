import yaml, json
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

nodes = data["workflow"]["graph"]["nodes"]
code_node = next(n for n in nodes if n['id'] == 'f6a7b8c9-d0e1-4902-mat1-123456789012')
print("=== Code Node ===")
print("Variables:", json.dumps(code_node['data'].get('variables', []), indent=2, ensure_ascii=False))
print("Code:\n", code_node['data'].get('code'))

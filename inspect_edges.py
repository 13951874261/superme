import yaml, json
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)

edges = data["workflow"]["graph"]["edges"]
nodes = data["workflow"]["graph"]["nodes"]

# Dump all edges detail
print("=== Edges ===")
for e in edges:
    print(f"ID: {e.get('id')}")
    print(f"  Source: {e.get('source')} (handle={e.get('sourceHandle')})")
    print(f"  Target: {e.get('target')} (handle={e.get('targetHandle')})")
    print(f"  Data: {e.get('data')}")
    print()

print("=== Nodes inside iteration check ===")
for n in nodes:
    nid = n['id']
    parentId = n.get('parentId')
    print(f"Node: {nid} ({n['data'].get('type')}) parentId={parentId}")

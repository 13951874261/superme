import yaml, json
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

nodes4 = {n['id']: n for n in d4["workflow"]["graph"]["nodes"]}
nodes5 = {n['id']: n for n in d5["workflow"]["graph"]["nodes"]}

# Compare assigner node
a4 = nodes4['1780385608087']['data']
a5 = nodes5['1780385608087']['data']
print("Assigner v4 items:", json.dumps(a4.get('items'), indent=2, ensure_ascii=False))
print("Assigner v5 items:", json.dumps(a5.get('items'), indent=2, ensure_ascii=False))
print()
print("Assigner v4 items length:", len(a4.get('items', [])))
print("Assigner v5 items length:", len(a5.get('items', [])))

import yaml, json
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

nodes4 = {n['id']: n for n in d4["workflow"]["graph"]["nodes"]}
nodes5 = {n['id']: n for n in d5["workflow"]["graph"]["nodes"]}

# Compare iteration node
i4 = nodes4['1780396184720']['data']
i5 = nodes5['1780396184720']['data']
print("Iteration v4:", json.dumps(i4, indent=2, ensure_ascii=False))
print()
print("Iteration v5:", json.dumps(i5, indent=2, ensure_ascii=False))

import yaml, json
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

print("=== COMPREHENSIVE DIFF ===\n")

# Compare all nodes
nodes4 = {n['id']: n for n in d4["workflow"]["graph"]["nodes"]}
nodes5 = {n['id']: n for n in d5["workflow"]["graph"]["nodes"]}

for nid in sorted(set(nodes4.keys()) | set(nodes5.keys())):
    n4 = nodes4.get(nid)
    n5 = nodes5.get(nid)
    if n4 is None:
        print(f"[NEW NODE in v5] {nid} ({n5['data'].get('type')})")
        continue
    if n5 is None:
        print(f"[REMOVED in v5] {nid} ({n4['data'].get('type')})")
        continue
    n4d = n4['data']
    n5d = n5['data']
    if n4d != n5d:
        print(f"[CHANGED] Node {nid} ({n4d.get('type')})")
        for key in sorted(set(n4d.keys()) | set(n5d.keys())):
            if n4d.get(key) != n5d.get(key):
                v4_val = json.dumps(n4d.get(key), ensure_ascii=False)
                v5_val = json.dumps(n5d.get(key), ensure_ascii=False)
                print(f"  {key}:")
                print(f"    v4: {v4_val[:200]}")
                print(f"    v5: {v5_val[:200]}")
        print()

# Compare edges
edges4 = {(e['source'], e['target']): e for e in d4["workflow"]["graph"]["edges"]}
edges5 = {(e['source'], e['target']): e for e in d5["workflow"]["graph"]["edges"]}
for key in sorted(set(edges4.keys()) | set(edges5.keys())):
    e4 = edges4.get(key)
    e5 = edges5.get(key)
    if e4 is None:
        print(f"[NEW EDGE] {key[0]} -> {key[1]}")
    elif e5 is None:
        print(f"[REMOVED EDGE] {key[0]} -> {key[1]}")
    elif e4 != e5:
        print(f"[CHANGED EDGE] {key}")
        for k in sorted(set(e4.keys()) | set(e5.keys())):
            if e4.get(k) != e5.get(k):
                print(f"  {k}: v4={e4.get(k)} v5={e5.get(k)}")
    print()

# Compare conversation variables
cv4 = d4["workflow"].get("conversation_variables", [])
cv5 = d5["workflow"].get("conversation_variables", [])
if cv4 != cv5:
    print("[CHANGED] conversation_variables")
    print(f"  v4: {json.dumps(cv4, ensure_ascii=False)}")
    print(f"  v5: {json.dumps(cv5, ensure_ascii=False)}")

# Compare start node variables
start4 = next(n for n in nodes4.values() if n['id'] == '1780382595776')['data']
start5 = next(n for n in nodes5.values() if n['id'] == '1780382595776')['data']
if start4.get('variables') != start5.get('variables'):
    print("[CHANGED] Start node variables")
    v4_vars = {v['variable'] for v in start4.get('variables', [])}
    v5_vars = {v['variable'] for v in start5.get('variables', [])}
    print(f"  v4 vars: {v4_vars}")
    print(f"  v5 vars: {v5_vars}")
    print(f"  Added: {v5_vars - v4_vars}")
    print(f"  Removed: {v4_vars - v5_vars}")

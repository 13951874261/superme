import yaml
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

nodes4 = {n['id']: n for n in d4["workflow"]["graph"]["nodes"]}
nodes5 = {n['id']: n for n in d5["workflow"]["graph"]["nodes"]}

print("Nodes in 4 but not in 5:", set(nodes4.keys()) - set(nodes5.keys()))
print("Nodes in 5 but not in 4:", set(nodes5.keys()) - set(nodes4.keys()))

print("\nComparing node configurations:")
for nid in set(nodes4.keys()) & set(nodes5.keys()):
    n4 = nodes4[nid]
    n5 = nodes5[nid]
    if n4 != n5:
        print(f"Node {nid} ({n4['data'].get('type')}) differs.")
        # print first difference
        n4_str = yaml.dump(n4, allow_unicode=True)
        n5_str = yaml.dump(n5, allow_unicode=True)
        if len(n4_str) != len(n5_str):
            print(f"  Length: 4={len(n4_str)}, 5={len(n5_str)}")

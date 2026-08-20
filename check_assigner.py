import yaml, json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

nodes4 = {n['id']: n for n in d4["workflow"]["graph"]["nodes"]}
nodes5 = {n['id']: n for n in d5["workflow"]["graph"]["nodes"]}

# Check assigner node structure
a4 = nodes4['1780385608087']['data']
a5 = nodes5['1780385608087']['data']
print("=== Assigner v4 ===")
print(json.dumps(a4, indent=2, ensure_ascii=False))
print("\n=== Assigner v5 ===")
print(json.dumps(a5, indent=2, ensure_ascii=False))

# Check answer node
ans4 = nodes4['answer']['data']
ans5 = nodes5['answer']['data']
print("\n=== Answer v4 ===")
print(json.dumps(ans4, indent=2, ensure_ascii=False))
print("\n=== Answer v5 ===")
print(json.dumps(ans5, indent=2, ensure_ascii=False))

# Check template-transform
tt4 = next(n for n in d4["workflow"]["graph"]["nodes"] if n["id"] == "1780396408329")["data"]
tt5 = next(n for n in d5["workflow"]["graph"]["nodes"] if n["id"] == "1780396408329")["data"]
print("\n=== Template Transform v4 ===")
print(json.dumps(tt4, indent=2, ensure_ascii=False))
print("\n=== Template Transform v5 ===")
print(json.dumps(tt5, indent=2, ensure_ascii=False))

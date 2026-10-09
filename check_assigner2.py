import yaml, json
import sys
sys.stdout.reconfigure(encoding='utf-8')
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)
nodes4 = {n['id']: n for n in d4["workflow"]["graph"]["nodes"]}
nodes5 = {n['id']: n for n in d5["workflow"]["graph"]["nodes"]}

# Check the code node
code4 = next(n for n in nodes4.values() if n['data']['type'] == 'code')['data']
code5 = next(n for n in nodes5.values() if n['data']['type'] == 'code')['data']
print("=== Code Node v4 ===")
print("Outputs:", code4.get('outputs'))
print("\n=== Code Node v5 ===")
print("Outputs:", code5.get('outputs'))

# Check parameter extractor
pe4 = nodes4['1780387351165']['data']
pe5 = nodes5['1780387351165']['data']
print("\n=== Parameter Extractor v4 ===")
print(json.dumps(pe4, indent=2, ensure_ascii=False))
print("\n=== Parameter Extractor v5 ===")
print(json.dumps(pe5, indent=2, ensure_ascii=False))

# Check if conversation.generated_history is accessible
print("\n=== Conversation Variables ===")
print("v4:", json.dumps(d4["workflow"].get("conversation_variables", []), ensure_ascii=False))
print("v5:", json.dumps(d5["workflow"].get("conversation_variables", []), ensure_ascii=False))

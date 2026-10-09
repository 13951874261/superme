import yaml
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

# Find parameter extractor nodes
pe4 = next(n for n in d4["workflow"]["graph"]["nodes"] if n["id"] == "1780387351165")
pe5 = next(n for n in d5["workflow"]["graph"]["nodes"] if n["id"] == "1780387351165")

print("=== Parameter Extractor v4 ===")
print(f"Instruction: {pe4['data'].get('instruction')}")

print("\n=== Parameter Extractor v5 ===")
print(f"Instruction: {pe5['data'].get('instruction')}")

print("\n=== DIFF ===")
if pe4['data'].get('instruction') != pe5['data'].get('instruction'):
    print("INSTRUCTION CHANGED - v5 contains variable reference that v4 does not have")

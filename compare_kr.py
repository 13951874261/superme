import yaml
with open('materail_generate_url_enhanced (4).yml', 'r', encoding='utf-8') as f:
    d4 = yaml.safe_load(f)
with open('materail_generate_url_enhanced (5).yml', 'r', encoding='utf-8') as f:
    d5 = yaml.safe_load(f)

kr4 = next(n for n in d4["workflow"]["graph"]["nodes"] if n["id"] == "e5f6a7b8-c9d0-4891-mat0-012345678901")
kr5 = next(n for n in d5["workflow"]["graph"]["nodes"] if n["id"] == "e5f6a7b8-c9d0-4891-mat0-012345678901")
print("KR4 dataset_ids:", kr4["data"].get("dataset_ids"))
print("KR5 dataset_ids:", kr5["data"].get("dataset_ids"))
print("KR4 retrieval_mode:", kr4["data"].get("retrieval_mode"))
print("KR5 retrieval_mode:", kr5["data"].get("retrieval_mode"))
print("KR4 multiple_retrieval_config:", yaml.dump(kr4["data"].get("multiple_retrieval_config"), allow_unicode=True))
print("KR5 multiple_retrieval_config:", yaml.dump(kr5["data"].get("multiple_retrieval_config"), allow_unicode=True))

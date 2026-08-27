import sys
import requests
import json

def test_remote_http_api():
    sys.stdout.reconfigure(encoding='utf-8')
    base_url = 'https://ai.234124123.xyz'
    headers = {'Content-Type': 'application/json'}
    test_user_id = 'verify_cambridge_user_2026'

    print("1. 测试 /api/dify/dict-query (vibe)...")
    res = requests.post(f"{base_url}/api/dify/dict-query", json={
        'word': 'vibe',
        'dictType': 'en_zh_bidirectional',
        'userId': test_user_id
    }, headers=headers, timeout=15)
    
    data = res.json()
    print("STATUS:", res.status_code)
    print("OK:", data.get('ok'))
    payload = data.get('payload', {})
    print("HEADWORD:", payload.get('headword'))
    print("SENSES_COUNT:", len(payload.get('senses', [])))
    print("RAW_MARKDOWN_EXISTS:", bool(payload.get('raw_markdown')))
    print("PHONETICS:", payload.get('phonetics'))
    print("FIELD_SOURCE_MAIN:", payload.get('field_sources', {}).get('translation_main'))
    print("FIELD_SOURCE_SENSES:", payload.get('field_sources', {}).get('senses'))
    print("TRANSLATION_MAIN:", payload.get('translation_main'))
    
    print("\n2. 测试 /api/vocab/add-enriched (直接入库)...")
    res_add = requests.post(f"{base_url}/api/vocab/add-enriched", json={
        'word': 'vibe',
        'payload': payload,
        'userId': test_user_id
    }, headers=headers, timeout=15)
    data_add = res_add.json()
    print("ADD_STATUS:", res_add.status_code)
    print("ADD_SUCCESS:", data_add.get('success'))
    saved_payload = data_add.get('entry', {}).get('payload', {})
    if isinstance(saved_payload, str):
        saved_payload = json.loads(saved_payload)
    print("SAVED_HAS_RAW_MD:", bool(saved_payload.get('raw_markdown')))
    print("SAVED_SENSES_LEN:", len(saved_payload.get('senses', [])))
    print("SAVED_PHONETICS:", saved_payload.get('phonetics'))

if __name__ == '__main__':
    test_remote_http_api()

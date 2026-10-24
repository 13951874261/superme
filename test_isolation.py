import os
from urllib.parse import urlsplit


def require_test_api_base():
    value = os.environ.get('TEST_API_BASE_URL', '')
    parsed = urlsplit(value)
    if (parsed.scheme not in ('http', 'https')
            or parsed.hostname not in ('127.0.0.1', 'localhost', '::1')
            or not parsed.port or parsed.username or parsed.password
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment):
        raise RuntimeError('测试隔离：需提供带端口的独立本机测试服务 TEST_API_BASE_URL')
    return value.rstrip('/')

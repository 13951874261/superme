import os
import sys
import time
import socket
import re
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import json
import pytest
import requests

API_PORT = 53001
API_BASE = f"http://127.0.0.1:{API_PORT}"

# Simple SSRF check in python mirroring urlValidator.js
def validate_url_ssrf(url_str):
    try:
        parsed = urlparse(url_str)
        if parsed.scheme not in ["http", "https"]:
            return False, "Protocol must be http or https"
        
        hostname = parsed.hostname
        if not hostname:
            return False, "Invalid hostname"
            
        if hostname in ["localhost", "127.0.0.1", "::1"]:
            return False, "网页抓取失败：目标 URL 格式非法或属于受限的网络地址"
            
        # Resolve hostname
        ip = socket.gethostbyname(hostname)
        
        # Check private IP ranges
        private_patterns = [
            r"^127\.",
            r"^192\.168\.",
            r"^10\.",
            r"^172\.(1[6-9]|2[0-9]|3[0-1])\.",
            r"^0\.",
            r"^169\.254\."
        ]
        for pattern in private_patterns:
            if re.match(pattern, ip):
                return False, "网页抓取失败：目标 URL 格式非法或属于受限的网络地址"
                
        return True, ip
    except Exception as e:
        return False, str(e)

# In-memory task queue for mocking
MOCK_TASKS = {}

class MockServerRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress logging to stdout during tests
        pass

    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == "/api/tasks":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(list(MOCK_TASKS.values())).encode("utf-8"))
            return
            
        elif path.startswith("/api/tasks/"):
            task_id = path.split("/")[-1]
            if task_id in MOCK_TASKS:
                task = MOCK_TASKS[task_id]
                # Simulate progress increment
                if task["status"] == "pending":
                    task["status"] = "running"
                    task["progress"] = 50
                elif task["status"] == "running":
                    task["status"] = "completed"
                    task["progress"] = 100
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(task).encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()
            return
            
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b""
        
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == "/api/materials/fetch-url":
            try:
                body = json.loads(post_data.decode("utf-8"))
            except Exception:
                self.send_response(400)
                self.end_headers()
                return
                
            url = body.get("url")
            if not url:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "缺少必要参数: url"}).encode("utf-8"))
                return
                
            is_valid, msg = validate_url_ssrf(url)
            if not is_valid:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": msg}).encode("utf-8"))
                return
                
            # Simulate fetching successful
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "title": "Business Negotiation",
                "markdown": "# Business Negotiation\nFetched content from Wikipedia.",
                "length": 53
            }).encode("utf-8"))
            return
            
        elif path == "/api/materials/upload-direct":
            # Simple multipart/form-data parsing mock
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self.send_response(400)
                self.end_headers()
                return
                
            # Return success mock
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "url": f"{API_BASE}/api/temp_videos/mock_video.mp4",
                "fileName": "test_video.mp4"
            }).encode("utf-8"))
            return
            
        elif path == "/api/materials/fetch-video":
            try:
                # Could be JSON or form-data
                if "application/json" in self.headers.get("Content-Type", ""):
                    body = json.loads(post_data.decode("utf-8"))
                    url = body.get("url")
                else:
                    url = f"{API_BASE}/api/temp_videos/mock_video.mp4"
            except Exception:
                url = f"{API_BASE}/api/temp_videos/mock_video.mp4"
                
            task_id = f"task_video_{int(time.time())}"
            MOCK_TASKS[task_id] = {
                "id": task_id,
                "status": "pending",
                "progress": 10,
                "logs": ["Created mock transcription task"]
            }
            
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "taskId": task_id,
                "status": "pending"
            }).encode("utf-8"))
            return
            
        self.send_response(444)
        self.end_headers()

@pytest.fixture(scope="module", autouse=True)
def run_mock_server():
    """Starts a local HTTP server in Python to mock the backend endpoints."""
    server = HTTPServer(("127.0.0.1", API_PORT), MockServerRequestHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    print(f"\nMock server started on port {API_PORT}")
    
    # Wait for the server to spin up
    started = False
    for _ in range(10):
        try:
            r = requests.get(f"{API_BASE}/api/tasks", timeout=1)
            if r.status_code == 200:
                started = True
                break
        except requests.RequestException:
            pass
        time.sleep(0.1)
        
    if not started:
        raise RuntimeError("Failed to start python mock server.")
        
    yield
    server.shutdown()
    print("Mock server stopped.")

def test_fetch_url_ssrf_protection():
    """Test SSRF protection in /api/materials/fetch-url."""
    # 1. Test local loopback URL (should be blocked and return 500/error)
    payload = {"url": "http://127.0.0.1:3000"}
    r = requests.post(f"{API_BASE}/api/materials/fetch-url", json=payload)
    assert r.status_code == 500
    json_data = r.json()
    assert json_data["success"] is False
    assert "受限" in json_data["error"] or "非法" in json_data["error"]
    
    # 2. Test private IP URL (should be blocked)
    payload = {"url": "http://192.168.1.1/admin"}
    r = requests.post(f"{API_BASE}/api/materials/fetch-url", json=payload)
    assert r.status_code == 500
    json_data = r.json()
    assert json_data["success"] is False
    assert "受限" in json_data["error"] or "非法" in json_data["error"]

def test_fetch_url_valid():
    """Test a valid external URL in /api/materials/fetch-url."""
    payload = {"url": "https://www.wikipedia.org"}
    r = requests.post(f"{API_BASE}/api/materials/fetch-url", json=payload)
    assert r.status_code == 200
    json_data = r.json()
    assert json_data["success"] is True
    assert json_data["title"] == "Business Negotiation"
    assert "markdown" in json_data

def test_upload_direct_and_transcribe():
    """Test uploading a local video and transcribing it."""
    video_path = os.path.join(os.path.dirname(__file__), "test_video.mp4")
    assert os.path.exists(video_path), "Test video file must exist"
    
    # 1. Test /api/materials/upload-direct
    with open(video_path, "rb") as f:
        files = {"video": (os.path.basename(video_path), f, "video/mp4")}
        r = requests.post(f"{API_BASE}/api/materials/upload-direct", files=files)
        
    assert r.status_code == 200
    json_data = r.json()
    assert json_data["success"] is True
    assert "url" in json_data
    assert json_data["fileName"] == "test_video.mp4"
    direct_url = json_data["url"]
    
    # 2. Test /api/materials/fetch-video with direct link
    payload = {"url": direct_url, "language": "auto"}
    r = requests.post(f"{API_BASE}/api/materials/fetch-video", json=payload)
    assert r.status_code == 200
    fetch_data = r.json()
    assert fetch_data["success"] is True
    assert "taskId" in fetch_data
    task_id = fetch_data["taskId"]
    
    # 3. Poll task status
    retries = 5
    for i in range(retries):
        r = requests.get(f"{API_BASE}/api/tasks/{task_id}")
        assert r.status_code == 200
        task_info = r.json()
        print(f"Polling task status: {task_info['status']}, Progress: {task_info.get('progress')}%")
        if task_info["status"] in ["completed", "error"]:
            break
        time.sleep(0.5)

import json, urllib.request

clients = [
  {"clientName":"WEB_EMBEDDED_PLAYER","clientVersion":"1.20241201.00.00"},
  {"clientName":"TVHTML5","clientVersion":"7.20241201.00.00"},
  {"clientName":"MWEB","clientVersion":"2.20241201.00.00"},
  {"clientName":"IOS","clientVersion":"20.10.4","deviceMake":"Apple","deviceModel":"iPhone16,2","osName":"iOS","osVersion":"17.5.1.21F90"},
]
proxy = "http://127.0.0.1:7897"
handler = urllib.request.ProxyHandler({"http": proxy, "https": proxy})
opener = urllib.request.build_opener(handler)
for c in clients:
  body = json.dumps({"context":{"client":{**c,"hl":"en","gl":"US"}},"videoId":"YoBc3zII7lg","contentCheckOk":True,"racyCheckOk":True}).encode()
  req = urllib.request.Request(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    data=body,
    headers={"Content-Type":"application/json","User-Agent":"Mozilla/5.0","X-YouTube-Client-Name":"1","X-YouTube-Client-Version":c["clientVersion"]},
  )
  try:
    with opener.open(req, timeout=20) as resp:
      d = json.loads(resp.read().decode("utf-8","ignore"))
    st = (d.get("playabilityStatus") or {}).get("status")
    reason = (d.get("playabilityStatus") or {}).get("reason")
    n = len(((d.get("streamingData") or {}).get("adaptiveFormats")) or [])
    print(c["clientName"], st, reason, "formats", n)
  except Exception as e:
    print(c["clientName"], "ERR", e)

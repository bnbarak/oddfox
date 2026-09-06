#!/usr/bin/env python3
"""ShipFinder API client. Key is read from ~/.config/oddfox/shipfinder.env
and is never printed, logged or written into the repo."""
import json, os, pathlib, sys, urllib.parse, urllib.request

BASE = "https://api.elaneglobal.com/v1"

def _key():
    p = pathlib.Path.home() / ".config/oddfox/shipfinder.env"
    for line in p.read_text().splitlines():
        if line.startswith("SHIPFINDER_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("no key configured")

def call(path, **params):
    k = _key()
    params["key"] = k
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.loads(r.read().decode("utf-8-sig"))
    except Exception as e:
        # never let the key leak through an exception string
        raise SystemExit(f"request failed: {str(e).replace(k, '<KEY>')}")

if __name__ == "__main__":
    ep, kv = sys.argv[1], dict(a.split("=", 1) for a in sys.argv[2:])
    print(json.dumps(call(ep, **kv), indent=1))

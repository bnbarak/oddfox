#!/usr/bin/env python3
"""
Regenerates data/json/world-land.json — the SVG land outline the map tab draws.

Source: Natural Earth 110m land (public domain).
  curl -sLo /tmp/ne110.geojson \
    https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
  python3 tools/build-world-path.py /tmp/ne110.geojson

Projected equirectangular into a 2000x1000 viewBox so lon/lat map linearly:
  x = (lon + 180) / 360 * 2000
  y = (90 - lat) / 180 * 1000
The viewer uses the same formula to place incident markers, so plotting stays
a two-line calculation with no projection library.

Rings are Ramer-Douglas-Peucker simplified and specks dropped; the output is
a coastline for orientation, not for navigation.
"""
import json, math, os, sys

W, H = 2000.0, 1000.0

def proj(lon, lat):
    return ((lon + 180.0) / 360.0 * W, (90.0 - lat) / 180.0 * H)

def ring_area(pts):
    a = 0.0
    for i in range(len(pts) - 1):
        a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(a) / 2.0

def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    def dist(p, a, b):
        if a == b:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = ((p[0]-a[0])*(b[0]-a[0]) + (p[1]-a[1])*(b[1]-a[1])) / ((b[0]-a[0])**2 + (b[1]-a[1])**2)
        t = max(0.0, min(1.0, t))
        return math.hypot(p[0] - (a[0] + t*(b[0]-a[0])), p[1] - (a[1] + t*(b[1]-a[1])))
    dmax, idx = 0.0, 0
    for i in range(1, len(pts) - 1):
        d = dist(pts[i], pts[0], pts[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(pts[:idx+1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

def main(src):
    geo = json.load(open(src))
    paths = []
    for f in geo["features"]:
        g = f["geometry"]
        rings = [g["coordinates"][0]] if g["type"] == "Polygon" else [p[0] for p in g["coordinates"]]
        for ring in rings:
            pts = [proj(x, y) for x, y in ring]
            if ring_area(pts) < 12:
                continue
            pts = rdp(pts, 0.8)
            if len(pts) < 4:
                continue
            paths.append("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")

    out = {
        "projection": "equirectangular",
        "viewBox": [0, 0, W, H],
        "note": "Natural Earth 110m land, RDP-simplified. Public domain. Regenerate with tools/build-world-path.py.",
        "paths": paths,
    }
    dst = os.path.join(os.path.dirname(__file__), "..", "data", "json", "world-land.json")
    json.dump(out, open(dst, "w"), separators=(",", ":"))
    print(f"{len(paths)} rings -> data/json/world-land.json ({os.path.getsize(dst)//1024} KB)")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ne110.geojson")

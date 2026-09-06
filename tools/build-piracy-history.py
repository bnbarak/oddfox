#!/usr/bin/env python3
"""
Builds data/json/piracy-history.json from the Crime at Sea dataset.

Source: https://github.com/newzealandpaul/Maritime-Pirate-Attacks
        7,511 IMB-reported attacks, 1993-2020, tidied and geocoded.
        DOI 10.5334/johd.39

  curl -sLo /tmp/pirate_attacks.csv \\
    https://raw.githubusercontent.com/newzealandpaul/Maritime-Pirate-Attacks/master/data/csv/pirate_attacks.csv
  python3 tools/build-piracy-history.py /tmp/pirate_attacks.csv

The raw CSV is 1.85 MB and is not committed. This script derives aggregates and
a 2-degree binned grid so the library stays small while the map still shows
where 28 years of attacks actually happened.
"""
import csv, json, os, sys, collections

ISO3_2 = {
 'IDN':'ID','NGA':'NG','YEM':'YE','MYS':'MY','BGD':'BD','IND':'IN','SOM':'SO','PHL':'PH',
 'BRA':'BR','VNM':'VN','SGP':'SG','THA':'TH','CHN':'CN','ECU':'EC','PER':'PE','GHA':'GH',
 'CIV':'CI','BEN':'BJ','CMR':'CM','GIN':'GN','TGO':'TG','AGO':'AO','COD':'CD','COG':'CG',
 'GAB':'GA','LKA':'LK','MMR':'MM','KEN':'KE','TZA':'TZ','MOZ':'MZ','OMN':'OM','ARE':'AE',
 'SAU':'SA','EGY':'EG','ERI':'ER','DJI':'DJ','SDN':'SD','IRQ':'IQ','IRN':'IR','PAK':'PK',
 'VEN':'VE','COL':'CO','MEX':'MX','JAM':'JM','HTI':'HT','DOM':'DO','TTO':'TT','GUY':'GY',
 'SUR':'SR','PNG':'PG','SLB':'SB','AUS':'AU','JPN':'JP','KOR':'KR','TWN':'TW','HKG':'HK',
 'RUS':'RU','TUR':'TR','GRC':'GR','ITA':'IT','ESP':'ES','FRA':'FR','GBR':'GB','NLD':'NL',
 'BEL':'BE','DEU':'DE','USA':'US','CAN':'CA','ZAF':'ZA','SEN':'SN','GMB':'GM','SLE':'SL',
 'LBR':'LR','GNB':'GW','MRT':'MR','MAR':'MA','DZA':'DZ','TUN':'TN','LBY':'LY','ALB':'AL',
 'HRV':'HR','ROU':'RO','UKR':'UA','GEO':'GE','AZE':'AZ','KHM':'KH','BRN':'BN','TLS':'TL',
 'NZL':'NZ','FJI':'FJ','CHL':'CL','ARG':'AR','URY':'UY','PAN':'PA','CRI':'CR','NIC':'NI',
 'HND':'HN','GTM':'GT','SLV':'SV','CUB':'CU','BHS':'BS','QAT':'QA','KWT':'KW','BHR':'BH',
 'MDG':'MG','MUS':'MU','COM':'KM','SYC':'SC','NAM':'NA','GNQ':'GQ','STP':'ST','CPV':'CV',
}

NORM_TYPE = {'Boarding':'Boarded'}   # the source uses both spellings for the same thing

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return None

def main(src):
    rows = [r for r in csv.DictReader(open(src)) if r.get('date')]

    years = collections.Counter(r['date'][:4] for r in rows)
    types = collections.Counter(NORM_TYPE.get(r['attack_type'], r['attack_type'])
                                for r in rows if r['attack_type'] != 'NA')
    countries = collections.Counter(r['nearest_country'] for r in rows if r['nearest_country'] != 'NA')
    vtypes = collections.Counter(r['vessel_type'] for r in rows if r['vessel_type'] != 'NA')
    vstatus = collections.Counter(r['vessel_status'] for r in rows if r['vessel_status'] != 'NA')

    # distance from shore, km
    dists = [num(r['shore_distance']) for r in rows]
    dists = sorted(d for d in dists if d is not None)
    def pct(p):
        if not dists: return None
        return round(dists[min(len(dists)-1, int(len(dists)*p))], 1)
    bands = [('0-1 km',0,1),('1-5 km',1,5),('5-12 km',5,12),('12-50 km',12,50),
             ('50-200 km',50,200),('200-500 km',200,500),('over 500 km',500,1e9)]
    dist_bands = [{'label':lab,'value':sum(1 for d in dists if lo <= d < hi)} for lab,lo,hi in bands]

    # 2-degree grid for the map
    grid = collections.Counter()
    for r in rows:
        lat, lon = num(r['latitude']), num(r['longitude'])
        if lat is None or lon is None: continue
        grid[(round(lat/2)*2, round(lon/2)*2)] += 1
    cells = sorted(({'coords':[la,lo],'count':c} for (la,lo),c in grid.items()),
                   key=lambda x: -x['count'])

    # per-year by the four big regions, using nearest_country groupings
    REGION = {
      'Southeast Asia': {'IDN','MYS','SGP','PHL','THA','VNM','MMR','KHM','BRN','TLS'},
      'West Africa':    {'NGA','GHA','CIV','BEN','CMR','GIN','TGO','AGO','COD','COG','GAB','GNQ','STP','LBR','SLE','SEN'},
      'Horn of Africa & Arabian Sea': {'SOM','YEM','OMN','DJI','ERI','ARE','SAU','IRN','IRQ','PAK'},
      'Indian subcontinent': {'IND','BGD','LKA'},
      'South America & Caribbean': {'BRA','ECU','PER','VEN','COL','MEX','JAM','HTI','DOM','TTO','GUY','SUR','PAN','CRI','NIC','HND','GTM','SLV','CUB','BHS','CHL','ARG','URY'},
    }
    yr_region = collections.defaultdict(collections.Counter)
    for r in rows:
        y = r['date'][:4]
        c = r['nearest_country']
        reg = next((k for k, v in REGION.items() if c in v), 'Other')
        yr_region[reg][y] += 1
    all_years = sorted(years)

    out = {
      "$schema": "../schema/piracy-history.schema.json",
      "dataset": "piracy-history",
      "title": "Reported attacks, 1993-2020",
      "description": ("7,511 IMB-reported pirate attacks, geocoded, from the Crime at Sea dataset. "
        "Aggregates and a 2-degree binned grid derived from the raw CSV, which is not committed. "
        "Series ends in 2020; for 2023 onward use threat-stats.json and attack-log.json."),
      "updated": "2026-09-02",
      "source_ids": ["crime-at-sea"],
      "confidence": "medium",
      "count": len(rows),
      "date_range": [min(r['date'] for r in rows), max(r['date'] for r in rows)],
      "by_year": [{"label": y, "value": years[y]} for y in all_years],
      "by_region_year": [
        {"region": reg, "points": [{"label": y, "value": yr_region[reg].get(y, 0)} for y in all_years]}
        for reg in ['Southeast Asia','Horn of Africa & Arabian Sea','West Africa',
                    'Indian subcontinent','South America & Caribbean']
      ],
      "by_attack_type": [{"label": k, "value": v} for k, v in types.most_common()],
      "by_vessel_type": [{"label": k, "value": v} for k, v in vtypes.most_common(12)],
      "by_vessel_status": [{"label": k, "value": v} for k, v in vstatus.most_common(8)],
      "by_country": [{"label": k, "iso3": k, "flag_iso": ISO3_2.get(k), "value": v}
                     for k, v in countries.most_common(25)],
      "distance_from_shore_km": {
        "note": "Straight-line distance from the incident position to the nearest shore, in kilometres, as computed by the source.",
        "median": pct(0.5), "p75": pct(0.75), "p90": pct(0.9), "p95": pct(0.95), "max": round(dists[-1],1) if dists else None,
        "bands": dist_bands
      },
      "grid": {
        "cell_degrees": 2,
        "note": "Attack positions binned into 2-degree cells. Coordinates are cell centres, not incident positions.",
        "cells": cells
      }
    }
    dst = os.path.join(os.path.dirname(__file__), '..', 'data', 'json', 'piracy-history.json')
    json.dump(out, open(dst, 'w'), separators=(',', ':'))
    print(f"{len(rows)} attacks -> data/json/piracy-history.json "
          f"({os.path.getsize(dst)//1024} KB, {len(cells)} grid cells)")
    print(f"  years {all_years[0]}-{all_years[-1]}, peak {max(years.items(), key=lambda x: x[1])}")
    print(f"  median distance from shore {pct(0.5)} km, p90 {pct(0.9)} km")

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/pirate_attacks.csv')

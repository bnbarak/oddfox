# Equasis lookup worklist

You log in; I can't. Search each IMO, open **Ship Info**, and copy the four fields below.

## The 9 with an IMO — search these directly

| # | Vessel | IMO | Flag | What we still need |
|---|--------|-----|------|--------------------|
| 1 | Lila Norfolk | 9281700 | Liberia | **everything** — no company named in any source |
| 2 | Rubymar | 9138898 | Belize | **everything** — no company named in any source |
| 3 | Magic Seas | 9736169 | Liberia | registered owner, ISM manager, commercial manager |
| 4 | Hellas Aphrodite | 9722766 | Malta | registered owner, beneficial owner, ISM manager |
| 5 | Sounion | 9312145 | Greece | registered owner, beneficial owner, ISM manager |
| 6 | Galaxy Leader | 9237307 | Bahamas | beneficial owner, ISM manager |
| 7 | True Confidence | 9460784 | Barbados | beneficial owner, ISM manager |
| 8 | Abdullah | 9745598 | Bangladesh | beneficial owner, ISM manager |
| 9 | Ruen | 9754903 | Malta | registered owner, ISM manager |

## The 4 with no IMO — resolve the number first

Search by name in **IMO GISIS** (free account) or Equasis ship search:
Tutor · Eternity C · Maersk Yorktown · Honour 25

## Fields to copy, per ship

```
IMO:
Registered owner:
ISM Manager:
Commercial manager / operator:
P&I club:
Classification society:
```

## Paste it back in any format

Screenshot, plain text, whatever is quickest. I'll parse it, write it into
`incidents.json` and `customers.json`, and rebuild the exposed-customer list.

## Why these matter most

The **ISM Manager** is the field to prioritise. Our own ownership model records it
as a buying role, and it's the operational decision maker — the resolution path
in `ownership-model.json` says the technical manager is usually enough to make
contact. Registered owner is usually a single-ship shell and does not buy.

Lila Norfolk and Rubymar are the two where no source anywhere named a company,
so Equasis is the only route.

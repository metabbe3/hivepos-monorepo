#!/usr/bin/env python3
# ponytail: one-off. Remap OrderItem.garmentBreakdown names to the FE template's 15 canonical
# categories (hivepos-web/lib/constants.ts DEFAULT_GARMENT_CATEGORIES). Emits + applies UPDATEs
# for Honey Bee orders. Idempotent (canonical names map to themselves).
#
# Usage:
#   python3 scripts/normalize_garments.py --dry-run   # print before/after distinct names
#   python3 scripts/normalize_garments.py --apply     # write + pipe UPDATEs to docker psql
import argparse, json, subprocess, sys

BRANCH_ID = "1f11058d-b9bd-4498-95bb-d4f52af3673f"
CONTAINER = "hivepos-postgres-1"
ENV = ["psql", "-U", "posadmin", "-d", "pos_saas"]

# lowercase source name -> canonical template label
CANON = {
    "baju": "Baju", "baju anak": "Baju",
    "celana panjang": "Celana Panjang", "celana pjg": "Celana Panjang", "cepana pjg": "Celana Panjang",
    "celana pendek": "Celana Pendek", "celana pndk": "Celana Pendek", "celana pdk": "Celana Pendek",
    "cepana pdk": "Celana Pendek", "cln pndk": "Celana Pendek",
    "rok": "Rok", "rok panjang": "Rok", "rok pendek": "Rok",
    "cd": "CD", "cd / celana dalam": "CD", "celana dalam": "CD",
    "bra": "BRA", "bh": "BRA",
    "kaos kaki": "Kaos Kaki", "pasang kaos kaki": "Kaos Kaki", "psg kaos kaki": "Kaos Kaki",
    "ps kaos kaki": "Kaos Kaki",
    "handuk": "Handuk", "handuk besar": "Handuk", "handuk kecil": "Handuk",
    "kain": "Kain / Sarung", "sarung": "Kain / Sarung",
    "seragam sekolah": "Seragam Sekolah", "seragam": "Seragam Sekolah", "baju sekolah": "Seragam Sekolah",
    "sarung bantal": "Sarung Bantal / Guling", "sarung guling": "Sarung Bantal / Guling",
    "sr bantal": "Sarung Bantal / Guling", "sr guling": "Sarung Bantal / Guling",
    "sarung tangan": "Sarung Tangan", "kantong tangan": "Sarung Tangan",
    "mukena": "Mukenah", "mukenah": "Mukenah", "set mukena": "Mukenah",
    "kerudung": "Kerudung", "hijab": "Kerudung",
}
DEFAULT = "Lain lain"


def psql(query):
    r = subprocess.run(
        ["docker", "exec", CONTAINER] + ENV + ["-t", "-A", "-F", "\t", "-c", query],
        capture_output=True, text=True, check=True,
    )
    return r.stdout


def remap_name(n):
    return CANON.get((n or "").strip().lower(), DEFAULT)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    q = (
        f'SELECT oi.id, oi."garmentBreakdown"::text FROM "OrderItem" oi '
        f'JOIN "Order" o ON o.id=oi."orderId" '
        f"WHERE o.\"branchId\"='{BRANCH_ID}' AND oi.\"garmentBreakdown\" IS NOT NULL;"
    )
    rows = [ln.split("\t", 1) for ln in psql(q).splitlines() if ln.strip()]

    before, after = set(), set()
    updates = []
    for oid, raw in rows:
        try:
            arr = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if not isinstance(arr, list):
            continue
        changed = False
        for g in arr:
            if not isinstance(g, dict):
                continue
            old = g.get("name")
            before.add(old)
            new = remap_name(old)
            after.add(new)
            if new != old:
                g["name"] = new
                changed = True
        if changed:
            new_json = json.dumps(arr, ensure_ascii=False).replace("'", "''")
            updates.append(
                f'UPDATE "OrderItem" SET "garmentBreakdown"=\'{new_json}\'::jsonb WHERE id=\'{oid}\';'
            )

    print(f"items with breakdown: {len(rows)}")
    print(f"updates to apply:     {len(updates)}")
    print(f"before distinct names ({len(before)}): {sorted(before)}")
    print(f"after  distinct names ({len(after)}): {sorted(after)}")

    if args.dry_run:
        return 0
    if not args.apply:
        print("pass --apply to write, or --dry-run", file=sys.stderr)
        return 1

    sql = "BEGIN;\n" + "\n".join(updates) + "\nCOMMIT;\n"
    r = subprocess.run(["docker", "exec", "-i", CONTAINER] + ENV,
                       input=sql, capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    sys.stderr.write(r.stderr)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())

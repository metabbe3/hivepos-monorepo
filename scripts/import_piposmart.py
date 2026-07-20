#!/usr/bin/env python3
# ponytail: one-shot historical ETL. Parses piposmart_penjualan.jsonl into idempotent
# SQL for the Honey Bee branch. Preserves original order totals/dates/status (no recompute).
#
# Service pricing policy (per user): never overwrite existing Service.basePrice. Match a
# source line to an existing service by NAME + PRICE; if no existing service has that
# name at that price, CREATE a new service at the source's modal unit price.
#
# Usage:
#   python3 scripts/import_piposmart.py --dry-run          # counts + writes .sql (ROLLBACK)
#   python3 scripts/import_piposmart.py                    # writes .sql (COMMIT)
#   python3 scripts/import_piposmart.py --apply            # writes + pipes to docker psql
import argparse
import json
import re
import subprocess
import sys
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

BRANCH_ID = "1f11058d-b9bd-4498-95bb-d4f52af3673f"
TENANT_ID = "0384a051-130e-4fe1-962f-ec2a13c78da9"
LAIN_LAIN_ID = "6442cd92-3600-4f15-848e-fc8a6ea49383"
DB_CONTAINER = "hivepos-postgres-1"
DB_ENV = ["psql", "-U", "posadmin", "-d", "pos_saas"]
SOURCE = Path.home() / "Desktop" / "piposmart_penjualan.jsonl"
OUT_SQL = Path(__file__).parent / "import_piposmart.sql"
OUT_SKIP = Path(__file__).parent / "import_skipped.log"

# --------------------------------------------------------------------------- helpers

def sql_str(s):
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"

def sql_num(v):
    if v is None:
        return "NULL"
    if isinstance(v, Decimal):
        return format(v, "f")  # avoid scientific notation (1.000E+4 -> 10000)
    return str(v)

def sql_ts(dt):
    if dt is None:
        return "NULL"
    return "'" + dt.strftime("%Y-%m-%d %H:%M:%S") + "'"

def title_case(s):
    return " ".join(
        w if (w.isupper() and len(w) <= 4) else (w[:1].upper() + w[1:].lower())
        for w in s.split()
    )

def parse_rp(s):
    if not s:
        return Decimal("0")
    digits = re.sub(r"[^\d]", "", str(s))
    return Decimal(digits) if digits else Decimal("0")

def parse_id_date(s):
    if not s or str(s).strip() == "-":
        return None
    s = str(s).strip()
    m = re.match(r"^[A-Za-z]+,\s*(.*)$", s)
    if m:
        s = m.group(1).strip()
    for fmt in ("%d-%m-%Y %H:%M", "%d-%m-%Y %H:%M:%S", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None

# source status (Bahasa) -> OrderStatus enum (orders/domain/types.go)
STATUS_MAP = {
    "selesai": "DELIVERED",
    "siap diambil": "READY",
    "diproses": "IN_PROGRESS",
    "batal": "CANCELED",
}

def map_status(s):
    return STATUS_MAP.get((s or "").strip().lower(), "RECEIVED")

def normalize_phone(raw):
    if not raw:
        return ("", "")
    d = re.sub(r"[^\d]", "", str(raw))
    if d.startswith("62"):
        d = "0" + d[2:]
    elif not d.startswith("0"):
        d = "0" + d
    return (d, d[-9:] if len(d) >= 9 else d)

# --------------------------------------------------------------------------- garment parsing

GARMENT_MAP = [
    ("celana pendek", "Celana Pendek"), ("celana pndk", "Celana Pendek"),
    ("celana pdk", "Celana Pendek"), ("cln pndk", "Celana Pendek"),
    ("celana pjg", "Celana Panjang"), ("celana pnjg", "Celana Panjang"),
    ("celana phg", "Celana Panjang"), ("celana panjang", "Celana Panjang"),
    ("cln pnjg", "Celana Panjang"), ("cln pjg", "Celana Panjang"),
    ("cln pnjg anak", "Celana Panjang Anak"),
    ("celana dalam", "CD / Celana Dalam"), ("kaos dlm", "CD / Celana Dalam"),
    ("kaos dalam", "CD / Celana Dalam"),
    ("sarung bantal", "Sarung Bantal"), ("sr bantal", "Sarung Bantal"), ("sr bntl", "Sarung Bantal"),
    ("sarung guling", "Sarung Guling"), ("sr guling", "Sarung Guling"),
    ("sarung tangan", "Sarung Tangan"), ("sr tangan", "Sarung Tangan"),
    ("pasang kaos kaki", "Kaos Kaki"), ("ps kaos kaki", "Kaos Kaki"),
    ("psg kaos kaki", "Kaos Kaki"), ("kaos kaki tanpa pasangan", "Kaos Kaki"),
    ("kaos kaki", "Kaos Kaki"),
    ("seragam sekolah", "Seragam Sekolah"), ("srgm skolah", "Seragam Sekolah"),
    ("baju sekolah", "Seragam Sekolah"), ("seragam", "Seragam Sekolah"),
    ("baju anak", "Baju Anak"),
    ("handuk kecil", "Handuk Kecil"), ("handuk besar", "Handuk Besar"), ("handuk", "Handuk"),
    ("kain lap", "Lap"), ("lap tangan", "Lap"), ("lap", "Lap"),
    ("taplak meja", "Taplak Meja"), ("gorden mobil", "Gorden Mobil"),
    ("selimut kain kecil", "Selimut Kain Kecil"), ("selimut besar", "Selimut Besar"),
    ("selimut kecil", "Selimut Kecil"), ("selimut", "Selimut"),
    ("bed cover", "Bedcover"), ("bedcover", "Bedcover"), ("sprei", "Sprei"),
    ("dasi pramuka", "Dasi Pramuka"), ("dasi", "Dasi"),
    ("kerudung", "Kerudung"), ("hijab", "Hijab"), ("ciput", "Ciput"),
    ("sajadah", "Sajadah"), ("mukena", "Mukena"), ("set mukena", "Mukena"),
    ("bra", "Bra"), ("bh", "Bra"),
    ("rok panjang", "Rok Panjang"), ("rok pendek", "Rok Pendek"), ("rok", "Rok"),
    ("peci", "Peci"), ("topi", "Topi"), ("jaket", "Jaket"), ("kemeja", "Kemeja"),
    ("masker", "Masker"), ("keset", "Keset"), ("celemek", "Celemek"), ("bando", "Bando"),
    ("korset", "Korset"), ("manset tangan", "Manset Tangan"), ("mangset", "Manset Tangan"),
    ("sapu tangan", "Sapu Tangan"), ("saputangan", "Sapu Tangan"),
    ("sepatu", "Sepatu"), ("tas raket", "Tas Raket"), ("tas tenis", "Tas Tenis"),
    ("tas kain", "Tas Kain"), ("tas", "Tas"), ("kantong tangan", "Kantong Tangan"),
    ("bantal", "Bantal"), ("decker", "Decker"),
    ("kain", "Kain"), ("sarung", "Sarung"),
    ("kaos", "Baju"), ("cd", "CD / Celana Dalam"), ("baju", "Baju"),
]

def clean_token(t):
    t = t.strip().lower()
    t = re.sub(r"\bptg\.?\s*", "", t)
    t = re.sub(r"\([^)]*\)", "", t)
    t = t.replace("tanpa pewangi", "").replace("tanpa pasangab", "tanpa pasangan")
    t = re.sub(r"[.,;]+$", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

# canonical garment name → FE template label (DEFAULT_GARMENT_CATEGORIES, 15 categories).
# Applied to every matched garment so breakdown names stay on-template. Unmapped → Lain lain.
GARMENT_CANON = {
    "baju": "Baju", "baju anak": "Baju",
    "celana panjang": "Celana Panjang", "celana pjg": "Celana Panjang",
    "celana pendek": "Celana Pendek", "celana pndk": "Celana Pendek", "celana pdk": "Celana Pendek",
    "rok": "Rok", "rok panjang": "Rok", "rok pendek": "Rok",
    "cd": "CD", "cd / celana dalam": "CD", "celana dalam": "CD",
    "bra": "BRA", "bh": "BRA",
    "kaos kaki": "Kaos Kaki",
    "handuk": "Handuk", "handuk besar": "Handuk", "handuk kecil": "Handuk",
    "kain": "Kain / Sarung", "sarung": "Kain / Sarung",
    "seragam sekolah": "Seragam Sekolah", "seragam": "Seragam Sekolah",
    "sarung bantal": "Sarung Bantal / Guling", "sarung guling": "Sarung Bantal / Guling",
    "sarung tangan": "Sarung Tangan",
    "mukena": "Mukenah", "set mukena": "Mukenah",
    "kerudung": "Kerudung", "hijab": "Kerudung",
}
GARMENT_DEFAULT = "Lain lain"


def match_garment(token):
    t = clean_token(token)
    if not t:
        return None
    raw = None
    for key, canonical in GARMENT_MAP:
        if t == key or t.startswith(key + " ") or key in t:
            raw = canonical
            break
    if raw is None and re.fullmatch(r"[\w\s/\-]+", t):
        raw = title_case(t)
    if raw is None:
        return None
    return GARMENT_CANON.get(raw.strip().lower(), GARMENT_DEFAULT)

def parse_note(note, skipped, txn_id):
    if not note or str(note).strip() in ("", "-"):
        return []
    parts = re.split(r"[,，]", note)
    breakdown = {}
    for raw in parts:
        p = raw.strip()
        if not p:
            continue
        qty = 1
        m = re.match(r"^(\d+)\s*(.+)$", p)
        if m:
            qty = int(m.group(1)); p = m.group(2).strip()
        else:
            m = re.search(r"(\d+)\s*(psg|pc|pcs|pasang|set|st|ptg)?\s*$", p)
            if m:
                qty = int(m.group(1)); p = (p[:m.start()] + " " + (m.group(2) or "")).strip()
        name = match_garment(p)
        if not name:
            skipped.append(f"{txn_id}\tnote-unmatched\t{raw.strip()}")
            continue
        breakdown[name] = breakdown.get(name, 0) + qty
    return [{"name": n, "qty": q} for n, q in breakdown.items()]

# --------------------------------------------------------------------------- service derivation

VARIANT_WORDS = {"promo", "reguler", "express", "7", "24", "jam", "single", "double",
                 "1", "set", "besar", "kecil", "king", "sedang", "tipis", "tebal"}

def derive_service(category, name):
    """Return (canonical_service_name, pricing_type, is_kilo) from a source line."""
    cat = (category or "").lower().strip()
    nm = (name or "").lower().strip()
    express = "express" in cat or "express" in nm
    j7 = "7 jam" in nm or "7jam" in nm or nm.endswith(" 7 jam")
    j24 = "24 jam" in nm or "24jam" in nm

    if "cuci" in cat and "setrika" in cat:
        base = "Cuci Dan Setrika"
        if express and j7:
            base += " Express 7 Jam"
        elif express or j24:
            base += " Express 24 Jam"
        return (base, "PER_KG", True)
    if "lipat" in cat:
        base = "Cuci Dan Lipat"
        if express and j7:
            base += " Express 7 Jam"
        elif express or j24:
            base += " Express 24 Jam"
        return (base, "PER_KG", True)
    if cat == "setrika" or (cat.startswith("setrika")):
        base = "Setrika"
        if express and j7:
            base += " Express 7 Jam"
        elif express or j24:
            base += " Express 24 Jam"
        return (base, "PER_KG", True)

    # per-item / household
    def meaningful(s):
        return " ".join(w for w in s.split() if w and w not in VARIANT_WORDS)
    # "Satuan" / "Express Satuan" are pricing modes, not products — product is in the name
    if cat.startswith("satuan") or "satuan" in cat:
        cand = nm.strip() or cat
    else:
        cat_m = meaningful(cat)
        nm_m = meaningful(nm)
        if nm_m and nm_m != cat_m:
            cand = f"{cat_m} {nm_m}".strip()
        else:
            cand = cat_m or nm_m or cat or nm
    cand = re.sub(r"\s+", " ", cand).strip(" -")
    return (title_case(cand) if cand else "Lain-Lain", "PER_ITEM", False)

def parse_item_qty(qty):
    if not qty:
        return (Decimal(1), None)
    q = qty.lower()
    mk = re.search(r"\(([\d.]+)\s*kg\)", q)
    if mk:
        return (Decimal(1), Decimal(mk.group(1)))
    md = re.match(r"^\s*(\d+(?:\.\d+)?)", q)
    if md:
        return (Decimal(md.group(1)), None)
    return (Decimal(1), None)

# --------------------------------------------------------------------------- DB loaders

def docker_psql(query):
    r = subprocess.run(
        ["docker", "exec", DB_CONTAINER] + DB_ENV + ["-t", "-A", "-F", "\t", "-c", query],
        capture_output=True, text=True, check=True,
    )
    return r.stdout

def load_services():
    """name(lower) -> list of (id, basePrice_int); plus norm lookup."""
    out = docker_psql(
        f'SELECT name, id, "basePrice" FROM "Service" WHERE "branchId" = \'{BRANCH_ID}\';'
    )
    by_norm = defaultdict(list)
    all_services = []
    for line in out.splitlines():
        if not line.strip():
            continue
        name, sid, price = line.split("\t", 2)
        try:
            p = int(Decimal(price))
        except InvalidOperation:
            p = 0
        by_norm[name.lower()].append((sid, p))
        all_services.append((name.lower(), sid, p))
    return by_norm, all_services

def load_customers():
    out = docker_psql(
        f'SELECT id, name, COALESCE(phone,\'\') FROM "Customer" WHERE "branchId" = \'{BRANCH_ID}\';'
    )
    by_phone, by_name = {}, {}
    for line in out.splitlines():
        if not line.strip():
            continue
        cid, name, phone = line.split("\t", 2)
        if phone:
            _, suf = normalize_phone(phone)
            if suf:
                by_phone.setdefault(suf, cid)
        by_name.setdefault(name.strip().lower(), cid)
    return by_phone, by_name

# --------------------------------------------------------------------------- resolution

def name_similarity_match(derived_norm, all_services):
    """Return list of (id, price) whose name equals or contains (or is contained by) derived."""
    hits = []
    d = derived_norm
    for sname, sid, p in all_services:
        if d == sname or d in sname or sname in d:
            hits.append((sid, p))
    return hits

def uuid5(name):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "piposmart:" + name))

class ServiceCatalog:
    def __init__(self, by_norm, all_services):
        self.by_norm = by_norm
        self.all = all_services
        self.created = {}        # (name, price) -> id
        self.create_sql = []
        self.update_sql = []     # PER_KG basePrice updates (current/latest-month modal)
        self.updated = set()     # service ids already updated this run (dedupe)
        self.price_changes = []  # (name, old, new)
        self.used_names = {n.lower() for n, _, _ in all_services}  # block name collisions
        self.lain_count = 0
        self.match_count = 0
        self.create_count = 0

    def _unique_name(self, base, price):
        if base.lower() not in self.used_names:
            name = base
        else:
            name = f"{base} - Rp{price}"
            i = 2
            while name.lower() in self.used_names:
                name = f"{base} - Rp{price} ({i})"
                i += 1
        self.used_names.add(name.lower())
        return name

    def resolve(self, derived_name, price, ptype):
        if derived_name == "Lain-Lain":
            self.lain_count += 1
            return LAIN_LAIN_ID
        price = int(round(float(price)))
        is_kg = ptype == "PER_KG"

        if is_kg:
            # PER_KG: one service per name. EXACT-name match only and UPDATE basePrice to current
            # (latest-month modal). Never fuzzy-match (would clobber a sibling kilo service, e.g.
            # derived "Setrika" grabbing "Setrika Saja"); never spawn a "- RpX" variant.
            hits = self.by_norm.get(derived_name.lower())
            if hits:
                sid, p = hits[0]
                if p != price and sid not in self.updated:
                    self.update_sql.append(
                        f'UPDATE "Service" SET "basePrice"={price}, "updatedAt"=NOW() '
                        f"WHERE id={sql_str(sid)};"
                    )
                    self.updated.add(sid)
                    self.price_changes.append((derived_name, p, price))
                self.match_count += 1
                return sid
            # no existing kilo service with this name → create at current price
            return self._create(derived_name, price, "PER_KG")

        # PER_ITEM: match name + price, else create variant (unchanged policy)
        for sid, p in self.by_norm.get(derived_name.lower(), []):
            if p == price:
                self.match_count += 1
                return sid
        for sid, p in name_similarity_match(derived_name.lower(), self.all):
            if p == price:
                self.match_count += 1
                return sid
        return self._create(derived_name, price, "PER_ITEM")

    def _create(self, derived_name, price, ptype):
        key = (derived_name, price)
        if key in self.created:
            return self.created[key]
        name = self._unique_name(derived_name, price)
        sid = uuid5(f"svc:{BRANCH_ID}:{name}:{price}")
        self.created[key] = sid
        self.create_sql.append(
            f'INSERT INTO "Service" (id, name, "pricingType", "basePrice", "commissionType", '
            f'"commissionValue", module, "isActive", "isDefaultSpeed", "branchId", "createdAt", "updatedAt") '
            f"VALUES ({sql_str(sid)}, {sql_str(name)}, '{ptype}', {price}, "
            f"'NONE', 0, 'LAUNDRY', true, false, {sql_str(BRANCH_ID)}, NOW(), NOW()) "
            f'ON CONFLICT ("branchId", name) DO NOTHING;'
        )
        self.create_count += 1
        return sid

# --------------------------------------------------------------------------- main ETL

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    if not SOURCE.exists():
        print(f"source not found: {SOURCE}", file=sys.stderr)
        return 1

    by_norm, all_services = load_services()
    by_phone, by_name = load_customers()
    catalog = ServiceCatalog(by_norm, all_services)

    # ---- pass 1: per-service unit prices by month; canonical price = LATEST month's modal
    # (current catalog price — NOT full-dataset modal, which lags a price hike: e.g. Express 7 Jam
    # has more old-price volume, so full modal = 10000 but current = 10500).
    rows = []
    unit_by_month = defaultdict(lambda: defaultdict(Counter))  # dname -> month -> Counter(price)
    derived_of = {}                       # (cat,name) -> derived_name
    ptype_of = {}
    with SOURCE.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            rows.append(r)
            recv = parse_id_date(r.get("date_received"))
            mon = recv.strftime("%Y-%m") if recv else "?"
            for it in r.get("items") or []:
                cat = it.get("category") or ""
                nm = it.get("name") or ""
                dname, ptype, is_kilo = derive_service(cat, nm)
                if dname == "Lain-Lain":
                    continue
                sub = parse_rp(it.get("price"))
                qty, wkg = parse_item_qty(it.get("qty"))
                denom = (wkg if is_kilo and wkg else qty) or Decimal(1)
                if denom > 0 and sub > 0:
                    up = int(round(float(sub / denom)))
                    unit_by_month[dname][mon][up] += 1
                derived_of[(cat, nm)] = dname
                ptype_of[dname] = ptype

    # current price = modal of the most recent month seen for each service
    current_price = {}
    for d, months in unit_by_month.items():
        real = [m for m in months if m != "?"]
        latest = max(real) if real else "?"
        current_price[d] = months[latest].most_common(1)[0][0]

    # ---- pass 2: build rows
    stats = dict(new_cust=0, match_cust=0, orders=0, items=0, payments=0,
                 garments=0, notes_used=0, svc_match=0, svc_create=0, lain=0)
    skipped = []
    new_customer_rows = {}
    cust_sql, order_sql, item_sql, pay_sql = [], [], [], []

    seq = 0
    for r in rows:
        seq += 1
        txn_id = r.get("transaction_id", f"NOID-{seq}")

        # customer
        cname = title_case((r.get("customer_name") or "").strip())
        phone_disp, phone_suf = normalize_phone(r.get("customer_phone"))
        gender = ""
        gm = re.search(r"\((Wanita|Pria)\)", r.get("list_customer") or "")
        if gm:
            gender = gm.group(1)
        cust_id = None
        if phone_suf and phone_suf in by_phone:
            cust_id = by_phone[phone_suf]; stats["match_cust"] += 1
        elif cname and cname.lower() in by_name:
            cust_id = by_name[cname.lower()]; stats["match_cust"] += 1
        if cust_id is None:
            key = phone_disp or cname.lower() or txn_id
            client_id = "piposmart:" + key
            if client_id in new_customer_rows:
                cust_id = new_customer_rows[client_id]
            else:
                cust_id = uuid5(BRANCH_ID + ":cust:" + key)
                new_customer_rows[client_id] = cust_id
                cust_sql.append(
                    f'INSERT INTO "Customer" (id, name, phone, "branchId", "clientId", notes, balance, "createdAt", "updatedAt") '
                    f"VALUES ({sql_str(cust_id)}, {sql_str(cname or 'Pelanggan')}, {sql_str(phone_disp or None)}, "
                    f"{sql_str(BRANCH_ID)}, {sql_str(client_id)}, {sql_str(gender or None)}, 0, NOW(), NOW()) "
                    f'ON CONFLICT DO NOTHING;'
                )
                stats["new_cust"] += 1

        # order
        total = parse_rp(r.get("total"))
        paid = parse_rp(r.get("amount_paid"))
        lunas = (r.get("payment_status") or "").strip().lower() == "lunas"
        pay_status = "PAID" if lunas else "PENDING"
        received = parse_id_date(r.get("date_received"))
        delivered = parse_id_date(r.get("payment_date")) or parse_id_date(r.get("est_pickup"))
        status = map_status(r.get("status"))
        # deliveredAt only when actually delivered; other statuses have not been picked up
        delivered_for_row = delivered if status == "DELIVERED" else None
        order_id = uuid5("order:" + txn_id)
        # transient placeholder — renumber_orders.sql rewrites ALL orderNumbers to
        # {CODE}-YYYYMMDD-NNNN (HBLF). Unique 1..N over the file; no INV-P left in DB post-renumber.
        order_no = f"INV-P{seq:05d}"
        note_parts = [f"src:{txn_id}"]
        if gender:
            note_parts.append(gender)
        if r.get("perfume") and r["perfume"] != "-":
            note_parts.append(f"parfum:{r['perfume']}")
        if r.get("rack") and r["rack"] != "-":
            note_parts.append(f"rak:{r['rack']}")
        notes = "; ".join(note_parts)
        order_sql.append(
            f'INSERT INTO "Order" (id, "orderNumber", "customerId", status, "totalAmount", '
            f'"discountAmount", "paidAmount", "paymentStatus", notes, module, "branchId", "clientId", '
            f'"createdAt", "updatedAt", "receivedAt", "deliveredAt") '
            f"VALUES ({sql_str(order_id)}, {sql_str(order_no)}, {sql_str(cust_id)}, '{status}', "
            f"{sql_num(total)}, 0, {sql_num(paid if lunas else 0)}, '{pay_status}', {sql_str(notes)}, 'LAUNDRY', "
            f"{sql_str(BRANCH_ID)}, {sql_str(txn_id)}, {sql_ts(received) if received else 'NOW()'}, "
            f"{sql_ts(received) if received else 'NOW()'}, {sql_ts(received)}, {sql_ts(delivered_for_row)}) "
            f'ON CONFLICT ("clientId") DO UPDATE SET status=EXCLUDED.status, '
            f'"deliveredAt"=EXCLUDED."deliveredAt", "paymentStatus"=EXCLUDED."paymentStatus", '
            f'"updatedAt"=NOW();'
        )
        stats["orders"] += 1

        # items + breakdown
        breakdown = parse_note(r.get("note"), skipped, txn_id)
        if breakdown:
            stats["notes_used"] += 1
            stats["garments"] += sum(g["qty"] for g in breakdown)
        # drop incomplete source lines (no price AND no kg weight — category/size only).
        # They produced zero-subtotal junk OrderItems and stray services on prior imports.
        raw_items = r.get("items") or []
        items = [it for it in raw_items
                 if parse_rp(it.get("price")) or "kg" in (it.get("qty") or "").lower()]
        kilo_idx = next(
            (i for i, it in enumerate(items)
             if "cuci" in (it.get("category") or "").lower()
             or (it.get("category") or "").lower().startswith("setrika")),
            0,
        )
        for i, it in enumerate(items):
            cat = it.get("category") or ""
            nm = it.get("name") or ""
            dname, _, is_kilo = derive_service(cat, nm)
            qty, wkg = parse_item_qty(it.get("qty"))
            subtotal = parse_rp(it.get("price"))
            denom = (wkg if is_kilo and wkg else qty) or Decimal(1)
            ppu = (subtotal / denom) if denom else subtotal
            if dname == "Lain-Lain":
                sid = LAIN_LAIN_ID; stats["lain"] += 1
            else:
                sid = catalog.resolve(dname, current_price.get(dname, ppu), ptype_of.get(dname, "PER_ITEM"))
            gb = json.dumps(breakdown, ensure_ascii=False) if (i == kilo_idx and breakdown) else None
            item_id = uuid5(f"item:{txn_id}:{i}")
            item_sql.append(
                f'INSERT INTO "OrderItem" (id, "orderId", "serviceId", quantity, "weightKg", '
                f'"pricePerUnit", subtotal, "garmentBreakdown", "createdAt") '
                f"VALUES ({sql_str(item_id)}, {sql_str(order_id)}, {sql_str(sid)}, {sql_num(qty)}, "
                f"{sql_num(wkg)}, {sql_num(ppu)}, {sql_num(subtotal)}, "
                f"{sql_str(gb) if gb else 'NULL'}::jsonb, {sql_ts(received) if received else 'NOW()'}) ON CONFLICT DO NOTHING;"
            )
            stats["items"] += 1

        # payment
        if lunas and paid > 0:
            pm = (r.get("payment_method") or "").strip().upper()
            pm = "QRIS" if "QRIS" in pm else ("TRANSFER" if ("TRANSFER" in pm or "BANK" in pm) else "CASH")
            pay_id = uuid5("pay:" + txn_id)
            pay_sql.append(
                f'INSERT INTO "Payment" (id, "orderId", amount, "paymentMethod", "paidAt", "createdAt") '
                f"VALUES ({sql_str(pay_id)}, {sql_str(order_id)}, {sql_num(paid)}, '{pm}', "
                f"{sql_ts(delivered) or 'NOW()'}, {sql_ts(delivered) or 'NOW()'}) ON CONFLICT DO NOTHING;"
            )
            stats["payments"] += 1

    stats["svc_match"] = catalog.match_count
    stats["svc_create"] = catalog.create_count

    # ---- assemble
    pieces = ["BEGIN;"]
    pieces.append(f"-- new services: {catalog.create_count}")
    pieces.extend(catalog.create_sql)
    pieces.append(f"-- kilo service price updates: {len(catalog.update_sql)}")
    pieces.extend(catalog.update_sql)
    pieces.append(f"-- customers: {stats['new_cust']} new / {stats['match_cust']} matched")
    pieces.extend(cust_sql)
    pieces.append(f"-- orders: {stats['orders']}")
    pieces.extend(order_sql)
    pieces.append(f"-- items: {stats['items']} (lain-lain: {stats['lain']})")
    pieces.extend(item_sql)
    pieces.append(f"-- payments: {stats['payments']}")
    pieces.extend(pay_sql)
    pieces.append("ROLLBACK;" if args.dry_run else "COMMIT;")
    sql_text = "\n".join(pieces) + "\n"
    OUT_SQL.write_text(sql_text)
    OUT_SKIP.write_text("\n".join(skipped) + ("\n" if skipped else ""))

    print("=== piposmart import plan ===")
    for k, v in stats.items():
        print(f"  {k:12s} {v}")
    print(f"  skipped-tokens {len(skipped)} -> {OUT_SKIP}")
    print(f"  new services to create:")
    for (nm, price), sid in catalog.created.items():
        print(f"    {price:>7d}  {nm}")
    print(f"  kilo price changes ({len(catalog.price_changes)}):")
    for nm, old, new in catalog.price_changes:
        print(f"    {nm}: Rp{old} -> Rp{new} ({'+' if new >= old else ''}{new - old})")
    print(f"  sql -> {OUT_SQL} ({'ROLLBACK dry-run' if args.dry_run else 'COMMIT'})")

    if args.apply and not args.dry_run:
        print("applying via docker psql ...")
        r = subprocess.run(["docker", "exec", "-i", DB_CONTAINER] + DB_ENV,
                           input=sql_text, capture_output=True, text=True)
        sys.stdout.write(r.stdout); sys.stderr.write(r.stderr)
        if r.returncode != 0:
            print(f"psql failed rc={r.returncode}", file=sys.stderr)
            return r.returncode
        print("applied.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

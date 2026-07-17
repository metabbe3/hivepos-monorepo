#!/usr/bin/env python3
"""
hivePOS Error Log Triage Script
================================
Runs hourly via Hermes cron (no_agent=True). Queries the ErrorLog table for
unresolved 5xx errors, classifies them, auto-resolves known patterns and false
alarms, and outputs a report ONLY when there are new unknown errors needing
human/agent attention.

Design principles:
  - Silent when all clear (empty stdout = no message sent)
  - Auto-resolve known patterns (already fixed in code)
  - Auto-resolve false alarms via Ollama classification
  - Only output when there are genuinely NEW unknown errors

Usage:
  python3 scripts/error-triage.py

Env:
  OLLAMA_URL   - Ollama API base (default: http://192.168.2.1:11434)
  OLLAMA_MODEL - Model name (default: qwen2.5:7b)
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ── Config ──────────────────────────────────────────────────────────────────
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://192.168.2.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")

ENV_FILE = os.path.join(os.path.dirname(__file__), "..", ".env")

# ── Known Error Patterns (already fixed in code) ───────────────────────────
# These patterns were fixed in lib/permissions/check.ts + service layers.
# Matching errors are auto-resolved without calling Ollama.
KNOWN_PATTERNS = [
    {
        "name": "branchId in: [null] — ALL-outlets empty branchIds crash",
        "match": r"branchId.*in:.*\[.*null",
        "fix": "Fixed in lib/permissions/check.ts — sentinel guard for empty branchIds in requireWithBranchOrThrow",
    },
    {
        "name": "tenantId must not be null — session missing tenant context",
        "match": r"tenantId.*must not be null",
        "fix": "Fixed in lib/permissions/check.ts — tenantId guard in requireWithBranch + defense in branch-services.ts",
    },
    {
        "name": "tenant.findUnique id must not be null",
        "match": r"Argument `id` must not be null",
        "fix": "Fixed in app/api/tenant/website/route.ts — early return guard",
    },
    {
        "name": "debug smoke test — false alarm",
        "match": r"debug smoke test|debug.*test.*ErrorLog",
        "fix": "False alarm — debug/monitoring probe entry",
    },
]

# ── DB Layer ───────────────────────────────────────────────────────────────
def query_unresolved():
    """Return unresolved errors grouped by normalized signature."""
    import subprocess

    sql = """
    SELECT json_agg(t) FROM (
      SELECT
        MIN(id) as sample_id,
        COUNT(*) as occurrence_count,
        MIN(method || ' ' || LEFT(url, 80)) as endpoint,
        code,
        "httpStatus",
        MIN(LEFT(message, 2000)) as sample_message,
        MIN("createdAt")::text as first_seen,
        MAX("createdAt")::text as last_seen,
        array_agg(id ORDER BY "createdAt" DESC) as error_ids
      FROM "ErrorLog"
      WHERE resolved = false
      GROUP BY code, "httpStatus", LEFT(message, 200)
      ORDER BY COUNT(*) DESC
      LIMIT 20
    ) t;
    """

    result = subprocess.run(
        ["docker", "exec", "pos-saas-db-1", "psql", "-U", "posadmin", "-d", "pos_saas",
         "-t", "-A", "-c", sql],
        capture_output=True, text=True, timeout=15
    )

    if result.returncode != 0:
        print(f"[ERROR] DB query failed: {result.stderr}", file=sys.stderr)
        return []

    raw = result.stdout.strip()
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(f"[ERROR] JSON parse failed: {raw[:200]}", file=sys.stderr)
        return []

    if not data:
        return []

    groups = []
    for row in data:
        groups.append({
            "sample_id": row.get("sample_id", ""),
            "count": int(row.get("occurrence_count", 0)),
            "endpoint": row.get("endpoint", ""),
            "code": row.get("code", ""),
            "http_status": int(row.get("httpStatus", 500)),
            "message": row.get("sample_message", ""),
            "first_seen": row.get("first_seen", ""),
            "last_seen": row.get("last_seen", ""),
            "error_ids": row.get("error_ids", []),
        })
    return groups

def resolve_errors(error_ids, reason):
    """Mark error IDs as resolved in DB. Returns count resolved."""
    if not error_ids:
        return 0
    import subprocess
    # Process in batches of 50
    resolved = 0
    for i in range(0, len(error_ids), 50):
        batch = error_ids[i:i+50]
        id_list = ",".join(f"'{eid}'" for eid in batch)
        sql = f'UPDATE "ErrorLog" SET resolved = true WHERE id IN ({id_list});'
        result = subprocess.run(
            ["docker", "exec", "pos-saas-db-1", "psql", "-U", "posadmin", "-d", "pos_saas", "-c", sql],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            resolved += len(batch)
    return resolved

# ── Pattern Matching ───────────────────────────────────────────────────────
def match_known_pattern(message):
    """Check if error matches a known (already fixed) pattern. Returns dict or None."""
    for pattern in KNOWN_PATTERNS:
        if re.search(pattern["match"], message, re.IGNORECASE | re.DOTALL):
            return pattern
    return None

# ── Ollama Classification (for unknown errors) ─────────────────────────────
def classify_error(error_group):
    """Classify an unknown error group via Ollama. Returns dict with verdict."""
    prompt = f"""You are a bug triage assistant for hivePOS (Next.js + Prisma + PostgreSQL POS SaaS).

Analyze this production error and classify it.

ERROR DETAILS:
- Code: {error_group['code']}
- HTTP Status: {error_group['http_status']}
- Endpoint: {error_group['endpoint']}
- Occurrences: {error_group['count']}
- Message:
{error_group['message'][:1000]}

CLASSIFICATION RULES:
1. "false_alarm" - Test entries, debug probes, synthetic monitoring that are not real errors.
2. "transient" - Temporary infra issue (DB timeout, connection reset) unlikely to recur.
3. "real_bug" - A genuine application error requiring code investigation.

Respond with ONLY a JSON object:
{{"verdict": "false_alarm|transient|real_bug", "confidence": 0.0-1.0, "root_cause": "one line", "fix_hint": "specific file/function or N/A"}}
"""

    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 300}
    }).encode()

    try:
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
            raw = data.get("response", "").strip()

            json_match = re.search(r'\{.*?\}', raw, re.DOTALL)
            if not json_match:
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            return {"verdict": "real_bug", "confidence": 0.3, "root_cause": "Classification parse failed", "fix_hint": "Manual review needed"}
    except Exception as e:
        return {"verdict": "real_bug", "confidence": 0.0, "root_cause": f"Ollama error: {e}", "fix_hint": "Manual review needed"}

# ── Main ───────────────────────────────────────────────────────────────────
def main():
    print(f"[{datetime.now(timezone.utc).isoformat()}] Starting error triage...", file=sys.stderr)

    groups = query_unresolved()
    if not groups:
        # Silent — no output to stdout means no message delivered
        print("NO_UNRESOLVED_ERRORS", file=sys.stderr)
        return

    print(f"[triage] Found {len(groups)} unique error signatures", file=sys.stderr)

    known_resolved = 0
    false_alarm_resolved = 0
    transient_resolved = 0
    unknown_errors = []

    for group in groups:
        msg = group["message"]

        # Step 1: Check against known patterns (already fixed in code)
        known = match_known_pattern(msg)
        if known:
            count = resolve_errors(group["error_ids"], f"Auto-resolved: {known['name']} — {known['fix']}")
            known_resolved += count
            print(f"  [KNOWN] ×{count} — {known['name']}", file=sys.stderr)
            continue

        # Step 2: Classify unknown errors via Ollama
        classification = classify_error(group)
        verdict = classification.get("verdict", "real_bug")
        confidence = classification.get("confidence", 0)

        print(f"  [{verdict}] ({confidence:.0%}) ×{group['count']} — {classification.get('root_cause', '?')[:80]}", file=sys.stderr)

        if verdict == "false_alarm" and confidence >= 0.8:
            count = resolve_errors(group["error_ids"], f"Auto-resolved: false alarm — {classification.get('root_cause', '')}")
            false_alarm_resolved += count
        elif verdict == "transient" and confidence >= 0.8:
            count = resolve_errors(group["error_ids"], f"Auto-resolved: transient — {classification.get('root_cause', '')}")
            transient_resolved += count
        else:
            # Genuinely unknown — needs agent/human attention
            unknown_errors.append({
                "sample_id": group["sample_id"],
                "code": group["code"],
                "http_status": group["http_status"],
                "endpoint": group["endpoint"],
                "occurrence_count": group["count"],
                "error_ids": group["error_ids"],
                "message": group["message"][:1000],
                "classification": classification,
                "first_seen": group["first_seen"],
                "last_seen": group["last_seen"],
            })

    # Build report
    total_resolved = known_resolved + false_alarm_resolved + transient_resolved
    total_remaining = len(unknown_errors)

    if total_remaining == 0:
        # All handled — output a brief summary (only if we resolved something)
        if total_resolved > 0:
            print(f"✅ hivePOS Error Triage — {total_resolved} errors auto-resolved (known patterns: {known_resolved}, false alarms: {false_alarm_resolved}, transient: {transient_resolved}). No new unknown errors.")
        # If nothing resolved AND no unknowns, stay silent (empty stdout)
        return

    # Unknown errors exist — output detailed report + trigger GLM fix job
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "auto_resolved": {
            "known_patterns": known_resolved,
            "false_alarms": false_alarm_resolved,
            "transient": transient_resolved,
            "total": total_resolved,
        },
        "unknown_errors": unknown_errors,
        "action_needed": f"{total_remaining} unique error pattern(s) need investigation.",
    }
    print(json.dumps(report, indent=2))

    # Trigger the GLM auto-fix job (paused, run on-demand)
    import subprocess
    subprocess.run(
        ["hermes", "cron", "run", "51027998fea0"],
        capture_output=True, text=True, timeout=10
    )
    print("\n⚡ Triggered GLM auto-fix job to investigate.", file=sys.stderr)

if __name__ == "__main__":
    main()

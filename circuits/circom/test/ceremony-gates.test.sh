#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT_DIR="$ROOT/circuits/circom/scripts"
FIXTURES="$ROOT/circuits/circom/test/fixtures/ceremony"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass() { echo "  OK: $1"; }
fail() { echo "  FAIL: $1"; exit 1; }

build_valid_package() {
  local dir="$1"
  local published="${2:-false}"
  local synced="${3:-false}"
  local pub_py="False"
  local sync_py="False"
  [[ "$published" == "true" ]] && pub_py="True"
  [[ "$synced" == "true" ]] && sync_py="True"
  python3 - <<PY
import json, hashlib, shutil
from pathlib import Path

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())

def write(path: Path, content: bytes):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)

ceremony = Path("$dir")
artifacts = ceremony.parent / "artifacts"
ceremony.mkdir(parents=True, exist_ok=True)
artifacts.mkdir(parents=True, exist_ok=True)

r1cs = artifacts / "compliance_corridor.r1cs"
ptau = artifacts / "pot17_final.ptau"
if not r1cs.is_file():
    write(r1cs, b"test-r1cs")
if not ptau.is_file():
    write(ptau, b"test-ptau")

zkeys = {}
for name in [
    "compliance_corridor_0000.zkey",
    "compliance_corridor_0001.zkey",
    "compliance_corridor_0002.zkey",
    "compliance_corridor_0003.zkey",
    "compliance_corridor_final.zkey",
]:
    p = ceremony / name
    write(p, f"{name}-bytes".encode())
    zkeys[name] = sha256_file(p)

vk_src = Path("$ROOT/circuits/circom/artifacts/verification_key.json")
vk = ceremony / "verification_key.json"
if vk_src.is_file():
    shutil.copy2(vk_src, vk)
else:
    write(vk, b"{}")

rows = [
    {
        "step": 0,
        "kind": "init",
        "r1cs": r1cs.name,
        "r1cs_sha256": sha256_file(r1cs),
        "ptau": ptau.name,
        "ptau_sha256": sha256_file(ptau),
        "zkey": "compliance_corridor_0000.zkey",
        "zkey_sha256": zkeys["compliance_corridor_0000.zkey"],
        "created_at": "2026-01-01T00:00:00Z",
    }
]
chain = [
    ("alice", "compliance_corridor_0000.zkey", "compliance_corridor_0001.zkey"),
    ("bob", "compliance_corridor_0001.zkey", "compliance_corridor_0002.zkey"),
    ("carol", "compliance_corridor_0002.zkey", "compliance_corridor_0003.zkey"),
]
for step, (contributor, inp, out) in enumerate(chain, start=1):
    rows.append(
        {
            "step": step,
            "kind": "contribution",
            "contributor": contributor,
            "input": inp,
            "input_sha256": zkeys[inp],
            "output": out,
            "output_sha256": zkeys[out],
            "created_at": "2026-01-01T00:00:01Z",
        }
    )
finalize = {
    "step": 4,
    "kind": "finalize",
    "input": "compliance_corridor_0003.zkey",
    "input_sha256": zkeys["compliance_corridor_0003.zkey"],
    "beacon_hex": "deadbeef",
    "beacon_rounds": 10,
    "final_zkey": "compliance_corridor_final.zkey",
    "final_zkey_sha256": zkeys["compliance_corridor_final.zkey"],
    "verification_key": "verification_key.json",
    "verification_key_sha256": sha256_file(vk),
    "created_at": "2026-01-01T00:00:02Z",
}
rows.append(finalize)

transcript = ceremony / "transcript.jsonl"
transcript.write_text("\n".join(json.dumps(r) for r in rows) + "\n")

contributors = [r["contributor"] for r in rows if r["kind"] == "contribution"]
manifest = {
    "ceremony_version": "wisp-groth16-phase2-v1",
    "circuit": "compliance_corridor",
    "r1cs_file": r1cs.name,
    "r1cs_sha256": sha256_file(r1cs),
    "ptau_file": ptau.name,
    "ptau_sha256": sha256_file(ptau),
    "transcript_file": transcript.name,
    "transcript_sha256": sha256_file(transcript),
    "final_zkey_file": finalize["final_zkey"],
    "final_zkey_sha256": finalize["final_zkey_sha256"],
    "verification_key_file": finalize["verification_key"],
    "verification_key_sha256": finalize["verification_key_sha256"],
    "vk_hash_file": "vk_hash.txt",
    "vk_hash": "",
    "beacon_hex": finalize["beacon_hex"],
    "beacon_rounds": finalize["beacon_rounds"],
    "contributor_count": len(contributors),
    "contributors": contributors,
    "finalized_at": finalize["created_at"],
    "published": $pub_py,
    "verifier_contract_synced": $sync_py,
    "verifier_wasm_sha256": "",
    "coordinator_note": "test fixture",
}
if $sync_py:
    import subprocess
    vk_hash = subprocess.check_output(
        ["python3", "$SCRIPT_DIR/compute-vk-hash.py"], text=True
    ).strip()
    manifest["vk_hash"] = vk_hash
    manifest["verifier_wasm_sha256"] = sha256_bytes(b"test-wasm")
    (ceremony / "vk_hash.txt").write_text(vk_hash + "\n")

(ceremony / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
PY
}

echo "=== Ceremony gate tests ==="

echo "valid unpublished package (structural)"
build_valid_package "$TMP/valid" false false
python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/valid" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify
pass "valid unpublished package"

echo "valid synced package (structural)"
build_valid_package "$TMP/synced" false true
python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/synced" \
  --artifacts-dir "$TMP/artifacts" \
  --require-sync \
  --skip-zkey-verify
pass "valid synced package"

echo "missing manifest"
build_valid_package "$TMP/no-manifest" false false
rm "$TMP/no-manifest/manifest.json"
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/no-manifest" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "missing manifest should fail"
else
  pass "missing manifest rejected"
fi

echo "missing transcript"
build_valid_package "$TMP/no-transcript" false false
rm "$TMP/no-transcript/transcript.jsonl"
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/no-transcript" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "missing transcript should fail"
else
  pass "missing transcript rejected"
fi

echo "missing zkey"
build_valid_package "$TMP/no-zkey" false false
rm "$TMP/no-zkey/compliance_corridor_final.zkey"
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/no-zkey" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "missing zkey should fail"
else
  pass "missing zkey rejected"
fi

echo "missing verification key"
build_valid_package "$TMP/no-vk" false false
rm "$TMP/no-vk/verification_key.json"
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/no-vk" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "missing verification key should fail"
else
  pass "missing verification key rejected"
fi

echo "missing vk_hash.txt when sync required"
build_valid_package "$TMP/no-vkhash" false true
rm "$TMP/no-vkhash/vk_hash.txt"
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/no-vkhash" \
  --artifacts-dir "$TMP/artifacts" \
  --require-sync \
  --skip-zkey-verify 2>/dev/null; then
  fail "missing vk_hash.txt should fail"
else
  pass "missing vk_hash.txt rejected"
fi

echo "finalize row not last"
build_valid_package "$TMP/bad-finalize-order" false false
python3 - <<PY
import json
from pathlib import Path
p = Path("$TMP/bad-finalize-order/transcript.jsonl")
rows = [json.loads(l) for l in p.read_text().splitlines()]
finalize = rows.pop()
rows.insert(2, finalize)
p.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
PY
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/bad-finalize-order" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "finalize row not last should fail"
else
  pass "finalize row not last rejected"
fi

echo "transcript row hash mismatch"
build_valid_package "$TMP/row-hash-mismatch" false false
python3 - <<PY
import json
from pathlib import Path
p = Path("$TMP/row-hash-mismatch/transcript.jsonl")
rows = [json.loads(l) for l in p.read_text().splitlines()]
rows[1]["input_sha256"] = "0" * 64
p.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
PY
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/row-hash-mismatch" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "transcript row hash mismatch should fail"
else
  pass "transcript row hash mismatch rejected"
fi

echo "compare-vk-hashes rejects mismatch"
build_valid_package "$TMP/vkcmp" false true
LOCAL="$(tr -d '[:space:]' < "$TMP/vkcmp/vk_hash.txt")"
if python3 "$SCRIPT_DIR/ceremony_lib.py" compare-vk-hashes "$LOCAL" "$(printf '0%.0s' {1..64})" 2>/dev/null; then
  fail "compare-vk-hashes should reject mismatch"
else
  pass "compare-vk-hashes rejects mismatch"
fi

echo "env override CEREMONY_VK_JSON"
build_valid_package "$TMP/env-vk" false false
ALT="$TMP/alt-verification_key.json"
cp "$TMP/env-vk/verification_key.json" "$ALT"
rm "$TMP/env-vk/verification_key.json"
if CEREMONY_VK_JSON="$ALT" python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/env-vk" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  pass "CEREMONY_VK_JSON override accepted"
else
  fail "CEREMONY_VK_JSON override should work"
fi

echo "duplicate contributor"
build_valid_package "$TMP/dup" false false
python3 - <<PY
import json
from pathlib import Path
p = Path("$TMP/dup/transcript.jsonl")
rows = [json.loads(l) for l in p.read_text().splitlines()]
rows[2]["contributor"] = rows[1]["contributor"]
p.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
PY
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/dup" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "duplicate contributor should fail"
else
  pass "duplicate contributor rejected"
fi

echo "too few contributors"
build_valid_package "$TMP/few" false false
python3 - <<PY
import json
from pathlib import Path
p = Path("$TMP/few/transcript.jsonl")
rows = [json.loads(l) for l in p.read_text().splitlines()]
rows = [rows[0], rows[1], rows[2]]
p.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
PY
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/few" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "too few contributors should fail"
else
  pass "too few contributors rejected"
fi

echo "bad suffix"
build_valid_package "$TMP/bad-suffix" false false
python3 - <<PY
import json
from pathlib import Path
p = Path("$TMP/bad-suffix/transcript.jsonl")
rows = [json.loads(l) for l in p.read_text().splitlines()]
rows[1]["output"] = "compliance_corridor_0009.zkey"
p.write_text("\n".join(json.dumps(r) for r in rows) + "\n")
PY
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/bad-suffix" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "bad suffix should fail"
else
  pass "bad suffix rejected"
fi

echo "manifest hash mismatch"
build_valid_package "$TMP/hash-mismatch" false false
python3 - <<PY
import json
from pathlib import Path
m = json.loads(Path("$TMP/hash-mismatch/manifest.json").read_text())
m["transcript_sha256"] = "0" * 64
Path("$TMP/hash-mismatch/manifest.json").write_text(json.dumps(m, indent=2) + "\n")
PY
if python3 "$SCRIPT_DIR/ceremony_lib.py" verify-package \
  --ceremony-dir "$TMP/hash-mismatch" \
  --artifacts-dir "$TMP/artifacts" \
  --skip-zkey-verify 2>/dev/null; then
  fail "manifest hash mismatch should fail"
else
  pass "manifest hash mismatch rejected"
fi

echo "published without sync"
build_valid_package "$TMP/pub-nosync" true false
if python3 "$SCRIPT_DIR/ceremony_lib.py" check-manifest-flags \
  --manifest "$TMP/pub-nosync/manifest.json" 2>/dev/null; then
  fail "published without sync should fail"
else
  pass "published without sync rejected"
fi

echo "mainnet gate rejects unpublished manifest"
build_valid_package "$TMP/gate" false false
if WISP_MAINNET_APPROVED=1 \
  CEREMONY_DIR="$TMP/gate" \
  CEREMONY_MANIFEST="$TMP/gate/manifest.json" \
  CEREMONY_FINAL_ZKEY="$TMP/gate/compliance_corridor_final.zkey" \
  TRANSCRIPT="$TMP/gate/transcript.jsonl" \
  CEREMONY_VK_JSON="$TMP/gate/verification_key.json" \
  CEREMONY_VK_HASH_TXT="$TMP/gate/vk_hash.txt" \
  bash -c "touch \"$TMP/gate/vk_hash.txt\"; source \"$ROOT/scripts/deploy/ceremony-mainnet-gate.sh\"" 2>/dev/null; then
  fail "mainnet gate should reject unpublished manifest"
else
  pass "mainnet gate rejects unpublished manifest"
fi

echo "compute-vk-hash parity"
python3 "$SCRIPT_DIR/compute-vk-hash.py" > "$TMP/vkhash.txt"
pass "compute-vk-hash runs"

echo "=== Ceremony gate tests passed ==="

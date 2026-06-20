#!/usr/bin/env python3
"""Ceremony evidence validation and manifest helpers."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

CEREMONY_VERSION = "wisp-groth16-phase2-v1"
CIRCUIT_NAME = "compliance_corridor"
MIN_CONTRIBUTIONS = 3
ZKEY_SUFFIX_RE = re.compile(r"^compliance_corridor_(\d{4})\.zkey$")
FINAL_ZKEY_NAME = "compliance_corridor_final.zkey"


class CeremonyError(Exception):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def write_json_atomic(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=True)
        fh.write("\n")
    tmp.replace(path)


def update_manifest_fields(path: Path, updates: dict[str, Any]) -> None:
    manifest = load_json(path) if path.is_file() else {}
    manifest.update(updates)
    write_json_atomic(path, manifest)


def load_transcript(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        raise CeremonyError(f"missing transcript: {path}")
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            line = line.strip()
            if not line:
                raise CeremonyError(f"transcript line {line_no}: empty line")
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise CeremonyError(f"transcript line {line_no}: invalid JSON: {exc}") from exc
            if not isinstance(row, dict):
                raise CeremonyError(f"transcript line {line_no}: row must be an object")
            rows.append(row)
    if not rows:
        raise CeremonyError("transcript is empty")
    return rows


def zkey_suffix(name: str) -> int:
    match = ZKEY_SUFFIX_RE.match(name)
    if not match:
        raise CeremonyError(f"zkey basename does not match compliance_corridor_NNNN.zkey: {name}")
    return int(match.group(1), 10)


def validate_transcript(rows: list[dict[str, Any]]) -> tuple[list[str], dict[str, Any]]:
    init = rows[0]
    if init.get("kind") != "init" or init.get("step") != 0:
        raise CeremonyError("row 0 must be kind=init with step=0")

    required_init = {
        "r1cs",
        "r1cs_sha256",
        "ptau",
        "ptau_sha256",
        "zkey",
        "zkey_sha256",
        "created_at",
    }
    missing = required_init - init.keys()
    if missing:
        raise CeremonyError(f"init row missing fields: {sorted(missing)}")

    contributions = [r for r in rows[1:] if r.get("kind") == "contribution"]
    finalize_rows = [r for r in rows[1:] if r.get("kind") == "finalize"]
    other = [r for r in rows[1:] if r.get("kind") not in ("contribution", "finalize")]
    if other:
        raise CeremonyError("transcript contains unknown row kinds after init")
    if len(finalize_rows) != 1 or rows[-1].get("kind") != "finalize":
        raise CeremonyError("finalize row must be the last transcript row")
    if len(contributions) < MIN_CONTRIBUTIONS:
        raise CeremonyError(f"need at least {MIN_CONTRIBUTIONS} contribution rows")

    expected_step = 1
    previous_output = init["zkey"]
    contributors: list[str] = []

    for row in contributions:
        if row.get("step") != expected_step:
            raise CeremonyError(
                f"contribution step {row.get('step')} != expected {expected_step}"
            )
        contributor = str(row.get("contributor", "")).strip()
        if not contributor:
            raise CeremonyError(f"contribution step {expected_step}: empty contributor")
        if contributor in contributors:
            raise CeremonyError(f"duplicate contributor: {contributor}")
        contributors.append(contributor)

        input_name = row.get("input")
        output_name = row.get("output")
        if input_name != previous_output:
            raise CeremonyError(
                f"contribution step {expected_step}: input {input_name} != previous output {previous_output}"
            )
        if zkey_suffix(output_name) != zkey_suffix(input_name) + 1:
            raise CeremonyError(
                f"contribution step {expected_step}: output suffix must increment by 1"
            )

        required = {
            "input_sha256",
            "output_sha256",
            "created_at",
        }
        missing = required - row.keys()
        if missing:
            raise CeremonyError(
                f"contribution step {expected_step} missing fields: {sorted(missing)}"
            )

        previous_output = output_name
        expected_step += 1

    finalize = finalize_rows[0]
    if finalize.get("step") != expected_step:
        raise CeremonyError(
            f"finalize step {finalize.get('step')} != expected {expected_step}"
        )
    if finalize.get("input") != previous_output:
        raise CeremonyError("finalize input must equal last contribution output")

    required_finalize = {
        "input_sha256",
        "beacon_hex",
        "beacon_rounds",
        "final_zkey",
        "final_zkey_sha256",
        "verification_key",
        "verification_key_sha256",
        "created_at",
    }
    missing = required_finalize - finalize.keys()
    if missing:
        raise CeremonyError(f"finalize row missing fields: {sorted(missing)}")

    return contributors, finalize


def resolve_paths(ceremony_dir: Path, artifacts_dir: Path) -> dict[str, Path]:
    if "CEREMONY_DIR" in os.environ:
        ceremony_dir = Path(os.environ["CEREMONY_DIR"]).resolve()

    manifest = ceremony_dir / "manifest.json"
    transcript = ceremony_dir / "transcript.jsonl"
    vk_json = ceremony_dir / "verification_key.json"
    vk_hash_txt = ceremony_dir / "vk_hash.txt"
    final_zkey = ceremony_dir / FINAL_ZKEY_NAME

    if "CEREMONY_FINAL_ZKEY" in os.environ:
        final_zkey = Path(os.environ["CEREMONY_FINAL_ZKEY"]).resolve()
    if "CEREMONY_MANIFEST" in os.environ:
        manifest = Path(os.environ["CEREMONY_MANIFEST"]).resolve()
    if "TRANSCRIPT" in os.environ:
        transcript = Path(os.environ["TRANSCRIPT"]).resolve()
    if "CEREMONY_VK_JSON" in os.environ:
        vk_json = Path(os.environ["CEREMONY_VK_JSON"]).resolve()
    if "CEREMONY_VK_HASH_TXT" in os.environ:
        vk_hash_txt = Path(os.environ["CEREMONY_VK_HASH_TXT"]).resolve()

    return {
        "ceremony_dir": ceremony_dir,
        "artifacts_dir": artifacts_dir,
        "manifest": manifest,
        "transcript": transcript,
        "vk_json": vk_json,
        "vk_hash_txt": vk_hash_txt,
        "final_zkey": final_zkey,
    }


def _assert_file_hash(path: Path, expected: str, label: str) -> None:
    if not path.is_file():
        raise CeremonyError(f"missing {label}: {path}")
    actual = sha256_file(path)
    if actual != expected:
        raise CeremonyError(f"{label} sha256 mismatch (transcript vs file on disk)")


def validate_transcript_artifact_hashes(
    rows: list[dict[str, Any]],
    paths: dict[str, Path],
    manifest: dict[str, Any],
) -> None:
    ceremony_dir = paths["ceremony_dir"]
    artifacts_dir = paths["artifacts_dir"]
    init = rows[0]
    contributions = [r for r in rows[1:] if r.get("kind") == "contribution"]
    finalize = rows[-1]

    r1cs = artifacts_dir / manifest["r1cs_file"]
    ptau = artifacts_dir / manifest["ptau_file"]
    _assert_file_hash(r1cs, init["r1cs_sha256"], "init r1cs")
    _assert_file_hash(ptau, init["ptau_sha256"], "init ptau")
    _assert_file_hash(ceremony_dir / init["zkey"], init["zkey_sha256"], "init zkey")

    if init["r1cs"] != manifest["r1cs_file"]:
        raise CeremonyError("init row r1cs != manifest r1cs_file")
    if init["ptau"] != manifest["ptau_file"]:
        raise CeremonyError("init row ptau != manifest ptau_file")
    if init["r1cs_sha256"] != manifest["r1cs_sha256"]:
        raise CeremonyError("init row r1cs_sha256 != manifest r1cs_sha256")
    if init["ptau_sha256"] != manifest["ptau_sha256"]:
        raise CeremonyError("init row ptau_sha256 != manifest ptau_sha256")

    for row in contributions:
        step = row.get("step")
        _assert_file_hash(
            ceremony_dir / row["input"],
            row["input_sha256"],
            f"contribution step {step} input zkey",
        )
        _assert_file_hash(
            ceremony_dir / row["output"],
            row["output_sha256"],
            f"contribution step {step} output zkey",
        )

    _assert_file_hash(
        ceremony_dir / finalize["input"],
        finalize["input_sha256"],
        "finalize input zkey",
    )
    _assert_file_hash(paths["final_zkey"], finalize["final_zkey_sha256"], "finalize final zkey")
    _assert_file_hash(
        paths["vk_json"],
        finalize["verification_key_sha256"],
        "finalize verification_key",
    )


def compare_vk_hashes(local: str, on_chain: str) -> None:
    if normalize_vk_hash(local) != normalize_vk_hash(on_chain):
        raise CeremonyError(
            f"vk_hash mismatch: local={normalize_vk_hash(local)} on_chain={normalize_vk_hash(on_chain)}"
        )


def build_manifest_from_finalize(
    *,
    artifacts_dir: Path,
    ceremony_dir: Path,
    transcript_path: Path,
    finalize_row: dict[str, Any],
    contributors: list[str],
    r1cs_path: Path,
    ptau_path: Path,
) -> dict[str, Any]:
    return {
        "ceremony_version": CEREMONY_VERSION,
        "circuit": CIRCUIT_NAME,
        "r1cs_file": r1cs_path.name,
        "r1cs_sha256": sha256_file(r1cs_path),
        "ptau_file": ptau_path.name,
        "ptau_sha256": sha256_file(ptau_path),
        "transcript_file": transcript_path.name,
        "transcript_sha256": sha256_file(transcript_path),
        "final_zkey_file": finalize_row["final_zkey"],
        "final_zkey_sha256": finalize_row["final_zkey_sha256"],
        "verification_key_file": finalize_row["verification_key"],
        "verification_key_sha256": finalize_row["verification_key_sha256"],
        "vk_hash_file": "vk_hash.txt",
        "vk_hash": "",
        "beacon_hex": finalize_row["beacon_hex"],
        "beacon_rounds": finalize_row["beacon_rounds"],
        "contributor_count": len(contributors),
        "contributors": contributors,
        "finalized_at": finalize_row["created_at"],
        "published": False,
        "verifier_contract_synced": False,
        "verifier_wasm_sha256": "",
        "coordinator_note": "",
    }


def validate_manifest(
    manifest: dict[str, Any],
    paths: dict[str, Path],
    *,
    require_sync: bool,
    require_published: bool,
) -> None:
    required = {
        "ceremony_version",
        "circuit",
        "r1cs_file",
        "r1cs_sha256",
        "ptau_file",
        "ptau_sha256",
        "transcript_file",
        "transcript_sha256",
        "final_zkey_file",
        "final_zkey_sha256",
        "verification_key_file",
        "verification_key_sha256",
        "vk_hash_file",
        "vk_hash",
        "beacon_hex",
        "beacon_rounds",
        "contributor_count",
        "contributors",
        "finalized_at",
        "published",
        "verifier_contract_synced",
        "verifier_wasm_sha256",
        "coordinator_note",
    }
    missing = required - manifest.keys()
    if missing:
        raise CeremonyError(f"manifest missing fields: {sorted(missing)}")

    if manifest["ceremony_version"] != CEREMONY_VERSION:
        raise CeremonyError("manifest ceremony_version mismatch")
    if manifest["circuit"] != CIRCUIT_NAME:
        raise CeremonyError("manifest circuit mismatch")
    if manifest["contributor_count"] != len(manifest["contributors"]):
        raise CeremonyError("manifest contributor_count != len(contributors)")

    transcript_path = paths["transcript"]
    vk_json = paths["vk_json"]
    vk_hash_txt = paths["vk_hash_txt"]
    final_zkey = paths["final_zkey"]
    artifacts_dir = paths["artifacts_dir"]

    r1cs = artifacts_dir / manifest["r1cs_file"]
    ptau = artifacts_dir / manifest["ptau_file"]

    for label, path in (
        ("transcript", transcript_path),
        ("verification_key", vk_json),
        ("final_zkey", final_zkey),
        ("r1cs", r1cs),
        ("ptau", ptau),
    ):
        if not path.is_file():
            raise CeremonyError(f"missing {label}: {path}")

    if sha256_file(transcript_path) != manifest["transcript_sha256"]:
        raise CeremonyError("manifest transcript_sha256 mismatch")
    if sha256_file(vk_json) != manifest["verification_key_sha256"]:
        raise CeremonyError("manifest verification_key_sha256 mismatch")
    if sha256_file(final_zkey) != manifest["final_zkey_sha256"]:
        raise CeremonyError("manifest final_zkey_sha256 mismatch")
    if sha256_file(r1cs) != manifest["r1cs_sha256"]:
        raise CeremonyError("manifest r1cs_sha256 mismatch")
    if sha256_file(ptau) != manifest["ptau_sha256"]:
        raise CeremonyError("manifest ptau_sha256 mismatch")

    synced = bool(manifest.get("verifier_contract_synced"))
    published = bool(manifest.get("published"))

    if published and not synced:
        raise CeremonyError("published=true requires verifier_contract_synced=true")
    if require_published and not published:
        raise CeremonyError("manifest published=false")
    if require_sync and not synced:
        raise CeremonyError("manifest verifier_contract_synced=false")

    if synced or require_sync:
        if not vk_hash_txt.is_file():
            raise CeremonyError(f"missing vk_hash.txt: {vk_hash_txt}")
        on_disk = vk_hash_txt.read_text(encoding="utf-8").strip().lower()
        manifest_hash = str(manifest.get("vk_hash", "")).strip().lower()
        if not on_disk:
            raise CeremonyError("vk_hash.txt is empty")
        if not manifest_hash:
            raise CeremonyError("manifest vk_hash is empty but verifier sync required")
        if on_disk != manifest_hash:
            raise CeremonyError("manifest vk_hash != vk_hash.txt")
        if not str(manifest.get("verifier_wasm_sha256", "")).strip():
            raise CeremonyError("manifest verifier_wasm_sha256 is empty but sync required")


def validate_finalize_pre(transcript_path: Path, input_zkey: Path) -> None:
    rows = load_transcript(transcript_path)
    contributions = [r for r in rows[1:] if r.get("kind") == "contribution"]
    if any(r.get("kind") == "finalize" for r in rows):
        raise CeremonyError("finalize row already exists")
    if len(contributions) < MIN_CONTRIBUTIONS:
        raise CeremonyError(f"need at least {MIN_CONTRIBUTIONS} contributions before finalize")
    latest_output = contributions[-1]["output"]
    if input_zkey.name != latest_output:
        raise CeremonyError(
            f"input zkey {input_zkey.name} != last contribution output {latest_output}"
        )


def validate_contribute_pre(
    transcript_path: Path,
    input_zkey: Path,
    output_zkey: Path,
    contributor: str,
) -> None:
    rows = load_transcript(transcript_path)
    init = rows[0]
    contributions = [r for r in rows[1:] if r.get("kind") == "contribution"]
    if any(r.get("kind") == "finalize" for r in rows):
        raise CeremonyError("cannot contribute after finalize row exists")

    contributor = contributor.strip()
    if not contributor:
        raise CeremonyError("contributor name is empty")

    seen = {str(r.get("contributor", "")).strip() for r in contributions}
    if contributor in seen:
        raise CeremonyError(f"duplicate contributor: {contributor}")

    latest_output = init["zkey"]
    if contributions:
        latest_output = contributions[-1]["output"]

    input_name = input_zkey.name
    output_name = output_zkey.name
    if input_name != latest_output:
        raise CeremonyError(
            f"input zkey {input_name} != latest transcript output {latest_output}"
        )
    if zkey_suffix(output_name) != zkey_suffix(input_name) + 1:
        raise CeremonyError("output zkey suffix must increment input suffix by 1")


def verify_package(
    ceremony_dir: Path,
    artifacts_dir: Path,
    *,
    skip_zkey_verify: bool = False,
    require_published: bool = False,
    require_sync: bool = False,
    vk_hash_from_vk_rs: str | None = None,
) -> None:
    paths = resolve_paths(ceremony_dir, artifacts_dir)
    rows = load_transcript(paths["transcript"])
    contributors, finalize = validate_transcript(rows)

    if not paths["manifest"].is_file():
        raise CeremonyError(f"missing manifest: {paths['manifest']}")
    manifest = load_json(paths["manifest"])
    validate_manifest(
        manifest,
        paths,
        require_sync=require_sync or bool(manifest.get("verifier_contract_synced")),
        require_published=require_published,
    )

    if manifest["contributors"] != contributors:
        raise CeremonyError("manifest contributors != transcript contributors")
    if manifest["beacon_hex"] != finalize["beacon_hex"]:
        raise CeremonyError("manifest beacon_hex != finalize row")
    if manifest["beacon_rounds"] != finalize["beacon_rounds"]:
        raise CeremonyError("manifest beacon_rounds != finalize row")
    if manifest["final_zkey_file"] != finalize["final_zkey"]:
        raise CeremonyError("manifest final_zkey_file != finalize row")
    if manifest["verification_key_file"] != finalize["verification_key"]:
        raise CeremonyError("manifest verification_key_file != finalize row")

    validate_transcript_artifact_hashes(rows, paths, manifest)

    if skip_zkey_verify:
        return

    if vk_hash_from_vk_rs is not None and paths["vk_hash_txt"].is_file():
        on_disk = paths["vk_hash_txt"].read_text(encoding="utf-8").strip().lower()
        if on_disk != vk_hash_from_vk_rs.strip().lower():
            raise CeremonyError("vk_hash.txt != compute-vk-hash.py output")
        manifest_hash = str(manifest.get("vk_hash", "")).strip().lower()
        if manifest_hash and manifest_hash != vk_hash_from_vk_rs.strip().lower():
            raise CeremonyError("manifest vk_hash != compute-vk-hash.py output")


def normalize_vk_hash(value: str) -> str:
    value = value.strip()
    if not value:
        raise CeremonyError("empty vk_hash value")

    if value.startswith("[") and value.endswith("]"):
        try:
            items = json.loads(value)
            if isinstance(items, list) and items:
                if all(isinstance(x, int) for x in items):
                    value = "".join(f"{x:02x}" for x in items)
                else:
                    raise CeremonyError("vk_hash byte array must contain integers")
        except json.JSONDecodeError as exc:
            raise CeremonyError(f"invalid vk_hash byte array: {exc}") from exc

    if value.lower().startswith("0x"):
        value = value[2:]
    value = re.sub(r"[^0-9a-fA-F]", "", value)
    if len(value) != 64:
        raise CeremonyError(f"vk_hash must be 64 hex chars, got {len(value)}")
    return value.lower()


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    default_ceremony = (script_dir / "../artifacts/ceremony").resolve()
    default_artifacts = (script_dir / "../artifacts").resolve()

    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_finalize = sub.add_parser("validate-finalize-pre")
    p_finalize.add_argument("--transcript", type=Path, required=True)
    p_finalize.add_argument("--input-zkey", type=Path, required=True)

    p_contrib = sub.add_parser("validate-contribute-pre")
    p_contrib.add_argument("--transcript", type=Path, required=True)
    p_contrib.add_argument("--input-zkey", type=Path, required=True)
    p_contrib.add_argument("--output-zkey", type=Path, required=True)
    p_contrib.add_argument("--contributor", required=True)

    p_verify = sub.add_parser("verify-package")
    p_verify.add_argument("--ceremony-dir", type=Path, default=default_ceremony)
    p_verify.add_argument("--artifacts-dir", type=Path, default=default_artifacts)
    p_verify.add_argument("--skip-zkey-verify", action="store_true")
    p_verify.add_argument("--require-published", action="store_true")
    p_verify.add_argument("--require-sync", action="store_true")
    p_verify.add_argument("--vk-hash-from-vk-rs")

    p_manifest = sub.add_parser("write-finalize-manifest")
    p_manifest.add_argument("--ceremony-dir", type=Path, default=default_ceremony)
    p_manifest.add_argument("--artifacts-dir", type=Path, default=default_artifacts)
    p_manifest.add_argument("--transcript", type=Path, required=True)
    p_manifest.add_argument("--r1cs", type=Path, required=True)
    p_manifest.add_argument("--ptau", type=Path, required=True)

    p_check = sub.add_parser("check-manifest-flags")
    p_check.add_argument("--manifest", type=Path, required=True)
    p_check.add_argument("--require-published", action="store_true")
    p_check.add_argument("--require-sync", action="store_true")

    p_update = sub.add_parser("update-manifest-fields")
    p_update.add_argument("--manifest", type=Path, required=True)
    p_update.add_argument("--json", required=True, help="JSON object of fields to merge")

    p_norm = sub.add_parser("normalize-vk-hash")
    p_norm.add_argument("value")

    p_compare = sub.add_parser("compare-vk-hashes")
    p_compare.add_argument("local")
    p_compare.add_argument("on_chain")

    args = parser.parse_args()

    try:
        if args.cmd == "validate-finalize-pre":
            validate_finalize_pre(
                args.transcript.resolve(),
                args.input_zkey.resolve(),
            )
        elif args.cmd == "validate-contribute-pre":
            validate_contribute_pre(
                args.transcript.resolve(),
                args.input_zkey.resolve(),
                args.output_zkey.resolve(),
                args.contributor,
            )
        elif args.cmd == "verify-package":
            verify_package(
                args.ceremony_dir.resolve(),
                args.artifacts_dir.resolve(),
                skip_zkey_verify=args.skip_zkey_verify,
                require_published=args.require_published,
                require_sync=args.require_sync,
                vk_hash_from_vk_rs=args.vk_hash_from_vk_rs,
            )
        elif args.cmd == "write-finalize-manifest":
            rows = load_transcript(args.transcript.resolve())
            contributors, finalize = validate_transcript(rows)
            if len([r for r in rows if r.get("kind") == "contribution"]) < MIN_CONTRIBUTIONS:
                raise CeremonyError(f"need at least {MIN_CONTRIBUTIONS} contributions to finalize")
            manifest = build_manifest_from_finalize(
                artifacts_dir=args.artifacts_dir.resolve(),
                ceremony_dir=args.ceremony_dir.resolve(),
                transcript_path=args.transcript.resolve(),
                finalize_row=finalize,
                contributors=contributors,
                r1cs_path=args.r1cs.resolve(),
                ptau_path=args.ptau.resolve(),
            )
            out = args.ceremony_dir.resolve() / "manifest.json"
            write_json_atomic(out, manifest)
            print(out)
        elif args.cmd == "check-manifest-flags":
            manifest = load_json(args.manifest.resolve())
            if args.require_published and not manifest.get("published"):
                raise CeremonyError("manifest published=false")
            if args.require_sync and not manifest.get("verifier_contract_synced"):
                raise CeremonyError("manifest verifier_contract_synced=false")
            if manifest.get("published") and not manifest.get("verifier_contract_synced"):
                raise CeremonyError("published=true requires verifier_contract_synced=true")
        elif args.cmd == "update-manifest-fields":
            updates = json.loads(args.json)
            update_manifest_fields(args.manifest.resolve(), updates)
        elif args.cmd == "normalize-vk-hash":
            print(normalize_vk_hash(args.value))
        elif args.cmd == "compare-vk-hashes":
            compare_vk_hashes(args.local, args.on_chain)
    except CeremonyError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()

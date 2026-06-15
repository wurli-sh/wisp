#!/usr/bin/env python3
"""Compute vk_hash from embedded verifier vk.rs bytes (matches on-chain vk_digest)."""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path


def _parse_hex_array(text: str, name: str) -> bytes:
    pattern = rf"const {re.escape(name)}:.*?\=\s*\[(.*?)\];"
    match = re.search(pattern, text, re.S)
    if not match:
        raise SystemExit(f"ERROR: could not find {name} in vk.rs")
    values = re.findall(r"0x[0-9a-fA-F]+", match.group(1))
    if not values:
        raise SystemExit(f"ERROR: no hex bytes found in {name}")
    return bytes(int(v, 16) for v in values)


def _parse_ic_arrays(text: str) -> list[bytes]:
    match = re.search(r"const VK_IC:.*?\=\s*\[(.*?)\n\];", text, re.S)
    if not match:
        raise SystemExit("ERROR: could not find VK_IC in vk.rs")
    blocks = re.findall(r"\[(.*?)\]", match.group(1), re.S)
    if not blocks:
        raise SystemExit("ERROR: no IC points found in VK_IC")
    points: list[bytes] = []
    for block in blocks:
        values = re.findall(r"0x[0-9a-fA-F]+", block)
        if not values:
            raise SystemExit("ERROR: empty IC point in VK_IC")
        points.append(bytes(int(v, 16) for v in values))
    return points


def compute_vk_hash(vk_rs_path: Path) -> str:
    text = vk_rs_path.read_text(encoding="utf-8")
    payload = b"".join(
        [
            _parse_hex_array(text, "VK_ALPHA"),
            _parse_hex_array(text, "VK_BETA"),
            _parse_hex_array(text, "VK_GAMMA"),
            _parse_hex_array(text, "VK_DELTA"),
            *(_parse_ic_arrays(text)),
        ]
    )
    return hashlib.sha256(payload).hexdigest()


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    default_vk = script_dir / "../../../backend/programs/verifier/src/vk.rs"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--vk-rs",
        type=Path,
        default=default_vk.resolve(),
        help="Path to backend/programs/verifier/src/vk.rs",
    )
    args = parser.parse_args()
    if not args.vk_rs.is_file():
        raise SystemExit(f"ERROR: vk.rs not found: {args.vk_rs}")
    print(compute_vk_hash(args.vk_rs))


if __name__ == "__main__":
    main()

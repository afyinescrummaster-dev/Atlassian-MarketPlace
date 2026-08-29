#!/usr/bin/env python3
"""Append-only Forge deployment log and markdown renderer."""

from __future__ import annotations

import argparse
import json
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JSONL = ROOT / "docs" / "deployments.jsonl"
MARKDOWN = ROOT / "docs" / "DEPLOYMENT-HISTORY.md"
BEGIN = "<!-- BEGIN DEPLOYMENT-LOG -->"
END = "<!-- END DEPLOYMENT-LOG -->"

PRODUCT_NAMES = {
    "di": "Delivery Intelligence",
    "legacy": "Legacy root app",
}

PRODUCT_META = {
    "di": {
        "title": "Delivery Intelligence",
        "app_id": "ari:cloud:ecosystem::app/f7a87d39-d904-408d-9415-72b1052a7026",
        "code": "`apps/delivery-intelligence/`",
    },
    "legacy": {
        "title": "Legacy root app",
        "app_id": "ari:cloud:ecosystem::app/c3817645-72ab-47cf-8c1c-a1dff1b69cff",
        "code": "repo root",
    },
}


def load_records() -> list[dict]:
    if not JSONL.exists():
        return []
    rows = []
    for line in JSONL.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def append_record(record: dict) -> dict:
    JSONL.parent.mkdir(parents=True, exist_ok=True)
    with JSONL.open("a") as fh:
        fh.write(json.dumps(record, separators=(",", ":")) + "\n")
    return record


def current_by_product(records: list[dict]) -> OrderedDict[str, dict]:
    latest: OrderedDict[str, dict] = OrderedDict()
    for row in records:
        latest[row["product"]] = row
    return latest


def short_sha(row: dict) -> str:
    return row.get("sha") or (row.get("shaFull") or "")[:7]


def render_markdown(records: list[dict]) -> str:
    latest = current_by_product(records)
    lines = [
        "## Currently deployed (demo site)",
        "",
        "| App | Branch / tag | Git SHA | Forge env | Forge version | When (UTC) | Notes |",
        "|---|---|---|---|---|---|---|",
    ]
    for product in ("di", "legacy"):
        row = latest.get(product)
        if not row:
            continue
        label = row.get("tag") or row.get("branch") or ""
        notes = (row.get("result") or "").replace("|", "/")
        lines.append(
            f"| {row.get('productName', PRODUCT_NAMES.get(product, product))} "
            f"| {label} | `{short_sha(row)}` | `{row.get('env', '')}` "
            f"| **{row.get('forgeVersion', '')}** | {row.get('timestamp', '')} "
            f"| {notes} |"
        )
    lines += [
        "",
        "Site: `https://one-atlas-qzzp.atlassian.net`",
        "",
    ]
    for product, meta in PRODUCT_META.items():
        rows = [r for r in records if r.get("product") == product]
        rows.reverse()
        lines += [
            f"## {meta['title']}",
            "",
            f"App ID: `{meta['app_id']}`  ",
            f"Code: {meta['code']}",
            "",
            "| When (UTC) | Branch | Git SHA | Env | Forge version | Tree | Result |",
            "|---|---|---|---|---|---|---|",
        ]
        for row in rows:
            result = (row.get("result") or "").replace("|", "/")
            lines.append(
                f"| {row.get('timestamp', '')} | {row.get('branch', '')} "
                f"| `{short_sha(row)}` | {row.get('env', '')} "
                f"| {row.get('forgeVersion', '')} | {row.get('tree', '')} "
                f"| {result} |"
            )
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def write_markdown(records: list[dict]) -> None:
    generated = render_markdown(records)
    if MARKDOWN.exists():
        text = MARKDOWN.read_text()
    else:
        text = ""
    if BEGIN in text and END in text:
        before = text.split(BEGIN, 1)[0]
        after = text.split(END, 1)[1]
        MARKDOWN.write_text(f"{before}{BEGIN}\n\n{generated}\n{END}{after}")
    else:
        header = (
            "# Deployment history (every recorded Forge deploy)\n\n"
            "Machine log: `docs/deployments.jsonl`. "
            "Append with `./scripts/record-deploy.sh` or `./scripts/forge-deploy.sh`.\n\n"
            f"{BEGIN}\n\n"
        )
        MARKDOWN.write_text(f"{header}{generated}\n{END}\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    rec = sub.add_parser("record", help="append one deployment record")
    rec.add_argument("--product", required=True, choices=sorted(PRODUCT_NAMES))
    rec.add_argument("--branch", required=True)
    rec.add_argument("--sha", required=True)
    rec.add_argument("--env", required=True)
    rec.add_argument("--forge-version", required=True)
    rec.add_argument("--tree", default="clean")
    rec.add_argument("--tag", default="")
    rec.add_argument("--result", default="")
    rec.add_argument("--timestamp", default="")
    rec.add_argument("--sha-full", default="")
    sub.add_parser("render", help="rewrite the markdown log from jsonl")
    cur = sub.add_parser("current", help="print the latest recorded deploy")
    cur.add_argument("--product", choices=sorted(PRODUCT_NAMES))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.cmd == "record":
        timestamp = args.timestamp or datetime.now(timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        record = {
            "timestamp": timestamp,
            "product": args.product,
            "productName": PRODUCT_NAMES[args.product],
            "branch": args.branch,
            "sha": args.sha[:7] if args.sha != "uncommitted" else "uncommitted",
            "shaFull": args.sha_full or args.sha,
            "env": args.env,
            "forgeVersion": args.forge_version,
            "tree": args.tree,
            "tag": args.tag,
            "result": args.result,
        }
        append_record(record)
        write_markdown(load_records())
        print(json.dumps(record, indent=2))
        return
    if args.cmd == "render":
        write_markdown(load_records())
        print(f"Wrote {MARKDOWN}")
        return
    if args.cmd == "current":
        latest = current_by_product(load_records())
        if args.product:
            row = latest.get(args.product)
            if not row:
                print(f"No recorded deploy for {args.product}")
                return
            print(json.dumps(row, indent=2))
            return
        print(json.dumps(latest, indent=2))


if __name__ == "__main__":
    main()

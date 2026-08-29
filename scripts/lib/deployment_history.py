#!/usr/bin/env python3
"""Append-only Forge deployment log and markdown renderer.

docs/deployments.jsonl is the structured history source.
docs/DEPLOYMENT-HISTORY.md is the generated readable view.
Deployment revisions are Git tags: deploy/<product>/<env>/<forgeVersion>
Those are CMS snapshots, not official release tags (di-v*, legacy-v*).
"""

from __future__ import annotations

import argparse
import json
import os
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JSONL = Path(os.environ.get("DEPLOYMENTS_JSONL", ROOT / "docs" / "deployments.jsonl"))
MARKDOWN = Path(os.environ.get("DEPLOYMENTS_MD", ROOT / "docs" / "DEPLOYMENT-HISTORY.md"))
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


def revision_name(product: str, env: str, version: str) -> str:
    if product not in PRODUCT_NAMES:
        raise ValueError(f"unknown product: {product}")
    if not env or "/" in env or not version or "/" in version:
        raise ValueError("env and forge version must be non-empty and slash-free")
    return f"deploy/{product}/{env}/{version}"


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


def current_by_product_env(records: list[dict]) -> OrderedDict[str, dict]:
    latest: OrderedDict[str, dict] = OrderedDict()
    for row in records:
        key = f"{row.get('product')}:{row.get('env', 'development')}"
        latest[key] = row
    return latest


def lookup(product: str, env: str, version: str) -> dict | None:
    wanted = revision_name(product, env, version)
    matches = []
    for row in load_records():
        if row.get("deploymentRevision") == wanted:
            matches.append(row)
        elif (
            row.get("product") == product
            and row.get("env") == env
            and row.get("forgeVersion") == version
            and row.get("tree") != "dirty"
            and row.get("shaFull") not in (None, "", "uncommitted")
        ):
            matches.append(row)
    return matches[-1] if matches else None


def short_sha(row: dict) -> str:
    return row.get("sha") or (row.get("shaFull") or "")[:7]


def render_markdown(records: list[dict]) -> str:
    latest = current_by_product_env(records)
    lines = [
        "## Currently deployed (demo site)",
        "",
        "| App | Deployment revision | Git SHA | Forge env | Forge version | When (UTC) | Notes |",
        "|---|---|---|---|---|---|---|",
    ]
    for product in ("di", "legacy"):
        row = latest.get(f"{product}:development") or latest.get(f"{product}:")
        if not row:
            for key, candidate in latest.items():
                if key.startswith(f"{product}:"):
                    row = candidate
                    break
        if not row:
            continue
        label = row.get("deploymentRevision") or row.get("tag") or row.get("branch") or ""
        notes = (row.get("result") or "").replace("|", "/")
        lines.append(
            f"| {row.get('productName', PRODUCT_NAMES.get(product, product))} "
            f"| `{label}` | `{short_sha(row)}` | `{row.get('env', '')}` "
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
            "| When (UTC) | Kind | Branch | Git SHA | Env | Forge version | Revision | Result |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for row in rows:
            result = (row.get("result") or "").replace("|", "/")
            lines.append(
                f"| {row.get('timestamp', '')} | {row.get('kind', 'deploy')} "
                f"| {row.get('branch', '')} | `{short_sha(row)}` "
                f"| {row.get('env', '')} | {row.get('forgeVersion', '')} "
                f"| `{row.get('deploymentRevision') or row.get('tag') or ''}` "
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
            "Machine log: `docs/deployments.jsonl`.\n\n"
            f"{BEGIN}\n\n"
        )
        MARKDOWN.write_text(f"{header}{generated}\n{END}\n")


def build_record(args: argparse.Namespace) -> dict:
    timestamp = args.timestamp or datetime.now(timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    sha_full = args.sha_full or args.sha
    version = args.forge_version
    revision = args.deployment_revision
    if not revision and args.sha not in ("", "uncommitted") and args.tree != "dirty":
        revision = revision_name(args.product, args.env, version)
    return {
        "timestamp": timestamp,
        "product": args.product,
        "productName": PRODUCT_NAMES[args.product],
        "branch": args.branch,
        "sha": args.sha[:12] if args.sha != "uncommitted" else "uncommitted",
        "shaFull": sha_full,
        "env": args.env,
        "forgeVersion": version,
        "tree": args.tree,
        "tag": args.tag,
        "deploymentRevision": revision,
        "kind": args.kind,
        "result": args.result,
    }


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
    rec.add_argument("--deployment-revision", default="")
    rec.add_argument("--kind", default="deploy")
    rec.add_argument("--result", default="")
    rec.add_argument("--timestamp", default="")
    rec.add_argument("--sha-full", default="")

    sub.add_parser("render", help="rewrite the markdown log from jsonl")

    cur = sub.add_parser("current", help="print the latest recorded deploy")
    cur.add_argument("--product", choices=sorted(PRODUCT_NAMES))
    cur.add_argument("--env", default="development")

    look = sub.add_parser("lookup", help="find a recorded revision by Forge version")
    look.add_argument("--product", required=True, choices=sorted(PRODUCT_NAMES))
    look.add_argument("--env", required=True)
    look.add_argument("--forge-version", required=True)

    name = sub.add_parser("revision-name", help="print deploy/<product>/<env>/<version>")
    name.add_argument("--product", required=True, choices=sorted(PRODUCT_NAMES))
    name.add_argument("--env", required=True)
    name.add_argument("--forge-version", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.cmd == "record":
        record = build_record(args)
        append_record(record)
        write_markdown(load_records())
        print(json.dumps(record, indent=2))
        return
    if args.cmd == "render":
        write_markdown(load_records())
        print(f"Wrote {MARKDOWN}")
        return
    if args.cmd == "current":
        latest = current_by_product_env(load_records())
        if args.product:
            row = latest.get(f"{args.product}:{args.env}")
            if not row:
                print(f"No recorded deploy for {args.product} {args.env}")
                raise SystemExit(1)
            print(json.dumps(row, indent=2))
            return
        print(json.dumps(latest, indent=2))
        return
    if args.cmd == "lookup":
        row = lookup(args.product, args.env, args.forge_version)
        if not row:
            print(
                f"No recorded deploy for {args.product} {args.env} {args.forge_version}",
                file=__import__("sys").stderr,
            )
            raise SystemExit(1)
        print(json.dumps(row, indent=2))
        return
    if args.cmd == "revision-name":
        print(revision_name(args.product, args.env, args.forge_version))


if __name__ == "__main__":
    main()

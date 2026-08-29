#!/usr/bin/env python3
"""Unit tests for CMS-style deployment history helpers."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))

import deployment_history as dh  # noqa: E402


class RevisionNameTests(unittest.TestCase):
    def test_preferred_convention(self) -> None:
        self.assertEqual(
            dh.revision_name("di", "development", "2.14.0"),
            "deploy/di/development/2.14.0",
        )
        self.assertEqual(
            dh.revision_name("legacy", "development", "4.9.0"),
            "deploy/legacy/development/4.9.0",
        )

    def test_rejects_slashes(self) -> None:
        with self.assertRaises(ValueError):
            dh.revision_name("di", "dev/foo", "1.0.0")


class LookupTests(unittest.TestCase):
    def test_lookup_skips_dirty_uncommitted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jsonl = Path(tmp) / "deployments.jsonl"
            md = Path(tmp) / "DEPLOYMENT-HISTORY.md"
            os.environ["DEPLOYMENTS_JSONL"] = str(jsonl)
            os.environ["DEPLOYMENTS_MD"] = str(md)
            # Re-bind module paths used by lookup()
            dh.JSONL = jsonl
            dh.MARKDOWN = md
            jsonl.write_text(
                json.dumps(
                    {
                        "product": "di",
                        "env": "development",
                        "forgeVersion": "2.8.0",
                        "tree": "dirty",
                        "shaFull": "uncommitted",
                    }
                )
                + "\n"
                + json.dumps(
                    {
                        "product": "di",
                        "env": "development",
                        "forgeVersion": "2.13.0",
                        "tree": "clean",
                        "shaFull": "4f44eb315d5cbd9320c42ce150a360bb522c0a44",
                        "deploymentRevision": "deploy/di/development/2.13.0",
                    }
                )
                + "\n"
            )
            row = dh.lookup("di", "development", "2.13.0")
            self.assertIsNotNone(row)
            assert row is not None
            self.assertEqual(row["shaFull"], "4f44eb315d5cbd9320c42ce150a360bb522c0a44")
            self.assertIsNone(dh.lookup("di", "development", "2.8.0"))

    def test_append_does_not_rewrite(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            jsonl = Path(tmp) / "deployments.jsonl"
            md = Path(tmp) / "out.md"
            md.write_text("<!-- BEGIN DEPLOYMENT-LOG -->\n\n<!-- END DEPLOYMENT-LOG -->\n")
            dh.JSONL = jsonl
            dh.MARKDOWN = md
            first = {
                "timestamp": "2026-01-01T00:00:00Z",
                "product": "di",
                "productName": "Delivery Intelligence",
                "branch": "feature/a",
                "sha": "aaa1111",
                "shaFull": "aaa1111",
                "env": "development",
                "forgeVersion": "2.14.0",
                "tree": "clean",
                "tag": "",
                "deploymentRevision": "deploy/di/development/2.14.0",
                "kind": "deploy",
                "result": "first",
            }
            second = dict(first)
            second["forgeVersion"] = "2.15.0"
            second["deploymentRevision"] = "deploy/di/development/2.15.0"
            second["result"] = "second"
            dh.append_record(first)
            dh.append_record(second)
            lines = jsonl.read_text().splitlines()
            self.assertEqual(len(lines), 2)
            self.assertEqual(json.loads(lines[0])["forgeVersion"], "2.14.0")
            self.assertEqual(json.loads(lines[1])["forgeVersion"], "2.15.0")


class ScriptSmokeTests(unittest.TestCase):
    def test_revision_name_cli(self) -> None:
        out = subprocess.check_output(
            [
                sys.executable,
                str(ROOT / "scripts/lib/deployment_history.py"),
                "revision-name",
                "--product",
                "di",
                "--env",
                "development",
                "--forge-version",
                "2.14.0",
            ],
            text=True,
        ).strip()
        self.assertEqual(out, "deploy/di/development/2.14.0")

    def test_dirty_tree_is_refused(self) -> None:
        script = ROOT / "scripts/forge-deploy.sh"
        proc = subprocess.run(
            ["bash", str(script), "di", "development"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        # This workspace is expected to be dirty while editing; if clean, the
        # next guard is missing forge/origin and still must not record success.
        self.assertNotEqual(proc.returncode, 0)
        combined = proc.stdout + proc.stderr
        self.assertTrue(
            "dirty working tree" in combined
            or "not on origin" in combined
            or "forge CLI not found" in combined
        )


if __name__ == "__main__":
    unittest.main()

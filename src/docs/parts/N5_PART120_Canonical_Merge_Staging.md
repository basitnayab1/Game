# N5 Part 120 — Canonical Merge Staging

This utility creates a deterministic staging tree from available `N5_PART*.zip` archives.

## Rules
- Never overwrite a conflicting source file silently.
- Identical duplicate files are ignored after SHA-256 comparison.
- Conflicting files are recorded in `MERGE_REPORT.json` and cause a non-zero exit code.
- Unclassified files are reported rather than silently placed into production folders.
- This is a staging/merge tool, not a claim that the complete N5 application has been compiled or production-tested.

## Usage

```bash
python3 tools/canonical_merge.py /path/to/archives /path/to/N5_MASTER_STAGING
```

Resolve every reported conflict before calling the resulting tree the canonical source.

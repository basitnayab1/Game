# N5 Part 119 — Source Recovery Inventory Tool

This part is a **merge-preparation utility**, not the final N5 source package.

## Purpose

Before creating the master developer ZIP, every available N5 part archive must be identified, ZIP-integrity checked, and mapped by part number. Missing archives must not be silently recreated or treated as complete.

## Tool

`tools/source_inventory.py` scans a directory recursively for `N5_PART*.zip`, checks each ZIP with Python's ZIP integrity test, reports the available part range, missing part numbers, and duplicate part numbers.

Run:

```bash
python tools/source_inventory.py /path/to/n5/archives
```

## Current recovery status

The Library inventory currently exposes 71 N5 part archives through Part 118. The available archive set is not the same thing as a fully merged application. Some earlier archives are not currently available in the Library inventory, so they must be recovered before the final merge if their source is required.

Known gaps from the current inventory include Parts 1, 5–9, 60–99, and 110. This list is an inventory observation, not a claim that the underlying work was never created; an archive may exist elsewhere or may need to be recovered from an earlier artifact.

## Merge gate

Do not produce `N5_GAME_FINAL_SOURCE_CODE.zip` until:

1. Required source archives are recovered.
2. Canonical duplicate/conflict resolution is applied.
3. Flutter project is actually merged.
4. Backend project is actually merged.
5. Database migrations are consolidated and ordered.
6. Final five-language scope is enforced: English, Turkish, Hindi, Urdu, Arabic.
7. Flutter analyze/test/build checks are run where the SDK is available.
8. Backend type-check/build/tests are run where Node/TypeScript/PostgreSQL test infrastructure is available.
9. Production credentials, licenses, payment/game/KYC provider contracts, and other external operator dependencies remain outside source control.
10. The final ZIP contains the merged project, not a collection of unmerged part archives.

"""Guarded persistent fixture administration CLI.

Examples: ``python -m scripts.fixture_admin inspect --fixture-key local-slate``.
"""
import argparse
import json
import os

from app.database import SessionLocal
from app.e2e_fixtures import delete_fixture, inventory_fixture, seed_fixture, set_fixture_hidden


def main() -> int:
    parser = argparse.ArgumentParser(prog="fixture-admin")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("inspect", "verify", "seed", "hide", "unhide", "delete"):
        command = sub.add_parser(name)
        command.add_argument("--fixture-key", required=True)
        command.add_argument("--json", action="store_true")
        command.add_argument("--dry-run", action="store_true")
        if name == "delete":
            command.add_argument("--confirm")
    args = parser.parse_args()
    db = SessionLocal()
    try:
        if args.command in ("inspect", "verify"):
            result = inventory_fixture(db, args.fixture_key)
        elif args.command == "seed":
            result = seed_fixture(db, args.fixture_key, environment=os.getenv("E2E_ENVIRONMENT"))
        elif args.command in ("hide", "unhide"):
            result = set_fixture_hidden(db, args.fixture_key, args.command == "hide", dry_run=args.dry_run)
        else:
            result = delete_fixture(db, args.fixture_key, confirm=args.confirm, dry_run=args.dry_run)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

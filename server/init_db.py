"""Self-healing schema bootstrap.

Ordered operations (all idempotent, every boot):
    1. Base.metadata.create_all      — creates any NEW tables
    2. Bootstrap alembic              — stamps at head if alembic_version is missing
    3. alembic upgrade head           — applies any unapplied migrations
    4. Self-heal ADD COLUMN pass      — ALTER TABLE ADD COLUMN IF NOT EXISTS for
                                        any column declared in the ORM but
                                        missing from the live DB

Step 4 is the safety net for the recurring bug where someone adds a column to
models.py without authoring a migration. The prod schema self-heals on next
deploy instead of crashing Celery + API with UndefinedColumnError.

Self-heal handles ADD COLUMN only. Drops/renames/type-changes still require
explicit alembic migrations — those are dangerous and should be deliberate.
"""

import asyncio
import subprocess
import sys
from typing import Any

from sqlalchemy import text
from sqlalchemy.dialects import postgresql

from app.database import engine, Base
from app.models import *  # noqa: F401, F403  (register all models on metadata)


async def _alembic_version_table_exists(conn: Any) -> bool:
    result = await conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = 'alembic_version'"
        )
    )
    return result.scalar() is not None


async def _get_actual_columns(conn: Any, table_name: str) -> set[str]:
    result = await conn.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = :t"
        ),
        {"t": table_name},
    )
    return {row[0] for row in result.all()}


def _compile_column_type(col: Any) -> str:
    """SQLAlchemy column type → Postgres DDL fragment (e.g. 'VARCHAR(10)')."""
    return col.type.compile(dialect=postgresql.dialect())


def _build_add_column_sql(table_name: str, col: Any) -> str:
    """Build an ALTER TABLE ADD COLUMN IF NOT EXISTS statement.

    Safety choices:
    - Always emits IF NOT EXISTS so it's idempotent.
    - Always emits NULLABLE regardless of the ORM's nullable setting. Making
      a newly-added column NOT NULL on a populated table without a default
      would fail; the right path for NOT-NULL-with-default is an explicit
      alembic migration. Self-heal is for the additive, permissive case.
    - If the column has a server_default, that gets preserved so existing
      rows get sensible values.
    """
    col_type = _compile_column_type(col)
    default_clause = ""
    if col.server_default is not None:
        arg = getattr(col.server_default, "arg", col.server_default)
        default_text = getattr(arg, "text", None) or str(arg)
        default_clause = f" DEFAULT {default_text}"
    return (
        f'ALTER TABLE "{table_name}" '
        f'ADD COLUMN IF NOT EXISTS "{col.name}" {col_type}{default_clause}'
    )


def _run_alembic(args: list[str]) -> tuple[int, str]:
    """Run alembic as a subprocess. Returns (exit_code, combined_output)."""
    proc = subprocess.run(
        ["alembic", *args],
        capture_output=True,
        text=True,
        cwd="/app",
    )
    return proc.returncode, (proc.stdout + proc.stderr).strip()


async def init() -> None:
    # Step 1 — create any NEW tables. Safe no-op for tables that already exist.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[init_db] step 1: create_all OK")

    # Step 2 — bootstrap alembic. If the alembic_version table is missing, we
    # stamp at 'head' so alembic considers the current schema to be current.
    # Handles the legacy create_all-only deploys that never used alembic.
    async with engine.begin() as conn:
        has_alembic = await _alembic_version_table_exists(conn)

    if not has_alembic:
        print("[init_db] step 2: alembic_version missing → stamping at head")
        rc, out = _run_alembic(["stamp", "head"])
        if rc != 0:
            print(f"[init_db] step 2: stamp FAILED rc={rc}\n{out}", file=sys.stderr)
        else:
            print("[init_db] step 2: stamp head OK")
    else:
        print("[init_db] step 2: alembic_version exists, no bootstrap needed")

    # Step 3 — apply any unapplied migrations. No-op if already at head.
    rc, out = _run_alembic(["upgrade", "head"])
    if rc != 0:
        # Non-fatal: self-heal pass below still runs. A stale or oddly-stamped
        # DB can fail here but self-heal recovers the common "new column"
        # case without the migration.
        print(
            f"[init_db] step 3: alembic upgrade FAILED rc={rc}\n{out}", file=sys.stderr
        )
    else:
        print("[init_db] step 3: alembic upgrade head OK")
        if out:
            print(out)

    # Step 4 — self-heal ADD COLUMN IF NOT EXISTS for any ORM column that's
    # missing from the live DB. Catches the "model changed but no migration
    # authored" failure mode.
    additions: list[str] = []
    async with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            table_cols = await _get_actual_columns(conn, table.name)
            if not table_cols:
                # Table doesn't exist; create_all should have made it. Skip
                # rather than error — alembic or create_all owns creation.
                continue
            existing_lower = {c.lower() for c in table_cols}
            for col in table.columns:
                if col.name.lower() not in existing_lower:
                    sql = _build_add_column_sql(table.name, col)
                    await conn.execute(text(sql))
                    additions.append(f"{table.name}.{col.name}")
    if additions:
        print(
            f"[init_db] step 4: self-healed {len(additions)} column(s): "
            f"{', '.join(additions)}"
        )
    else:
        print("[init_db] step 4: schema already in sync, no columns to add")


asyncio.run(init())

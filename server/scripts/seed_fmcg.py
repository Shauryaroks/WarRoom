import asyncio
import json
from decimal import Decimal
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import Archetype


async def main():
    print("Loading archetypes from ../scripts/output.json...")
    with open("../scripts/output.json", "r", encoding="utf-8") as f:
        data = json.load(f)

    archetypes = data.get("archetypes", [])
    print(f"Found {len(archetypes)} archetypes in JSON.")

    async with AsyncSessionLocal() as session:
        added_count = 0
        for arch_data in archetypes:
            # Check if exists
            stmt = select(Archetype).where(Archetype.slug == arch_data["slug"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if existing:
                print(f"Archetype {arch_data['slug']} already exists, skipping.")
                continue

            # Insert
            archetype = Archetype(
                name=arch_data["name"],
                slug=arch_data["slug"],
                description=arch_data.get("description"),
                sector=arch_data["sector"],
                dossier_content=arch_data["dossier_content"],
                benchmark_bands=arch_data["benchmark_bands"],
                starting_cash=Decimal(str(arch_data["starting_cash"])),
                starting_stock_price=Decimal(str(arch_data["starting_stock_price"])),
                starting_shares=arch_data["starting_shares"],
                swot_strengths=arch_data.get("swot_strengths"),
                swot_weaknesses=arch_data.get("swot_weaknesses"),
                swot_opportunities=arch_data.get("swot_opportunities"),
                swot_threats=arch_data.get("swot_threats"),
                real_world_inspiration=arch_data.get("real_world_inspiration"),
                is_preset=arch_data.get("is_preset", True),
                bcg_classification=arch_data.get("bcg_classification"),
            )
            session.add(archetype)
            added_count += 1

        if added_count > 0:
            await session.commit()
            print(f"Successfully seeded {added_count} archetypes.")
        else:
            print("No new archetypes to seed.")


if __name__ == "__main__":
    asyncio.run(main())

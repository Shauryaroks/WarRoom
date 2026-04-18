import asyncio
from app.database import AsyncSessionLocal
from app.api.admin import _PRESET_ARCHETYPES
from app.models import Archetype
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        for arch_data in _PRESET_ARCHETYPES:
            stmt = select(Archetype).where(Archetype.slug == arch_data["slug"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()
            if existing: continue
            
            archetype = Archetype(**arch_data)
            session.add(archetype)
        await session.commit()
        print("Presets seeded.")

if __name__ == "__main__":
    asyncio.run(main())

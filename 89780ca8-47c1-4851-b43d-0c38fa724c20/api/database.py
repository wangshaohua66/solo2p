from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///./nft_trading.db"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        from api.models.collection import Creator, Collection
        from api.models.order import Asset, Order, Trade
        from api.models.copyright import CopyrightRecord
        from api.models.royalty import RoyaltySettlement, PayoutTransaction
        from api.models.risk import User, RiskAlert, RiskRule, RiskNotification
        from api.models.api_key import APIKey
        await conn.run_sync(Base.metadata.create_all)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.database import init_db, async_session
from api.models.collection import Creator, Collection
from api.models.order import Order, Trade, Asset
from api.models.copyright import CopyrightRecord
from api.models.royalty import RoyaltySettlement
from api.models.risk import User, RiskAlert, RiskRule
from api.schemas.response import HealthResponse
from api.routes import collection, trade, copyright, royalty, risk


async def seed_data():
    async with async_session() as db:
        from sqlalchemy import select

        existing = await db.execute(select(Creator).limit(1))
        if existing.scalar_one_or_none():
            return

        creators = [
            Creator(
                name="Alice Chen",
                wallet_address="0x1234567890abcdef1234567890abcdef12345678",
                bio="Digital artist specializing in abstract art",
                avatar_url="https://example.com/avatar1.png",
                verified=1,
            ),
            Creator(
                name="Bob Wang",
                wallet_address="0xabcdef1234567890abcdef1234567890abcdef12",
                bio="3D modeler and animator",
                avatar_url="https://example.com/avatar2.png",
                verified=1,
            ),
            Creator(
                name="Carol Li",
                wallet_address="0x567890abcdef1234567890abcdef1234567890ab",
                bio="Photographer and visual storyteller",
                avatar_url="https://example.com/avatar3.png",
                verified=0,
            ),
        ]
        db.add_all(creators)
        await db.flush()

        collections_data = [
            ("Digital Dreams Vol.1", 1, "common", 1000, 0.01, 0.05, "approved"),
            ("Pixel Warriors", 1, "common", 500, 0.02, 0.05, "approved"),
            ("City Nights", 2, "common", 800, 0.015, 0.05, "approved"),
            ("Nature Whispers", 2, "common", 600, 0.018, 0.05, "approved"),
            ("Cyber Samurai", 1, "rare", 200, 0.1, 0.08, "approved"),
            ("Crystal Kingdom", 1, "rare", 150, 0.15, 0.08, "approved"),
            ("Neon Dragons", 2, "rare", 100, 0.2, 0.08, "approved"),
            ("Ocean Depths", 3, "rare", 120, 0.12, 0.08, "approved"),
            ("Ethereal Guardian", 1, "epic", 50, 0.5, 0.1, "approved"),
            ("Phoenix Rising", 2, "epic", 30, 0.8, 0.1, "approved"),
            ("Aurora Spirit", 3, "epic", 25, 1.0, 0.1, "approved"),
            ("The Genesis", 1, "legendary", 1, 100.0, 0.15, "approved"),
        ]
        collections = []
        for name, c_id, rarity, supply, price, royalty, status in collections_data:
            c = Collection(
                name=name,
                description=f"A {rarity} collection: {name}",
                creator_id=c_id,
                rarity=rarity,
                total_supply=supply,
                price=price,
                royalty_rate=royalty,
                status=status,
            )
            collections.append(c)
            db.add(c)
        await db.flush()

        users = [
            User(username="trader1", wallet_address="0x1111111111111111111111111111111111111111", risk_score=0.1),
            User(username="trader2", wallet_address="0x2222222222222222222222222222222222222222", risk_score=0.0),
            User(username="trader3", wallet_address="0x3333333333333333333333333333333333333333", risk_score=0.3),
            User(username="whale1", wallet_address="0x4444444444444444444444444444444444444444", risk_score=0.0),
            User(username="collector1", wallet_address="0x5555555555555555555555555555555555555555", risk_score=0.05),
        ]
        db.add_all(users)
        await db.flush()

        orders = [
            Order(collection_id=1, user_id=1, side="buy", order_type="limit", price=0.012, quantity=5, filled_quantity=2, status="partially_filled"),
            Order(collection_id=1, user_id=2, side="sell", order_type="limit", price=0.013, quantity=3, filled_quantity=0, status="open"),
            Order(collection_id=5, user_id=3, side="buy", order_type="limit", price=0.11, quantity=2, filled_quantity=0, status="open"),
            Order(collection_id=5, user_id=4, side="sell", order_type="limit", price=0.12, quantity=1, filled_quantity=0, status="open"),
            Order(collection_id=12, user_id=5, side="buy", order_type="market", price=100.0, quantity=1, filled_quantity=1, status="filled"),
        ]
        db.add_all(orders)
        await db.flush()

        trades = [
            Trade(collection_id=1, buy_order_id=1, sell_order_id=None, buyer_id=1, seller_id=2, price=0.012, quantity=2, tx_hash="0xtrade001"),
            Trade(collection_id=12, buy_order_id=5, sell_order_id=None, buyer_id=5, seller_id=1, price=100.0, quantity=1, tx_hash="0xtrade002"),
        ]
        db.add_all(trades)
        await db.flush()

        risk_rules = [
            RiskRule(name="Wash Trading Detection", rule_type="wash_trading", threshold=5.0, description="Flag users with 5+ repeated trades with same counterparty"),
            RiskRule(name="Price Manipulation Alert", rule_type="price_manipulation", threshold=0.5, description="Alert when price changes more than 50% in 24h"),
            RiskRule(name="Volume Anomaly", rule_type="volume_anomaly", threshold=10.0, description="Alert when volume exceeds 10x baseline"),
        ]
        db.add_all(risk_rules)
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_data()
    yield

app = FastAPI(
    title="NFT Trading Platform API",
    description="Digital collectible (NFT) trading platform backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(collection.router, prefix="/api/v1")
app.include_router(trade.router, prefix="/api/v1")
app.include_router(copyright.router, prefix="/api/v1")
app.include_router(royalty.router, prefix="/api/v1")
app.include_router(risk.router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    redis_status = "disconnected"
    try:
        import redis.asyncio as r
        from api.services.match_engine import get_redis
        conn = await get_redis()
        await conn.ping()
        redis_status = "connected"
    except Exception:
        pass

    return HealthResponse(
        status="healthy",
        version="1.0.0",
        database="connected",
        redis=redis_status,
    )

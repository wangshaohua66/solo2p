import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.database import get_db, async_session
from api.models.order import Order, Trade
from api.models.collection import Collection
from api.models.risk import User
from api.schemas.request import OrderCreateRequest
from api.schemas.response import OrderResponse, TradeResponse, OrderBookResponse, OrderBookEntry
from api.services.match_engine import match_engine

router = APIRouter(tags=["trade"])


@router.post("/orders", response_model=OrderResponse, status_code=201)
async def place_order(
    req: OrderCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == req.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_frozen:
        raise HTTPException(status_code=403, detail="Account is frozen")

    col_result = await db.execute(select(Collection).where(Collection.id == req.collection_id))
    collection = col_result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.status != "approved" and collection.status != "minted":
        raise HTTPException(status_code=400, detail="Collection is not available for trading")

    order = Order(
        collection_id=req.collection_id,
        user_id=req.user_id,
        side=req.side.value,
        order_type=req.order_type.value,
        price=req.price,
        quantity=req.quantity,
        filled_quantity=0,
        status="open",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    trades = await match_engine.submit_order(order)

    if trades:
        async with async_session() as update_db:
            await update_db.execute(
                Order.__table__.update()
                .where(Order.id == order.id)
                .values(
                    filled_quantity=order.filled_quantity,
                    status=order.status,
                )
            )
            await update_db.commit()

    result = await db.execute(select(Order).where(Order.id == order.id))
    updated_order = result.scalar_one()
    return OrderResponse.model_validate(updated_order)


@router.delete("/orders/{order_id}", response_model=dict)
async def cancel_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in ("open", "partially_filled"):
        raise HTTPException(status_code=400, detail="Order cannot be cancelled")

    cancelled = await match_engine.cancel_order(order.collection_id, order_id)
    if not cancelled:
        raise HTTPException(status_code=400, detail="Order not found in order book")

    order.status = "cancelled"
    await db.commit()

    return {"message": "Order cancelled", "order_id": order_id}


@router.get("/orderbook/{collection_id}", response_model=OrderBookResponse)
async def get_orderbook(
    collection_id: int,
    depth: int = Query(20, ge=1, le=100),
):
    data = await match_engine.get_order_book(collection_id, depth)
    return OrderBookResponse(
        collection_id=collection_id,
        bids=[OrderBookEntry(**b) for b in data["bids"]],
        asks=[OrderBookEntry(**a) for a in data["asks"]],
        timestamp=datetime.now(timezone.utc),
    )


@router.websocket("/ws/orderbook/{collection_id}")
async def websocket_orderbook(websocket: WebSocket, collection_id: int):
    await websocket.accept()
    try:
        pubsub = await match_engine._ensure_redis()
        ps = pubsub.pubsub()
        await ps.subscribe(f"orderbook:{collection_id}")

        while True:
            message = await ps.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message and message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await ps.unsubscribe(f"orderbook:{collection_id}")
            await ps.aclose()
        except Exception:
            pass


@router.get("/trades", response_model=list[TradeResponse])
async def get_trades(
    collection_id: Optional[int] = Query(None),
    buyer_id: Optional[int] = Query(None),
    seller_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Trade).order_by(Trade.created_at.desc())
    if collection_id:
        query = query.where(Trade.collection_id == collection_id)
    if buyer_id:
        query = query.where(Trade.buyer_id == buyer_id)
    if seller_id:
        query = query.where(Trade.seller_id == seller_id)
    query = query.limit(limit)

    result = await db.execute(query)
    trades = result.scalars().all()
    return [TradeResponse.model_validate(t) for t in trades]

import json
import time
import uuid
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

from api.database import async_session
from api.models.order import Order, Trade
from sqlalchemy import select, update


REDIS_URL = "redis://localhost:6379/0"

_redis_pool: Optional[object] = None
_in_memory_store = None


def _get_memory_store():
    global _in_memory_store
    if _in_memory_store is None:
        class MemoryStore:
            def __init__(self):
                self._data: dict = {}

            async def get(self, key: str):
                return self._data.get(key)

            async def set(self, key: str, value: str):
                self._data[key] = value

            async def delete(self, *keys: str):
                for k in keys:
                    self._data.pop(k, None)

            async def zadd(self, key: str, mapping: dict):
                if key not in self._data:
                    self._data[key] = {}
                for member, score in mapping.items():
                    self._data[key][member] = score

            async def zrange(self, key: str, start: int, end: int, withscores: bool = False):
                data = self._data.get(key, {})
                sorted_items = sorted(data.items(), key=lambda x: x[1])
                if end == -1:
                    result_slice = sorted_items[start:]
                else:
                    result_slice = sorted_items[start:end + 1]
                if withscores:
                    return [(m, s) for m, s in result_slice]
                return [m for m, _ in result_slice]

            async def zrem(self, key: str, *members: str):
                removed = 0
                if key in self._data:
                    for m in members:
                        if m in self._data[key]:
                            del self._data[key][m]
                            removed += 1
                return removed

            async def publish(self, channel: str, message: str):
                pass

            async def aclose(self):
                self._data.clear()

        _in_memory_store = MemoryStore()
    return _in_memory_store


async def get_redis():
    if not REDIS_AVAILABLE:
        return _get_memory_store()
    global _redis_pool
    try:
        if _redis_pool is None:
            _redis_pool = redis.ConnectionPool.from_url(
                REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
        r = redis.Redis(connection_pool=_redis_pool)
        await r.ping()
        return r
    except Exception as e:
        logger.debug(f"Redis unavailable, using in-memory store: {e}")
        return _get_memory_store()


def _bids_key(collection_id: int) -> str:
    return f"orderbook:{collection_id}:bids"


def _asks_key(collection_id: int) -> str:
    return f"orderbook:{collection_id}:asks"


def _order_meta_key(order_id: int) -> str:
    return f"order:{order_id}:meta"


class MatchEngine:
    def __init__(self):
        self.redis = None
        self._initialized = False

    async def _ensure_redis(self):
        if not self._initialized:
            self.redis = await get_redis()
            self._initialized = True
        return self.redis

    async def submit_order(self, order: Order) -> list[dict]:
        r = await self._ensure_redis()
        trades = []

        if order.side == "buy":
            trades = await self._match_buy_order(r, order)
        else:
            trades = await self._match_sell_order(r, order)

        remaining = order.quantity - order.filled_quantity
        if remaining > 0 and order.order_type == "limit":
            await self._add_to_book(r, order, remaining)

        await self._publish_orderbook_update(order.collection_id)
        return trades

    async def _match_buy_order(self, r, order: Order) -> list[dict]:
        trades = []
        remaining = order.quantity - order.filled_quantity

        while remaining > 0:
            best_asks = await r.zrange(_asks_key(order.collection_id), 0, 0, withscores=True)
            if not best_asks:
                break

            ask_entry = best_asks[0]
            ask_data = json.loads(ask_entry[0])
            ask_price = ask_data["price"]

            if order.order_type == "limit" and order.price < ask_price:
                break

            available_qty = ask_data["quantity"]
            match_qty = min(remaining, available_qty)
            match_price = ask_price

            trade = await self._execute_trade(
                r, order, ask_data, match_qty, match_price
            )
            trades.append(trade)

            remaining -= match_qty
            order.filled_quantity += match_qty

            if available_qty <= match_qty:
                await r.zrem(_asks_key(order.collection_id), ask_entry[0])
                await r.delete(_order_meta_key(ask_data["order_id"]))
            else:
                ask_data["quantity"] -= match_qty
                old_entry = ask_entry[0]
                new_entry = json.dumps(ask_data)
                await r.zrem(_asks_key(order.collection_id), old_entry)
                await r.zadd(
                    _asks_key(order.collection_id),
                    {new_entry: ask_price},
                )
                await r.set(_order_meta_key(ask_data["order_id"]), new_entry)

        if remaining <= 0:
            order.status = "filled"
        elif order.filled_quantity > 0:
            order.status = "partially_filled"

        return trades

    async def _match_sell_order(self, r, order: Order) -> list[dict]:
        trades = []
        remaining = order.quantity - order.filled_quantity

        while remaining > 0:
            best_bids = await r.zrange(_bids_key(order.collection_id), 0, 0, withscores=True)
            if not best_bids:
                break

            bid_entry = best_bids[0]
            bid_data = json.loads(bid_entry[0])
            bid_price = bid_data["price"]

            if order.order_type == "limit" and order.price > bid_price:
                break

            available_qty = bid_data["quantity"]
            match_qty = min(remaining, available_qty)
            match_price = bid_price

            trade = await self._execute_trade(
                r, order, bid_data, match_qty, match_price, sell_is_taker=True
            )
            trades.append(trade)

            remaining -= match_qty
            order.filled_quantity += match_qty

            if available_qty <= match_qty:
                await r.zrem(_bids_key(order.collection_id), bid_entry[0])
                await r.delete(_order_meta_key(bid_data["order_id"]))
            else:
                bid_data["quantity"] -= match_qty
                old_entry = bid_entry[0]
                new_entry = json.dumps(bid_data)
                await r.zrem(_bids_key(order.collection_id), old_entry)
                await r.zadd(
                    _bids_key(order.collection_id),
                    {new_entry: -bid_price},
                )
                await r.set(_order_meta_key(bid_data["order_id"]), new_entry)

        if remaining <= 0:
            order.status = "filled"
        elif order.filled_quantity > 0:
            order.status = "partially_filled"

        return trades

    async def _execute_trade(
        self,
        r,
        taker_order: Order,
        maker_data: dict,
        match_qty: int,
        match_price: float,
        sell_is_taker: bool = False,
    ) -> dict:
        trade = Trade(
            collection_id=taker_order.collection_id,
            buy_order_id=taker_order.id if not sell_is_taker else maker_data.get("order_id"),
            sell_order_id=taker_order.id if sell_is_taker else maker_data.get("order_id"),
            buyer_id=taker_order.user_id if not sell_is_taker else maker_data.get("user_id"),
            seller_id=taker_order.user_id if sell_is_taker else maker_data.get("user_id"),
            price=match_price,
            quantity=match_qty,
            tx_hash=f"0x{uuid.uuid4().hex[:32]}",
        )
        async with async_session() as session:
            session.add(trade)

            if maker_data.get("order_id"):
                await session.execute(
                    update(Order)
                    .where(Order.id == maker_data["order_id"])
                    .values(filled_quantity=Order.filled_quantity + match_qty)
                )

            await session.commit()
            await session.refresh(trade)

        return {
            "trade_id": trade.id,
            "buyer_id": trade.buyer_id,
            "seller_id": trade.seller_id,
            "price": trade.price,
            "quantity": trade.quantity,
            "collection_id": trade.collection_id,
        }

    async def _add_to_book(self, r, order: Order, remaining: int):
        entry = {
            "order_id": order.id,
            "user_id": order.user_id,
            "price": order.price,
            "quantity": remaining,
            "timestamp": time.time(),
        }
        entry_json = json.dumps(entry)

        if order.side == "buy":
            await r.zadd(
                _bids_key(order.collection_id),
                {entry_json: -order.price},
            )
        else:
            await r.zadd(
                _asks_key(order.collection_id),
                {entry_json: order.price},
            )

        await r.set(_order_meta_key(order.id), entry_json)

    async def cancel_order(self, collection_id: int, order_id: int) -> bool:
        r = await self._ensure_redis()
        meta_raw = await r.get(_order_meta_key(order_id))
        if not meta_raw:
            return False

        meta = json.loads(meta_raw)
        entry_json = meta_raw if isinstance(meta_raw, str) else json.dumps(meta)
        side = meta.get("side", "buy")
        key = _bids_key(collection_id) if side == "buy" else _asks_key(collection_id)

        removed = await r.zrem(key, entry_json)
        await r.delete(_order_meta_key(order_id))

        if removed:
            await self._publish_orderbook_update(collection_id)
        return removed > 0

    async def get_order_book(self, collection_id: int, depth: int = 20) -> dict:
        r = await self._ensure_redis()

        raw_bids = await r.zrange(_bids_key(collection_id), 0, depth - 1, withscores=True)
        raw_asks = await r.zrange(_asks_key(collection_id), 0, depth - 1, withscores=True)

        bids = []
        for entry_json, score in raw_bids:
            data = json.loads(entry_json)
            bids.append({"price": data["price"], "quantity": data["quantity"], "order_count": 1})

        asks = []
        for entry_json, score in raw_asks:
            data = json.loads(entry_json)
            asks.append({"price": data["price"], "quantity": data["quantity"], "order_count": 1})

        aggregated_bids = self._aggregate_levels(bids)
        aggregated_asks = self._aggregate_levels(asks)

        return {
            "collection_id": collection_id,
            "bids": aggregated_bids,
            "asks": aggregated_asks,
        }

    def _aggregate_levels(self, levels: list[dict]) -> list[dict]:
        price_map: dict[float, dict] = {}
        for level in levels:
            p = level["price"]
            if p in price_map:
                price_map[p]["quantity"] += level["quantity"]
                price_map[p]["order_count"] += level["order_count"]
            else:
                price_map[p] = {
                    "price": p,
                    "quantity": level["quantity"],
                    "order_count": level["order_count"],
                }
        return list(price_map.values())

    async def match_orders(self, collection_id: int) -> list[dict]:
        r = await self._ensure_redis()
        all_trades = []

        raw_bids = await r.zrange(_bids_key(collection_id), 0, -1, withscores=True)
        for entry_json, _ in raw_bids:
            bid_data = json.loads(entry_json)
            async with async_session() as session:
                result = await session.execute(
                    select(Order).where(Order.id == bid_data["order_id"])
                )
                order = result.scalar_one_or_none()
                if order and order.status in ("open", "partially_filled"):
                    trades = await self.submit_order(order)
                    all_trades.extend(trades)

        return all_trades

    async def _publish_orderbook_update(self, collection_id: int):
        r = await self._ensure_redis()
        orderbook = await self.get_order_book(collection_id)
        try:
            await r.publish(
                f"orderbook:{collection_id}",
                json.dumps(orderbook),
            )
        except Exception as e:
            logger.debug(f"Publish orderbook update failed: {e}")


match_engine = MatchEngine()

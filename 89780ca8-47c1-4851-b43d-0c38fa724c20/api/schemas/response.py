from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CreatorResponse(BaseModel):
    id: int
    name: str
    wallet_address: str
    bio: str
    avatar_url: str
    verified: int
    created_at: datetime

    class Config:
        from_attributes = True


class CollectionResponse(BaseModel):
    id: int
    name: str
    description: str
    creator_id: int
    image_url: str
    rarity: str
    total_supply: int
    minted_count: int
    price: float
    royalty_rate: float
    status: str
    tx_hash: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CollectionListResponse(BaseModel):
    items: list[CollectionResponse]
    total: int
    page: int
    page_size: int


class AssetResponse(BaseModel):
    id: int
    collection_id: int
    token_id: str
    owner_id: Optional[int]
    status: str
    mint_tx_hash: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    collection_id: int
    user_id: int
    side: str
    order_type: str
    price: float
    quantity: int
    filled_quantity: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TradeResponse(BaseModel):
    id: int
    collection_id: int
    buy_order_id: Optional[int]
    sell_order_id: Optional[int]
    buyer_id: int
    seller_id: int
    price: float
    quantity: int
    tx_hash: str
    created_at: datetime

    class Config:
        from_attributes = True


class OrderBookEntry(BaseModel):
    price: float
    quantity: int
    order_count: int


class OrderBookResponse(BaseModel):
    collection_id: int
    bids: list[OrderBookEntry]
    asks: list[OrderBookEntry]
    timestamp: datetime


class CopyrightResponse(BaseModel):
    id: int
    collection_id: int
    token_id: str
    ipfs_cid: str
    chain_type: str
    tx_hash: str
    certificate_url: str
    metadata_hash: str
    status: str
    registered_at: datetime

    class Config:
        from_attributes = True


class ProvenanceResponse(BaseModel):
    collection_id: int
    records: list[CopyrightResponse]
    total: int


class RoyaltySettlementResponse(BaseModel):
    id: int
    trade_id: int
    creator_id: int
    collection_id: int
    trade_price: float
    royalty_rate: float
    royalty_amount: float
    status: str
    settled_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CreatorEarningsResponse(BaseModel):
    creator_id: int
    total_earnings: float
    pending_amount: float
    settled_amount: float
    settlements: list[RoyaltySettlementResponse]


class RiskAlertResponse(BaseModel):
    id: int
    user_id: int
    alert_type: str
    severity: str
    description: str
    status: str
    resolved_by: Optional[int]
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class RiskRuleResponse(BaseModel):
    id: int
    name: str
    rule_type: str
    threshold: float
    description: str
    enabled: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserRiskResponse(BaseModel):
    id: int
    username: str
    wallet_address: str
    risk_score: float
    is_frozen: int
    created_at: datetime

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    version: str
    database: str
    redis: str

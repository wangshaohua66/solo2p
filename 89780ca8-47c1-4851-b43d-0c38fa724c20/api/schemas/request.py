from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RarityEnum(str, Enum):
    common = "common"
    rare = "rare"
    epic = "epic"
    legendary = "legendary"


class OrderSideEnum(str, Enum):
    buy = "buy"
    sell = "sell"


class OrderTypeEnum(str, Enum):
    limit = "limit"
    market = "market"


class CollectionPublishRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    creator_id: int = Field(..., gt=0)
    image_url: str = Field(default="", max_length=500)
    rarity: RarityEnum
    total_supply: int = Field(..., gt=0, le=100000)
    price: float = Field(..., gt=0)
    royalty_rate: float = Field(default=0.05, ge=0, le=0.5)


class CollectionReviewRequest(BaseModel):
    review_notes: str = Field(default="", max_length=1000)


class CollectionApproveRequest(BaseModel):
    approved: bool
    review_notes: str = Field(default="")
    reviewer_id: int = Field(..., gt=0)


class ReviewStageSubmitRequest(BaseModel):
    reviewer_id: int = Field(..., gt=0)
    review_notes: str = Field(default="", max_length=2000)


class CollectionMintRequest(BaseModel):
    quantity: int = Field(default=1, gt=0, le=100)


class OrderCreateRequest(BaseModel):
    collection_id: int = Field(..., gt=0)
    user_id: int = Field(..., gt=0)
    side: OrderSideEnum
    order_type: OrderTypeEnum
    price: float = Field(..., gt=0)
    quantity: int = Field(..., gt=0, le=1000)


class CopyrightRegisterRequest(BaseModel):
    collection_id: int = Field(..., gt=0)
    token_id: str = Field(..., min_length=1, max_length=100)
    chain_type: str = Field(default="ethereum", pattern="^(ethereum|antchain)$")
    metadata_hash: str = Field(default="")


class RoyaltySettleRequest(BaseModel):
    trade_ids: list[int] = Field(..., min_length=1)


class BatchPayoutRequest(BaseModel):
    settlement_ids: list[int] = Field(..., min_length=1)


class RiskRuleUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    threshold: Optional[float] = Field(None, gt=0)
    description: Optional[str] = Field(None, max_length=2000)
    enabled: Optional[bool] = None


class CollectionFilterParams(BaseModel):
    rarity: Optional[RarityEnum] = None
    status: Optional[str] = None
    creator_id: Optional[int] = None
    min_price: Optional[float] = Field(None, ge=0)
    max_price: Optional[float] = Field(None, ge=0)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)


class APIKeyCreateRequest(BaseModel):
    key_name: str = Field(..., min_length=1, max_length=100)
    scopes: str = Field(default="", max_length=500)
    user_id: int = Field(..., gt=0)

import hashlib
import secrets
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.database import get_db
from api.models.api_key import APIKey
from api.models.collection import Collection
from api.models.order import Order, Asset
from api.models.risk import User
from api.schemas.request import APIKeyCreateRequest
from api.schemas.response import (
    APIKeyResponse,
    APIKeyCreateResponse,
    APIKeyListResponse,
    CollectionListResponse,
    CollectionResponse,
    OrderResponse,
    AssetVerifyResponse,
)

keys_router = APIRouter(prefix="/openapi/keys", tags=["openapi-keys"])
open_router = APIRouter(prefix="/open", tags=["openapi-data"])


def _generate_api_key() -> tuple[str, str]:
    random_hex = secrets.token_hex(32)
    full_key = f"nk_{random_hex}"
    key_hash = hashlib.sha256(full_key.encode("utf-8")).hexdigest()
    return full_key, key_hash


def _key_prefix_from_hash(key_hash: str) -> str:
    return key_hash[:8]


def _build_key_response(api_key: APIKey) -> APIKeyResponse:
    return APIKeyResponse(
        id=api_key.id,
        key_name=api_key.key_name,
        user_id=api_key.user_id,
        scopes=api_key.scopes,
        rate_limit_per_min=api_key.rate_limit_per_min,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        revoked_at=api_key.revoked_at,
        key_prefix=_key_prefix_from_hash(api_key.key_hash),
    )


@keys_router.post("", response_model=APIKeyCreateResponse, status_code=201)
async def create_api_key(
    req: APIKeyCreateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == req.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"User {req.user_id} not found")

    full_key, key_hash = _generate_api_key()

    api_key = APIKey(
        key_hash=key_hash,
        key_name=req.key_name,
        user_id=req.user_id,
        scopes=req.scopes,
        rate_limit_per_min=100,
        is_active=1,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    base_resp = _build_key_response(api_key)
    return APIKeyCreateResponse(
        **base_resp.model_dump(),
        full_key=full_key,
    )


@keys_router.get("", response_model=APIKeyListResponse)
async def list_api_keys(
    request: Request,
    user_id: Optional[int] = Query(None, gt=0),
    db: AsyncSession = Depends(get_db),
):
    api_key_info = getattr(request.state, "api_key_info", None)
    if not api_key_info:
        raise HTTPException(status_code=401, detail="Not authenticated")

    query = select(APIKey)
    count_query = select(func.count(APIKey.id))

    effective_user_id = user_id if user_id is not None else api_key_info["user_id"]
    query = query.where(APIKey.user_id == effective_user_id)
    count_query = count_query.where(APIKey.user_id == effective_user_id)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    result = await db.execute(
        query.order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()

    return APIKeyListResponse(
        items=[_build_key_response(k) for k in keys],
        total=total,
    )


@keys_router.put("/{key_id}/revoke", response_model=APIKeyResponse)
async def revoke_api_key(
    key_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(APIKey).where(APIKey.id == key_id))
    api_key = result.scalar_one_or_none()
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    api_key_info = getattr(request.state, "api_key_info", None)
    if not api_key_info:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if api_key.user_id != api_key_info["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to revoke this key")

    api_key.is_active = 0
    api_key.revoked_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(api_key)

    return _build_key_response(api_key)


@open_router.get("/collections", response_model=CollectionListResponse)
async def sync_collections(
    request: Request,
    rarity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Collection).where(Collection.status == "approved")
    count_query = select(func.count(Collection.id)).where(Collection.status == "approved")

    if rarity:
        query = query.where(Collection.rarity == rarity)
        count_query = count_query.where(Collection.rarity == rarity)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        query.order_by(Collection.created_at.desc()).offset(offset).limit(page_size)
    )
    collections = result.scalars().all()

    return CollectionListResponse(
        items=[CollectionResponse.model_validate(c) for c in collections],
        total=total,
        page=page,
        page_size=page_size,
    )


@open_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    api_key_info = getattr(request.state, "api_key_info", None)
    if not api_key_info:
        raise HTTPException(status_code=401, detail="Not authenticated")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.user_id != api_key_info["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this order")

    return OrderResponse.model_validate(order)


@open_router.get("/assets/verify/{token_id}", response_model=AssetVerifyResponse)
async def verify_asset(
    token_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Asset, Collection)
        .join(Collection, Asset.collection_id == Collection.id)
        .where(Asset.token_id == token_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")

    asset, collection = row

    return AssetVerifyResponse(
        token_id=asset.token_id,
        collection_id=asset.collection_id,
        collection_name=collection.name,
        owner_id=asset.owner_id,
        status=asset.status,
        mint_tx_hash=asset.mint_tx_hash,
        verified=True,
        verified_at=datetime.now(timezone.utc),
    )

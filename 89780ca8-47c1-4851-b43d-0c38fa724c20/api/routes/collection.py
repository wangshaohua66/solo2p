from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.database import get_db
from api.models.collection import Collection, Creator
from api.schemas.request import CollectionPublishRequest, CollectionApproveRequest, CollectionMintRequest, RarityEnum
from api.schemas.response import CollectionResponse, CollectionListResponse, CreatorResponse
from api.services.cache_service import cache_service

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("", response_model=CollectionListResponse)
async def list_collections(
    rarity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    creator_id: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Collection)
    count_query = select(func.count(Collection.id))

    if rarity:
        query = query.where(Collection.rarity == rarity)
        count_query = count_query.where(Collection.rarity == rarity)
    if status:
        query = query.where(Collection.status == status)
        count_query = count_query.where(Collection.status == status)
    if creator_id:
        query = query.where(Collection.creator_id == creator_id)
        count_query = count_query.where(Collection.creator_id == creator_id)
    if min_price is not None:
        query = query.where(Collection.price >= min_price)
        count_query = count_query.where(Collection.price >= min_price)
    if max_price is not None:
        query = query.where(Collection.price <= max_price)
        count_query = count_query.where(Collection.price <= max_price)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

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


@router.post("", response_model=CollectionResponse, status_code=201)
async def create_collection(
    req: CollectionPublishRequest,
    db: AsyncSession = Depends(get_db),
):
    creator_result = await db.execute(select(Creator).where(Creator.id == req.creator_id))
    creator = creator_result.scalar_one_or_none()
    if not creator:
        raise HTTPException(status_code=404, detail=f"Creator {req.creator_id} not found")

    collection = Collection(
        name=req.name,
        description=req.description,
        creator_id=req.creator_id,
        image_url=req.image_url,
        rarity=req.rarity.value,
        total_supply=req.total_supply,
        price=req.price,
        royalty_rate=req.royalty_rate,
        status="draft",
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return CollectionResponse.model_validate(collection)


@router.get("/{collection_id}", response_model=CollectionResponse)
async def get_collection(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
):
    cached = await cache_service.get_collection_cache(collection_id)
    if cached:
        return CollectionResponse(**cached)

    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    resp = CollectionResponse.model_validate(collection)
    await cache_service.set_collection_cache(collection_id, resp.model_dump())
    return resp


@router.put("/{collection_id}/review", response_model=CollectionResponse)
async def submit_for_review(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft collections can be submitted for review")

    collection.status = "pending_review"
    await db.commit()
    await db.refresh(collection)
    await cache_service.invalidate_collection_cache(collection_id)
    return CollectionResponse.model_validate(collection)


@router.put("/{collection_id}/approve", response_model=CollectionResponse)
async def approve_collection(
    collection_id: int,
    req: CollectionApproveRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.status != "pending_review":
        raise HTTPException(status_code=400, detail="Collection is not pending review")

    collection.status = "approved" if req.approved else "rejected"
    await db.commit()
    await db.refresh(collection)
    await cache_service.invalidate_collection_cache(collection_id)
    return CollectionResponse.model_validate(collection)


@router.post("/{collection_id}/mint", response_model=CollectionResponse)
async def mint_collection(
    collection_id: int,
    req: CollectionMintRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.status != "approved":
        raise HTTPException(status_code=400, detail="Collection must be approved before minting")

    new_minted = collection.minted_count + req.quantity
    if new_minted > collection.total_supply:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot mint {req.quantity}. Only {collection.total_supply - collection.minted_count} remaining",
        )

    collection.minted_count = new_minted
    if collection.minted_count == collection.total_supply:
        collection.status = "minted"

    import uuid
    collection.tx_hash = f"0x{uuid.uuid4().hex[:64]}"

    await db.commit()
    await db.refresh(collection)
    await cache_service.invalidate_collection_cache(collection_id)
    return CollectionResponse.model_validate(collection)

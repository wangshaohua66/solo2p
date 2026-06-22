from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime, timezone
import hashlib

from api.database import get_db
from api.models.collection import Collection, Creator, ReviewHistory
from api.models.risk import User
from api.schemas.request import (
    CollectionPublishRequest,
    CollectionApproveRequest,
    CollectionMintRequest,
    RarityEnum,
    ReviewStageSubmitRequest,
)
from api.schemas.response import (
    CollectionResponse,
    CollectionListResponse,
    CreatorResponse,
    ERC721MetadataResponse,
    ERC1155MetadataResponse,
    NFTMetadataResponse,
    NFTAttribute,
    NFTProperties,
)
from api.services.cache_service import cache_service

router = APIRouter(prefix="/collections", tags=["collections"])

REVIEW_STAGE_FLOW = {
    "draft": "first_review",
    "first_review": "second_review",
    "second_review": "final_review",
    "final_review": "approved",
}

REVIEW_STAGE_ORDER = ["first_review", "second_review", "final_review"]

STAGE_TO_ROLE = {
    "first_review": "reviewer",
    "second_review": "senior_reviewer",
    "final_review": "admin",
}

STAGE_REVIEWER_FIELD = {
    "first_review": "first_reviewer_id",
    "second_review": "second_reviewer_id",
    "final_review": "final_reviewer_id",
}

STAGE_REVIEWED_AT_FIELD = {
    "first_review": "first_reviewed_at",
    "second_review": "second_reviewed_at",
    "final_review": "final_reviewed_at",
}

STAGE_NOTES_FIELD = {
    "first_review": "first_review_notes",
    "second_review": "second_review_notes",
    "final_review": "final_review_notes",
}


async def _get_user_and_check_role(db: AsyncSession, reviewer_id: int, required_role: str) -> User:
    result = await db.execute(select(User).where(User.id == reviewer_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=f"Reviewer {reviewer_id} not found")

    allowed_roles = {"admin"}
    if required_role == "reviewer":
        allowed_roles.update({"reviewer", "senior_reviewer"})
    elif required_role == "senior_reviewer":
        allowed_roles.add("senior_reviewer")

    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Role '{user.role}' not authorized for {required_role}. Required: {allowed_roles}",
        )
    return user


async def _add_review_history(
    db: AsyncSession,
    collection_id: int,
    reviewer_id: int,
    reviewer_role: str,
    review_stage: str,
    action: str,
    review_notes: str,
):
    history = ReviewHistory(
        collection_id=collection_id,
        reviewer_id=reviewer_id,
        reviewer_role=reviewer_role,
        review_stage=review_stage,
        action=action,
        review_notes=review_notes,
        created_at=datetime.now(timezone.utc),
    )
    db.add(history)


@router.get("", response_model=CollectionListResponse)
async def list_collections(
    rarity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    creator_id: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None, ge=0),
    max_price: Optional[float] = Query(None, ge=0),
    review_stage: Optional[str] = Query(None),
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
    if review_stage:
        query = query.where(Collection.review_stage == review_stage)
        count_query = count_query.where(Collection.review_stage == review_stage)

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
        review_stage="",
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


@router.get("/{collection_id}/review-history")
async def get_review_history(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ReviewHistory)
        .where(ReviewHistory.collection_id == collection_id)
        .order_by(ReviewHistory.created_at.asc())
    )
    history = result.scalars().all()
    return {
        "collection_id": collection_id,
        "total": len(history),
        "records": [
            {
                "id": h.id,
                "reviewer_id": h.reviewer_id,
                "reviewer_role": h.reviewer_role,
                "review_stage": h.review_stage,
                "action": h.action,
                "review_notes": h.review_notes,
                "created_at": h.created_at,
            }
            for h in history
        ],
    }


@router.put("/{collection_id}/submit-review", response_model=CollectionResponse)
async def submit_for_first_review(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    if collection.status not in ("draft", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Only draft/rejected collections can be submitted for review. Current status: {collection.status}",
        )

    collection.status = "pending_review"
    collection.review_stage = "first_review"
    await db.commit()
    await db.refresh(collection)
    await cache_service.invalidate_collection_cache(collection_id)
    return CollectionResponse.model_validate(collection)


@router.put("/{collection_id}/review-stage/{stage}", response_model=CollectionResponse)
async def review_stage_action(
    collection_id: int,
    stage: str,
    req: ReviewStageSubmitRequest,
    approve: bool = Query(..., description="True to pass, False to reject at this stage"),
    db: AsyncSession = Depends(get_db),
):
    if stage not in REVIEW_STAGE_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid review stage: {stage}")

    result = await db.execute(select(Collection).where(Collection.id == collection_id))
    collection = result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    if collection.status != "pending_review":
        raise HTTPException(
            status_code=400,
            detail=f"Collection not pending review. Current status: {collection.status}",
        )
    if collection.review_stage != stage:
        raise HTTPException(
            status_code=400,
            detail=f"Current review stage is '{collection.review_stage}', not '{stage}'",
        )

    required_role = STAGE_TO_ROLE[stage]
    user = await _get_user_and_check_role(db, req.reviewer_id, required_role)

    current_stage_idx = REVIEW_STAGE_ORDER.index(stage)

    if not approve:
        collection.status = "rejected"
        collection.review_stage = stage

        setattr(collection, STAGE_REVIEWER_FIELD[stage], user.id)
        setattr(collection, STAGE_REVIEWED_AT_FIELD[stage], datetime.now(timezone.utc))
        setattr(collection, STAGE_NOTES_FIELD[stage], req.review_notes)

        await _add_review_history(db, collection_id, user.id, user.role, stage, "rejected", req.review_notes)

        await db.commit()
        await db.refresh(collection)
        await cache_service.invalidate_collection_cache(collection_id)
        return CollectionResponse.model_validate(collection)

    setattr(collection, STAGE_REVIEWER_FIELD[stage], user.id)
    setattr(collection, STAGE_REVIEWED_AT_FIELD[stage], datetime.now(timezone.utc))
    setattr(collection, STAGE_NOTES_FIELD[stage], req.review_notes)

    await _add_review_history(db, collection_id, user.id, user.role, stage, "approved", req.review_notes)

    if current_stage_idx == len(REVIEW_STAGE_ORDER) - 1:
        collection.status = "approved"
        collection.review_stage = ""
    else:
        collection.review_stage = REVIEW_STAGE_ORDER[current_stage_idx + 1]

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

    if collection.status != "pending_review" or not collection.review_stage:
        raise HTTPException(
            status_code=400,
            detail=f"Use '/review-stage/{{stage}}' for multi-stage review. Current: status={collection.status}, stage={collection.review_stage}",
        )

    stage = collection.review_stage
    if stage not in REVIEW_STAGE_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid review stage: {stage}")

    required_role = STAGE_TO_ROLE[stage]
    user = await _get_user_and_check_role(db, req.reviewer_id, required_role)
    current_stage_idx = REVIEW_STAGE_ORDER.index(stage)

    if not req.approved:
        collection.status = "rejected"
        await _add_review_history(db, collection_id, user.id, user.role, stage, "rejected", req.review_notes)
    else:
        setattr(collection, STAGE_REVIEWER_FIELD[stage], user.id)
        setattr(collection, STAGE_REVIEWED_AT_FIELD[stage], datetime.now(timezone.utc))
        setattr(collection, STAGE_NOTES_FIELD[stage], req.review_notes)
        await _add_review_history(db, collection_id, user.id, user.role, stage, "approved", req.review_notes)

        if current_stage_idx == len(REVIEW_STAGE_ORDER) - 1:
            collection.status = "approved"
            collection.review_stage = ""
        else:
            collection.review_stage = REVIEW_STAGE_ORDER[current_stage_idx + 1]

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
    if collection.status != "approved" and collection.status != "minted":
        raise HTTPException(
            status_code=400,
            detail=f"Collection must be approved before minting. Current status: {collection.status}",
        )

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


def _build_attributes(collection: Collection) -> list[NFTAttribute]:
    return [
        NFTAttribute(trait_type="rarity", value=collection.rarity),
        NFTAttribute(trait_type="royalty_rate", value=collection.royalty_rate),
        NFTAttribute(trait_type="total_supply", value=collection.total_supply),
        NFTAttribute(trait_type="minted_count", value=collection.minted_count),
        NFTAttribute(trait_type="price_eth", value=collection.price),
        NFTAttribute(trait_type="status", value=collection.status),
    ]


async def _get_collection_with_creator(db: AsyncSession, collection_id: int) -> tuple[Collection, Creator]:
    result = await db.execute(
        select(Collection, Creator)
        .join(Creator, Collection.creator_id == Creator.id)
        .where(Collection.id == collection_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Collection not found")
    return row.Collection, row.Creator


def _build_erc721(collection: Collection, creator: Creator, external_base: str) -> ERC721MetadataResponse:
    token_id = str(collection.id)
    attributes = _build_attributes(collection)
    attributes.append(NFTAttribute(trait_type="creator", value=creator.name))
    return ERC721MetadataResponse(
        name=collection.name,
        description=collection.description,
        image=collection.image_url,
        external_url=f"{external_base}/collections/{collection.id}",
        token_id=token_id,
        attributes=attributes,
    )


def _build_erc1155(collection: Collection, creator: Creator) -> ERC1155MetadataResponse:
    copyright_hash = hashlib.sha256(
        f"{collection.id}:{collection.name}:{collection.created_at}".encode()
    ).hexdigest()
    chain_proofs = []
    if collection.tx_hash:
        chain_proofs.append(collection.tx_hash)
    properties = NFTProperties(
        creator=creator.name,
        copyright_hash=copyright_hash,
        chain_proofs=chain_proofs,
    )
    attributes = _build_attributes(collection)
    attributes.append(NFTAttribute(trait_type="creator_wallet", value=creator.wallet_address))
    return ERC1155MetadataResponse(
        name=collection.name,
        decimals=0,
        description=collection.description,
        image=collection.image_url,
        properties=properties,
        attributes=attributes,
    )


@router.get("/{collection_id}/export/erc721")
async def export_erc721(
    collection_id: int,
    download: bool = Query(False, description="Set true to download as attachment"),
    db: AsyncSession = Depends(get_db),
):
    collection, creator = await _get_collection_with_creator(db, collection_id)
    external_base = "https://nft-marketplace.example.com"
    metadata = _build_erc721(collection, creator, external_base)
    data = metadata.model_dump(mode="json")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{collection_id}_erc721_metadata.json"'
    return JSONResponse(content=data, headers=headers, media_type="application/json")


@router.get("/{collection_id}/export/erc1155")
async def export_erc1155(
    collection_id: int,
    download: bool = Query(False, description="Set true to download as attachment"),
    db: AsyncSession = Depends(get_db),
):
    collection, creator = await _get_collection_with_creator(db, collection_id)
    metadata = _build_erc1155(collection, creator)
    data = metadata.model_dump(mode="json")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{collection_id}_erc1155_metadata.json"'
    return JSONResponse(content=data, headers=headers, media_type="application/json")


@router.get("/{collection_id}/export/metadata", response_model=NFTMetadataResponse)
async def export_metadata_unified(
    collection_id: int,
    standard: str = Query("erc721", pattern="^(erc721|erc1155)$", description="NFT metadata standard"),
    download: bool = Query(False, description="Set true to download as attachment"),
    db: AsyncSession = Depends(get_db),
):
    collection, creator = await _get_collection_with_creator(db, collection_id)
    external_base = "https://nft-marketplace.example.com"

    if standard == "erc721":
        metadata = _build_erc721(collection, creator, external_base)
    else:
        metadata = _build_erc1155(collection, creator)

    wrapped = NFTMetadataResponse(
        standard=standard,
        collection_id=collection_id,
        metadata=metadata,
    )

    data = wrapped.model_dump(mode="json")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{collection_id}_{standard}_metadata.json"'
    return JSONResponse(content=data, headers=headers, media_type="application/json")

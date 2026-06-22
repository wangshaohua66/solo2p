from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.database import get_db
from api.models.copyright import CopyrightRecord
from api.models.collection import Collection
from api.schemas.request import CopyrightRegisterRequest
from api.schemas.response import CopyrightResponse, ProvenanceResponse
from api.services.chain_adapter import chain_adapter

router = APIRouter(prefix="/copyright", tags=["copyright"])


@router.get("/{collection_id}", response_model=ProvenanceResponse)
async def get_provenance(
    collection_id: int,
    token_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(CopyrightRecord).where(CopyrightRecord.collection_id == collection_id)
    if token_id:
        query = query.where(CopyrightRecord.token_id == token_id)

    result = await db.execute(query.order_by(CopyrightRecord.registered_at.desc()))
    records = result.scalars().all()

    if not records:
        provenance = await chain_adapter.query_provenance(collection_id, token_id)
        return ProvenanceResponse(
            collection_id=collection_id,
            records=[],
            total=0,
        )

    return ProvenanceResponse(
        collection_id=collection_id,
        records=[CopyrightResponse.model_validate(r) for r in records],
        total=len(records),
    )


@router.post("/register", response_model=CopyrightResponse, status_code=201)
async def register_copyright(
    req: CopyrightRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    col_result = await db.execute(select(Collection).where(Collection.id == req.collection_id))
    collection = col_result.scalar_one_or_none()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    metadata = f"collection:{req.collection_id}:token:{req.token_id}:metadata:{req.metadata_hash}"
    import json as _json
    ipfs_cid = await chain_adapter.upload_to_ipfs(
        metadata.encode(), f"metadata_{req.collection_id}_{req.token_id}.json"
    )

    chain_result = await chain_adapter.register_copyright(
        collection_id=req.collection_id,
        token_id=req.token_id,
        ipfs_cid=ipfs_cid,
        chain_type=req.chain_type,
        metadata_hash=req.metadata_hash,
    )

    record = CopyrightRecord(
        collection_id=req.collection_id,
        token_id=req.token_id,
        ipfs_cid=ipfs_cid,
        chain_type=chain_result["chain_type"],
        tx_hash=chain_result["tx_hash"],
        certificate_url=chain_result["certificate_url"],
        metadata_hash=req.metadata_hash,
        status="registered",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return CopyrightResponse.model_validate(record)


@router.get("/verify/{token_id}", response_model=list[CopyrightResponse])
async def verify_copyright(
    token_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CopyrightRecord)
        .where(CopyrightRecord.token_id == token_id)
        .order_by(CopyrightRecord.registered_at.desc())
    )
    records = result.scalars().all()
    if not records:
        raise HTTPException(status_code=404, detail="No copyright records found for this token")
    return [CopyrightResponse.model_validate(r) for r in records]

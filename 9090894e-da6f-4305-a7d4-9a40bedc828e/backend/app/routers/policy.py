from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.policy import Policy, PolicyCategory
from app.schemas.policy import Policy as PolicySchema, PolicyListResponse
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("", response_model=ApiResponse[PolicyListResponse])
def list_policies(
    category: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Policy).filter(Policy.is_active == True)
    if category:
        query = query.filter(Policy.category == category)
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            (Policy.title.ilike(kw))
            | (Policy.summary.ilike(kw))
        )
    total = query.count()
    items = query.order_by(Policy.issued_date.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return ApiResponse.ok(PolicyListResponse(list=items, total=total))


@router.get("/{policy_id}", response_model=ApiResponse[PolicySchema])
def get_policy(policy_id: str, db: Session = Depends(get_db)):
    item = db.query(Policy).filter(Policy.id == policy_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="政策文件不存在")
    return ApiResponse.ok(item)


@router.get("/search", response_model=ApiResponse[List[PolicySchema]])
def search_policies(keyword: str = Query(...), db: Session = Depends(get_db)):
    kw = f"%{keyword}%"
    items = db.query(Policy).filter(
        Policy.is_active == True,
        (Policy.title.ilike(kw))
        | (Policy.content.ilike(kw))
        | (Policy.summary.ilike(kw))
    ).limit(30).all()
    return ApiResponse.ok(items)

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.declaration import (
    DeclarationCreate, DeclarationUpdate, DeclarationFilter,
    DeclarationListResponse, Declaration as DeclarationSchema,
    BatchSubmitRequest, WithdrawRequest, ReviewRequest
)
from app.schemas.common import ApiResponse
from app.services.declaration_service import DeclarationService

router = APIRouter()


@router.get("", response_model=ApiResponse[DeclarationListResponse])
def list_declarations(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    platform: Optional[str] = None,
    declare_type: Optional[str] = None,
    enterprise_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    filters = DeclarationFilter(
        keyword=keyword,
        status=status,
        platform=platform,
        declare_type=declare_type,
        enterprise_name=enterprise_name,
        start_date=start_date,
        end_date=end_date
    )
    service = DeclarationService(db)
    items, total = service.list(filters, page, page_size)
    return ApiResponse.ok(DeclarationListResponse(
        list=items,
        total=total,
        page=page,
        page_size=page_size
    ))


@router.get("/{declaration_id}", response_model=ApiResponse[DeclarationSchema])
def get_declaration(declaration_id: str, db: Session = Depends(get_db)):
    service = DeclarationService(db)
    item = service.get_by_id(declaration_id)
    if not item:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return ApiResponse.ok(item)


@router.post("", response_model=ApiResponse[DeclarationSchema])
def create_declaration(data: DeclarationCreate, db: Session = Depends(get_db)):
    service = DeclarationService(db)
    try:
        item = service.create(data, operator="张申报员")
        return ApiResponse.ok(item)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{declaration_id}", response_model=ApiResponse[DeclarationSchema])
def update_declaration(
    declaration_id: str,
    data: DeclarationUpdate,
    db: Session = Depends(get_db)
):
    service = DeclarationService(db)
    try:
        item = service.update(declaration_id, data, operator="张申报员")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not item:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return ApiResponse.ok(item)


@router.delete("/{declaration_id}", response_model=ApiResponse)
def delete_declaration(declaration_id: str, db: Session = Depends(get_db)):
    service = DeclarationService(db)
    try:
        ok = service.delete(declaration_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return ApiResponse.ok(message="删除成功")


@router.post("/{declaration_id}/submit", response_model=ApiResponse[DeclarationSchema])
def submit_declaration(declaration_id: str, db: Session = Depends(get_db)):
    service = DeclarationService(db)
    try:
        item = service.submit(declaration_id, operator="张申报员")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not item:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return ApiResponse.ok(item)


@router.post("/batch-submit", response_model=ApiResponse[list[DeclarationSchema]])
def batch_submit(request: BatchSubmitRequest, db: Session = Depends(get_db)):
    service = DeclarationService(db)
    items = service.batch_submit(request.ids, operator="张申报员")
    return ApiResponse.ok(items)


@router.post("/{declaration_id}/withdraw", response_model=ApiResponse[DeclarationSchema])
def withdraw_declaration(
    declaration_id: str,
    request: WithdrawRequest,
    db: Session = Depends(get_db)
):
    service = DeclarationService(db)
    try:
        item = service.withdraw(declaration_id, request.reason, operator="张申报员")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not item:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return ApiResponse.ok(item)


@router.post("/{declaration_id}/review", response_model=ApiResponse[DeclarationSchema])
def review_declaration(
    declaration_id: str,
    request: ReviewRequest,
    db: Session = Depends(get_db)
):
    service = DeclarationService(db)
    item = service.review(declaration_id, request.approved, request.comment, operator="李审核员")
    if not item:
        raise HTTPException(status_code=404, detail="申报单不存在")
    return ApiResponse.ok(item)

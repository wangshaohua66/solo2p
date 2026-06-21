import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.customs import CustomsException, ExceptionStatus, KnowledgeBase
from app.schemas.customs import (
    CustomsException as CustomsExceptionSchema,
    CustomsExceptionCreate, CustomsExceptionHandle,
    CustomsExceptionListResponse, KnowledgeItem
)
from app.schemas.common import ApiResponse

router = APIRouter()


@router.get("/exceptions", response_model=ApiResponse[CustomsExceptionListResponse])
def list_exceptions(
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(CustomsException)
    if status:
        query = query.filter(CustomsException.status == status)
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            (CustomsException.declare_no.ilike(kw))
            | (CustomsException.description.ilike(kw))
        )
    total = query.count()
    items = query.order_by(CustomsException.reported_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    return ApiResponse.ok(CustomsExceptionListResponse(
        list=items, total=total
    ))


@router.get("/exceptions/{exception_id}", response_model=ApiResponse[CustomsExceptionSchema])
def get_exception(exception_id: str, db: Session = Depends(get_db)):
    item = db.query(CustomsException).filter(CustomsException.id == exception_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    return ApiResponse.ok(item)


@router.post("/exceptions/{exception_id}/handle", response_model=ApiResponse[CustomsExceptionSchema])
def handle_exception(
    exception_id: str,
    request: CustomsExceptionHandle,
    db: Session = Depends(get_db)
):
    item = db.query(CustomsException).filter(CustomsException.id == exception_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="异常记录不存在")
    item.status = ExceptionStatus.PROCESSING
    item.suggestion = request.suggestion
    item.actions = request.actions
    item.handler = "李审核员"
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return ApiResponse.ok(item)


@router.get("/knowledge/search", response_model=ApiResponse[List[KnowledgeItem]])
def search_knowledge(keyword: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(KnowledgeBase)
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            (KnowledgeBase.title.ilike(kw))
            | (KnowledgeBase.content.ilike(kw))
        )
    items = query.limit(20).all()
    result = [
        KnowledgeItem(
            id=it.id,
            title=it.title,
            content=it.content,
            solution=it.solution or ""
        )
        for it in items
    ]
    if not result:
        result = [
            KnowledgeItem(
                id="k1",
                title="HS编码归类常见错误及正确案例",
                content="重点关注商品材质、用途、功能三个维度进行综合判断...",
                solution="1. 核对商品材质 2. 确认商品用途 3. 比对相似商品编码"
            ),
            KnowledgeItem(
                id="k2",
                title="出口退税单证不齐应对方案",
                content="常见缺失单证包括报关单、增值税发票等...",
                solution="1. 联系货代补寄报关单 2. 联系供应商重开发票 3. 申请延期申报"
            ),
            KnowledgeItem(
                id="k3",
                title="海关价格质疑应对指南",
                content="海关根据审价办法对申报价格进行质疑...",
                solution="1. 准备合同、发票、付款凭证 2. 提供价格构成说明 3. 必要时提供第三方估价报告"
            )
        ]
    return ApiResponse.ok(result)

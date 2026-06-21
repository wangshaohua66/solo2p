import uuid
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.customs import CustomsException, ExceptionStatus, KnowledgeBase
from app.schemas.customs import (
    CustomsException as CustomsExceptionSchema,
    CustomsExceptionCreate, CustomsExceptionHandle,
    CustomsExceptionListResponse, KnowledgeItem
)
from app.schemas.common import ApiResponse
from app.services.customs_service import CustomsApiService
from app.services.notification_service import notification_service

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
            | (CustomsException.exception_type.ilike(kw))
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
    background_tasks: BackgroundTasks,
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

    background_tasks.add_task(
        notification_service.send_email,
        ["declarant@example.com"],
        f"【异常处理通知】{item.declare_no}",
        f"<p>您的申报单 {item.declare_no} 已有处理意见：</p><p>{request.suggestion}</p>"
    )

    return ApiResponse.ok(item)


@router.post("/exceptions/{exception_id}/redeclare", response_model=ApiResponse)
async def redeclare_exception(
    exception_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """异常处理后重新申报"""
    service = CustomsApiService(db)
    result = await service.redeclare(exception_id)

    if result.get("code") != 0:
        raise HTTPException(status_code=400, detail=result.get("message", "重新申报失败"))

    background_tasks.add_task(
        notification_service.push_via_websocket,
        "mock_user_1",
        "redeclare_success",
        result.get("data", {})
    )

    return ApiResponse.ok(result.get("data"), message="重新申报成功")


@router.get("/knowledge/search", response_model=ApiResponse[List[KnowledgeItem]])
def search_knowledge(keyword: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(KnowledgeBase)
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter(
            (KnowledgeBase.title.ilike(kw))
            | (KnowledgeBase.content.ilike(kw))
            | (KnowledgeBase.solution.ilike(kw))
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


@router.get("/status/{declare_no}", response_model=ApiResponse)
async def get_customs_status(
    declare_no: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """对接海关单一窗口，查询申报单通关状态"""
    service = CustomsApiService(db)
    result = await service.declare_status_query(declare_no)

    if result.get("code") != 0:
        if result.get("code") == 1:
            exception_data = result.get("data", {})
            background_tasks.add_task(
                notification_service.notify_exception,
                exception_data.get("declare_no", declare_no),
                exception_data.get("exception_type", "通关异常"),
                exception_data.get("description", ""),
                "declarant@example.com",
                "13800138000"
            )
        else:
            raise HTTPException(status_code=400, detail=result.get("message", "查询失败"))

    return ApiResponse.ok(result.get("data"), message=result.get("message"))


@router.post("/status/sync", response_model=ApiResponse)
async def sync_customs_status(
    declare_nos: List[str],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """批量同步海关通关状态（后台定时任务也会调用）"""
    service = CustomsApiService(db)
    result = await service.sync_batch_status(declare_nos)
    return ApiResponse.ok(result.get("data"), message=result.get("message"))


@router.get("/detail/{declare_no}", response_model=ApiResponse)
async def get_customs_detail(
    declare_no: str,
    db: Session = Depends(get_db)
):
    """获取海关详细通关信息（报关单详情、查验记录、流程节点）"""
    service = CustomsApiService(db)
    result = await service.get_customs_detail(declare_no)

    if result.get("code") != 0:
        raise HTTPException(status_code=400, detail=result.get("message", "查询失败"))

    return ApiResponse.ok(result.get("data"))


@router.post("/notify/test", response_model=ApiResponse)
async def test_notification(
    type: str = Query("exception"),
    background_tasks: BackgroundTasks
):
    """测试通知发送"""
    if type == "exception":
        result = await notification_service.notify_exception(
            "CB20240001",
            "测试异常类型",
            "这是一条测试异常通知",
            "test@example.com",
            "13800138000"
        )
    elif type == "policy":
        result = await notification_service.notify_policy_update(
            "测试政策标题",
            "tax",
            ["test@example.com"]
        )
    else:
        result = await notification_service.notify_review_result(
            "CB20240001",
            True,
            "审核通过",
            "test@example.com"
        )
    return ApiResponse.ok(result, message="通知已发送")

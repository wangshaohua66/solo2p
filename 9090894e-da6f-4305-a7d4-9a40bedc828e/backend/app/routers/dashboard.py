from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.policy import DashboardStats
from app.schemas.common import ApiResponse
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("/stats", response_model=ApiResponse[DashboardStats])
def get_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = DashboardService(db)
    result = service.get_stats(start_date, end_date)
    return ApiResponse.ok(result)


@router.get("/export")
def export_data(
    format: str = Query("excel"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    from fastapi.responses import JSONResponse
    return JSONResponse({
        "code": 0,
        "message": "导出功能开发中",
        "data": {"format": format, "start_date": start_date, "end_date": end_date}
    })

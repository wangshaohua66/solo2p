from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.hscode import HSCode, HSChapter, HSCodeListResponse, FavoriteRequest
from app.schemas.common import ApiResponse
from app.services.hscode_service import HSCodeService

router = APIRouter()


@router.get("/search", response_model=ApiResponse[HSCodeListResponse])
def search_hs_codes(
    keyword: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    service = HSCodeService(db)
    items, total = service.search(keyword or "", page, page_size)
    return ApiResponse.ok(HSCodeListResponse(list=items, total=total))


@router.get("/chapters", response_model=ApiResponse[List[HSChapter]])
def get_chapters(db: Session = Depends(get_db)):
    service = HSCodeService(db)
    items = service.get_chapter_tree()
    return ApiResponse.ok(items)


@router.get("/chapter/{chapter_code}", response_model=ApiResponse[List[HSCode]])
def get_by_chapter(chapter_code: str, db: Session = Depends(get_db)):
    service = HSCodeService(db)
    items = service.get_by_chapter(chapter_code)
    return ApiResponse.ok(items)


@router.get("/{code}", response_model=ApiResponse[HSCode])
def get_detail(code: str, db: Session = Depends(get_db)):
    service = HSCodeService(db)
    item = service.get_by_code(code)
    if not item:
        raise HTTPException(status_code=404, detail="HS编码不存在")
    return ApiResponse.ok(item)


@router.get("/{code}/recommendations", response_model=ApiResponse[List[HSCode]])
def get_recommendations(code: str, db: Session = Depends(get_db)):
    service = HSCodeService(db)
    items = service.get_recommendations(code)
    return ApiResponse.ok(items)


@router.get("/history", response_model=ApiResponse[List[str]])
def get_history(db: Session = Depends(get_db)):
    service = HSCodeService(db)
    items = service.get_search_history(user_id="mock_user_1")
    return ApiResponse.ok(items)


@router.get("/favorites", response_model=ApiResponse[List[HSCode]])
def get_favorites(db: Session = Depends(get_db)):
    service = HSCodeService(db)
    items = service.get_favorites(user_id="mock_user_1")
    return ApiResponse.ok(items)


@router.post("/favorites/{code}", response_model=ApiResponse)
def toggle_favorite(code: str, request: FavoriteRequest, db: Session = Depends(get_db)):
    service = HSCodeService(db)
    ok = service.toggle_favorite("mock_user_1", code, request.favorite)
    return ApiResponse.ok(message="操作成功" if ok else "无需变更")

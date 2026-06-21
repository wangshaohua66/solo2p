from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.models.hscode import HSCode, HSChapter, HSSearchHistory, HSFavorite
from app.schemas.hscode import HSCode as HSCodeSchema, HSChapter as HSChapterSchema, DeclareElement


class HSCodeService:
    def __init__(self, db: Session):
        self.db = db

    def search(self, keyword: str, page: int = 1, page_size: int = 20) -> Tuple[List[HSCode], int]:
        query = self.db.query(HSCode).filter(HSCode.is_active == True)
        if keyword:
            kw = f"%{keyword}%"
            query = query.filter(
                or_(
                    HSCode.code.ilike(kw),
                    HSCode.name.ilike(kw),
                    HSCode.description.ilike(kw)
                )
            )
        total = query.count()
        items = query.order_by(HSCode.code).offset((page - 1) * page_size).limit(page_size).all()
        return items, total

    def get_by_code(self, code: str) -> Optional[HSCode]:
        return self.db.query(HSCode).filter(HSCode.code == code, HSCode.is_active == True).first()

    def get_by_chapter(self, chapter_code: str) -> List[HSCode]:
        return self.db.query(HSCode).filter(
            HSCode.code.startswith(chapter_code),
            HSCode.is_active == True
        ).order_by(HSCode.code).all()

    def get_chapter_tree(self) -> List[HSChapter]:
        return self.db.query(HSChapter).order_by(HSChapter.sort_order).all()

    def get_recommendations(self, code: str) -> List[HSCode]:
        target = self.get_by_code(code)
        if not target:
            return []
        prefix = code[:4]
        return self.db.query(HSCode).filter(
            HSCode.code.startswith(prefix),
            HSCode.code != code,
            HSCode.is_active == True
        ).limit(5).all()

    def get_search_history(self, user_id: str, limit: int = 10) -> List[str]:
        records = (
            self.db.query(HSSearchHistory)
            .filter(HSSearchHistory.user_id == user_id)
            .order_by(HSSearchHistory.searched_at.desc())
            .limit(limit)
            .all()
        )
        return [r.keyword for r in records]

    def add_search_history(self, user_id: str, keyword: str):
        record = HSSearchHistory(
            id=str(__import__("uuid").uuid4()),
            user_id=user_id,
            keyword=keyword
        )
        self.db.add(record)
        self.db.commit()

    def get_favorites(self, user_id: str) -> List[HSCode]:
        favs = self.db.query(HSFavorite).filter(HSFavorite.user_id == user_id).all()
        codes = [f.hs_code for f in favs]
        if not codes:
            return []
        return self.db.query(HSCode).filter(HSCode.code.in_(codes), HSCode.is_active == True).all()

    def toggle_favorite(self, user_id: str, code: str, favorite: bool) -> bool:
        existing = self.db.query(HSFavorite).filter(
            HSFavorite.user_id == user_id,
            HSFavorite.hs_code == code
        ).first()
        if favorite and not existing:
            fav = HSFavorite(
                id=str(__import__("uuid").uuid4()),
                user_id=user_id,
                hs_code=code
            )
            self.db.add(fav)
            self.db.commit()
            return True
        if not favorite and existing:
            self.db.delete(existing)
            self.db.commit()
            return True
        return False

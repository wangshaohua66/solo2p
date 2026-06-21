from datetime import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserLogin, LoginResponse, User as UserSchema
from app.schemas.common import ApiResponse

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _mock_user(role: UserRole = UserRole.DECLARANT):
    role_permissions = {
        UserRole.DECLARANT: ["declaration:read", "declaration:write", "hs:search", "tax:calculate", "policy:read"],
        UserRole.REVIEWER: ["declaration:read", "declaration:review", "hs:search", "tax:calculate", "exception:handle", "policy:read"],
        UserRole.ADMIN: ["*"],
    }
    role_info = {
        UserRole.DECLARANT: {
            "id": "1",
            "username": "declarant001",
            "name": "张申报员",
            "email": "zhang@company.com",
            "role": UserRole.DECLARANT,
            "enterprise_name": "杭州跨境贸易有限公司"
        },
        UserRole.REVIEWER: {
            "id": "2",
            "username": "reviewer001",
            "name": "李审核员",
            "email": "li@service.gov.cn",
            "role": UserRole.REVIEWER,
            "enterprise_name": None
        },
        UserRole.ADMIN: {
            "id": "3",
            "username": "admin001",
            "name": "王管理员",
            "email": "wang@service.gov.cn",
            "role": UserRole.ADMIN,
            "enterprise_name": None
        }
    }
    info = role_info[role]
    return User(
        id=info["id"],
        username=info["username"],
        password_hash="",
        name=info["name"],
        email=info["email"],
        role=info["role"],
        enterprise_name=info["enterprise_name"],
        permissions=role_permissions[role],
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )


@router.post("/login", response_model=ApiResponse[LoginResponse])
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = _mock_user(UserRole.DECLARANT)
    token = f"mock_token_{uuid.uuid4().hex}"
    user.last_login_at = datetime.utcnow()
    return ApiResponse.ok(LoginResponse(token=token, user=user))


@router.get("/me", response_model=ApiResponse[UserSchema])
def get_current_user(db: Session = Depends(get_db)):
    user = _mock_user(UserRole.DECLARANT)
    return ApiResponse.ok(user)

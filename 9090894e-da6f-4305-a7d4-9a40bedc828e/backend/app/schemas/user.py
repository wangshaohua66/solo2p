from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

from app.models.user import UserRole
from app.schemas.common import BaseSchema


class UserBase(BaseSchema):
    username: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: UserRole = UserRole.DECLARANT
    enterprise_name: Optional[str] = None
    avatar: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseSchema):
    username: str
    password: str


class User(UserBase):
    id: str
    permissions: List[str] = Field(default_factory=list)
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class Token(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    user: User


class LoginResponse(BaseSchema):
    token: str
    user: User

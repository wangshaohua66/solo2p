from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import declaration, hscode, tax, dashboard, customs, policy, auth

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="跨境电商综合试验区运营服务中心API",
    version="1.0.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["认证"])
app.include_router(declaration.router, prefix="/declarations", tags=["申报清单"])
app.include_router(hscode.router, prefix="/hscodes", tags=["HS编码"])
app.include_router(tax.router, prefix="/tax", tags=["出口退税"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["数据看板"])
app.include_router(customs.router, prefix="/customs", tags=["通关异常"])
app.include_router(policy.router, prefix="/policies", tags=["政策法规"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}


@app.get("/")
async def root():
    return {"message": "欢迎使用跨境电商综合试验区运营服务中心API", "version": "1.0.0"}

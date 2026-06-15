"""
铁路集装箱中心站 - 跨系统自动化录入平台

模块架构:
    screen_capture      - 区域截屏与图像预处理
    template_matcher    - OpenCV模板匹配识别箱位图标与状态颜色
    text_extractor      - 箱号区域截取、OCR识别与校验位验证
    action_executor     - PyAutoGUI窗口切换、鼠标定位与键盘录入
    workflow_orchestrator - 跨系统流程编排、状态机管理与异常恢复
    main                - 入口，加载配置启动定时任务

数据流:
    定时截屏 → 模板匹配定位 → OCR提取箱号 → 状态判断作业类型
    → 跨系统自动录入 → 回读校验 → 日志截图归档
"""

__version__ = "1.0.0"
__author__ = "Container Automation Platform"

__all__ = [
    "ScreenCapture",
    "TemplateMatcher",
    "MatchResult",
    "YardGrid",
    "TextExtractor",
    "OcrResult",
    "ActionExecutor",
    "ActionResult",
    "ActionStatus",
    "RetryStrategy",
    "WorkflowOrchestrator",
    "WorkflowState",
    "WorkflowEvent",
    "ContainerJob",
    "WorkflowStats",
]

from .screen_capture import ScreenCapture
from .template_matcher import TemplateMatcher, MatchResult, YardGrid
from .text_extractor import TextExtractor, OcrResult
from .action_executor import ActionExecutor, ActionResult, ActionStatus, RetryStrategy
from .workflow_orchestrator import (
    WorkflowOrchestrator, WorkflowState, WorkflowEvent,
    ContainerJob, WorkflowStats
)

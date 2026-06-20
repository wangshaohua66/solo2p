from datetime import date, datetime
from enum import Enum
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, field_validator, model_validator


class ProjectPhase(str, Enum):
    PROSPECTING = "prospecting"
    EXCAVATION = "excavation"
    SAMPLING = "sampling"
    PROCESSING = "processing"
    REPORT = "report"

    @classmethod
    def get_phase_name(cls, phase: "ProjectPhase") -> str:
        names = {
            cls.PROSPECTING: "勘探立项",
            cls.EXCAVATION: "布方发掘",
            cls.SAMPLING: "采样送检",
            cls.PROCESSING: "资料整理",
            cls.REPORT: "报告编写",
        }
        return names.get(phase, phase.value)

    @classmethod
    def get_phase_checklist(cls, phase: "ProjectPhase") -> List[str]:
        checklists = {
            cls.PROSPECTING: [
                "遗址勘探报告",
                "发掘面积确认",
                "经费预算审批",
                "领队人员确定",
            ],
            cls.EXCAVATION: [
                "探方布设完成",
                "发掘日志记录",
                "出土遗物登记",
                "层位关系记录",
            ],
            cls.SAMPLING: [
                "采样标本登记",
                "送检机构确认",
                "标本送检出库",
                "送检回执存档",
            ],
            cls.PROCESSING: [
                "遗物修复完成",
                "照片整理归档",
                "层位关系梳理",
                "资料分类编号",
            ],
            cls.REPORT: [
                "发掘简报完成",
                "器物登记表完成",
                "遗迹登记表完成",
                "平面图绘制完成",
            ],
        }
        return checklists.get(phase, [])


class ProjectStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SUSPENDED = "suspended"

    @classmethod
    def get_status_name(cls, status) -> str:
        names = {
            cls.NOT_STARTED.value: "未开始",
            cls.IN_PROGRESS.value: "进行中",
            cls.COMPLETED.value: "已完成",
            cls.SUSPENDED.value: "已暂停",
        }
        if isinstance(status, cls):
            status_val = status.value
        else:
            status_val = status
        return names.get(status_val, str(status))


class Project(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=50)
    site_name: str = Field(..., min_length=1, max_length=200)
    site_code: str = Field(..., min_length=1, max_length=50)
    phase: ProjectPhase = ProjectPhase.PROSPECTING
    status: ProjectStatus = ProjectStatus.NOT_STARTED
    leader: str = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    area: float = 0.0
    budget: float = 0.0
    description: str = ""
    phase_checklist: Dict[str, bool] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("area", "budget")
    @classmethod
    def non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("不能为负数")
        return v

    def get_checklist_status(self) -> Dict[str, bool]:
        checklist = ProjectPhase.get_phase_checklist(self.phase)
        result = {}
        for item in checklist:
            result[item] = self.phase_checklist.get(item, False)
        return result

    def can_advance_phase(self) -> bool:
        checklist = self.get_checklist_status()
        return all(checklist.values()) if checklist else True


class Stratum(BaseModel):
    id: Optional[int] = None
    trench_id: int
    layer_number: str = Field(..., min_length=1, max_length=20)
    depth_top: float = 0.0
    depth_bottom: float = 0.0
    soil_color: str = ""
    soil_texture: str = ""
    inclusions: str = ""
    description: str = ""
    parent_id: Optional[int] = None
    order_index: int = 0
    created_at: Optional[datetime] = None

    @field_validator("depth_top", "depth_bottom")
    @classmethod
    def non_negative_depth(cls, v: float) -> float:
        if v < 0:
            raise ValueError("深度不能为负")
        return v


class Trench(BaseModel):
    id: Optional[int] = None
    project_id: int
    code: str = Field(..., min_length=1, max_length=50)
    grid_row: int = 0
    grid_col: int = 0
    x_coordinate: float = 0.0
    y_coordinate: float = 0.0
    length: float = 0.0
    width: float = 0.0
    depth: float = 0.0
    status: str = "not_started"
    description: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ArtifactCategory(str, Enum):
    POTTERY = "pottery"
    STONE = "stone"
    BRONZE = "bronze"
    JADE = "jade"
    BONE = "bone"
    OTHER = "other"

    @classmethod
    def get_category_name(cls, cat: "ArtifactCategory") -> str:
        names = {
            cls.POTTERY: "陶器",
            cls.STONE: "石器",
            cls.BRONZE: "铜器",
            cls.JADE: "玉器",
            cls.BONE: "骨器",
            cls.OTHER: "其他",
        }
        return names.get(cat, cat.value)


class Artifact(BaseModel):
    id: Optional[int] = None
    project_id: int
    code: str = Field(..., min_length=1, max_length=100)
    category: ArtifactCategory = ArtifactCategory.OTHER
    trench_id: Optional[int] = None
    stratum_id: Optional[int] = None
    layer: str = ""
    name: str = ""
    description: str = ""
    quantity: int = 1
    photo_count: int = 0
    storage_location: str = ""
    discovered_by: str = ""
    discovery_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ArtifactPhoto(BaseModel):
    id: Optional[int] = None
    artifact_id: int
    file_path: str = ""
    file_name: str = ""
    thumbnail_path: str = ""
    photo_time: Optional[datetime] = None
    gps_latitude: Optional[float] = None
    gps_longitude: Optional[float] = None
    is_matched: bool = False
    needs_review: bool = False
    created_at: Optional[datetime] = None


class SampleType(str, Enum):
    CARBON_14 = "carbon_14"
    POLLEN = "pollen"
    PHYTOLITH = "phytolith"
    DNA = "dna"
    OTHER = "other"

    @classmethod
    def get_type_name(cls, st: "SampleType") -> str:
        names = {
            cls.CARBON_14: "碳十四",
            cls.POLLEN: "孢粉",
            cls.PHYTOLITH: "植硅体",
            cls.DNA: "DNA",
            cls.OTHER: "其他",
        }
        return names.get(st, st.value)

    @classmethod
    def get_test_days(cls, st: "SampleType") -> int:
        days = {
            cls.CARBON_14: 30,
            cls.POLLEN: 15,
            cls.PHYTOLITH: 20,
            cls.DNA: 60,
            cls.OTHER: 30,
        }
        return days.get(st, 30)


class SampleStatus(str, Enum):
    COLLECTED = "collected"
    SENT = "sent"
    TESTING = "testing"
    COMPLETED = "completed"
    OVERDUE = "overdue"

    @classmethod
    def get_status_name(cls, status) -> str:
        names = {
            cls.COLLECTED.value: "已采集",
            cls.SENT.value: "已送检",
            cls.TESTING.value: "检测中",
            cls.COMPLETED.value: "已完成",
            cls.OVERDUE.value: "已超期",
        }
        if isinstance(status, cls):
            status_val = status.value
        else:
            status_val = status
        return names.get(status_val, str(status))


class Sample(BaseModel):
    id: Optional[int] = None
    project_id: int
    code: str = Field(..., min_length=1, max_length=100)
    sample_type: SampleType = SampleType.OTHER
    trench_id: Optional[int] = None
    stratum_id: Optional[int] = None
    description: str = ""
    collected_by: str = ""
    collection_date: Optional[date] = None
    sent_date: Optional[date] = None
    lab_name: str = ""
    expected_days: int = 30
    status: SampleStatus = SampleStatus.COLLECTED
    result: str = ""
    result_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @model_validator(mode="after")
    def set_expected_days(self) -> "Sample":
        if self.expected_days == 30:
            self.expected_days = SampleType.get_test_days(self.sample_type)
        return self


class PersonRole(str, Enum):
    LEADER = "leader"
    TECHNICIAN = "technician"
    WORKER = "worker"
    PHOTOGRAPHER = "photographer"
    DRAFTSMAN = "draftsman"

    @classmethod
    def get_role_name(cls, role: "PersonRole") -> str:
        names = {
            cls.LEADER: "领队",
            cls.TECHNICIAN: "技术员",
            cls.WORKER: "民工",
            cls.PHOTOGRAPHER: "摄影师",
            cls.DRAFTSMAN: "绘图员",
        }
        return names.get(role, role.value)


class Person(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=50)
    role: PersonRole = PersonRole.WORKER
    skills: List[str] = Field(default_factory=list)
    phone: str = ""
    email: str = ""
    status: str = "available"
    created_at: Optional[datetime] = None


class Equipment(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=100)
    code: str = Field(..., min_length=1, max_length=50)
    category: str = ""
    status: str = "available"
    description: str = ""
    created_at: Optional[datetime] = None


class Assignment(BaseModel):
    id: Optional[int] = None
    project_id: int
    person_id: Optional[int] = None
    equipment_id: Optional[int] = None
    assignment_type: str = "person"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    role: str = ""
    notes: str = ""
    created_at: Optional[datetime] = None


class ScheduleConflict(BaseModel):
    person_id: Optional[int] = None
    equipment_id: Optional[int] = None
    name: str = ""
    type: str = "person"
    project_a: str = ""
    project_b: str = ""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    suggestion: str = ""


class BudgetItem(BaseModel):
    id: Optional[int] = None
    project_id: int
    category: str = Field(..., min_length=1, max_length=100)
    budgeted: float = 0.0
    actual: float = 0.0
    quarter: Optional[int] = None
    expenditure_date: Optional[date] = None
    notes: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @model_validator(mode="after")
    def _derive_quarter_from_date(self) -> "BudgetItem":
        if self.quarter is None and self.expenditure_date is not None:
            self.quarter = (self.expenditure_date.month - 1) // 3 + 1
        return self

    @field_validator("quarter")
    @classmethod
    def _validate_quarter(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 4):
            raise ValueError("季度必须在1-4之间")
        return v

    @property
    def execution_rate(self) -> float:
        if self.budgeted == 0:
            return 0.0
        return (self.actual / self.budgeted) * 100

    @property
    def has_deviation(self) -> bool:
        return abs(self.execution_rate - 100) > 20


class SyncRecord(BaseModel):
    id: Optional[int] = None
    sync_batch: str = ""
    table_name: str = ""
    record_id: int = 0
    operation: str = ""
    data: Dict[str, Any] = Field(default_factory=dict)
    synced: bool = False
    created_at: Optional[datetime] = None


class SyncConflict(BaseModel):
    id: Optional[int] = None
    sync_batch: str = ""
    table_name: str = ""
    record_id: int = 0
    local_data: Dict[str, Any] = Field(default_factory=dict)
    remote_data: Dict[str, Any] = Field(default_factory=dict)
    resolved: bool = False
    resolution: str = ""
    created_at: Optional[datetime] = None


class ReportData(BaseModel):
    project: Project
    trenches: List[Trench] = Field(default_factory=list)
    artifacts: List[Artifact] = Field(default_factory=list)
    samples: List[Sample] = Field(default_factory=list)
    strata: List[Stratum] = Field(default_factory=list)
    personnel: List[Person] = Field(default_factory=list)
    budget_items: List[BudgetItem] = Field(default_factory=list)
    generated_at: Optional[datetime] = None

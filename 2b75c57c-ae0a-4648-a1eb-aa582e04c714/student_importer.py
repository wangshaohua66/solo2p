import csv
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Tuple

from tqdm import tqdm

from logger import get_logger
from database import DatabaseManager


logger = get_logger("importer")

REQUIRED_FIELDS = ["student_id", "name"]
OPTIONAL_FIELDS = [
    "gender", "university", "major", "education",
    "phone", "email", "target_industry", "target_position",
    "target_salary_min", "resume_path",
]
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS

FIELD_MAPPINGS = {
    "学号": "student_id", "id": "student_id", "studentid": "student_id",
    "姓名": "name", "名字": "name",
    "性别": "gender", "sex": "gender",
    "学校": "university", "院校": "university", "university": "university",
    "专业": "major",
    "学历": "education", "degree": "education",
    "电话": "phone", "手机": "phone", "telephone": "phone", "mobile": "phone",
    "邮箱": "email", "电子邮件": "email", "e-mail": "email",
    "意向行业": "target_industry", "目标行业": "target_industry",
    "意向岗位": "target_position", "目标岗位": "target_position", "求职意向": "target_position",
    "期望薪资": "target_salary_min", "薪资期望": "target_salary_min", "最低薪资": "target_salary_min",
    "简历路径": "resume_path", "简历": "resume_path", "resume": "resume_path",
}


class StudentImporter:
    def __init__(self):
        self.db = DatabaseManager()

    def _normalize_field_name(self, field: str) -> str:
        key = field.strip().lower().replace("_", "").replace("-", "").replace(" ", "")
        for display, internal in FIELD_MAPPINGS.items():
            if display.lower().replace(" ", "") == key:
                return internal
        if field.strip() in ALL_FIELDS:
            return field.strip()
        return field.strip()

    def _validate_student(self, student: Dict[str, Any], index: int) -> Tuple[bool, List[str]]:
        errors = []
        for field in REQUIRED_FIELDS:
            if not student.get(field):
                errors.append(f"缺少必填字段: {field}")

        if student.get("email"):
            email = student["email"].strip()
            if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
                errors.append(f"邮箱格式错误: {email}")

        if student.get("phone"):
            phone = student["phone"].strip()
            if not re.match(r"^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$", phone):
                errors.append(f"电话格式可疑: {phone}")

        if student.get("target_salary_min"):
            try:
                val = int(str(student["target_salary_min"]).replace(",", ""))
                student["target_salary_min"] = val
            except (ValueError, TypeError):
                errors.append(f"薪资格式错误: {student['target_salary_min']}")

        if student.get("gender") and student["gender"] not in ("男", "女", "male", "female", "M", "F"):
            errors.append(f"性别值不规范: {student['gender']}")

        if student.get("resume_path"):
            path = student["resume_path"].strip()
            if not Path(path).exists():
                errors.append(f"简历文件不存在: {path}")

        return len(errors) == 0, errors

    def _clean_student(self, student: Dict[str, Any]) -> Dict[str, Any]:
        cleaned = {}
        for k, v in student.items():
            if v is None:
                cleaned[k] = ""
            elif isinstance(v, str):
                cleaned[k] = v.strip()
            else:
                cleaned[k] = v

        if cleaned.get("gender"):
            g = cleaned["gender"].lower()
            if g in ("m", "male", "男"):
                cleaned["gender"] = "男"
            elif g in ("f", "female", "女"):
                cleaned["gender"] = "女"

        if cleaned.get("target_salary_min"):
            try:
                cleaned["target_salary_min"] = int(
                    str(cleaned["target_salary_min"]).replace(",", "")
                )
            except (ValueError, TypeError):
                cleaned["target_salary_min"] = 0
        else:
            cleaned["target_salary_min"] = 0

        if not cleaned.get("student_id"):
            import hashlib
            raw = f"{cleaned.get('name', '')}|{cleaned.get('phone', '')}|{cleaned.get('email', '')}"
            cleaned["student_id"] = hashlib.md5(raw.encode()).hexdigest()[:12]

        return cleaned

    def import_from_csv(self, file_path: str, skip_errors: bool = False,
                        show_progress: bool = True) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        students: List[Dict[str, Any]] = []
        all_errors: List[Dict[str, Any]] = []

        try:
            with open(path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                if not reader.fieldnames:
                    raise ValueError("CSV文件为空或缺少表头")

                normalized_fields = {}
                for field in reader.fieldnames:
                    normalized = self._normalize_field_name(field)
                    normalized_fields[field] = normalized

                logger.info(f"CSV字段: {reader.fieldnames}")
                logger.info(f"映射后字段: {list(normalized_fields.values())}")

                for idx, row in enumerate(reader, 1):
                    student = {}
                    for original_field, norm_field in normalized_fields.items():
                        student[norm_field] = row.get(original_field, "")
                    students.append((idx, student))
        except UnicodeDecodeError:
            with open(path, "r", encoding="gbk") as f:
                reader = csv.DictReader(f)
                normalized_fields = {}
                for field in reader.fieldnames or []:
                    normalized = self._normalize_field_name(field)
                    normalized_fields[field] = normalized
                for idx, row in enumerate(reader, 1):
                    student = {}
                    for original_field, norm_field in normalized_fields.items():
                        student[norm_field] = row.get(original_field, "")
                    students.append((idx, student))

        return self._process_import(students, skip_errors, show_progress, source="CSV")

    def import_from_json(self, file_path: str, skip_errors: bool = False,
                         show_progress: bool = True) -> Dict[str, Any]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            data = [data]
        if not isinstance(data, list):
            raise ValueError("JSON必须是数组或对象")

        students = []
        for idx, item in enumerate(data, 1):
            student = {}
            for k, v in item.items():
                norm = self._normalize_field_name(k)
                student[norm] = v
            students.append((idx, student))

        return self._process_import(students, skip_errors, show_progress, source="JSON")

    def _process_import(self, students: List[Tuple[int, Dict[str, Any]]],
                        skip_errors: bool, show_progress: bool,
                        source: str) -> Dict[str, Any]:
        success_count = 0
        error_count = 0
        skipped = 0
        errors_detail: List[Dict[str, Any]] = []
        imported_ids: List[str] = []

        iterator = tqdm(students, desc=f"导入{source}数据", disable=not show_progress)

        for idx, student in iterator:
            try:
                cleaned = self._clean_student(student)
                is_valid, errs = self._validate_student(cleaned, idx)

                if not is_valid:
                    error_count += 1
                    errors_detail.append({"row": idx, "errors": errs, "data": student})
                    if skip_errors:
                        skipped += 1
                        continue
                    else:
                        logger.warning(f"第{idx}行验证失败: {'; '.join(errs)}")

                self.db.upsert_student(cleaned)
                success_count += 1
                imported_ids.append(cleaned.get("student_id", ""))
            except Exception as e:
                error_count += 1
                errors_detail.append({"row": idx, "errors": [str(e)], "data": student})
                logger.error(f"第{idx}行导入异常: {e}")
                if not skip_errors:
                    raise

        result = {
            "total": len(students),
            "success": success_count,
            "errors": error_count,
            "skipped": skipped,
            "error_details": errors_detail,
            "imported_ids": imported_ids,
        }

        logger.info(
            f"{source}导入完成: 共{len(students)}条, "
            f"成功{success_count}, 失败{error_count}, 跳过{skipped}"
        )
        return result

    def import_file(self, file_path: str, skip_errors: bool = False,
                    show_progress: bool = True) -> Dict[str, Any]:
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix == ".csv":
            return self.import_from_csv(file_path, skip_errors, show_progress)
        elif suffix in (".json", ".jsonl"):
            return self.import_from_json(file_path, skip_errors, show_progress)
        else:
            raise ValueError(f"不支持的文件格式: {suffix} (支持 .csv / .json)")

    def get_template_csv(self, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        headers = ALL_FIELDS
        sample_row = {
            "student_id": "stu001",
            "name": "张三",
            "gender": "男",
            "university": "省大学",
            "major": "计算机科学与技术",
            "education": "本科",
            "phone": "13800138000",
            "email": "zhangsan@example.com",
            "target_industry": "互联网、金融、教育",
            "target_position": "软件开发、算法工程师、数据分析师",
            "target_salary_min": "8000",
            "resume_path": "/path/to/resume.pdf",
        }

        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerow(sample_row)

        logger.info(f"模板已生成: {path}")
        return str(path)

    def list_students(self, limit: int = 100) -> List[Dict[str, Any]]:
        rows = self.db.query_all(
            "SELECT * FROM students ORDER BY create_time DESC LIMIT ?",
            (limit,)
        )
        return [dict(r) for r in rows]

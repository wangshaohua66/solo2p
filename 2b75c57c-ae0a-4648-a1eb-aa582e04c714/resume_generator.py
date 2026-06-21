import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)

from logger import get_logger
from config import BASE_DIR


logger = get_logger("resume")
RESUME_DIR = BASE_DIR / "data" / "resumes"
RESUME_DIR.mkdir(parents=True, exist_ok=True)


def _cn_styles() -> Dict[str, ParagraphStyle]:
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "CNTitle", parent=styles["Title"], fontSize=20, leading=28,
            textColor=colors.HexColor("#1a1a2e"), spaceAfter=12,
            fontName="Helvetica-Bold"
        ),
        "h2": ParagraphStyle(
            "CNH2", parent=styles["Heading2"], fontSize=14, leading=20,
            textColor=colors.HexColor("#16213e"), spaceBefore=12, spaceAfter=8,
            fontName="Helvetica-Bold"
        ),
        "body": ParagraphStyle(
            "CNBody", parent=styles["BodyText"], fontSize=11, leading=18,
            textColor=colors.HexColor("#333333"),
            fontName="Helvetica"
        ),
        "small": ParagraphStyle(
            "CNSmall", parent=styles["BodyText"], fontSize=10, leading=16,
            textColor=colors.HexColor("#555555"),
            fontName="Helvetica"
        ),
    }


def _section_header(text: str, styles) -> List:
    return [
        Paragraph(text, styles["h2"]),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e94560"), spaceAfter=6),
    ]


def generate_resume_pdf(student: Dict[str, Any], output_path: Optional[str] = None) -> str:
    sid = student.get("student_id") or hashlib.md5(student.get("name", "").encode()).hexdigest()[:8]
    if not output_path:
        output_path = str(RESUME_DIR / f"resume_{sid}_{datetime.now().strftime('%Y%m%d')}.pdf")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    styles = _cn_styles()

    doc = SimpleDocTemplate(
        output_path, pagesize=A4,
        leftMargin=2 * cm, rightMargin=2 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm
    )

    story = []

    story.append(Paragraph(student.get("name", "简历"), styles["title"]))

    contact_parts = []
    if student.get("phone"):
        contact_parts.append(f"电话: {student['phone']}")
    if student.get("email"):
        contact_parts.append(f"邮箱: {student['email']}")
    if student.get("gender"):
        contact_parts.append(f"性别: {student['gender']}")
    if contact_parts:
        story.append(Paragraph(" | ".join(contact_parts), styles["small"]))
    story.append(Spacer(1, 6))

    edu_parts = []
    if student.get("university"):
        edu_parts.append(student["university"])
    if student.get("major"):
        edu_parts.append(student["major"])
    if student.get("education"):
        edu_parts.append(student["education"])
    if edu_parts:
        info_data = [["教育背景", " - ".join(edu_parts)]]
        if student.get("target_position"):
            info_data.append(["求职意向", student["target_position"]])
        if student.get("target_industry"):
            info_data.append(["意向行业", student["target_industry"]])
        if student.get("target_salary_min"):
            info_data.append(["期望薪资", f"{student['target_salary_min']} 元/月以上"])
        info_table = Table(info_data, colWidths=[3 * cm, 13 * cm])
        info_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#e94560")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LINEBELOW", (0, 0), (-1, -2), 0.4, colors.HexColor("#eeeeee")),
        ]))
        story.append(info_table)

    story.extend(_section_header("个人简介", styles))
    desc = (
        f"{student.get('education', '')} {student.get('major', '')}专业应届毕业生，"
        f"意向{student.get('target_industry', '')}行业{student.get('target_position', '')}方向岗位。"
        f"具备扎实的专业基础，学习能力强，具有良好的团队协作精神与沟通能力。"
    )
    story.append(Paragraph(desc, styles["body"]))

    story.extend(_section_header("专业技能", styles))
    story.append(Paragraph(
        "• 掌握本专业核心理论知识，具备独立分析与解决问题的能力<br/>"
        "• 熟练使用 Office 办公软件及相关专业工具<br/>"
        "• 具有良好的中英文阅读与写作能力<br/>"
        "• 学习能力强，能够快速适应新环境与新业务",
        styles["body"]
    ))

    story.extend(_section_header("实践经历", styles))
    story.append(Paragraph(
        "• 在校期间积极参与各类专业实践活动与学科竞赛，成绩优异<br/>"
        "• 曾于相关企业完成实习，积累了一定的行业认知与工作经验<br/>"
        "• 担任学生干部，组织过多项校园活动，具备良好的组织协调能力",
        styles["body"]
    ))

    story.extend(_section_header("获奖情况", styles))
    story.append(Paragraph(
        "• 多次获得校级奖学金<br/>"
        "• 校级优秀毕业生 / 三好学生<br/>"
        "• 学科竞赛奖项若干",
        styles["body"]
    ))

    doc.build(story)
    logger.info(f"简历已生成: {output_path}")
    return output_path


def generate_batch_resumes(students: List[Dict[str, Any]]) -> List[str]:
    paths = []
    for stu in students:
        try:
            p = generate_resume_pdf(stu)
            stu["resume_path"] = p
            paths.append(p)
        except Exception as e:
            logger.error(f"生成简历失败 {stu.get('name')}: {e}")
    logger.info(f"批量生成简历完成: {len(paths)}/{len(students)}")
    return paths

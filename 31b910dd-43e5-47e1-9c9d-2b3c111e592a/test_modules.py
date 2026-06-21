import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_test_data():
    test_dir = Path("/tmp/ctd_test_data")
    test_dir.mkdir(exist_ok=True, parents=True)

    (test_dir / "Module1").mkdir(exist_ok=True)
    (test_dir / "Module2").mkdir(exist_ok=True)
    (test_dir / "Module2" / "2.3").mkdir(exist_ok=True)
    (test_dir / "Module3").mkdir(exist_ok=True)
    (test_dir / "Module3" / "3.2.S").mkdir(exist_ok=True)
    (test_dir / "Module4").mkdir(exist_ok=True)
    (test_dir / "Module5").mkdir(exist_ok=True)
    (test_dir / "Extra_Folder").mkdir(exist_ok=True)

    (test_dir / "Module1" / "M1-001-申报目录.pdf").write_bytes(b"%PDF-1.4 test")
    (test_dir / "Module2" / "M2-001-综述资料.pdf").write_bytes(b"%PDF-1.4 test")
    (test_dir / "Module2/2.3" / "M2.3-001-质量标准.docx").write_bytes(b"PK test")
    (test_dir / "Module3/3.2.S" / "M3.2.S-001-原料药生产工艺.pdf").write_bytes(b"%PDF-1.4 test")
    (test_dir / "Module3" / "bad_name.txt").write_text("invalid file")
    (test_dir / "Module4" / "M4-001-药理毒理.pdf").write_bytes(b"%PDF-1.4 test")
    (test_dir / "Module5" / "M5-001-临床研究.pdf").write_bytes(b"%PDF-1.4 test")

    print(f"测试数据已创建在: {test_dir}")
    for f in test_dir.rglob("*"):
        print(f"  {f.relative_to(test_dir)}")
    return test_dir

def test_config():
    from config import CTD_MODULES, DRUG_TYPE_CONFIG, ISSUE_SEVERITY
    print("\n=== 配置模块测试 ===")
    print(f"CTD模块数量: {len(CTD_MODULES)}")
    print(f"药品类型: {[v['label'] for v in DRUG_TYPE_CONFIG.values()]}")
    print(f"问题严重程度: {[v['label'] for v in ISSUE_SEVERITY.values()]}")
    print("配置模块: PASS")

def test_logger():
    from logger import logger
    print("\n=== 日志模块测试 ===")
    logger.info("测试INFO日志")
    logger.warning("测试WARNING日志")
    logger.debug("测试DEBUG日志")
    print("日志模块: PASS")

def test_database():
    from database import DatabaseManager
    print("\n=== 数据库模块测试 ===")
    db = DatabaseManager()
    pid = db.create_project(
        project_name="测试项目",
        drug_type="chemical",
        folder_path="/tmp/test",
        applicant="测试公司",
        priority="NORMAL",
        total_files=10,
        total_size_mb=5.0,
    )
    print(f"创建项目 ID={pid}")
    project = db.get_project(pid)
    print(f"查询项目: {project['project_name'] if project else 'NOT FOUND'}")
    db.insert_issues(pid, [
        {"module": "ctd_structure", "severity": "FATAL", "issue_type": "TEST",
         "description": "测试问题", "file_path": "/tmp/test/file.pdf",
         "suggestion": "测试建议", "is_common": False, "matched_issue_id": None}
    ])
    issues = db.get_project_issues(pid)
    print(f"问题数量: {len(issues)}")
    db.update_common_issue("TEST_TYPE", "DEFECT", "测试描述", "测试建议")
    common = db.get_common_issue_stats(5)
    print(f"常见问题库条数: {len(common)}")
    db.update_module_progress(pid, "ctd_structure", "PASS", 0)
    progress = db.get_module_progress(pid)
    print(f"模块进度记录: {len(progress)}")
    projects = db.list_projects(limit=5)
    print(f"项目列表: {len(projects)} 条")
    print("数据库模块: PASS")

def test_validator(test_dir):
    from ctd_validator import CTDValidator
    print("\n=== CTD结构校验模块测试 ===")
    validator = CTDValidator(str(test_dir), "chemical")
    validator.scan_directory()
    print(f"扫描到文件数: {len(validator.all_files)}")
    issues, stats = validator.validate_structure()
    print(f"结构问题数: {len(issues)}")
    for issue in issues[:3]:
        print(f"  [{issue.severity}] {issue.description[:60]}")
    print(f"统计信息: 模块 {stats['modules_found']}")
    validator.print_diff_tree()
    files_by_module = validator.get_files_by_module()
    print(f"按模块分布: {[(k, len(v)) for k, v in files_by_module.items()]}")
    print("CTD结构校验模块: PASS")

def test_classifier():
    from issue_classifier import IssueClassifier, ClassifiedIssue
    from ctd_validator import StructureIssue
    print("\n=== 问题分类模块测试 ===")
    classifier = IssueClassifier()
    test_issues = [
        StructureIssue(
            issue_type="MISSING_MODULE", module="ctd_structure",
            severity="FATAL", description="缺失模块Module3",
        ),
        StructureIssue(
            issue_type="INVALID_FILENAME", module="file_naming",
            severity="DEFECT", description="文件名不规范 xxx.pdf",
        ),
    ]
    stats = classifier.classify_all(test_issues)
    print(f"分类问题数: {stats['total']}")
    print(f"综合评分: {stats['overall_score']}")
    print(f"审查建议: {stats['recommendation']}")
    print(f"按严重程度: {dict(stats['by_severity'])}")
    classifier.print_summary()
    print("问题分类模块: PASS")

def test_report():
    from report_generator import ReportGenerator
    from issue_classifier import IssueClassifier, ClassifiedIssue
    from ctd_validator import StructureIssue
    print("\n=== 报告生成模块测试 ===")
    issues = [
        StructureIssue(
            issue_type="MISSING_MODULE", module="ctd_structure",
            severity="FATAL", description="缺失必填模块Module3 - 药学研究资料",
            file_path="/tmp/test", suggestion="请补充Module3模块目录及其申报资料",
        ),
        StructureIssue(
            issue_type="INVALID_FILENAME", module="file_naming",
            severity="DEFECT", description="文件名不符合CTD命名规范: bad_name.txt",
            file_path="/tmp/test/bad_name.txt", suggestion="请按化学药格式修正文件名",
        ),
    ]
    classifier = IssueClassifier()
    stats = classifier.classify_all(issues)
    reporter = ReportGenerator("测试项目_ReportTest")
    paths = reporter.generate_reports(
        classifier.classified_issues, stats,
        {"project_name": "测试项目_ReportTest", "drug_type": "chemical",
         "applicant": "测试公司", "folder_path": "/tmp/test",
         "total_files": 10, "total_size_mb": 5.0},
        structure_diff=["= CTD结构差异 =", "✓ Module1: 申报资料目录", "✗ Module3: 药学研究资料"],
    )
    for fmt, path in paths.items():
        exists = "✓" if path.exists() else "✗"
        size = path.stat().st_size if path.exists() else 0
        print(f"  {exists} {fmt.upper():>5}: {path} ({size} bytes)")
    print("报告生成模块: PASS")

def main():
    print("=" * 60)
    print("CTD申报资料智能审查系统 - 模块测试")
    print("=" * 60)

    try:
        test_config()
        test_logger()
        test_database()
        test_dir = create_test_data()
        test_validator(test_dir)
        test_classifier()
        test_report()

        print("\n" + "=" * 60)
        print("所有模块测试完成 ✓")
        print("=" * 60)
        return 0
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n测试失败: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())

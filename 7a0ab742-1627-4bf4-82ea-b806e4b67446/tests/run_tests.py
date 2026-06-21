import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from archiver.logger import get_logger
from archiver.validator import ArchiveValidator, ValidationConfig, ValidationSeverity
from archiver.converter import FormatConverter
from archiver.renamer import ArchiveRenamer, ArchiveNumberConfig
from archiver.scanner import ImageQualityScanner, ScannerConfig
from archiver.reporter import ReportGenerator
from PIL import Image


def create_test_images(output_dir):
    os.makedirs(output_dir, exist_ok=True)

    img1 = Image.new("RGB", (2480, 3508), color="white")
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(img1)
    for i in range(20):
        draw.text((100, 100 + i * 50), f"这是第 {i+1} 行测试文字，用于检测图像内容", fill="black")
    img1.save(os.path.join(output_dir, "test_300dpi.jpg"), dpi=(300, 300), quality=95)

    img2 = Image.new("RGB", (800, 1131), color="white")
    draw2 = ImageDraw.Draw(img2)
    draw2.text((50, 50), "低分辨率测试图", fill="black")
    img2.save(os.path.join(output_dir, "test_low_dpi.jpg"), dpi=(96, 96), quality=95)

    img3 = Image.new("RGB", (2480, 3508), color="white")
    img3.save(os.path.join(output_dir, "test_blank.jpg"), dpi=(300, 300), quality=95)

    img4 = Image.new("L", (2480, 3508), color=255)
    draw4 = ImageDraw.Draw(img4)
    for i in range(15):
        draw4.text((100, 100 + i * 60), f"灰度模式测试文档 第{i+1}行", fill=0)
    img4.save(os.path.join(output_dir, "test_grayscale.tiff"), dpi=(300, 300))

    print(f"测试图像已生成到: {output_dir}")
    return output_dir


def test_logger():
    print("\n" + "="*60)
    print("测试 1: 日志模块")
    print("="*60)

    logger = get_logger(log_dir="test_logs", log_level="DEBUG")
    logger.debug("这是一条调试信息")
    logger.info("这是一条信息", operation_type="test", obj="test_obj")
    logger.warning("这是一条警告")
    logger.error("这是一条错误")

    with logger.log_timing("test_operation", "test_object"):
        import time
        time.sleep(0.1)

    print("✓ 日志模块测试完成")


def test_validator():
    print("\n" + "="*60)
    print("测试 2: 校验引擎")
    print("="*60)

    config = ValidationConfig()
    validator = ArchiveValidator(config)

    valid_archive = {
        "archive_number": "DA-01-001-0001",
        "title": "测试档案",
        "author": "测试单位",
        "created_date": "2024-01-15",
        "archived_date": "2024-02-01",
        "retention_period": "30年",
        "secrecy_level": "内部",
        "file_name": "test.pdf",
        "file_size": "102400",
    }

    result = validator.validate_archive(valid_archive)
    print(f"有效档案校验: {'通过' if result.passed else '未通过'}")
    print(f"  问题数: {len(result.issues)}")

    invalid_archive = {
        "title": "",
        "created_date": "2024/01/15",
        "archive_number": "invalid",
        "retention_period": "100年",
    }

    result2 = validator.validate_archive(invalid_archive)
    print(f"无效档案校验: {'通过' if result2.passed else '未通过'}")
    print(f"  错误数: {len([i for i in result2.issues if i.severity == ValidationSeverity.ERROR])}")
    print(f"  警告数: {len([i for i in result2.issues if i.severity == ValidationSeverity.WARNING])}")
    for issue in result2.issues:
        print(f"    - [{issue.severity.value}] {issue.field}: {issue.message}")

    print("✓ 校验引擎测试完成")


def test_converter():
    print("\n" + "="*60)
    print("测试 3: 格式转换器")
    print("="*60)

    converter = FormatConverter()

    csv_path = "samples/archives.csv"
    if os.path.exists(csv_path):
        archives = converter.parse(csv_path)
        print(f"CSV 解析: {len(archives)} 条记录")
        if archives:
            print(f"  第一条: {archives[0].get('title', '')}")

    xml_path = "samples/archives.xml"
    if os.path.exists(xml_path):
        archives2 = converter.parse(xml_path)
        print(f"XML 解析: {len(archives2)} 条记录")
        if archives2:
            print(f"  第一条: {archives2[0].get('title', '')}")

    test_output = "test_output"
    os.makedirs(test_output, exist_ok=True)

    if os.path.exists(csv_path):
        archives = converter.parse(csv_path)

        xml_out = os.path.join(test_output, "test_output.xml")
        converter.to_dat46_xml(archives, xml_out)
        print(f"→ 生成 XML: {xml_out}")

        excel_out = os.path.join(test_output, "test_output.xlsx")
        converter.to_excel(archives, excel_out)
        print(f"→ 生成 Excel: {excel_out}")

        json_out = os.path.join(test_output, "test_output.json")
        converter.to_json(archives, json_out)
        print(f"→ 生成 JSON: {json_out}")

    print("✓ 格式转换器测试完成")


def test_renamer():
    print("\n" + "="*60)
    print("测试 4: 档号重命名")
    print("="*60)

    config = ArchiveNumberConfig(
        fonds_number="TEST",
        directory_number="01",
        volume_number="001",
        item_number_digits=4,
        separator="-",
        start_item=1,
    )
    renamer = ArchiveRenamer(config)

    test_number = "TEST-01-001-0001"
    is_valid, error = renamer.validate_archive_number(test_number)
    print(f"档号校验 '{test_number}': {'有效' if is_valid else f'无效 - {error}'}")

    invalid_number = "invalid-number"
    is_valid2, error2 = renamer.validate_archive_number(invalid_number)
    print(f"档号校验 '{invalid_number}': {'有效' if is_valid2 else f'无效 - {error2}'}")

    generated = renamer.generate_archive_number(15)
    print(f"生成档号 #15: {generated}")

    archives = [
        {"title": "档案1", "file_name": "file1.pdf"},
        {"title": "档案2", "file_name": "file2.docx"},
        {"title": "档案3", "file_name": "file3.xlsx"},
    ]
    updated, _ = renamer.rename_archives(archives)
    print(f"批量编制档号: {len(updated)} 件")
    for a in updated:
        print(f"  - {a['title']}: {a['archive_number']} -> {a['file_name']}")

    print("✓ 档号重命名测试完成")


def test_scanner():
    print("\n" + "="*60)
    print("测试 5: 扫描件质检")
    print("="*60)

    img_dir = "test_images"
    create_test_images(img_dir)

    config = ScannerConfig(
        min_dpi=300,
        max_tilt_degrees=5.0,
        blank_page_threshold=0.05,
    )
    scanner = ImageQualityScanner(config)

    results = scanner.scan_directory(img_dir)
    print(f"扫描文件: {len(results)} 页")

    summary = scanner.get_summary(results)
    print(f"总页数: {summary['total_pages']}")
    print(f"通过: {summary['passed']}")
    print(f"警告: {summary['warnings']}")
    print(f"不合格: {summary['failed']}")
    print(f"合格率: {summary['pass_rate']}%")
    print(f"平均 DPI: {summary['average_dpi']}")
    print(f"空白页: {summary['blank_pages']}")

    for r in results[:3]:
        print(f"\n  {os.path.basename(r.file_path)}:")
        print(f"    分辨率: {r.dpi:.0f} dpi")
        print(f"    尺寸: {r.width}x{r.height}")
        print(f"    色彩: {r.color_mode}")
        print(f"    内容占比: {r.content_ratio*100:.1f}%")
        print(f"    结果: {r.overall.value}")

    print("✓ 扫描件质检测试完成")


def test_reporter():
    print("\n" + "="*60)
    print("测试 6: 报告生成器")
    print("="*60)

    reporter = ReportGenerator()
    converter = FormatConverter()
    validator = ArchiveValidator()

    csv_path = "samples/archives.csv"
    if os.path.exists(csv_path):
        archives = converter.parse(csv_path)

        validation_results = []
        for archive in archives:
            result = validator.validate_archive(archive)
            validation_results.append(result)

        list_output = "test_output/移交清单.xlsx"
        reporter.generate_transfer_list(
            archives,
            validation_results=validation_results,
            output_path=list_output,
            org_name="省档案局测试单位",
        )
        print(f"→ 生成移交清单: {list_output}")

        receipt_output = "test_output/接收回执.pdf"
        try:
            reporter.generate_receipt_pdf(
                archives,
                validation_results=validation_results,
                output_path=receipt_output,
                org_name="省档案局测试单位",
            )
            print(f"→ 生成接收回执: {receipt_output}")
        except Exception as e:
            print(f"→ PDF 回执生成提示: {str(e)}")

        print("✓ 报告生成器测试完成")


def main():
    print("数字档案管理系统 - 功能测试")
    print("=" * 60)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(base_dir)

    try:
        test_logger()
    except Exception as e:
        print(f"✗ 日志模块测试失败: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_validator()
    except Exception as e:
        print(f"✗ 校验引擎测试失败: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_converter()
    except Exception as e:
        print(f"✗ 格式转换器测试失败: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_renamer()
    except Exception as e:
        print(f"✗ 档号重命名测试失败: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_scanner()
    except Exception as e:
        print(f"✗ 扫描件质检测试失败: {e}")
        import traceback
        traceback.print_exc()

    try:
        test_reporter()
    except Exception as e:
        print(f"✗ 报告生成器测试失败: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "="*60)
    print("所有测试完成!")
    print("="*60)


if __name__ == "__main__":
    main()

import os
import re
import shutil
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple


@dataclass
class ArchiveNumberConfig:
    fonds_number: str = "DA"
    directory_number: str = "01"
    volume_number: str = "001"
    item_number_digits: int = 4
    separator: str = "-"
    start_item: int = 1


@dataclass
class RenameResult:
    original_name: str
    new_name: str
    new_archive_number: str
    success: bool
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original_name": self.original_name,
            "new_name": self.new_name,
            "new_archive_number": self.new_archive_number,
            "success": self.success,
            "error": self.error,
        }


class ArchiveRenamer:
    def __init__(self, config: Optional[ArchiveNumberConfig] = None, logger=None):
        self.config = config or ArchiveNumberConfig()
        self.logger = logger

    def parse_archive_number(self, archive_number: str) -> Optional[Dict[str, str]]:
        parts = archive_number.split(self.config.separator)
        if len(parts) == 4:
            return {
                "fonds_number": parts[0],
                "directory_number": parts[1],
                "volume_number": parts[2],
                "item_number": parts[3],
            }
        return None

    def generate_archive_number(self, item_number: int) -> str:
        item_str = str(item_number).zfill(self.config.item_number_digits)
        return self.config.separator.join([
            self.config.fonds_number,
            self.config.directory_number,
            self.config.volume_number,
            item_str,
        ])

    def validate_archive_number(self, archive_number: str) -> Tuple[bool, Optional[str]]:
        if not archive_number:
            return False, "档号不能为空"

        parts = archive_number.split(self.config.separator)
        if len(parts) != 4:
            return False, f"档号应为4段，当前为{len(parts)}段"

        fonds, directory, volume, item = parts

        if not fonds:
            return False, "全宗号不能为空"
        if not directory:
            return False, "目录号不能为空"
        if not volume:
            return False, "案卷号不能为空"
        if not item:
            return False, "件号不能为空"

        if not re.match(r"^[A-Z0-9]+$", fonds):
            return False, "全宗号只能包含大写字母和数字"
        if not re.match(r"^[A-Z0-9]+$", directory):
            return False, "目录号只能包含大写字母和数字"
        if not re.match(r"^[A-Z0-9]+$", volume):
            return False, "案卷号只能包含大写字母和数字"
        if not re.match(r"^[A-Z0-9]+$", item):
            return False, "件号只能包含大写字母和数字"

        return True, None

    def check_duplicates(self, archive_numbers: List[str]) -> List[str]:
        seen = set()
        duplicates = []
        for num in archive_numbers:
            if num in seen:
                duplicates.append(num)
            seen.add(num)
        return duplicates

    def rename_files(self, file_paths: List[str], output_dir: str,
                     start_item: Optional[int] = None) -> List[RenameResult]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        if start_item is None:
            start_item = self.config.start_item

        results = []
        current_item = start_item

        for file_path in file_paths:
            original_path = Path(file_path)
            if not original_path.exists():
                results.append(RenameResult(
                    original_name=original_path.name,
                    new_name="",
                    new_archive_number="",
                    success=False,
                    error="文件不存在",
                ))
                continue

            archive_number = self.generate_archive_number(current_item)
            ext = original_path.suffix
            new_name = f"{archive_number}{ext}"
            new_path = output_path / new_name

            try:
                shutil.copy2(str(original_path), str(new_path))
                results.append(RenameResult(
                    original_name=original_path.name,
                    new_name=new_name,
                    new_archive_number=archive_number,
                    success=True,
                ))
                current_item += 1
            except Exception as e:
                results.append(RenameResult(
                    original_name=original_path.name,
                    new_name="",
                    new_archive_number="",
                    success=False,
                    error=str(e),
                ))

        if self.logger:
            success_count = len([r for r in results if r.success])
            self.logger.info(
                f"批量重命名完成: {success_count}/{len(results)} 成功",
                operation_type="rename",
                obj=output_dir,
            )

        return results

    def rename_archives(self, archives: List[Dict[str, Any]],
                        output_dir: Optional[str] = None,
                        file_dir: Optional[str] = None) -> Tuple[List[Dict[str, Any]], List[RenameResult]]:
        updated_archives = []
        rename_results = []

        existing_numbers = [a.get("archive_number", "") for a in archives if a.get("archive_number")]
        duplicates = self.check_duplicates(existing_numbers)

        if duplicates and self.logger:
            self.logger.warning(
                f"发现 {len(duplicates)} 个重复档号: {duplicates[:5]}",
                operation_type="rename",
            )

        current_item = self.config.start_item
        used_numbers = set()

        for archive in archives:
            updated = archive.copy()
            original_number = archive.get("archive_number", "")

            if original_number and original_number not in used_numbers:
                is_valid, _ = self.validate_archive_number(original_number)
                if is_valid:
                    updated["archive_number"] = original_number
                    used_numbers.add(original_number)
                    archive_num = original_number
                else:
                    archive_num = self._assign_new_number(used_numbers, current_item)
                    current_item += 1
                    updated["archive_number"] = archive_num
                    used_numbers.add(archive_num)
            else:
                archive_num = self._assign_new_number(used_numbers, current_item)
                current_item += 1
                updated["archive_number"] = archive_num
                used_numbers.add(archive_num)

            original_file = archive.get("file_name", "")
            if original_file:
                ext = Path(original_file).suffix
                new_file_name = f"{archive_num}{ext}"
                updated["original_file_name"] = original_file
                updated["file_name"] = new_file_name

                if output_dir and file_dir:
                    rename_result = self._rename_single_file(
                        file_dir, original_file, output_dir, new_file_name
                    )
                    rename_results.append(rename_result)

            updated_archives.append(updated)

        if self.logger:
            self.logger.info(
                f"档号编制完成: 共 {len(updated_archives)} 件档案",
                operation_type="rename_archives",
            )

        return updated_archives, rename_results

    def _assign_new_number(self, used_numbers: set, start_item: int) -> str:
        item = start_item
        while True:
            num = self.generate_archive_number(item)
            if num not in used_numbers:
                return num
            item += 1

    def _rename_single_file(self, file_dir: str, original_name: str,
                            output_dir: str, new_name: str) -> RenameResult:
        src_path = Path(file_dir) / original_name
        dst_path = Path(output_dir) / new_name

        if not src_path.exists():
            return RenameResult(
                original_name=original_name,
                new_name="",
                new_archive_number="",
                success=False,
                error="源文件不存在",
            )

        try:
            Path(output_dir).mkdir(parents=True, exist_ok=True)
            shutil.copy2(str(src_path), str(dst_path))
            return RenameResult(
                original_name=original_name,
                new_name=new_name,
                new_archive_number=Path(new_name).stem,
                success=True,
            )
        except Exception as e:
            return RenameResult(
                original_name=original_name,
                new_name="",
                new_archive_number="",
                success=False,
                error=str(e),
            )

    def batch_rename_by_rule(self, archives: List[Dict[str, Any]],
                             rule_template: str) -> List[Dict[str, Any]]:
        updated_archives = []

        for i, archive in enumerate(archives):
            updated = archive.copy()

            variables = {
                "index": i + 1,
                "fonds": self.config.fonds_number,
                "directory": self.config.directory_number,
                "volume": self.config.volume_number,
                "item": str(i + self.config.start_item).zfill(self.config.item_number_digits),
            }

            for key, value in archive.items():
                variables[key] = str(value) if value is not None else ""

            try:
                new_number = rule_template.format(**variables)
                updated["archive_number"] = new_number
            except (KeyError, ValueError):
                pass

            updated_archives.append(updated)

        return updated_archives

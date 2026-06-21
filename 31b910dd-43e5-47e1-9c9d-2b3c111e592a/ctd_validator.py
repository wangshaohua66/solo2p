import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from config import CTD_MODULES, DRUG_TYPE_CONFIG, SUPPORTED_EXTENSIONS
from logger import logger


@dataclass
class FileNode:
    name: str
    path: Path
    is_dir: bool
    size: int = 0
    children: List["FileNode"] = field(default_factory=list)
    depth: int = 0


@dataclass
class StructureIssue:
    issue_type: str
    module: str
    severity: str
    description: str
    file_path: str = ""
    suggestion: str = ""
    is_common: bool = False
    matched_issue_id: Optional[int] = None


class CTDValidator:
    def __init__(self, folder_path: str, drug_type: str = "chemical") -> None:
        self.folder_path = Path(folder_path)
        self.drug_type = drug_type
        self.drug_config = DRUG_TYPE_CONFIG.get(drug_type, DRUG_TYPE_CONFIG["chemical"])
        self.root_node: Optional[FileNode] = None
        self.all_files: List[Path] = []
        self.issues: List[StructureIssue] = []
        self.directory_tree_diff: List[str] = []

    def scan_directory(self) -> FileNode:
        logger.info(f"开始扫描目录: {self.folder_path}")

        def build_tree(path: Path, depth: int = 0) -> FileNode:
            node = FileNode(
                name=path.name,
                path=path,
                is_dir=path.is_dir(),
                size=path.stat().st_size if path.is_file() else 0,
                depth=depth,
            )
            if path.is_dir():
                try:
                    for child in sorted(path.iterdir()):
                        if child.is_file() and child.suffix.lower() in SUPPORTED_EXTENSIONS:
                            self.all_files.append(child)
                        node.children.append(build_tree(child, depth + 1))
                except PermissionError as e:
                    logger.warning(f"无法访问目录 {path}: {e}")
                    self.issues.append(StructureIssue(
                        issue_type="DIR_ACCESS_DENIED",
                        module="ctd_structure",
                        severity="DEFECT",
                        description=f"目录访问被拒绝: {path}",
                        file_path=str(path),
                        suggestion="请检查目录权限或使用管理员权限运行",
                    ))
                except OSError as e:
                    logger.error(f"目录读取错误 {path}: {e}", exception=e)
                    self.issues.append(StructureIssue(
                        issue_type="DIR_READ_ERROR",
                        module="ctd_structure",
                        severity="DEFECT",
                        description=f"目录读取错误: {path}, 错误: {e}",
                        file_path=str(path),
                    ))
            return node

        self.root_node = build_tree(self.folder_path)
        logger.info(f"扫描完成，共发现 {len(self.all_files)} 个文件")
        return self.root_node

    def _extract_module_from_path(self, path: Path) -> Optional[str]:
        relative_parts = path.relative_to(self.folder_path).parts
        for part in relative_parts:
            match = re.match(r"^Module(\d)", part, re.IGNORECASE)
            if match:
                return f"Module{match.group(1)}"
            match = re.match(r"^M(\d)", part, re.IGNORECASE)
            if match:
                return f"Module{match.group(1)}"
        return None

    def validate_structure(self) -> Tuple[List[StructureIssue], Dict[str, Any]]:
        if self.root_node is None:
            self.scan_directory()

        logger.info("开始CTD目录结构合规校验")
        found_modules: Dict[str, List[FileNode]] = {m: [] for m in CTD_MODULES}

        def collect_modules(node: FileNode) -> None:
            if node.is_dir:
                module_name = self._extract_module_from_path(node.path)
                if module_name and module_name in found_modules:
                    found_modules[module_name].append(node)
                for child in node.children:
                    collect_modules(child)

        if self.root_node:
            collect_modules(self.root_node)

        for module_key, module_info in CTD_MODULES.items():
            module_count = len(found_modules[module_key])
            if module_info["required"] and module_count == 0:
                self.issues.append(StructureIssue(
                    issue_type="MISSING_MODULE",
                    module="ctd_structure",
                    severity="FATAL",
                    description=f"缺失必填模块: {module_key} - {module_info['name']}",
                    file_path=str(self.folder_path),
                    suggestion=f"请补充 {module_key} 模块目录及其申报资料",
                ))
            elif module_count > 1:
                self.issues.append(StructureIssue(
                    issue_type="DUPLICATE_MODULE",
                    module="ctd_structure",
                    severity="DEFECT",
                    description=f"{module_key} 模块存在 {module_count} 个目录，期望1个",
                    file_path=str(self.folder_path),
                    suggestion="请合并重复的模块目录",
                ))

            if module_count == 1 and module_info["submodules"]:
                self._validate_submodules(found_modules[module_key][0], module_key, module_info["submodules"])

        self._check_extra_files()
        self._check_depth_misalignment()
        self._build_diff_tree(found_modules)

        stats = {
            "total_files": len(self.all_files),
            "total_size_mb": round(sum(f.stat().st_size for f in self.all_files) / (1024 * 1024), 2),
            "modules_found": {k: len(v) for k, v in found_modules.items()},
            "issues_count": len(self.issues),
        }

        logger.info(f"结构校验完成，发现 {len(self.issues)} 个问题")
        return self.issues, stats

    def _validate_submodules(self, module_node: FileNode, module_key: str,
                              submodules: Dict[str, str]) -> None:
        submodule_names = list(submodules.keys())
        found_sub = {s: False for s in submodule_names}

        for child in module_node.children:
            if child.is_dir:
                for sub_code in submodule_names:
                    pattern = re.escape(sub_code) + r"(\.|_| |$)"
                    if re.search(pattern, child.name):
                        found_sub[sub_code] = True
                        break

        for sub_code, found in found_sub.items():
            if not found:
                self.issues.append(StructureIssue(
                    issue_type="MISSING_SUBMODULE",
                    module="ctd_structure",
                    severity="DEFECT",
                    description=f"{module_key} 缺失子模块: {sub_code} - {submodules[sub_code]}",
                    file_path=str(module_node.path),
                    suggestion=f"请补充 {sub_code} 子目录及对应资料",
                ))

    def _check_extra_files(self) -> None:
        if not self.root_node:
            return
        allowed_names = set(CTD_MODULES.keys()) | {f"Module{i}" for i in range(1, 6)}
        allowed_prefixes = ("M1", "M2", "M3", "M4", "M5",
                            "ZY-M1", "ZY-M2", "ZY-M3", "ZY-M4", "ZY-M5",
                            "SW-M1", "SW-M2", "SW-M3", "SW-M4", "SW-M5")

        for child in self.root_node.children:
            if child.is_dir:
                is_allowed = child.name in allowed_names
                if not is_allowed:
                    for prefix in allowed_prefixes:
                        if child.name.startswith(prefix):
                            is_allowed = True
                            break
                if not is_allowed:
                    self.issues.append(StructureIssue(
                        issue_type="EXTRA_DIRECTORY",
                        module="ctd_structure",
                        severity="SUGGESTION",
                        description=f"根目录存在非CTD规范的额外目录: {child.name}",
                        file_path=str(child.path),
                        suggestion="建议将资料整理到标准CTD模块目录中",
                    ))

    def _check_depth_misalignment(self) -> None:
        if not self.root_node:
            return

        def check_depth(node: FileNode) -> None:
            if node.is_dir and node.depth >= 1:
                module_match = re.match(r"^Module(\d)", node.name, re.IGNORECASE)
                if module_match and node.depth > 2:
                    self.issues.append(StructureIssue(
                        issue_type="DEPTH_MISALIGNMENT",
                        module="ctd_structure",
                        severity="DEFECT",
                        description=f"模块层级错位: {node.name} 位于第 {node.depth} 层",
                        file_path=str(node.path),
                        suggestion="CTD模块应位于申报资料根目录下的第1-2层",
                    ))
            for child in node.children:
                check_depth(child)

        check_depth(self.root_node)

    def _build_diff_tree(self, found_modules: Dict[str, List[FileNode]]) -> None:
        lines = ["CTD目录结构差异对比:"]
        lines.append("=" * 60)
        for module_key, module_info in CTD_MODULES.items():
            status_icon = "✓" if found_modules[module_key] else "✗"
            status_color = "\033[92m" if found_modules[module_key] else "\033[91m"
            lines.append(
                f"{status_color}{status_icon}\033[0m  {module_key}: {module_info['name']}"
            )
            if module_info["submodules"] and found_modules[module_key]:
                module_dir = found_modules[module_key][0]
                existing_names = {c.name for c in module_dir.children if c.is_dir}
                for sub_code, sub_name in module_info["submodules"].items():
                    found = any(sub_code in n for n in existing_names)
                    sub_icon = "  ✓" if found else "  ✗"
                    sub_color = "\033[92m" if found else "\033[93m"
                    lines.append(
                        f"  {sub_color}{sub_icon}\033[0m  {sub_code}: {sub_name}"
                    )
        self.directory_tree_diff = lines

    def print_diff_tree(self) -> None:
        for line in self.directory_tree_diff:
            print(line)

    def get_all_files(self) -> List[Path]:
        if not self.all_files:
            self.scan_directory()
        return self.all_files

    def get_files_by_module(self) -> Dict[str, List[Path]]:
        result: Dict[str, List[Path]] = {m: [] for m in CTD_MODULES}
        result["OTHER"] = []
        for f in self.all_files:
            module = self._extract_module_from_path(f) or "OTHER"
            if module in result:
                result[module].append(f)
            else:
                result["OTHER"].append(f)
        return result

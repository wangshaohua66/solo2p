"""
cli.py — 临床试验数据管理 CLI 命令入口

命令总览：
  ct-cli ingest        多源数据导入（XML/Excel/CSV）
  ct-cli transform     SDTM 域映射与单位换算
  ct-cli validate      SDTM 合规校验（30 条规则 + 自定义扩展）
  ct-cli consistency    跨中心一致性分析
  ct-cli query          数据质疑管理（generate/list/close/stats）
  ct-cli audit          稽查轨迹报告生成
  ct-cli snapshot      项目级数据快照（create/list/diff）
  ct-cli run            一键全流程（导入→转换→校验→一致性→质疑→稽查）
  ct-cli info           配置与规则信息

支持：管道模式输入文件路径（-）、verbose 分级、Rich 彩色输出、loguru 文件日志。
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import click
import pandas as pd
import yaml
from loguru import logger
from rich.console import Console
from rich.panel import Panel
from rich.progress import (BarColumn, MofNCompleteColumn, Progress,
                           TextColumn, TimeElapsedColumn)
from rich.table import Table
from rich.tree import Tree
from rich import box

from audit_trail import AuditTrail
from ingestor import DataIngestor
from models import (OperationType, QueryStatus, Severity, SourceFormat,
                    SnapshotMeta, hash_file, to_json, validate_config)
from query_mgr import QueryManager
from transformer import SDTMTransformer
from validator import ComplianceValidator

console = Console()
_PASS = (lambda x: x)

# 严重程度 -> Rich 样式
_SEV_STYLE = {
    Severity.ERROR.value: "bold red",
    Severity.WARNING.value: "yellow",
    Severity.INFO.value: "cyan",
}


# =============================================================================
# 配置与日志
# =============================================================================
class _Ctx:
    """Click 上下文对象，缓存配置与共享组件。"""
    config: dict
    config_path: Path
    operator: str
    verbose: int


def _load_config(path: str | Path) -> dict[str, Any]:
    p = Path(path)
    if not p.exists():
        raise click.ClickException(f"配置文件不存在: {p}")
    with open(p, encoding="utf-8") as f:
        config = yaml.safe_load(f)
    errors = validate_config(config)
    if errors:
        msg = "\n".join(errors[:10])
        raise click.ClickException(f"配置校验失败:\n{msg}")
    return config


def _setup_logging(config: dict, verbose: int, operator: str) -> None:
    log_cfg = config.get("logging", {})
    level = "DEBUG" if verbose >= 2 else ("INFO" if verbose == 0 else "DEBUG")
    if verbose == 0:
        level = log_cfg.get("level", "INFO")
    log_dir = Path(log_cfg.get("log_dir", "logs"))
    log_dir.mkdir(parents=True, exist_ok=True)
    logger.remove()
    logger.add(log_dir / "ct_cli_{time}.log",
               level=level,
               rotation=log_cfg.get("rotation", "10 MB"),
               retention=log_cfg.get("retention", "30 days"),
               compression=log_cfg.get("compression", "zip"),
               enqueue=True,
               backtrace=False, diagnose=False,
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<7} | {name}:{function}:{line} | {message}")
    logger.configure(extra={"module": "cli", "operator": operator})


def _audit(ctx: click.Context) -> AuditTrail:
    return AuditTrail(ctx.obj.config, operator=ctx.obj.operator)


# =============================================================================
# 数据读取与持久化辅助
# =============================================================================
def _collect_files(files: tuple[str, ...]) -> list[Path]:
    """支持管道模式：files 含 '-' 时从 stdin 读取文件路径。"""
    paths: list[Path] = []
    for f in files:
        if f == "-":
            for line in sys.stdin:
                line = line.strip()
                if line:
                    paths.append(Path(line))
        else:
            paths.append(Path(f))
    if not paths:
        raise click.ClickException("未提供输入文件（可用 - 从标准输入读取路径）")
    return paths


def _save_bundle(bundle: dict[str, pd.DataFrame], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {"saved_at": datetime.now().isoformat(timespec="seconds"),
                "domains": {d: len(df) for d, df in bundle.items()}}
    for dom, df in bundle.items():
        df.to_csv(out_dir / f"{dom}.csv", index=False, encoding="utf-8-sig")
    (out_dir / "manifest.json").write_text(to_json(manifest), encoding="utf-8")
    return out_dir


def _load_bundle(in_dir: Path) -> dict[str, pd.DataFrame]:
    bundle: dict[str, pd.DataFrame] = {}
    for f in sorted(in_dir.glob("*.csv")):
        dom = f.stem.upper()
        bundle[dom] = pd.read_csv(f, dtype=str, encoding="utf-8-sig")
    return bundle


def _is_bundle_dir(p: Path) -> bool:
    return p.is_dir() and (p / "manifest.json").exists()


def _resolve_bundle(ctx: click.Context, inputs: list[Path]) -> dict[str, pd.DataFrame]:
    """输入为 bundle 目录则直接加载；否则 ingest+transform。"""
    if len(inputs) == 1 and _is_bundle_dir(inputs[0]):
        return _load_bundle(inputs[0])
    config = ctx.obj.config
    ingestor = DataIngestor(config.get("sdtm", {}).get("mappings", []),
                            config.get("centers", []))
    frames = []
    for p in inputs:
        df, _ = ingestor.ingest(p)
        frames.append(df)
    raw = pd.concat(frames, ignore_index=True, sort=False) if frames else pd.DataFrame()
    transformer = SDTMTransformer(config)
    return transformer.transform(raw)


# =============================================================================
# Rich 渲染
# =============================================================================
def _render_summary_panel(title: str, stats: dict[str, Any]) -> None:
    lines = []
    for k, v in stats.items():
        if isinstance(v, dict):
            lines.append(f"[bold]{k}[/bold]")
            for kk, vv in v.items():
                lines.append(f"   {kk}: {vv}")
        else:
            lines.append(f"[bold]{k}[/bold]: {v}")
    console.print(Panel("\n".join(lines), title=title, border_style="cyan",
                       box=box.ROUNDED))


def _render_findings(findings: list, limit: int = 50) -> None:
    table = Table(title="合规校验结果", box=box.SIMPLE_HEAVY, header_style="bold")
    table.add_column("规则ID", style="cyan", no_wrap=True)
    table.add_column("等级", width=8)
    table.add_column("域", width=6)
    table.add_column("受试者", style="white")
    table.add_column("字段", style="magenta")
    table.add_column("说明")
    for f in findings[:limit]:
        table.add_row(f.rule_id, f.severity, f.domain, f.usubjid,
                      f.field, f.message,
                      style=_SEV_STYLE.get(f.severity, ""))
    console.print(table)
    if len(findings) > limit:
        console.print(f"[dim]… 另有 {len(findings) - limit} 条未显示，详见输出文件[/dim]")


def _render_sdtm_tree(bundle: dict[str, pd.DataFrame], config: dict) -> None:
    domains = config.get("sdtm", {}).get("domains", {})
    tree = Tree("[bold cyan]SDTM 域映射关系[/bold cyan]", guide_style="dim")
    for dom, df in bundle.items():
        meta = domains.get(dom, {})
        label = f"[bold green]{dom}[/bold green] - {meta.get('label', '')} ({len(df)} 行)"
        branch = tree.add(label)
        for col in list(df.columns)[:12]:
            branch.add(f"[magenta]{col}[/magenta]")
        if len(df.columns) > 12:
            branch.add(f"[dim]… 共 {len(df.columns)} 列[/dim]")
    console.print(tree)


# =============================================================================
# 快照管理
# =============================================================================
class SnapshotManager:
    def __init__(self, config: dict):
        self.config = config
        self.dir = Path(config.get("snapshot", {}).get("dir", "snapshots"))
        self.dir.mkdir(parents=True, exist_ok=True)
        self.rule_version = config.get("rule_version", "0")

    def create(self, bundle: dict[str, pd.DataFrame], operator: str,
               description: str = "", domain: str | None = None) -> SnapshotMeta:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        seq = len(list(self.dir.glob("SNAP-*")))
        snap_id = f"SNAP-{ts}-{seq:03d}"
        snap_dir = self.dir / snap_id
        snap_dir.mkdir(parents=True, exist_ok=True)
        targets = {domain: bundle[domain]} if domain and domain in bundle else bundle
        parts = []
        row_count = 0
        for dom, df in targets.items():
            df.to_csv(snap_dir / f"{dom}.csv", index=False, encoding="utf-8-sig")
            parts.append(f"{dom}:{len(df)}")
            row_count += len(df)
        checksum = hash_file(next(snap_dir.glob("*.csv"))) if targets else ""
        meta = SnapshotMeta(
            snapshot_id=snap_id, version=f"{self.rule_version}.{seq:03d}",
            created_at=datetime.now().isoformat(timespec="seconds"),
            row_count=row_count, domain=domain or "ALL",
            file_path=str(snap_dir), checksum=checksum,
            operator=operator, description=description or "|".join(parts),
        )
        (snap_dir / "meta.json").write_text(to_json(meta.to_dict()), encoding="utf-8")
        return meta

    def list_snapshots(self) -> list[SnapshotMeta]:
        metas = []
        for d in sorted(self.dir.glob("SNAP-*")):
            mf = d / "meta.json"
            if mf.exists():
                metas.append(SnapshotMeta(**json.loads(mf.read_text(encoding="utf-8"))))
        return metas

    def _load(self, snap_id: str) -> dict[str, pd.DataFrame]:
        d = self.dir / snap_id
        if not d.exists():
            raise click.ClickException(f"快照不存在: {snap_id}")
        return _load_bundle(d)

    def diff(self, id1: str, id2: str) -> dict[str, Any]:
        b1, b2 = self._load(id1), self._load(id2)
        report: dict[str, Any] = {"snapshots": [id1, id2], "domains": {}}
        for dom in sorted(set(b1) | set(b2)):
            df1 = b1.get(dom, pd.DataFrame())
            df2 = b2.get(dom, pd.DataFrame())
            cfg_keys = self.config.get("sdtm", {}).get("domains", {}).get(dom, {}).get("keys", [])
            # 仅取两份快照均存在的键列，避免 merge KeyError
            keys = [k for k in cfg_keys if k in df1.columns and k in df2.columns]
            added, removed, changed = self._diff_domain(df1, df2, keys)
            report["domains"][dom] = {
                "rows_before": len(df1), "rows_after": len(df2),
                "added": added, "removed": removed, "changed": changed,
            }
        return report

    @staticmethod
    def _diff_domain(df1: pd.DataFrame, df2: pd.DataFrame,
                     keys: list[str] | None) -> tuple[int, int, int]:
        if df1.empty and df2.empty:
            return 0, 0, 0
        if df1.empty:
            return len(df2), 0, 0
        if df2.empty:
            return 0, len(df1), 0
        if not keys:
            # 无公共主键：按整体规模变化计
            return 0, 0, max(0, len(df2) - len(df1))
        merged = df2.merge(df1, on=keys, how="outer", suffixes=("_new", "_old"),
                           indicator=True)
        added = int((merged["_merge"] == "left_only").sum())
        removed = int((merged["_merge"] == "right_only").sum())
        changed = 0
        common = merged[merged["_merge"] == "both"]
        # 仅比较临床数据列，排除运行相关的元信息列（_row_index 等随运行而变）
        cols = [c for c in df2.columns
                if c not in (keys or []) and not c.startswith("_") and c != "DOMAIN"]
        for col in cols:
            new_c = f"{col}_new" if f"{col}_new" in common.columns else col
            old_c = f"{col}_old" if f"{col}_old" in common.columns else None
            if old_c and new_c in common.columns:
                # 缺失值归一为空串后比较，避免 NA != NA 被误计为变更
                nv = common[new_c].fillna("").astype(str)
                ov = common[old_c].fillna("").astype(str)
                changed += int((nv != ov).sum())
        return added, removed, changed


# =============================================================================
# Click 命令定义
# =============================================================================
@click.group(context_settings=dict(help_option_names=["-h", "--help"]))
@click.option("--config", "config_path", default="config.yaml",
              show_default=True, help="配置文件路径")
@click.option("-v", "--verbose", count=True, help="输出详细程度（-v / -vv）")
@click.option("--operator", default="cli-user", help="操作人标识（写入稽查轨迹）")
@click.pass_context
def cli(ctx: click.Context, config_path: str, verbose: int, operator: str):
    """临床试验数据管理 CLI —— 多源导入 / SDTM 转换 / 合规校验 / 稽查报告。"""
    config = _load_config(config_path)
    _setup_logging(config, verbose, operator)
    ctx.obj = _Ctx()
    ctx.obj.config = config
    ctx.obj.config_path = Path(config_path)
    ctx.obj.operator = operator
    ctx.obj.verbose = verbose
    logger.bind(module="cli", operator=operator).info("CLI 启动 | verbose={}", verbose)


# -----------------------------------------------------------------------------
# 1. ingest
# -----------------------------------------------------------------------------
@cli.command(help="多源数据导入：自动识别 XML/Excel/CSV 并转为统一 DataFrame。")
@click.argument("files", nargs=-1, required=True)
@click.option("-c", "--center", default=None, help="强制指定中心编号（如 C01）")
@click.option("-o", "--output", default=None, help="统一数据输出 CSV 路径")
@click.pass_context
def ingest(ctx: click.Context, files: tuple[str, ...], center: str | None, output: str | None):
    config = ctx.obj.config
    ing = DataIngestor(config.get("sdtm", {}).get("mappings", []),
                      config.get("centers", []))
    paths = _collect_files(files)
    audit = _audit(ctx)
    all_frames, summaries = [], []
    with Progress(TextColumn("[progress.description]{task.description}"),
                  BarColumn(), MofNCompleteColumn(), TimeElapsedColumn(),
                  console=console) as prog:
        task = prog.add_task("导入数据源...", total=len(paths))
        for p in paths:
            prog.update(task, description=f"解析 {p.name}")
            t0 = time.time()
            df, summary = ing.ingest(p, center_id=center)
            summary.warnings.append(f"耗时 {time.time()-t0:.2f}s")
            all_frames.append(df)
            summaries.append(summary)
            audit.record(OperationType.INGEST, [p],
                         {"rows": summary.total_rows, "format": summary.format,
                          "center": summary.center_id},
                         {"encoding": summary.encoding}, config.get("rule_version"))
            prog.advance(task)
    unified = pd.concat(all_frames, ignore_index=True, sort=False) if all_frames else pd.DataFrame()
    out = Path(output) if output else Path("out") / f"ingested_{datetime.now():%Y%m%d_%H%M%S}.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    unified.to_csv(out, index=False, encoding="utf-8-sig")
    table = Table(title="导入摘要", box=box.SIMPLE_HEAVY)
    for col in ("源文件", "格式", "中心", "行数", "编码", "Sheet", "哈希"):
        table.add_column(col)
    for s in summaries:
        table.add_row(Path(s.source).name, s.format, s.center_id or "-",
                      str(s.total_rows), s.encoding, ",".join(s.sheets) or "-",
                      s.file_hash[:12])
    console.print(table)
    console.print(f"\n[bold green]✓[/bold green] 统一数据已保存: {out} ({len(unified)} 行)")
    logger.bind(module="ingestor").info("导入完成 | 源 {} | 合并 {} 行", len(paths), len(unified))


# -----------------------------------------------------------------------------
# 2. transform
# -----------------------------------------------------------------------------
@cli.command(help="SDTM 域映射转换：原始变量 -> CDISC SDTM 域 + 单位换算。")
@click.argument("files", nargs=-1, required=True)
@click.option("-o", "--output-dir", default=None, help="SDTM bundle 输出目录")
@click.pass_context
def transform(ctx: click.Context, files: tuple[str, ...], output_dir: str | None):
    config = ctx.obj.config
    paths = _collect_files(files)
    ing = DataIngestor(config.get("sdtm", {}).get("mappings", []),
                       config.get("centers", []))
    transformer = SDTMTransformer(config)
    frames = [ing.ingest(p)[0] for p in paths]
    raw = pd.concat(frames, ignore_index=True, sort=False)
    t0 = time.time()
    bundle = transformer.transform(raw)
    elapsed = time.time() - t0
    out_dir = Path(output_dir) if output_dir else Path("out") / f"sdtm_{datetime.now():%Y%m%d_%H%M%S}"
    _save_bundle(bundle, out_dir)
    manifest = transformer.transform_manifest(bundle)
    _audit(ctx).record(OperationType.TRANSFORM, paths,
                       {"domains": list(bundle.keys()), "rows": manifest["total_rows"],
                        "elapsed_s": round(elapsed, 2)},
                       {"manifest": manifest}, config.get("rule_version"))
    _render_sdtm_tree(bundle, config)
    console.print(f"\n[bold green]✓[/bold green] SDTM bundle 已保存: {out_dir} "
                  f"({manifest['total_rows']} 行, {len(bundle)} 域, {elapsed:.2f}s)")


# -----------------------------------------------------------------------------
# 3. validate
# -----------------------------------------------------------------------------
@cli.command(help="SDTM 合规校验：30 条规则引擎 + 自定义扩展。")
@click.argument("inputs", nargs=-1, required=True)
@click.option("--severity", default=None,
              help="仅显示指定等级 (ERROR/WARNING/INFO)")
@click.option("-o", "--output", default=None, help="校验结果输出 JSON 路径")
@click.option("--generate-queries/--no-queries", default=False, help="同步生成数据质疑单")
@click.pass_context
def validate(ctx: click.Context, inputs: tuple[str, ...], severity: str | None,
             output: str | None, generate_queries: bool):
    config = ctx.obj.config
    bundle = _resolve_bundle(ctx, _collect_files(inputs))
    validator = ComplianceValidator(config)
    t0 = time.time()
    findings = validator.validate(bundle)
    elapsed = time.time() - t0
    if severity:
        findings = [f for f in findings if f.severity == severity.upper()]
    by_sev = {s: 0 for s in Severity.ordered()}
    by_rule: dict[str, int] = {}
    by_domain: dict[str, int] = {}
    for f in findings:
        by_sev[Severity(f.severity)] = by_sev.get(Severity(f.severity), 0) + 1
        by_rule[f.rule_id] = by_rule.get(f.rule_id, 0) + 1
        by_domain[f.domain] = by_domain.get(f.domain, 0) + 1
    _audit(ctx).record(OperationType.VALIDATE, list(inputs),
                       {"findings": len(findings),
                        "by_severity": {k.value: v for k, v in by_sev.items()},
                        "elapsed_s": round(elapsed, 2)},
                       {"rules": len(config.get("validation_rules", []))},
                       config.get("rule_version"))
    _render_findings(findings)
    _render_summary_panel("校验摘要", {
        "总发现数": len(findings),
        "ERROR": by_sev.get(Severity.ERROR, 0),
        "WARNING": by_sev.get(Severity.WARNING, 0),
        "INFO": by_sev.get(Severity.INFO, 0),
        "耗时(秒)": round(elapsed, 2),
        "规则数": len(config.get("validation_rules", [])),
    })
    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(to_json([f.to_dict() for f in findings]), encoding="utf-8")
        console.print(f"[dim]结果已写入: {output}[/dim]")
    if generate_queries and findings:
        qm = QueryManager()
        created = qm.generate(findings)
        console.print(f"[bold]质疑单[/bold]: 新增 {len(created)} 条（共 {qm.statistics()['total']} 条）")


# -----------------------------------------------------------------------------
# 4. consistency
# -----------------------------------------------------------------------------
@cli.command(help="跨中心一致性分析：单位归一化、离群检测、中心偏倚。")
@click.argument("inputs", nargs=-1, required=True)
@click.option("-o", "--output", default=None, help="差异报告输出 JSON 路径")
@click.pass_context
def consistency(ctx: click.Context, inputs: tuple[str, ...], output: str | None):
    config = ctx.obj.config
    bundle = _resolve_bundle(ctx, _collect_files(inputs))
    validator = ComplianceValidator(config)
    t0 = time.time()
    issues, report = validator.consistency_analysis(bundle)
    elapsed = time.time() - t0
    _audit(ctx).record(OperationType.CONSISTENCY, list(inputs),
                       {"issues": len(issues), "elapsed_s": round(elapsed, 2)},
                       report, config.get("rule_version"))
    table = Table(title="跨中心一致性差异", box=box.SIMPLE_HEAVY)
    for col in ("检验项", "访视", "中心", "受试者", "值", "Z值", "原因", "等级"):
        table.add_column(col)
    for iss in issues[:50]:
        table.add_row(iss.test_code, iss.visit, iss.center_id, iss.subject,
                      f"{iss.value:.3f} {iss.standard_unit}",
                      f"{iss.zscore:.2f}", iss.reason, iss.severity,
                      style=_SEV_STYLE.get(iss.severity, ""))
    console.print(table)
    _render_summary_panel("一致性分析摘要", {
        "分析检验项数": report.get("tests_analyzed", 0),
        "问题数": len(issues),
        "参与中心": ",".join(str(c) for c in report.get("centers", [])) or "-",
        "按中心": report.get("by_center", {}),
        "按检验项": report.get("by_test", {}),
        "耗时(秒)": round(elapsed, 2),
    })
    if output:
        Path(output).parent.mkdir(parents=True, exist_ok=True)
        Path(output).write_text(to_json({"report": report,
                                          "issues": [i.to_dict() for i in issues]}),
                                encoding="utf-8")
        console.print(f"[dim]差异报告已写入: {output}[/dim]")


# -----------------------------------------------------------------------------
# 5. query (group)
# -----------------------------------------------------------------------------
@cli.group(help="数据质疑管理：生成、查询、关闭、统计。")
def query():
    pass


@query.command("generate", help="从校验结果 JSON 生成质疑单。")
@click.argument("findings_file", type=click.Path(exists=True))
@click.option("--severity", default=None, help="仅生成指定等级")
def query_generate(findings_file: str, severity: str | None):
    from models import ValidationFinding
    data = json.loads(Path(findings_file).read_text(encoding="utf-8"))
    findings = [ValidationFinding(**d) for d in data]
    if severity:
        findings = [f for f in findings if f.severity == severity.upper()]
    qm = QueryManager()
    created = qm.generate(findings)
    console.print(f"[green]✓[/green] 生成质疑单 {len(created)} 条，总计 {qm.statistics()['total']} 条")


@query.command("list", help="列出质疑单。")
@click.option("--status", default=None, help="按状态筛选")
@click.option("--severity", default=None, help="按等级筛选")
@click.option("--center", default=None, help="按中心筛选")
def query_list(status: str | None, severity: str | None, center: str | None):
    qm = QueryManager()
    qs = qm.list_queries(status=status, severity=severity, center_id=center)
    table = Table(title=f"质疑单 ({len(qs)} 条)", box=box.SIMPLE_HEAVY)
    for col in ("编号", "规则", "等级", "受试者", "变量路径", "状态", "中心"):
        table.add_column(col)
    for q in qs[:100]:
        table.add_row(q.query_id, q.rule_id, q.severity, q.usubjid,
                      q.variable_path, q.status, q.center_id or "-",
                      style=_SEV_STYLE.get(q.severity, ""))
    console.print(table)
    if len(qs) > 100:
        console.print(f"[dim]… 另有 {len(qs)-100} 条[/dim]")


@query.command("close", help="批量关闭质疑单。")
@click.option("--ids", required=True, help="质疑单编号，逗号分隔")
@click.option("--resolution", default="已核实修正", help="关闭说明")
@click.option("--by", "closed_by", default="cli-user", help="关闭人")
def query_close(ids: str, resolution: str, closed_by: str):
    qm = QueryManager()
    n = qm.close([i.strip() for i in ids.split(",") if i.strip()],
                 resolution=resolution, closed_by=closed_by)
    console.print(f"[green]✓[/green] 已关闭 {n} 条质疑单")


@query.command("stats", help="质疑单统计。")
def query_stats():
    qm = QueryManager()
    _render_summary_panel("质疑单统计", qm.statistics())


# -----------------------------------------------------------------------------
# 6. audit
# -----------------------------------------------------------------------------
@cli.command(help="生成 GCP 稽查报告。")
@click.option("--start", default=None, help="起始时间 ISO (如 2024-01-01)")
@click.option("--end", default=None, help="结束时间 ISO")
@click.option("--operation", default=None, help="按操作类型筛选")
@click.option("-o", "--output", default=None, help="报告输出路径 (Markdown)")
@click.pass_context
def audit(ctx: click.Context, start: str | None, end: str | None,
          operation: str | None, output: str | None):
    trail = _audit(ctx)
    out = trail.generate_report(start=start, end=end, operation=operation, output=output)
    entries = trail.filter_entries(start, end, operation)
    _render_summary_panel("稽查报告", {
        "报告路径": str(out),
        "记录数": len(entries),
        "时间范围": f"{start or '…'} ~ {end or '…'}",
        "操作筛选": operation or "全部",
    })


# -----------------------------------------------------------------------------
# 7. snapshot (group)
# -----------------------------------------------------------------------------
@cli.group(help="项目级数据快照：创建、列表、差异比对。")
def snapshot():
    pass


@snapshot.command("create", help="创建数据快照。")
@click.argument("inputs", nargs=-1, required=True)
@click.option("--domain", default=None, help="仅快照指定域")
@click.option("--desc", default="", help="快照描述")
@click.pass_context
def snapshot_create(ctx: click.Context, inputs: tuple[str, ...], domain: str | None, desc: str):
    config = ctx.obj.config
    bundle = _resolve_bundle(ctx, _collect_files(inputs))
    mgr = SnapshotManager(config)
    meta = mgr.create(bundle, ctx.obj.operator, desc, domain)
    _audit(ctx).record(OperationType.SNAPSHOT_CREATE, list(inputs),
                       {"snapshot_id": meta.snapshot_id, "rows": meta.row_count},
                       meta.to_dict(), config.get("rule_version"))
    _render_summary_panel("快照已创建", meta.to_dict())


@snapshot.command("list", help="列出全部快照。")
@click.pass_context
def snapshot_list(ctx: click.Context):
    mgr = SnapshotManager(ctx.obj.config)
    metas = mgr.list_snapshots()
    table = Table(title=f"数据快照 ({len(metas)} 个)", box=box.SIMPLE_HEAVY)
    for col in ("快照ID", "版本", "创建时间", "域", "行数", "操作人"):
        table.add_column(col)
    for m in metas:
        table.add_row(m.snapshot_id, m.version, m.created_at, m.domain,
                      str(m.row_count), m.operator)
    console.print(table)


@snapshot.command("diff", help="比对两个快照差异。")
@click.argument("id1")
@click.argument("id2")
@click.pass_context
def snapshot_diff(ctx: click.Context, id1: str, id2: str):
    config = ctx.obj.config
    mgr = SnapshotManager(config)
    report = mgr.diff(id1, id2)
    _audit(ctx).record(OperationType.SNAPSHOT_DIFF, [],
                       {"id1": id1, "id2": id2}, report, config.get("rule_version"))
    table = Table(title=f"快照差异 {id1} → {id2}", box=box.SIMPLE_HEAVY)
    for col in ("域", "前", "后", "新增", "删除", "变更"):
        table.add_column(col)
    for dom, d in report["domains"].items():
        table.add_row(dom, str(d["rows_before"]), str(d["rows_after"]),
                      str(d["added"]), str(d["removed"]), str(d["changed"]))
    console.print(table)


# -----------------------------------------------------------------------------
# 8. run (全流程)
# -----------------------------------------------------------------------------
@cli.command(help="一键全流程：导入→转换→校验→一致性→质疑→稽查。")
@click.argument("files", nargs=-1, required=True)
@click.option("-c", "--center", default=None, help="中心编号")
@click.option("-o", "--output-dir", default="out/run", help="输出目录")
@click.pass_context
def run(ctx: click.Context, files: tuple[str, ...], center: str | None, output_dir: str):
    config = ctx.obj.config
    paths = _collect_files(files)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ing = DataIngestor(config.get("sdtm", {}).get("mappings", []),
                       config.get("centers", []))
    transformer = SDTMTransformer(config)
    validator = ComplianceValidator(config)
    trail = _audit(ctx)
    rv = config.get("rule_version")

    with Progress(TextColumn("[progress.description]{task.description}"),
                   BarColumn(), TimeElapsedColumn(), console=console) as prog:
        # 1. 导入
        t = prog.add_task("导入数据源", total=len(paths))
        frames = []
        for p in paths:
            df, _ = ing.ingest(p, center_id=center)
            frames.append(df)
            prog.advance(t)
        raw = pd.concat(frames, ignore_index=True, sort=False)
        trail.record(OperationType.INGEST, paths, {"rows": len(raw)}, {}, rv)
        # 2. 转换
        t = prog.add_task("SDTM 转换", total=1)
        bundle = transformer.transform(raw)
        _save_bundle(bundle, out_dir / "sdtm")
        prog.advance(t)
        trail.record(OperationType.TRANSFORM, paths,
                     {"domains": list(bundle.keys())}, {}, rv)
        # 3. 校验
        t = prog.add_task("合规校验", total=1)
        findings = validator.validate(bundle)
        prog.advance(t)
        trail.record(OperationType.VALIDATE, [], {"findings": len(findings)}, {}, rv)
        # 4. 一致性
        t = prog.add_task("跨中心一致性", total=1)
        issues, _ = validator.consistency_analysis(bundle)
        prog.advance(t)
        trail.record(OperationType.CONSISTENCY, [], {"issues": len(issues)}, {}, rv)
        # 5. 质疑
        t = prog.add_task("生成质疑单", total=1)
        qm = QueryManager()
        created = qm.generate(findings)
        prog.advance(t)
        trail.record(OperationType.QUERY_GENERATE, [], {"created": len(created)}, {}, rv)

    by_sev = {s.value: 0 for s in Severity.ordered()}
    for f in findings:
        by_sev[f.severity] = by_sev.get(f.severity, 0) + 1
    _render_summary_panel("全流程执行摘要", {
        "导入行数": len(raw),
        "SDTM 域": len(bundle),
        "校验发现": len(findings),
        "ERROR": by_sev.get("ERROR", 0),
        "WARNING": by_sev.get("WARNING", 0),
        "一致性问题": len(issues),
        "新增质疑单": len(created),
        "质疑单总计": qm.statistics()["total"],
        "输出目录": str(out_dir),
    })
    report_path = trail.generate_report()
    console.print(f"\n[bold green]✓[/bold green] 稽查报告: {report_path}")


# -----------------------------------------------------------------------------
# 9. info
# -----------------------------------------------------------------------------
@cli.command(help="查看配置、规则与 SDTM 域信息。")
@click.pass_context
def info(ctx: click.Context):
    config = ctx.obj.config
    console.print(Panel(f"[bold]规则版本[/bold]: {config.get('rule_version')}\n"
                        f"[bold]配置文件[/bold]: {ctx.obj.config_path}",
                        title="配置信息", border_style="cyan", box=box.ROUNDED))
    _render_sdtm_tree({d: pd.DataFrame() for d in config.get("sdtm", {}).get("domains", {})}, config)
    rules = config.get("validation_rules", [])
    table = Table(title=f"合规规则 ({len(rules)} 条)", box=box.SIMPLE_HEAVY)
    for col in ("规则ID", "名称", "域", "类型", "等级"):
        table.add_column(col)
    for r in rules:
        table.add_row(r["id"], r.get("name", ""), r.get("domain", ""),
                      r.get("type", ""), r.get("severity", ""),
                      style=_SEV_STYLE.get(r.get("severity", ""), ""))
    console.print(table)
    centers = config.get("centers", [])
    ct = Table(title=f"参研中心 ({len(centers)} 家)", box=box.SIMPLE_HEAVY)
    for col in ("编号", "名称", "格式"):
        ct.add_column(col)
    for c in centers:
        ct.add_row(c["id"], c["name"], c["format"])
    console.print(ct)


if __name__ == "__main__":
    cli()

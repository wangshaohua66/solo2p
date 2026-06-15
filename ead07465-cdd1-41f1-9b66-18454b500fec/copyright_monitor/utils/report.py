import os
import csv
import json
from datetime import datetime
from loguru import logger
from core.database import DatabaseManager


class ReportGenerator:
    def __init__(self, report_dir=None):
        self.report_dir = report_dir or os.path.join("data", "reports")
        os.makedirs(self.report_dir, exist_ok=True)
        self.db = DatabaseManager()

    def generate_work_report(self, work_id, output_format="both"):
        work = self.db.fetchone("SELECT * FROM copyrighted_works WHERE id=?", (work_id,))
        if not work:
            logger.error(f"Work not found: {work_id}")
            return None

        work = dict(work)
        infringements = self.db.fetchall(
            """SELECT cr.*, fr.screenshot_path, fr.html_archive_path, fr.sha256_hash, fr.html_sha256, fr.forensics_time
               FROM comparison_results cr
               LEFT JOIN forensics_records fr ON cr.id = fr.comparison_id
               WHERE cr.work_id=? AND cr.is_infringement=1
               ORDER BY cr.overall_similarity DESC""",
            (work_id,),
        )
        infringements = [dict(r) for r in infringements] if infringements else []

        all_results = self.db.fetchall(
            "SELECT * FROM comparison_results WHERE work_id=? ORDER BY overall_similarity DESC",
            (work_id,),
        )
        all_results = [dict(r) for r in all_results] if all_results else []

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"report_{work_id}_{timestamp}"

        report_data = {
            "work": work,
            "infringement_count": len(infringements),
            "total_comparisons": len(all_results),
            "infringements": infringements,
            "generated_at": datetime.now().isoformat(),
        }

        paths = {}
        if output_format in ("csv", "both"):
            paths["csv"] = self._export_csv(report_data, base_name)
        if output_format in ("html", "both"):
            paths["html"] = self._export_html(report_data, base_name)

        return paths

    def generate_daily_report(self, date=None, output_format="both"):
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        stats = self.db.fetchall(
            "SELECT * FROM scan_statistics WHERE scan_date=?", (date,)
        )
        stats = [dict(r) for r in stats] if stats else []

        new_infringements = self.db.fetchall(
            """SELECT cr.*, cw.title as work_title, fr.screenshot_path, fr.sha256_hash
               FROM comparison_results cr
               JOIN copyrighted_works cw ON cr.work_id = cw.id
               LEFT JOIN forensics_records fr ON cr.id = fr.comparison_id
               WHERE DATE(cr.crawl_time)=? AND cr.is_infringement=1
               ORDER BY cr.overall_similarity DESC""",
            (date,),
        )
        new_infringements = [dict(r) for r in new_infringements] if new_infringements else []

        total_pages = sum(s.get("pages_crawled", 0) for s in stats)
        total_infringements = sum(s.get("infringements_found", 0) for s in stats)
        avg_response = sum(s.get("avg_response_time", 0) for s in stats) / max(1, len(stats))

        report_data = {
            "report_type": "daily",
            "date": date,
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_pages_crawled": total_pages,
                "total_infringements_found": total_infringements,
                "platforms_scanned": len(stats),
                "avg_response_time": round(avg_response, 2),
            },
            "platform_stats": stats,
            "new_infringements": new_infringements,
        }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        base_name = f"daily_report_{date}_{timestamp}"

        paths = {}
        if output_format in ("csv", "both"):
            paths["csv"] = self._export_daily_csv(report_data, base_name)
        if output_format in ("html", "both"):
            paths["html"] = self._export_daily_html(report_data, base_name)

        return paths

    def _export_csv(self, report_data, base_name):
        filepath = os.path.join(self.report_dir, f"{base_name}.csv")
        try:
            with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "序号", "作品名称", "侵权平台", "侵权标题", "侵权作者",
                    "侵权链接", "标题相似度", "段落相似度", "n-gram相似度",
                    "综合相似度", "匹配类型", "取证截图路径", "固证哈希",
                    "取证时间", "发现时间",
                ])
                for idx, inf in enumerate(report_data.get("infringements", []), 1):
                    writer.writerow([
                        idx,
                        report_data["work"]["title"],
                        inf.get("platform_name", ""),
                        inf.get("result_title", ""),
                        inf.get("result_author", ""),
                        inf.get("result_url", ""),
                        f"{inf.get('title_similarity', 0):.2%}",
                        f"{inf.get('paragraph_similarity', 0):.2%}",
                        f"{inf.get('ngram_similarity', 0):.2%}",
                        f"{inf.get('overall_similarity', 0):.2%}",
                        inf.get("match_type", ""),
                        inf.get("screenshot_path", ""),
                        inf.get("sha256_hash", ""),
                        inf.get("forensics_time", ""),
                        inf.get("crawl_time", ""),
                    ])
            logger.info(f"CSV report exported: {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"CSV export failed: {e}")
            return None

    def _export_html(self, report_data, base_name):
        filepath = os.path.join(self.report_dir, f"{base_name}.html")
        work = report_data["work"]
        infringements = report_data.get("infringements", [])
        try:
            rows_html = ""
            for idx, inf in enumerate(infringements, 1):
                sim = inf.get("overall_similarity", 0)
                bg_color = "#ffe0e0" if sim >= 0.9 else "#fff3e0" if sim >= 0.75 else "#ffffff"
                rows_html += f"""
                <tr style="background:{bg_color}">
                    <td>{idx}</td>
                    <td>{inf.get('platform_name', '')}</td>
                    <td>{inf.get('result_title', '')}</td>
                    <td>{inf.get('result_author', '')}</td>
                    <td><a href="{inf.get('result_url', '')}" target="_blank">{inf.get('result_url', '')[:50]}...</a></td>
                    <td>{inf.get('title_similarity', 0):.2%}</td>
                    <td>{inf.get('paragraph_similarity', 0):.2%}</td>
                    <td>{inf.get('ngram_similarity', 0):.2%}</td>
                    <td><strong>{sim:.2%}</strong></td>
                    <td>{inf.get('match_type', '')}</td>
                    <td><code>{inf.get('sha256_hash', '')[:16]}...</code></td>
                    <td>{inf.get('crawl_time', '')[:16]}</td>
                </tr>"""

            html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>侵权监测报告 - {work['title']}</title>
<style>
body{{font-family:"Microsoft YaHei",sans-serif;margin:20px;background:#f5f5f5;color:#333}}
.header{{background:#1a237e;color:#fff;padding:20px;border-radius:8px;margin-bottom:20px}}
.summary{{display:flex;gap:20px;margin:20px 0}}
.stat-card{{background:#fff;padding:15px;border-radius:8px;flex:1;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.1)}}
.stat-card .number{{font-size:28px;font-weight:bold;color:#1a237e}}
.stat-card .label{{font-size:12px;color:#666;margin-top:5px}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1)}}
th{{background:#1a237e;color:#fff;padding:10px;text-align:left;font-size:13px}}
td{{padding:8px 10px;border-bottom:1px solid #eee;font-size:12px}}
tr:hover{{background:#f0f0ff}}
.footer{{margin-top:20px;padding:10px;color:#999;font-size:12px;text-align:center}}
</style></head>
<body>
<div class="header">
<h1>版权侵权监测报告</h1>
<p>作品：{work['title']} | 作者：{work.get('author', '-')} | 报告时间：{report_data['generated_at'][:19]}</p>
</div>
<div class="summary">
<div class="stat-card"><div class="number">{report_data['infringement_count']}</div><div class="label">疑似侵权数</div></div>
<div class="stat-card"><div class="number">{report_data['total_comparisons']}</div><div class="label">比对总数</div></div>
<div class="stat-card"><div class="number">{len(set(i.get('platform_key','') for i in infringements))}</div><div class="label">涉及平台数</div></div>
</div>
<h2>疑似侵权详情</h2>
<table><thead><tr>
<th>#</th><th>平台</th><th>侵权标题</th><th>作者</th><th>链接</th>
<th>标题相似度</th><th>段落相似度</th><th>n-gram</th><th>综合</th>
<th>匹配类型</th><th>固证哈希</th><th>发现时间</th>
</tr></thead><tbody>{rows_html}</tbody></table>
<div class="footer">版权侵权监测系统自动生成 | 报告哈希用于验证完整性</div>
</body></html>"""
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            logger.info(f"HTML report exported: {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"HTML export failed: {e}")
            return None

    def _export_daily_csv(self, report_data, base_name):
        filepath = os.path.join(self.report_dir, f"{base_name}.csv")
        try:
            with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.writer(f)
                writer.writerow(["日期", "抓取页面数", "发现侵权数", "扫描平台数", "平均响应时间(秒)"])
                s = report_data["summary"]
                writer.writerow([
                    report_data["date"], s["total_pages_crawled"],
                    s["total_infringements_found"], s["platforms_scanned"],
                    s["avg_response_time"],
                ])
                writer.writerow([])
                writer.writerow(["平台", "抓取数", "侵权数", "成功率", "封禁率", "验证码次数"])
                for ps in report_data.get("platform_stats", []):
                    writer.writerow([
                        ps.get("platform_key", ""), ps.get("pages_crawled", 0),
                        ps.get("infringements_found", 0), f"{ps.get('success_rate', 1):.1%}",
                        f"{ps.get('ban_rate', 0):.1%}", ps.get("captcha_count", 0),
                    ])
            return filepath
        except Exception as e:
            logger.error(f"Daily CSV export failed: {e}")
            return None

    def _export_daily_html(self, report_data, base_name):
        filepath = os.path.join(self.report_dir, f"{base_name}.html")
        try:
            s = report_data["summary"]
            html = f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<title>每日监测报告 - {report_data['date']}</title>
<style>body{{font-family:"Microsoft YaHei",sans-serif;margin:20px;background:#f5f5f5}}
.header{{background:#0d47a1;color:#fff;padding:20px;border-radius:8px}}
.cards{{display:flex;gap:15px;margin:20px 0}}
.card{{background:#fff;padding:15px;border-radius:8px;flex:1;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,0.1)}}
.big{{font-size:28px;font-weight:bold;color:#0d47a1}}</style></head>
<body><div class="header"><h1>每日版权监测报告</h1><p>{report_data['date']}</p></div>
<div class="cards">
<div class="card"><div class="big">{s['total_pages_crawled']}</div><div>抓取页面</div></div>
<div class="card"><div class="big">{s['total_infringements_found']}</div><div>发现侵权</div></div>
<div class="card"><div class="big">{s['platforms_scanned']}</div><div>扫描平台</div></div>
<div class="card"><div class="big">{s['avg_response_time']}s</div><div>平均响应</div></div>
</div></body></html>"""
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html)
            return filepath
        except Exception as e:
            logger.error(f"Daily HTML export failed: {e}")
            return None

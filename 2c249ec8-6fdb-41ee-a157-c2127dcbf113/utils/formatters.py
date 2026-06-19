import os
import sys
from typing import List, Dict, Any, Optional
from datetime import datetime

import pandas as pd
import numpy as np

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    COLOR_AVAILABLE = True
except ImportError:
    COLOR_AVAILABLE = False


class Colors:
    if COLOR_AVAILABLE:
        SUCCESS = Fore.GREEN
        ERROR = Fore.RED
        WARNING = Fore.YELLOW
        INFO = Fore.CYAN
        HEADER = Fore.MAGENTA
        RESET = Style.RESET_ALL
        BOLD = Style.BRIGHT
    else:
        SUCCESS = ''
        ERROR = ''
        WARNING = ''
        INFO = ''
        HEADER = ''
        RESET = ''
        BOLD = ''


def colorize(text: str, color: str = 'info') -> str:
    color_map = {
        'success': Colors.SUCCESS,
        'error': Colors.ERROR,
        'warning': Colors.WARNING,
        'info': Colors.INFO,
        'header': Colors.HEADER,
    }
    color_code = color_map.get(color.lower(), '')
    return f"{color_code}{text}{Colors.RESET}"


def format_table(data: List[Dict[str, Any]], columns: Optional[List[str]] = None) -> str:
    if not data:
        return "无数据"
    
    if columns is None:
        columns = list(data[0].keys())
    
    col_widths = {}
    for col in columns:
        col_widths[col] = len(str(col))
        for row in data:
            val = str(row.get(col, ''))
            if len(val) > col_widths[col]:
                col_widths[col] = len(val)
    
    header = ' | '.join(str(col).ljust(col_widths[col]) for col in columns)
    separator = '-+-'.join('-' * col_widths[col] for col in columns)
    
    rows = [header, separator]
    for row in data:
        row_str = ' | '.join(str(row.get(col, '')).ljust(col_widths[col]) for col in columns)
        rows.append(row_str)
    
    return '\n'.join(rows)


def format_metrics(metrics: Dict[str, float], decimal_places: int = 4) -> str:
    if not metrics:
        return "无评估指标"
    
    labels = {
        'mae': '平均绝对误差 (MAE)',
        'rmse': '均方根误差 (RMSE)',
        'mape': '平均绝对百分比误差 (MAPE)',
        'nrmse': '归一化均方根误差 (NRMSE)',
        'r2': '决定系数 (R²)',
    }
    
    rows = []
    for key, value in metrics.items():
        label = labels.get(key, key)
        if isinstance(value, float):
            formatted_value = f"{value:.{decimal_places}f}"
        else:
            formatted_value = str(value)
        rows.append({'指标': label, '值': formatted_value})
    
    return format_table(rows, ['指标', '值'])


def format_progress(current: int, total: int, prefix: str = '', suffix: str = '', length: int = 50) -> str:
    if total <= 0:
        percent = 100
    else:
        percent = int(100 * current / total)
    filled = int(length * current // total)
    bar = '█' * filled + '░' * (length - filled)
    return f'\r{prefix} |{bar}| {percent}% {suffix}'


def print_success(message: str) -> None:
    print(colorize(f"[成功] {message}", 'success'))


def print_error(message: str) -> None:
    print(colorize(f"[错误] {message}", 'error'), file=sys.stderr)


def print_warning(message: str) -> None:
    print(colorize(f"[警告] {message}", 'warning'))


def print_info(message: str) -> None:
    print(colorize(f"[信息] {message}", 'info'))


def print_header(message: str) -> None:
    print(colorize(f"\n{'=' * 60}", 'header'))
    print(colorize(f"  {message}", 'header'))
    print(colorize(f"{'=' * 60}\n", 'header'))


def format_data_quality_report(report: Dict[str, Any]) -> str:
    rows = [
        {'项目': '总行数', '值': str(report.get('total_rows', 0))},
        {'项目': '总列数', '值': str(report.get('total_columns', 0))},
        {'项目': '缺失值数量', '值': str(report.get('missing_values', 0))},
        {'项目': '异常值数量', '值': str(report.get('outliers', 0))},
        {'项目': '时间范围', '值': report.get('time_range', 'N/A')},
        {'项目': '数据质量评分', '值': f"{report.get('quality_score', 0):.2f}"},
    ]
    return format_table(rows, ['项目', '值'])


def format_prediction_result(result: Dict[str, Any], decimal_places: int = 2) -> str:
    station_id = result.get('station_id', 'N/A')
    predictions = result.get('predictions', [])
    
    header = f"电站: {station_id}"
    lines = [header, '-' * len(header)]
    
    if predictions:
        rows = []
        for pred in predictions:
            time = pred.get('timestamp', '')
            power = pred.get('power', 0)
            lower = pred.get('lower_bound', 0)
            upper = pred.get('upper_bound', 0)
            rows.append({
                '时间': str(time),
                '预测功率(MW)': f"{power:.{decimal_places}f}",
                '下限(MW)': f"{lower:.{decimal_places}f}",
                '上限(MW)': f"{upper:.{decimal_places}f}",
            })
        lines.append(format_table(rows, ['时间', '预测功率(MW)', '下限(MW)', '上限(MW)']))
    else:
        lines.append("无预测数据")
    
    return '\n'.join(lines)


def format_evaluation_summary(results: Dict[str, Dict[str, float]], decimal_places: int = 4) -> str:
    if not results:
        return "无评估结果"
    
    rows = []
    for model_name, metrics in results.items():
        row = {'模型': model_name}
        for metric, value in metrics.items():
            if isinstance(value, float):
                row[metric.upper()] = f"{value:.{decimal_places}f}"
            else:
                row[metric.upper()] = str(value)
        rows.append(row)
    
    columns = ['模型'] + [m.upper() for m in list(results.values())[0].keys() if isinstance(list(results.values())[0].keys(), str)]
    
    return format_table(rows)


def save_prediction_to_file(result: Dict[str, Any], file_path: str, fmt: str = 'csv') -> bool:
    try:
        predictions = result.get('predictions', [])
        if not predictions:
            return False
        
        df = pd.DataFrame(predictions)
        
        os.makedirs(os.path.dirname(file_path) if os.path.dirname(file_path) else '.', exist_ok=True)
        
        fmt = fmt.lower()
        if fmt == 'csv':
            df.to_csv(file_path, index=False, encoding='utf-8-sig')
        elif fmt in ['excel', 'xlsx']:
            df.to_excel(file_path, index=False, engine='openpyxl')
        elif fmt == 'json':
            df.to_json(file_path, orient='records', force_ascii=False, indent=2)
        else:
            return False
        
        return True
    except Exception:
        return False


def generate_html_report(results: Dict[str, Any], output_path: str) -> bool:
    try:
        os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else '.', exist_ok=True)
        
        html_content = _generate_html_content(results)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return True
    except Exception:
        return False


def _generate_html_content(results: Dict[str, Any]) -> str:
    station_id = results.get('station_id', 'N/A')
    predictions = results.get('predictions', [])
    metrics = results.get('metrics', {})
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>发电功率预测报告 - {station_id}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; border-bottom: 3px solid #007acc; padding-bottom: 10px; }}
        h2 {{ color: #555; margin-top: 30px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #007acc; color: white; }}
        tr:hover {{ background-color: #f5f5f5; }}
        .metrics-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }}
        .metric-card {{ background: #f0f7ff; padding: 20px; border-radius: 8px; text-align: center; }}
        .metric-value {{ font-size: 24px; font-weight: bold; color: #007acc; }}
        .metric-label {{ color: #666; margin-top: 5px; }}
        .chart-container {{ margin-top: 20px; }}
        canvas {{ width: 100%; height: 400px; }}
        .footer {{ margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; color: #888; font-size: 12px; text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>发电功率预测报告</h1>
        <p><strong>电站编号:</strong> {station_id}</p>
        <p><strong>生成时间:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <h2>评估指标</h2>
        <div class="metrics-grid">
"""
    
    metric_labels = {
        'mae': 'MAE (MW)',
        'rmse': 'RMSE (MW)',
        'mape': 'MAPE (%)',
        'nrmse': 'NRMSE (%)',
    }
    
    for key, label in metric_labels.items():
        if key in metrics:
            value = metrics[key]
            if isinstance(value, float):
                display_value = f"{value:.4f}"
            else:
                display_value = str(value)
            html += f"""
            <div class="metric-card">
                <div class="metric-value">{display_value}</div>
                <div class="metric-label">{label}</div>
            </div>
"""
    
    html += f"""
        </div>
        
        <h2>预测数据</h2>
        <table>
            <thead>
                <tr>
                    <th>时间</th>
                    <th>预测功率 (MW)</th>
                    <th>置信下限 (MW)</th>
                    <th>置信上限 (MW)</th>
                </tr>
            </thead>
            <tbody>
"""
    
    for pred in predictions[:50]:
        timestamp = pred.get('timestamp', '')
        power = pred.get('power', 0)
        lower = pred.get('lower_bound', 0)
        upper = pred.get('upper_bound', 0)
        html += f"""
                <tr>
                    <td>{timestamp}</td>
                    <td>{power:.2f}</td>
                    <td>{lower:.2f}</td>
                    <td>{upper:.2f}</td>
                </tr>
"""
    
    if len(predictions) > 50:
        html += f"""
                <tr>
                    <td colspan="4" style="text-align: center; color: #888;">... 还有 {len(predictions) - 50} 条数据</td>
                </tr>
"""
    
    html += f"""
            </tbody>
        </table>
        
        <div class="footer">
            电力预测系统生成 | 报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        </div>
    </div>
</body>
</html>
"""
    
    return html

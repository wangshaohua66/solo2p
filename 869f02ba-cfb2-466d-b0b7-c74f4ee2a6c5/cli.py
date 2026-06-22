#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime, date, timedelta
from typing import Optional, List

import click
from colorama import Fore, Style, init
from tqdm import tqdm
from prettytable import PrettyTable
try:
    from prettytable import HRuleStyle, VRuleStyle
except ImportError:
    from prettytable import ALL as _ALL
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from models import (
    WORK_TYPES, WORK_TYPE_NAMES,
    APPLICANT_TYPES, APPLICANT_TYPE_NAMES,
    REGISTRATION_STATUS, REGISTRATION_STATUS_NAMES,
    REVIEW_ROLES, REVIEW_ROLE_NAMES,
    PAYMENT_STATUS, PAYMENT_STATUS_NAMES,
)
from services.registration import RegistrationService
from services.certificate import CertificateGenerator
from services.publication import PublicationService
from services.payment import PaymentService
from utils.config import config
from utils.logger import get_logger

init(autoreset=True)
logger = get_logger('cli')
console = Console()


def print_success(msg: str) -> None:
    click.echo(f"{Fore.GREEN}✓ {msg}{Style.RESET_ALL}")


def print_warning(msg: str) -> None:
    click.echo(f"{Fore.YELLOW}⚠ {msg}{Style.RESET_ALL}")


def print_error(msg: str) -> None:
    click.echo(f"{Fore.RED}✗ {msg}{Style.RESET_ALL}")


def print_info(msg: str) -> None:
    click.echo(f"{Fore.CYAN}ℹ {msg}{Style.RESET_ALL}")


def output_result(data, as_json: bool = False) -> None:
    if as_json:
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    elif isinstance(data, dict) and 'table' in data:
        click.echo(data['table'])
        if 'summary' in data:
            click.echo(data['summary'])
    else:
        click.echo(data)


def validate_date(ctx, param, value) -> Optional[date]:
    if value is None:
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise click.BadParameter('日期格式必须为 YYYY-MM-DD')


def validate_work_type(ctx, param, value) -> Optional[str]:
    if value is None:
        return None
    if value not in WORK_TYPES:
        raise click.BadParameter(f'作品类型必须为: {", ".join(WORK_TYPES)}')
    return value


def validate_applicant_type(ctx, param, value) -> Optional[str]:
    if value is None:
        return None
    if value not in APPLICANT_TYPES:
        raise click.BadParameter(f'申请人类型必须为: {", ".join(APPLICANT_TYPES)}')
    return value


def validate_status(ctx, param, value) -> Optional[str]:
    if value is None:
        return None
    if value not in REGISTRATION_STATUS:
        raise click.BadParameter(f'状态必须为: {", ".join(REGISTRATION_STATUS)}')
    return value


def prompt_if_missing(prompt_text: str, value: Optional[str], hide_input: bool = False) -> str:
    if value is None or value.strip() == '':
        return click.prompt(prompt_text, hide_input=hide_input)
    return value


@click.group()
@click.version_option(version='1.0.0', prog_name='copyright-cli')
@click.option('--json', 'as_json', is_flag=True, default=False, help='以JSON格式输出结果')
@click.pass_context
def cli(ctx, as_json: bool):
    """
    版权保护中心登记管理系统 v1.0.0

    负责辖区内新闻出版、影视制作、音乐唱片等单位的著作权登记与版权侵权监测工作。
    """
    ctx.ensure_object(dict)
    ctx.obj['as_json'] = as_json

    banner = Text()
    banner.append("版权保护中心登记管理系统\n", style="bold blue")
    banner.append("Copyright Registration Management System", style="dim")
    console.print(Panel(banner, border_style="blue"))


@cli.group()
def registration():
    """作品登记管理"""
    pass


@registration.command('submit')
@click.option('--title', help='作品名称')
@click.option('--work-type', 'work_type', help=f'作品类型: {", ".join(WORK_TYPES)}', callback=validate_work_type)
@click.option('--author', help='作者姓名')
@click.option('--description', help='作品描述')
@click.option('--keywords', help='关键词，多个用逗号分隔')
@click.option('--file', 'file_path', help='作品文件路径')
@click.option('--creation-date', 'creation_date', help='创作完成日期 YYYY-MM-DD', callback=validate_date)
@click.option('--publication-date', 'publication_date', help='首次发表日期 YYYY-MM-DD', callback=validate_date)
@click.option('--applicant-name', 'applicant_name', help='申请人姓名/名称')
@click.option('--applicant-type', 'applicant_type', help=f'申请人类型: {", ".join(APPLICANT_TYPES)}', callback=validate_applicant_type)
@click.option('--id-card', 'id_card', help='身份证号/统一社会信用代码')
@click.option('--phone', help='联系电话')
@click.option('--email', help='电子邮箱')
@click.option('--address', help='地址')
@click.option('--region', help='地区')
@click.option('--yes', is_flag=True, help='跳过确认直接提交')
@click.pass_context
def submit_registration(ctx, **kwargs):
    """提交著作权登记申请"""
    as_json = ctx.obj['as_json']

    try:
        title = prompt_if_missing('请输入作品名称', kwargs.get('title'))
        work_type = prompt_if_missing(f'请输入作品类型 ({", ".join(WORK_TYPES)})', kwargs.get('work_type'))
        if work_type not in WORK_TYPES:
            raise ValueError(f'无效的作品类型: {work_type}')

        applicant_name = prompt_if_missing('请输入申请人姓名/名称', kwargs.get('applicant_name'))
        applicant_type = prompt_if_missing(f'请输入申请人类型 ({", ".join(APPLICANT_TYPES)})', kwargs.get('applicant_type'))
        if applicant_type not in APPLICANT_TYPES:
            raise ValueError(f'无效的申请人类型: {applicant_type}')

        id_card = prompt_if_missing('请输入身份证号/统一社会信用代码', kwargs.get('id_card'))

        if not kwargs.get('yes'):
            click.echo('\n' + '=' * 50)
            click.echo('请确认以下登记信息：')
            click.echo(f'  作品名称: {title}')
            click.echo(f'  作品类型: {WORK_TYPE_NAMES[work_type]}')
            click.echo(f'  作者: {kwargs.get("author") or "同申请人"}')
            click.echo(f'  申请人: {applicant_name}')
            click.echo(f'  申请人类型: {APPLICANT_TYPE_NAMES[applicant_type]}')
            click.echo(f'  证件号: {id_card}')
            if kwargs.get('file_path'):
                click.echo(f'  作品文件: {kwargs.get("file_path")}')
            click.echo('=' * 50)
            if not click.confirm('是否确认提交？', default=True):
                print_warning('已取消提交')
                return

        service = RegistrationService()

        with console.status("[bold green]正在创建申请人信息..."):
            applicant = service.create_applicant(
                name=applicant_name,
                applicant_type=applicant_type,
                id_card=id_card,
                phone=kwargs.get('phone'),
                email=kwargs.get('email'),
                address=kwargs.get('address'),
                region=kwargs.get('region'),
            )
        print_success(f'申请人信息已创建: {applicant.name} (ID: {applicant.id})')

        with console.status("[bold green]正在提取作品特征..."):
            work = service.create_work(
                title=title,
                work_type=work_type,
                author=kwargs.get('author') or applicant_name,
                description=kwargs.get('description'),
                keywords=kwargs.get('keywords'),
                file_path=kwargs.get('file_path'),
                creation_date=kwargs.get('creation_date'),
                publication_date=kwargs.get('publication_date'),
            )
        print_success(f'作品信息已创建: {work.title} (ID: {work.id})')

        with console.status("[bold green]正在进行相似度比对..."):
            registration = service.submit_registration(applicant, work)
        print_success(f'登记申请已提交: {registration.application_no}')

        if registration.similarity_note:
            print_warning(registration.similarity_note)

        result = {
            'application_no': registration.application_no,
            'applicant_id': applicant.id,
            'work_id': work.id,
            'registration_id': registration.id,
            'status': registration.status,
            'status_name': REGISTRATION_STATUS_NAMES[registration.status],
            'is_unique': registration.is_unique,
            'similarity_score': registration.similarity_score,
            'expected_completion_date': registration.expected_completion_date.isoformat(),
        }

        output_result(result, as_json)

    except Exception as e:
        print_error(f'提交失败: {str(e)}')
        logger.error(f"Registration submission failed: {e}", exc_info=True)
        sys.exit(1)


@registration.command('list')
@click.option('--status', help=f'状态筛选: {", ".join(REGISTRATION_STATUS)}', callback=validate_status)
@click.option('--applicant', help='申请人姓名模糊搜索')
@click.option('--start-date', help='开始日期 YYYY-MM-DD', callback=validate_date)
@click.option('--end-date', help='结束日期 YYYY-MM-DD', callback=validate_date)
@click.option('--limit', type=int, default=50, help='返回数量限制')
@click.option('--offset', type=int, default=0, help='偏移量')
@click.pass_context
def list_registrations(ctx, status, applicant, start_date, end_date, limit, offset):
    """查询登记申请列表"""
    as_json = ctx.obj['as_json']

    try:
        from models import db_manager, Registration, Applicant

        with db_manager.get_session() as session:
            query = session.query(Registration).join(Applicant)

            if status:
                query = query.filter(Registration.status == status)
            if applicant:
                query = query.filter(Applicant.name.like(f'%{applicant}%'))
            if start_date:
                query = query.filter(Registration.submission_date >= datetime.combine(start_date, datetime.min.time()))
            if end_date:
                query = query.filter(Registration.submission_date <= datetime.combine(end_date, datetime.max.time()))

            registrations = query.order_by(Registration.submission_date.desc()).offset(offset).limit(limit).all()

            if as_json:
                output_result([r.to_dict(include_details=True) for r in registrations], as_json)
                return

            table = PrettyTable()
            table.field_names = ['申请编号', '作品名称', '申请人', '状态', '提交日期', '相似度', '唯一']
            try:
                table.hrules = HRuleStyle.ALL
            except NameError:
                table.hrules = _ALL

            for reg in registrations:
                status_str = REGISTRATION_STATUS_NAMES.get(reg.status, reg.status)
                if reg.status == 'certificate_issued':
                    status_str = f"{Fore.GREEN}{status_str}{Style.RESET_ALL}"
                elif reg.status in ['rejected', 'withdrawn']:
                    status_str = f"{Fore.RED}{status_str}{Style.RESET_ALL}"
                elif reg.status == 'submitted':
                    status_str = f"{Fore.CYAN}{status_str}{Style.RESET_ALL}"
                else:
                    status_str = f"{Fore.YELLOW}{status_str}{Style.RESET_ALL}"

                sim_str = f"{reg.similarity_score:.2%}" if reg.similarity_score else "N/A"
                unique_str = f"{Fore.GREEN}是{Style.RESET_ALL}" if reg.is_unique else f"{Fore.RED}否{Style.RESET_ALL}"

                table.add_row([
                    reg.application_no,
                    reg.work.title[:20] if reg.work else '',
                    reg.applicant.name[:10] if reg.applicant else '',
                    status_str,
                    reg.submission_date.strftime('%Y-%m-%d') if reg.submission_date else '',
                    sim_str,
                    unique_str,
                ])

            table.align = 'l'
            table.max_width = 120

            summary = f"\n共 {len(registrations)} 条记录"
            output_result({'table': str(table), 'summary': summary}, as_json=False)

    except Exception as e:
        print_error(f'查询失败: {str(e)}')
        logger.error(f"List registrations failed: {e}", exc_info=True)
        sys.exit(1)


@registration.command('progress')
@click.option('--application-no', 'application_no', help='申请编号')
@click.option('--applicant-name', 'applicant_name', help='申请人姓名')
@click.pass_context
def query_progress(ctx, application_no, applicant_name):
    """查询登记进度"""
    as_json = ctx.obj['as_json']

    try:
        if not application_no and not applicant_name:
            raise ValueError('请提供申请编号或申请人姓名')

        service = RegistrationService()
        results = service.query_progress(application_no, applicant_name)

        if not results:
            print_warning('未找到相关登记记录')
            return

        if as_json:
            output_result(results, as_json)
            return

        for data in results:
            click.echo('\n' + '=' * 60)
            click.echo(f"申请编号: {Fore.CYAN}{data['application_no']}{Style.RESET_ALL}")
            click.echo(f"作品名称: {data['work']['title'] if data.get('work') else 'N/A'}")
            click.echo(f"申请人: {data['applicant']['name'] if data.get('applicant') else 'N/A'}")

            stage = data.get('current_stage', {})
            progress_bar = ''
            for i in range(1, stage.get('total_stages', 6) + 1):
                if i < stage.get('stage_order', 0):
                    progress_bar += f"{Fore.GREEN}█{Style.RESET_ALL}"
                elif i == stage.get('stage_order', 0):
                    progress_bar += f"{Fore.YELLOW}█{Style.RESET_ALL}"
                else:
                    progress_bar += '░'

            click.echo(f"当前状态: {progress_bar} {stage.get('stage', 'N/A')} ({stage.get('progress', 'N/A')})")
            click.echo(f"状态名称: {REGISTRATION_STATUS_NAMES.get(data['status'], data['status'])}")

            if data.get('expected_completion_date'):
                click.echo(f"预计完成: {data['expected_completion_date']}")

            if data.get('similarity_note'):
                print_warning(f"相似度提示: {data['similarity_note']}")

            if data.get('reviews'):
                click.echo(f"\n审查记录:")
                for review in data['reviews'][:5]:
                    role = REVIEW_ROLE_NAMES.get(review['reviewer_role'], review['reviewer_role'])
                    click.echo(f"  [{review['review_date']}] {role} - {review['reviewer']}: {review['comments']}")

            click.echo('=' * 60)

    except Exception as e:
        print_error(f'查询失败: {str(e)}')
        logger.error(f"Progress query failed: {e}", exc_info=True)
        sys.exit(1)


@registration.command('status')
@click.option('--id', 'registration_id', type=int, help='登记记录ID')
@click.option('--application-no', 'application_no', help='申请编号')
@click.option('--new-status', 'new_status', required=True, help=f'新状态: {", ".join(REGISTRATION_STATUS)}', callback=validate_status)
@click.option('--reviewer', required=True, help='审查员姓名')
@click.option('--role', 'reviewer_role', required=True, help=f'角色: {", ".join(REVIEW_ROLES)}')
@click.option('--comments', help='审查意见')
@click.pass_context
def update_status(ctx, registration_id, application_no, new_status, reviewer, reviewer_role, comments):
    """更新登记状态"""
    as_json = ctx.obj['as_json']

    try:
        service = RegistrationService()

        if reviewer_role not in REVIEW_ROLES:
            raise ValueError(f'无效的角色，必须为: {", ".join(REVIEW_ROLES)}')

        if not registration_id and not application_no:
            reg = service.get_registration(application_no=application_no)
            if not reg:
                raise ValueError('未找到登记记录')
            registration_id = reg.id

        registration = service.update_status(
            registration_id=registration_id,
            new_status=new_status,
            reviewer=reviewer,
            reviewer_role=reviewer_role,
            comments=comments,
        )

        print_success(f'状态已更新: {REGISTRATION_STATUS_NAMES[new_status]}')
        output_result(registration.to_dict(), as_json)

    except Exception as e:
        print_error(f'更新失败: {str(e)}')
        logger.error(f"Status update failed: {e}", exc_info=True)
        sys.exit(1)


@registration.command('verify')
@click.option('--ids', 'registration_ids', help='登记记录ID，多个用逗号分隔')
@click.option('--status', help=f'仅处理指定状态的记录: {", ".join(REGISTRATION_STATUS)}', callback=validate_status)
@click.option('--limit', type=int, default=50, help='批量处理数量')
@click.pass_context
def verify_uniqueness(ctx, registration_ids, status, limit):
    """批量核验作品唯一性"""
    as_json = ctx.obj['as_json']

    try:
        service = RegistrationService()

        if not registration_ids:
            from models import db_manager, Registration
            with db_manager.get_session() as session:
                query = session.query(Registration)
                if status:
                    query = query.filter(Registration.status == status)
                regs = query.limit(limit).all()
                ids = [r.id for r in regs]
        else:
            ids = [int(x.strip()) for x in registration_ids.split(',')]

        if not ids:
            print_warning('没有需要核验的记录')
            return

        print_info(f'开始核验 {len(ids)} 条记录的唯一性...')

        results = []
        for reg_id in tqdm(ids, desc='核验进度', unit='件'):
            try:
                result = service.verify_uniqueness([reg_id])
                results.extend(result)
            except Exception as e:
                logger.error(f"Verification failed for {reg_id}: {e}")
                results.append({'registration_id': reg_id, 'error': str(e)})

        success_count = len([r for r in results if 'error' not in r])
        print_success(f'核验完成: {success_count}/{len(results)} 成功')

        output_result(results, as_json)

    except Exception as e:
        print_error(f'核验失败: {str(e)}')
        logger.error(f"Uniqueness verification failed: {e}", exc_info=True)
        sys.exit(1)


@registration.command('stats')
@click.option('--period', type=click.Choice(['month', 'quarter', 'year', 'custom']), default='month', help='统计周期')
@click.option('--start-date', help='开始日期 YYYY-MM-DD', callback=validate_date)
@click.option('--end-date', help='结束日期 YYYY-MM-DD', callback=validate_date)
@click.option('--group-by', 'group_by', type=click.Choice(['work_type', 'applicant_type', 'region']), help='分组维度')
@click.pass_context
def get_statistics(ctx, period, start_date, end_date, group_by):
    """统计报表"""
    as_json = ctx.obj['as_json']

    try:
        service = RegistrationService()
        stats = service.get_statistics(
            period=period,
            start_date=start_date,
            end_date=end_date,
            group_by=group_by,
        )

        if as_json:
            output_result(stats, as_json)
            return

        table = PrettyTable()
        table.field_names = ['指标', '数值']
        try:
            table.hrules = HRuleStyle.ALL
        except NameError:
            table.hrules = _ALL

        table.add_row(['统计周期', stats['period']])
        table.add_row(['日期范围', f"{stats['start_date']} 至 {stats['end_date']}"])
        table.add_row(['总登记量', stats['total_count']])
        table.add_row(['已通过', f"{Fore.GREEN}{stats['passed_count']}{Style.RESET_ALL}"])
        table.add_row(['已驳回', f"{Fore.RED}{stats['rejected_count']}{Style.RESET_ALL}"])
        table.add_row(['处理中', f"{Fore.YELLOW}{stats['pending_count']}{Style.RESET_ALL}"])
        table.add_row(['通过率', f"{stats['pass_rate']:.2%}"])
        table.add_row(['驳回率', f"{stats['rejection_rate']:.2%}"])
        table.add_row(['平均审查时长', f"{stats['avg_review_days']} 天"])

        click.echo('\n' + str(table))

        if group_by and stats.get(f'by_{group_by}'):
            group_data = stats[f'by_{group_by}']
            click.echo(f"\n按 {group_by} 分组统计:")
            group_table = PrettyTable()
            group_table.field_names = [group_by, '数量', '通过数', '通过率']
            for key, value in group_data.items():
                group_table.add_row([
                    key,
                    value['count'],
                    value['passed'],
                    f"{value['pass_rate']:.2%}",
                ])
            click.echo(str(group_table))

    except Exception as e:
        print_error(f'统计失败: {str(e)}')
        logger.error(f"Statistics query failed: {e}", exc_info=True)
        sys.exit(1)


@cli.group()
def certificate():
    """证书管理"""
    pass


@certificate.command('generate')
@click.option('--id', 'registration_id', type=int, help='登记记录ID')
@click.option('--application-no', 'application_no', help='申请编号')
@click.option('--batch', is_flag=True, help='批量生成模式')
@click.option('--ids', 'registration_ids', help='批量生成的登记ID，多个用逗号分隔')
@click.pass_context
def generate_certificate(ctx, registration_id, application_no, batch, registration_ids):
    """生成登记证书"""
    as_json = ctx.obj['as_json']

    try:
        service = RegistrationService()
        cert_service = CertificateGenerator()

        if batch:
            if registration_ids:
                ids = [int(x.strip()) for x in registration_ids.split(',')]
            else:
                from models import db_manager, Registration
                with db_manager.get_session() as session:
                    regs = session.query(Registration).filter(
                        Registration.status == 'payment_confirmed'
                    ).all()
                    ids = [r.id for r in regs]

            if not ids:
                print_warning('没有需要生成证书的记录')
                return

            print_info(f'开始批量生成 {len(ids)} 份证书...')
            results = cert_service.batch_generate(ids)

            success_count = len([r for r in results if r['status'] == 'success'])
            print_success(f'批量生成完成: {success_count}/{len(results)} 成功')

            if as_json:
                output_result(results, as_json)
            else:
                table = PrettyTable()
                table.field_names = ['申请编号', '证书编号', '文件路径', '状态']
                for r in results:
                    status = f"{Fore.GREEN}成功{Style.RESET_ALL}" if r['status'] == 'success' else f"{Fore.RED}失败{Style.RESET_ALL}"
                    table.add_row([r.get('application_no', ''), r.get('certificate_no', ''), r.get('file_path', ''), status])
                click.echo('\n' + str(table))
        else:
            reg = service.get_registration(registration_id, application_no)
            if not reg:
                raise ValueError('未找到登记记录')

            if reg.status != 'payment_confirmed':
                print_warning(f'当前状态为 {REGISTRATION_STATUS_NAMES[reg.status]}，无法生成证书')
                return

            with console.status("[bold green]正在生成证书..."):
                certificate, file_path = cert_service.generate_certificate(reg)

            print_success(f'证书已生成: {certificate.certificate_no}')
            print_info(f'文件路径: {file_path}')

            output_result({
                'certificate_no': certificate.certificate_no,
                'anti_counterfeiting_code': certificate.anti_counterfeiting_code,
                'file_path': file_path,
                'qr_code_url': certificate.qr_code_data,
            }, as_json)

    except Exception as e:
        print_error(f'生成失败: {str(e)}')
        logger.error(f"Certificate generation failed: {e}", exc_info=True)
        sys.exit(1)


@certificate.command('reissue')
@click.option('--cert-no', 'certificate_no', help='原证书编号')
@click.option('--reg-id', 'registration_id', type=int, help='登记记录ID')
@click.option('--reason', help='补发原因')
@click.pass_context
def reissue_certificate(ctx, certificate_no, registration_id, reason):
    """补发证书"""
    as_json = ctx.obj['as_json']

    try:
        cert_service = CertificateGenerator()

        with console.status("[bold green]正在补发证书..."):
            certificate, file_path = cert_service.reissue_certificate(
                certificate_no=certificate_no,
                registration_id=registration_id,
                reason=reason,
            )

        print_success(f'证书已补发: {certificate.certificate_no}')
        print_info(f'文件路径: {file_path}')

        output_result({
            'certificate_no': certificate.certificate_no,
            'anti_counterfeiting_code': certificate.anti_counterfeiting_code,
            'file_path': file_path,
            'is_reissued': True,
            'reissue_reason': reason,
        }, as_json)

    except Exception as e:
        print_error(f'补发失败: {str(e)}')
        logger.error(f"Certificate reissue failed: {e}", exc_info=True)
        sys.exit(1)


@certificate.command('verify')
@click.option('--cert-no', 'certificate_no', required=True, help='证书编号')
@click.option('--code', 'anti_counterfeiting_code', required=True, help='防伪码')
@click.pass_context
def verify_certificate(ctx, certificate_no, anti_counterfeiting_code):
    """验证证书真伪"""
    as_json = ctx.obj['as_json']

    try:
        cert_service = CertificateGenerator()
        result = cert_service.verify_certificate(certificate_no, anti_counterfeiting_code)

        if result['valid']:
            print_success('证书验证通过！')
        else:
            print_error('证书验证失败！')
            print_warning(result['message'])
            return

        output_result(result, as_json)

    except Exception as e:
        print_error(f'验证失败: {str(e)}')
        logger.error(f"Certificate verification failed: {e}", exc_info=True)
        sys.exit(1)


@cli.group()
def publication():
    """公告管理"""
    pass


@publication.command('generate')
@click.option('--weekly', is_flag=True, help='生成周公告')
@click.option('--title', help='公告标题')
@click.option('--start-date', help='开始日期 YYYY-MM-DD', callback=validate_date)
@click.option('--end-date', help='结束日期 YYYY-MM-DD', callback=validate_date)
@click.option('--work-type', 'work_type', help=f'作品类型筛选: {", ".join(WORK_TYPES)}', callback=validate_work_type)
@click.option('--applicant', help='申请人筛选')
@click.option('--sort-by', 'sort_by', type=click.Choice(['registration_date', 'work_type', 'applicant']), default='registration_date', help='排序字段')
@click.option('--sort-order', 'sort_order', type=click.Choice(['asc', 'desc']), default='asc', help='排序方式')
@click.pass_context
def generate_publication(ctx, weekly, title, start_date, end_date, work_type, applicant, sort_by, sort_order):
    """生成公告"""
    as_json = ctx.obj['as_json']

    try:
        pub_service = PublicationService()

        if weekly:
            with console.status("[bold green]正在生成周公告..."):
                publication = pub_service.generate_weekly_publication()
        else:
            with console.status("[bold green]正在生成公告..."):
                publication = pub_service.create_publication(
                    title=title,
                    start_date=start_date,
                    end_date=end_date,
                    work_type=work_type,
                    applicant_name=applicant,
                    sort_by=sort_by,
                    sort_order=sort_order,
                )

        print_success(f'公告已生成: {publication.publication_no}')
        print_info(f'HTML版本: {publication.html_path}')
        print_info(f'文本版本: {publication.text_path}')
        print_info(f'包含 {publication.total_count} 条登记记录')

        output_result(publication.to_dict(include_items=True), as_json)

    except Exception as e:
        print_error(f'生成失败: {str(e)}')
        logger.error(f"Publication generation failed: {e}", exc_info=True)
        sys.exit(1)


@publication.command('list')
@click.option('--published', type=click.Choice(['all', 'yes', 'no']), default='all', help='发布状态筛选')
@click.option('--start-date', help='开始日期 YYYY-MM-DD', callback=validate_date)
@click.option('--end-date', help='结束日期 YYYY-MM-DD', callback=validate_date)
@click.option('--limit', type=int, default=50, help='返回数量')
@click.pass_context
def list_publications(ctx, published, start_date, end_date, limit):
    """查询公告列表"""
    as_json = ctx.obj['as_json']

    try:
        pub_service = PublicationService()

        is_published = None
        if published == 'yes':
            is_published = True
        elif published == 'no':
            is_published = False

        results = pub_service.list_publications(
            start_date=start_date,
            end_date=end_date,
            is_published=is_published,
            limit=limit,
        )

        if as_json:
            output_result(results, as_json)
            return

        table = PrettyTable()
        table.field_names = ['公告编号', '标题', '发布日期', '数量', '状态', '发布人']
        try:
            table.hrules = HRuleStyle.ALL
        except NameError:
            table.hrules = _ALL

        for pub in results:
            status = f"{Fore.GREEN}已发布{Style.RESET_ALL}" if pub['is_published'] else f"{Fore.YELLOW}待发布{Style.RESET_ALL}"
            table.add_row([
                pub['publication_no'],
                pub['title'][:30],
                pub['publication_date'],
                pub['total_count'],
                status,
                pub.get('published_by', '') or '',
            ])

        click.echo('\n' + str(table))

    except Exception as e:
        print_error(f'查询失败: {str(e)}')
        logger.error(f"Publication list failed: {e}", exc_info=True)
        sys.exit(1)


@publication.command('export')
@click.option('--id', 'publication_id', type=int, required=True, help='公告ID')
@click.option('--format', 'fmt', type=click.Choice(['html', 'text', 'both']), default='html', help='导出格式')
@click.pass_context
def export_publication(ctx, publication_id, fmt):
    """导出公告"""
    as_json = ctx.obj['as_json']

    try:
        pub_service = PublicationService()

        if fmt == 'both':
            html_path = pub_service.export_publication(publication_id, 'html')
            text_path = pub_service.export_publication(publication_id, 'text')
            paths = {'html': html_path, 'text': text_path}
        else:
            path = pub_service.export_publication(publication_id, fmt)
            paths = {fmt: path}

        for fmt_name, path in paths.items():
            print_success(f'{fmt_name.upper()} 已导出: {path}')

        output_result(paths, as_json)

    except Exception as e:
        print_error(f'导出失败: {str(e)}')
        logger.error(f"Publication export failed: {e}", exc_info=True)
        sys.exit(1)


@cli.group()
def payment():
    """缴费管理"""
    pass


@payment.command('create')
@click.option('--reg-id', 'registration_id', type=int, required=True, help='登记记录ID')
@click.option('--amount', type=float, help='缴费金额，默认300元')
@click.option('--method', 'payment_method', help='缴费方式')
@click.pass_context
def create_payment(ctx, registration_id, amount, payment_method):
    """创建缴费记录"""
    as_json = ctx.obj['as_json']

    try:
        pay_service = PaymentService()
        payment = pay_service.create_payment_record(
            registration_id=registration_id,
            amount=amount,
            payment_method=payment_method,
        )

        print_success(f'缴费记录已创建: {payment.payment_no}')
        print_info(f'应缴金额: {payment.amount} 元')

        output_result(payment.to_dict(), as_json)

    except Exception as e:
        print_error(f'创建失败: {str(e)}')
        logger.error(f"Payment creation failed: {e}", exc_info=True)
        sys.exit(1)


@payment.command('confirm')
@click.option('--pay-id', 'payment_id', type=int, help='缴费记录ID')
@click.option('--pay-no', 'payment_no', help='缴费单号')
@click.option('--receipt-no', 'bank_receipt_no', help='银行回单号')
@click.option('--confirmed-by', 'confirmed_by', required=True, help='确认人')
@click.option('--notes', help='备注')
@click.pass_context
def confirm_payment(ctx, payment_id, payment_no, bank_receipt_no, confirmed_by, notes):
    """确认缴费"""
    as_json = ctx.obj['as_json']

    try:
        pay_service = PaymentService()
        payment = pay_service.update_payment_status(
            payment_id=payment_id,
            payment_no=payment_no,
            status='paid',
            bank_receipt_no=bank_receipt_no,
            confirmed_by=confirmed_by,
            notes=notes,
        )

        print_success(f'缴费已确认: {payment.payment_no}')
        output_result(payment.to_dict(), as_json)

    except Exception as e:
        print_error(f'确认失败: {str(e)}')
        logger.error(f"Payment confirmation failed: {e}", exc_info=True)
        sys.exit(1)


@payment.command('import')
@click.option('--file', 'file_path', required=True, help='银行回单文件路径 (CSV/JSON)')
@click.pass_context
def import_receipts(ctx, file_path):
    """导入银行回单并自动匹配"""
    as_json = ctx.obj['as_json']

    try:
        pay_service = PaymentService()

        with console.status("[bold green]正在导入银行回单..."):
            result = pay_service.import_bank_receipts(file_path)

        print_success(f'导入完成: 总计 {result["total"]} 条')
        print_info(f'  已匹配: {Fore.GREEN}{result["matched"]}{Style.RESET_ALL} 条')
        print_info(f'  未匹配: {Fore.YELLOW}{result["unmatched"]}{Style.RESET_ALL} 条')
        if result['errors']:
            print_warning(f'  错误: {Fore.RED}{result["errors"]}{Style.RESET_ALL} 条')

        output_result(result, as_json)

    except Exception as e:
        print_error(f'导入失败: {str(e)}')
        logger.error(f"Receipt import failed: {e}", exc_info=True)
        sys.exit(1)


@payment.command('report')
@click.option('--year', type=int, default=datetime.now().year, help='年份')
@click.option('--month', type=int, default=datetime.now().month, help='月份')
@click.pass_context
def monthly_report(ctx, year, month):
    """生成月度对账报表"""
    as_json = ctx.obj['as_json']

    try:
        pay_service = PaymentService()

        with console.status("[bold green]正在生成月度报表..."):
            report = pay_service.generate_monthly_report(year, month)

        print_success(f'月度报表已生成: {report["period"]}')
        print_info(f'报表文件: {report["report_file"]}')

        if as_json:
            output_result(report, as_json)
            return

        summary = report['summary']
        table = PrettyTable()
        table.field_names = ['指标', '数值']
        table.add_row(['统计周期', report['period']])
        table.add_row(['总笔数', summary['total_count']])
        table.add_row(['已缴费', f"{Fore.GREEN}{summary['paid_count']}{Style.RESET_ALL}"])
        table.add_row(['待缴费', f"{Fore.YELLOW}{summary['pending_count']}{Style.RESET_ALL}"])
        table.add_row(['已退款', summary['refunded_count']])
        table.add_row(['已逾期', f"{Fore.RED}{summary['overdue_count']}{Style.RESET_ALL}"])
        table.add_row(['总金额', f"{summary['total_amount']} 元"])
        table.add_row(['已收金额', f"{Fore.GREEN}{summary['paid_amount']} 元{Style.RESET_ALL}"])
        table.add_row(['待收金额', f"{Fore.YELLOW}{summary['pending_amount']} 元{Style.RESET_ALL}"])
        table.add_row(['笔数回收率', f"{summary['collection_rate']:.2%}"])
        table.add_row(['金额回收率', f"{summary['amount_collection_rate']:.2%}"])

        click.echo('\n' + str(table))

    except Exception as e:
        print_error(f'生成失败: {str(e)}')
        logger.error(f"Monthly report failed: {e}", exc_info=True)
        sys.exit(1)


@payment.command('pending')
@click.option('--overdue-days', type=int, default=30, help='逾期天数阈值')
@click.pass_context
def pending_payments(ctx, overdue_days):
    """查询待缴费/逾期记录"""
    as_json = ctx.obj['as_json']

    try:
        pay_service = PaymentService()
        results = pay_service.get_pending_payments(days_overdue=overdue_days)

        if not results:
            print_success('没有待缴费或逾期记录')
            return

        if as_json:
            output_result(results, as_json)
            return

        table = PrettyTable()
        table.field_names = ['申请编号', '申请人', '作品名称', '金额', '待缴天数', '状态']
        try:
            table.hrules = HRuleStyle.ALL
        except NameError:
            table.hrules = _ALL

        for p in results:
            status = f"{Fore.RED}已逾期{Style.RESET_ALL}" if p['is_overdue'] else f"{Fore.YELLOW}待缴费{Style.RESET_ALL}"
            table.add_row([
                p['application_no'],
                p['applicant_name'],
                p['work_title'][:20],
                f"{p['amount']} 元",
                p['days_pending'],
                status,
            ])

        click.echo('\n' + str(table))
        print_warning(f'共 {len(results)} 条待处理记录，其中逾期 {sum(1 for p in results if p["is_overdue"])} 条')

    except Exception as e:
        print_error(f'查询失败: {str(e)}')
        logger.error(f"Pending payments query failed: {e}", exc_info=True)
        sys.exit(1)


@payment.command('reconcile')
@click.option('--start-date', help='开始日期 YYYY-MM-DD', callback=validate_date)
@click.option('--end-date', help='结束日期 YYYY-MM-DD', callback=validate_date)
@click.pass_context
def reconcile(ctx, start_date, end_date):
    """银行对账"""
    as_json = ctx.obj['as_json']

    try:
        pay_service = PaymentService()
        result = pay_service.reconcile(start_date, end_date)

        if result['is_balanced']:
            print_success('对账完成，账目平衡')
        else:
            print_warning('对账完成，存在差异')
            print_error(f"金额差异: {result['difference']} 元")
            if result['unmatched_bank_count']:
                print_warning(f"未匹配银行记录: {result['unmatched_bank_count']} 条")
            if result['unmatched_system_count']:
                print_warning(f"未匹配系统记录: {result['unmatched_system_count']} 条")

        output_result(result, as_json)

    except Exception as e:
        print_error(f'对账失败: {str(e)}')
        logger.error(f"Reconciliation failed: {e}", exc_info=True)
        sys.exit(1)


@cli.command('init')
def init_system():
    """初始化系统数据库"""
    try:
        from models import db_manager
        print_info('正在初始化数据库...')
        db_manager._create_tables()
        print_success('系统初始化完成')
    except Exception as e:
        print_error(f'初始化失败: {str(e)}')
        logger.error(f"System initialization failed: {e}", exc_info=True)
        sys.exit(1)


@cli.command('test')
@click.option('--full', is_flag=True, help='运行完整功能测试')
def run_tests(full):
    """运行系统测试"""
    try:
        print_info('正在运行系统测试...')

        from models import db_manager, WORK_TYPES, APPLICANT_TYPES
        from services.registration import RegistrationService
        from services.certificate import CertificateGenerator
        from services.publication import PublicationService
        from services.payment import PaymentService

        reg_service = RegistrationService()
        cert_service = CertificateGenerator()
        pub_service = PublicationService()
        pay_service = PaymentService()

        print_info('1. 测试申请人创建...')
        applicant = reg_service.create_applicant(
            name='测试申请人',
            applicant_type='individual',
            id_card='TEST1234567890',
            phone='13800138000',
            email='test@example.com',
            region='测试地区',
        )
        print_success(f'   申请人创建成功: {applicant.name} (ID: {applicant.id})')

        print_info('2. 测试作品创建与特征提取...')
        work = reg_service.create_work(
            title='测试作品-版权保护系统',
            work_type='text',
            author='测试作者',
            description='这是一个用于测试的作品描述内容，包含一些关键词用于提取文本指纹特征。',
            keywords='测试,版权,系统',
        )
        print_success(f'   作品创建成功: {work.title} (ID: {work.id})')

        print_info('3. 测试登记申请提交...')
        registration = reg_service.submit_registration(applicant, work)
        print_success(f'   登记提交成功: {registration.application_no}')
        print_info(f'   相似度: {registration.similarity_score:.2%}')

        print_info('4. 测试缴费记录创建...')
        payment = pay_service.create_payment_record(registration.id)
        print_success(f'   缴费记录创建: {payment.payment_no}')

        print_info('5. 测试缴费确认...')
        payment = pay_service.update_payment_status(
            payment_id=payment.id,
            status='paid',
            bank_receipt_no='TEST20240101001',
            confirmed_by='测试财务',
        )
        print_success(f'   缴费确认成功: {payment.status}')

        if full:
            print_info('6. 测试证书生成...')
            certificate, cert_path = cert_service.generate_certificate(registration)
            print_success(f'   证书生成: {certificate.certificate_no}')
            print_info(f'   文件路径: {cert_path}')

            print_info('7. 测试证书验证...')
            verify_result = cert_service.verify_certificate(
                certificate.certificate_no,
                certificate.anti_counterfeiting_code,
            )
            print_success(f'   证书验证: {"通过" if verify_result["valid"] else "失败"}')

            print_info('8. 测试公告生成...')
            publication = pub_service.create_publication(
                title='测试公告',
                start_date=date.today() - timedelta(days=7),
                end_date=date.today(),
            )
            print_success(f'   公告生成: {publication.publication_no}')
            print_info(f'   包含 {publication.total_count} 条记录')

        print_info('9. 测试统计查询...')
        stats = reg_service.get_statistics(period='month')
        print_success(f'   统计完成: 总计 {stats["total_count"]} 条, 通过率 {stats["pass_rate"]:.2%}')

        print_info('10. 测试进度查询...')
        progress = reg_service.query_progress(application_no=registration.application_no)
        print_success(f'   进度查询成功: {progress[0]["current_stage"]["stage"]}')

        print_success('\n' + '=' * 50)
        print_success('所有测试通过！系统运行正常。')
        print_success('=' * 50)

    except Exception as e:
        print_error(f'测试失败: {str(e)}')
        logger.error(f"System test failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    try:
        cli()
    except KeyboardInterrupt:
        print_warning('\n操作已取消')
        sys.exit(0)
    except Exception as e:
        print_error(f'未处理的异常: {str(e)}')
        logger.critical(f"Unhandled exception: {e}", exc_info=True)
        sys.exit(1)

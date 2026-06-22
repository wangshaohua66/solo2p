import os
import io
import time
import hashlib
import secrets
import string
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from pathlib import Path

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, Flowable
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from jinja2 import Environment, FileSystemLoader

from models import (
    db_manager, Registration, Certificate,
    WORK_TYPE_NAMES
)
from utils.config import config
from utils.logger import get_logger

logger = get_logger(__name__)


class CertificateGenerator:
    def __init__(self):
        self.output_dir = Path(config.get('certificate.output_dir', 'data/certificates'))
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.watermark_text = config.get('certificate.watermark_text', '版权保护中心')
        self.qr_size = config.get('certificate.qr_size', 100)
        self.anti_counterfeiting_length = config.get('certificate.anti_counterfeiting_length', 16)
        self.qr_base_url = config.get('verification.qr_base_url', 'https://verify.copyright.gov.cn')

        self._register_fonts()
        self._setup_templates()

    def _register_fonts(self) -> None:
        font_paths = [
            '/System/Library/Fonts/PingFang.ttc',
            '/System/Library/Fonts/STHeiti Light.ttc',
            '/System/Library/Fonts/Hiragino Sans GB.ttc',
            'C:/Windows/Fonts/simhei.ttf',
            'C:/Windows/Fonts/msyh.ttf',
            '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
            '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        ]

        self.font_name = 'Helvetica'
        self.font_bold = 'Helvetica-Bold'

        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    pdfmetrics.registerFont(TTFont('CustomFont', font_path))
                    self.font_name = 'CustomFont'
                    self.font_bold = 'CustomFont'
                    logger.info(f"Registered font: {font_path}")
                    break
                except Exception as e:
                    logger.warning(f"Failed to register font {font_path}: {e}")

    def _setup_templates(self) -> None:
        template_dir = Path(config.get('templates.certificate_dir', 'data/templates'))
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=False
        )

    def _generate_anti_counterfeiting_code(self, registration: Registration) -> str:
        raw = f"{registration.application_no}{registration.work_id}{registration.applicant_id}{datetime.now().isoformat()}"
        hash_part = hashlib.sha256(raw.encode()).hexdigest()[:8]
        random_part = secrets.choice(string.ascii_uppercase + string.digits)
        for _ in range(self.anti_counterfeiting_length - 9):
            random_part += secrets.choice(string.ascii_uppercase + string.digits)
        return f"{hash_part}{random_part}"

    def _generate_certificate_no(self, registration: Registration) -> str:
        year = datetime.now().year
        work_type_code = {
            'text': '01',
            'art': '02',
            'music': '03',
            'audiovisual': '04',
        }.get(registration.work.work_type if registration.work else 'text', '00')

        with db_manager.get_session() as session:
            count = session.query(Certificate).filter(
                Certificate.certificate_no.like(f'CR{year}{work_type_code}%')
            ).count() + 1

        return f'CR{year}{work_type_code}{count:08d}'

    def _generate_qr_code(self, certificate_no: str, anti_counterfeiting_code: str) -> io.BytesIO:
        verify_url = f"{self.qr_base_url}/verify?no={certificate_no}&code={anti_counterfeiting_code}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=2,
        )
        qr.add_data(verify_url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        return img_bytes

    def _add_watermark(self, canvas_obj: canvas.Canvas, doc) -> None:
        canvas_obj.saveState()
        canvas_obj.setFont(self.font_name, 60)
        canvas_obj.setFillColor(colors.lightgrey)
        canvas_obj.translate(300, 400)
        canvas_obj.rotate(45)
        canvas_obj.drawCentredString(0, 0, self.watermark_text)
        canvas_obj.restoreState()

        canvas_obj.saveState()
        canvas_obj.setFont(self.font_name, 8)
        canvas_obj.setFillColor(colors.grey)
        canvas_obj.drawRightString(
            A4[0] - 20 * mm,
            15 * mm,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        canvas_obj.restoreState()

    def generate_certificate(self, registration: Registration, is_reissue: bool = False,
                             reissue_reason: str = None) -> Tuple[Certificate, str]:
        if not registration.work or not registration.applicant:
            raise ValueError("Registration must have associated work and applicant")

        if not os.access(self.output_dir, os.W_OK):
            raise PermissionError(f"No write permission for certificate directory: {self.output_dir}")

        certificate_no = self._generate_certificate_no(registration)
        anti_counterfeiting_code = self._generate_anti_counterfeiting_code(registration)
        qr_bytes = self._generate_qr_code(certificate_no, anti_counterfeiting_code)

        output_file = self.output_dir / f"{certificate_no}.pdf"

        doc = SimpleDocTemplate(
            str(output_file),
            pagesize=A4,
            leftMargin=25 * mm,
            rightMargin=25 * mm,
            topMargin=20 * mm,
            bottomMargin=20 * mm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Title'],
            fontName=self.font_bold,
            fontSize=24,
            textColor=colors.black,
            alignment=TA_CENTER,
            spaceAfter=5 * mm,
        )
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Heading2'],
            fontName=self.font_name,
            fontSize=16,
            textColor=colors.darkblue,
            alignment=TA_CENTER,
            spaceAfter=8 * mm,
        )
        normal_style = ParagraphStyle(
            'CustomNormal',
            parent=styles['BodyText'],
            fontName=self.font_name,
            fontSize=12,
            textColor=colors.black,
            leading=18,
            alignment=TA_LEFT,
        )
        right_style = ParagraphStyle(
            'CustomRight',
            parent=styles['BodyText'],
            fontName=self.font_name,
            fontSize=11,
            textColor=colors.black,
            alignment=TA_RIGHT,
        )
        label_style = ParagraphStyle(
            'CustomLabel',
            parent=styles['BodyText'],
            fontName=self.font_name,
            fontSize=11,
            textColor=colors.grey,
            leading=16,
        )
        value_style = ParagraphStyle(
            'CustomValue',
            parent=styles['BodyText'],
            fontName=self.font_bold,
            fontSize=12,
            textColor=colors.black,
            leading=16,
        )

        story = []

        story.append(Paragraph('著作权登记证书', title_style))
        story.append(Paragraph('COPYRIGHT REGISTRATION CERTIFICATE', subtitle_style))

        if is_reissue:
            story.append(Paragraph(f'<font color="red">【补发】</font>', right_style))
            story.append(Spacer(1, 3 * mm))

        story.append(Spacer(1, 5 * mm))

        work_type_name = WORK_TYPE_NAMES.get(registration.work.work_type, '未知类型')
        issue_date = registration.issue_date or datetime.now()

        info_data = [
            [Paragraph('证书编号：', label_style),
             Paragraph(certificate_no, value_style),
             Paragraph('', label_style),
             Paragraph('登记类型：', label_style),
             Paragraph(work_type_name, value_style)],
            [Paragraph('作品名称：', label_style),
             Paragraph(registration.work.title or '', value_style),
             '', '', ''],
            [Paragraph('著作权人：', label_style),
             Paragraph(registration.applicant.name or '', value_style),
             '', '', ''],
            [Paragraph('作者姓名：', label_style),
             Paragraph(registration.work.author or '', value_style),
             '', '', ''],
            [Paragraph('创作完成日期：', label_style),
             Paragraph(registration.work.creation_date.strftime('%Y年%m月%d日') if registration.work.creation_date else '-', value_style),
             '', '', ''],
            [Paragraph('首次发表日期：', label_style),
             Paragraph(registration.work.publication_date.strftime('%Y年%m月%d日') if registration.work.publication_date else '未发表', value_style),
             '', '', ''],
            [Paragraph('申请日期：', label_style),
             Paragraph(registration.submission_date.strftime('%Y年%m月%d日') if registration.submission_date else '-', value_style),
             '', '', ''],
            [Paragraph('发证日期：', label_style),
             Paragraph(issue_date.strftime('%Y年%m月%d日'), value_style),
             '', '', ''],
        ]

        col_widths = [25 * mm, 50 * mm, 10 * mm, 25 * mm, 40 * mm]
        info_table = Table(info_data, colWidths=col_widths)
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.font_name),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        story.append(info_table)

        story.append(Spacer(1, 8 * mm))

        description_text = (
            f"上述作品由 <b>{registration.applicant.name}</b> 申请登记，"
            f"经本机关依法审查，确认该作品由 <b>{registration.work.author or registration.applicant.name}</b> 创作完成，"
            f"著作权归 <b>{registration.applicant.name}</b> 所有。"
            f"根据《中华人民共和国著作权法》规定，特发此证。"
        )
        story.append(Paragraph(description_text, normal_style))

        story.append(Spacer(1, 15 * mm))

        qr_img = Image(qr_bytes, width=self.qr_size * 0.35, height=self.qr_size * 0.35)

        qr_data = [
            [qr_img, Paragraph(f'防伪码：{anti_counterfeiting_code}<br/>'
                               f'扫码验证：{self.qr_base_url}', right_style)],
        ]
        qr_table = Table(qr_data, colWidths=[40 * mm, 110 * mm])
        qr_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'CENTER'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        story.append(qr_table)

        story.append(Spacer(1, 10 * mm))

        seal_data = [
            [Paragraph('', normal_style),
             Paragraph('省级版权保护中心', value_style)],
            [Paragraph('', normal_style),
             Paragraph(f'（盖章）', normal_style)],
            [Paragraph('', normal_style),
             Paragraph(issue_date.strftime('%Y年%m月%d日'), normal_style)],
        ]
        seal_table = Table(seal_data, colWidths=[80 * mm, 70 * mm])
        seal_table.setStyle(TableStyle([
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(seal_table)

        doc.build(story, onFirstPage=self._add_watermark, onLaterPages=self._add_watermark)

        with db_manager.get_session() as session:
            certificate = Certificate(
                registration_id=registration.id,
                certificate_no=certificate_no,
                anti_counterfeiting_code=anti_counterfeiting_code,
                qr_code_data=f"{self.qr_base_url}/verify?no={certificate_no}&code={anti_counterfeiting_code}",
                file_path=str(output_file),
                issued_date=issue_date,
                is_reissued=is_reissue,
                reissue_reason=reissue_reason,
            )
            session.add(certificate)
            session.flush()
            _ = certificate.certificate_no, certificate.id, certificate.anti_counterfeiting_code, certificate.issued_date
            session.expunge(certificate)

        logger.info(f"Certificate generated: {certificate_no} -> {output_file}")
        return certificate, str(output_file)

    def batch_generate(self, registration_ids: List[int]) -> List[Dict]:
        results = []
        start_time = time.time()
        target_rate = config.get('performance.certificate_rate', 100)

        with db_manager.get_session() as session:
            registrations = session.query(Registration).filter(
                Registration.id.in_(registration_ids),
                Registration.status == 'payment_confirmed'
            ).all()
            
            reg_dicts = []
            for reg in registrations:
                _ = reg.id, reg.application_no, reg.status, reg.work_id, reg.applicant_id
                if reg.work:
                    _ = reg.work.title, reg.work.work_type, reg.work.creation_date, reg.work.author, reg.work.description
                    session.expunge(reg.work)
                if reg.applicant:
                    _ = reg.applicant.name, reg.applicant.id_card, reg.applicant.applicant_type
                    session.expunge(reg.applicant)
                session.expunge(reg)
                reg_dicts.append(reg)

        for i, reg in enumerate(reg_dicts, 1):
            item_start = time.time()
            try:
                cert, path = self.generate_certificate(reg)
                results.append({
                    'registration_id': reg.id,
                    'application_no': reg.application_no,
                    'certificate_no': cert.certificate_no,
                    'file_path': path,
                    'status': 'success',
                })

                with db_manager.get_session() as session:
                    registration = session.query(Registration).get(reg.id)
                    if registration:
                        registration.status = 'certificate_issued'
                        registration.issue_date = datetime.now()

            except Exception as e:
                logger.error(f"Failed to generate certificate for registration {reg.id}: {e}")
                results.append({
                    'registration_id': reg.id,
                    'application_no': reg.application_no if reg else '',
                    'status': 'failed',
                    'error': str(e),
                })

            elapsed = time.time() - item_start
            if i % 10 == 0:
                avg_rate = i / (time.time() - start_time)
                logger.info(f"Batch progress: {i}/{len(registrations)}, rate: {avg_rate:.1f}/min, target: {target_rate}/min")

        total_time = time.time() - start_time
        total_count = len([r for r in results if r['status'] == 'success'])
        avg_rate = (total_count / total_time * 60) if total_time > 0 else 0

        logger.info(f"Batch certificate generation completed: {total_count}/{len(registrations)} "
                    f"success, average rate: {avg_rate:.1f}/min")

        if avg_rate < target_rate and total_count > 10:
            logger.warning(f"Generation rate {avg_rate:.1f}/min below target {target_rate}/min")

        return results

    def reissue_certificate(self, certificate_no: str = None, registration_id: int = None,
                             reason: str = None) -> Tuple[Certificate, str]:
        with db_manager.get_session() as session:
            if certificate_no:
                old_cert = session.query(Certificate).filter_by(
                    certificate_no=certificate_no
                ).first()
            elif registration_id:
                old_cert = session.query(Certificate).filter_by(
                    registration_id=registration_id
                ).order_by(Certificate.created_at.desc()).first()
            else:
                raise ValueError("Either certificate_no or registration_id must be provided")

            if not old_cert:
                raise ValueError("Certificate not found")

            registration = session.query(Registration).get(old_cert.registration_id)
            if not registration:
                raise ValueError("Associated registration not found")

        return self.generate_certificate(registration, is_reissue=True, reissue_reason=reason)

    def verify_certificate(self, certificate_no: str, anti_counterfeiting_code: str) -> Dict:
        with db_manager.get_session() as session:
            certificate = session.query(Certificate).filter_by(
                certificate_no=certificate_no,
                anti_counterfeiting_code=anti_counterfeiting_code
            ).first()

            if not certificate:
                return {
                    'valid': False,
                    'message': '证书编号或防伪码不匹配',
                }

            registration = session.query(Registration).get(certificate.registration_id)
            if not registration:
                return {
                    'valid': False,
                    'message': '关联登记记录不存在',
                }

            return {
                'valid': True,
                'message': '证书验证通过',
                'certificate': certificate.to_dict(),
                'registration': registration.to_dict(include_details=True),
            }

    def get_certificate(self, certificate_no: str = None, registration_id: int = None) -> Optional[Certificate]:
        with db_manager.get_session() as session:
            cert = None
            if certificate_no:
                cert = session.query(Certificate).filter_by(certificate_no=certificate_no).first()
            elif registration_id:
                cert = session.query(Certificate).filter_by(
                    registration_id=registration_id
                ).order_by(Certificate.created_at.desc()).first()
            
            if cert:
                _ = cert.certificate_no, cert.id, cert.anti_counterfeiting_code, cert.issued_date, cert.registration_id
                session.expunge(cert)
            return cert

    def list_certificates(self, start_date: datetime = None, end_date: datetime = None,
                          is_reissued: bool = None, limit: int = 100, offset: int = 0) -> List[Dict]:
        with db_manager.get_session() as session:
            query = session.query(Certificate)

            if start_date:
                query = query.filter(Certificate.issued_date >= start_date)
            if end_date:
                query = query.filter(Certificate.issued_date <= end_date)
            if is_reissued is not None:
                query = query.filter(Certificate.is_reissued == is_reissued)

            certificates = query.order_by(Certificate.issued_date.desc()).offset(offset).limit(limit).all()
            return [cert.to_dict() for cert in certificates]

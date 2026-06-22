import os
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from models import (
    db_manager, Registration, Publication, PublicationItem,
    WORK_TYPE_NAMES, APPLICANT_TYPE_NAMES
)
from utils.config import config
from utils.logger import get_logger

logger = get_logger(__name__)


class PublicationService:
    def __init__(self):
        self.output_dir = Path(config.get('publication.output_dir', 'data/publications'))
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.weekly_day = config.get('publication.weekly_day', 5)
        self.default_format = config.get('publication.default_format', 'html')

        template_dir = Path(config.get('templates.publication_dir', 'data/templates'))
        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True,
        )

    def _generate_publication_no(self, pub_date: date) -> str:
        year = pub_date.year
        with db_manager.get_session() as session:
            count = session.query(Publication).filter(
                Publication.publication_no.like(f'PUB{year}%')
            ).count() + 1
        return f'PUB{year}{count:06d}'

    def _get_week_range(self, ref_date: date = None) -> Tuple[date, date]:
        ref_date = ref_date or date.today()
        days_since_monday = ref_date.weekday()
        start_date = ref_date - timedelta(days=days_since_monday)
        end_date = start_date + timedelta(days=6)
        return start_date, end_date

    def get_candidate_registrations(self, start_date: date = None, end_date: date = None,
                                    work_type: str = None, applicant_name: str = None,
                                    sort_by: str = 'registration_date',
                                    sort_order: str = 'asc') -> List[Dict]:
        if start_date is None or end_date is None:
            start_date, end_date = self._get_week_range()

        with db_manager.get_session() as session:
            query = session.query(Registration).filter(
                Registration.status == 'certificate_issued',
                Registration.issue_date >= datetime.combine(start_date, datetime.min.time()),
                Registration.issue_date <= datetime.combine(end_date, datetime.max.time()),
            )

            if work_type:
                query = query.join(Registration.work).filter(
                    getattr(Registration.work.property.mapper.class_, 'work_type') == work_type
                )

            if applicant_name:
                query = query.join(Registration.applicant).filter(
                    getattr(Registration.applicant.property.mapper.class_, 'name').like(f'%{applicant_name}%')
                )

            if sort_by == 'registration_date':
                order_col = Registration.issue_date
            elif sort_by == 'work_type':
                from models import Work
                query = query.join(Work)
                order_col = Work.work_type
            elif sort_by == 'applicant':
                from models import Applicant
                query = query.join(Applicant)
                order_col = Applicant.name
            else:
                order_col = Registration.issue_date

            if sort_order == 'desc':
                query = query.order_by(order_col.desc())
            else:
                query = query.order_by(order_col.asc())

            registrations = query.all()
            results = []
            for i, reg in enumerate(registrations, 1):
                results.append({
                    'sequence_no': i,
                    'registration_id': reg.id,
                    'application_no': reg.application_no,
                    'work_title': reg.work.title if reg.work else '',
                    'work_type': reg.work.work_type if reg.work else '',
                    'work_type_name': WORK_TYPE_NAMES.get(reg.work.work_type, '') if reg.work else '',
                    'applicant_name': reg.applicant.name if reg.applicant else '',
                    'applicant_type': reg.applicant.applicant_type if reg.applicant else '',
                    'applicant_type_name': APPLICANT_TYPE_NAMES.get(reg.applicant.applicant_type, '') if reg.applicant else '',
                    'registration_date': reg.issue_date.date() if reg.issue_date else None,
                    'certificate_no': reg.certificates[0].certificate_no if reg.certificates else '',
                })
            return results

    def create_publication(self, title: str = None, start_date: date = None,
                           end_date: date = None, work_type: str = None,
                           applicant_name: str = None, sort_by: str = 'registration_date',
                           sort_order: str = 'asc', publication_date: date = None) -> Publication:
        if start_date is None or end_date is None:
            start_date, end_date = self._get_week_range()

        publication_date = publication_date or end_date + timedelta(days=1)
        publication_no = self._generate_publication_no(publication_date)

        if not title:
            title = f"著作权登记公告（{start_date.isoformat()} 至 {end_date.isoformat()}）"

        items = self.get_candidate_registrations(
            start_date=start_date,
            end_date=end_date,
            work_type=work_type,
            applicant_name=applicant_name,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        if not os.access(self.output_dir, os.W_OK):
            raise PermissionError(f"No write permission for publication directory: {self.output_dir}")

        with db_manager.get_session() as session:
            publication = Publication(
                publication_no=publication_no,
                title=title,
                publication_date=publication_date,
                start_date=start_date,
                end_date=end_date,
                total_count=len(items),
            )
            session.add(publication)
            session.flush()

            for item in items:
                pub_item = PublicationItem(
                    publication_id=publication.id,
                    registration_id=item['registration_id'],
                    sequence_no=item['sequence_no'],
                    work_title=item['work_title'],
                    applicant_name=item['applicant_name'],
                    work_type=item['work_type'],
                    registration_date=item['registration_date'],
                )
                session.add(pub_item)

            html_path = self._render_html(publication, items)
            text_path = self._render_text(publication, items)

            publication.html_path = html_path
            publication.text_path = text_path
            
            _ = publication.publication_no, publication.id, publication.title, publication.total_count, publication.html_path, publication.text_path
            session.expunge(publication)

        logger.info(f"Publication created: {publication_no}, {len(items)} items, "
                    f"HTML: {html_path}, TEXT: {text_path}")
        return publication

    def _render_html(self, publication: Publication, items: List[Dict]) -> str:
        output_file = self.output_dir / f"{publication.publication_no}.html"

        template = self.jinja_env.get_template('publication_html.html')
        html_content = template.render(
            publication=publication.to_dict(),
            items=items,
            work_type_names=WORK_TYPE_NAMES,
            generated_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return str(output_file)

    def _render_text(self, publication: Publication, items: List[Dict]) -> str:
        output_file = self.output_dir / f"{publication.publication_no}.txt"

        template = self.jinja_env.get_template('publication_text.txt')
        text_content = template.render(
            publication=publication.to_dict(),
            items=items,
            work_type_names=WORK_TYPE_NAMES,
            generated_at=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        )

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(text_content)

        return str(output_file)

    def regenerate_publication(self, publication_id: int, fmt: str = 'both') -> Dict:
        with db_manager.get_session() as session:
            publication = session.query(Publication).get(publication_id)
            if not publication:
                raise ValueError(f"Publication not found: {publication_id}")

            items = []
            for item in publication.items:
                reg = session.query(Registration).get(item.registration_id)
                items.append({
                    'sequence_no': item.sequence_no,
                    'registration_id': item.registration_id,
                    'application_no': reg.application_no if reg else '',
                    'work_title': item.work_title,
                    'work_type': item.work_type,
                    'work_type_name': WORK_TYPE_NAMES.get(item.work_type, ''),
                    'applicant_name': item.applicant_name,
                    'registration_date': item.registration_date,
                    'certificate_no': reg.certificates[0].certificate_no if reg and reg.certificates else '',
                })

            items.sort(key=lambda x: x['sequence_no'])

            paths = {}
            if fmt in ['html', 'both']:
                paths['html'] = self._render_html(publication, items)
                publication.html_path = paths['html']
            if fmt in ['text', 'both']:
                paths['text'] = self._render_text(publication, items)
                publication.text_path = paths['text']

        logger.info(f"Publication regenerated: {publication.publication_no}, formats: {fmt}")
        return paths

    def mark_published(self, publication_id: int, published_by: str) -> Publication:
        with db_manager.get_session() as session:
            publication = session.query(Publication).get(publication_id)
            if not publication:
                raise ValueError(f"Publication not found: {publication_id}")

            publication.is_published = True
            publication.published_by = published_by
            publication.updated_at = datetime.now()

        logger.info(f"Publication marked as published: {publication.publication_no} by {published_by}")
        return publication

    def get_publication(self, publication_id: int = None, publication_no: str = None,
                        include_items: bool = False) -> Optional[Publication]:
        with db_manager.get_session() as session:
            if publication_id:
                pub = session.query(Publication).get(publication_id)
            elif publication_no:
                pub = session.query(Publication).filter_by(publication_no=publication_no).first()
            else:
                return None

            if pub and include_items:
                _ = pub.items

            return pub

    def list_publications(self, start_date: date = None, end_date: date = None,
                          is_published: bool = None, limit: int = 100,
                          offset: int = 0) -> List[Dict]:
        with db_manager.get_session() as session:
            query = session.query(Publication)

            if start_date:
                query = query.filter(Publication.publication_date >= start_date)
            if end_date:
                query = query.filter(Publication.publication_date <= end_date)
            if is_published is not None:
                query = query.filter(Publication.is_published == is_published)

            publications = query.order_by(Publication.publication_date.desc()).offset(offset).limit(limit).all()
            return [pub.to_dict() for pub in publications]

    def get_weekly_publication(self, week_date: date = None) -> Optional[Publication]:
        start_date, end_date = self._get_week_range(week_date)
        with db_manager.get_session() as session:
            pub = session.query(Publication).filter_by(
                start_date=start_date,
                end_date=end_date
            ).first()
            
            if pub:
                _ = pub.publication_no, pub.id, pub.title, pub.total_count, pub.start_date, pub.end_date
                session.expunge(pub)
            return pub

    def generate_weekly_publication(self) -> Publication:
        start_date, end_date = self._get_week_range()
        existing = self.get_weekly_publication(start_date)
        if existing:
            logger.info(f"Weekly publication already exists: {existing.publication_no}")
            return existing

        return self.create_publication(
            start_date=start_date,
            end_date=end_date,
            publication_date=end_date + timedelta(days=1),
        )

    def export_publication(self, publication_id: int, fmt: str = 'html') -> str:
        if fmt not in ['html', 'text']:
            raise ValueError(f"Invalid format: {fmt}, must be 'html' or 'text'")

        with db_manager.get_session() as session:
            publication = session.query(Publication).get(publication_id)
            if not publication:
                raise ValueError(f"Publication not found: {publication_id}")

            if fmt == 'html' and publication.html_path and os.path.exists(publication.html_path):
                return publication.html_path
            if fmt == 'text' and publication.text_path and os.path.exists(publication.text_path):
                return publication.text_path

            items = []
            for item in publication.items:
                reg = session.query(Registration).get(item.registration_id)
                items.append({
                    'sequence_no': item.sequence_no,
                    'registration_id': item.registration_id,
                    'application_no': reg.application_no if reg else '',
                    'work_title': item.work_title,
                    'work_type': item.work_type,
                    'work_type_name': WORK_TYPE_NAMES.get(item.work_type, ''),
                    'applicant_name': item.applicant_name,
                    'registration_date': item.registration_date,
                    'certificate_no': reg.certificates[0].certificate_no if reg and reg.certificates else '',
                })

            items.sort(key=lambda x: x['sequence_no'])

            if fmt == 'html':
                return self._render_html(publication, items)
            else:
                return self._render_text(publication, items)

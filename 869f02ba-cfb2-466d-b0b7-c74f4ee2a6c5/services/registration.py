import os
import hashlib
import json
import re
import time
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from PIL import Image

from models import (
    db_manager, Applicant, Work, WorkFeature, Registration,
    ReviewRecord, VerificationRecord, WORK_TYPES, WORK_TYPE_NAMES,
    APPLICANT_TYPES, REGISTRATION_STATUS, REGISTRATION_STATUS_NAMES
)
from utils.config import config
from utils.logger import get_logger

logger = get_logger(__name__)


class FeatureExtractor:
    @staticmethod
    def _hash_text(text: str) -> str:
        return hashlib.sha256(text.encode('utf-8')).hexdigest()

    @staticmethod
    def extract_text_fingerprint(content: str) -> Tuple[str, str]:
        cleaned = re.sub(r'[\s\n\r\t]+', ' ', content).strip()
        cleaned = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9\s]', '', cleaned)

        words = cleaned.split()
        freq = {}
        for word in words:
            if len(word) >= 2:
                freq[word] = freq.get(word, 0) + 1

        sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:50]
        fingerprint = '|'.join([f"{w}:{c}" for w, c in sorted_words])
        return fingerprint, FeatureExtractor._hash_text(fingerprint)

    @staticmethod
    def extract_image_phash(image_path: str) -> Tuple[str, str]:
        try:
            img = Image.open(image_path)
            img = img.convert('L').resize((8, 8), Image.LANCZOS)

            pixels = list(img.getdata())
            avg = sum(pixels) / len(pixels)
            bits = ''.join('1' if p > avg else '0' for p in pixels)

            hex_str = ''
            for i in range(0, 64, 4):
                hex_str += hex(int(bits[i:i+4], 2))[2:]

            return hex_str, FeatureExtractor._hash_text(hex_str)
        except Exception as e:
            logger.error(f"Failed to extract image pHash: {e}")
            return '', ''

    @staticmethod
    def extract_audio_fingerprint(audio_path: str) -> Tuple[str, str]:
        try:
            file_size = os.path.getsize(audio_path)
            with open(audio_path, 'rb') as f:
                header = f.read(4096)
                f.seek(file_size // 2)
                middle = f.read(4096)

            data = header + middle
            fingerprint = hashlib.md5(data).hexdigest()
            return fingerprint, FeatureExtractor._hash_text(fingerprint)
        except Exception as e:
            logger.error(f"Failed to extract audio fingerprint: {e}")
            return '', ''

    @staticmethod
    def extract_video_fingerprint(video_path: str) -> Tuple[str, str]:
        try:
            file_size = os.path.getsize(video_path)
            with open(video_path, 'rb') as f:
                header = f.read(8192)
                f.seek(max(0, file_size - 8192))
                end = f.read(8192)

            data = header + end + str(file_size).encode()
            fingerprint = hashlib.sha1(data).hexdigest()
            return fingerprint, FeatureExtractor._hash_text(fingerprint)
        except Exception as e:
            logger.error(f"Failed to extract video fingerprint: {e}")
            return '', ''

    @classmethod
    def extract_features(cls, work_type: str, file_path: Optional[str], content: Optional[str] = None) -> List[Dict]:
        features = []

        if content:
            fp, fp_hash = cls.extract_text_fingerprint(content)
            features.append({
                'feature_type': 'text_fingerprint',
                'feature_value': fp,
                'feature_hash': fp_hash,
            })

        if not file_path or not os.path.exists(file_path):
            return features

        if work_type == 'text' and not content:
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read(100000)
                fp, fp_hash = cls.extract_text_fingerprint(content)
                features.append({
                    'feature_type': 'text_fingerprint',
                    'feature_value': fp,
                    'feature_hash': fp_hash,
                })
            except Exception as e:
                logger.warning(f"Failed to read text file: {e}")

        elif work_type == 'art':
            phash, phash_hash = cls.extract_image_phash(file_path)
            if phash:
                features.append({
                    'feature_type': 'image_phash',
                    'feature_value': phash,
                    'feature_hash': phash_hash,
                })

        elif work_type == 'music':
            afp, afp_hash = cls.extract_audio_fingerprint(file_path)
            if afp:
                features.append({
                    'feature_type': 'audio_fingerprint',
                    'feature_value': afp,
                    'feature_hash': afp_hash,
                })

        elif work_type == 'audiovisual':
            vfp, vfp_hash = cls.extract_video_fingerprint(file_path)
            if vfp:
                features.append({
                    'feature_type': 'video_fingerprint',
                    'feature_value': vfp,
                    'feature_hash': vfp_hash,
                })

        return features


class SimilarityChecker:
    @staticmethod
    def _hamming_distance(hash1: str, hash2: str) -> int:
        try:
            int1 = int(hash1, 16)
            int2 = int(hash2, 16)
            return bin(int1 ^ int2).count('1')
        except ValueError:
            return 999

    @staticmethod
    def _text_similarity(fp1: str, fp2: str) -> float:
        words1 = set(re.findall(r'(\w+):\d+', fp1))
        words2 = set(re.findall(r'(\w+):\d+', fp2))
        if not words1 or not words2:
            return 0.0
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        return intersection / union if union > 0 else 0.0

    @staticmethod
    def _image_similarity(phash1: str, phash2: str) -> float:
        distance = SimilarityChecker._hamming_distance(phash1, phash2)
        return 1.0 - (distance / 64.0)

    @staticmethod
    def _audio_similarity(fp1: str, fp2: str) -> float:
        return 1.0 if fp1 == fp2 else 0.0

    @staticmethod
    def _video_similarity(fp1: str, fp2: str) -> float:
        return 1.0 if fp1 == fp2 else 0.0

    @classmethod
    def calculate_similarity(cls, work_type: str, feature_type: str, fp1: str, fp2: str) -> float:
        if feature_type == 'text_fingerprint':
            return cls._text_similarity(fp1, fp2)
        elif feature_type == 'image_phash':
            return cls._image_similarity(fp1, fp2)
        elif feature_type == 'audio_fingerprint':
            return cls._audio_similarity(fp1, fp2)
        elif feature_type == 'video_fingerprint':
            return cls._video_similarity(fp1, fp2)
        else:
            return SequenceMatcher(None, fp1, fp2).ratio()

    @classmethod
    def check_similarity(cls, work: Work, features: List[Dict]) -> Tuple[float, Optional[int], str]:
        threshold_key = f'similarity.{work.work_type}_threshold'
        threshold = config.get(threshold_key, 0.85)

        max_similarity = 0.0
        matched_work_id = None
        note = ''

        with db_manager.get_session() as session:
            existing_features = session.query(WorkFeature).filter(
                WorkFeature.work_id != work.id
            ).all()

            for existing in existing_features:
                for new_feat in features:
                    if existing.feature_type == new_feat['feature_type']:
                        sim = cls.calculate_similarity(
                            work.work_type,
                            existing.feature_type,
                            existing.feature_value,
                            new_feat['feature_value']
                        )
                        if sim > max_similarity:
                            max_similarity = sim
                            matched_work_id = existing.work_id
                            if sim >= threshold:
                                matched_work = session.query(Work).get(existing.work_id)
                                note = f"与作品【{matched_work.title}】相似度达{sim:.2%}，请重点核查"

        is_unique = max_similarity < threshold
        return max_similarity, matched_work_id, note


class ExternalVerifier:
    def __init__(self):
        self.session = requests.Session()
        retry_strategy = Retry(
            total=config.get('api.max_retries', 3),
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.timeout = config.get('api.timeout', 30)

    def _make_request(self, url: str, params: Dict) -> Optional[Dict]:
        try:
            headers = {
                'Authorization': f"Bearer {config.get('api.api_key', '')}",
                'Content-Type': 'application/json',
            }
            response = self.session.get(url, params=params, headers=headers, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            logger.error(f"Request timeout: {url}")
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {e}")
        except requests.exceptions.RequestException as e:
            logger.error(f"Request failed: {e}")
        return None

    def check_copyright_center(self, work: Work) -> Tuple[bool, int, str]:
        url = config.get('api.copyright_center_url', '') + '/search'
        if 'ccopyright.cn' in url and not config.get('api.api_key'):
            logger.info("Skipping copyright center check (no API key configured)")
            return True, 0, "未配置API密钥，跳过外部核验"

        params = {
            'title': work.title,
            'author': work.author or '',
            'work_type': work.work_type,
        }
        result = self._make_request(url, params)
        if result is None:
            return False, 0, "查询失败"

        match_count = result.get('total', 0)
        details = json.dumps(result.get('items', []), ensure_ascii=False)[:1000]
        return match_count == 0, match_count, details

    def check_national_library(self, work: Work) -> Tuple[bool, int, str]:
        url = config.get('api.national_library_url', '') + '/catalogue'
        if 'nlc.cn' in url and not config.get('api.api_key'):
            logger.info("Skipping national library check (no API key configured)")
            return True, 0, "未配置API密钥，跳过外部核验"

        params = {
            'title': work.title,
            'author': work.author or '',
        }
        result = self._make_request(url, params)
        if result is None:
            return False, 0, "查询失败"

        match_count = result.get('count', 0)
        details = json.dumps(result.get('records', []), ensure_ascii=False)[:1000]
        return match_count == 0, match_count, details

    def batch_verify(self, registrations: List[Registration]) -> List[Dict]:
        concurrency = config.get('api.concurrency', 50)
        results = []

        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            future_map = {}
            for reg in registrations:
                if not reg.work:
                    continue
                future = executor.submit(self._verify_single, reg)
                future_map[future] = reg.id

            for future in as_completed(future_map):
                reg_id = future_map[future]
                try:
                    result = future.result(timeout=self.timeout * 2)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Verification failed for registration {reg_id}: {e}")
                    results.append({'registration_id': reg_id, 'error': str(e)})

        return results

    def _verify_single(self, registration: Registration) -> Dict:
        start_time = time.time()
        work = registration.work
        if not work:
            return {'registration_id': registration.id, 'error': 'Work not found'}

        cc_unique, cc_count, cc_details = self.check_copyright_center(work)
        nlc_unique, nlc_count, nlc_details = self.check_national_library(work)

        elapsed = time.time() - start_time
        logger.info(f"Verification for work '{work.title}' completed in {elapsed:.2f}s")

        return {
            'registration_id': registration.id,
            'copyright_center': {
                'unique': cc_unique,
                'match_count': cc_count,
                'details': cc_details,
            },
            'national_library': {
                'unique': nlc_unique,
                'match_count': nlc_count,
                'details': nlc_details,
            },
            'elapsed_seconds': elapsed,
        }


class RegistrationService:
    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.similarity_checker = SimilarityChecker()
        self.external_verifier = ExternalVerifier()

    def _generate_application_no(self) -> str:
        today = datetime.now().strftime('%Y%m%d')
        with db_manager.get_session() as session:
            count = session.query(Registration).filter(
                Registration.application_no.like(f'{today}%')
            ).count() + 1
        return f'{today}{count:06d}'

    def _calculate_file_hash(self, file_path: str) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def create_applicant(self, name: str, applicant_type: str, id_card: str,
                         phone: str = None, email: str = None, address: str = None,
                         region: str = None) -> Applicant:
        if applicant_type not in APPLICANT_TYPES:
            raise ValueError(f"Invalid applicant type: {applicant_type}")

        with db_manager.get_session() as session:
            existing = session.query(Applicant).filter_by(id_card=id_card).first()
            if existing:
                logger.info(f"Applicant already exists: {name}")
                _ = existing.name, existing.id
                session.expunge(existing)
                return existing

            applicant = Applicant(
                name=name,
                applicant_type=applicant_type,
                id_card=id_card,
                phone=phone,
                email=email,
                address=address,
                region=region,
            )
            session.add(applicant)
            session.flush()
            _ = applicant.name, applicant.id
            session.expunge(applicant)
            logger.info(f"Applicant created: {name} (ID: {applicant.id})")
            return applicant

    def create_work(self, title: str, work_type: str, author: str = None,
                    description: str = None, keywords: str = None,
                    file_path: str = None, creation_date: date = None,
                    publication_date: date = None, completion_date: date = None) -> Work:
        if work_type not in WORK_TYPES:
            raise ValueError(f"Invalid work type: {work_type}")

        if file_path and not os.path.exists(file_path):
            raise FileNotFoundError(f"Work file not found: {file_path}")

        if file_path and not os.access(file_path, os.R_OK):
            raise PermissionError(f"No read permission for file: {file_path}")

        file_hash = self._calculate_file_hash(file_path) if file_path else None

        with db_manager.get_session() as session:
            work = Work(
                title=title,
                work_type=work_type,
                author=author,
                description=description,
                keywords=keywords,
                file_path=file_path,
                file_hash=file_hash,
                creation_date=creation_date,
                publication_date=publication_date,
                completion_date=completion_date or date.today(),
            )
            session.add(work)
            session.flush()

            content = None
            if work_type == 'text' and description:
                content = description

            features = self.feature_extractor.extract_features(work_type, file_path, content)
            for feat in features:
                feature = WorkFeature(
                    work_id=work.id,
                    feature_type=feat['feature_type'],
                    feature_value=feat['feature_value'],
                    feature_hash=feat['feature_hash'],
                )
                session.add(feature)

            _ = work.title, work.id, work.work_type
            session.expunge(work)
            logger.info(f"Work created: {title} (ID: {work.id}, {len(features)} features extracted)")
            return work

    def submit_registration(self, applicant: Applicant, work: Work) -> Registration:
        start_time = time.time()

        with db_manager.get_session() as session:
            app_no = self._generate_application_no()

            features = session.query(WorkFeature).filter_by(work_id=work.id).all()
            feat_dicts = [{'feature_type': f.feature_type, 'feature_value': f.feature_value} for f in features]

            sim_score, matched_id, sim_note = self.similarity_checker.check_similarity(work, feat_dicts)

            elapsed = time.time() - start_time
            if elapsed > config.get('performance.similarity_timeout', 5):
                logger.warning(f"Similarity check took {elapsed:.2f}s, exceeding 5s limit")

            registration = Registration(
                application_no=app_no,
                applicant_id=applicant.id,
                work_id=work.id,
                status='submitted',
                similarity_score=sim_score,
                similarity_note=sim_note,
                is_unique=sim_score < config.get(f'similarity.{work.work_type}_threshold', 0.85),
                expected_completion_date=date.today() + timedelta(days=15),
            )
            session.add(registration)
            session.flush()

            review = ReviewRecord(
                registration_id=registration.id,
                reviewer='system',
                reviewer_role='examiner',
                review_stage='auto_check',
                review_result='passed' if registration.is_unique else 'warning',
                comments=f'自动相似度检测完成，最高相似度{sim_score:.2%}。{sim_note}' if sim_note else '自动相似度检测完成，未发现高相似作品。',
            )
            session.add(review)

            _ = registration.application_no, registration.id, registration.status, registration.is_unique, registration.similarity_score, registration.work_id, registration.applicant_id
            if registration.work:
                _ = registration.work.title, registration.work.work_type, registration.work.author, registration.work.creation_date, registration.work.description
                session.expunge(registration.work)
            if registration.applicant:
                _ = registration.applicant.name, registration.applicant.id_card, registration.applicant.applicant_type
                session.expunge(registration.applicant)
            session.expunge(registration)
            logger.info(f"Registration submitted: {app_no} (similarity: {sim_score:.2%}, unique: {registration.is_unique})")
            return registration

    def get_registration(self, registration_id: int = None, application_no: str = None) -> Optional[Registration]:
        with db_manager.get_session() as session:
            reg = None
            if registration_id:
                reg = session.query(Registration).get(registration_id)
            elif application_no:
                reg = session.query(Registration).filter_by(application_no=application_no).first()
            
            if reg:
                _ = reg.application_no, reg.id, reg.status, reg.work_id, reg.applicant_id, reg.similarity_score, reg.is_unique, reg.expected_completion_date
                if reg.work:
                    _ = reg.work.title, reg.work.work_type, reg.work.author, reg.work.creation_date, reg.work.description
                    session.expunge(reg.work)
                if reg.applicant:
                    _ = reg.applicant.name, reg.applicant.id_card, reg.applicant.applicant_type
                    session.expunge(reg.applicant)
                session.expunge(reg)
            return reg

    def query_progress(self, application_no: str = None, applicant_name: str = None) -> List[Dict]:
        with db_manager.get_session() as session:
            query = session.query(Registration).join(Applicant)

            if application_no:
                query = query.filter(Registration.application_no == application_no)
            if applicant_name:
                query = query.filter(Applicant.name.like(f'%{applicant_name}%'))

            registrations = query.all()
            results = []
            for reg in registrations:
                data = reg.to_dict(include_details=True)
                reviews = session.query(ReviewRecord).filter_by(
                    registration_id=reg.id
                ).order_by(ReviewRecord.review_date.desc()).all()
                data['reviews'] = [r.to_dict() for r in reviews]
                data['current_stage'] = self._get_current_stage(reg.status)
                results.append(data)
            return results

    def _get_current_stage(self, status: str) -> Dict:
        stages = [
            {'code': 'submitted', 'name': '申请提交', 'order': 1},
            {'code': 'formal_review', 'name': '形式审查', 'order': 2},
            {'code': 'substantive_review', 'name': '实质审查', 'order': 3},
            {'code': 'payment_pending', 'name': '待缴费', 'order': 4},
            {'code': 'payment_confirmed', 'name': '缴费确认', 'order': 5},
            {'code': 'certificate_issued', 'name': '证书发放', 'order': 6},
        ]
        for stage in stages:
            if stage['code'] == status:
                return {
                    'stage': stage['name'],
                    'stage_order': stage['order'],
                    'total_stages': len(stages),
                    'progress': f'{stage["order"]}/{len(stages)}',
                }
        return {'stage': REGISTRATION_STATUS_NAMES.get(status, status), 'stage_order': 0, 'total_stages': 6}

    def update_status(self, registration_id: int, new_status: str, reviewer: str,
                      reviewer_role: str, comments: str = None) -> Registration:
        if new_status not in REGISTRATION_STATUS:
            raise ValueError(f"Invalid status: {new_status}")

        with db_manager.get_session() as session:
            registration = session.query(Registration).get(registration_id)
            if not registration:
                raise ValueError(f"Registration not found: {registration_id}")

            old_status = registration.status
            registration.status = new_status

            now = datetime.now()
            if new_status == 'formal_review':
                registration.formal_review_date = now
            elif new_status == 'substantive_review':
                registration.substantive_review_date = now
            elif new_status == 'payment_confirmed':
                registration.payment_date = now
            elif new_status == 'certificate_issued':
                registration.issue_date = now

            review = ReviewRecord(
                registration_id=registration.id,
                reviewer=reviewer,
                reviewer_role=reviewer_role,
                review_stage=f'{old_status} -> {new_status}',
                review_result='approved',
                comments=comments or f'状态变更：{REGISTRATION_STATUS_NAMES[old_status]} -> {REGISTRATION_STATUS_NAMES[new_status]}',
            )
            session.add(review)
            
            _ = registration.application_no, registration.id, registration.status, registration.work_id, registration.applicant_id, registration.similarity_score, registration.is_unique, registration.expected_completion_date
            if registration.work:
                _ = registration.work.title, registration.work.work_type, registration.work.author, registration.work.creation_date, registration.work.description
                session.expunge(registration.work)
            if registration.applicant:
                _ = registration.applicant.name, registration.applicant.id_card, registration.applicant.applicant_type
                session.expunge(registration.applicant)
            session.expunge(registration)

            logger.info(f"Registration {registration.application_no} status updated: {old_status} -> {new_status}")
            return registration

    def verify_uniqueness(self, registration_ids: List[int]) -> List[Dict]:
        with db_manager.get_session() as session:
            registrations = session.query(Registration).filter(
                Registration.id.in_(registration_ids)
            ).all()
            
            reg_dicts = []
            for reg in registrations:
                _ = reg.id, reg.application_no, reg.work_id, reg.applicant_id
                if reg.work:
                    _ = reg.work.title, reg.work.work_type, reg.work.description, reg.work.file_hash, reg.work.author, reg.work.creation_date
                    session.expunge(reg.work)
                if reg.applicant:
                    _ = reg.applicant.name, reg.applicant.id_card, reg.applicant.applicant_type
                    session.expunge(reg.applicant)
                session.expunge(reg)
                reg_dicts.append(reg)

        results = self.external_verifier.batch_verify(reg_dicts)
        report_path = self._generate_verification_report(results, reg_dicts)

        with db_manager.get_session() as session:
            for result in results:
                if 'error' in result:
                    continue

                reg_id = result['registration_id']

                cc = result['copyright_center']
                vr_cc = VerificationRecord(
                    registration_id=reg_id,
                    source='copyright_center',
                    query_result='unique' if cc['unique'] else 'matched',
                    match_count=cc['match_count'],
                    match_details=cc['details'],
                    report_path=report_path,
                )
                session.add(vr_cc)

                nlc = result['national_library']
                vr_nlc = VerificationRecord(
                    registration_id=reg_id,
                    source='national_library',
                    query_result='unique' if nlc['unique'] else 'matched',
                    match_count=nlc['match_count'],
                    match_details=nlc['details'],
                    report_path=report_path,
                )
                session.add(vr_nlc)

                reg = session.query(Registration).get(reg_id)
                if reg:
                    is_unique = cc['unique'] and nlc['unique']
                    if not is_unique:
                        reg.is_unique = False
                        reg.review_notes = f"外部核验发现潜在冲突：版权中心{cc['match_count']}条，国家图书馆{nlc['match_count']}条"

        logger.info(f"Uniqueness verification completed for {len(results)} registrations, report: {report_path}")
        return results

    def _generate_verification_report(self, results: List[Dict], registrations: List) -> str:
        report_dir = Path(config.get('verification.report_dir', 'data/reports/verification'))
        os.makedirs(report_dir, exist_ok=True)

        batch_no = datetime.now().strftime('VER%Y%m%d%H%M%S')
        report_file = report_dir / f"{batch_no}.md"

        total_count = len(results)
        success_count = sum(1 for r in results if 'error' not in r)
        unique_count = sum(1 for r in results if 'error' not in r and r['copyright_center']['unique'] and r['national_library']['unique'])
        conflict_count = success_count - unique_count

        reg_map = {r.id: r for r in registrations}

        lines = []
        lines.append(f"# 著作权唯一性核验报告")
        lines.append("")
        lines.append(f"**报告编号:** {batch_no}")
        lines.append(f"**核验时间:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**核验批次:** {total_count} 件申请")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 一、核验概况")
        lines.append("")
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 申请总数 | {total_count} |")
        lines.append(f"| 核验成功 | {success_count} |")
        lines.append(f"| 核验失败 | {total_count - success_count} |")
        lines.append(f"| 无冲突作品 | {unique_count} |")
        lines.append(f"| 疑似冲突 | {conflict_count} |")
        lines.append(f"| 冲突率 | {conflict_count / success_count * 100:.1f}%" if success_count > 0 else "| 冲突率 | 0.0% |")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## 二、重复记录详情")
        lines.append("")

        conflict_results = [r for r in results if 'error' not in r and not (r['copyright_center']['unique'] and r['national_library']['unique'])]

        if conflict_results:
            for idx, result in enumerate(conflict_results, 1):
                reg_id = result['registration_id']
                reg = reg_map.get(reg_id)
                work_title = reg.work.title if reg and reg.work else '未知'
                application_no = reg.application_no if reg else '未知'
                applicant_name = reg.applicant.name if reg and reg.applicant else '未知'

                lines.append(f"### {idx}. 申请编号: {application_no}")
                lines.append("")
                lines.append(f"- **作品名称:** {work_title}")
                lines.append(f"- **申请人:** {applicant_name}")
                lines.append("")

                cc = result['copyright_center']
                lines.append(f"**中国版权保护中心核验结果:**")
                lines.append(f"- 状态: {'✅ 无冲突' if cc['unique'] else '⚠️ 发现冲突'}")
                lines.append(f"- 匹配条数: {cc['match_count']}")
                if cc['match_count'] > 0 and cc['details']:
                    lines.append(f"- 匹配详情:")
                    try:
                        details = json.loads(cc['details']) if isinstance(cc['details'], str) else cc['details']
                        for i, d in enumerate(details[:5], 1):
                            title = d.get('title', '未知') if isinstance(d, dict) else str(d)
                            lines.append(f"  {i}. {title}")
                    except (json.JSONDecodeError, TypeError):
                        lines.append(f"  {cc['details'][:200]}")
                lines.append("")

                nlc = result['national_library']
                lines.append(f"**国家图书馆馆藏目录核验结果:**")
                lines.append(f"- 状态: {'✅ 无冲突' if nlc['unique'] else '⚠️ 发现冲突'}")
                lines.append(f"- 匹配条数: {nlc['match_count']}")
                if nlc['match_count'] > 0 and nlc['details']:
                    lines.append(f"- 匹配详情:")
                    try:
                        details = json.loads(nlc['details']) if isinstance(nlc['details'], str) else nlc['details']
                        for i, d in enumerate(details[:5], 1):
                            title = d.get('title', '未知') if isinstance(d, dict) else str(d)
                            lines.append(f"  {i}. {title}")
                    except (json.JSONDecodeError, TypeError):
                        lines.append(f"  {nlc['details'][:200]}")
                lines.append("")
                lines.append("---")
                lines.append("")
        else:
            lines.append("> 🎉 本次核验未发现任何冲突记录，所有作品均通过唯一性核验。")
            lines.append("")

        lines.append("## 三、处理建议")
        lines.append("")

        if conflict_count > 0:
            lines.append(f"本次核验共发现 **{conflict_count}** 件疑似冲突作品，建议按以下流程处理：")
            lines.append("")
            lines.append("1. **人工复核:** 由资深审查员对疑似冲突作品进行人工比对，确认是否构成实质性相似")
            lines.append("2. **权利确认:** 如构成冲突，联系申请人补充权利证明材料（如创作底稿、公开发表证明等）")
            lines.append("3. **比对分析:** 对冲突作品进行逐段比对，分析相似部分的独创性")
            lines.append("4. **结果反馈:** 将核验结果书面通知申请人，给予陈述申辩机会")
            lines.append("5. **登记决定:** 根据复核结果作出准予登记或驳回申请的决定")
            lines.append("")
            lines.append(f"**重点关注清单（共{conflict_count}件）:**")
            lines.append("")
            lines.append("| 序号 | 申请编号 | 作品名称 | 申请人 | 冲突来源 | 处理优先级 |")
            lines.append("|------|----------|----------|--------|----------|------------|")
            for idx, result in enumerate(conflict_results, 1):
                reg_id = result['registration_id']
                reg = reg_map.get(reg_id)
                application_no = reg.application_no if reg else '未知'
                work_title = (reg.work.title[:20] + '...') if reg and reg.work and len(reg.work.title) > 20 else (reg.work.title if reg and reg.work else '未知')
                applicant_name = reg.applicant.name if reg and reg.applicant else '未知'
                cc_matches = result['copyright_center']['match_count']
                nlc_matches = result['national_library']['match_count']
                sources = []
                if cc_matches > 0:
                    sources.append(f"版权中心({cc_matches})")
                if nlc_matches > 0:
                    sources.append(f"国图({nlc_matches})")
                source_str = '、'.join(sources)
                total_matches = cc_matches + nlc_matches
                priority = '🔴 高' if total_matches >= 3 else ('🟡 中' if total_matches >= 1 else '🟢 低')
                lines.append(f"| {idx} | {application_no} | {work_title} | {applicant_name} | {source_str} | {priority} |")
        else:
            lines.append("1. **自动通过:** 所有核验通过的作品可直接进入下一审查环节")
            lines.append("2. **登记公告:** 建议对已核验的作品优先安排公告发布")
            lines.append("3. **证书生成:** 核验通过且缴费完成的作品可批量生成登记证书")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本报告由版权保护中心登记管理系统自动生成，如有疑问请联系系统管理员。*")
        lines.append(f"*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

        with open(report_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        logger.info(f"Verification report generated: {report_file}")
        return str(report_file)

    def get_statistics(self, period: str = 'month', start_date: date = None,
                       end_date: date = None, group_by: str = None) -> Dict:
        if period == 'month':
            start = date.today().replace(day=1)
            end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        elif period == 'quarter':
            q = (date.today().month - 1) // 3
            start = date(date.today().year, q * 3 + 1, 1)
            end = date(date.today().year, q * 3 + 4, 1) - timedelta(days=1)
        elif period == 'year':
            start = date(date.today().year, 1, 1)
            end = date(date.today().year, 12, 31)
        else:
            start = start_date or date.today().replace(day=1)
            end = end_date or date.today()

        with db_manager.get_session() as session:
            query = session.query(Registration).filter(
                Registration.submission_date >= datetime.combine(start, datetime.min.time()),
                Registration.submission_date <= datetime.combine(end, datetime.max.time()),
            )
            all_regs = query.all()

            total_count = len(all_regs)
            passed_count = sum(1 for r in all_regs if r.status == 'certificate_issued')
            rejected_count = sum(1 for r in all_regs if r.status == 'rejected')
            pending_count = sum(1 for r in all_regs if r.status not in ['certificate_issued', 'rejected', 'withdrawn'])

            review_durations = []
            for r in all_regs:
                if r.issue_date and r.submission_date:
                    dur = (r.issue_date - r.submission_date).days
                    review_durations.append(dur)
            avg_duration = sum(review_durations) / len(review_durations) if review_durations else 0

            stats = {
                'period': period,
                'start_date': start.isoformat(),
                'end_date': end.isoformat(),
                'total_count': total_count,
                'passed_count': passed_count,
                'rejected_count': rejected_count,
                'pending_count': pending_count,
                'pass_rate': passed_count / total_count if total_count > 0 else 0,
                'rejection_rate': rejected_count / total_count if total_count > 0 else 0,
                'avg_review_days': round(avg_duration, 1),
            }

            if group_by == 'work_type':
                stats['by_work_type'] = self._group_by(all_regs, 'work_type', lambda r: r.work.work_type if r.work else None)
            elif group_by == 'applicant_type':
                stats['by_applicant_type'] = self._group_by(all_regs, 'applicant_type', lambda r: r.applicant.applicant_type if r.applicant else None)
            elif group_by == 'region':
                stats['by_region'] = self._group_by(all_regs, 'region', lambda r: r.applicant.region if r.applicant else None)

            return stats

    def _group_by(self, registrations: List[Registration], name: str, key_func) -> Dict:
        groups = {}
        for r in registrations:
            key = key_func(r) or 'unknown'
            if key not in groups:
                groups[key] = {'count': 0, 'passed': 0}
            groups[key]['count'] += 1
            if r.status == 'certificate_issued':
                groups[key]['passed'] += 1

        for k, v in groups.items():
            v['pass_rate'] = v['passed'] / v['count'] if v['count'] > 0 else 0

        return groups

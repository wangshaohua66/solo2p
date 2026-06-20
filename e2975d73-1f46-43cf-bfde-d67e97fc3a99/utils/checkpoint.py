import os
import json
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
from config.settings import CHECKPOINT_FILE, CHECKPOINT_SAVE_INTERVAL
from utils.logger import logger, log_error_with_context


class CheckpointManager:
    def __init__(self, checkpoint_file: str = None):
        self.checkpoint_file = checkpoint_file or CHECKPOINT_FILE
        self.data: Dict[str, Any] = {
            'version': '1.0',
            'created_at': '',
            'updated_at': '',
            'crawl_sessions': {},
            'visited_urls': {},
            'processed_urls': [],
            'failed_urls': {},
            'current_session': None,
            'source_progress': {},
            'statistics': {
                'total_crawled': 0,
                'total_saved': 0,
                'total_failed': 0,
                'sessions_count': 0,
            }
        }
        self._save_counter = 0
        self._load_checkpoint()

    def _load_checkpoint(self):
        if os.path.exists(self.checkpoint_file):
            try:
                with open(self.checkpoint_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    self.data.update(loaded)
                logger.info(f"Loaded checkpoint: {os.path.basename(self.checkpoint_file)}")
                logger.info(f"  Visited URLs: {len(self.data['visited_urls'])}")
                logger.info(f"  Processed URLs: {len(self.data['processed_urls'])}")
                logger.info(f"  Failed URLs: {len(self.data['failed_urls'])}")
                logger.info(f"  Total crawled: {self.data['statistics']['total_crawled']}")
            except Exception as e:
                log_error_with_context(logger, e, "Failed to load checkpoint, starting fresh")
                self._init_new_checkpoint()
        else:
            self._init_new_checkpoint()

    def _init_new_checkpoint(self):
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self.data['created_at'] = now
        self.data['updated_at'] = now
        logger.info("Initialized new checkpoint")

    def start_session(self, session_name: str, sources: List[str]) -> str:
        session_id = f"{session_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        self.data['current_session'] = session_id
        self.data['crawl_sessions'][session_id] = {
            'name': session_name,
            'start_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'end_time': None,
            'sources': sources,
            'status': 'running',
            'visited': [],
            'processed': [],
            'failed': [],
            'saved': 0,
            'errors': [],
            'source_details': {src: {'visited': 0, 'saved': 0, 'failed': 0} for src in sources},
        }
        self.data['statistics']['sessions_count'] += 1
        logger.info(f"Started crawl session: {session_id}")
        self.save(force=True)
        return session_id

    def end_session(self, status: str = 'completed'):
        session_id = self.data.get('current_session')
        if session_id and session_id in self.data['crawl_sessions']:
            self.data['crawl_sessions'][session_id]['end_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            self.data['crawl_sessions'][session_id]['status'] = status
            logger.info(f"Ended session {session_id} with status: {status}")
        self.data['current_session'] = None
        self.save(force=True)

    def mark_url_visited(self, url: str, source: str = None):
        if url not in self.data['visited_urls']:
            self.data['visited_urls'][url] = {
                'first_visited': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'last_visited': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'visit_count': 1,
                'source': source or 'unknown',
                'status': 'visiting',
            }
        else:
            self.data['visited_urls'][url]['last_visited'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            self.data['visited_urls'][url]['visit_count'] += 1
            self.data['visited_urls'][url]['status'] = 'visiting'

        session_id = self.data.get('current_session')
        if session_id and session_id in self.data['crawl_sessions']:
            session = self.data['crawl_sessions'][session_id]
            if url not in session['visited']:
                session['visited'].append(url)
                if source and source in session['source_details']:
                    session['source_details'][source]['visited'] += 1

        self.data['statistics']['total_crawled'] += 1
        self._increment_and_save()

    def mark_url_processed(self, url: str, source: str = None, saved: bool = True):
        if url in self.data['visited_urls']:
            self.data['visited_urls'][url]['status'] = 'processed'
            self.data['visited_urls'][url]['processed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        if url not in self.data['processed_urls']:
            self.data['processed_urls'].append(url)

        if saved:
            self.data['statistics']['total_saved'] += 1

        session_id = self.data.get('current_session')
        if session_id and session_id in self.data['crawl_sessions']:
            session = self.data['crawl_sessions'][session_id]
            if url not in session['processed']:
                session['processed'].append(url)
                if saved:
                    session['saved'] += 1
                    if source and source in session['source_details']:
                        session['source_details'][source]['saved'] += 1

        self._increment_and_save()

    def mark_url_failed(self, url: str, error: str, source: str = None):
        self.data['failed_urls'][url] = {
            'error': str(error)[:500],
            'failed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'retry_count': self.data['failed_urls'].get(url, {}).get('retry_count', 0) + 1,
            'source': source or 'unknown',
        }

        if url in self.data['visited_urls']:
            self.data['visited_urls'][url]['status'] = 'failed'

        self.data['statistics']['total_failed'] += 1

        session_id = self.data.get('current_session')
        if session_id and session_id in self.data['crawl_sessions']:
            session = self.data['crawl_sessions'][session_id]
            if url not in session['failed']:
                session['failed'].append(url)
                session['errors'].append({
                    'url': url,
                    'error': str(error)[:200],
                    'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                })
                if source and source in session['source_details']:
                    session['source_details'][source]['failed'] += 1

        self._increment_and_save()

    def update_source_progress(self, source: str, page: int, total_pages: int = None):
        if source not in self.data['source_progress']:
            self.data['source_progress'][source] = {
                'current_page': 0,
                'total_pages': total_pages,
                'start_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'last_page_time': None,
                'pages_crawled': 0,
            }
        self.data['source_progress'][source]['current_page'] = page
        self.data['source_progress'][source]['pages_crawled'] = max(
            self.data['source_progress'][source]['pages_crawled'],
            page
        )
        self.data['source_progress'][source]['last_page_time'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def is_url_visited(self, url: str, incremental: bool = True) -> bool:
        if not incremental:
            return False
        if url in self.data['visited_urls']:
            status = self.data['visited_urls'][url].get('status', '')
            return status in ['processed', 'visiting']
        return url in self.data['processed_urls']

    def is_url_processed(self, url: str) -> bool:
        return url in self.data['processed_urls']

    def is_url_failed(self, url: str, max_retries: int = 3) -> bool:
        if url in self.data['failed_urls']:
            retry_count = self.data['failed_urls'][url].get('retry_count', 0)
            return retry_count >= max_retries
        return False

    def get_visited_urls(self, source: str = None) -> List[str]:
        if source:
            return [url for url, info in self.data['visited_urls'].items() 
                   if info.get('source') == source]
        return list(self.data['visited_urls'].keys())

    def get_failed_urls(self, source: str = None) -> List[str]:
        if source:
            return [url for url, info in self.data['failed_urls'].items() 
                   if info.get('source') == source]
        return list(self.data['failed_urls'].keys())

    def get_last_session(self) -> Optional[Dict[str, Any]]:
        if not self.data['crawl_sessions']:
            return None
        sessions = sorted(
            self.data['crawl_sessions'].keys(),
            reverse=True
        )
        if sessions:
            return self.data['crawl_sessions'][sessions[0]]
        return None

    def get_session_progress(self, session_id: str = None) -> Dict[str, Any]:
        if not session_id:
            session_id = self.data.get('current_session')
        if not session_id or session_id not in self.data['crawl_sessions']:
            return {}
        session = self.data['crawl_sessions'][session_id]
        total = len(session['visited']) or 1
        return {
            'session_id': session_id,
            'status': session['status'],
            'visited': len(session['visited']),
            'processed': len(session['processed']),
            'failed': len(session['failed']),
            'saved': session['saved'],
            'success_rate': (len(session['processed']) / total * 100),
            'sources': session['source_details'],
        }

    def get_statistics(self) -> Dict[str, Any]:
        stats = self.data['statistics'].copy()
        stats['visited_urls'] = len(self.data['visited_urls'])
        stats['processed_urls'] = len(self.data['processed_urls'])
        stats['failed_urls'] = len(self.data['failed_urls'])
        stats['current_session'] = self.data.get('current_session')
        return stats

    def _increment_and_save(self):
        self._save_counter += 1
        if self._save_counter >= CHECKPOINT_SAVE_INTERVAL:
            self.save()

    def save(self, force: bool = False):
        if not force and self._save_counter < CHECKPOINT_SAVE_INTERVAL:
            return

        self.data['updated_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self._save_counter = 0

        try:
            os.makedirs(os.path.dirname(self.checkpoint_file), exist_ok=True)

            temp_file = self.checkpoint_file + '.tmp'
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, ensure_ascii=False, indent=2)

            if os.path.exists(self.checkpoint_file):
                backup_file = self.checkpoint_file + '.bak'
                if os.path.exists(backup_file):
                    os.remove(backup_file)
                os.rename(self.checkpoint_file, backup_file)

            os.rename(temp_file, self.checkpoint_file)

            file_size = os.path.getsize(self.checkpoint_file) / 1024
            logger.debug(f"Checkpoint saved ({file_size:.1f} KB)")

        except Exception as e:
            log_error_with_context(logger, e, "Failed to save checkpoint")
            if os.path.exists(temp_file):
                try:
                    os.remove(temp_file)
                except:
                    pass

    def clear_failed_urls(self, source: str = None) -> int:
        if source:
            to_remove = [url for url, info in self.data['failed_urls'].items() 
                        if info.get('source') == source]
            for url in to_remove:
                del self.data['failed_urls'][url]
            count = len(to_remove)
        else:
            count = len(self.data['failed_urls'])
            self.data['failed_urls'].clear()

        logger.info(f"Cleared {count} failed URLs")
        self.save(force=True)
        return count

    def reset_all(self):
        backup_file = self.checkpoint_file + f".reset_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        if os.path.exists(self.checkpoint_file):
            os.rename(self.checkpoint_file, backup_file)
            logger.info(f"Backup checkpoint saved to: {backup_file}")
        self._init_new_checkpoint()
        logger.info("Checkpoint reset complete")

    def export_failed_urls(self, output_file: str) -> int:
        try:
            failed_data = []
            for url, info in self.data['failed_urls'].items():
                failed_data.append({
                    'url': url,
                    **info
                })
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(failed_data, f, ensure_ascii=False, indent=2)
            logger.info(f"Exported {len(failed_data)} failed URLs to {output_file}")
            return len(failed_data)
        except Exception as e:
            log_error_with_context(logger, e, "Failed to export failed URLs")
            return 0


checkpoint = CheckpointManager()


def get_checkpoint() -> CheckpointManager:
    return checkpoint

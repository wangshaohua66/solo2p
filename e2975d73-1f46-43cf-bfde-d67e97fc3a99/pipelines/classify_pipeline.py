import re
import os
import json
from collections import defaultdict, Counter
from itemadapter import ItemAdapter
from datetime import datetime
import jieba
import jieba.posseg as pseg
from sklearn.feature_extraction.text import TfidfVectorizer
from config.settings import (
    POLICY_CATEGORIES, POLICY_TYPES, JIEBA_CUSTOM_DICT
)
from utils.logger import logger, log_error_with_context
from utils.db import db


class ClassifyPipeline:
    def __init__(self):
        self.stats = {
            'classified': 0,
            'unclassified': 0,
            'by_category': Counter(),
            'by_type': Counter(),
            'total_keywords': 0,
        }

        self._init_jieba()
        self._init_keyword_index()
        self._init_tfidf()

    def _init_jieba(self):
        try:
            if os.path.exists(JIEBA_CUSTOM_DICT):
                jieba.load_userdict(JIEBA_CUSTOM_DICT)
                logger.info(f"Loaded custom jieba dictionary from {JIEBA_CUSTOM_DICT}")
            else:
                self._create_custom_dict()

            for category, config in POLICY_CATEGORIES.items():
                for keyword in config.get('keywords', []):
                    jieba.add_word(keyword)

            for ptype, keywords in POLICY_TYPES.items():
                for keyword in keywords:
                    jieba.add_word(keyword)

            logger.info("Jieba initialized with policy keywords")

        except Exception as e:
            log_error_with_context(logger, e, "Failed to initialize jieba")

    def _create_custom_dict(self):
        try:
            os.makedirs(os.path.dirname(JIEBA_CUSTOM_DICT), exist_ok=True)
            with open(JIEBA_CUSTOM_DICT, 'w', encoding='utf-8') as f:
                for category, config in POLICY_CATEGORIES.items():
                    for keyword in config.get('keywords', []):
                        f.write(f"{keyword} 100 n\n")
                for ptype, keywords in POLICY_TYPES.items():
                    for keyword in keywords:
                        f.write(f"{keyword} 50 n\n")
            logger.info(f"Created custom jieba dictionary at {JIEBA_CUSTOM_DICT}")
        except Exception as e:
            log_error_with_context(logger, e, "Failed to create custom jieba dictionary")

    def _init_keyword_index(self):
        self.category_keywords = {}
        for category, config in POLICY_CATEGORIES.items():
            keywords = list(config.get('keywords', []))
            synonyms_dict = config.get('synonyms', {})
            context_phrases = list(config.get('context_phrases', []))
            weight = config.get('weight', 1.0)
            title_weight = config.get('title_weight', 1.8)
            min_score = config.get('min_score', 2)

            all_keywords = set(keywords)
            for word, syn_list in synonyms_dict.items():
                all_keywords.add(word)
                for s in syn_list:
                    all_keywords.add(s)
            all_keywords = list(all_keywords)

            self.category_keywords[category] = {
                'keywords': keywords,
                'synonyms': synonyms_dict,
                'all_keywords': all_keywords,
                'context_phrases': context_phrases,
                'weight': weight,
                'title_weight': title_weight,
                'min_score': min_score,
                'pattern': re.compile('|'.join([re.escape(k) for k in all_keywords]), re.IGNORECASE) if all_keywords else None,
                'context_patterns': [re.compile(re.escape(phrase), re.IGNORECASE) for phrase in context_phrases],
            }

            for kw in all_keywords:
                jieba.add_word(kw)
            for cp in context_phrases:
                jieba.add_word(cp)

        self.type_keywords = {}
        for ptype, keywords in POLICY_TYPES.items():
            self.type_keywords[ptype] = {
                'keywords': keywords,
                'pattern': re.compile('|'.join([re.escape(k) for k in keywords]), re.IGNORECASE)
            }
            for kw in keywords:
                jieba.add_word(kw)

    def _init_tfidf(self):
        self.tfidf_vectorizer = TfidfVectorizer(
            tokenizer=self._jieba_tokenize,
            max_features=1000,
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.95
        )
        self.corpus = []
        self._fitted = False

    def _jieba_tokenize(self, text):
        if not text:
            return []

        stop_words = self._get_stop_words()
        words = []

        for word, flag in pseg.cut(text):
            word = word.strip()
            if (len(word) > 1 and 
                word not in stop_words and 
                not re.match(r'^[0-9]+$', word) and
                flag in ['n', 'vn', 'v', 'a', 'an', 'nz']):
                words.append(word)

        return words

    def _get_stop_words(self):
        return {
            '的', '了', '和', '是', '在', '我', '有', '也', '就', '都',
            '而', '及', '与', '等', '对', '为', '以', '于', '上', '中',
            '下', '之', '或', '并', '个', '各', '每', '一', '二', '三',
            '不', '这', '那', '你', '他', '她', '它', '们', '将', '要',
            '会', '可', '能', '应', '该', '需', '要', '可', '以', '把',
            '被', '给', '让', '向', '到', '从', '由', '自', '如', '若',
            '虽', '但', '然', '而', '因', '所', '以', '故', '其', '此',
        }

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        try:
            title = adapter.get('title', '')
            content = adapter.get('content', '')

            full_text = f"{title}\n{content}"

            category, confidence, matched_keywords = self._classify_category(title, content)
            policy_type = self._classify_type(title, content)
            keywords = self._extract_keywords(title, content)
            summary = self._generate_summary(title, content)

            adapter['category'] = category
            adapter['sub_category'] = self._extract_sub_category(title, content, category)
            adapter['policy_type'] = policy_type
            adapter['keywords'] = keywords
            adapter['summary'] = summary
            adapter['confidence'] = confidence

            if category and category != '其他':
                self.stats['classified'] += 1
                self.stats['by_category'][category] += 1
            else:
                self.stats['unclassified'] += 1
                self.stats['by_category']['其他'] += 1

            if policy_type:
                self.stats['by_type'][policy_type] += 1

            self.stats['total_keywords'] += len(keywords)

            self.corpus.append(full_text)

            logger.info(f"Classified: [{category}/{policy_type}] {title[:50]}... (confidence: {confidence:.2f})")

            return item

        except Exception as e:
            log_error_with_context(logger, e, f"Error classifying item: {adapter.get('url', 'unknown')}")
            adapter['category'] = '其他'
            adapter['confidence'] = 0.0
            return item

    def _classify_category(self, title, content):
        scores = defaultdict(float)
        score_details = {}
        all_matches = {}

        full_text = f"{title}\n{content}"
        title_lower = title.lower() if title else ''
        content_lower = content.lower() if content else ''

        for category, config in self.category_keywords.items():
            category_score = 0.0
            details = {
                'keyword_matches': [],
                'keyword_score': 0.0,
                'synonym_matches': [],
                'synonym_score': 0.0,
                'context_matches': [],
                'context_score': 0.0,
                'title_matches': [],
                'title_score': 0.0,
            }

            if config['pattern']:
                all_matches_in_text = config['pattern'].findall(full_text)
                if all_matches_in_text:
                    unique_matches = list(set([m.strip() for m in all_matches_in_text if m.strip()]))

                    for match in unique_matches:
                        is_primary = match in config['keywords']
                        is_synonym = False
                        for word, syn_list in config['synonyms'].items():
                            if match == word or match in syn_list:
                                is_synonym = True
                                break

                        if is_primary:
                            category_score += 1.0
                            details['keyword_matches'].append(match)
                            details['keyword_score'] += 1.0
                        elif is_synonym:
                            category_score += 0.7
                            details['synonym_matches'].append(match)
                            details['synonym_score'] += 0.7
                        else:
                            category_score += 0.8
                            details['keyword_matches'].append(match)
                            details['keyword_score'] += 0.8

                    all_matches[category] = unique_matches

            for idx, ctx_pattern in enumerate(config['context_patterns']):
                ctx_match = ctx_pattern.search(full_text)
                if ctx_match:
                    ctx_phrase = config['context_phrases'][idx]
                    category_score += 1.5
                    details['context_matches'].append(ctx_phrase)
                    details['context_score'] += 1.5

            if config['pattern']:
                title_matches_found = config['pattern'].findall(title)
                if title_matches_found:
                    unique_title_matches = list(set([m.strip() for m in title_matches_found if m.strip()]))
                    for match in unique_title_matches:
                        base_title_score = 0.0
                        if match in config['keywords']:
                            base_title_score = 1.0
                        else:
                            for word, syn_list in config['synonyms'].items():
                                if match == word or match in syn_list:
                                    base_title_score = 0.7
                                    break
                            if base_title_score == 0.0:
                                base_title_score = 0.8

                        weighted_title_score = base_title_score * config['title_weight']
                        category_score += weighted_title_score
                        details['title_matches'].append(match)
                        details['title_score'] += weighted_title_score

            category_score *= config['weight']

            scores[category] = category_score
            details['total_score'] = category_score
            score_details[category] = details

        if not scores:
            return '其他', 0.0, []

        sorted_categories = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        best_category, best_score = sorted_categories[0]

        if len(sorted_categories) > 1:
            second_score = sorted_categories[1][1]
            if best_score < second_score * 1.3 and best_score < 3.0:
                logger.debug(f"Ambiguous classification: {best_category}({best_score:.2f}) vs "
                            f"{sorted_categories[1][0]}({second_score:.2f})")

        total_score = sum(scores.values())
        if total_score > 0:
            confidence = min(best_score / total_score * 1.2, 1.0)
        else:
            confidence = 0.0

        min_score = self.category_keywords[best_category].get('min_score', 2)
        if best_score < min_score or confidence < 0.25:
            if best_score >= 1.0:
                logger.debug(f"Category {best_category} score {best_score:.2f} below threshold {min_score}")
            return '其他', confidence, all_matches.get(best_category, [])

        details_str = (f"kw={score_details[best_category]['keyword_score']:.1f}, "
                      f"syn={score_details[best_category]['synonym_score']:.1f}, "
                      f"ctx={score_details[best_category]['context_score']:.1f}, "
                      f"title={score_details[best_category]['title_score']:.1f}")
        logger.debug(f"Classified as {best_category}: score={best_score:.2f}, conf={confidence:.2f} ({details_str})")

        return best_category, confidence, all_matches.get(best_category, [])

    def _classify_type(self, title, content):
        full_text = f"{title}\n{content}"

        for ptype, config in self.type_keywords.items():
            matches = config['pattern'].findall(title)
            if matches:
                return ptype

        for ptype, config in self.type_keywords.items():
            matches = config['pattern'].findall(content[:500])
            if matches:
                return ptype

        return '规范性文件'

    def _extract_sub_category(self, title, content, category):
        if not category or category == '其他':
            return ''

        sub_category_patterns = {
            '伤残抚恤': ['一级', '二级', '三级', '四级', '五级', '六级', '七级', '八级', '九级', '十级',
                        '护理费', '辅助器具', '康复治疗'],
            '医疗救助': ['门诊', '住院', '大病', '慢性病', '特殊药品', '医疗报销'],
            '就业扶持': ['自主创业', '灵活就业', '公益性岗位', '技能培训', '学历教育'],
            '定期生活补助': ['在乡老复员军人', '带病回乡退伍军人', '参战退役人员', '参试退役人员'],
        }

        patterns = sub_category_patterns.get(category, [])
        for pattern in patterns:
            if pattern in title or pattern in content[:1000]:
                return pattern

        return ''

    def _extract_keywords(self, title, content):
        full_text = f"{title}\n{content}"
        words = self._jieba_tokenize(full_text)

        if not words:
            return []

        word_freq = Counter(words)

        all_keywords = []
        for category, config in self.category_keywords.items():
            matches = config['pattern'].findall(full_text)
            all_keywords.extend(matches)

        top_words = [w for w, _ in word_freq.most_common(20)]
        all_keywords.extend(top_words)

        unique_keywords = list(dict.fromkeys(all_keywords))

        return unique_keywords[:15]

    def _generate_summary(self, title, content, max_length=300):
        if not content:
            return title

        summary_patterns = [
            r'为贯彻落实[^。]+。',
            r'为进一步[^。]+。',
            r'根据[^。]+规定[^。]+，现就[^。]+通知如下',
            r'为加强[^。]+，[^。]+制定本办法',
            r'按照[^。]+要求[^。]+，现就有关问题通知如下',
        ]

        for pattern in summary_patterns:
            match = re.search(pattern, content)
            if match:
                summary = match.group(0)
                if len(summary) <= max_length:
                    return summary
                return summary[:max_length] + '...'

        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', content) if p.strip()]
        for para in paragraphs[:3]:
            if len(para) > 20:
                if len(para) <= max_length:
                    return para
                return para[:max_length] + '...'

        return content[:max_length] + '...'

    def close_spider(self, spider):
        logger.info("=" * 60)
        logger.info("CLASSIFY PIPELINE STATISTICS")
        logger.info("=" * 60)
        logger.info(f"Classified: {self.stats['classified']}")
        logger.info(f"Unclassified: {self.stats['unclassified']}")
        if self.stats['classified'] + self.stats['unclassified'] > 0:
            rate = self.stats['classified'] / (self.stats['classified'] + self.stats['unclassified']) * 100
            logger.info(f"Classification rate: {rate:.1f}%")
        logger.info(f"Total keywords extracted: {self.stats['total_keywords']}")
        logger.info("\nBy category:")
        for category, count in self.stats['by_category'].most_common():
            logger.info(f"  {category:15s}: {count}")
        logger.info("\nBy type:")
        for ptype, count in self.stats['by_type'].most_common():
            logger.info(f"  {ptype:15s}: {count}")
        logger.info("=" * 60)


class StoragePipeline:
    def __init__(self):
        self.stats = {
            'saved': 0,
            'updated': 0,
            'failed': 0,
            'relations_created': 0,
        }
        self.items_buffer = []
        self.batch_size = 50

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        try:
            policy_data = dict(adapter)

            attachments_content = ''
            for att in policy_data.get('attachments', []):
                if att.get('content_text'):
                    attachments_content += '\n\n' + att['content_text']

            if attachments_content:
                policy_data['content'] = (policy_data.get('content', '') + attachments_content).strip()

            existing = db.get_policy_by_url(policy_data.get('url', ''))
            if existing:
                policy_data['created_at'] = existing.get('created_at', 
                                                          datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
                policy_id = db.insert_policy(policy_data)
                if policy_id:
                    self.stats['updated'] += 1
            else:
                policy_id = db.insert_policy(policy_data)
                if policy_id:
                    self.stats['saved'] += 1

            if policy_id and policy_data.get('references'):
                for ref in policy_data['references']:
                    db.insert_relation(
                        policy_id=policy_id,
                        referenced_title=ref.get('title', ''),
                        relation_type=ref.get('type', 'reference'),
                        referenced_policy_id=ref.get('policy_id')
                    )
                    self.stats['relations_created'] += 1

            logger.debug(f"Stored policy: {policy_data.get('title', 'unknown')[:50]}")

        except Exception as e:
            log_error_with_context(logger, e, f"Error storing item: {adapter.get('url', 'unknown')}")
            self.stats['failed'] += 1

        return item

    def close_spider(self, spider):
        logger.info("=" * 60)
        logger.info("STORAGE PIPELINE STATISTICS")
        logger.info("=" * 60)
        logger.info(f"New records: {self.stats['saved']}")
        logger.info(f"Updated records: {self.stats['updated']}")
        logger.info(f"Failed records: {self.stats['failed']}")
        logger.info(f"Relations created: {self.stats['relations_created']}")
        logger.info(f"Total processed: {self.stats['saved'] + self.stats['updated']}")
        logger.info("=" * 60)

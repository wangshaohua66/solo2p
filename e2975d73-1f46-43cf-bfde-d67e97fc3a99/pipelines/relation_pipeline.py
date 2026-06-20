import re
import json
from collections import defaultdict, Counter
from itemadapter import ItemAdapter
from config.settings import RELATION_PATTERNS
from utils.logger import logger, log_error_with_context
from utils.db import db


class RelationPipeline:
    def __init__(self):
        self.stats = {
            'total_references': 0,
            'unique_policies': 0,
            'relations_found': 0,
            'cross_references': 0,
            'self_references': 0,
            'unresolved_references': 0,
            'by_relation_type': Counter(),
        }

        self.policy_titles = {}
        self.policy_ids = {}
        self.relation_graph = defaultdict(set)
        self._load_existing_policies()

    def _load_existing_policies(self):
        try:
            policies = db.get_policies(limit=100000)
            for policy in policies:
                title = policy.get('title', '').strip()
                url = policy.get('url', '')
                pid = policy.get('id')

                if title:
                    self.policy_titles[title] = pid
                    self.policy_titles[self._normalize_title(title)] = pid

                    short_title = self._get_short_title(title)
                    if short_title:
                        self.policy_titles[short_title] = pid

                if url and pid:
                    self.policy_ids[url] = pid

            self.stats['unique_policies'] = len(self.policy_ids)
            logger.info(f"Loaded {len(self.policy_titles)} policy titles for relation matching")

        except Exception as e:
            log_error_with_context(logger, e, "Failed to load existing policies")

    def _normalize_title(self, title):
        if not title:
            return ''

        title = re.sub(r'[《》〈〉「」『』【】\[\]()]', '', title)
        title = re.sub(r'[，。、；：？！\s]', '', title)
        title = title.strip()
        return title

    def _get_short_title(self, title):
        if not title:
            return ''

        match = re.search(r'《([^》]+)》', title)
        if match:
            return match.group(1).strip()

        match = re.search(r'〈([^〉]+)〉', title)
        if match:
            return match.group(1).strip()

        return ''

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)

        try:
            url = adapter.get('url', '')
            title = adapter.get('title', '')
            content = adapter.get('content', '')

            full_text = f"{title}\n{content}"

            references = self._extract_references(full_text)

            if references:
                resolved_refs = []
                for ref in references:
                    ref_title = ref.get('title', '')
                    ref_type = ref.get('type', 'reference')

                    resolved_id = self._match_policy(ref_title)

                    ref_data = {
                        'title': ref_title,
                        'type': ref_type,
                        'policy_id': resolved_id,
                        'matched': resolved_id is not None
                    }

                    resolved_refs.append(ref_data)

                    if resolved_id:
                        current_id = self.policy_ids.get(url)
                        if current_id and current_id != resolved_id:
                            self.relation_graph[current_id].add(resolved_id)
                            self.stats['cross_references'] += 1
                        elif current_id == resolved_id:
                            self.stats['self_references'] += 1
                    else:
                        self.stats['unresolved_references'] += 1

                    self.stats['by_relation_type'][ref_type] += 1

                adapter['references'] = resolved_refs
                self.stats['relations_found'] += len(resolved_refs)

                self.stats['total_references'] += len(references)

                logger.info(f"Found {len(resolved_refs)} references in: {title[:50]}...")

            if title and url:
                self.policy_titles[title] = None
                self.policy_titles[self._normalize_title(title)] = None
                short_title = self._get_short_title(title)
                if short_title:
                    self.policy_titles[short_title] = None

            return item

        except Exception as e:
            log_error_with_context(logger, e, f"Error analyzing relations for: {adapter.get('url', 'unknown')}")
            return item

    def _extract_references(self, text):
        if not text:
            return []

        references = []
        seen_titles = set()

        for pattern in RELATION_PATTERNS:
            matches = re.findall(pattern, text)
            for match in matches:
                ref_title = match.strip() if isinstance(match, str) else match[0].strip()

                ref_title = self._clean_reference_title(ref_title)

                if ref_title and len(ref_title) > 3 and ref_title not in seen_titles:
                    seen_titles.add(ref_title)

                    ref_type = self._classify_relation_type(pattern, text, match)

                    references.append({
                        'title': ref_title,
                        'type': ref_type,
                        'context': self._get_reference_context(text, ref_title)
                    })

        law_refs = self._extract_law_references(text)
        for ref in law_refs:
            if ref['title'] not in seen_titles:
                seen_titles.add(ref['title'])
                references.append(ref)

        return references

    def _clean_reference_title(self, title):
        if not title:
            return ''

        title = title.strip()

        title = re.sub(r'^[《〈「『【\[]', '', title)
        title = re.sub(r'[》〉」』】\]]$', '', title)

        title = re.sub(r'\s+', ' ', title)
        title = title.strip()

        if len(title) < 3 or len(title) > 100:
            return ''

        return title

    def _classify_relation_type(self, pattern, text, match):
        pattern_str = pattern if isinstance(pattern, str) else str(pattern)

        if '根据' in pattern_str:
            return 'basis'
        elif '按照' in pattern_str:
            return 'according_to'
        elif '依据' in pattern_str:
            return 'basis'
        elif '参照' in pattern_str:
            return 'reference'
        elif '规定' in pattern_str:
            return 'provision'
        elif '要求' in pattern_str:
            return 'requirement'
        elif '引用' in pattern_str:
            return 'citation'
        else:
            return 'reference'

    def _get_reference_context(self, text, ref_title, context_chars=100):
        pos = text.find(ref_title)
        if pos == -1:
            return ''

        start = max(0, pos - context_chars)
        end = min(len(text), pos + len(ref_title) + context_chars)

        context = text[start:end]
        context = re.sub(r'\s+', ' ', context).strip()

        return context

    def _extract_law_references(self, text):
        references = []

        law_patterns = [
            r'中华人民共和国[^法]*法',
            r'[^\s《〈]+条例',
            r'[^\s《〈]+规定',
            r'[^\s《〈]+办法',
            r'[^\s《〈]+细则',
            r'[^\s《〈]+意见',
            r'[^\s《〈]+通知',
        ]

        for pattern in law_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                match = match.strip()
                if 4 < len(match) < 50:
                    references.append({
                        'title': match,
                        'type': 'law_reference',
                        'context': self._get_reference_context(text, match)
                    })

        return references

    def _match_policy(self, ref_title):
        if not ref_title:
            return None

        if ref_title in self.policy_titles:
            return self.policy_titles[ref_title]

        normalized = self._normalize_title(ref_title)
        if normalized in self.policy_titles:
            return self.policy_titles[normalized]

        for title, pid in self.policy_titles.items():
            if pid and ref_title in title:
                return pid

        for title, pid in self.policy_titles.items():
            if pid and self._title_similarity(ref_title, title) > 0.8:
                return pid

        return None

    def _title_similarity(self, title1, title2):
        if not title1 or not title2:
            return 0.0

        set1 = set(title1)
        set2 = set(title2)

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        if union == 0:
            return 0.0

        return intersection / union

    def _build_relation_graph(self):
        try:
            graph_data = {
                'nodes': [],
                'links': [],
                'statistics': {
                    'total_nodes': len(self.policy_ids),
                    'total_links': self.stats['cross_references'],
                    'connected_components': 0,
                    'average_degree': 0,
                }
            }

            policy_info = {}
            for url, pid in self.policy_ids.items():
                policy = db.get_policy_by_url(url)
                if policy:
                    policy_info[pid] = {
                        'id': pid,
                        'title': policy.get('title', ''),
                        'category': policy.get('category', ''),
                        'url': policy.get('url', ''),
                        'publish_date': policy.get('publish_date', ''),
                    }

            for pid, info in policy_info.items():
                graph_data['nodes'].append({
                    'id': pid,
                    'title': info['title'],
                    'category': info['category'],
                    'url': info['url'],
                    'publish_date': info['publish_date'],
                    'degree': len(self.relation_graph.get(pid, set())),
                })

            for source_id, target_ids in self.relation_graph.items():
                for target_id in target_ids:
                    if source_id in policy_info and target_id in policy_info:
                        graph_data['links'].append({
                            'source': source_id,
                            'target': target_id,
                            'value': 1,
                        })

            degrees = [node['degree'] for node in graph_data['nodes']]
            if degrees:
                graph_data['statistics']['average_degree'] = sum(degrees) / len(degrees)

            connected_components = self._find_connected_components(
                [node['id'] for node in graph_data['nodes']],
                [(link['source'], link['target']) for link in graph_data['links']]
            )
            graph_data['statistics']['connected_components'] = connected_components

            return graph_data

        except Exception as e:
            log_error_with_context(logger, e, "Failed to build relation graph")
            return None

    def _find_connected_components(self, nodes, edges):
        parent = {node: node for node in nodes}

        def find(x):
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]

        def union(x, y):
            parent[find(x)] = find(y)

        for u, v in edges:
            if u in parent and v in parent:
                union(u, v)

        components = set()
        for node in nodes:
            components.add(find(node))

        return len(components)

    def export_relation_graph(self, output_path):
        graph_data = self._build_relation_graph()
        if graph_data:
            try:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(graph_data, f, ensure_ascii=False, indent=2)
                logger.info(f"Relation graph exported to {output_path}")
                return True
            except Exception as e:
                log_error_with_context(logger, e, "Failed to export relation graph")
        return False

    def close_spider(self, spider):
        logger.info("=" * 60)
        logger.info("RELATION PIPELINE STATISTICS")
        logger.info("=" * 60)
        logger.info(f"Total references found: {self.stats['total_references']}")
        logger.info(f"Policies with relations: {self.stats['relations_found']}")
        logger.info(f"Cross-references: {self.stats['cross_references']}")
        logger.info(f"Self-references: {self.stats['self_references']}")
        logger.info(f"Unresolved references: {self.stats['unresolved_references']}")
        if self.stats['total_references'] > 0:
            resolution_rate = (self.stats['cross_references'] + self.stats['self_references']) / self.stats['total_references'] * 100
            logger.info(f"Resolution rate: {resolution_rate:.1f}%")
        logger.info("\nBy relation type:")
        for rel_type, count in self.stats['by_relation_type'].most_common():
            logger.info(f"  {rel_type:20s}: {count}")
        logger.info("=" * 60)

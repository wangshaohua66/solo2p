import * as cheerio from 'cheerio';
import { compareTwoStrings } from 'string-similarity';
import { diffLines, Change } from 'diff';
import logger from '../utils/logger';
import { PolicySnapshot, PolicyListItem, ChangeRecord, SiteConfig } from '../types';
import { md5, cleanText, truncate, nowIso } from '../utils/helpers';
import repository from '../storage/repository';

const SIMILARITY_THRESHOLD = 0.85;

export class ChangeDetector {
  private siteConfig: SiteConfig;

  constructor(siteConfig: SiteConfig) {
    this.siteConfig = siteConfig;
  }

  extractListItems(html: string): PolicyListItem[] {
    const $ = cheerio.load(html);
    const items: PolicyListItem[] = [];
    const { listItem, title, link, publishDate } = this.siteConfig.selectors;

    $(listItem).each((_, element) => {
      const $el = $(element);
      const titleEl = $el.find(title);
      const linkEl = $el.find(link);
      const dateEl = $el.find(publishDate);

      let itemTitle = cleanText(titleEl.text() || titleEl.attr('title') || '');
      let itemUrl = linkEl.attr('href') || '';
      let itemDate = cleanText(dateEl.text() || '');

      if (itemUrl && !itemUrl.startsWith('http')) {
        itemUrl = new URL(itemUrl, this.siteConfig.baseUrl).href;
      }

      if (itemTitle && itemUrl) {
        items.push({
          title: itemTitle,
          url: itemUrl,
          publishDate: itemDate
        });
      }
    });

    logger.getLogger(this.siteConfig.id).debug(`Extracted ${items.length} items from list page`);
    return items;
  }

  detectListChanges(currentItems: PolicyListItem[], previousItems: PolicyListItem[]): {
    added: PolicyListItem[];
    removed: PolicyListItem[];
    unchanged: PolicyListItem[];
  } {
    const prevMap = new Map(previousItems.map(item => [item.url, item]));
    const currMap = new Map(currentItems.map(item => [item.url, item]));

    const added: PolicyListItem[] = [];
    const removed: PolicyListItem[] = [];
    const unchanged: PolicyListItem[] = [];

    for (const item of currentItems) {
      if (!prevMap.has(item.url)) {
        added.push(item);
      } else {
        const prevItem = prevMap.get(item.url)!;
        if (prevItem.title === item.title && prevItem.publishDate === item.publishDate) {
          unchanged.push(item);
        } else {
          added.push(item);
        }
      }
    }

    for (const item of previousItems) {
      if (!currMap.has(item.url)) {
        removed.push(item);
      }
    }

    logger.getLogger(this.siteConfig.id).info(
      `List changes detected: +${added.length} added, -${removed.length} removed, ${unchanged.length} unchanged`
    );

    return { added, removed, unchanged };
  }

  computeTextSimilarity(text1: string, text2: string): number {
    const clean1 = cleanText(text1);
    const clean2 = cleanText(text2);

    if (!clean1 || !clean2) return 0;
    if (clean1 === clean2) return 1;

    return compareTwoStrings(clean1, clean2);
  }

  computeContentDiff(oldText: string, newText: string): {
    similarity: number;
    changes: Change[];
    diffSummary: string;
    changed: boolean;
  } {
    const similarity = this.computeTextSimilarity(oldText, newText);
    const changes = diffLines(oldText, newText);
    const changed = similarity < SIMILARITY_THRESHOLD;

    const addedLines = changes.filter(c => c.added).reduce((sum, c) => sum + (c.count ?? 0), 0);
    const removedLines = changes.filter(c => c.removed).reduce((sum, c) => sum + (c.count ?? 0), 0);

    const changedParts = changes
      .filter(c => c.added || c.removed)
      .map(c => `${c.added ? '+' : '-'} ${truncate(c.value.trim(), 100)}`)
      .join('\n');

    const diffSummary = `相似度: ${(similarity * 100).toFixed(1)}%, 新增${addedLines}行, 删除${removedLines}行\n变更摘要:\n${truncate(changedParts, 500)}`;

    return {
      similarity,
      changes,
      diffSummary,
      changed
    };
  }

  extractContentText(html: string): string {
    const $ = cheerio.load(html);
    const contentSelector = this.siteConfig.selectors.detailContent;
    const content = $(contentSelector).text() || $('body').text();
    return cleanText(content);
  }

  extractContentHash(html: string): string {
    const text = this.extractContentText(html);
    return md5(text);
  }

  async detectDetailChange(
    url: string,
    currentHtml: string,
    currentTitle: string
  ): Promise<ChangeRecord | null> {
    const siteLogger = logger.getLogger(this.siteConfig.id);

    const currentText = this.extractContentText(currentHtml);
    const currentHash = this.extractContentHash(currentHtml);

    const previous = repository.getLatestSnapshotByUrl(this.siteConfig.id, url);

    if (!previous) {
      siteLogger.info(`New policy detected: ${truncate(currentTitle, 60)}`);

      const snapshot: PolicySnapshot = {
        siteId: this.siteConfig.id,
        url,
        title: currentTitle,
        publishDate: '',
        contentHash: currentHash,
        contentText: currentText,
        contentHtml: currentHtml,
        fetchedAt: nowIso(),
        snapshotVersion: 1
      };
      const snapshotId = repository.insertSnapshot(snapshot);

      const changeRecord: ChangeRecord = {
        siteId: this.siteConfig.id,
        policyUrl: url,
        policyTitle: currentTitle,
        changeType: 'add',
        similarity: 0,
        diffSummary: '新增政策文件',
        currentSnapshotId: snapshotId,
        changeLevel: this.classifyChangeLevel(currentText),
        detectedAt: nowIso(),
        notified: false
      };

      const changeId = repository.insertChangeRecord(changeRecord);
      changeRecord.id = changeId;

      return changeRecord;
    }

    if (previous.contentHash === currentHash) {
      siteLogger.debug(`Content unchanged: ${truncate(currentTitle, 60)}`);
      return null;
    }

    const diffResult = this.computeContentDiff(previous.contentText || '', currentText);

    if (!diffResult.changed) {
      siteLogger.debug(
        `Content similar (${(diffResult.similarity * 100).toFixed(1)}%), no change recorded: ${truncate(currentTitle, 60)}`
      );
      return null;
    }

    siteLogger.info(
      `Policy modified (${(diffResult.similarity * 100).toFixed(1)}%): ${truncate(currentTitle, 60)}`
    );

    const newVersion = (previous.snapshotVersion || 1) + 1;
    const snapshot: PolicySnapshot = {
      siteId: this.siteConfig.id,
      url,
      title: currentTitle,
      publishDate: '',
      contentHash: currentHash,
      contentText: currentText,
      contentHtml: currentHtml,
      fetchedAt: nowIso(),
      snapshotVersion: newVersion
    };
    const newSnapshotId = repository.insertSnapshot(snapshot);

    const changeRecord: ChangeRecord = {
      siteId: this.siteConfig.id,
      policyUrl: url,
      policyTitle: currentTitle,
      changeType: 'modify',
      similarity: diffResult.similarity,
      diffSummary: diffResult.diffSummary,
      previousSnapshotId: previous.id,
      currentSnapshotId: newSnapshotId,
      changeLevel: this.classifyChangeLevel(currentText, diffResult.similarity),
      detectedAt: nowIso(),
      notified: false
    };

    const changeId = repository.insertChangeRecord(changeRecord);
    changeRecord.id = changeId;

    return changeRecord;
  }

  private classifyChangeLevel(content: string, similarity?: number): 'high' | 'medium' | 'low' {
    const highKeywords = [
      '缴费基数', '缴费比例', '最低工资', '缴存比例', '缴存基数',
      '生育津贴', '报销比例', '医保待遇', '养老金', '退休金',
      '失业保险金', '工伤保险', '费率调整', '基数上下限'
    ];

    const mediumKeywords = [
      '办理流程', '办事指南', '经办规程', '系统升级', '通知公告',
      '政策解读', '实施细则', '补充通知'
    ];

    const contentLower = content.toLowerCase();

    let highScore = 0;
    let mediumScore = 0;

    for (const kw of highKeywords) {
      if (contentLower.includes(kw)) {
        highScore++;
      }
    }

    for (const kw of mediumKeywords) {
      if (contentLower.includes(kw)) {
        mediumScore++;
      }
    }

    if (highScore >= 2 || (highScore >= 1 && similarity !== undefined && similarity < 0.7)) {
      return 'high';
    }
    if (highScore >= 1 || mediumScore >= 2) {
      return 'medium';
    }
    return 'low';
  }

  getSimilarityThreshold(): number {
    return SIMILARITY_THRESHOLD;
  }
}

export default ChangeDetector;

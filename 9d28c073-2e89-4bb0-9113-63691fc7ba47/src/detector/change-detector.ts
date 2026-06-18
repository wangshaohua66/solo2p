import * as cheerio from 'cheerio';
import { compareTwoStrings } from 'string-similarity';
import { diffLines, Change } from 'diff';
import logger from '../utils/logger';
import { PolicySnapshot, PolicyListItem, ChangeRecord, SiteConfig, CustomerMapping } from '../types';
import { md5, cleanText, truncate, nowIso } from '../utils/helpers';
import repository from '../storage/repository';

const SIMILARITY_THRESHOLD = 0.85;

const ABOLISH_KEYWORDS = [
  '废止', '失效', '停止执行', '不再执行', '予以废止',
  '自本通知印发之日起废止', '同时废止', '宣告失效',
  '自动失效', '失去效力', '停止适用', '不再适用'
];

const ABOLISH_TITLE_PATTERNS = [
  /关于废止/i,
  /关于宣布.*失效/i,
  /关于失效/i,
  /废止.*通知/i,
  /失效.*公告/i
];

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

  detectAbolish(title: string, content: string): boolean {
    for (const pattern of ABOLISH_TITLE_PATTERNS) {
      if (pattern.test(title)) {
        logger.getLogger(this.siteConfig.id).info(`Abolish detected by title pattern: ${truncate(title, 60)}`);
        return true;
      }
    }

    const contentLower = content.toLowerCase();
    let abolishScore = 0;
    for (const keyword of ABOLISH_KEYWORDS) {
      if (contentLower.includes(keyword.toLowerCase())) {
        abolishScore++;
      }
    }

    if (abolishScore >= 2) {
      logger.getLogger(this.siteConfig.id).info(`Abolish detected by keywords (${abolishScore} matches): ${truncate(title, 60)}`);
      return true;
    }

    return false;
  }

  resolveAffectedCustomers(): string[] {
    const customers = repository.getCustomersByCategoryAndProvince(
      this.siteConfig.category,
      this.siteConfig.province
    );

    const customerIds = customers.map(c => c.customerId);
    if (customerIds.length > 0) {
      logger.getLogger(this.siteConfig.id).debug(
        `Resolved ${customerIds.length} affected customers for ${this.siteConfig.province}/${this.siteConfig.category}`
      );
    }

    return customerIds;
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

      const isAbolish = this.detectAbolish(currentTitle, currentText);
      const changeType = isAbolish ? 'abolish' : 'add';

      const changeRecord: ChangeRecord = {
        siteId: this.siteConfig.id,
        policyUrl: url,
        policyTitle: currentTitle,
        changeType,
        similarity: 0,
        diffSummary: isAbolish ? '新增废止类政策文件' : '新增政策文件',
        currentSnapshotId: snapshotId,
        changeLevel: this.classifyChangeLevel(currentText, undefined, isAbolish),
        affectedCustomers: this.resolveAffectedCustomers(),
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

    const isAbolish = this.detectAbolish(currentTitle, currentText);

    if (isAbolish) {
      siteLogger.info(`Policy abolished: ${truncate(currentTitle, 60)}`);

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
        changeType: 'abolish',
        similarity: diffResult.similarity,
        diffSummary: `政策废止。${diffResult.diffSummary}`,
        previousSnapshotId: previous.id,
        currentSnapshotId: newSnapshotId,
        changeLevel: 'high',
        affectedCustomers: this.resolveAffectedCustomers(),
        detectedAt: nowIso(),
        notified: false
      };

      const changeId = repository.insertChangeRecord(changeRecord);
      changeRecord.id = changeId;

      return changeRecord;
    }

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
      changeLevel: this.classifyChangeLevel(currentText, diffResult.similarity, false),
      affectedCustomers: this.resolveAffectedCustomers(),
      detectedAt: nowIso(),
      notified: false
    };

    const changeId = repository.insertChangeRecord(changeRecord);
    changeRecord.id = changeId;

    return changeRecord;
  }

  detectAbolishFromListRemoval(
    removedItems: PolicyListItem[]
  ): ChangeRecord[] {
    const siteLogger = logger.getLogger(this.siteConfig.id);
    const records: ChangeRecord[] = [];

    for (const item of removedItems) {
      siteLogger.info(`Policy removed from list (potential abolish): ${truncate(item.title, 60)}`);

      const changeRecord: ChangeRecord = {
        siteId: this.siteConfig.id,
        policyUrl: item.url,
        policyTitle: item.title,
        changeType: 'abolish',
        similarity: 0,
        diffSummary: `政策从列表页移除，疑似废止。原发布日期: ${item.publishDate || '未知'}`,
        changeLevel: 'medium',
        affectedCustomers: this.resolveAffectedCustomers(),
        detectedAt: nowIso(),
        notified: false
      };

      const changeId = repository.insertChangeRecord(changeRecord);
      changeRecord.id = changeId;
      records.push(changeRecord);
    }

    return records;
  }

  private classifyChangeLevel(
    content: string,
    similarity?: number,
    isAbolish?: boolean
  ): 'high' | 'medium' | 'low' {
    if (isAbolish) {
      return 'high';
    }

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

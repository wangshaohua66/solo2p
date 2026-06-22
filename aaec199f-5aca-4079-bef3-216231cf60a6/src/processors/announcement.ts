import { Announcement, AnnouncementType, ProjectCategory, ChangeType } from '../types';
import { logger } from '../utils/logger';
import * as dayjs from 'dayjs';

export class AnnouncementParser {
  parse(announcement: Announcement): Announcement {
    const parsed = { ...announcement };

    parsed.title = this.cleanText(parsed.title);
    parsed.content = this.cleanText(parsed.content);
    parsed.projectName = this.cleanText(parsed.projectName);

    parsed.announcementType = this.inferAnnouncementType(parsed.title, parsed.content);
    parsed.projectCategory = this.inferProjectCategory(parsed.title, parsed.content);

    if (parsed.announcementType === AnnouncementType.CHANGE_NOTICE) {
      parsed.changeType = this.inferChangeType(parsed.title, parsed.content);
    }

    parsed.budgetAmount = this.normalizeBudgetAmount(parsed.budgetAmount, parsed.content);

    if (parsed.contactPhone) {
      parsed.contactPhone = this.normalizePhone(parsed.contactPhone);
    }

    if (parsed.contactEmail) {
      parsed.contactEmail = parsed.contactEmail.toLowerCase().trim();
    }

    parsed.publishTime = this.normalizeDateTime(parsed.publishTime);
    parsed.tenderDeadline = this.normalizeDateTime(parsed.tenderDeadline);

    if (parsed.attachmentUrls) {
      parsed.attachmentUrls = parsed.attachmentUrls.filter(url => this.isValidUrl(url));
    }

    logger.debug(`公告解析完成: ${parsed.title}`);
    return parsed;
  }

  private cleanText(text: string | undefined): string {
    if (!text) return '';
    return text
      .replace(/\u00A0/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t+/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  }

  private inferAnnouncementType(title: string, content: string): AnnouncementType {
    const text = `${title} ${content}`;

    const typePatterns: Record<AnnouncementType, RegExp[]> = {
      [AnnouncementType.WINNING_RESULT]: [
        /中标(结果|公告|候选人)/,
        /成交(结果|公告)/,
        /预中标/,
        /中标公示/
      ],
      [AnnouncementType.CHANGE_NOTICE]: [
        /变更公告/,
        /更正公告/,
        /补充公告/,
        /延期公告/,
        /澄清公告/,
        /修改公告/,
        /暂停公告/,
        /终止公告/
      ],
      [AnnouncementType.QA_CLARIFICATION]: [
        /答疑公告/,
        /答疑澄清/,
        /问题答复/,
        /补充文件/,
        /回复公告/
      ],
      [AnnouncementType.TENDER_NOTICE]: [
        /招标公告/,
        /采购公告/,
        /竞争性谈判/,
        /竞争性磋商/,
        /询价公告/,
        /单一来源/,
        /邀请公告/,
        /挂牌公告/,
        /出让公告/
      ]
    };

    for (const [type, patterns] of Object.entries(typePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return type as AnnouncementType;
        }
      }
    }

    return AnnouncementType.TENDER_NOTICE;
  }

  private inferProjectCategory(title: string, content: string): ProjectCategory {
    const text = `${title} ${content}`;

    const categoryPatterns: Record<ProjectCategory, RegExp[]> = {
      [ProjectCategory.ENGINEERING_CONSTRUCTION]: [
        /工程建设/,
        /施工招标/,
        /监理/,
        /设计招标/,
        /勘察/,
        /总承包/,
        /建筑工程/,
        /市政工程/,
        /公路工程/,
        /水利工程/
      ],
      [ProjectCategory.LAND_MINERAL]: [
        /土地出让/,
        /矿产/,
        /采矿权/,
        /探矿权/,
        /国有建设用地/,
        /挂牌出让/,
        /土地使用权/,
        /矿业权/
      ],
      [ProjectCategory.PROPERTY_RIGHTS]: [
        /产权交易/,
        /股权转让/,
        /资产转让/,
        /租赁/,
        /经营权/,
        /债权/,
        /知识产权/
      ],
      [ProjectCategory.GOVERNMENT_PROCUREMENT]: [
        /政府采购/,
        /货物类/,
        /服务类/,
        /询价/,
        /竞争性谈判/,
        /竞争性磋商/,
        /办公设备/,
        /软件开发/,
        /运维服务/
      ]
    };

    const scores: Record<string, number> = {
      [ProjectCategory.ENGINEERING_CONSTRUCTION]: 0,
      [ProjectCategory.LAND_MINERAL]: 0,
      [ProjectCategory.PROPERTY_RIGHTS]: 0,
      [ProjectCategory.GOVERNMENT_PROCUREMENT]: 0
    };

    for (const [category, patterns] of Object.entries(categoryPatterns)) {
      for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
          scores[category] += matches.length;
        }
      }
    }

    let maxScore = 0;
    let maxCategory = ProjectCategory.GOVERNMENT_PROCUREMENT;

    for (const [category, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxCategory = category as ProjectCategory;
      }
    }

    return maxCategory;
  }

  private inferChangeType(title: string, content: string): ChangeType {
    const text = `${title} ${content}`;

    if (/延期|延长|推迟|顺延/.test(text)) {
      return ChangeType.DEADLINE_EXTENSION;
    }

    if (/预算|金额|限价|控制价|最高|预算金额/.test(text)) {
      return ChangeType.BUDGET_ADJUSTMENT;
    }

    if (/取消|终止|暂停|撤销|流标|废标/.test(text)) {
      return ChangeType.CANCELLATION;
    }

    if (/变更|修改|调整|更正/.test(text)) {
      return ChangeType.CONTENT_MODIFICATION;
    }

    return ChangeType.OTHER;
  }

  private normalizeBudgetAmount(amount: number | undefined, content: string): number | undefined {
    if (amount !== undefined && amount > 0) {
      return amount;
    }

    const patterns = [
      /预算金额[：:]\s*([\d,.]+)\s*(万元|元|亿)/,
      /最高限价[：:]\s*([\d,.]+)\s*(万元|元|亿)/,
      /招标控制价[：:]\s*([\d,.]+)\s*(万元|元|亿)/,
      /采购预算[：:]\s*([\d,.]+)\s*(万元|元|亿)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        const numStr = match[1].replace(/[,.]/g, '');
        const unit = match[2];
        let value = parseFloat(numStr);

        if (unit.includes('万')) {
          value *= 10000;
        } else if (unit.includes('亿')) {
          value *= 100000000;
        }

        if (!isNaN(value) && value > 0) {
          return value;
        }
      }
    }

    return undefined;
  }

  private normalizePhone(phone: string): string {
    return phone
      .replace(/[^\d-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeDateTime(dateStr: string | undefined): string {
    if (!dateStr) return '';

    const cleanStr = dateStr
      .replace(/[年月]/g, '-')
      .replace(/[日号]/g, '')
      .replace(/[时点]/g, ':')
      .replace(/分/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const formats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD',
      'MM-DD-YYYY',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY/MM/DD',
      'MM/DD/YYYY'
    ];

    for (const format of formats) {
      const parsed = dayjs(cleanStr, format);
      if (parsed.isValid()) {
        return parsed.format('YYYY-MM-DD HH:mm:ss');
      }
    }

    const fallbackParsed = dayjs(cleanStr);
    if (fallbackParsed.isValid()) {
      return fallbackParsed.format('YYYY-MM-DD HH:mm:ss');
    }

    return dateStr;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  extractKeywords(announcement: Announcement): string[] {
    const text = `${announcement.title} ${announcement.projectName} ${announcement.content}`;
    const keywords: string[] = [];

    const projectTypePatterns = [
      /软件开发|信息化|系统建设|平台建设|数据中心|云平台/,
      /网络安全|等保|安全加固|防火墙/,
      /办公设备|打印机|电脑|服务器|存储/,
      /家具|办公家具|桌椅|文件柜/,
      /车辆|汽车|公务车/,
      /装修|装饰|维修|改造/,
      /绿化|园林|保洁|物业/,
      /印刷|打印|耗材/,
      /会议|展览|培训|咨询/,
      /医疗|医院|设备|器械/,
      /教育|学校|教学|实验室/
    ];

    for (const pattern of projectTypePatterns) {
      const match = text.match(pattern);
      if (match) {
        keywords.push(match[0]);
      }
    }

    if (announcement.budgetAmount) {
      if (announcement.budgetAmount >= 1000000) {
        keywords.push('大额采购');
      }
      if (announcement.budgetAmount >= 10000000) {
        keywords.push('千万级项目');
      }
    }

    if (announcement.region) {
      keywords.push(announcement.region);
    }

    return [...new Set(keywords)];
  }
}

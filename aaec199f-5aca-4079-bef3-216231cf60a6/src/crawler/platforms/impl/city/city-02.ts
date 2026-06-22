import { Page } from 'playwright';
import { ProvincialPlatformAdapter } from '../provincial';
import { PlatformConfig, AnnouncementListItem } from '../../../../types';
import { logger } from '../../../../utils/logger';

export class City02Adapter extends ProvincialPlatformAdapter {
  constructor(config: PlatformConfig) {
    super(config);
  }

  async fetchList(pageNum: number): Promise<AnnouncementListItem[]> {
    if (this.config.pagination.type === 'infinite_scroll') {
      return this.fetchListInfiniteScroll(pageNum);
    }
    return super.fetchList(pageNum);
  }

  private async fetchListInfiniteScroll(pageNum: number): Promise<AnnouncementListItem[]> {
    return this.withRetry(
      () => this.fetchListInfiniteScrollInternal(pageNum),
      `无限滚动第${pageNum}页`,
      this.config.listUrl
    );
  }

  private async fetchListInfiniteScrollInternal(pageNum: number): Promise<AnnouncementListItem[]> {
    const page = await this.createPage();
    const selectors = this.config.selectors;

    try {
      await this.safeNavigate(page, this.config.listUrl, this.config.timeout.listPage);
      await this.waitForDynamicContent(page, selectors.listContainer);

      for (let i = 0; i < pageNum - 1; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.sleep(1500);
      }

      const items = await page.$$eval(
        selectors.listItems,
        (elements, selectors) => {
          return elements.map(el => {
            const titleEl = el.querySelector(selectors.itemTitle);
            const linkEl = el.querySelector(selectors.itemLink);
            const timeEl = el.querySelector(selectors.itemTime);

            return {
              title: titleEl?.textContent?.trim() || '',
              detailUrl: linkEl?.getAttribute('href') || '',
              publishTime: timeEl?.textContent?.trim() || ''
            };
          });
        },
        selectors
      );

      const listItems: AnnouncementListItem[] = [];
      for (const item of items) {
        if (item.title && item.detailUrl) {
          listItems.push({
            title: item.title,
            detailUrl: this.normalizeUrl(item.detailUrl),
            publishTime: this['normalizeDate'](item.publishTime),
            announcementType: this.detectAnnouncementType(item.title)
          });
        }
      }

      logger.debug(`[${this.config.name}] 无限滚动第${pageNum}页获取${listItems.length}条公告`);
      return listItems;
    } finally {
      await page.close();
    }
  }
}

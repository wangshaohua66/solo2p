import { By, until, Condition } from 'selenium-webdriver';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('Navigator');

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_POLL_INTERVAL = 500;
const DEFAULT_SCROLL_WAIT = 1500;
const DEFAULT_MAX_PAGES = 100;

const DEFAULT_POPUP_SELECTORS = [
  '.modal-close',
  '.close-btn',
  '.popup-close',
  '.btn-close',
  '.close',
  '[data-dismiss="modal"]',
  '.ant-modal-close',
  '.el-dialog__close',
  '.van-popup__close-icon',
  '.mask-close',
  '.advert-close',
  '.ad-close',
  '.dialog-close',
  '.layui-layer-close',
  '.jconfirm-closeIcon'
];

function isWebDriverIO(driver) {
  return driver && typeof driver.$ === 'function';
}

function isSelenium(driver) {
  return driver && typeof driver.findElement === 'function';
}

async function findElement(driver, selector) {
  if (isWebDriverIO(driver)) {
    const el = await driver.$(selector);
    return el.error ? null : el;
  } else {
    try {
      return await driver.findElement(By.css(selector));
    } catch (e) {
      return null;
    }
  }
}

async function findElements(driver, selector) {
  if (isWebDriverIO(driver)) {
    const elements = await driver.$$(selector);
    return elements || [];
  } else {
    return await driver.findElements(By.css(selector));
  }
}

async function executeScript(driver, script, ...args) {
  if (isWebDriverIO(driver)) {
    return await driver.execute(script, ...args);
  } else {
    return await driver.executeScript(script, ...args);
  }
}

async function driverSleep(driver, ms) {
  if (isWebDriverIO(driver)) {
    return await driver.pause(ms);
  } else {
    return await driver.sleep(ms);
  }
}

async function navigateTo(driver, url) {
  if (isWebDriverIO(driver)) {
    return await driver.url(url);
  } else {
    return await driver.get(url);
  }
}

async function getCurrentUrl(driver) {
  if (isWebDriverIO(driver)) {
    return await driver.getUrl();
  } else {
    return await driver.getCurrentUrl();
  }
}

async function elementClick(element) {
  return await element.click();
}

async function elementGetText(element) {
  return await element.getText();
}

async function elementIsDisplayed(element) {
  return await element.isDisplayed();
}

async function elementIsEnabled(element) {
  return await element.isEnabled();
}

async function elementFindElement(element, selector) {
  if (isWebDriverIO(element)) {
    return await element.$(selector);
  } else {
    try {
      return await element.findElement(By.css(selector));
    } catch (e) {
      return null;
    }
  }
}

async function waitForElementLocated(driver, selector, timeout = DEFAULT_TIMEOUT) {
  if (isWebDriverIO(driver)) {
    await driver.waitUntil(
      async () => {
        const el = await driver.$(selector);
        return el && !el.error;
      },
      {
        timeout,
        timeoutMsg: `Element located by ${selector} not found after ${timeout}ms`
      }
    );
    return true;
  } else {
    await driver.wait(until.elementLocated(By.css(selector)), timeout);
    return true;
  }
}

async function waitForElementVisible(driver, selector, timeout = DEFAULT_TIMEOUT) {
  if (isWebDriverIO(driver)) {
    await driver.waitUntil(
      async () => {
        const el = await driver.$(selector);
        if (el.error) return false;
        return await el.isDisplayed();
      },
      {
        timeout,
        timeoutMsg: `Element located by ${selector} not visible after ${timeout}ms`
      }
    );
    return true;
  } else {
    await driver.wait(until.elementLocated(By.css(selector)), timeout);
    const el = await driver.findElement(By.css(selector));
    await driver.wait(until.elementIsVisible(el), timeout);
    return true;
  }
}

export async function navigateToListPage(driver, siteConfig, page) {
  const { listUrlTemplate, pagination } = siteConfig;
  const pageParam = pagination?.pageParam || 'page';
  const maxPages = pagination?.maxPages || DEFAULT_MAX_PAGES;

  if (page < 1) {
    page = 1;
  }
  if (page > maxPages) {
    logger.warn(`页码 ${page} 超过最大页数 ${maxPages}，将使用最大页数`);
    page = maxPages;
  }

  const url = listUrlTemplate.replace(`{${pageParam}}`, String(page));
  logger.info(`导航到列表页: ${siteConfig.name} 第${page}页`, { url });

  try {
    await navigateTo(driver, url);
    logger.debug(`页面加载完成: ${url}`);
    return true;
  } catch (error) {
    logger.error(`导航到列表页失败: ${url}`, error.message);
    return false;
  }
}

export async function traverseListPage(driver, siteConfig, options = {}) {
  const { pagination, selectors } = siteConfig;
  const paginationType = pagination?.paginationType || 'page';
  const maxPages = options.maxPages || pagination?.maxPages || DEFAULT_MAX_PAGES;
  const lastCrawlTime = options.lastCrawlTime || null;
  const listItemSelector = selectors?.list?.listItemSelector || '.list-item';
  const dateSelector = selectors?.list?.dateSelector || null;

  logger.info(`开始遍历列表页: ${siteConfig.name}`, {
    paginationType,
    maxPages,
    hasLastCrawlTime: !!lastCrawlTime
  });

  const allItems = [];
  let currentPage = 1;
  let hasMore = true;
  let stoppedByOldItem = false;

  try {
    const initialItems = await waitForListItems(driver, listItemSelector, {
      timeout: options.timeout || DEFAULT_TIMEOUT
    });
    logger.debug(`初始列表项数量: ${initialItems.length}`);

    if (initialItems.length === 0) {
      logger.warn('初始列表为空，返回空结果');
      return { items: [], totalPages: 0, stoppedByOldItem: false };
    }

    for (let i = 0; i < initialItems.length; i++) {
      const item = initialItems[i];
      if (lastCrawlTime && dateSelector) {
        const isOld = await isOldItem(item, lastCrawlTime, siteConfig);
        if (isOld) {
          logger.info(`遇到已采集的旧标的，停止翻页 (第${currentPage}页 第${i + 1}项)`);
          stoppedByOldItem = true;
          hasMore = false;
          break;
        }
      }
      allItems.push(item);
    }

    if (stoppedByOldItem) {
      return { items: allItems, totalPages: currentPage, stoppedByOldItem: true };
    }

    while (hasMore && currentPage < maxPages) {
      let prevCount = allItems.length;

      switch (paginationType) {
        case 'page':
          hasMore = await goToNextPage(driver, siteConfig, currentPage + 1);
          break;
        case 'loadMore':
          hasMore = await loadMore(driver, siteConfig);
          break;
        case 'infiniteScroll':
          hasMore = await infiniteScrollNext(driver, siteConfig, prevCount);
          break;
        default:
          logger.warn(`未知的分页类型: ${paginationType}，停止遍历`);
          hasMore = false;
      }

      if (!hasMore) {
        logger.debug(`没有更多内容，结束遍历 (共${currentPage}页)`);
        break;
      }

      currentPage++;

      const newItems = await waitForListItems(driver, listItemSelector, {
        minCount: prevCount + 1,
        timeout: options.timeout || DEFAULT_TIMEOUT
      });

      const newCount = newItems.length - prevCount;
      logger.debug(`第${currentPage}页加载完成，新增 ${newCount} 项`);

      if (newCount <= 0) {
        hasMore = false;
        break;
      }

      let hitOldItem = false;
      for (let i = prevCount; i < newItems.length; i++) {
        const item = newItems[i];
        if (lastCrawlTime && dateSelector) {
          const isOld = await isOldItem(item, lastCrawlTime, siteConfig);
          if (isOld) {
            logger.info(`遇到已采集的旧标的，停止翻页 (第${currentPage}页 第${i - prevCount + 1}项)`);
            hitOldItem = true;
            break;
          }
        }
        allItems.push(item);
      }

      if (hitOldItem) {
        stoppedByOldItem = true;
        hasMore = false;
        break;
      }
    }

    logger.info(`列表遍历完成: ${siteConfig.name}`, {
      totalItems: allItems.length,
      totalPages: currentPage,
      stoppedByOldItem
    });

    return {
      items: allItems,
      totalPages: currentPage,
      stoppedByOldItem
    };
  } catch (error) {
    logger.error(`遍历列表页异常: ${siteConfig.name}`, error.message);
    return {
      items: allItems,
      totalPages: currentPage,
      stoppedByOldItem,
      error: error.message
    };
  }
}

async function goToNextPage(driver, siteConfig, nextPage) {
  const { pagination, listUrlTemplate } = siteConfig;
  const pageParam = pagination?.pageParam || 'page';
  const maxPages = pagination?.maxPages || DEFAULT_MAX_PAGES;

  if (nextPage > maxPages) {
    logger.debug(`已达到最大页数 ${maxPages}`);
    return false;
  }

  const url = listUrlTemplate.replace(`{${pageParam}}`, String(nextPage));

  try {
    await navigateTo(driver, url);
    logger.debug(`翻页到第${nextPage}页: ${url}`);
    return true;
  } catch (error) {
    logger.warn(`翻页失败: ${error.message}`);
    return false;
  }
}

async function loadMore(driver, siteConfig) {
  const loadMoreSelectors = [
    '.load-more-btn',
    '.more-btn',
    '.btn-load-more',
    '.loadmore',
    '.J_LoadMore',
    '[data-load-more]',
    '.pagination .next',
    '.next-page',
    '.pager-next'
  ];

  for (const selector of loadMoreSelectors) {
    try {
      const elements = await findElements(driver, selector);
      if (elements.length > 0) {
        const btn = elements[0];
        const isDisplayed = await elementIsDisplayed(btn);
        const isEnabled = await elementIsEnabled(btn);

        if (isDisplayed && isEnabled) {
          logger.debug(`点击加载更多按钮: ${selector}`);
          await elementClick(btn);
          await driverSleep(driver, 1000);
          return true;
        }
      }
    } catch (error) {
      continue;
    }
  }

  logger.debug('未找到可点击的加载更多按钮');
  return false;
}

async function infiniteScrollNext(driver, siteConfig, prevCount) {
  const listItemSelector = siteConfig.selectors?.list?.listItemSelector || '.list-item';

  try {
    await scrollToBottom(driver);
    await driverSleep(driver, DEFAULT_SCROLL_WAIT);

    const newCount = await findElements(driver, listItemSelector).then(els => els.length);

    if (newCount > prevCount) {
      logger.debug(`无限滚动加载，新增 ${newCount - prevCount} 项`);
      return true;
    }

    const scrollHeightBefore = await executeScript(driver, 'return document.body.scrollHeight');
    await scrollToBottom(driver);
    await driverSleep(driver, DEFAULT_SCROLL_WAIT);
    const scrollHeightAfter = await executeScript(driver, 'return document.body.scrollHeight');

    if (scrollHeightAfter > scrollHeightBefore) {
      logger.debug('页面高度增加，继续加载');
      return true;
    }

    logger.debug('无限滚动无更多内容');
    return false;
  } catch (error) {
    logger.warn(`无限滚动失败: ${error.message}`);
    return false;
  }
}

export async function waitForDynamicContent(driver, options = {}) {
  const {
    type = 'detail',
    selector = null,
    timeout = DEFAULT_TIMEOUT,
    pollInterval = DEFAULT_POLL_INTERVAL,
    minItems = 1,
    listItemSelector = null
  } = options;

  logger.debug(`等待动态内容加载`, { type, selector, timeout });

  try {
    if (type === 'list' && listItemSelector) {
      return await waitForListItems(driver, listItemSelector, {
        minCount: minItems,
        timeout,
        pollInterval
      });
    }

    if (type === 'detail') {
      return await waitForDomStable(driver, { timeout, pollInterval, selector });
    }

    if (selector) {
      return await waitForSelector(driver, selector, { timeout });
    }

    return true;
  } catch (error) {
    logger.warn(`等待动态内容超时，降级返回: ${error.message}`);
    return null;
  }
}

async function waitForDomStable(driver, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL, selector = null } = options;
  const startTime = Date.now();
  let lastDomHash = '';
  let stableCount = 0;
  const requiredStableCount = 3;

  logger.debug('等待DOM稳定...');

  while (Date.now() - startTime < timeout) {
    try {
      const domHash = await executeScript(driver, `
        const target = ${selector ? `document.querySelector('${selector}')` : 'document.body'};
        if (!target) return '';
        return target.innerHTML.length + '|' + target.children.length;
      `);

      if (domHash === lastDomHash && domHash !== '') {
        stableCount++;
        if (stableCount >= requiredStableCount) {
          logger.debug(`DOM已稳定 (连续${requiredStableCount}次检测一致)`);
          return true;
        }
      } else {
        stableCount = 0;
        lastDomHash = domHash;
      }
    } catch (e) {
      // 忽略执行错误
    }

    await driverSleep(driver, pollInterval);
  }

  logger.warn(`DOM稳定检测超时 (${timeout}ms)，降级继续`);
  return false;
}

async function waitForListItems(driver, listItemSelector, options = {}) {
  const { minCount = 1, timeout = DEFAULT_TIMEOUT, pollInterval = DEFAULT_POLL_INTERVAL } = options;

  logger.debug(`等待列表项加载`, { listItemSelector, minCount, timeout });

  try {
    if (isWebDriverIO(driver)) {
      await driver.waitUntil(
        async () => {
          const elements = await driver.$$(listItemSelector);
          return elements && elements.length >= minCount;
        },
        {
          timeout,
          interval: pollInterval,
          timeoutMsg: `Not enough list items (${minCount}) found by ${listItemSelector}`
        }
      );
      const elements = await driver.$$(listItemSelector);
      logger.debug(`列表项加载完成，数量: ${elements.length}`);
      return elements;
    } else {
      const condition = new Condition(
        `for at least ${minCount} elements located by ${listItemSelector}`,
        async (d) => {
          const elements = await d.findElements(By.css(listItemSelector));
          return elements.length >= minCount ? elements : null;
        }
      );

      const elements = await driver.wait(condition, timeout, undefined, pollInterval);
      logger.debug(`列表项加载完成，数量: ${elements.length}`);
      return elements;
    }
  } catch (error) {
    logger.warn(`等待列表项超时，返回已找到的元素: ${error.message}`);
    try {
      return await findElements(driver, listItemSelector);
    } catch (e) {
      return [];
    }
  }
}

export async function waitForSelector(driver, selector, options = {}) {
  const { timeout = DEFAULT_TIMEOUT, visible = true } = options;

  logger.debug(`等待选择器: ${selector}`);

  try {
    if (visible) {
      await waitForElementVisible(driver, selector, timeout);
    } else {
      await waitForElementLocated(driver, selector, timeout);
    }
    return true;
  } catch (error) {
    logger.warn(`等待选择器超时: ${selector}`, error.message);
    return false;
  }
}

export async function closePopups(driver, popupSelectors = null) {
  const selectors = popupSelectors || DEFAULT_POPUP_SELECTORS;
  let closedCount = 0;

  logger.debug('开始关闭弹窗...');

  try {
    await handleDialogs(driver);
  } catch (e) {
    // 忽略对话框处理错误
  }

  for (const selector of selectors) {
    try {
      const elements = await findElements(driver, selector);
      for (const element of elements) {
        try {
          const isDisplayed = await elementIsDisplayed(element);
          if (isDisplayed) {
            await elementClick(element);
            closedCount++;
            logger.debug(`关闭弹窗: ${selector}`);
            await driverSleep(driver, 200);
          }
        } catch (e) {
          // 忽略单个元素点击错误
        }
      }
    } catch (e) {
      // 忽略选择器查找错误
      continue;
    }
  }

  if (closedCount > 0) {
    logger.info(`共关闭 ${closedCount} 个弹窗`);
  }

  return closedCount;
}

async function handleDialogs(driver) {
  let handled = false;

  try {
    if (isWebDriverIO(driver)) {
      try {
        const alertText = await driver.getAlertText();
        logger.debug(`检测到弹窗: ${alertText}`);
        try {
          await driver.acceptAlert();
          handled = true;
        } catch (e) {
          try {
            await driver.dismissAlert();
            handled = true;
          } catch (e2) {
            // 忽略
          }
        }
      } catch (e) {
        // 没有alert弹窗
      }
    } else {
      const alert = await driver.switchTo().alert();
      const alertText = await alert.getText();
      logger.debug(`检测到弹窗: ${alertText}`);
      try {
        await alert.accept();
        handled = true;
      } catch (e) {
        try {
          await alert.dismiss();
          handled = true;
        } catch (e2) {
          // 忽略
        }
      }
    }
  } catch (e) {
    // 没有alert弹窗
  }

  return handled;
}

export async function scrollToBottom(driver) {
  try {
    await executeScript(driver, `
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: 'smooth'
      });
    `);
    logger.debug('滚动到页面底部');
    return true;
  } catch (error) {
    logger.warn(`滚动失败: ${error.message}`);
    return false;
  }
}

export async function scrollToElement(driver, element) {
  try {
    await executeScript(driver, 'arguments[0].scrollIntoView({ behavior: "smooth", block: "center" });', element);
    return true;
  } catch (error) {
    logger.warn(`滚动到元素失败: ${error.message}`);
    return false;
  }
}

export function hasNewContent(oldCount, newCount) {
  return newCount > oldCount;
}

export async function isOldItem(itemEl, lastCrawlTime, siteConfig) {
  if (!lastCrawlTime || !itemEl) {
    return false;
  }

  const dateSelector = siteConfig.selectors?.list?.dateSelector;
  if (!dateSelector) {
    return false;
  }

  try {
    const dateElement = await elementFindElement(itemEl, dateSelector);
    if (!dateElement) {
      return false;
    }

    const dateText = await elementGetText(dateElement);
    if (!dateText) {
      return false;
    }

    const itemTime = parseDateText(dateText);
    if (!itemTime || isNaN(itemTime.getTime())) {
      return false;
    }

    const lastCrawlDate = typeof lastCrawlTime === 'string'
      ? new Date(lastCrawlTime)
      : lastCrawlTime;

    const isOld = itemTime.getTime() <= lastCrawlDate.getTime();
    logger.debug(`标的时间比对: ${dateText} vs ${lastCrawlDate.toISOString()} -> ${isOld ? '旧' : '新'}`);

    return isOld;
  } catch (error) {
    logger.debug(`判断旧标的失败: ${error.message}`);
    return false;
  }
}

function parseDateText(dateText) {
  if (!dateText) return null;

  const cleaned = dateText.trim()
    .replace(/年|月/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, ' ');

  const patterns = [
    /(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2}:\d{2})/,
    /(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/,
    /(\d{4}-\d{1,2}-\d{1,2})/,
    /(\d{2}-\d{2}\s+\d{1,2}:\d{2})/,
    /(\d{1,2}月\d{1,2}日)/
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      let dateStr = match[1];

      if (/^\d{2}-\d{2}/.test(dateStr)) {
        const now = new Date();
        dateStr = `${now.getFullYear()}-${dateStr}`;
      }

      if (/^\d{1,2}月\d{1,2}日/.test(dateStr)) {
        const now = new Date();
        const monthMatch = dateStr.match(/(\d{1,2})月(\d{1,2})日/);
        if (monthMatch) {
          dateStr = `${now.getFullYear()}-${monthMatch[1]}-${monthMatch[2]}`;
        }
      }

      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return null;
}

export default {
  navigateToListPage,
  traverseListPage,
  waitForDynamicContent,
  waitForSelector,
  closePopups,
  scrollToBottom,
  scrollToElement,
  hasNewContent,
  isOldItem
};

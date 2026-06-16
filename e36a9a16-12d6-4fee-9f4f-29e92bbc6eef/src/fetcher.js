import axios from 'axios';
import browserPool from './launcher.js';
import { retryWithBackoff, ErrorTypes } from './retry.js';
import { createSiteLogger } from './logger.js';

class SiteFetcher {
  constructor(siteConfig, globalConfig = {}) {
    this.site = siteConfig;
    this.globalConfig = globalConfig;
    this.logger = createSiteLogger(siteConfig.id, siteConfig.name);
    this.cookies = [];
    this.isLoggedIn = false;
    this.lastLoginTime = 0;
    this.sessionExpireTime = 30 * 60 * 1000;
  }

  async fetchList() {
    const { type, listUrl, listSelector, timeout } = this.site;
    const actualTimeout = timeout || this.globalConfig.timeout || 15000;

    this.logger.info(`开始抓取列表页: ${listUrl}`);

    if (type === 'dynamic') {
      return await this.fetchDynamicPage(listUrl, listSelector?.container, actualTimeout);
    } else {
      return await this.fetchStaticPage(listUrl, actualTimeout);
    }
  }

  async fetchDetail(url) {
    const { type, detailSelector, timeout } = this.site;
    const actualTimeout = timeout || this.globalConfig.timeout || 15000;

    this.logger.debug(`抓取详情页: ${url}`);

    if (type === 'dynamic') {
      return await this.fetchDynamicPage(url, detailSelector?.title, actualTimeout);
    } else {
      return await this.fetchStaticPage(url, actualTimeout);
    }
  }

  async fetchStaticPage(url, timeout = 15000) {
    return await retryWithBackoff(
      async () => {
        if (this.site.needsLogin && !this.isLoggedIn) {
          await this.login();
        }

        const headers = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        };

        if (this.cookies.length > 0) {
          headers.Cookie = this.cookies.map(c => `${c.name}=${c.value}`).join('; ');
        }

        const response = await axios.get(url, {
          timeout,
          headers,
          maxRedirects: 5,
          validateStatus: (status) => {
            if (status === 403 || status === 401) {
              if (this.site.needsLogin) {
                this.isLoggedIn = false;
                const error = new Error(`登录已失效, HTTP ${status}`);
                error.type = 'login';
                throw error;
              }
            }
            return status >= 200 && status < 300;
          }
        });

        if (response.headers['set-cookie']) {
          this.updateCookies(response.headers['set-cookie']);
        }

        this.logger.debug(`静态页面抓取成功: ${url}, 状态码: ${response.status}`);
        return response.data;
      },
      {
        context: `static-fetch-${url}`,
        logger: this.logger,
        onRetry: async (error, errorType) => {
          if (errorType === ErrorTypes.LOGIN_EXPIRED && this.site.needsLogin) {
            this.logger.info('登录失效，尝试重新登录');
            await this.login();
          }
        }
      }
    );
  }

  async fetchDynamicPage(url, waitForSelector = null, timeout = 15000) {
    let pageInfo = null;

    try {
      return await retryWithBackoff(
        async () => {
          if (pageInfo) {
            await browserPool.releasePage(pageInfo);
            pageInfo = null;
          }

          if (this.site.needsLogin && !this.isLoggedIn) {
            await this.login();
          }

          pageInfo = await browserPool.acquirePage(this.site.id);
          const { page } = pageInfo;

          await page.setViewport({ width: 1920, height: 1080 });
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

          if (this.cookies.length > 0) {
            try {
              await page.setCookie(...this.cookies);
            } catch (e) {
              this.logger.warn(`设置Cookie失败: ${e.message}`);
            }
          }

          let response = null;
          const pageErrors = [];

          page.on('console', (msg) => {
            if (msg.type() === 'error') {
              pageErrors.push(msg.text());
            }
          });

          try {
            response = await page.goto(url, {
              waitUntil: 'networkidle2',
              timeout
            });
          } catch (e) {
            if (e.message.includes('timeout')) {
              const error = new Error(`页面加载超时: ${url}`);
              error.message = e.message;
              throw error;
            }
            throw e;
          }

          if (response) {
            const status = response.status();
            if (status === 403 || status === 401) {
              if (this.site.needsLogin) {
                this.isLoggedIn = false;
                const error = new Error(`登录已失效, HTTP ${status}`);
                error.type = 'login';
                throw error;
              }
            }
            if (status >= 500) {
              const error = new Error(`服务器错误, HTTP ${status}`);
              error.status = status;
              throw error;
            }
          }

          if (waitForSelector) {
            try {
              await page.waitForSelector(waitForSelector, { timeout: timeout * 0.8 });
            } catch (e) {
              this.logger.warn(`等待选择器超时: ${waitForSelector}`);
            }
          }

          const currentUrl = page.url();
          if (this.site.loginConfig && currentUrl.includes('login')) {
            this.isLoggedIn = false;
            const error = new Error('被重定向到登录页，登录已失效');
            error.type = 'login';
            throw error;
          }

          const cookies = await page.cookies();
          if (cookies && cookies.length > 0) {
            this.cookies = cookies;
          }

          const content = await page.content();
          this.logger.debug(`动态页面抓取成功: ${url}`);

          await browserPool.releasePage(pageInfo);
          pageInfo = null;

          return content;
        },
        {
          context: `dynamic-fetch-${url}`,
          logger: this.logger,
          onRetry: async (error, errorType) => {
            if (errorType === ErrorTypes.LOGIN_EXPIRED && this.site.needsLogin) {
              this.logger.info('登录失效，尝试重新登录');
              await this.login();
            }
            if (errorType === ErrorTypes.CAPTCHA_BLOCK) {
              this.logger.warn('遇到验证码拦截，等待更长时间后重试');
            }
          }
        }
      );
    } finally {
      if (pageInfo) {
        try {
          await browserPool.releasePage(pageInfo);
        } catch (e) {
          this.logger.warn(`释放页面失败: ${e.message}`);
        }
      }
    }
  }

  async login() {
    if (!this.site.needsLogin || !this.site.loginConfig) {
      this.logger.info('站点无需登录');
      return;
    }

    this.logger.info('执行登录操作');
    const { loginUrl, usernameSelector, passwordSelector, submitSelector, username, password, checkSelector, captchaSelector } = this.site.loginConfig;

    let pageInfo = null;

    try {
      pageInfo = await browserPool.acquirePage(this.site.id);
      const { page } = pageInfo;

      await page.goto(loginUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      if (this.site.hasCaptcha && captchaSelector) {
        this.logger.warn('站点需要验证码，登录可能失败');
      }

      await page.waitForSelector(usernameSelector, { timeout: 10000 });
      await page.type(usernameSelector, username, { delay: 100 });
      await page.waitForTimeout(500);

      await page.waitForSelector(passwordSelector, { timeout: 5000 });
      await page.type(passwordSelector, password, { delay: 100 });
      await page.waitForTimeout(500);

      await page.click(submitSelector);
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

      if (checkSelector) {
        try {
          await page.waitForSelector(checkSelector, { timeout: 5000 });
          this.isLoggedIn = true;
          this.lastLoginTime = Date.now();
          this.cookies = await page.cookies();
          this.logger.info('登录成功');
        } catch (e) {
          this.logger.error(`登录失败，未找到登录成功标识: ${checkSelector}`);
          throw new Error('登录失败，未找到登录成功标识');
        }
      } else {
        const currentUrl = page.url();
        if (currentUrl.includes('login')) {
          throw new Error('登录失败，仍在登录页面');
        }
        this.isLoggedIn = true;
        this.lastLoginTime = Date.now();
        this.cookies = await page.cookies();
        this.logger.info('登录成功');
      }
    } catch (error) {
      this.logger.error(`登录失败: ${error.message}`);
      this.isLoggedIn = false;
      throw error;
    } finally {
      if (pageInfo) {
        try {
          await browserPool.releasePage(pageInfo);
        } catch (e) {
          this.logger.warn(`释放页面失败: ${e.message}`);
        }
      }
    }
  }

  updateCookies(setCookieHeaders) {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return;

    for (const cookieStr of setCookieHeaders) {
      const parts = cookieStr.split(';');
      const [nameValue, ...attrs] = parts;
      const [name, ...valueParts] = nameValue.split('=');
      const value = valueParts.join('=');

      const cookie = {
        name: name.trim(),
        value: value.trim()
      };

      for (const attr of attrs) {
        const [attrName, attrValue] = attr.trim().split('=');
        if (attrName.toLowerCase() === 'path') {
          cookie.path = attrValue || '/';
        } else if (attrName.toLowerCase() === 'domain') {
          cookie.domain = attrValue;
        } else if (attrName.toLowerCase() === 'expires') {
          cookie.expires = new Date(attrValue).getTime() / 1000;
        }
      }

      const existingIndex = this.cookies.findIndex(c => c.name === cookie.name);
      if (existingIndex >= 0) {
        this.cookies[existingIndex] = { ...this.cookies[existingIndex], ...cookie };
      } else {
        this.cookies.push(cookie);
      }
    }
  }

  checkSessionValid() {
    if (!this.site.needsLogin) return true;
    if (!this.isLoggedIn) return false;
    if (Date.now() - this.lastLoginTime > this.sessionExpireTime) {
      this.isLoggedIn = false;
      return false;
    }
    return true;
  }

  getCookies() {
    return [...this.cookies];
  }

  setCookies(cookies) {
    this.cookies = [...cookies];
    if (cookies.length > 0) {
      this.isLoggedIn = true;
      this.lastLoginTime = Date.now();
    }
  }
}

export default SiteFetcher;

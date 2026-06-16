import axios from 'axios';
import dayjs from 'dayjs';
import { retryWithBackoff } from './retry.js';
import logger from './logger.js';

class WechatNotifier {
  constructor(webhookUrl, options = {}) {
    this.webhookUrl = webhookUrl;
    this.retryCount = options.retryCount || 3;
    this.enabled = !!webhookUrl;
  }

  setWebhookUrl(url) {
    this.webhookUrl = url;
    this.enabled = !!url;
  }

  async sendDailyBriefing(matchResult, date = new Date()) {
    if (!this.enabled) {
      logger.warn('企业微信推送未启用（未配置webhookUrl）');
      return false;
    }

    const dateStr = dayjs(date).format('YYYY年MM月DD日');
    const { matched, matchedItems, total } = matchResult;

    let content = `## 📋 政府采购公告每日简报 - ${dateStr}\n\n`;
    content += `> 📊 今日共抓取 **${total}** 条公告，匹配 **${matched}** 条关注项目\n\n`;

    if (matchedItems.length === 0) {
      content += '暂无匹配的招标公告。\n';
    } else {
      const byCategory = this.groupByCategory(matchedItems);
      const bySite = this.groupBySite(matchedItems);

      content += `### 🏷️ 按业务分类\n\n`;
      for (const [category, items] of Object.entries(byCategory)) {
        content += `**${category}** (${items.length}条)\n`;
      }
      content += '\n';

      content += `### 📍 按站点分类\n\n`;
      for (const [site, items] of Object.entries(bySite)) {
        content += `**${site}** (${items.length}条)\n`;
      }
      content += '\n';

      content += `### 📝 项目详情\n\n`;
      for (let i = 0; i < Math.min(matchedItems.length, 20); i++) {
        const item = matchedItems[i];
        content += this.formatAnnouncementItem(item, i + 1);
      }

      if (matchedItems.length > 20) {
        content += `\n> 还有 ${matchedItems.length - 20} 条项目未显示，详见完整列表\n`;
      }
    }

    const changeItems = matchedItems.filter(item => item.hasChange || item.isChange || item.isClarification);
    if (changeItems.length > 0) {
      content += `\n### ⚠️ 变更与补遗提醒 (${changeItems.length}条)\n\n`;
      for (const item of changeItems) {
        content += this.formatChangeItem(item);
      }
    }

    content += `\n---\n`;
    content += `*生成时间: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}*\n`;

    return await this.sendMarkdown(content, `每日招标简报 - ${dateStr}`);
  }

  async sendChangeAlert(announcement, type = 'change') {
    if (!this.enabled) {
      logger.warn('企业微信推送未启用');
      return false;
    }

    const typeLabel = type === 'clarification' ? '答疑补遗' : '变更公告';
    const typeEmoji = type === 'clarification' ? '❓' : '🔄';

    let content = `${typeEmoji} **【${typeLabel}预警】**\n\n`;
    content += `**项目名称**: ${announcement.title || '未知'}\n`;

    if (announcement.projectNo) {
      content += `**项目编号**: ${announcement.projectNo}\n`;
    }
    if (announcement.budget?.display) {
      content += `**预算金额**: ${announcement.budget.display}\n`;
    }
    if (announcement.bidDeadline) {
      content += `**投标截止**: ${dayjs(announcement.bidDeadline).format('YYYY-MM-DD HH:mm')}\n`;
    }

    content += `**来源站点**: ${announcement.siteName || '未知'}\n`;

    if (announcement.link) {
      content += `\n[查看详情](${announcement.link})\n`;
    }

    content += `\n*请及时关注变更内容，防止废标风险*`;

    return await this.sendMarkdown(content, `${typeLabel}预警 - ${announcement.title || '未知项目'}`);
  }

  async sendMarkdown(content, title = '通知') {
    if (!this.enabled) {
      return false;
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await axios.post(
            this.webhookUrl,
            {
              msgtype: 'markdown',
              markdown: {
                content
              }
            },
            {
              timeout: 10000,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data?.errcode === 0) {
            logger.info(`企业微信推送成功: ${title}`);
            return true;
          } else {
            throw new Error(`企业微信推送失败: ${response.data?.errmsg || '未知错误'}`);
          }
        },
        {
          context: `wechat-notify-${title}`,
          logger
        }
      );
    } catch (error) {
      logger.error(`企业微信推送最终失败: ${title}, 错误: ${error.message}`);
      return false;
    }
  }

  async sendText(content, mentionedList = []) {
    if (!this.enabled) {
      return false;
    }

    try {
      return await retryWithBackoff(
        async () => {
          const response = await axios.post(
            this.webhookUrl,
            {
              msgtype: 'text',
              text: {
                content,
                mentioned_list: mentionedList
              }
            },
            {
              timeout: 10000
            }
          );

          if (response.data?.errcode === 0) {
            logger.info('企业微信文本消息推送成功');
            return true;
          } else {
            throw new Error(`企业微信推送失败: ${response.data?.errmsg || '未知错误'}`);
          }
        },
        {
          context: 'wechat-text-notify',
          logger
        }
      );
    } catch (error) {
      logger.error(`企业微信文本推送最终失败: ${error.message}`);
      return false;
    }
  }

  formatAnnouncementItem(item, index) {
    let line = `**${index}. ${item.title || '无标题'}**\n`;

    if (item.budget?.display) {
      line += `   💰 ${item.budget.display}`;
    }
    if (item.bidDeadline) {
      line += ` | ⏰ 截止: ${dayjs(item.bidDeadline).format('MM-DD HH:mm')}`;
    }
    line += '\n';

    if (item.matchInfo?.matchedCategories?.length > 0) {
      const categories = item.matchInfo.matchedCategories.slice(0, 3).map(c => c.name).join('、');
      line += `   🏷️ ${categories}`;
    }
    if (item.matchInfo?.score) {
      line += ` | ⭐ ${item.matchInfo.score.toFixed(1)}分`;
    }
    line += '\n';

    if (item.hasChange || item.isChange || item.isClarification) {
      line += `   ⚠️ 有变更/补遗`;
      line += '\n';
    }

    if (item.link) {
      line += `   [查看详情](${item.link})\n`;
    }

    line += '\n';
    return line;
  }

  formatChangeItem(item) {
    let typeLabel = '变更';
    if (item.isClarification) {
      typeLabel = '答疑补遗';
    }

    let line = `- **${item.title || '无标题'}**\n`;
    line += `  类型: ${typeLabel} | 站点: ${item.siteName || '未知'}\n`;

    if (item.link) {
      line += `  [查看详情](${item.link})\n`;
    }

    line += '\n';
    return line;
  }

  groupByCategory(items) {
    const groups = {};

    for (const item of items) {
      const categories = item.matchInfo?.matchedCategories || [];
      const primaryCategory = categories.length > 0 ? categories[0].name : '其他';

      if (!groups[primaryCategory]) {
        groups[primaryCategory] = [];
      }
      groups[primaryCategory].push(item);
    }

    return groups;
  }

  groupBySite(items) {
    const groups = {};

    for (const item of items) {
      const siteName = item.siteName || '未知站点';
      if (!groups[siteName]) {
        groups[siteName] = [];
      }
      groups[siteName].push(item);
    }

    return groups;
  }
}

export default WechatNotifier;

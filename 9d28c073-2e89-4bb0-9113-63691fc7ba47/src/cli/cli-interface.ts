import readline from 'readline';
import chalk from 'chalk';
import { SingleBar, Presets } from 'cli-progress';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import siteRegistry from '../crawler/site-registry';
import { CrawlScheduler } from '../crawler/crawl-scheduler';
import { SiteStatus, CaptchaManualIntervention } from '../types';
import { formatDate, truncate } from '../utils/helpers';
import repository from '../storage/repository';

const STATUS_ICONS: Record<SiteStatus, string> = {
  idle: '⬜',
  running: '🔄',
  success: '✅',
  captcha: '🟡',
  failed: '❌',
  pending: '⏳'
};

const STATUS_COLORS: Record<SiteStatus, (text: string) => string> = {
  idle: chalk.gray,
  running: chalk.blue,
  success: chalk.green,
  captcha: chalk.yellow,
  failed: chalk.red,
  pending: chalk.yellow
};

export class CliInterface extends EventEmitter {
  private scheduler: CrawlScheduler;
  private rl: readline.Interface;
  private progressBar: SingleBar | null = null;
  private recentChanges: Array<{ title: string; level: string; site: string; time: string }> = [];
  private lastRenderTime: number = 0;
  private renderThrottle: number = 200;
  private isActive: boolean = false;
  private isAwaitingCaptchaInput: boolean = false;
  private pendingCaptchaInterventions: Map<string, CaptchaManualIntervention> = new Map();

  constructor(scheduler: CrawlScheduler) {
    super();
    this.scheduler = scheduler;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    this.setupKeyboardHandlers();
    this.setupSchedulerListeners();
  }

  private setupKeyboardHandlers(): void {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key: string) => {
      if (!this.isActive) return;
      if (this.isAwaitingCaptchaInput) return;

      const byte = key.toString();

      if (byte === ' ' || byte === '\x20') {
        this.togglePause();
      } else if (byte === 'r' || byte === 'R') {
        this.retryFailed();
      } else if (byte === 'c' || byte === 'C') {
        this.promptCaptchaResolution();
      } else if (byte === 'q' || byte === 'Q' || byte === '\x03') {
        this.quit();
      }
    });
  }

  private setupSchedulerListeners(): void {
    this.scheduler.on('sessionStart', () => {
      this.startProgressBar();
    });

    this.scheduler.on('sessionEnd', () => {
      this.stopProgressBar();
      this.render();
    });

    this.scheduler.on('progress', () => {
      this.updateProgressBar();
      this.throttledRender();
    });

    this.scheduler.on('siteStart', () => {
      this.updateProgressBar();
      this.throttledRender();
    });

    this.scheduler.on('siteComplete', () => {
      this.updateProgressBar();
      this.throttledRender();
    });

    this.scheduler.on('changeDetected', (change: any) => {
      this.recentChanges.unshift({
        title: change.policyTitle,
        level: change.changeLevel,
        site: change.siteId,
        time: formatDate(new Date(change.detectedAt), 'HH:mm:ss')
      });
      if (this.recentChanges.length > 10) {
        this.recentChanges.pop();
      }
      this.throttledRender();
    });

    this.scheduler.on('paused', () => {
      this.throttledRender();
    });

    this.scheduler.on('resumed', () => {
      this.throttledRender();
    });

    this.scheduler.on('captchaManualIntervention', (intervention: CaptchaManualIntervention) => {
      this.pendingCaptchaInterventions.set(intervention.siteId, intervention);
      this.handleCaptchaPrompt(intervention);
    });

    this.scheduler.on('captchaResolved', (siteId: string) => {
      this.pendingCaptchaInterventions.delete(siteId);
      console.log(chalk.green(`\n  ✅ 站点 ${siteId} 验证码已解决，爬取流程已恢复`));
      this.throttledRender();
    });
  }

  start(): void {
    this.isActive = true;
    this.showWelcome();
    this.render();
  }

  private showWelcome(): void {
    console.clear();
    console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║     社保公积金政策自动化监控系统 v1.0           ║'));
    console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════╝\n'));
    console.log(chalk.gray(`监控站点: ${siteRegistry.getSiteCount()} 个 | 覆盖省份: ${siteRegistry.getProvinces().length} 个`));
    console.log(chalk.gray('定时任务: 工作日 08:00 / 12:00 / 17:00\n'));
    console.log(chalk.yellow('快捷键: 空格=暂停/恢复  r=重试失败站点  c=处理验证码  q=退出\n'));
  }

  private throttledRender(): void {
    const now = Date.now();
    if (now - this.lastRenderTime < this.renderThrottle) return;
    this.lastRenderTime = now;
    this.render();
  }

  render(): void {
    if (!this.isActive) return;

    const session = this.scheduler.getCurrentSession();
    const provinces = siteRegistry.getProvinces();
    const allSites = siteRegistry.getAllSites();

    const leftPanelLines: string[] = [];
    const rightPanelLines: string[] = [];

    leftPanelLines.push(chalk.bold('📍 站点状态'));
    leftPanelLines.push(chalk.gray('─'.repeat(35)));

    let lineCount = 0;
    const maxLines = 25;

    for (const province of provinces) {
      if (lineCount >= maxLines) break;

      const provinceSites = allSites.filter(s => s.province === province);
      leftPanelLines.push(chalk.bold.white(`\n  ${province} (${provinceSites.length})`));
      lineCount++;

      for (const site of provinceSites) {
        if (lineCount >= maxLines) break;

        const status = session?.siteStatuses.get(site.id)?.status || 'idle';
        const icon = STATUS_ICONS[status];
        const statusColor = STATUS_COLORS[status];
        const siteName = truncate(site.name, 18);

        leftPanelLines.push(`    ${icon} ${statusColor(siteName)}`);
        lineCount++;
      }
    }

    rightPanelLines.push(chalk.bold('📋 最新变更'));
    rightPanelLines.push(chalk.gray('─'.repeat(45)));

    if (this.recentChanges.length === 0) {
      rightPanelLines.push(chalk.gray('\n  暂无变更记录'));
    } else {
      for (const change of this.recentChanges) {
        const levelColor = change.level === 'high' ? chalk.red :
                          change.level === 'medium' ? chalk.yellow : chalk.green;
        const levelText = change.level === 'high' ? '高' : change.level === 'medium' ? '中' : '低';
        const title = truncate(change.title, 30);

        rightPanelLines.push(
          `  ${levelColor(`[${levelText}]`)} ${chalk.white(title)}`
        );
        rightPanelLines.push(
          chalk.gray(`    ${change.site} · ${change.time}`)
        );
      }
    }

    const totalLines = Math.max(leftPanelLines.length, rightPanelLines.length);

    readline.cursorTo(process.stdout, 0, 6);
    readline.clearScreenDown(process.stdout);

    for (let i = 0; i < totalLines; i++) {
      const left = leftPanelLines[i] || '';
      const right = rightPanelLines[i] || '';
      const paddedLeft = left.padEnd(38);
      console.log(`${paddedLeft}  │  ${right}`);
    }

    console.log('\n');
    this.renderStatusBar();
  }

  private renderStatusBar(): void {
    const session = this.scheduler.getCurrentSession();

    if (session && session.status === 'running') {
      const elapsed = Math.floor((Date.now() - session.startTime.getTime()) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;

      console.log(chalk.cyan(`  运行时间: ${mins}分${secs}秒`));
      console.log(chalk.green(`  成功: ${session.successCount}`) +
                  chalk.yellow(`  验证码: ${session.captchaCount}`) +
                  chalk.red(`  失败: ${session.failedCount}`) +
                  chalk.white(`  新变更: ${session.newChanges}`));
    } else if (session?.status === 'paused') {
      const pendingCaptcha = this.scheduler.getPendingCaptchaSites();
      if (pendingCaptcha.length > 0) {
        console.log(chalk.yellow.bold(`\n  ⏸️  已暂停 - 等待验证码处理 (${pendingCaptcha.length} 个站点)`));
        console.log(chalk.yellow('  按 c 键输入验证码并恢复爬取'));
      } else {
        console.log(chalk.yellow.bold('\n  ⏸️  已暂停 - 按空格键继续'));
      }
    } else if (session?.status === 'completed') {
      console.log(chalk.green.bold('\n  ✅ 本次巡检完成'));
      const elapsed = session.endTime
        ? Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000)
        : 0;
      console.log(chalk.gray(`  耗时: ${Math.floor(elapsed / 60)}分${elapsed % 60}秒`));
    } else if (session?.status === 'timeout') {
      console.log(chalk.red.bold('\n  ⏰ 巡检超时'));
    }

    console.log('');
  }

  private startProgressBar(): void {
    const session = this.scheduler.getCurrentSession();
    if (!session) return;

    this.progressBar = new SingleBar({
      format: '  巡检进度 |' + chalk.cyan('{bar}') + '| {percentage}% ({value}/{total} 站点)',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
      clearOnComplete: false
    }, Presets.shades_classic);

    this.progressBar.start(session.totalSites, 0);
  }

  private updateProgressBar(): void {
    const session = this.scheduler.getCurrentSession();
    if (!session || !this.progressBar) return;

    this.progressBar.update(session.completedSites);
  }

  private stopProgressBar(): void {
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = null;
    }
  }

  private togglePause(): void {
    if (this.scheduler.isPausedStatus()) {
      this.scheduler.resume();
    } else {
      this.scheduler.pause();
    }
  }

  private async retryFailed(): Promise<void> {
    console.log(chalk.yellow('\n  🔄 正在重试失败站点...'));
    const count = await this.scheduler.retryFailedSites();
    console.log(chalk.green(`  已重试 ${count} 个站点`));
    this.render();
  }

  private handleCaptchaPrompt(intervention: CaptchaManualIntervention): void {
    if (this.isAwaitingCaptchaInput) {
      logger.info(`Captcha prompt already active, queuing site ${intervention.siteId}`);
      return;
    }

    this.promptCaptchaInput(intervention);
  }

  private promptCaptchaResolution(): void {
    const pending = this.scheduler.getPendingCaptchaSites();

    if (pending.length === 0) {
      console.log(chalk.gray('\n  当前无待处理验证码'));
      this.render();
      return;
    }

    if (this.isAwaitingCaptchaInput) {
      console.log(chalk.gray('\n  正在等待验证码输入，请先完成当前输入'));
      return;
    }

    console.log(chalk.yellow('\n  📋 待处理验证码站点:'));
    pending.forEach((siteId, i) => {
      const intervention = this.pendingCaptchaInterventions.get(siteId);
      const siteName = intervention ? siteId : siteId;
      console.log(chalk.yellow(`    ${i + 1}. ${siteName}`));
    });

    this.rl.question(chalk.cyan('\n  请输入要处理的站点编号（或按回车处理第一个）: '), (answer: string) => {
      const trimmed = answer.trim();
      let targetSiteId: string | undefined;

      if (!trimmed) {
        targetSiteId = pending[0];
      } else {
        const idx = parseInt(trimmed, 10) - 1;
        if (idx >= 0 && idx < pending.length) {
          targetSiteId = pending[idx];
        }
      }

      if (!targetSiteId) {
        console.log(chalk.red('  无效的选择'));
        this.render();
        return;
      }

      const intervention = this.pendingCaptchaInterventions.get(targetSiteId);
      if (intervention) {
        this.promptCaptchaInput(intervention);
      } else {
        this.promptCaptchaInput({
          siteId: targetSiteId,
          url: '',
          captchaType: 'graphic',
          screenshotPath: '',
          detectedAt: new Date().toISOString(),
          resolved: false
        });
      }
    });
  }

  private promptCaptchaInput(intervention: CaptchaManualIntervention): void {
    this.isAwaitingCaptchaInput = true;

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }

    console.log(chalk.yellow.bold('\n\n  ⚠️  检测到图形验证码，爬取流程已暂停！'));
    console.log(chalk.yellow(`  站点 ID: ${intervention.siteId}`));
    console.log(chalk.yellow(`  URL: ${intervention.url}`));
    console.log(chalk.gray(`  类型: ${intervention.captchaType}`));
    if (intervention.screenshotPath) {
      console.log(chalk.gray(`  截图路径: ${intervention.screenshotPath}`));
    }
    console.log(chalk.cyan('  请人工查看验证码并输入结果，或直接按回车确认已手动解决'));

    this.rl.question(chalk.cyan('\n  请输入验证码（或直接回车确认已解决）: '), (answer: string) => {
      const captchaValue = answer.trim();

      if (captchaValue) {
        console.log(chalk.green(`  ✅ 已记录验证码: ${captchaValue}`));
        logger.info(`Captcha input received for site ${intervention.siteId}: ${captchaValue}`);
      } else {
        console.log(chalk.green('  ✅ 已确认验证码手动解决'));
        logger.info(`Captcha manually resolved for site ${intervention.siteId}`);
      }

      this.scheduler.resolveCaptcha(intervention.siteId, captchaValue);

      this.isAwaitingCaptchaInput = false;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const remaining = this.scheduler.getPendingCaptchaSites();
      if (remaining.length > 0) {
        console.log(chalk.yellow(`\n  还有 ${remaining.length} 个站点等待验证码处理，按 c 键继续`));
      }

      this.render();
    });
  }

  async quit(): Promise<void> {
    console.log(chalk.yellow('\n  正在退出...'));
    this.isActive = false;
    this.isAwaitingCaptchaInput = false;
    this.stopProgressBar();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    this.scheduler.destroy();
    this.rl.close();
    repository.close();
    logger.info('Application exited via CLI');
    process.exit(0);
  }

  async startCrawl(): Promise<void> {
    console.log(chalk.cyan('\n  🚀 启动巡检...\n'));
    await this.scheduler.startCrawl();
  }
}

export default CliInterface;

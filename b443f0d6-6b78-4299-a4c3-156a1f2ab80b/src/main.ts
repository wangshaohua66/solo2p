import * as dotenv from 'dotenv';
import { Command } from 'commander';
import Table = require('cli-table3');
import ora = require('ora');
import * as chalk from 'chalk';
import {
  QuoteRequest,
  ProductType,
  RiskLevel,
  CustomerInfo,
  QuoteResult,
  CompareResult,
  RenewalRecord,
  PolicyInfo,
  TaskStatus,
} from './utils/types';
import logger from './utils/logger';
import { insuranceCompanies, getAllCompanyIds, PRODUCT_TYPES, RISK_LEVELS } from './config/profiles';
import TaskRunner from './scheduler/task-runner';
import QuoteComparator from './engine/comparator';
import RenewalTracker from './engine/renewal-tracker';
import ExcelWriter from './report/excel-writer';
import BrowserManager from './core/browser-manager';
import SessionGuard from './core/session-guard';

dotenv.config();

const program = new Command();

program
  .name('insurance-broker')
  .description('多保险公司核保系统自动化抓取与比价工具')
  .version('1.0.0');

program
  .command('quote')
  .description('执行多保险公司报价比价')
  .option('-i, --industry <industry>', '行业类别', '制造业')
  .option('-e, --employees <number>', '员工人数', '100')
  .option('-r, --risk <level>', '风险等级 (low/medium/high/very-high)', 'medium')
  .option('-c, --coverage <amount>', '保额(元)', '1000000')
  .option('-d, --deductible <amount>', '免赔额(元)', '100')
  .option('-p, --product <type>', '产品类型 (employer-liability/group-accident/group-medical/group-critical-illness)', 'employer-liability')
  .option('-n, --customer-name <name>', '客户名称')
  .option('-o, --output', '生成Excel报告', false)
  .option('--companies <list>', '指定保险公司ID列表，逗号分隔')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n=== 保险报价比价 ===\n'));

    const request: QuoteRequest = {
      companyId: '',
      productType: options.product as ProductType,
      industry: options.industry,
      employeeCount: parseInt(options.employees, 10),
      riskLevel: options.risk as RiskLevel,
      coverageAmount: parseInt(options.coverage, 10),
      deductible: parseInt(options.deductible, 10),
    };

    const customer: CustomerInfo | undefined = options.customerName
      ? {
          id: 'temp-customer',
          name: options.customerName,
          industry: options.industry,
          employeeCount: parseInt(options.employees, 10),
          riskLevel: options.risk as RiskLevel,
          contactPerson: '',
          contactPhone: '',
        }
      : undefined;

    const companyIds = options.companies
      ? options.companies.split(',').map((s: string) => s.trim())
      : getAllCompanyIds();

    console.log(chalk.cyan('报价参数:'));
    console.log(`  行业: ${options.industry}`);
    console.log(`  员工人数: ${options.employees}`);
    console.log(`  风险等级: ${RISK_LEVELS[options.risk as RiskLevel] || options.risk}`);
    console.log(`  保额: ¥${parseInt(options.coverage, 10).toLocaleString()}`);
    console.log(`  免赔额: ¥${parseInt(options.deductible, 10).toLocaleString()}`);
    console.log(`  产品类型: ${PRODUCT_TYPES[options.product as ProductType] || options.product}`);
    console.log(`  参与保险公司: ${companyIds.length}家\n`);

    const spinner = ora('正在初始化抓取任务...').start();
    const taskRunner = TaskRunner.getInstance();

    try {
      spinner.text = '正在并行抓取各保险公司报价...';

      const compareResult = await taskRunner.runBatchQuote(request, customer, companyIds);

      spinner.succeed('报价抓取完成！');

      printQuoteResults(compareResult);

      if (options.output) {
        spinner.start('正在生成Excel报告...');
        const excelWriter = new ExcelWriter();
        const filePath = excelWriter.generateQuoteReport(compareResult, customer);
        spinner.succeed(`报告已生成: ${chalk.green(filePath)}`);
      }

      console.log(chalk.cyan('\n提示: 使用 --output 参数可生成完整Excel报告\n'));
    } catch (error) {
      spinner.fail('报价抓取失败');
      logger.error('报价任务执行失败', { error: (error as Error).message });
      console.error(chalk.red(`错误: ${(error as Error).message}`));
    } finally {
      await cleanup();
    }
  });

program
  .command('renewal')
  .description('续保到期监控与费率变动追踪')
  .option('--all', '检查所有客户续保情况', false)
  .option('--customer-id <id>', '指定客户ID')
  .option('--urgent', '只显示紧急续保', false)
  .option('--warning', '只显示预警续保', false)
  .option('--abnormal', '只显示费率异常', false)
  .option('-o, --output', '生成Excel报告', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n=== 续保监控 ===\n'));

    const tracker = RenewalTracker.getInstance();
    const spinner = ora('正在加载续保数据...').start();

    try {
      const mockCustomers: CustomerInfo[] = generateMockCustomers(10);
      const mockPolicies = generateMockPolicies(mockCustomers);

      spinner.text = '正在检查续保到期情况...';
      const records = await tracker.checkAllRenewals(mockCustomers, mockPolicies);

      spinner.succeed('续保检查完成！');

      let displayRecords = records;

      if (options.urgent) {
        displayRecords = tracker.getUrgentRecords();
        console.log(chalk.yellow(`\n紧急续保 (${displayRecords.length}条):`));
      } else if (options.warning) {
        displayRecords = tracker.getWarningRecords();
        console.log(chalk.yellow(`\n预警续保 (${displayRecords.length}条):`));
      } else if (options.abnormal) {
        displayRecords = tracker.getAbnormalRecords();
        console.log(chalk.red(`\n费率异常 (${displayRecords.length}条):`));
      } else {
        const stats = tracker.getStatistics();
        console.log(chalk.cyan('\n续保统计:'));
        console.log(`  总保单数: ${stats.total}`);
        console.log(`  正常: ${chalk.green(stats.normal.toString())}`);
        console.log(`  预警: ${chalk.yellow(stats.warning.toString())}`);
        console.log(`  紧急: ${chalk.red(stats.urgent.toString())}`);
        console.log(`  费率异常: ${chalk.magenta(stats.abnormal.toString())}`);
        console.log(`  已过期: ${chalk.gray(stats.expired.toString())}`);
      }

      printRenewalRecords(displayRecords.slice(0, 20));

      if (displayRecords.length > 20) {
        console.log(chalk.gray(`\n... 还有 ${displayRecords.length - 20} 条记录，使用 --output 查看完整报告`));
      }

      if (options.output) {
        spinner.start('正在生成Excel报告...');
        const excelWriter = new ExcelWriter();
        const filePath = excelWriter.generateRenewalReport(records, mockCustomers);
        spinner.succeed(`报告已生成: ${chalk.green(filePath)}`);
      }
    } catch (error) {
      spinner.fail('续保检查失败');
      logger.error('续保检查失败', { error: (error as Error).message });
      console.error(chalk.red(`错误: ${(error as Error).message}`));
    } finally {
      await cleanup();
    }
  });

program
  .command('report')
  .description('生成各类报告')
  .option('-t, --type <type>', '报告类型 (quote/renewal/policy)', 'quote')
  .option('-f, --format <format>', '输出格式 (excel)', 'excel')
  .action(async (options) => {
    console.log(chalk.blue.bold('\n=== 生成报告 ===\n'));

    const excelWriter = new ExcelWriter();

    try {
      if (options.type === 'quote') {
        const mockRequest: QuoteRequest = {
          companyId: '',
          productType: 'employer-liability',
          industry: '制造业',
          employeeCount: 100,
          riskLevel: 'medium',
          coverageAmount: 1000000,
          deductible: 100,
        };

        const mockQuotes: QuoteResult[] = insuranceCompanies.map((company, index) => ({
          companyId: company.id,
          companyName: company.name,
          productType: 'employer-liability',
          premium: 50000 + index * 5000 + Math.random() * 3000,
          coverageAmount: 1000000,
          deductible: 100,
          coverageDetails: `保障内容示例 - ${company.shortName}`,
          specialClauses: ['扩展保障条款', '意外医疗保障', '住院津贴'],
          scrapedAt: new Date(),
          success: true,
        }));

        const comparator = new QuoteComparator('medium');
        const result = comparator.compare(mockQuotes, mockRequest);

        const filePath = excelWriter.generateQuoteReport(result);
        console.log(chalk.green(`报价报告已生成: ${filePath}`));
      } else if (options.type === 'renewal') {
        const mockCustomers = generateMockCustomers(10);
        const mockRecords: RenewalRecord[] = [];

        mockCustomers.forEach(customer => {
          for (let i = 0; i < 2; i++) {
            const daysToExpire = Math.floor(Math.random() * 60) - 10;
            mockRecords.push({
              customerId: customer.id,
              customerName: customer.name,
              policyNumber: `POL${Date.now()}${i}`,
              companyId: insuranceCompanies[i % insuranceCompanies.length].id,
              companyName: insuranceCompanies[i % insuranceCompanies.length].name,
              currentPremium: 30000 + Math.random() * 20000,
              renewalPremium: 30000 + Math.random() * 25000,
              rateChange: (Math.random() - 0.3) * 30,
              expireDate: new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000),
              daysToExpire,
              status: daysToExpire < 0 ? 'expired' : daysToExpire < 7 ? 'urgent' : daysToExpire < 30 ? 'warning' : 'normal',
            });
          }
        });

        const filePath = excelWriter.generateRenewalReport(mockRecords, mockCustomers);
        console.log(chalk.green(`续保报告已生成: ${filePath}`));
      } else if (options.type === 'policy') {
        const mockPolicies: PolicyInfo[] = insuranceCompanies.map((company, index) => ({
          companyId: company.id,
          companyName: company.name,
          policyNumber: `POL${Date.now()}${index}`,
          insuredCompany: `示例企业${index + 1}`,
          productType: 'employer-liability' as any,
          coverageAmount: 1000000,
          premium: 50000 + index * 5000,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2025-01-01'),
          status: 'active',
        }));

        const filePath = excelWriter.generatePolicyReport(mockPolicies);
        console.log(chalk.green(`保单报告已生成: ${filePath}`));
      }

      console.log(chalk.cyan(`\n报告输出目录: ${excelWriter.getOutputDir()}`));
    } catch (error) {
      logger.error('生成报告失败', { error: (error as Error).message });
      console.error(chalk.red(`错误: ${(error as Error).message}`));
    }
  });

program
  .command('status')
  .description('查看任务状态与系统信息')
  .option('-a, --all', '显示所有任务', false)
  .action(async (options) => {
    console.log(chalk.blue.bold('\n=== 系统状态 ===\n'));

    const browserManager = BrowserManager.getInstance();
    const taskRunner = TaskRunner.getInstance();

    console.log(chalk.cyan('浏览器实例:'));
    console.log(`  总数: ${browserManager.getInstanceCount()}`);
    console.log(`  繁忙: ${browserManager.getBusyCount()}`);
    console.log(`  空闲: ${browserManager.getInstanceCount() - browserManager.getBusyCount()}`);
    console.log(`  最大实例数: ${parseInt(process.env.MAX_BROWSER_INSTANCES || '4', 10)}\n`);

    console.log(chalk.cyan('任务队列:'));
    const queueStats = taskRunner.getQueueStats();
    console.log(`  并发数: ${queueStats.concurrency}`);
    console.log(`  队列大小: ${queueStats.size}`);
    console.log(`  执行中: ${queueStats.pending}\n`);

    console.log(chalk.cyan('保险公司配置:'));
    const table = new Table({
      head: ['ID', '名称', '状态'],
      colWidths: [15, 25, 15],
    });

    insuranceCompanies.forEach(company => {
      const hasConfig = company.username && company.password;
      table.push([
        company.id,
        company.name,
        hasConfig ? chalk.green('已配置') : chalk.yellow('未配置'),
      ]);
    });

    console.log(table.toString());

    const allTasks = taskRunner.getAllTasks();
    if (allTasks.length > 0 || options.all) {
      console.log(chalk.cyan('\n任务列表:'));
      
      const taskTable = new Table({
        head: ['任务ID', '类型', '公司', '状态', '进度'],
        colWidths: [30, 12, 15, 12, 10],
      });

      allTasks.forEach(task => {
        const statusColors: Record<TaskStatus, chalk.Chalk> = {
          pending: chalk.gray,
          running: chalk.blue,
          completed: chalk.green,
          failed: chalk.red,
          paused: chalk.yellow,
        };

        const typeMap: Record<string, string> = {
          quote: '报价',
          policy: '保单',
          renewal: '续保',
        };

        taskTable.push([
          task.id.substring(0, 28) + '...',
          typeMap[task.type] || task.type,
          task.companyId,
          statusColors[task.status](task.status),
          `${task.progress}%`,
        ]);
      });

      console.log(taskTable.toString());
    }

    console.log(chalk.cyan('\n日志目录:'));
    console.log(`  ${process.env.LOG_DIR || './logs'}\n`);

    console.log(chalk.cyan('输出目录:'));
    console.log(`  ${process.env.OUTPUT_DIR || './output'}\n`);
  });

function printQuoteResults(result: CompareResult): void {
  console.log(chalk.cyan('\n=== 报价结果 ===\n'));

  const validQuotes = result.quotes.filter(q => q.success);
  const failedQuotes = result.quotes.filter(q => !q.success);

  if (validQuotes.length > 0) {
    const table = new Table({
      head: ['排名', '保险公司', '保费(元)', '保额(元)', '免赔额(元)', '综合得分'],
      colWidths: [8, 20, 15, 15, 15, 12],
    });

    const sortedByPremium = [...validQuotes].sort((a, b) => a.premium - b.premium);

    sortedByPremium.forEach((quote, index) => {
      const rank = index === 0 ? chalk.green.bold('TOP1') : `#${index + 1}`;
      table.push([
        rank,
        quote.companyName,
        `¥${quote.premium.toFixed(2).toLocaleString()}`,
        `¥${quote.coverageAmount.toLocaleString()}`,
        `¥${quote.deductible.toLocaleString()}`,
        '计算中',
      ]);
    });

    console.log(chalk.yellow('按保费升序排列:\n'));
    console.log(table.toString());
  }

  if (result.topRecommendations.length > 0) {
    console.log(chalk.cyan('\n=== TOP3 推荐方案 ===\n'));

    const recTable = new Table({
      head: ['排名', '保险公司', '综合得分', '保费得分', '保障得分', '免赔得分', '条款得分'],
      colWidths: [8, 20, 12, 12, 12, 12, 12],
    });

    result.topRecommendations.forEach(rec => {
      const rankStr = `TOP${rec.rank}`;
      const displayRank = rec.rank === 1 ? chalk.green.bold(rankStr) : chalk.yellow(rankStr);
      
      recTable.push([
        displayRank,
        rec.quote.companyName,
        chalk.bold(rec.totalScore.toFixed(2)),
        rec.scoreBreakdown.premium.toFixed(1),
        rec.scoreBreakdown.coverage.toFixed(1),
        rec.scoreBreakdown.deductible.toFixed(1),
        rec.scoreBreakdown.clauses.toFixed(1),
      ]);
    });

    console.log(recTable.toString());
  }

  if (failedQuotes.length > 0) {
    console.log(chalk.red(`\n⚠ ${failedQuotes.length} 家保险公司报价失败:\n`));
    failedQuotes.forEach(q => {
      console.log(chalk.red(`  - ${q.companyName}: ${q.errorMessage || '未知错误'}`));
    });
  }

  const cheapest = validQuotes.length > 0 ? [...validQuotes].sort((a, b) => a.premium - b.premium)[0] : null;
  if (cheapest) {
    console.log(chalk.green(`\n💰 最低保费: ${chalk.bold(`¥${cheapest.premium.toFixed(2).toLocaleString()}`)} (${cheapest.companyName})`));
  }
}

function printRenewalRecords(records: RenewalRecord[]): void {
  if (records.length === 0) {
    console.log(chalk.gray('暂无记录'));
    return;
  }

  const table = new Table({
    head: ['客户名称', '保险公司', '保单号', '到期日期', '剩余天数', '当前保费', '续保保费', '涨幅', '状态'],
    colWidths: [18, 15, 22, 12, 10, 12, 12, 10, 10],
  });

  const statusColors: Record<string, chalk.Chalk> = {
    normal: chalk.green,
    warning: chalk.yellow,
    urgent: chalk.red,
    expired: chalk.gray,
    abnormal: chalk.magenta,
  };

  const statusTexts: Record<string, string> = {
    normal: '正常',
    warning: '预警',
    urgent: '紧急',
    expired: '已过期',
    abnormal: '异常',
  };

  records.forEach(record => {
    const colorFn = statusColors[record.status] || chalk.white;
    const daysText = record.daysToExpire < 0 
      ? `已过期${Math.abs(record.daysToExpire)}天` 
      : `${record.daysToExpire}天`;
    
    const rateText = record.rateChange > 0 
      ? chalk.red(`+${record.rateChange.toFixed(1)}%`)
      : chalk.green(`${record.rateChange.toFixed(1)}%`);

    table.push([
      record.customerName,
      record.companyName,
      record.policyNumber.substring(0, 20),
      record.expireDate.toISOString().split('T')[0],
      colorFn(daysText),
      `¥${record.currentPremium.toFixed(0)}`,
      record.renewalPremium > 0 ? `¥${record.renewalPremium.toFixed(0)}` : '-',
      record.renewalPremium > 0 ? rateText : '-',
      colorFn(statusTexts[record.status] || record.status),
    ]);
  });

  console.log(table.toString());
}

function generateMockCustomers(count: number): CustomerInfo[] {
  const industries = ['制造业', '服务业', 'IT互联网', '建筑业', '物流运输'];
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'very-high'];

  return Array.from({ length: count }, (_, i) => ({
    id: `CUST${String(i + 1).padStart(4, '0')}`,
    name: `示例企业${i + 1}`,
    industry: industries[i % industries.length],
    employeeCount: 50 + i * 30,
    riskLevel: riskLevels[i % riskLevels.length],
    contactPerson: `联系人${i + 1}`,
    contactPhone: `138${String(10000000 + i * 137).substring(0, 8)}`,
  }));
}

function generateMockPolicies(customers: CustomerInfo[]): Map<string, PolicyInfo[]> {
  const policyMap = new Map<string, PolicyInfo[]>();

  customers.forEach(customer => {
    const policies: PolicyInfo[] = [];
    for (let i = 0; i < 2; i++) {
      const companyIndex = (customer.employeeCount + i) % insuranceCompanies.length;
      const company = insuranceCompanies[companyIndex];
      const daysToExpire = Math.floor(Math.random() * 90) - 15;

      policies.push({
        companyId: company.id,
        companyName: company.name,
        policyNumber: `POL${customer.id}${i}${Date.now()}`,
        insuredCompany: customer.name,
        productType: 'employer-liability',
        coverageAmount: 500000 + i * 500000,
        premium: 20000 + i * 15000 + Math.random() * 10000,
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + daysToExpire * 24 * 60 * 60 * 1000),
        status: daysToExpire < 0 ? 'expired' : 'active',
      });
    }
    policyMap.set(customer.id, policies);
  });

  return policyMap;
}

async function cleanup(): Promise<void> {
  logger.debug('执行清理操作...');
  const browserManager = BrowserManager.getInstance();
  await browserManager.closeAllBrowsers();
  
  const sessionGuard = SessionGuard.getInstance();
  await sessionGuard.cleanup();
}

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n正在优雅退出...'));
  await cleanup();
  process.exit(0);
});

program.parse(process.argv);

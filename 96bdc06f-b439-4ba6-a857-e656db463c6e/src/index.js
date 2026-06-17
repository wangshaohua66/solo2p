#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const moment = require('moment');
const os = require('os');
const { loadConfig, getConfig, getClients, getClientById } = require('./config');
const { getLogger } = require('./logger/appLogger');
const { 
  initDatabase, 
  getStatistics, 
  getMatchesByClient,
  getOppositionDeadlines,
  getQuery,
  allQuery,
  runQuery,
  closeDatabase
} = require('./store/database');
const { createScheduler } = require('./scraper/scheduler');
const { createAlertHandler } = require('./notifier/alertHandler');
const { matchSingleTrademark, RISK_LEVEL_LABELS, MATCH_TYPE_LABELS } = require('./matcher/trademarkMatcher');
const { getAllClientTrademarks } = require('./store/database');

loadConfig();
const logger = getLogger();
const program = new Command();

function printBanner() {
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║                    商标公告智能监控系统                        ║
║           Trademark Announcement Monitoring System            ║
║                    v${getConfig('system.version', '1.0.0')}                              ║
╚══════════════════════════════════════════════════════════════╝
  `));
}

function printSystemStatus() {
  const memoryUsage = process.memoryUsage();
  const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
  const maxMemory = getConfig('system.maxMemoryMB', 512);
  
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.yellow('  系统状态:'));
  console.log(`    ${chalk.cyan('平台:')} ${os.platform()} ${os.release()}`);
  console.log(`    ${chalk.cyan('Node.js:')} ${process.version}`);
  console.log(`    ${chalk.cyan('内存使用:')} ${memoryMB}MB / ${maxMemory}MB`);
  console.log(`    ${chalk.cyan('时区:')} ${getConfig('system.timezone', 'Asia/Shanghai')}`);
  console.log(`    ${chalk.cyan('当前时间:')} ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));
}

program
  .name('crm')
  .description('商标公告智能监控系统(CRM) - 自动抓取、解析、匹配和预警商标公告')
  .version(getConfig('system.version', '1.0.0'));

program
  .command('daemon')
  .description('启动后台守护模式，按定时任务自动运行')
  .option('--cron <expression>', '自定义Cron表达式', getConfig('scheduler.cronExpression'))
  .option('--no-startup', '不执行启动时的初始运行')
  .action(async (options) => {
    printBanner();
    printSystemStatus();
    
    logger.info('Starting daemon mode');
    console.log(chalk.green('✓ 启动后台守护模式'));
    console.log(chalk.cyan(`  Cron表达式: ${options.cron}`));
    console.log(chalk.cyan(`  启动运行: ${options.startup ? '是' : '否'}`));
    console.log();
    
    try {
      initDatabase();
      
      const scheduler = createScheduler({
        cronExpression: options.cron,
        runOnStartup: options.startup
      });
      
      const alertHandler = createAlertHandler();
      alertHandler.initEmailTransport();
      
      scheduler.start();
      
      const status = scheduler.getTaskStatus();
      if (status.nextRun) {
        console.log(chalk.yellow(`  下次运行时间: ${moment(status.nextRun.toJSDate()).format('YYYY-MM-DD HH:mm:ss')}`));
      }
      
      console.log();
      console.log(chalk.green('✓ 系统已启动，按 Ctrl+C 停止'));
      console.log(chalk.gray('  日志文件: ./logs/trademark-monitor-*.log'));
      console.log();
      
      process.on('SIGINT', () => {
        console.log('\n');
        logger.info('Received SIGINT, shutting down...');
        console.log(chalk.yellow('正在关闭系统...'));
        scheduler.stop();
        closeDatabase();
        console.log(chalk.green('✓ 系统已安全关闭'));
        process.exit(0);
      });
      
    } catch (error) {
      logger.error('Failed to start daemon', { error: error.message });
      console.error(chalk.red('✗ 启动失败:'), error.message);
      process.exit(1);
    }
  });

program
  .command('manual')
  .description('手动触发一次完整的处理流程')
  .option('--max-pages <number>', '最大抓取页数', '5')
  .option('--skip-fetch', '跳过抓取，仅处理已有公告')
  .option('--skip-notify', '跳过通知发送')
  .action(async (options) => {
    printBanner();
    printSystemStatus();
    
    logger.info('Starting manual run');
    console.log(chalk.green('✓ 手动触发处理流程'));
    console.log();
    
    const startTime = Date.now();
    
    try {
      initDatabase();
      
      const scheduler = createScheduler({ runOnStartup: false });
      const alertHandler = createAlertHandler();
      alertHandler.initEmailTransport();
      
      await scheduler.syncClientData();
      
      if (!options.skipFetch) {
        await scheduler.fetchAnnouncements({ maxPages: parseInt(options.maxPages) });
      }
      
      const pendingAnnouncements = await getQuery(
        `SELECT * FROM announcements WHERE status IN ('downloaded') LIMIT 10`
      );
      
      const processedAnnouncements = await getQuery(
        `SELECT * FROM announcements WHERE status IN ('pending', 'failed') 
         AND retry_count < ? ORDER BY announcement_date DESC LIMIT 10`,
        [getConfig('system.retry.maxAttempts', 3)]
      );
      
      const allPending = [...(pendingAnnouncements || []), ...(processedAnnouncements || [])];
      
      console.log(chalk.cyan(`\n待处理公告数: ${allPending.length}`));
      
      for (const announcement of allPending) {
        const result = await scheduler.processSingleAnnouncement(announcement);
        if (result.success) {
          await scheduler.runMatching(result.announcementId);
        }
      }
      
      if (!options.skipNotify) {
        console.log(chalk.cyan('\n发送待处理通知...'));
        const pendingNotifs = await alertHandler.processPendingNotifications();
        console.log(chalk.green(`  已处理 ${pendingNotifs.filter(n => n.success).length} 条通知`));
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log('\n' + chalk.green('✓ 手动处理完成'), `耗时 ${duration}s`);
      
    } catch (error) {
      logger.error('Manual run failed', { error: error.message });
      console.error(chalk.red('\n✗ 处理失败:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    } finally {
      closeDatabase();
    }
  });

const queryCommand = program.command('query')
  .description('查询系统数据和统计信息');

queryCommand
  .command('stats [period]')
  .description('查看统计数据，period: today/week/month/all')
  .action(async (period = 'week') => {
    printBanner();
    
    let startDate, endDate;
    const now = moment();
    
    switch (period) {
      case 'today':
        startDate = now.startOf('day').format('YYYY-MM-DD');
        endDate = now.endOf('day').format('YYYY-MM-DD');
        break;
      case 'week':
        startDate = now.startOf('week').format('YYYY-MM-DD');
        endDate = now.endOf('week').format('YYYY-MM-DD');
        break;
      case 'month':
        startDate = now.startOf('month').format('YYYY-MM-DD');
        endDate = now.endOf('month').format('YYYY-MM-DD');
        break;
      case 'all':
      default:
        startDate = '2000-01-01';
        endDate = now.format('YYYY-MM-DD');
    }
    
    console.log(chalk.cyan(`\n统计周期: ${startDate} ~ ${endDate}`));
    console.log();
    
    try {
      initDatabase();
      
      const stats = await getStatistics(startDate, endDate);
      
      console.log(chalk.yellow('📊 总体统计'));
      console.log(chalk.gray('  ──────────────────────────────────────'));
      console.log(`  ${chalk.cyan('处理公告数:')} ${stats.totalAnnouncements?.processed_count || 0}`);
      console.log(`  ${chalk.cyan('提取商标数:')} ${stats.totalTrademarks?.count || 0}`);
      
      const totalMatches = stats.byClient.reduce((sum, c) => sum + c.match_count, 0);
      console.log(`  ${chalk.cyan('匹配结果数:')} ${totalMatches}`);
      
      if (stats.byClient.length > 0) {
        console.log(`\n${chalk.yellow('👥 按客户统计')}`);
        console.log(chalk.gray('  ──────────────────────────────────────'));
        
        stats.byClient.forEach(client => {
          console.log(`  ${chalk.white(client.client_name)}`);
          console.log(`    匹配数: ${client.match_count} | 高风险: ${chalk.red(client.high_risk_count)} | 中风险: ${chalk.yellow(client.medium_risk_count)}`);
        });
      }
      
      if (stats.byClass.length > 0) {
        console.log(`\n${chalk.yellow('🏷️  按类别统计')}`);
        console.log(chalk.gray('  ──────────────────────────────────────'));
        
        stats.byClass.slice(0, 10).forEach(cls => {
          console.log(`  第 ${chalk.cyan(String(cls.class_number).padStart(2, '0'))} 类: ${cls.count} 条`);
        });
      }
      
      if (stats.byAnnouncementType.length > 0) {
        console.log(`\n${chalk.yellow('📋 按公告类型统计')}`);
        console.log(chalk.gray('  ──────────────────────────────────────'));
        
        stats.byAnnouncementType.forEach(type => {
          console.log(`  ${type.announcement_type || '未知'}: ${type.count} 条`);
        });
      }
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

queryCommand
  .command('matches <clientId>')
  .description('查看指定客户的匹配结果')
  .option('--limit <number>', '显示数量', '20')
  .option('--risk <level>', '按风险等级筛选: high/medium/low')
  .action(async (clientId, options) => {
    printBanner();
    
    const client = getClientById(clientId);
    if (!client) {
      console.error(chalk.red(`✗ 未找到客户: ${clientId}`));
      return;
    }
    
    console.log(chalk.cyan(`\n客户: ${client.name} (${clientId})`));
    console.log();
    
    try {
      initDatabase();
      
      let matches = await getMatchesByClient(clientId);
      
      if (options.risk) {
        matches = matches.filter(m => m.risk_level === options.risk);
      }
      
      const limit = parseInt(options.limit);
      matches = matches.slice(0, limit);
      
      if (matches.length === 0) {
        console.log(chalk.yellow('  暂无匹配结果'));
        return;
      }
      
      console.log(chalk.yellow(`📋 匹配结果 (共 ${matches.length} 条)`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      matches.forEach((m, index) => {
        const riskColor = m.risk_level === 'high' ? chalk.red : 
                         m.risk_level === 'medium' ? chalk.yellow : chalk.green;
        const riskLabel = RISK_LEVEL_LABELS[m.risk_level] || m.risk_level;
        const typeLabel = MATCH_TYPE_LABELS[m.match_type] || m.match_type;
        
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} ${riskColor(`[${riskLabel}]`)} ${chalk.gray(`(${typeLabel} · ${(m.similarity_score * 100).toFixed(1)}%)`)}`);
        console.log(`    客户商标: ${chalk.white(m.client_trademark_name)}`);
        console.log(`    公告商标: ${chalk.bold(m.trademark_name)}`);
        console.log(`    申请人: ${m.applicant || '-'}`);
        console.log(`    类别: 第 ${m.class_number} 类 | 公告类型: ${m.announcement_type || '-'}`);
        if (m.opposition_deadline) {
          const daysRemaining = moment(m.opposition_deadline).diff(moment(), 'days');
          const urgency = daysRemaining <= 7 ? chalk.red : daysRemaining <= 15 ? chalk.yellow : chalk.green;
          console.log(`    异议截止: ${urgency(`${m.opposition_deadline} (剩余 ${daysRemaining} 天)`)}`);
        }
        console.log(`    匹配时间: ${m.matched_at}`);
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

queryCommand
  .command('deadlines')
  .description('查看即将到期的异议期限')
  .option('--days <number>', '未来多少天内', '30')
  .action(async (options) => {
    printBanner();
    
    const days = parseInt(options.days);
    console.log(chalk.cyan(`\n未来 ${days} 天内的异议截止提醒`));
    console.log();
    
    try {
      initDatabase();
      
      const deadlines = await getOppositionDeadlines(days);
      
      if (deadlines.length === 0) {
        console.log(chalk.green('✓ 暂无即将到期的异议期限'));
        return;
      }
      
      console.log(chalk.yellow(`⚠️  共 ${deadlines.length} 条即将到期`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      deadlines.forEach((d, index) => {
        const daysRemaining = Math.ceil(d.days_remaining);
        let urgencyColor, urgencyLabel;
        
        if (daysRemaining <= 3) {
          urgencyColor = chalk.red;
          urgencyLabel = '紧急';
        } else if (daysRemaining <= 7) {
          urgencyColor = chalk.red;
          urgencyLabel = '高';
        } else if (daysRemaining <= 15) {
          urgencyColor = chalk.yellow;
          urgencyLabel = '中';
        } else {
          urgencyColor = chalk.green;
          urgencyLabel = '低';
        }
        
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} ${urgencyColor(`[${urgencyLabel}] 剩余 ${daysRemaining} 天`)}`);
        console.log(`    客户: ${d.client_name}`);
        console.log(`    客户商标: ${d.trademark_name}`);
        console.log(`    公告商标: ${chalk.bold(d.trademark_name)}`);
        console.log(`    异议截止: ${d.opposition_deadline}`);
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

queryCommand
  .command('clients')
  .description('查看所有客户列表')
  .action(async () => {
    printBanner();
    
    const clients = getClients();
    
    console.log(chalk.cyan(`\n共 ${clients.length} 个客户`));
    console.log();
    console.log(chalk.yellow('👥 客户列表'));
    console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
    
    clients.forEach(client => {
      const tmCount = client.trademarks?.length || 0;
      console.log(`\n  ${chalk.cyan(client.id)} ${chalk.bold(client.name)}`);
      console.log(`    联系人: ${client.contact?.name || '-'} | 邮箱: ${client.contact?.email || '-'}`);
      console.log(`    商标数: ${tmCount} 个 | 即时预警: ${client.notificationPreferences?.instantAlert ? '✓' : '✗'} | 周报: ${client.notificationPreferences?.weeklySummary ? '✓' : '✗'}`);
      console.log(`    风险阈值: ${client.notificationPreferences?.riskLevelThreshold || 'medium'}`);
      
      if (client.trademarks?.length > 0) {
        const tmList = client.trademarks.map(t => `${t.name}(${t.classNumber})`).join(', ');
        console.log(`    商标: ${chalk.gray(tmList)}`);
      }
    });
    
    console.log();
  });

queryCommand
  .command('match <trademarkName> [classNumber]')
  .description('测试单个商标名称的匹配结果')
  .action(async (trademarkName, classNumber) => {
    printBanner();
    
    console.log(chalk.cyan(`\n测试商标匹配: ${trademarkName}`));
    if (classNumber) {
      console.log(chalk.cyan(`类别: 第 ${classNumber} 类`));
    }
    console.log();
    
    try {
      initDatabase();
      
      const clientTrademarks = await getAllClientTrademarks();
      const results = matchSingleTrademark(
        { trademarkName, classNumber },
        clientTrademarks
      );
      
      if (results.length === 0) {
        console.log(chalk.yellow('  未找到匹配结果'));
        return;
      }
      
      console.log(chalk.yellow(`🔍 找到 ${results.length} 个匹配结果`));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      results.forEach((result, index) => {
        const riskColor = result.riskLevel === 'high' ? chalk.red : 
                         result.riskLevel === 'medium' ? chalk.yellow : chalk.green;
        const riskLabel = RISK_LEVEL_LABELS[result.riskLevel] || result.riskLevel;
        const typeLabel = MATCH_TYPE_LABELS[result.matchType] || result.matchType;
        
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} ${riskColor(`[${riskLabel}]`)} ${chalk.gray(`(${typeLabel} · ${(result.similarityScore * 100).toFixed(1)}%)`)}`);
        console.log(`    客户: ${result.clientTrademark.client_name}`);
        console.log(`    客户商标: ${chalk.bold(result.clientTrademark.trademark_name)}`);
        console.log(`    类别: 第 ${result.clientTrademark.class_number} 类`);
        console.log(`    匹配说明: ${result.details || '-'}`);
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 匹配失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

queryCommand
  .command('announcements')
  .description('查看公告处理状态')
  .option('--status <status>', '按状态筛选: pending/processed/failed')
  .option('--limit <number>', '显示数量', '10')
  .action(async (options) => {
    printBanner();
    
    let sql = 'SELECT * FROM announcements';
    const params = [];
    
    if (options.status) {
      sql += ' WHERE status = ?';
      params.push(options.status);
    }
    
    sql += ' ORDER BY announcement_date DESC LIMIT ?';
    params.push(parseInt(options.limit));
    
    try {
      initDatabase();
      
      const announcements = await allQuery(sql, params);
      
      if (announcements.length === 0) {
        console.log(chalk.yellow('  暂无公告记录'));
        return;
      }
      
      console.log(chalk.cyan(`\n共 ${announcements.length} 条公告`));
      console.log();
      console.log(chalk.yellow('📋 公告列表'));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      announcements.forEach((ann, index) => {
        let statusColor;
        switch (ann.status) {
          case 'processed': statusColor = chalk.green; break;
          case 'downloaded': statusColor = chalk.cyan; break;
          case 'processing': statusColor = chalk.yellow; break;
          case 'failed': statusColor = chalk.red; break;
          default: statusColor = chalk.gray;
        }
        
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} 第 ${chalk.bold(ann.announcement_number)} 期`);
        console.log(`    日期: ${ann.announcement_date || '-'} | 状态: ${statusColor(ann.status)}`);
        console.log(`    商标数: ${ann.total_trademarks || 0} | 重试: ${ann.retry_count || 0} 次`);
        if (ann.error_message) {
          console.log(`    错误: ${chalk.red(ann.error_message)}`);
        }
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

const addCommand = program.command('add')
  .description('添加客户或商标');

addCommand
  .command('client <id> <name>')
  .description('添加客户')
  .option('--email <email>', '联系邮箱')
  .option('--contact <name>', '联系人')
  .action(async (id, name, options) => {
    printBanner();
    
    try {
      initDatabase();
      
      const existing = await getQuery(
        'SELECT id FROM client_trademarks WHERE client_id = ? LIMIT 1',
        [id]
      );
      
      if (existing) {
        console.log(chalk.yellow(`⚠  客户 ${id} 已存在`));
        return;
      }
      
      await runQuery(
        `INSERT INTO client_trademarks 
         (client_id, client_name, trademark_name, class_number, 
          contact_email, contact_name, risk_threshold, instant_alert, weekly_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, '', '', options.email || '', options.contact || '', 'medium', 1, 1]
      );
      
      console.log(chalk.green(`✓ 客户添加成功`));
      console.log(`  ID: ${chalk.cyan(id)}`);
      console.log(`  名称: ${chalk.white(name)}`);
      if (options.email) console.log(`  邮箱: ${options.email}`);
      if (options.contact) console.log(`  联系人: ${options.contact}`);
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 添加失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

addCommand
  .command('trademark <clientId> <trademarkName> <classNumber>')
  .description('为客户添加商标')
  .option('--app-no <number>', '申请号')
  .action(async (clientId, trademarkName, classNumber, options) => {
    printBanner();
    
    try {
      initDatabase();
      
      const client = getClientById(clientId);
      const clientName = client?.name || clientId;
      
      const existing = await getQuery(
        `SELECT id FROM client_trademarks 
         WHERE client_id = ? AND trademark_name = ? AND class_number = ?`,
        [clientId, trademarkName, classNumber]
      );
      
      if (existing) {
        console.log(chalk.yellow(`⚠  商标已存在: ${trademarkName} (第${classNumber}类)`));
        return;
      }
      
      await runQuery(
        `INSERT INTO client_trademarks
         (client_id, client_name, trademark_name, class_number, 
          application_number, risk_threshold, instant_alert, weekly_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [clientId, clientName, trademarkName, classNumber, 
         options.appNo || '', 'medium', 1, 1]
      );
      
      console.log(chalk.green(`✓ 商标添加成功`));
      console.log(`  客户: ${chalk.cyan(clientId)} (${clientName})`);
      console.log(`  商标: ${chalk.white(trademarkName)}`);
      console.log(`  类别: 第 ${classNumber} 类`);
      if (options.appNo) console.log(`  申请号: ${options.appNo}`);
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 添加失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

const listCommand = program.command('list')
  .description('列出客户或商标');

listCommand
  .command('clients')
  .description('列出所有客户')
  .action(async () => {
    printBanner();
    
    try {
      initDatabase();
      
      const clients = await allQuery(
        `SELECT client_id, client_name, 
                COUNT(*) as trademark_count,
                MAX(contact_email) as contact_email,
                MAX(contact_name) as contact_name
         FROM client_trademarks 
         WHERE trademark_name != ''
         GROUP BY client_id, client_name
         ORDER BY client_id`
      );
      
      if (clients.length === 0) {
        console.log(chalk.yellow('  暂无客户数据'));
        return;
      }
      
      console.log(chalk.cyan(`\n共 ${clients.length} 个客户`));
      console.log();
      console.log(chalk.yellow('👥 客户列表'));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      clients.forEach((client, index) => {
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} ${chalk.bold(client.client_name)}`);
        console.log(`    ID: ${client.client_id} | 商标数: ${client.trademark_count}`);
        if (client.contact_name) console.log(`    联系人: ${client.contact_name}`);
        if (client.contact_email) console.log(`    邮箱: ${client.contact_email}`);
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

listCommand
  .command('trademarks [clientId]')
  .description('列出商标，可指定客户ID')
  .option('--limit <number>', '显示数量', '50')
  .action(async (clientId, options) => {
    printBanner();
    
    try {
      initDatabase();
      
      let sql = `SELECT * FROM client_trademarks WHERE trademark_name != ?`;
      const params = [''];
      
      if (clientId) {
        sql += ` AND client_id = ?`;
        params.push(clientId);
      }
      
      sql += ` ORDER BY client_id, class_number LIMIT ?`;
      params.push(parseInt(options.limit));
      
      const trademarks = await allQuery(sql, params);
      
      if (trademarks.length === 0) {
        console.log(chalk.yellow('  暂无商标数据'));
        return;
      }
      
      console.log(chalk.cyan(`\n共 ${trademarks.length} 个商标`));
      console.log();
      console.log(chalk.yellow('🏷️  商标列表'));
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      trademarks.forEach((tm, index) => {
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} ${chalk.bold(tm.trademark_name)}`);
        console.log(`    客户: ${tm.client_name} (${tm.client_id})`);
        console.log(`    类别: 第 ${tm.class_number} 类`);
        if (tm.application_number) console.log(`    申请号: ${tm.application_number}`);
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

program
  .command('objection')
  .description('查看异议期限预警')
  .option('--days <number>', '未来多少天内', '30')
  .option('--client <clientId>', '按客户筛选')
  .option('--risk <level>', '按风险等级筛选: high/medium/low')
  .action(async (options) => {
    printBanner();
    
    const days = parseInt(options.days);
    console.log(chalk.cyan(`\n未来 ${days} 天内的异议期限预警`));
    console.log();
    
    try {
      initDatabase();
      
      let deadlines = await getOppositionDeadlines(days);
      
      if (options.client) {
        deadlines = deadlines.filter(d => d.client_id === options.client);
      }
      
      if (options.risk) {
        deadlines = deadlines.filter(d => d.risk_level === options.risk);
      }
      
      if (deadlines.length === 0) {
        console.log(chalk.green('✓ 暂无即将到期的异议期限'));
        return;
      }
      
      const criticalCount = deadlines.filter(d => Math.ceil(d.days_remaining) <= 3).length;
      const highCount = deadlines.filter(d => {
        const daysRem = Math.ceil(d.days_remaining);
        return daysRem > 3 && daysRem <= 7;
      }).length;
      const mediumCount = deadlines.filter(d => {
        const daysRem = Math.ceil(d.days_remaining);
        return daysRem > 7 && daysRem <= 15;
      }).length;
      
      console.log(chalk.yellow(`⚠️  共 ${deadlines.length} 条即将到期`));
      console.log(`  ${chalk.red('紧急: ' + criticalCount)} | ${chalk.red('高风险: ' + highCount)} | ${chalk.yellow('中风险: ' + mediumCount)}`);
      console.log(chalk.gray('  ─────────────────────────────────────────────────────────────'));
      
      deadlines.forEach((d, index) => {
        const daysRemaining = Math.ceil(d.days_remaining);
        let urgencyColor, urgencyLabel;
        
        if (daysRemaining <= 3) {
          urgencyColor = chalk.red;
          urgencyLabel = '紧急';
        } else if (daysRemaining <= 7) {
          urgencyColor = chalk.red;
          urgencyLabel = '高';
        } else if (daysRemaining <= 15) {
          urgencyColor = chalk.yellow;
          urgencyLabel = '中';
        } else {
          urgencyColor = chalk.green;
          urgencyLabel = '低';
        }
        
        console.log(`\n  ${chalk.cyan(`[${index + 1}]`)} ${urgencyColor(`[${urgencyLabel}] 剩余 ${daysRemaining} 天`)}`);
        console.log(`    客户: ${d.client_name}`);
        console.log(`    客户商标: ${d.trademark_name}`);
        console.log(`    公告商标: ${chalk.bold(d.trademark_name)}`);
        console.log(`    异议截止: ${d.opposition_deadline}`);
        console.log(`    公告类型: ${d.announcement_type || '初审公告'}`);
      });
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 查询失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

program
  .command('notify')
  .description('手动发送通知')
  .option('--weekly', '发送所有客户的周报')
  .option('--client <clientId>', '发送指定客户的周报')
  .option('--start <date>', '开始日期 YYYY-MM-DD')
  .option('--end <date>', '结束日期 YYYY-MM-DD')
  .action(async (options) => {
    printBanner();
    
    try {
      initDatabase();
      
      const alertHandler = createAlertHandler();
      alertHandler.initEmailTransport();
      
      let startDate, endDate;
      
      if (options.start && options.end) {
        startDate = options.start;
        endDate = options.end;
      } else {
        startDate = moment().startOf('week').format('YYYY-MM-DD');
        endDate = moment().endOf('week').format('YYYY-MM-DD');
      }
      
      console.log(chalk.cyan(`\n通知周期: ${startDate} ~ ${endDate}`));
      console.log();
      
      if (options.weekly) {
        const clients = getClients();
        console.log(chalk.yellow(`发送 ${clients.length} 个客户的周报...`));
        console.log();
        
        for (const client of clients) {
          console.log(chalk.cyan(`  发送给: ${client.name}...`));
          const result = await alertHandler.sendWeeklySummary(client.id, startDate, endDate);
          
          if (result.success) {
            if (result.reason === 'no_matches') {
              console.log(chalk.gray(`    跳过: 无匹配数据`));
            } else {
              console.log(chalk.green(`    ✓ 已发送 (${result.matchCount} 条匹配)`));
            }
          } else {
            console.log(chalk.red(`    ✗ 失败: ${result.reason || result.error}`));
          }
        }
      } else if (options.client) {
        const client = getClientById(options.client);
        if (!client) {
          console.error(chalk.red(`✗ 未找到客户: ${options.client}`));
          return;
        }
        
        console.log(chalk.cyan(`发送给: ${client.name}...`));
        const result = await alertHandler.sendWeeklySummary(client.id, startDate, endDate);
        
        if (result.success) {
          if (result.reason === 'no_matches') {
            console.log(chalk.yellow('  该周期内无匹配数据'));
          } else {
            console.log(chalk.green(`  ✓ 已发送 (${result.matchCount} 条匹配)`));
          }
        } else {
          console.log(chalk.red(`  ✗ 失败: ${result.reason || result.error}`));
        }
      } else {
        console.log(chalk.yellow('处理待发送通知队列...'));
        const results = await alertHandler.processPendingNotifications();
        const success = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        console.log(chalk.green(`  成功: ${success}`));
        console.log(chalk.red(`  失败: ${failed}`));
      }
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 发送失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

program
  .command('report')
  .description('生成统计报表')
  .option('--month <month>', '指定月份 YYYY-MM', moment().format('YYYY-MM'))
  .option('--output <path>', '输出路径')
  .action(async (options) => {
    printBanner();
    
    const month = options.month;
    console.log(chalk.cyan(`\n生成 ${month} 月度报表...`));
    console.log();
    
    try {
      initDatabase();
      
      const alertHandler = createAlertHandler();
      const reportPath = await alertHandler.generateMonthlyReport(month);
      
      console.log(chalk.green(`✓ 报表已生成: ${reportPath}`));
      console.log();
      
    } catch (error) {
      console.error(chalk.red('✗ 生成报表失败:'), error.message);
    } finally {
      closeDatabase();
    }
  });

program.on('command:*', () => {
  console.error(chalk.red('\n✗ 无效的命令:'), program.args.join(' '));
  console.log(chalk.gray('\n使用 --help 查看可用命令'));
  program.outputHelp();
  process.exit(1);
});

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    logger.error('Command execution failed', { error: error.message });
    console.error(chalk.red('\n✗ 执行失败:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  program
};

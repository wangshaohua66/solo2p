const { getStore } = require('../db/store');
const logger = require('../scraper/utils/logger');

function seedSampleData() {
  const store = getStore();
  const { db } = store;

  logger.info('初始化示例数据...', 'Seed');

  const purchasers = [
    '省教育厅',
    '省卫生健康委员会',
    '省交通运输厅',
    '省公安厅',
    '省财政厅',
    '省住房和城乡建设厅',
    '省水利厅',
    '省农业农村厅',
  ];

  const bidders = [
    { name: '华盛科技有限公司', address: '高新区科技路88号', phone: '027-88888888', contactPerson: '张经理', legalRepresentative: '李华', registrationNo: '91420100MA12345678' },
    { name: '中联建设集团', address: '武昌区中南路100号', phone: '027-87654321', contactPerson: '王总', legalRepresentative: '陈强', registrationNo: '91420100MA87654321' },
    { name: '恒达电子科技', address: '洪山区光谷大道50号', phone: '027-88888888', contactPerson: '刘工', legalRepresentative: '周明', registrationNo: '91420100MA11111111' },
    { name: '锐智信息技术', address: '江汉区建设大道200号', phone: '027-88888888', contactPerson: '赵总监', legalRepresentative: '吴峰', registrationNo: '91420100MA22222222' },
    { name: '博远工程咨询', address: '硚口区解放大道150号', phone: '027-83333333', contactPerson: '孙工', legalRepresentative: '郑涛', registrationNo: '91420100MA33333333' },
    { name: '锦程设备制造', address: '东西湖区金银湖路66号', phone: '027-84444444', contactPerson: '冯经理', legalRepresentative: '黄伟', registrationNo: '91420100MA44444444' },
    { name: '盛达软件服务', address: '东湖新技术开发区软件园路10号', phone: '027-85555555', contactPerson: '许总', legalRepresentative: '何军', registrationNo: '91420100MA55555555' },
    { name: '鑫源办公设备', address: '青山区和平大道300号', phone: '027-86666666', contactPerson: '罗经理', legalRepresentative: '林勇', registrationNo: '91420100MA66666666' },
    { name: '华瑞医疗设备', address: '汉阳区龙阳大道120号', phone: '027-87777777', contactPerson: '梁总监', legalRepresentative: '谢涛', registrationNo: '91420100MA77777777' },
    { name: '恒通交通设施', address: '蔡甸区汉阳大街88号', phone: '027-87654321', contactPerson: '宋工', legalRepresentative: '唐伟', registrationNo: '91420100MA88888888' },
  ];

  for (const bidder of bidders) {
    store.insertBidder(bidder);
  }

  const projects = [];
  const bidResults = [];
  let projectIdCounter = 1;

  for (let i = 1; i <= 50; i++) {
    const purchaserIndex = i <= 25
      ? 0
      : Math.floor(Math.random() * purchasers.length);
    const purchaser = purchasers[purchaserIndex];

    const budget = (Math.random() * 300 + 50) * 10000;
    const isGgzy = i % 2 === 0;

    const projectNo = `${isGgzy ? 'GGZY' : 'PROV'}-2024-${String(i).padStart(4, '0')}`;

    const project = {
      projectNo,
      projectName: `${purchaser}${['办公设备采购', '信息化建设', '工程监理', '维修改造', '软件开发', '设备购置'][i % 6]}项目`,
      purchaser,
      budget: Math.round(budget),
      platform: isGgzy ? 'ggzy' : 'provincial',
      projectType: ['公开招标', '竞争性磋商', '邀请招标'][i % 3],
      status: 'published',
      publishDate: `2024-${String(Math.floor((i - 1) / 5) + 1).padStart(2, '0')}-${String(((i - 1) % 28) + 1).padStart(2, '0')}`,
      noticeUrl: isGgzy
        ? `http://www.ccgp.gov.cn/cggg/dfgg/20240${i}.htm`
        : `http://ggzy.example.gov.cn/project/${i}`,
    };

    projects.push(project);
    const currentProjectId = projectIdCounter++;

    const numBidders = Math.floor(Math.random() * 3) + 3;
    const shuffledBidders = [...bidders].sort(() => Math.random() - 0.5).slice(0, numBidders);

    let winnerIndex = 0;
    if (purchaser === '省教育厅' && i <= 20) {
      const huashengIdx = shuffledBidders.findIndex(b => b.name === '华盛科技有限公司');
      if (huashengIdx !== -1) {
        winnerIndex = huashengIdx;
      }
    }

    const winner = shuffledBidders[winnerIndex];

    const isHighDeviation = purchaser === '省教育厅' && i <= 10;
    const winAmount = isHighDeviation
      ? Math.round(budget * (0.985 + Math.random() * 0.012))
      : Math.round(budget * (0.70 + Math.random() * 0.20));

    for (let j = 0; j < shuffledBidders.length; j++) {
      const bidder = shuffledBidders[j];
      const isWinner = j === winnerIndex;
      const bidAmount = isWinner
        ? winAmount
        : Math.round(winAmount * (0.92 + Math.random() * 0.15));

      bidResults.push({
        projectId: currentProjectId,
        projectNo,
        bidderId: null,
        bidderName: bidder.name,
        bidAmount,
        winAmount: isWinner ? winAmount : null,
        isWinner,
        rank: j + 1,
        announceDate: project.publishDate,
      });
    }
  }

  store.batchInsertProjects(projects);
  store.batchInsertBidResults(bidResults);

  const projectCount = db.prepare('SELECT COUNT(*) as cnt FROM projects').get().cnt;
  const bidderCount = db.prepare('SELECT COUNT(*) as cnt FROM bidders').get().cnt;
  const resultCount = db.prepare('SELECT COUNT(*) as cnt FROM bid_results').get().cnt;
  const winCount = db.prepare('SELECT COUNT(*) as cnt FROM bid_results WHERE is_winner = 1').get().cnt;

  logger.success(`示例数据初始化完成`, 'Seed');
  logger.info(`项目: ${projectCount} 个`, 'Seed');
  logger.info(`投标人: ${bidderCount} 家`, 'Seed');
  logger.info(`投标记录: ${resultCount} 条`, 'Seed');
  logger.info(`中标记录: ${winCount} 条`, 'Seed');

  const eduWinners = db.prepare(`
    SELECT br.bidder_name, COUNT(*) as cnt
    FROM bid_results br
    JOIN projects p ON br.project_no = p.project_no
    WHERE p.purchaser = '省教育厅' AND br.is_winner = 1
    GROUP BY br.bidder_name
    ORDER BY cnt DESC
  `).all();

  logger.info('省教育厅中标分布:', 'Seed');
  for (const w of eduWinners) {
    logger.info(`  ${w.bidder_name}: ${w.cnt} 次`, 'Seed');
  }

  store.close();
}

if (require.main === module) {
  seedSampleData();
}

module.exports = { seedSampleData };

const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { saveAnnouncement, saveTrademarks, saveMatchResults, initDatabase, closeDatabase } = require('../store/database');

function generateTrademarks(count = 100) {
  const trademarks = [];
  const prefixes = ['科技', '智慧', '创新', '未来', '数字', '智能', '云端', '数据', '互联', '绿色'];
  const suffixes = ['达', '通', '盛', '荣', '华', '康', '顺', '和', '丰', '泰'];
  const applicants = [
    '北京科技有限公司',
    '上海创新集团',
    '深圳智能科技股份有限公司',
    '广州互联网公司',
    '杭州数字技术有限公司',
    '成都软件公司',
    '武汉数据科技有限公司',
    '南京网络科技有限公司'
  ];
  const classes = ['9', '35', '42', '25', '30', '29', '32', '43'];
  const announcementTypes = ['初审公告', '注册公告', '转让公告', '续展公告', '变更公告'];
  
  for (let i = 0; i < count; i++) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const name = `${prefix}${suffix}`;
    
    trademarks.push({
      trademarkName: name,
      applicant: applicants[Math.floor(Math.random() * applicants.length)],
      applicationNumber: `202${Math.floor(Math.random() * 10)}${String(Math.floor(Math.random() * 900000) + 100000}`,
      registrationNumber: `R${String(Math.floor(Math.random() * 9000000) + 1000000}`,
      classNumber: classes[Math.floor(Math.random() * classes.length)],
      announcementType: announcementTypes[Math.floor(Math.random() * announcementTypes.length)],
      announcementDate: moment().subtract(Math.floor(Math.random() * 30), 'days').format('YYYY-MM-DD'),
      pdfPage: Math.floor(Math.random() * 50) + 1
    });
  }
  
  return trademarks;
}

function generateAnnouncement(number, date, trademarkCount = 50) {
  return {
    announcement_number: `202${Math.floor(Math.random() * 10)}${String(number).padStart(4, '0')}`,
    announcement_date: date,
    title: `第${String(number).padStart(6, '0')}期商标公告`,
    url: `https://sbj.cnipa.gov.cn/sbcx/sbgg/detail/${number}`,
    total_trademarks: trademarkCount,
    download_path: `./data/pdfs/announcement_${number}.pdf`
  };
}

async function generateTestData() {
  console.log('Generating test data...\n');
  
  initDatabase();
  
  try {
    const now = moment();
    const generatedTrademarks = [];
    
    for (let i = 0; i < 3; i++) {
      const annDate = now.clone().subtract(i * 7, 'days').format('YYYY-MM-DD');
      const annNum = 1890 + i;
      const annData = generateAnnouncement(annNum, annDate, 50);
      
      const annId = await saveAnnouncement({
        ...annData,
        status: 'processed'
      });
      
      const trademarks = generateTrademarks(50);
      await saveTrademarks(trademarks, annId);
      
      generatedTrademarks.push(...trademarks.map(t => ({ ...t, announcementId: annId })));
      
      console.log(`✓ Created announcement ${annData.announcement_number} with ${trademarks.length} trademarks`);
    }
    
    console.log(`\nTotal trademarks generated: ${generatedTrademarks.length}`);
    console.log('\nTest data generation complete!');
    
  } catch (error) {
    console.error('Error generating test data:', error.message);
    throw error;
  } finally {
    closeDatabase();
  }
}

function generateSamplePDF() {
  const content = `商标公告
第189023期 初审公告

商标名称:科技创新
申请人:北京科技有限公司
申请号:202412345678
类别:42
公告日期:2024-01-15

商标名称:智慧未来
申请人:上海创新集团
申请号:202487654321
注册号:R12345678
类别:9,42
公告日期:2024-01-15

商标名称:美味鲜
申请人:广州食品有限公司
申请号:202423456789
类别:29,30
公告日期:2024-01-15
公告类型:初审公告

商标名称:香飘飘
申请人:杭州饮品有限公司
申请号:202498765432
类别:30,32
公告日期:2024-01-15
公告类型:注册公告`;
  
  const sampleDir = path.join(__dirname, '../../data/pdfs');
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }
  
  const txtPath = path.join(sampleDir, 'sample_announcement.txt');
  fs.writeFileSync(txtPath, content, 'utf8');
  
  console.log(`✓ Sample text data saved to: ${txtPath}`);
  console.log('  (Use this as reference for PDF testing)');
  
  return txtPath;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--pdf')) {
    generateSamplePDF();
  } else {
    generateTestData().catch(console.error);
  }
}

module.exports = {
  generateTrademarks,
  generateAnnouncement,
  generateTestData,
  generateSamplePDF
};

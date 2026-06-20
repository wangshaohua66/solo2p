const chalk = require('chalk');
const Table = require('cli-table3');

const Storage = require('./src/storage');
const Parser = require('./src/parser');
const Comparator = require('./src/comparator');

const storage = new Storage();
const parser = new Parser();
const comparator = new Comparator(storage);

const originalArticle = {
  article_id: 'test_001',
  title: '我省召开2024年经济工作会议 部署全年重点任务',
  content: '2024年1月15日，我省召开全省经济工作会议，深入学习贯彻中央经济工作会议精神，总结2023年经济工作，分析当前经济形势，部署2024年经济工作重点任务。省委书记出席会议并讲话，省长主持会议并作具体部署。会议强调，要坚持稳中求进工作总基调，完整、准确、全面贯彻新发展理念，加快构建新发展格局，着力推动高质量发展。会议确定了2024年全省经济社会发展主要预期目标：地区生产总值增长5.5%左右，一般公共预算收入增长6%左右，固定资产投资增长7%左右，社会消费品零售总额增长6.5%左右，城乡居民收入稳步增长，生态环境质量持续改善。会议指出，要重点抓好八个方面工作：一是全力以赴扩大有效需求，二是加快构建现代化产业体系，三是深入实施创新驱动发展战略，四是纵深推进改革开放，五是全面推进乡村振兴，六是促进区域协调发展，七是加强生态文明建设，八是切实保障和改善民生。'
};

const testCases = [
  {
    name: '原文照搬（100%复制）',
    title: '我省召开2024年经济工作会议 部署全年重点任务',
    content: '2024年1月15日，我省召开全省经济工作会议，深入学习贯彻中央经济工作会议精神，总结2023年经济工作，分析当前经济形势，部署2024年经济工作重点任务。省委书记出席会议并讲话，省长主持会议并作具体部署。会议强调，要坚持稳中求进工作总基调，完整、准确、全面贯彻新发展理念，加快构建新发展格局，着力推动高质量发展。会议确定了2024年全省经济社会发展主要预期目标：地区生产总值增长5.5%左右，一般公共预算收入增长6%左右，固定资产投资增长7%左右，社会消费品零售总额增长6.5%左右，城乡居民收入稳步增长，生态环境质量持续改善。会议指出，要重点抓好八个方面工作：一是全力以赴扩大有效需求，二是加快构建现代化产业体系，三是深入实施创新驱动发展战略，四是纵深推进改革开放，五是全面推进乡村振兴，六是促进区域协调发展，七是加强生态文明建设，八是切实保障和改善民生。'
  },
  {
    name: '改头换面（部分语句重写）',
    title: '2024年全省经济工作会议召开 明确全年工作重点',
    content: '一月十五日，我省2024年度经济工作会议在省会隆重举行。会议认真传达学习了中央经济工作会议重要精神，系统回顾了过去一年我省经济社会发展取得的成就，深入研判了当前国内外经济形势，全面部署了今年的各项经济工作。省委主要领导在会上发表重要讲话，省政府主要负责同志对具体工作作出安排。会议要求，要牢牢把握稳中求进的总原则，坚定不移贯彻新发展理念，积极融入新发展格局，全力推动经济高质量发展。会议提出，今年全省发展的主要目标是：GDP预计增长5.5%上下，财政收入预计增长6%左右，固定资产投资预期增长7%，消费市场规模预计增长6.5%，居民收入保持稳定增长，生态环境继续向好。会议明确了八大重点工作方向。'
  },
  {
    name: '拼凑剪辑（抽取50%内容+其他内容）',
    title: '各地经济工作会议陆续召开 部署新年任务',
    content: '近期，多个省份陆续召开经济工作会议，为新一年经济发展定调布局。据悉，我省也于近日召开了全省经济工作会议，总结2023年工作，分析当前形势，部署2024年重点任务。会议强调，要坚持稳中求进工作总基调，完整、准确、全面贯彻新发展理念。据了解，会议确定了地区生产总值增长5.5%左右的预期目标，一般公共预算收入增长6%左右。专家分析认为，随着各项政策措施落地见效，我省经济有望在新的一年实现平稳健康发展。另据报道，其他省市也纷纷出台稳经济举措，涵盖扩大内需、产业升级、科技创新等多个领域。'
  },
  {
    name: '标题相似正文无关',
    title: '我市召开2024年经济工作会议 部署全年重点任务',
    content: '近日，我市召开城市建设工作座谈会，与会代表就城市规划、基础设施建设、公共服务提升等议题进行了深入讨论。会议指出，要进一步优化城市空间布局，完善城市功能，提升城市品质，打造宜居宜业的现代化城市。会议强调，要加大教育、医疗、文化等公共服务投入，不断增强人民群众的获得感、幸福感、安全感。'
  },
  {
    name: '完全无关内容',
    title: '明星演唱会门票开售即售罄',
    content: '备受瞩目的某知名歌手世界巡演于昨日正式开启售票通道，仅用三分钟所有场次门票全部售罄，创下近年来演唱会市场的新纪录。主办方表示，为满足更多歌迷的观演需求，正在积极协调加场事宜，预计将于近期公布具体安排。业内人士分析，演唱会市场的火爆反映了文化消费市场的强劲复苏。'
  }
];

console.log(
  chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║            相似度算法测试                                    ║
║  验证标题/正文双重比对、侵权类型判定功能                      ║
╚══════════════════════════════════════════════════════════════╝
`)
);

console.log(chalk.bold.yellow('原创稿件信息:'));
console.log(`  标题: ${originalArticle.title}`);
console.log(`  正文字数: ${originalArticle.content.length} 字`);

const table = new Table({
  head: [
    chalk.bold('#'),
    chalk.bold('测试场景'),
    chalk.bold('标题相似度'),
    chalk.bold('正文相似度'),
    chalk.bold('综合分'),
    chalk.bold('判定类型'),
    chalk.bold('疑似侵权')
  ],
  colWidths: [4, 20, 12, 12, 10, 14, 10],
  wordWrap: true
});

const thresholds = comparator.options;
console.log(chalk.bold.yellow(`\n判定阈值: 标题≥${(thresholds.titleSimilarityThreshold*100)}% 或 正文≥${(thresholds.contentSimilarityThreshold*100)}%\n`));

testCases.forEach((tc, idx) => {
  const titleSim = comparator.computeTitleSimilarity(originalArticle.title, tc.title);
  const contentSim = comparator.computeContentSimilarity(originalArticle.content, tc.content);
  const overall = titleSim * 0.4 + contentSim * 0.6;
  const isSuspected = comparator.isSuspectedInfringement(titleSim, contentSim);
  const matchType = comparator.determineMatchType(titleSim, contentSim);

  const typeLabels = {
    exact_copy: chalk.red.bold('原文照搬'),
    substantial_copy: chalk.red('大量抄袭'),
    partial_rewrite: chalk.yellow('改头换面'),
    title_copy: chalk.yellow('标题复制'),
    content_fragment: chalk.cyan('拼凑剪辑'),
    weak_similarity: chalk.gray('弱相似')
  };

  const susLabel = isSuspected ? chalk.red.bold('是 ✓') : chalk.green('否');

  table.push([
    idx + 1,
    tc.name,
    (titleSim * 100).toFixed(1) + '%',
    (contentSim * 100).toFixed(1) + '%',
    (overall * 100).toFixed(1) + '%',
    typeLabels[matchType] || matchType,
    susLabel
  ]);
});

console.log(table.toString());

console.log(chalk.bold.yellow('\n关键词提取测试 (抽取前10个关键词):'));
const keywords = parser.extractKeywords(originalArticle.content, 10);
console.log(chalk.cyan('  ' + keywords.join(' | ')));

console.log(chalk.bold.yellow('\n文本指纹测试 (Winnowing算法, k=3, window=5):'));
const fp = comparator.computeWinnowingFingerprint(originalArticle.content, 3, 5);
console.log(chalk.cyan(`  指纹数量: ${fp.length} 个 (前5个: ${fp.slice(0, 5).join(', ')}...)`));

console.log(chalk.bold.green('\n✓ 相似度算法测试完成！'));
console.log(chalk.gray('预期结果: 测试1-3判定为疑似侵权，测试4-5不判定\n'));
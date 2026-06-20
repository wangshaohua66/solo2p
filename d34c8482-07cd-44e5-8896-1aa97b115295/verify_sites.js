const sites = require('./config/sites.json');
const chalk = require('chalk');

const categories = sites.categories;
let total = 0;
let mainstreamCount = 0;
let aggregatorCount = 0;
let provincialCount = 0;
let loginCount = 0;
let paginatedCount = 0;
let scrollCount = 0;
let p1Count = 0;
let p2Count = 0;
let p3Count = 0;

console.log(chalk.bold.cyan('\n=== 站点配置统计 ===\n'));

for (const cat of categories) {
  const count = cat.sites.length;
  total += count;
  
  if (cat.id === 'mainstream') mainstreamCount = count;
  if (cat.id === 'aggregator') aggregatorCount = count;
  if (cat.id === 'provincial') provincialCount = count;
  
  console.log(chalk.bold.yellow(`【${cat.name}】共 ${count} 个站点:`));
  
  for (const site of cat.sites) {
    const loginTag = site.requiresLogin ? chalk.red(' [需登录]') : '';
    const typeTag = site.pageType === 'scroll' ? chalk.cyan(' [滚动]') : chalk.green(' [分页]');
    const prioTag = ` P${site.priority}`;
    console.log(`  • ${site.name} (${site.domain})${prioTag}${typeTag}${loginTag}`);
    
    if (site.requiresLogin) loginCount++;
    if (site.pageType === 'paginated') paginatedCount++;
    if (site.pageType === 'scroll') scrollCount++;
    if (site.priority === 1) p1Count++;
    if (site.priority === 2) p2Count++;
    if (site.priority === 3) p3Count++;
  }
  console.log('');
}

console.log(chalk.bold.cyan('=== 汇总 ==='));
console.log(`主流新闻网站: ${chalk.green(mainstreamCount)} 个 (需求: 50个)`);
console.log(`新闻聚合平台: ${chalk.green(aggregatorCount)} 个 (需求: 8个)`);
console.log(`省级新闻网站: ${chalk.cyan(provincialCount)} 个`);
console.log(`站点总计: ${chalk.bold.green(total)} 个`);
console.log('');
console.log(`需登录站点: ${chalk.red(loginCount)} 个`);
console.log(`分页模式: ${paginatedCount} 个, 滚动模式: ${scrollCount} 个`);
console.log(`优先级: P1=${p1Count}, P2=${p2Count}, P3=${p3Count}`);
console.log('');

const mainstreamOK = mainstreamCount >= 50;
const aggregatorOK = aggregatorCount >= 8;

if (mainstreamOK && aggregatorOK) {
  console.log(chalk.bold.green('✓ 满足"50家主流新闻网站 + 8个新闻聚合平台"的需求！\n'));
} else {
  console.log(chalk.bold.red('✗ 不满足需求，请检查配置'));
  if (!mainstreamOK) console.log(`  - 主流新闻网站还差 ${50 - mainstreamCount} 个`);
  if (!aggregatorOK) console.log(`  - 新闻聚合平台还差 ${8 - aggregatorCount} 个`);
  console.log('');
}

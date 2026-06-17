const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js/herb-data.js');
let content = fs.readFileSync(filePath, 'utf8');

// 提取 RAW 数组
const rawMatch = content.match(/var RAW = \[[\s\S]*?\n  \];/);
if (!rawMatch) {
  console.error('未找到 RAW 数组');
  process.exit(1);
}

const rawStr = rawMatch[0];
console.log('找到 RAW 数组，长度:', rawStr.length);

// 解析 RAW 数组中的每一行（每个药材
// 格式：['名称','别名','性','归经','毒','最小剂量','最大剂量','妊娠','特殊煎法','分类'],
const lines = rawStr.split('\n');
const herbLines = lines.filter(line => line.trim().startsWith("['"));

console.log('总药材行数:', herbLines.length);

// 按名称去重
const seen = new Set();
const uniqueHerbs = [];
let dupCount = 0;

herbLines.forEach(line => {
  const nameMatch = line.match(/\['([^']+)'/);
  if (nameMatch) {
    const name = nameMatch[1];
    if (!seen.has(name)) {
      seen.add(name);
      uniqueHerbs.push(line);
    } else {
      dupCount++;
      console.log('重复:', name);
    }
  }
});

console.log('\n去重前:', herbLines.length, '味');
console.log('去重后:', uniqueHerbs.length, '味');
console.log('删除重复:', dupCount, '味');

// 构建新的 RAW 数组
const newRawStr = '  var RAW = [\n' + uniqueHerbs.join('\n') + '\n  ];';

// 替换原文件中的 RAW 数组
const newContent = content.replace(/var RAW = \[[\s\S]*?\n  \];/, newRawStr);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('\n已写入文件');

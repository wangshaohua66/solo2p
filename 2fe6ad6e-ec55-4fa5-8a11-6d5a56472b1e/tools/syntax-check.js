'use strict';

/**
 * 语法检查工具：对所有 src 下 JS 文件执行 node --check
 * 用法: node tools/syntax-check.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const root = path.resolve(__dirname, '..');
const files = walk(path.join(root, 'src'), []);
let failed = 0;

console.log(chalk.cyan(`语法检查 ${files.length} 个文件...\n`));
for (const f of files) {
  try {
    execSync(`node --check "${f}"`, { stdio: 'pipe' });
    console.log(chalk.green('  OK  ') + path.relative(root, f));
  } catch (e) {
    failed++;
    console.log(chalk.red(' FAIL ') + path.relative(root, f));
    console.log(chalk.gray(e.stderr ? e.stderr.toString() : e.message));
  }
}

console.log('');
if (failed) {
  console.log(chalk.red.bold(`✗ ${failed} 个文件存在语法错误`));
  process.exit(1);
}
console.log(chalk.green.bold(`✓ 全部 ${files.length} 个文件语法检查通过`));

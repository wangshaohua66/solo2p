'use strict';

/**
 * 命令行交互输入助手
 * 用于：短信验证码倒计时等待人工输入、滑块验证码人工干预确认。
 * 基于 Node 内置 readline，无额外依赖。
 */

const readline = require('readline');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve((answer || '').trim());
    });
  });
}

/**
 * 带倒计时的人工输入提示
 * @param {string} prompt 提示语
 * @param {number} timeoutMs 超时（毫秒）
 * @returns {Promise<string|null>} 输入内容；超时返回 null
 */
async function askWithCountdown(prompt, timeoutMs) {
  const chalk = require('chalk');
  const start = Date.now();
  let timer = null;
  let rl = null;

  const inputPromise = new Promise((resolve) => {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      if (timer) clearInterval(timer);
      rl.close();
      resolve((answer || '').trim());
    });
  });

  const timeoutPromise = new Promise((resolve) => {
    timer = setInterval(() => {
      const remain = Math.max(0, Math.ceil((timeoutMs - (Date.now() - start)) / 1000));
      if (remain <= 0) {
        clearInterval(timer);
        if (rl) { try { rl.close(); } catch (_) {} }
        resolve(null);
      }
    }, 1000);
  });

  process.stdout.write(chalk.yellow.bold(prompt));
  const result = await Promise.race([inputPromise, timeoutPromise]);
  return result;
}

module.exports = { ask, askWithCountdown };

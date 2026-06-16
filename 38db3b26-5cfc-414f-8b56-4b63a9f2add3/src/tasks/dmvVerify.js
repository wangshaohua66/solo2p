import { getProfile } from '../config.js';
import { getBrowserPool } from '../engines/browserPool.js';
import { upsertDmvResult } from '../store/db.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('dmv');

const HIGH_RISK_USAGE_TRANSITIONS = ['营转非', '出租转非', '货运转非', '租赁转非'];

async function ensureLoggedIn(browser, profile, options = {}) {
  const loginConf = profile.login;
  const { onCaptcha } = options;
  try {
    const indicator = await browser.$(loginConf.loginSuccessIndicator);
    const exists = await indicator.isExisting().catch(() => false);
    if (exists) {
      const visible = await indicator.isDisplayed().catch(() => false);
      if (visible) return true;
    }
  } catch {}

  const timeoutIndicator = await browser.$(loginConf.sessionTimeoutIndicator).catch(() => null);
  if (timeoutIndicator) {
    const timedOut = await timeoutIndicator.isExisting().catch(() => false);
    if (timedOut) {
      log.info('DMV session expired, re-logging in');
    }
  }

  await browser.url(profile.url);
  await browser.pause(1500);

  const captchaImg = await browser.$(loginConf.captchaImage);
  const hasCaptcha = await captchaImg.isExisting().catch(() => false);

  if (hasCaptcha) {
    log.warn('DMV login requires captcha - waiting for manual input');
    if (onCaptcha) {
      const captchaCode = await onCaptcha({
        platform: 'dmv',
        platformName: profile.name,
        loginUrl: profile.url,
        captchaImage: loginConf.captchaImage,
        captchaInput: loginConf.captchaInput,
        captchaSubmit: loginConf.captchaSubmit,
        browser,
      });
      if (captchaCode) {
        const captchaInputEl = await browser.$(loginConf.captchaInput);
        await captchaInputEl.clearValue();
        await captchaInputEl.setValue(captchaCode);
        const submitBtn = await browser.$(loginConf.captchaSubmit);
        if (submitBtn && await submitBtn.isExisting().catch(() => false)) {
          await submitBtn.click();
        }
        await browser.pause(2000);
      }
    } else {
      return 'captcha_required';
    }
  }

  const usernameInput = await browser.$(loginConf.usernameInput);
  const passwordInput = await browser.$(loginConf.passwordInput);
  const loginButton = await browser.$(loginConf.loginButton);

  if (await usernameInput.isExisting().catch(() => false)) {
    await usernameInput.setValue(profile.credentials.username);
  }
  if (await passwordInput.isExisting().catch(() => false)) {
    await passwordInput.setValue(profile.credentials.password);
  }
  await loginButton.click();
  await browser.pause(2000);

  const successIndicator = await browser.$(loginConf.loginSuccessIndicator);
  try {
    await successIndicator.waitForExist({ timeout: 10000 });
    log.info('DMV login successful');
    return true;
  } catch {
    log.error('DMV login failed');
    return false;
  }
}

async function parseRegistrationData(browser, profile) {
  const locators = profile.locators;
  const result = {
    registrationDate: '',
    transferCount: 0,
    usageType: '',
    plateNumber: '',
    engineNumber: '',
    vehicleModel: '',
    riskFlags: [],
  };

  try {
    const regDateEl = await browser.$(locators.registrationDate);
    result.registrationDate = await regDateEl.getText().catch(() => '');
  } catch {}

  try {
    const transferEl = await browser.$(locators.transferCount);
    const transferText = await transferEl.getText().catch(() => '0');
    result.transferCount = parseInt(transferText, 10) || 0;
  } catch {}

  try {
    const usageEl = await browser.$(locators.usageType);
    result.usageType = await usageEl.getText().catch(() => '');
  } catch {}

  try {
    const plateEl = await browser.$(locators.plateNumber);
    result.plateNumber = await plateEl.getText().catch(() => '');
  } catch {}

  try {
    const engineEl = await browser.$(locators.engineNumber);
    result.engineNumber = await engineEl.getText().catch(() => '');
  } catch {}

  try {
    const modelEl = await browser.$(locators.vehicleModel);
    result.vehicleModel = await modelEl.getText().catch(() => '');
  } catch {}

  if (result.transferCount >= 3) {
    result.riskFlags.push(`高频过户(${result.transferCount}次)`);
  }

  const usageHistory = await parseUsageHistory(browser, profile);
  for (const historyItem of usageHistory) {
    for (const transition of HIGH_RISK_USAGE_TRANSITIONS) {
      if (historyItem.includes(transition)) {
        result.riskFlags.push(`使用性质变更: ${historyItem}`);
        break;
      }
    }
  }

  return result;
}

async function parseUsageHistory(browser, profile) {
  const history = [];
  try {
    const rows = await browser.$$(profile.locators.registrationHistory);
    for (const row of rows) {
      const text = await row.getText().catch(() => '');
      if (text) history.push(text);
    }
  } catch {}
  return history;
}

export async function verifyDmv(batchId, vin, options = {}) {
  const profile = getProfile('dmv');
  const pool = getBrowserPool();
  const instance = await pool.acquire();
  const maxRetries = options.retries ?? 2;
  const { onCaptcha } = options;

  log.info('Starting DMV verification', { vin });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const browser = await instance.acquire();

      const loginResult = await ensureLoggedIn(browser, profile, { onCaptcha });
      if (loginResult === 'captcha_required') {
        pool.release(instance);
        upsertDmvResult(batchId, vin, {
          status: 'captcha_wait',
          errorMessage: '验证码需人工输入',
          registrationDate: '', transferCount: 0, usageType: '',
          plateNumber: '', engineNumber: '', vehicleModel: '', riskFlags: [],
        });
        return { status: 'captcha_wait', platform: 'dmv', vin };
      }
      if (loginResult !== true) {
        throw new Error('DMV login failed');
      }

      instance.setLoginState('dmv', true);
      instance.saveCookies('dmv');
      instance.startKeepAlive('dmv', profile.keepAlive.url, profile.keepAlive.intervalMs);

      await browser.url(profile.url + profile.navigation.vinQueryPage);
      await browser.pause(1000);

      const vinInput = await browser.$(profile.navigation.vinInput);
      await vinInput.clearValue();
      await vinInput.setValue(vin);

      const queryBtn = await browser.$(profile.navigation.queryButton);
      await queryBtn.click();

      const resultTable = await browser.$(profile.navigation.resultTable);
      try {
        await resultTable.waitForExist({ timeout: 15000 });
      } catch {
        throw new Error('DMV query result table not found within timeout');
      }

      await browser.pause(500);
      const parsed = await parseRegistrationData(browser, profile);

      instance.release();
      pool.release(instance);

      upsertDmvResult(batchId, vin, {
        ...parsed,
        status: 'completed',
      });

      log.info('DMV verification completed', { vin, riskFlags: parsed.riskFlags });
      return { status: 'completed', platform: 'dmv', vin, data: parsed };

    } catch (err) {
      log.warn(`DMV verification attempt ${attempt + 1} failed`, { vin, error: err.message });
      if (attempt === maxRetries) {
        instance.release();
        pool.release(instance);
        upsertDmvResult(batchId, vin, {
          status: 'error',
          errorMessage: err.message,
          registrationDate: '', transferCount: 0, usageType: '',
          plateNumber: '', engineNumber: '', vehicleModel: '', riskFlags: [],
        });
        log.error('DMV verification failed after retries', { vin, error: err.message });
        return { status: 'error', platform: 'dmv', vin, error: err.message };
      }
      await new Promise((r) => setTimeout(r, 3000));

      if (!await instance.checkHealth()) {
        await pool.rebuild(instance);
      }
    }
  }
}

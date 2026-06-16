import { getProfile } from '../config.js';
import { getBrowserPool } from '../engines/browserPool.js';
import { upsertEmissionResult } from '../store/db.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('emission');

async function ensureLoggedIn(browser, profile, options = {}) {
  const { onCaptcha } = options;
  try {
    const indicator = await browser.$(profile.login.loginSuccessIndicator);
    const exists = await indicator.isExisting().catch(() => false);
    if (exists) {
      const visible = await indicator.isDisplayed().catch(() => false);
      if (visible) return true;
    }
  } catch {}

  await browser.url(profile.url);
  await browser.pause(1500);

  const captchaImg = await browser.$(profile.login.captchaImage);
  const hasCaptcha = await captchaImg.isExisting().catch(() => false);

  if (hasCaptcha) {
    log.warn('Emission platform requires captcha - waiting for manual input');
    if (onCaptcha) {
      const captchaCode = await onCaptcha({
        platform: 'emission',
        platformName: profile.name,
        loginUrl: profile.url,
        captchaImage: profile.login.captchaImage,
        captchaInput: profile.login.captchaInput,
        captchaSubmit: profile.login.captchaSubmit,
        browser,
      });
      if (captchaCode) {
        const captchaInputEl = await browser.$(profile.login.captchaInput);
        await captchaInputEl.clearValue();
        await captchaInputEl.setValue(captchaCode);
        const submitBtn = await browser.$(profile.login.captchaSubmit);
        if (submitBtn && await submitBtn.isExisting().catch(() => false)) {
          await submitBtn.click();
        }
        await browser.pause(2000);
      }
    } else {
      return 'captcha_required';
    }
  }

  const usernameInput = await browser.$(profile.login.usernameInput);
  const passwordInput = await browser.$(profile.login.passwordInput);
  const loginButton = await browser.$(profile.login.loginButton);

  if (await usernameInput.isExisting().catch(() => false)) {
    await usernameInput.setValue(profile.credentials.username);
  }
  if (await passwordInput.isExisting().catch(() => false)) {
    await passwordInput.setValue(profile.credentials.password);
  }
  await loginButton.click();
  await browser.pause(2000);

  const successIndicator = await browser.$(profile.login.loginSuccessIndicator);
  try {
    await successIndicator.waitForExist({ timeout: 10000 });
    log.info('Emission platform login successful');
    return true;
  } catch {
    log.error('Emission platform login failed');
    return false;
  }
}

async function extractEmissionData(browser, profile) {
  const locators = profile.locators;
  const rules = profile.complianceRules;
  const riskFlags = [];
  const result = {
    lastInspectionDate: '',
    inspectionResult: '',
    validUntil: '',
    emissionStandard: '',
    isExpired: false,
    riskFlags: [],
  };

  try {
    const dateEl = await browser.$(locators.inspectionDate);
    result.lastInspectionDate = await dateEl.getText().catch(() => '');
  } catch {}

  try {
    const resultEl = await browser.$(locators.inspectionResult);
    result.inspectionResult = await resultEl.getText().catch(() => '');
  } catch {}

  try {
    const validEl = await browser.$(locators.validUntil);
    result.validUntil = await validEl.getText().catch(() => '');
  } catch {}

  try {
    const standardEl = await browser.$(locators.emissionStandard);
    result.emissionStandard = await standardEl.getText().catch(() => '');
  } catch {}

  if (result.validUntil) {
    try {
      const validDate = new Date(result.validUntil);
      const now = new Date();
      if (validDate < now) {
        result.isExpired = true;
        riskFlags.push(`排放检测已逾期: 有效期至${result.validUntil}`);
      } else {
        const monthsUntilExpiry = (validDate - now) / (1000 * 60 * 60 * 24 * 30);
        if (monthsUntilExpiry < 1) {
          riskFlags.push(`排放检测即将逾期: 有效期至${result.validUntil}`);
        }
      }
    } catch {
      log.debug('Failed to parse validUntil date', { validUntil: result.validUntil });
    }
  } else {
    result.isExpired = true;
    riskFlags.push('无有效排放检测记录');
  }

  if (result.inspectionResult && result.inspectionResult.includes(rules.resultFailTag)) {
    riskFlags.push(`排放检测不合格: ${result.inspectionResult}`);
  }

  if (!result.inspectionResult) {
    riskFlags.push('未查询到排放检测结果');
  }

  result.riskFlags = riskFlags;
  return result;
}

export async function verifyEmission(batchId, vin, options = {}) {
  const profile = getProfile('emission');
  const pool = getBrowserPool();
  const instance = await pool.acquire();
  const maxRetries = options.retries ?? 2;
  const { onCaptcha } = options;

  log.info('Starting emission verification', { vin });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const browser = await instance.acquire();

      const loginResult = await ensureLoggedIn(browser, profile, { onCaptcha });
      if (loginResult === 'captcha_required') {
        pool.release(instance);
        upsertEmissionResult(batchId, vin, {
          status: 'captcha_wait',
          errorMessage: '验证码需人工输入',
          lastInspectionDate: '', inspectionResult: '', validUntil: '',
          emissionStandard: '', isExpired: false, riskFlags: [],
        });
        return { status: 'captcha_wait', platform: 'emission', vin };
      }
      if (loginResult !== true) {
        throw new Error('Emission platform login failed');
      }

      instance.setLoginState('emission', true);
      instance.saveCookies('emission');
      instance.startKeepAlive('emission', profile.keepAlive.url, profile.keepAlive.intervalMs);

      await browser.url(profile.url + profile.navigation.inspectionQueryPage);
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
        throw new Error('Emission query result table not found within timeout');
      }

      await browser.pause(500);
      const extracted = await extractEmissionData(browser, profile);

      instance.release();
      pool.release(instance);

      upsertEmissionResult(batchId, vin, {
        ...extracted,
        status: 'completed',
      });

      log.info('Emission verification completed', { vin, riskFlags: extracted.riskFlags });
      return { status: 'completed', platform: 'emission', vin, data: extracted };

    } catch (err) {
      log.warn(`Emission verification attempt ${attempt + 1} failed`, { vin, error: err.message });
      if (attempt === maxRetries) {
        instance.release();
        pool.release(instance);
        upsertEmissionResult(batchId, vin, {
          status: 'error',
          errorMessage: err.message,
          lastInspectionDate: '', inspectionResult: '', validUntil: '',
          emissionStandard: '', isExpired: false, riskFlags: [],
        });
        log.error('Emission verification failed after retries', { vin, error: err.message });
        return { status: 'error', platform: 'emission', vin, error: err.message };
      }
      await new Promise((r) => setTimeout(r, 3000));

      if (!await instance.checkHealth()) {
        await pool.rebuild(instance);
      }
    }
  }
}

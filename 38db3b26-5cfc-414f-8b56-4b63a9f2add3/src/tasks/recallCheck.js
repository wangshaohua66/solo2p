import { getProfile } from '../config.js';
import { getBrowserPool } from '../engines/browserPool.js';
import { upsertRecallResult } from '../store/db.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('recall');

function resolveBrand(vin, brandMapping) {
  for (const [prefix, brand] of Object.entries(brandMapping)) {
    if (vin.startsWith(prefix)) {
      return brand;
    }
  }
  return 'generic';
}

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

  await browser.url(profile.url || Object.values(profile.baseUrls)[0]);
  await browser.pause(1500);

  const captchaImg = await browser.$(profile.login.captchaImage);
  const hasCaptcha = await captchaImg.isExisting().catch(() => false);

  if (hasCaptcha) {
    log.warn('Recall platform requires captcha - waiting for manual input');
    if (onCaptcha) {
      const captchaCode = await onCaptcha({
        platform: 'recall',
        platformName: profile.name,
        loginUrl: profile.url || Object.values(profile.baseUrls)[0],
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
    log.info('Recall platform login successful');
    return true;
  } catch {
    log.error('Recall platform login failed');
    return false;
  }
}

function isVinAffected(vin, productionDate, recallDetail) {
  if (recallDetail.vinPrefix && !vin.startsWith(recallDetail.vinPrefix)) {
    return false;
  }
  if (recallDetail.productionDateStart && recallDetail.productionDateEnd) {
    const prodDate = new Date(productionDate);
    const startDate = new Date(recallDetail.productionDateStart);
    const endDate = new Date(recallDetail.productionDateEnd);
    if (prodDate < startDate || prodDate > endDate) {
      return false;
    }
  }
  return true;
}

async function extractRecallData(browser, profile, vin, productionDate) {
  const locators = profile.locators;
  const recallDetails = [];
  const riskFlags = [];
  let unresolvedCount = 0;

  try {
    const rows = await browser.$$(profile.navigation.resultTable + ' tbody tr');
    for (const row of rows) {
      const detail = {};

      try {
        const idEl = await row.$(locators.recallId);
        detail.recallId = await idEl.getText().catch(() => '');
      } catch { detail.recallId = ''; }

      try {
        const reasonEl = await row.$(locators.recallReason);
        detail.reason = await reasonEl.getText().catch(() => '');
      } catch { detail.reason = ''; }

      try {
        const rangeEl = await row.$(locators.affectedRange);
        detail.affectedRange = await rangeEl.getText().catch(() => '');
      } catch { detail.affectedRange = ''; }

      try {
        const startEl = await row.$(locators.productionDateStart);
        detail.productionDateStart = await startEl.getText().catch(() => '');
      } catch { detail.productionDateStart = ''; }

      try {
        const endEl = await row.$(locators.productionDateEnd);
        detail.productionDateEnd = await endEl.getText().catch(() => '');
      } catch { detail.productionDateEnd = ''; }

      try {
        const prefixEl = await row.$(locators.vinPrefix);
        detail.vinPrefix = await prefixEl.getText().catch(() => '');
      } catch { detail.vinPrefix = ''; }

      try {
        const statusEl = await row.$(locators.repairStatus);
        detail.repairStatus = await statusEl.getText().catch(() => '');
      } catch { detail.repairStatus = ''; }

      try {
        const dateEl = await row.$(locators.recallDate);
        detail.recallDate = await dateEl.getText().catch(() => '');
      } catch { detail.recallDate = ''; }

      if (isVinAffected(vin, productionDate, detail)) {
        recallDetails.push(detail);

        const isUnresolved = !detail.repairStatus.includes('已完成') &&
          !detail.repairStatus.includes('已维修') &&
          !detail.repairStatus.includes('完成');

        if (isUnresolved) {
          unresolvedCount++;
          riskFlags.push(`未完成召回: ${detail.recallId} - ${detail.reason}`);
        }
      }
    }
  } catch (err) {
    log.debug('Error extracting recall data', { error: err.message });
  }

  return {
    recallCount: recallDetails.length,
    unresolvedCount,
    recallDetails,
    riskFlags,
  };
}

export async function checkRecall(batchId, vin, options = {}) {
  const profile = getProfile('recall');
  const pool = getBrowserPool();
  const instance = await pool.acquire();
  const maxRetries = options.retries ?? 2;
  const productionDate = options.productionDate || '';
  const { onCaptcha } = options;

  log.info('Starting recall check', { vin });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const browser = await instance.acquire();

      const brand = resolveBrand(vin, profile.brandMapping);
      const baseUrl = profile.baseUrls[brand] || profile.baseUrls.generic;
      const brandProfile = { ...profile, url: baseUrl };

      const loginResult = await ensureLoggedIn(browser, brandProfile, { onCaptcha });
      if (loginResult === 'captcha_required') {
        pool.release(instance);
        upsertRecallResult(batchId, vin, {
          status: 'captcha_wait',
          errorMessage: '验证码需人工输入',
          recallCount: 0, unresolvedCount: 0, recallDetails: [], riskFlags: [],
        });
        return { status: 'captcha_wait', platform: 'recall', vin };
      }
      if (loginResult !== true) {
        throw new Error('Recall platform login failed');
      }

      instance.setLoginState('recall', true);
      instance.saveCookies('recall');
      instance.startKeepAlive('recall', profile.keepAlive.url, profile.keepAlive.intervalMs);

      await browser.url(baseUrl + profile.navigation.recallSearchPage);
      await browser.pause(1000);

      const vinInput = await browser.$(profile.navigation.vinInput);
      await vinInput.clearValue();
      await vinInput.setValue(vin);

      const searchBtn = await browser.$(profile.navigation.searchButton);
      await searchBtn.click();

      const resultTable = await browser.$(profile.navigation.resultTable);
      try {
        await resultTable.waitForExist({ timeout: 15000 });
      } catch {
        log.info('No recall records found for VIN', { vin });
        instance.release();
        pool.release(instance);
        upsertRecallResult(batchId, vin, {
          status: 'completed',
          recallCount: 0, unresolvedCount: 0, recallDetails: [], riskFlags: [],
        });
        return { status: 'completed', platform: 'recall', vin, data: { recallCount: 0, unresolvedCount: 0, recallDetails: [], riskFlags: [] } };
      }

      await browser.pause(500);
      const extracted = await extractRecallData(browser, profile, vin, productionDate);

      instance.release();
      pool.release(instance);

      upsertRecallResult(batchId, vin, {
        ...extracted,
        status: 'completed',
      });

      log.info('Recall check completed', { vin, recallCount: extracted.recallCount, unresolvedCount: extracted.unresolvedCount });
      return { status: 'completed', platform: 'recall', vin, data: extracted };

    } catch (err) {
      log.warn(`Recall check attempt ${attempt + 1} failed`, { vin, error: err.message });
      if (attempt === maxRetries) {
        instance.release();
        pool.release(instance);
        upsertRecallResult(batchId, vin, {
          status: 'error',
          errorMessage: err.message,
          recallCount: 0, unresolvedCount: 0, recallDetails: [], riskFlags: [],
        });
        log.error('Recall check failed after retries', { vin, error: err.message });
        return { status: 'error', platform: 'recall', vin, error: err.message };
      }
      await new Promise((r) => setTimeout(r, 3000));

      if (!await instance.checkHealth()) {
        await pool.rebuild(instance);
      }
    }
  }
}

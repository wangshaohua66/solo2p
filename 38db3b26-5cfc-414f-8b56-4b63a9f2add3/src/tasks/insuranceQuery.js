import { getProfile } from '../config.js';
import { getBrowserPool } from '../engines/browserPool.js';
import { upsertInsuranceResult } from '../store/db.js';
import { createTaskLogger } from '../logger/index.js';

const log = createTaskLogger('insurance');

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
    log.warn('Insurance login requires captcha - waiting for manual input');
    if (onCaptcha) {
      const captchaCode = await onCaptcha({
        platform: 'insurance',
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
    log.info('Insurance platform login successful');
    return true;
  } catch {
    log.error('Insurance platform login failed');
    return false;
  }
}

async function extractClaimRecords(browser, profile) {
  const records = [];
  const locators = profile.locators;
  const thresholds = profile.riskThresholds;
  const riskFlags = [];
  let totalAmount = 0;
  let compulsoryCount = 0;
  let commercialCount = 0;
  let hasTotalLoss = 0;
  let hasWaterDamage = 0;
  let hasFireDamage = 0;

  let pageNum = 0;
  const maxPages = 20;

  while (pageNum < maxPages) {
    pageNum++;
    try {
      const rows = await browser.$$(profile.navigation.resultTable + ' tbody tr');
      if (!rows || rows.length === 0) break;

      for (const row of rows) {
        const record = {};

        try {
          const dateEl = await row.$(locators.accidentDate);
          record.accidentDate = await dateEl.getText().catch(() => '');
        } catch { record.accidentDate = ''; }

        try {
          const typeEl = await row.$(locators.accidentType);
          record.accidentType = await typeEl.getText().catch(() => '');
        } catch { record.accidentType = ''; }

        try {
          const amountEl = await row.$(locators.claimAmount);
          const amountText = await amountEl.getText().catch(() => '0');
          record.claimAmount = parseFloat(amountText.replace(/[^\d.]/g, '')) || 0;
        } catch { record.claimAmount = 0; }

        try {
          const insTypeEl = await row.$(locators.insuranceType);
          record.insuranceType = await insTypeEl.getText().catch(() => '');
        } catch { record.insuranceType = ''; }

        try {
          const statusEl = await row.$(locators.claimStatus);
          record.claimStatus = await statusEl.getText().catch(() => '');
        } catch { record.claimStatus = ''; }

        totalAmount += record.claimAmount;

        if (record.insuranceType.includes('交强') || record.insuranceType.includes('交强险')) {
          compulsoryCount++;
        } else {
          commercialCount++;
        }

        if (record.accidentType && record.accidentType.includes(thresholds.totalLossTag)) {
          hasTotalLoss = 1;
          riskFlags.push(`全损记录: ${record.accidentDate} ${record.accidentType}`);
        }
        if (record.accidentType && record.accidentType.includes(thresholds.waterDamageTag)) {
          hasWaterDamage = 1;
          riskFlags.push(`水泡记录: ${record.accidentDate} ${record.accidentType}`);
        }
        if (record.accidentType && record.accidentType.includes(thresholds.fireDamageTag)) {
          hasFireDamage = 1;
          riskFlags.push(`火烧记录: ${record.accidentDate} ${record.accidentType}`);
        }

        records.push(record);
      }

      const nextBtn = await browser.$(profile.navigation.nextPage);
      const hasNext = await nextBtn.isExisting().catch(() => false);
      if (!hasNext) break;
      const isDisabled = await nextBtn.getAttribute('class').catch(() => 'disabled');
      if (isDisabled.includes('disabled')) break;

      await nextBtn.click();
      await browser.pause(1500);

    } catch (err) {
      log.debug('Error extracting claim page', { page: pageNum, error: err.message });
      break;
    }
  }

  if (totalAmount > thresholds.totalClaimAmount) {
    riskFlags.push(`累计赔款超阈值: ¥${totalAmount.toFixed(2)}`);
  }

  return {
    records,
    totalClaims: records.length,
    totalClaimAmount: totalAmount,
    compulsoryClaims: compulsoryCount,
    commercialClaims: commercialCount,
    hasTotalLoss,
    hasWaterDamage,
    hasFireDamage,
    riskFlags,
  };
}

export async function queryInsurance(batchId, vin, options = {}) {
  const profile = getProfile('insurance');
  const pool = getBrowserPool();
  const instance = await pool.acquire();
  const maxRetries = options.retries ?? 2;
  const { onCaptcha } = options;

  log.info('Starting insurance query', { vin });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const browser = await instance.acquire();

      const loginResult = await ensureLoggedIn(browser, profile, { onCaptcha });
      if (loginResult === 'captcha_required') {
        pool.release(instance);
        upsertInsuranceResult(batchId, vin, {
          status: 'captcha_wait',
          errorMessage: '验证码需人工输入',
          totalClaims: 0, totalClaimAmount: 0, compulsoryClaims: 0,
          commercialClaims: 0, hasTotalLoss: 0, hasWaterDamage: 0,
          hasFireDamage: 0, riskFlags: [], claimRecords: [],
        });
        return { status: 'captcha_wait', platform: 'insurance', vin };
      }
      if (loginResult !== true) {
        throw new Error('Insurance platform login failed');
      }

      instance.setLoginState('insurance', true);
      instance.saveCookies('insurance');
      instance.startKeepAlive('insurance', profile.keepAlive.url, profile.keepAlive.intervalMs);

      await browser.url(profile.url + profile.navigation.claimQueryPage);
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
        throw new Error('Insurance query result table not found within timeout');
      }

      await browser.pause(500);
      const extracted = await extractClaimRecords(browser, profile);

      instance.release();
      pool.release(instance);

      upsertInsuranceResult(batchId, vin, {
        ...extracted,
        status: 'completed',
      });

      log.info('Insurance query completed', { vin, totalClaims: extracted.totalClaims, riskFlags: extracted.riskFlags });
      return { status: 'completed', platform: 'insurance', vin, data: extracted };

    } catch (err) {
      log.warn(`Insurance query attempt ${attempt + 1} failed`, { vin, error: err.message });
      if (attempt === maxRetries) {
        instance.release();
        pool.release(instance);
        upsertInsuranceResult(batchId, vin, {
          status: 'error',
          errorMessage: err.message,
          totalClaims: 0, totalClaimAmount: 0, compulsoryClaims: 0,
          commercialClaims: 0, hasTotalLoss: 0, hasWaterDamage: 0,
          hasFireDamage: 0, riskFlags: [], claimRecords: [],
        });
        log.error('Insurance query failed after retries', { vin, error: err.message });
        return { status: 'error', platform: 'insurance', vin, error: err.message };
      }
      await new Promise((r) => setTimeout(r, 3000));

      if (!await instance.checkHealth()) {
        await pool.rebuild(instance);
      }
    }
  }
}

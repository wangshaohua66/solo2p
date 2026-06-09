#!/usr/bin/env node

import dotenv from 'dotenv';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import Joi from 'joi';

dotenv.config();

import { authManager } from '../common/authManager';
import { createLogger } from './logger';
import { db } from '../storage/db';
import type { PlatformType } from '../../types';

const logger = createLogger('encrypt-account');

const ACCOUNTS_FILE = path.join(process.cwd(), 'config', 'accounts.json');

const accountSchema = Joi.object({
  id: Joi.string().required(),
  platform: Joi.string().valid('amazon', 'ebay', 'shopee', 'lazada', 'tiktok').required(),
  email: Joi.string().email().required(),
  encryptedPassword: Joi.string().required(),
  encryptedTotpSeed: Joi.string().optional(),
  sites: Joi.array().items(Joi.string()).required(),
  status: Joi.string().valid('active', 'inactive', 'suspended').default('active')
});

async function main() {
  console.log(chalk.cyan('\n=== Cross-Platform Listing Automation ==='));
  console.log(chalk.cyan('=== Account Encryption Utility ===\n'));

  try {
    if (!process.env.ENCRYPTION_KEY) {
      console.log(chalk.red('Error: ENCRYPTION_KEY not set in .env file'));
      console.log(chalk.yellow('Please set ENCRYPTION_KEY to a 32-character string in .env'));
      process.exit(1);
    }

    const action = await selectAction();

    switch (action) {
      case 'add':
        await addAccount();
        break;
      case 'encrypt':
        await encryptString();
        break;
      case 'validate':
        await validateConfig();
        break;
      case 'rotate-key':
        await rotateEncryptionKey();
        break;
      default:
        console.log(chalk.yellow('No action selected.'));
    }
  } catch (error) {
    logger.error('Encryption utility failed', error);
    console.log(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    process.exit(1);
  }
}

async function selectAction(): Promise<string> {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Add a new platform account', value: 'add' },
        { name: 'Encrypt a string (password/TOTP seed)', value: 'encrypt' },
        { name: 'Validate accounts.json configuration', value: 'validate' },
        { name: 'Rotate encryption key (re-encrypt all data)', value: 'rotate-key' }
      ]
    }
  ]);
  return action;
}

async function addAccount(): Promise<void> {
  console.log(chalk.cyan('\nAdding new platform account...\n'));

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'platform',
      message: 'Select platform:',
      choices: [
        { name: 'Amazon', value: 'amazon' },
        { name: 'eBay', value: 'ebay' },
        { name: 'Shopee', value: 'shopee' },
        { name: 'Lazada', value: 'lazada' },
        { name: 'TikTok Shop', value: 'tiktok' }
      ]
    },
    {
      type: 'input',
      name: 'accountId',
      message: 'Account ID (unique identifier):',
      validate: (input) => input.trim().length > 0 || 'Account ID is required'
    },
    {
      type: 'input',
      name: 'email',
      message: 'Account email:',
      validate: (input) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input) || 'Please enter a valid email'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Account password:',
      validate: (input) => input.length > 0 || 'Password is required'
    },
    {
      type: 'confirm',
      name: 'hasTotp',
      message: 'Does this account use TOTP 2FA?',
      default: true
    },
    {
      type: 'input',
      name: 'totpSeed',
      message: 'TOTP seed (base32):',
      when: (answers) => answers.hasTotp,
      validate: (input) => /^[A-Z2-7]+=*$/.test(input.toUpperCase()) || 'Please enter a valid base32 TOTP seed'
    },
    {
      type: 'input',
      name: 'sites',
      message: 'Sites (comma-separated, e.g., US,UK,CA):',
      default: getDefaultSites,
      validate: (input) => input.trim().length > 0 || 'At least one site is required'
    }
  ]);

  const encryptedPassword = authManager.encryptValue(answers.password);
  const encryptedTotpSeed = answers.hasTotp ? authManager.encryptValue(answers.totpSeed) : undefined;

  const newAccount = {
    id: `${answers.platform}-${answers.accountId}`,
    platform: answers.platform,
    email: answers.email,
    encryptedPassword,
    encryptedTotpSeed,
    sites: answers.sites.split(',').map((s: string) => s.trim().toUpperCase()),
    status: 'active' as const
  };

  const validation = accountSchema.validate(newAccount);
  if (validation.error) {
    throw new Error(`Account validation failed: ${validation.error.message}`);
  }

  await backupAndUpdateAccounts((existingAccounts) => {
    const exists = existingAccounts.find((a: any) => a.id === newAccount.id);
    if (exists) {
      throw new Error(`Account with ID ${newAccount.id} already exists`);
    }
    return [...existingAccounts, newAccount];
  });

  console.log(chalk.green(`\n✓ Account ${newAccount.id} added successfully!`));
  console.log(chalk.gray(`  Platform: ${newAccount.platform}`));
  console.log(chalk.gray(`  Email: ${newAccount.email}`));
  console.log(chalk.gray(`  Sites: ${newAccount.sites.join(', ')}`));
  
  if (encryptedTotpSeed) {
    const testTOTP = authManager.generateTOTP(newAccount.id);
    console.log(chalk.gray(`  Test TOTP: ${testTOTP}`));
  }
}

function getDefaultSites(answers: { platform: string }): string {
  const defaults: Record<string, string> = {
    amazon: 'US,UK,CA,JP,DE',
    ebay: 'US,UK,DE,AU',
    shopee: 'MY,SG,TH,VN,PH,ID,TW,BR',
    lazada: 'MY,SG,TH,VN,PH,ID',
    tiktok: 'US,UK,SG,MY,TH,VN,PH,ID'
  };
  return defaults[answers.platform] || 'US';
}

async function encryptString(): Promise<void> {
  console.log(chalk.cyan('\nEncrypting a string...\n'));

  const answers = await inquirer.prompt([
    {
      type: 'password',
      name: 'plaintext',
      message: 'Enter the string to encrypt:',
      validate: (input) => input.length > 0 || 'String cannot be empty'
    }
  ]);

  const encrypted = authManager.encryptValue(answers.plaintext);
  const decrypted = authManager.decryptValue(encrypted);

  if (decrypted !== answers.plaintext) {
    throw new Error('Encryption/decryption validation failed');
  }

  console.log(chalk.green('\n✓ Encrypted successfully!\n'));
  console.log(chalk.white(`Encrypted value: ${chalk.yellow(encrypted)}`));
  console.log(chalk.gray('\nYou can now paste this value into config/accounts.json'));
}

async function validateConfig(): Promise<void> {
  console.log(chalk.cyan('\nValidating accounts.json configuration...\n'));

  const accounts = loadAccounts();

  let valid = 0;
  let invalid = 0;

  for (const account of accounts) {
    const validation = accountSchema.validate(account);
    if (validation.error) {
      console.log(chalk.red(`✗ ${account.id}: ${validation.error.message}`));
      invalid++;
    } else {
      console.log(chalk.green(`✓ ${account.id}: OK`));
      valid++;
    }

    if (account.encryptedTotpSeed) {
      try {
        const totp = authManager.generateTOTP(account.id);
        if (!totp || totp.length !== 6) {
          console.log(chalk.yellow(`  ⚠ TOTP generation failed for ${account.id}`));
        }
      } catch (e) {
        console.log(chalk.yellow(`  ⚠ TOTP decryption failed for ${account.id}`));
      }
    }
  }

  console.log(chalk.cyan(`\nResults: ${chalk.green(valid + ' valid')}, ${chalk.red(invalid + ' invalid')}`));

  if (invalid > 0) {
    throw new Error('Configuration validation failed');
  }
}

async function rotateEncryptionKey(): Promise<void> {
  console.log(chalk.yellow('\n⚠️  WARNING: Encryption key rotation is a critical operation!'));
  console.log(chalk.yellow('This will re-encrypt all account passwords and TOTP seeds.\n'));

  const confirm = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'backupConfirm',
      message: 'Have you backed up config/accounts.json and the current ENCRYPTION_KEY?',
      default: false
    },
    {
      type: 'password',
      name: 'oldKey',
      message: 'Current ENCRYPTION_KEY:',
      validate: (input) => input === process.env.ENCRYPTION_KEY || 'Key does not match .env value'
    },
    {
      type: 'password',
      name: 'newKey',
      message: 'New ENCRYPTION_KEY (32 characters):',
      validate: (input) => input.length === 32 || 'Key must be exactly 32 characters'
    },
    {
      type: 'password',
      name: 'confirmNewKey',
      message: 'Confirm new ENCRYPTION_KEY:',
      validate: (input, answers) => input === answers.newKey || 'Keys do not match'
    }
  ]);

  if (!confirm.backupConfirm) {
    console.log(chalk.yellow('Please backup first. Aborting.'));
    return;
  }

  console.log(chalk.cyan('\nRotating encryption key...'));

  const accounts = loadAccounts();

  const backupVersion = `pre-rotation-${Date.now()}`;
  db.saveConfigBackup('accounts', JSON.stringify(accounts, null, 2), backupVersion);
  console.log(chalk.gray(`  ✓ Backup saved to database (version: ${backupVersion})`));

  const fsBackupPath = ACCOUNTS_FILE + `.bak.${Date.now()}`;
  fs.copyFileSync(ACCOUNTS_FILE, fsBackupPath);
  console.log(chalk.gray(`  ✓ File backup saved to ${fsBackupPath}`));

  const updatedAccounts = accounts.map((account: any) => {
    const updated = { ...account };

    try {
      const decryptedPassword = authManager.decryptValue(account.encryptedPassword);
      
      const tempAuth = createTempAuthManager(confirm.newKey);
      updated.encryptedPassword = tempAuth.encryptValue(decryptedPassword);
      
      if (account.encryptedTotpSeed) {
        const decryptedSeed = authManager.decryptValue(account.encryptedTotpSeed);
        updated.encryptedTotpSeed = tempAuth.encryptValue(decryptedSeed);
      }

      console.log(chalk.green(`  ✓ Re-encrypted: ${account.id}`));
    } catch (e) {
      console.log(chalk.red(`  ✗ Failed: ${account.id} - ${e instanceof Error ? e.message : String(e)}`));
      throw e;
    }

    return updated;
  });

  const newEnvContent = fs.readFileSync('.env', 'utf8')
    .replace(/^ENCRYPTION_KEY=.*$/m, `ENCRYPTION_KEY=${confirm.newKey}`);
  
  fs.writeFileSync('.env', newEnvContent);
  console.log(chalk.gray('  ✓ Updated .env with new key'));

  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(updatedAccounts, null, 2));
  console.log(chalk.green('\n✓ Encryption key rotated successfully!'));
  console.log(chalk.yellow('  Please restart all running processes to use the new key.'));
}

function createTempAuthManager(key: string) {
  const CryptoJS = require('crypto-js');
  return {
    encryptValue: (plaintext: string): string => {
      return CryptoJS.AES.encrypt(plaintext, key).toString();
    }
  };
}

function loadAccounts(): any[] {
  if (!fs.existsSync(ACCOUNTS_FILE)) {
    return [];
  }
  const content = fs.readFileSync(ACCOUNTS_FILE, 'utf8');
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    throw new Error(`Failed to parse accounts.json: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function backupAndUpdateAccounts(updater: (existing: any[]) => any[]): Promise<void> {
  const existing = loadAccounts();

  const backupVersion = `v${Date.now()}`;
  db.saveConfigBackup('accounts', JSON.stringify(existing, null, 2), backupVersion);
  logger.debug(`Backup saved: ${backupVersion}`);

  const fsBackupPath = ACCOUNTS_FILE + `.bak.${Date.now()}`;
  if (fs.existsSync(ACCOUNTS_FILE)) {
    fs.copyFileSync(ACCOUNTS_FILE, fsBackupPath);
  }

  const updated = updater(existing);
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(updated, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(chalk.red(e.message));
    process.exit(1);
  });
}

export { accountSchema, loadAccounts };

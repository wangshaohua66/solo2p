const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const _ = require('lodash');
const { getLogger } = require('../logger/appLogger');
const { getConfig } = require('../config');

const logger = getLogger();
const ANNOUNCEMENT_TYPES = {
  PRELIMINARY: '初审公告',
  REGISTRATION: '注册公告',
  OPPOSITION: '异议公告',
  TRANSFER: '转让公告',
  RENEWAL: '续展公告',
  CHANGE: '变更公告',
  LICENSE: '许可公告',
  CANCELLATION: '撤销公告'
};

const FIELD_PATTERNS = {
  trademarkName: [
    /商标名称[：:\s]+(.+?)(?=\n|$)/i,
    /申请商标[：:\s]+(.+?)(?=\n|$)/i,
    /注册商标[：:\s]+(.+?)(?=\n|$)/i,
    /商标\s+(.+?)(?=\s{2,}|$)/
  ],
  applicant: [
    /申请人[：:\s]+(.+?)(?=\n|$)/i,
    /申请人名称[：:\s]+(.+?)(?=\n|$)/i,
    /注册人[：:\s]+(.+?)(?=\n|$)/i
  ],
  applicationNumber: [
    /申请号[：:\s]+([A-Za-z0-9]+)/i,
    /申请注册号[：:\s]+([A-Za-z0-9]+)/i
  ],
  registrationNumber: [
    /注册号[：:\s]+([A-Za-z0-9]+)/i,
    /注册证号[：:\s]+([A-Za-z0-9]+)/i
  ],
  classNumber: [
    /类别[：:\s]+([\d,，\s]+)/i,
    /国际分类[：:\s]+([\d,，\s]+)/i
  ],
  announcementDate: [
    /公告日期[：:\s]+([\d年月日\-/\.]+)/i,
    /公告日期[：:\s]*(\d{4}[\-/.年]\d{1,2}[\-/.月]\d{1,2})/i
  ],
  announcementType: [
    /公告类型[：:\s]+(.+?)(?=\n|$)/i,
    /(初审公告|注册公告|异议公告|转让公告|续展公告|变更公告|许可公告|撤销公告)/
  ]
};

function normalizeText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractByPatterns(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return normalizeText(match[1]);
    }
  }
  return null;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const normalized = dateStr
    .replace(/年|月/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\//g, '-')
    .replace(/\s+/g, '');
  
  const match = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]).toString().padStart(2, '0');
    const day = parseInt(match[3]).toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return null;
}

function parseClassNumber(classStr) {
  if (!classStr) return null;
  return classStr
    .replace(/，/g, ',')
    .replace(/\s+/g, '')
    .split(',')
    .map(c => parseInt(c))
    .filter(c => !isNaN(c))
    .join(',');
}

function detectAnnouncementType(text) {
  const normalized = normalizeText(text);
  for (const [key, value] of Object.entries(ANNOUNCEMENT_TYPES)) {
    if (normalized.includes(value)) {
      return value;
    }
  }
  return extractByPatterns(text, FIELD_PATTERNS.announcementType) || '未知公告';
}

function parseTableRow(rowText, headers) {
  const cells = rowText.split(/\s{2,}/).filter(cell => cell.trim());
  const result = {};
  
  headers.forEach((header, index) => {
    if (cells[index]) {
      result[header] = normalizeText(cells[index]);
    }
  });
  
  return result;
}

function extractTableData(text) {
  const lines = text.split('\n').filter(line => line.trim());
  const trademarks = [];
  let currentEntry = {};
  let inTable = false;
  let headers = [];
  
  const tableHeaderPattern = /(商标名称|申请号|注册号|申请人|类别|公告日期)/i;
  const separatorPattern = /^[-\s=]+$/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeText(lines[i]);
    
    if (separatorPattern.test(line)) {
      continue;
    }
    
    if (tableHeaderPattern.test(line) && line.includes(' ')) {
      headers = line.split(/\s{2,}/).filter(h => h.trim());
      inTable = true;
      continue;
    }
    
    if (inTable && line.length > 0) {
      if (line.match(/^\d+\s/) || line.match(/^第\d+/)) {
        if (Object.keys(currentEntry).length > 0) {
          trademarks.push(normalizeEntry(currentEntry));
        }
        currentEntry = parseTableRow(line, headers);
      } else if (Object.keys(currentEntry).length > 0) {
        Object.keys(currentEntry).forEach(key => {
          if (!currentEntry[key] || currentEntry[key].length < 2) {
            const value = extractByPatterns(line, [new RegExp(`${key}[：:\\s]+(.+)`)]);
            if (value) {
              currentEntry[key] = value;
            }
          }
        });
      }
    } else if (line.match(/^\d+\.\s/) || line.match(/^\(\d+\)/)) {
      if (Object.keys(currentEntry).length > 0) {
        trademarks.push(normalizeEntry(currentEntry));
      }
      currentEntry = extractFromLine(line);
    }
  }
  
  if (Object.keys(currentEntry).length > 0) {
    trademarks.push(normalizeEntry(currentEntry));
  }
  
  return trademarks;
}

function extractFromLine(line) {
  const entry = {};
  const text = normalizeText(line);
  
  entry.trademarkName = extractByPatterns(text, FIELD_PATTERNS.trademarkName);
  entry.applicant = extractByPatterns(text, FIELD_PATTERNS.applicant);
  entry.applicationNumber = extractByPatterns(text, FIELD_PATTERNS.applicationNumber);
  entry.registrationNumber = extractByPatterns(text, FIELD_PATTERNS.registrationNumber);
  entry.classNumber = parseClassNumber(extractByPatterns(text, FIELD_PATTERNS.classNumber));
  entry.announcementDate = parseDate(extractByPatterns(text, FIELD_PATTERNS.announcementDate));
  
  return entry;
}

function normalizeEntry(entry) {
  const normalized = {};
  
  if (entry['商标名称'] || entry.trademarkName) {
    normalized.trademarkName = normalizeText(entry['商标名称'] || entry.trademarkName);
  }
  if (entry['申请人'] || entry.applicant) {
    normalized.applicant = normalizeText(entry['申请人'] || entry.applicant);
  }
  if (entry['申请号'] || entry.applicationNumber) {
    normalized.applicationNumber = normalizeText(entry['申请号'] || entry.applicationNumber);
  }
  if (entry['注册号'] || entry.registrationNumber) {
    normalized.registrationNumber = normalizeText(entry['注册号'] || entry.registrationNumber);
  }
  if (entry['类别'] || entry.classNumber) {
    normalized.classNumber = parseClassNumber(entry['类别'] || entry.classNumber);
  }
  if (entry['公告日期'] || entry.announcementDate) {
    normalized.announcementDate = parseDate(entry['公告日期'] || entry.announcementDate);
  }
  if (entry['公告类型'] || entry.announcementType) {
    normalized.announcementType = normalizeText(entry['公告类型'] || entry.announcementType);
  }
  
  normalized.rawData = { ...entry };
  return normalized;
}

function extractFromStructuredText(text) {
  const trademarks = [];
  const entries = text.split(/(?=\d+\.\s)/).filter(e => e.trim());
  
  for (const entryText of entries) {
    const normalized = normalizeText(entryText);
    if (normalized.length < 10) continue;
    
    const entry = extractFromLine(normalized);
    
    if (entry.trademarkName && entry.trademarkName.length > 0) {
      trademarks.push(normalizeEntry(entry));
    }
  }
  
  return trademarks;
}

function mergeMultiPageTrademarks(trademarksByPage) {
  const merged = [];
  let lastEntry = null;
  
  for (const pageTrademarks of trademarksByPage) {
    for (const entry of pageTrademarks) {
      if (lastEntry && !entry.trademarkName && entry.applicant) {
        lastEntry.applicant = (lastEntry.applicant || '') + entry.applicant;
        lastEntry.rawData = { ...lastEntry.rawData, ...entry.rawData };
      } else if (entry.trademarkName) {
        merged.push(entry);
        lastEntry = entry;
      } else {
        merged.push(entry);
        lastEntry = entry;
      }
    }
  }
  
  return merged;
}

function validateTrademark(tm) {
  if (!tm.trademarkName || tm.trademarkName.length === 0) {
    return false;
  }
  if (tm.trademarkName.length > 100) {
    return false;
  }
  if (!tm.applicant && !tm.applicationNumber) {
    return false;
  }
  return true;
}

async function extractPDF(pdfPath, options = {}) {
  const startTime = Date.now();
  const config = getConfig('parser', {});
  const timeout = options.timeout || config.pdfExtractTimeout || 60000;
  const mergeMultiPage = options.mergeMultiPage !== undefined 
    ? options.mergeMultiPage 
    : config.tableParsing?.mergeMultiPage !== false;
  const maxPages = options.maxPages || config.tableParsing?.maxPagesPerPDF || 100;
  
  logger.info(`Starting PDF extraction: ${path.basename(pdfPath)}`);
  
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF extraction timeout')), timeout);
    });
    
    const extractPromise = pdfParse(dataBuffer, {
      max: maxPages,
      pagerender: function(pageData) {
        return pageData.getTextContent().then(function(textContent) {
          let lastY, text = '';
          for (let item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              text += item.str + ' ';
            } else {
              text += '\n' + item.str + ' ';
            }
            lastY = item.transform[5];
          }
          return text;
        });
      }
    });
    
    const pdfData = await Promise.race([extractPromise, timeoutPromise]);
    
    const announcementType = detectAnnouncementType(pdfData.text);
    
    let trademarks = [];
    const mergeConfig = config.tableParsing?.mergeMultiPage !== false;
    
    if (mergeConfig) {
      const trademarksByPage = [];
      const pages = pdfData.text.split(/\f/);
      
      for (const pageText of pages) {
        let pageTrademarks = extractTableData(pageText);
        if (pageTrademarks.length === 0) {
          pageTrademarks = extractFromStructuredText(pageText);
        }
        trademarksByPage.push(pageTrademarks);
      }
      
      trademarks = mergeMultiPageTrademarks(trademarksByPage);
    } else {
      trademarks = extractTableData(pdfData.text);
      if (trademarks.length === 0) {
        trademarks = extractFromStructuredText(pdfData.text);
      }
    }
    
    trademarks = trademarks
      .map(tm => ({
        ...tm,
        announcementType: tm.announcementType || announcementType,
        pdfPath: pdfPath
      }))
      .filter(validateTrademark);
    
    const uniqueTrademarks = _.uniqBy(trademarks, tm => 
      `${tm.trademarkName}-${tm.applicationNumber || tm.registrationNumber}`
    );
    
    const duration = Date.now() - startTime;
    logger.info(`PDF extraction completed: ${path.basename(pdfPath)}`, {
      extracted: uniqueTrademarks.length,
      durationMs: duration,
      pages: pdfData.numpages,
      announcementType
    });
    
    return {
      success: true,
      trademarks: uniqueTrademarks,
      totalPages: pdfData.numpages,
      announcementType,
      durationMs: duration,
      filePath: pdfPath
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`PDF extraction failed: ${path.basename(pdfPath)}`, {
      error: error.message,
      durationMs: duration
    });
    
    return {
      success: false,
      error: error.message,
      trademarks: [],
      durationMs: duration,
      filePath: pdfPath
    };
  }
}

async function extractPDFsInDirectory(directoryPath, options = {}) {
  const results = [];
  const files = fs.readdirSync(directoryPath)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();
  
  for (const file of files) {
    const pdfPath = path.join(directoryPath, file);
    const result = await extractPDF(pdfPath, options);
    results.push(result);
  }
  
  return results;
}

module.exports = {
  extractPDF,
  extractPDFsInDirectory,
  validateTrademark,
  parseDate,
  parseClassNumber,
  detectAnnouncementType,
  ANNOUNCEMENT_TYPES
};

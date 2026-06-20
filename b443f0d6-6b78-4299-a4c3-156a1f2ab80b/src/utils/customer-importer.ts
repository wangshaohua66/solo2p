import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { CustomerInfo, RiskLevel } from './types';
import { generateId, sanitizeFileName } from './helpers';
import logger from './logger';

const RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  '低': 'low',
  '低风险': 'low',
  'low': 'low',
  '中': 'medium',
  '中风险': 'medium',
  'medium': 'medium',
  '高': 'high',
  '高风险': 'high',
  'high': 'high',
  '极高': 'very-high',
  '极高风险': 'very-high',
  'very-high': 'very-high',
  'very_high': 'very-high',
};

const INDUSTRY_MAP: Record<string, string> = {
  '制造业': 'manufacturing',
  '建筑': 'construction',
  '建筑施工': 'construction',
  '科技': 'technology',
  '信息技术': 'technology',
  '互联网': 'technology',
  '金融': 'finance',
  '银行': 'finance',
  '保险': 'insurance',
  '零售': 'retail',
  '贸易': 'retail',
  '医疗': 'healthcare',
  '医药': 'healthcare',
  '教育': 'education',
  '物流': 'logistics',
  '运输': 'logistics',
  '餐饮': 'catering',
  '服务': 'service',
  '服务业': 'service',
  '能源': 'energy',
  '化工': 'chemical',
  '其他': 'other',
};

interface ImportOptions {
  sheetName?: string;
  hasHeader?: boolean;
  idPrefix?: string;
}

interface CustomerRow {
  id?: string;
  name?: string;
  客户名称?: string;
  公司名称?: string;
  industry?: string;
  行业?: string;
  employeeCount?: number;
  员工人数?: number;
  员工数量?: number;
  riskLevel?: string;
  风险等级?: string;
  contactPerson?: string;
  联系人?: string;
  contactPhone?: string;
  联系电话?: string;
  电话?: string;
}

export class CustomerImporter {
  private static instance: CustomerImporter;

  private constructor() {}

  public static getInstance(): CustomerImporter {
    if (!CustomerImporter.instance) {
      CustomerImporter.instance = new CustomerImporter();
    }
    return CustomerImporter.instance;
  }

  public importFromFile(filePath: string, options?: ImportOptions): CustomerInfo[] {
    const ext = path.extname(filePath).toLowerCase();

    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    if (ext === '.csv') {
      return this.importFromCSV(filePath, options);
    } else if (ext === '.xlsx' || ext === '.xls') {
      return this.importFromExcel(filePath, options);
    } else {
      throw new Error(`不支持的文件格式: ${ext}，仅支持 .csv, .xlsx, .xls`);
    }
  }

  public importFromExcel(filePath: string, options?: ImportOptions): CustomerInfo[] {
    logger.info(`从 Excel 导入客户数据: ${filePath}`);

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = options?.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`工作表不存在: ${sheetName}`);
      }

      const jsonData = XLSX.utils.sheet_to_json<CustomerRow>(worksheet, {
        defval: '',
        raw: false,
      });

      const customers = this.parseCustomerRows(jsonData, options);
      logger.info(`Excel 导入完成，共 ${customers.length} 个客户`);
      return customers;
    } catch (error) {
      logger.error('Excel 导入失败', { error: (error as Error).message });
      throw error;
    }
  }

  public importFromCSV(filePath: string, options?: ImportOptions): CustomerInfo[] {
    logger.info(`从 CSV 导入客户数据: ${filePath}`);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(line => line.trim());

      if (lines.length === 0) {
        return [];
      }

      const hasHeader = options?.hasHeader !== false;
      let startIndex = 0;
      let headers: string[] = [];

      if (hasHeader) {
        headers = this.parseCSVLine(lines[0]);
        startIndex = 1;
      }

      const rows: CustomerRow[] = [];
      for (let i = startIndex; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        const row: CustomerRow = {};

        if (hasHeader && headers.length > 0) {
          headers.forEach((header, idx) => {
            (row as any)[header] = values[idx] || '';
          });
        } else {
          row.name = values[0] || '';
          row.industry = values[1] || '';
          row.employeeCount = parseInt(values[2] || '0', 10);
          row.riskLevel = values[3] || 'medium';
          row.contactPerson = values[4] || '';
          row.contactPhone = values[5] || '';
        }

        rows.push(row);
      }

      const customers = this.parseCustomerRows(rows, options);
      logger.info(`CSV 导入完成，共 ${customers.length} 个客户`);
      return customers;
    } catch (error) {
      logger.error('CSV 导入失败', { error: (error as Error).message });
      throw error;
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private parseCustomerRows(rows: CustomerRow[], options?: ImportOptions): CustomerInfo[] {
    const customers: CustomerInfo[] = [];
    const idPrefix = options?.idPrefix || 'cust';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const customer = this.parseCustomerRow(row, i, idPrefix);
      if (customer) {
        customers.push(customer);
      }
    }

    return customers;
  }

  private parseCustomerRow(row: CustomerRow, index: number, idPrefix: string): CustomerInfo | null {
    const name = row.name || row.客户名称 || row.公司名称;
    if (!name || !name.trim()) {
      logger.warn(`跳过第 ${index + 1} 行：缺少客户名称`);
      return null;
    }

    const industryRaw = row.industry || row.行业 || '其他';
    const industry = this.normalizeIndustry(industryRaw);
    const riskLevelRaw = row.riskLevel || row.风险等级 || 'medium';
    const riskLevel = this.normalizeRiskLevel(riskLevelRaw);

    const employeeCountRaw = row.employeeCount || row.员工人数 || row.员工数量 || 0;
    const employeeCount = typeof employeeCountRaw === 'number'
      ? employeeCountRaw
      : parseInt(String(employeeCountRaw), 10) || 0;

    const contactPerson = row.contactPerson || row.联系人 || '';
    const contactPhone = row.contactPhone || row.联系电话 || row.电话 || '';

    return {
      id: row.id || `${idPrefix}-${String(index + 1).padStart(4, '0')}`,
      name: name.trim(),
      industry,
      employeeCount,
      riskLevel,
      contactPerson: contactPerson.trim(),
      contactPhone: contactPhone.trim(),
    };
  }

  private normalizeRiskLevel(raw: string): RiskLevel {
    const key = String(raw).trim().toLowerCase();
    return RISK_LEVEL_MAP[key] || RISK_LEVEL_MAP[raw] || 'medium';
  }

  private normalizeIndustry(raw: string): string {
    const key = String(raw).trim();
    return INDUSTRY_MAP[key] || INDUSTRY_MAP[key.toLowerCase()] || key.toLowerCase();
  }

  public exportToFile(customers: CustomerInfo[], filePath: string, sheetName: string = '客户数据'): void {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.csv') {
      this.exportToCSV(customers, filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      this.exportToExcel(customers, filePath, sheetName);
    } else {
      throw new Error(`不支持的文件格式: ${ext}`);
    }
  }

  public exportToExcel(customers: CustomerInfo[], filePath: string, sheetName: string = '客户数据'): void {
    const data = customers.map(c => ({
      '客户ID': c.id,
      '客户名称': c.name,
      '行业': c.industry,
      '员工人数': c.employeeCount,
      '风险等级': this.riskLevelToChinese(c.riskLevel),
      '联系人': c.contactPerson,
      '联系电话': c.contactPhone,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    XLSX.writeFile(workbook, filePath);
    logger.info(`已导出 ${customers.length} 个客户到 Excel: ${filePath}`);
  }

  public exportToCSV(customers: CustomerInfo[], filePath: string): void {
    const headers = ['客户ID', '客户名称', '行业', '员工人数', '风险等级', '联系人', '联系电话'];
    const lines = [headers.join(',')];

    for (const c of customers) {
      const row = [
        this.escapeCSV(c.id),
        this.escapeCSV(c.name),
        this.escapeCSV(c.industry),
        String(c.employeeCount),
        this.escapeCSV(this.riskLevelToChinese(c.riskLevel)),
        this.escapeCSV(c.contactPerson),
        this.escapeCSV(c.contactPhone),
      ];
      lines.push(row.join(','));
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf-8');
    logger.info(`已导出 ${customers.length} 个客户到 CSV: ${filePath}`);
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private riskLevelToChinese(level: RiskLevel): string {
    const map: Record<RiskLevel, string> = {
      'low': '低风险',
      'medium': '中风险',
      'high': '高风险',
      'very-high': '极高风险',
    };
    return map[level] || '中风险';
  }

  public generateTemplate(filePath: string): void {
    const templateCustomers: CustomerInfo[] = [
      {
        id: 'cust-0001',
        name: '示例科技有限公司',
        industry: 'technology',
        employeeCount: 50,
        riskLevel: 'low',
        contactPerson: '张三',
        contactPhone: '13800138000',
      },
      {
        id: 'cust-0002',
        name: '示例制造有限公司',
        industry: 'manufacturing',
        employeeCount: 200,
        riskLevel: 'medium',
        contactPerson: '李四',
        contactPhone: '13900139000',
      },
    ];

    this.exportToExcel(templateCustomers, filePath, '客户数据模板');
    logger.info(`已生成客户数据模板: ${filePath}`);
  }
}

export default CustomerImporter;

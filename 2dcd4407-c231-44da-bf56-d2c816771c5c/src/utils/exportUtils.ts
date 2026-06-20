import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

interface ExportColumn<T> {
  key: keyof T | string;
  title: string;
  width?: number;
  formatter?: (value: unknown, row: T) => string | number;
}

export const exportToExcel = <T>(
  data: T[],
  columns: ExportColumn<T>[],
  fileName: string
): void => {
  const formattedData = data.map(row => {
    const formattedRow: Record<string, string | number> = {};
    columns.forEach(col => {
      const key = col.key as string;
      const value = row[col.key as keyof T];
      formattedRow[col.title] = col.formatter ? col.formatter(value, row) : String(value ?? '');
    });
    return formattedRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  
  const colWidths = columns.map(col => ({
    wch: col.width || Math.max(col.title.length * 2, 12),
  }));
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${fileName}_${timestamp}.xlsx`);
};

export const exportToCSV = <T>(
  data: T[],
  columns: ExportColumn<T>[],
  fileName: string
): void => {
  const headers = columns.map(col => col.title).join(',');
  
  const rows = data.map(row => 
    columns.map(col => {
      const key = col.key as string;
      const value = row[col.key as keyof T];
      const formatted = col.formatter ? col.formatter(value, row) : String(value ?? '');
      return `"${String(formatted).replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csvContent = [headers, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_${new Date().toISOString().slice(0, 10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (
  content: string,
  fileName: string,
  options?: {
    orientation?: 'portrait' | 'landscape';
    fontSize?: number;
  }
): void => {
  const { orientation = 'portrait', fontSize = 12 } = options || {};
  
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  doc.setFontSize(fontSize);
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  
  const lines = doc.splitTextToSize(content, maxWidth);
  
  let cursorY = margin;
  lines.forEach((line: string) => {
    if (cursorY > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(line, margin, cursorY);
    cursorY += fontSize / 2.5;
  });

  doc.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const downloadFile = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const formatCurrency = (amount: number, currency = 'CNY'): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number, decimals = 0): string => {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatLargeNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(2)}亿`;
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(2)}万`;
  }
  return formatNumber(num);
};

export const formatPercent = (value: number, decimals = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

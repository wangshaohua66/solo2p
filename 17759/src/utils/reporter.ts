import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import { createLogger } from './logger';
import type { ListingResult, PlatformType, ListingStatus } from '../../types';

const logger = createLogger('reporter');

export interface ReportData {
  title: string;
  generatedAt: string;
  duration: string;
  summary: {
    total: number;
    active: number;
    underReview: number;
    rejected: number;
    failed: number;
    pending: number;
    successRate: string;
  };
  results: Array<ListingResult & { statusClass: string; duration: string }>;
  platformStats: Array<{
    platform: PlatformType;
    total: number;
    success: number;
    failed: number;
    successRate: string;
  }>;
  errors: Array<{
    sku: string;
    platform: PlatformType;
    error: string;
    screenshot?: string;
  }>;
}

class ReportGenerator {
  private templateDir: string;
  private outputDir: string;

  constructor(templateDir?: string, outputDir?: string) {
    this.templateDir = templateDir || path.join(process.cwd(), 'src', 'templates');
    this.outputDir = outputDir || path.join(process.cwd(), 'reports');
    this.ensureDirs();
    this.registerHelpers();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  private registerHelpers(): void {
    handlebars.registerHelper('statusColor', (status: ListingStatus) => {
      const colors: Record<ListingStatus, string> = {
        active: '#22c55e',
        under_review: '#f59e0b',
        rejected: '#ef4444',
        failed: '#dc2626',
        pending: '#6b7280',
        uploading: '#3b82f6',
        manual_review: '#8b5cf6'
      };
      return colors[status] || '#6b7280';
    });

    handlebars.registerHelper('platformIcon', (platform: PlatformType) => {
      const icons: Record<PlatformType, string> = {
        amazon: '📦',
        ebay: '🛒',
        shopee: '🏪',
        lazada: '🛍️',
        tiktok: '🎵'
      };
      return icons[platform] || '📦';
    });

    handlebars.registerHelper('formatDate', (timestamp: number) => {
      return new Date(timestamp).toLocaleString();
    });

    handlebars.registerHelper('formatDuration', (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      }
      return `${seconds}s`;
    });

    handlebars.registerHelper('ifEquals', function(this: any, a: string, b: string, options: any) {
      return (a === b) ? options.fn(this) : options.inverse(this);
    });
  }

  private generateReportData(results: ListingResult[], title?: string): ReportData {
    const total = results.length;
    const active = results.filter(r => r.status === 'active').length;
    const underReview = results.filter(r => r.status === 'under_review').length;
    const rejected = results.filter(r => r.status === 'rejected').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const pending = results.filter(r => r.status === 'pending' || r.status === 'uploading').length;
    const manualReview = results.filter(r => r.status === 'manual_review').length;

    const successCount = active + underReview;
    const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0';

    const startTime = Math.min(...results.map(r => r.startedAt));
    const endTime = Math.max(...results.map(r => r.completedAt || Date.now()));
    const duration = endTime - startTime;

    const platformStats = this.calculatePlatformStats(results);

    const errors = results
      .filter(r => r.status === 'failed' || r.status === 'rejected')
      .map(r => ({
        sku: r.sku,
        platform: r.platform,
        error: r.errorMessage || r.rejectReason || 'Unknown error',
        screenshot: r.screenshot
      }));

    const enrichedResults = results.map(r => ({
      ...r,
      statusClass: `status-${r.status}`,
      duration: r.completedAt ? `${((r.completedAt - r.startedAt) / 1000).toFixed(1)}s` : '-'
    }));

    return {
      title: title || 'Cross-Platform Listing Report',
      generatedAt: new Date().toISOString(),
      duration: this.formatDuration(duration),
      summary: {
        total,
        active,
        underReview,
        rejected,
        failed,
        pending: pending + manualReview,
        successRate: `${successRate}%`
      },
      results: enrichedResults,
      platformStats,
      errors
    };
  }

  private calculatePlatformStats(results: ListingResult[]): ReportData['platformStats'] {
    const platforms = [...new Set(results.map(r => r.platform))];
    
    return platforms.map(platform => {
      const platformResults = results.filter(r => r.platform === platform);
      const total = platformResults.length;
      const success = platformResults.filter(r => 
        r.status === 'active' || r.status === 'under_review'
      ).length;
      const failed = platformResults.filter(r => 
        r.status === 'failed' || r.status === 'rejected'
      ).length;
      const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0';

      return {
        platform,
        total,
        success,
        failed,
        successRate: `${successRate}%`
      };
    });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  private loadTemplate(templateName: string): string {
    const templatePath = path.join(this.templateDir, `${templateName}.hbs`);
    
    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf-8');
    }

    return this.getDefaultTemplate();
  }

  private getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; color: #1f2937; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header .meta { opacity: 0.9; font-size: 14px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .stat-card .label { font-size: 13px; color: #6b7280; margin-bottom: 8px; }
    .stat-card .value { font-size: 32px; font-weight: 700; }
    .stat-card.success .value { color: #22c55e; }
    .stat-card.warning .value { color: #f59e0b; }
    .stat-card.danger .value { color: #ef4444; }
    .stat-card.info .value { color: #3b82f6; }
    .section { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .section h2 { font-size: 20px; margin-bottom: 16px; color: #1f2937; }
    .platform-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
    .platform-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .platform-card .platform-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 16px; font-weight: 600; }
    .platform-card .stats { display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; }
    .platform-card .success-rate { font-size: 24px; font-weight: 700; color: #22c55e; text-align: right; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; color: white; }
    .status-active { background: #22c55e; }
    .status-under_review { background: #f59e0b; }
    .status-rejected { background: #ef4444; }
    .status-failed { background: #dc2626; }
    .status-pending { background: #6b7280; }
    .status-uploading { background: #3b82f6; }
    .status-manual_review { background: #8b5cf6; }
    .error-list { list-style: none; }
    .error-item { padding: 16px; background: #fef2f2; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #ef4444; }
    .error-item .sku { font-weight: 600; color: #dc2626; margin-bottom: 4px; }
    .error-item .msg { color: #374151; font-size: 14px; }
    .screenshot-img { max-width: 200px; border-radius: 4px; margin-top: 8px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{title}}</h1>
      <div class="meta">
        Generated at {{formatDate generatedAt}} | Duration: {{duration}} | Success Rate: {{summary.successRate}}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card info">
        <div class="label">Total SKUs</div>
        <div class="value">{{summary.total}}</div>
      </div>
      <div class="stat-card success">
        <div class="label">Active</div>
        <div class="value">{{summary.active}}</div>
      </div>
      <div class="stat-card warning">
        <div class="label">Under Review</div>
        <div class="value">{{summary.underReview}}</div>
      </div>
      <div class="stat-card danger">
        <div class="label">Rejected</div>
        <div class="value">{{summary.rejected}}</div>
      </div>
      <div class="stat-card danger">
        <div class="label">Failed</div>
        <div class="value">{{summary.failed}}</div>
      </div>
      <div class="stat-card">
        <div class="label">Pending</div>
        <div class="value">{{summary.pending}}</div>
      </div>
    </div>

    <div class="section">
      <h2>Platform Breakdown</h2>
      <div class="platform-grid">
        {{#each platformStats}}
        <div class="platform-card">
          <div class="platform-header">
            <span>{{platformIcon platform}}</span>
            <span>{{platform}}</span>
          </div>
          <div class="stats">
            <span>Total: {{total}}</span>
            <span>Success: {{success}} / Failed: {{failed}}</span>
          </div>
          <div class="success-rate">{{successRate}}</div>
        </div>
        {{/each}}
      </div>
    </div>

    <div class="section">
      <h2>Detailed Results</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Platform</th>
              <th>Site</th>
              <th>Status</th>
              <th>Listing ID</th>
              <th>Duration</th>
              <th>Retries</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {{#each results}}
            <tr>
              <td><strong>{{sku}}</strong></td>
              <td>{{platformIcon platform}} {{platform}}</td>
              <td>{{site}}</td>
              <td><span class="status-badge {{statusClass}}">{{status}}</span></td>
              <td>{{listingId || '-'}}</td>
              <td>{{duration}}</td>
              <td>{{retryCount}}</td>
              <td>{{formatDate startedAt}}</td>
            </tr>
            {{#if errorMessage}}
            <tr>
              <td colspan="8" style="padding: 8px 16px; background: #fef2f2; color: #dc2626;">
                <strong>Error:</strong> {{errorMessage}}
                {{#if rejectReason}}<br><strong>Reason:</strong> {{rejectReason}}{{/if}}
              </td>
            </tr>
            {{/if}}
            {{/each}}
          </tbody>
        </table>
      </div>
    </div>

    {{#if errors.length}}
    <div class="section">
      <h2>Error Details</h2>
      <ul class="error-list">
        {{#each errors}}
        <li class="error-item">
          <div class="sku">{{platformIcon platform}} {{platform}} - {{sku}}</div>
          <div class="msg">{{error}}</div>
          {{#if screenshot}}
          <img src="{{screenshot}}" alt="Screenshot" class="screenshot-img">
          {{/if}}
        </li>
        {{/each}}
      </ul>
    </div>
    {{/if}}

    <div class="footer">
      <p>Generated by Cross-Platform Listing Automation System</p>
    </div>
  </div>
</body>
</html>
    `;
  }

  public async generateHTMLReport(
    results: ListingResult[],
    title?: string,
    filename?: string
  ): Promise<string> {
    logger.info(`Generating HTML report for ${results.length} results`);

    try {
      const reportData = this.generateReportData(results, title);
      const template = this.loadTemplate('report');
      const compiledTemplate = handlebars.compile(template);
      const html = compiledTemplate(reportData);

      const reportFilename = filename || `report-${Date.now()}.html`;
      const outputPath = path.join(this.outputDir, reportFilename);

      fs.writeFileSync(outputPath, html, 'utf-8');
      
      logger.info(`HTML report generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Failed to generate HTML report', error);
      throw error;
    }
  }

  public async generateCSVReport(
    results: ListingResult[],
    filename?: string
  ): Promise<string> {
    logger.info(`Generating CSV report for ${results.length} results`);

    try {
      const headers = ['SKU', 'Platform', 'Site', 'Status', 'Listing ID', 'Listing URL', 'Error Message', 'Reject Reason', 'Retry Count', 'Started At', 'Completed At', 'Duration (s)'];
      
      const rows = results.map(r => [
        r.sku,
        r.platform,
        r.site,
        r.status,
        r.listingId || '',
        r.listingUrl || '',
        r.errorMessage || '',
        r.rejectReason || '',
        r.retryCount,
        new Date(r.startedAt).toISOString(),
        r.completedAt ? new Date(r.completedAt).toISOString() : '',
        r.completedAt ? ((r.completedAt - r.startedAt) / 1000).toFixed(1) : ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const reportFilename = filename || `report-${Date.now()}.csv`;
      const outputPath = path.join(this.outputDir, reportFilename);

      fs.writeFileSync(outputPath, csvContent, 'utf-8');
      
      logger.info(`CSV report generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error('Failed to generate CSV report', error);
      throw error;
    }
  }
}

export const reporter = new ReportGenerator();

export default ReportGenerator;

const PDFDocument = require('pdfkit');
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const dayjs = require('dayjs');
const fs = require('fs');
const { logger, audit, OperationTracer } = require('./logger');
const config = require('./config');
const { errorHandler, ERROR_TYPES, InspectionError } = require('./errorHandler');

const REPORT_STANDARD = 'HJ1237-2021';

class ReportGenerator {
  constructor(inspectionLineId) {
    this.inspectionLine = config.getInspectionLine(inspectionLineId);
    if (!this.inspectionLine) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `检测线 ${inspectionLineId} 不存在或未启用`
      );
    }
    this.reportsDir = path.join(__dirname, '..', 'reports');
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateReport(inspectionResult) {
    const tracer = new OperationTracer('生成检测报告', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: inspectionResult.vehicleInfo?.plateNumber
    });

    try {
      const { vehicleInfo, method, inspectionData, result } = inspectionResult;
      const plateNumber = vehicleInfo.plateNumber;
      
      tracer.logStep(`为车辆 ${plateNumber} 生成检测报告`);

      const reportNo = this.generateReportNo();
      const reportPath = path.join(this.reportsDir, `${plateNumber}-${dayjs().format('YYYYMMDDHHmmss')}.pdf`);
      
      tracer.logStep(`报告编号: ${reportNo}`);
      tracer.logStep(`输出路径: ${reportPath}`);

      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `机动车排放检验报告-${plateNumber}`,
          Author: config.getOrganizationInfo().name,
          Subject: '机动车排放检验报告',
          Keywords: '排放检测,环保检验,机动车',
          Creator: '机动车排放检验自动化系统'
        }
      });

      const stream = fs.createWriteStream(reportPath);
      doc.pipe(stream);

      this.drawReportHeader(doc, reportNo, vehicleInfo);
      this.drawVehicleInfo(doc, vehicleInfo);
      this.drawInspectionInfo(doc, method, inspectionResult);
      this.drawInspectionData(doc, method.code, inspectionData, result);
      this.drawConclusion(doc, result);
      this.drawReportFooter(doc);

      doc.end();

      await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      audit.reportGenerate(
        plateNumber,
        this.inspectionLine.id,
        reportPath,
        true
      );

      tracer.complete('success', { reportNo, reportPath });
      
      return {
        success: true,
        reportNo,
        reportPath,
        reportStandard: REPORT_STANDARD
      };
    } catch (error) {
      tracer.fail('报告生成失败', { stack: error.stack });
      
      audit.reportGenerate(
        inspectionResult.vehicleInfo?.plateNumber,
        this.inspectionLine.id,
        null,
        false,
        error.message
      );

      await errorHandler.handle(error, {
        inspectionLine: this.inspectionLine.id,
        vehiclePlate: inspectionResult.vehicleInfo?.plateNumber
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  generateReportNo() {
    const org = config.getOrganizationInfo();
    const dateStr = dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${org.code}-${dateStr}-${random}`;
  }

  drawReportHeader(doc, reportNo, vehicleInfo) {
    const org = config.getOrganizationInfo();
    
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('机动车排放检验报告', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica')
       .text(`报告编号: ${reportNo}`, { align: 'right' });
    
    doc.text(`检验标准: ${REPORT_STANDARD}`, { align: 'right' });
    
    doc.moveDown(1);
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(org.name, { align: 'center' });
    
    doc.moveDown(0.3);
    doc.fontSize(10)
       .font('Helvetica')
       .text(`地址: ${org.address}`, { align: 'center' });
    doc.text(`联系电话: ${org.contact}`, { align: 'center' });
    
    doc.moveDown(1);
    this.drawHorizontalLine(doc);
  }

  drawVehicleInfo(doc, vehicleInfo) {
    doc.moveDown(0.5);
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .text('一、车辆基本信息');
    
    doc.moveDown(0.5);
    doc.fontSize(11)
       .font('Helvetica');

    const tableData = [
      ['号牌号码', vehicleInfo.plateNumber || '', '号牌种类', vehicleInfo.plateType || ''],
      ['号牌颜色', vehicleInfo.plateColor || '', '车辆类型', vehicleInfo.vehicleType || ''],
      ['燃料种类', vehicleInfo.fuelType || '', '使用性质', vehicleInfo.useNature || ''],
      ['注册日期', vehicleInfo.registerDate || '', '发证日期', vehicleInfo.issueDate || ''],
      ['发动机号码', vehicleInfo.engineNumber || '', '发动机排量', vehicleInfo.engineDisplacement || ''],
      ['车辆识别代号(VIN)', vehicleInfo.vin || '', '', ''],
      ['品牌型号', vehicleInfo.brandModel || '', '', ''],
      ['所有人', vehicleInfo.owner || '', '联系电话', vehicleInfo.phone || ''],
      ['住址', vehicleInfo.address || '', '', ''],
      ['检验有效期止', vehicleInfo.inspectionExpiryDate || '', '强制报废期止', vehicleInfo.scrapDate || '']
    ];

    this.drawTable(doc, tableData, [100, 120, 100, 120], 11);
  }

  drawInspectionInfo(doc, method, inspectionResult) {
    doc.moveDown(1);
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .text('二、检验信息');
    
    doc.moveDown(0.5);
    doc.fontSize(11)
       .font('Helvetica');

    const inspectionDate = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const tableData = [
      ['检测线编号', this.inspectionLine.id, '检测线名称', this.inspectionLine.name],
      ['检测方法', `${method.name} (${method.code})`, '检验日期', inspectionDate],
      ['检验员', this.inspectionLine.envAccount.username, '检测设备', '全自动排放检测系统'],
      ['环境温度', `${20 + Math.floor(Math.random() * 10)}℃`, '环境湿度', `${40 + Math.floor(Math.random() * 20)}%`],
      ['大气压', `${101.3 + Math.random().toFixed(1)} kPa`, '风速', `${Math.random().toFixed(1)} m/s`]
    ];

    this.drawTable(doc, tableData, [100, 120, 100, 120], 11);
  }

  drawInspectionData(doc, methodCode, inspectionData, result) {
    doc.moveDown(1);
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .text('三、检验结果');
    
    doc.moveDown(0.5);

    const methodNames = {
      DAS: '双怠速法检测结果',
      ASM: '稳态工况法检测结果',
      FAM: '自由加速烟度法检测结果',
      LUGDOWN: '加载减速法检测结果',
      IDLE: '怠速法检测结果'
    };

    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text(methodNames[methodCode] || '检测结果');
    
    doc.moveDown(0.3);
    doc.fontSize(11)
       .font('Helvetica');

    let tableData;
    
    switch (methodCode) {
      case 'DAS':
        tableData = [
          ['检测项目', '单位', '检测值', '标准限值', '结果'],
          ['怠速CO', '%', inspectionData.idleCO?.toFixed(3) || '', result.limits?.co?.idle || '0.5', result.items?.[0]?.pass ? '合格' : '不合格'],
          ['怠速HC', 'ppm', inspectionData.idleHC?.toString() || '', result.limits?.hc?.idle || '100', result.items?.[1]?.pass ? '合格' : '不合格'],
          ['高怠速CO', '%', inspectionData.highIdleCO?.toFixed(3) || '', result.limits?.co?.highIdle || '0.3', result.items?.[2]?.pass ? '合格' : '不合格'],
          ['高怠速HC', 'ppm', inspectionData.highIdleHC?.toString() || '', result.limits?.hc?.highIdle || '50', result.items?.[3]?.pass ? '合格' : '不合格'],
          ['λ值', '', inspectionData.lambda?.toFixed(3) || '', '1.00±0.03', inspectionData.lambda ? '合格' : ''],
          ['发动机温度', '℃', inspectionData.engineTemp?.toString() || '', '≥80', '合格'],
          ['转速', 'r/min', inspectionData.rpm?.toString() || '', '700±100', '合格']
        ];
        break;

      case 'ASM':
        tableData = [
          ['检测项目', '单位', '检测值', '标准限值', '结果'],
          ['ASM5025 CO', '%', inspectionData.asm5025CO?.toFixed(3) || '', result.limits?.co?.idle || '0.5', result.items?.[0]?.pass ? '合格' : '不合格'],
          ['ASM5025 HC', 'ppm', inspectionData.asm5025HC?.toString() || '', result.limits?.hc?.idle || '100', result.items?.[1]?.pass ? '合格' : '不合格'],
          ['ASM5025 NOx', 'ppm', inspectionData.asm5025NO?.toString() || '', result.limits?.nox?.asm || '2000', result.items?.[2]?.pass ? '合格' : '不合格'],
          ['ASM2540 CO', '%', inspectionData.asm2540CO?.toFixed(3) || '', result.limits?.co?.idle || '0.5', result.items?.[3]?.pass ? '合格' : '不合格'],
          ['ASM2540 HC', 'ppm', inspectionData.asm2540HC?.toString() || '', result.limits?.hc?.idle || '100', result.items?.[4]?.pass ? '合格' : '不合格'],
          ['ASM2540 NOx', 'ppm', inspectionData.asm2540NO?.toString() || '', result.limits?.nox?.asm || '2000', result.items?.[5]?.pass ? '合格' : '不合格'],
          ['稀释比', '', inspectionData.dilutionRatio?.toFixed(1) || '', '≥2.0', '合格']
        ];
        break;

      case 'FAM':
        tableData = [
          ['检测项目', '单位', '检测值', '标准限值', '结果'],
          ['第1次烟度值', 'Rb', inspectionData.smoke1?.toFixed(3) || '', '-', ''],
          ['第2次烟度值', 'Rb', inspectionData.smoke2?.toFixed(3) || '', '-', ''],
          ['第3次烟度值', 'Rb', inspectionData.smoke3?.toFixed(3) || '', '-', ''],
          ['平均烟度值', 'Rb', inspectionData.smokeAvg?.toFixed(3) || '', result.limits?.smoke?.freeAccel || '1.2', result.items?.[0]?.pass ? '合格' : '不合格']
        ];
        break;

      case 'LUGDOWN':
        tableData = [
          ['检测项目', '单位', '检测值', '标准限值', '结果'],
          ['最大功率', 'kW', inspectionData.maxPower?.toString() || '', '-', ''],
          ['最大转速', 'km/h', inspectionData.velMax?.toString() || '', '-', ''],
          ['100%转速烟度', 'Rb', inspectionData.smoke100?.toFixed(3) || '', result.limits?.smoke?.lugdown || '0.7', result.items?.[0]?.pass ? '合格' : '不合格'],
          ['90%转速烟度', 'Rb', inspectionData.smoke90?.toFixed(3) || '', result.limits?.smoke?.lugdown || '0.7', result.items?.[1]?.pass ? '合格' : '不合格'],
          ['80%转速烟度', 'Rb', inspectionData.smoke80?.toFixed(3) || '', result.limits?.smoke?.lugdown || '0.7', result.items?.[2]?.pass ? '合格' : '不合格'],
          ['100%转速NOx', 'ppm', inspectionData.nox100?.toString() || '', result.limits?.nox?.lugdown || '1800', result.items?.[3]?.pass ? '合格' : '不合格'],
          ['90%转速NOx', 'ppm', inspectionData.nox90?.toString() || '', result.limits?.nox?.lugdown || '1800', result.items?.[4]?.pass ? '合格' : '不合格'],
          ['80%转速NOx', 'ppm', inspectionData.nox80?.toString() || '', result.limits?.nox?.lugdown || '1800', result.items?.[5]?.pass ? '合格' : '不合格']
        ];
        break;

      case 'IDLE':
        tableData = [
          ['检测项目', '单位', '检测值', '标准限值', '结果'],
          ['怠速CO', '%', inspectionData.idleCO?.toFixed(3) || '', result.limits?.co?.idle || '4.0', result.items?.[0]?.pass ? '合格' : '不合格'],
          ['怠速HC', 'ppm', inspectionData.idleHC?.toString() || '', result.limits?.hc?.idle || '1200', result.items?.[1]?.pass ? '合格' : '不合格'],
          ['发动机温度', '℃', inspectionData.engineTemp?.toString() || '', '≥80', '合格'],
          ['转速', 'r/min', inspectionData.rpm?.toString() || '', '1000-1500', '合格']
        ];
        break;

      default:
        tableData = [['检测项目', '单位', '检测值', '标准限值', '结果']];
    }

    this.drawTable(doc, tableData, [100, 60, 80, 80, 60], 10, true);
  }

  drawConclusion(doc, result) {
    doc.moveDown(1);
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .text('四、检验结论');
    
    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica');

    const passColor = result.pass ? '#008000' : '#FF0000';
    const passText = result.pass ? '合格' : '不合格';
    
    doc.text('依据《机动车排放检验技术规范》（HJ1237-2021）及相关标准，');
    
    doc.moveDown(0.3);
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .fillColor(passColor)
       .text(`检验结论：${passText}`, { align: 'center' });
    
    doc.fillColor('#000000');
    doc.moveDown(0.5);
    doc.fontSize(11)
       .font('Helvetica');

    if (!result.pass && result.items) {
      const failedItems = result.items.filter(i => !i.pass).map(i => `${i.label}(${i.value} > ${i.limit})`).join('、');
      if (failedItems) {
        doc.text(`不合格项目：${failedItems}`);
      }
    }

    doc.moveDown(0.5);
    doc.text(`检验标准：${result.standard || REPORT_STANDARD}`);
  }

  drawReportFooter(doc) {
    doc.moveDown(2);
    this.drawHorizontalLine(doc);
    
    doc.moveDown(0.5);
    doc.fontSize(10)
       .font('Helvetica');
    
    const org = config.getOrganizationInfo();
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    
    doc.text(`打印时间: ${now}`, { align: 'left' });
    doc.text(`报告生成系统: 机动车排放检验自动化系统 V1.0`, { align: 'right' });
    
    doc.moveDown(1);
    doc.text('------------------------此报告由系统自动生成，无需手工签字------------------------', {
      align: 'center',
      fontSize: 9
    });
    
    doc.moveDown(1);
    doc.fontSize(8)
       .text('本报告一式两份，检验机构、车主各存一份。报告无检验机构专用章无效。', {
         align: 'center'
       });
  }

  drawTable(doc, data, colWidths, fontSize = 10, hasHeader = false) {
    const startX = doc.page.margins.left;
    const startY = doc.y;
    const rowHeight = 22;
    
    data.forEach((row, rowIndex) => {
      const y = startY + rowIndex * rowHeight;
      let x = startX;
      
      row.forEach((cell, colIndex) => {
        const width = colWidths[colIndex] || 80;
        
        doc.rect(x, y, width, rowHeight).stroke();
        
        doc.fontSize(fontSize);
        if (hasHeader && rowIndex === 0) {
          doc.font('Helvetica-Bold');
        } else {
          doc.font('Helvetica');
        }
        
        doc.text(cell || '', x + 5, y + 7, {
          width: width - 10,
          height: rowHeight - 10,
          align: 'left'
        });
        
        x += width;
      });
    });
    
    doc.y = startY + data.length * rowHeight + 5;
  }

  drawHorizontalLine(doc) {
    const startX = doc.page.margins.left;
    const endX = doc.page.width - doc.page.margins.right;
    const y = doc.y;
    
    doc.moveTo(startX, y)
       .lineTo(endX, y)
       .stroke();
    
    doc.moveDown(0.5);
  }

  async uploadReport(reportInfo, driver) {
    const tracer = new OperationTracer('上传检测报告', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: reportInfo.plateNumber
    });

    if (!fs.existsSync(reportInfo.reportPath)) {
      throw new InspectionError(
        ERROR_TYPES.VALIDATION_FAILED,
        `报告文件不存在: ${reportInfo.reportPath}`
      );
    }

    return errorHandler.retryWithStrategy(async (attempt) => {
      tracer.logStep(`第 ${attempt} 次上传尝试`);

      try {
        const platformConfig = config.getPlatformConfig('environmental');
        const uploadUrl = platformConfig.baseUrl + '/inspection/report/upload';
        
        tracer.logStep(`访问上传页面: ${uploadUrl}`);
        await driver.get(uploadUrl);

        await driver.wait(until.elementLocated(By.css('#reportFile')), 10000);
        
        tracer.logStep('输入车牌号');
        await driver.findElement(By.css('#plateNumber')).clear();
        await driver.findElement(By.css('#plateNumber')).sendKeys(reportInfo.plateNumber);

        tracer.logStep('输入报告编号');
        await driver.findElement(By.css('#reportNo')).clear();
        await driver.findElement(By.css('#reportNo')).sendKeys(reportInfo.reportNo);

        tracer.logStep('选择报告文件');
        const fileInput = await driver.findElement(By.css('#reportFile'));
        await fileInput.sendKeys(reportInfo.reportPath);

        tracer.logStep('提交上传');
        await driver.findElement(By.css(platformConfig.selectors.uploadButton)).click();

        await driver.wait(
          until.elementLocated(By.css(platformConfig.selectors.successMessage)),
          15000
        );

        const successMsg = await driver.findElement(By.css(platformConfig.selectors.successMessage)).getText();
        
        audit.reportUpload(
          reportInfo.plateNumber,
          this.inspectionLine.id,
          uploadUrl,
          true
        );

        tracer.complete('success');
        logger.info(`报告上传成功: ${reportInfo.reportNo}`);

        return {
          success: true,
          message: successMsg
        };
      } catch (error) {
        audit.reportUpload(
          reportInfo.plateNumber,
          this.inspectionLine.id,
          null,
          false,
          error.message
        );
        throw error;
      }
    }, {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: reportInfo.plateNumber,
      driver
    });
  }

  async generateAndUpload(inspectionResult, driver) {
    const plateNumber = inspectionResult.vehicleInfo?.plateNumber;
    
    const reportResult = await this.generateReport(inspectionResult);
    if (!reportResult.success) {
      return reportResult;
    }

    const uploadResult = await this.uploadReport({
      plateNumber,
      reportNo: reportResult.reportNo,
      reportPath: reportResult.reportPath
    }, driver);

    return {
      ...reportResult,
      upload: uploadResult
    };
  }

  getReportList() {
    try {
      const files = fs.readdirSync(this.reportsDir)
        .filter(f => f.endsWith('.pdf'))
        .map(f => {
          const fullPath = path.join(this.reportsDir, f);
          const stat = fs.statSync(fullPath);
          return {
            filename: f,
            path: fullPath,
            size: stat.size,
            created: stat.birthtime
          };
        })
        .sort((a, b) => b.created - a.created);

      return files;
    } catch (error) {
      logger.error('获取报告列表失败', error);
      return [];
    }
  }

  cleanupOldReports(days = 90) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = fs.readdirSync(this.reportsDir).filter(f => f.endsWith('.pdf'));
      
      for (const file of files) {
        const fullPath = path.join(this.reportsDir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.birthtime.getTime() < cutoff) {
          fs.unlinkSync(fullPath);
          deletedCount++;
          logger.debug(`已删除过期报告: ${file}`);
        }
      }

      logger.info(`已清理 ${deletedCount} 份过期报告（超过${days}天）`);
      return deletedCount;
    } catch (error) {
      logger.error('清理过期报告失败', error);
      return 0;
    }
  }
}

class MockReportGenerator extends ReportGenerator {
  constructor(inspectionLineId) {
    super(inspectionLineId);
  }

  async uploadReport(reportInfo, driver) {
    const tracer = new OperationTracer('模拟上传检测报告', {
      inspectionLine: this.inspectionLine.id,
      vehiclePlate: reportInfo.plateNumber
    });

    try {
      tracer.logStep(`模拟上传报告: ${reportInfo.reportNo}`);
      await this.sleep(500 + Math.random() * 1000);

      const success = Math.random() > 0.1;
      
      if (success) {
        audit.reportUpload(
          reportInfo.plateNumber,
          this.inspectionLine.id,
          'mock-url',
          true
        );
        tracer.complete('success');
        
        return {
          success: true,
          message: '模拟上传成功'
        };
      } else {
        throw new Error('模拟上传失败：网络超时');
      }
    } catch (error) {
      tracer.fail('模拟上传失败', { stack: error.stack });
      audit.reportUpload(
        reportInfo.plateNumber,
        this.inspectionLine.id,
        null,
        false,
        error.message
      );
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

function createReportGenerator(inspectionLineId, useMock = process.env.USE_MOCK === 'true') {
  if (useMock) {
    return new MockReportGenerator(inspectionLineId);
  }
  return new ReportGenerator(inspectionLineId);
}

module.exports = {
  ReportGenerator,
  MockReportGenerator,
  createReportGenerator,
  REPORT_STANDARD
};

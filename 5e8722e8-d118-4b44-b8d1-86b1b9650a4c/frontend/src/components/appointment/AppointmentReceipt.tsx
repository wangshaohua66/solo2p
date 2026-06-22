import React from 'react'
import dayjs from 'dayjs'
import './AppointmentReceipt.scss'

export interface AppointmentReceiptData {
  id: number | string
  patientName: string
  patientPhone: string
  patientIdCard?: string
  doctorName: string
  doctorTitle: string
  department: string
  clinicName: string
  clinicAddress: string
  clinicPhone?: string
  appointmentDate: string
  timeSlot: string
  appointmentType: string
  symptom?: string
  queueNumber?: number
  createdAt?: string
}

interface AppointmentReceiptProps {
  data: AppointmentReceiptData
  showPrint?: boolean
}

const AppointmentReceipt: React.FC<AppointmentReceiptProps> = ({ data, showPrint = true }) => {
  const handlePrint = () => {
    window.print()
  }

  const handleDownload = () => {
    const printContent = document.getElementById('appointment-receipt')
    if (!printContent) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('请允许弹出窗口以下载PDF')
      return
    }

    const styles = Array.from(document.styleSheets)
      .map(() => '')
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>预约单-${data.patientName}-${data.appointmentDate}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #fff;
            padding: 30px;
            color: #333;
          }
          .receipt-container {
            max-width: 600px;
            margin: 0 auto;
            border: 1px solid #e8e8e8;
            padding: 30px;
            background: #fff;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 2px solid #1890ff;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .receipt-title {
            font-size: 22px;
            font-weight: bold;
            color: #1890ff;
            margin-bottom: 8px;
          }
          .receipt-subtitle {
            font-size: 13px;
            color: #8c8c8c;
          }
          .receipt-section {
            margin-bottom: 16px;
          }
          .section-title {
            font-size: 15px;
            font-weight: 600;
            color: #262626;
            margin-bottom: 10px;
            padding-left: 8px;
            border-left: 3px solid #1890ff;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px 20px;
          }
          .info-item {
            display: flex;
            font-size: 13px;
            line-height: 1.8;
          }
          .info-label {
            color: #8c8c8c;
            min-width: 70px;
            flex-shrink: 0;
          }
          .info-value {
            color: #262626;
            word-break: break-all;
          }
          .highlight-box {
            background: #e6f7ff;
            border: 1px solid #91d5ff;
            border-radius: 4px;
            padding: 12px;
            text-align: center;
            margin: 16px 0;
          }
          .highlight-text {
            font-size: 18px;
            font-weight: bold;
            color: #1890ff;
          }
          .highlight-sub {
            font-size: 12px;
            color: #595959;
            margin-top: 4px;
          }
          .receipt-footer {
            margin-top: 30px;
            padding-top: 16px;
            border-top: 1px dashed #d9d9d9;
            font-size: 12px;
            color: #8c8c8c;
            text-align: center;
            line-height: 1.8;
          }
          .receipt-id {
            font-size: 11px;
            color: #bfbfbf;
            margin-top: 8px;
          }
          @media print {
            body { padding: 0; }
            .receipt-container { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="receipt-header">
            <div class="receipt-title">口腔医疗集团</div>
            <div class="receipt-subtitle">电子预约单</div>
          </div>
          
          <div class="receipt-section">
            <div class="section-title">预约信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">预约科室：</span>
                <span class="info-value">${data.department}</span>
              </div>
              <div class="info-item">
                <span class="info-label">预约类型：</span>
                <span class="info-value">${data.appointmentType}</span>
              </div>
              <div class="info-item">
                <span class="info-label">就诊日期：</span>
                <span class="info-value">${data.appointmentDate}</span>
              </div>
              <div class="info-item">
                <span class="info-label">就诊时段：</span>
                <span class="info-value">${data.timeSlot}</span>
              </div>
            </div>
          </div>

          ${data.queueNumber ? `
          <div class="highlight-box">
            <div class="highlight-text">排队号：${String(data.queueNumber).padStart(3, '0')}</div>
            <div class="highlight-sub">请按时就诊，过号作废</div>
          </div>
          ` : ''}

          <div class="receipt-section">
            <div class="section-title">医生信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">医生姓名：</span>
                <span class="info-value">${data.doctorName} ${data.doctorTitle}</span>
              </div>
              <div class="info-item">
                <span class="info-label">所属门诊：</span>
                <span class="info-value">${data.clinicName}</span>
              </div>
            </div>
            <div class="info-item" style="margin-top: 8px;">
              <span class="info-label">门诊地址：</span>
              <span class="info-value">${data.clinicAddress}</span>
            </div>
          </div>

          <div class="receipt-section">
            <div class="section-title">患者信息</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">患者姓名：</span>
                <span class="info-value">${data.patientName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">联系电话：</span>
                <span class="info-value">${data.patientPhone}</span>
              </div>
              ${data.patientIdCard ? `
              <div class="info-item">
                <span class="info-label">身份证号：</span>
                <span class="info-value">${data.patientIdCard}</span>
              </div>
              ` : ''}
            </div>
            ${data.symptom ? `
            <div class="info-item" style="margin-top: 8px;">
              <span class="info-label">主诉症状：</span>
              <span class="info-value">${data.symptom}</span>
            </div>
            ` : ''}
          </div>

          <div class="receipt-footer">
            <p>请您在预约时间前15分钟到达门诊取号</p>
            <p>如需取消预约，请提前24小时操作</p>
            ${data.clinicPhone ? `<p>咨询电话：${data.clinicPhone}</p>` : ''}
            <div class="receipt-id">预约单号：${data.id} · 生成时间：${data.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss')}</div>
          </div>
        </div>
      </body>
      </html>
    `)

    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
    }, 200)
  }

  return (
    <div id="appointment-receipt" className="appointment-receipt">
      <div className="receipt-container">
        <div className="receipt-header">
          <div className="receipt-title">口腔医疗集团</div>
          <div className="receipt-subtitle">电子预约单</div>
        </div>
        
        <div className="receipt-section">
          <div className="section-title">预约信息</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">预约科室：</span>
              <span className="info-value">{data.department}</span>
            </div>
            <div className="info-item">
              <span className="info-label">预约类型：</span>
              <span className="info-value">{data.appointmentType}</span>
            </div>
            <div className="info-item">
              <span className="info-label">就诊日期：</span>
              <span className="info-value">{data.appointmentDate}</span>
            </div>
            <div className="info-item">
              <span className="info-label">就诊时段：</span>
              <span className="info-value">{data.timeSlot}</span>
            </div>
          </div>
        </div>

        {data.queueNumber && (
          <div className="highlight-box">
            <div className="highlight-text">排队号：{String(data.queueNumber).padStart(3, '0')}</div>
            <div className="highlight-sub">请按时就诊，过号作废</div>
          </div>
        )}

        <div className="receipt-section">
          <div className="section-title">医生信息</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">医生姓名：</span>
              <span className="info-value">{data.doctorName} {data.doctorTitle}</span>
            </div>
            <div className="info-item">
              <span className="info-label">所属门诊：</span>
              <span className="info-value">{data.clinicName}</span>
            </div>
          </div>
          <div className="info-item" style={{ marginTop: 8 }}>
            <span className="info-label">门诊地址：</span>
            <span className="info-value">{data.clinicAddress}</span>
          </div>
        </div>

        <div className="receipt-section">
          <div className="section-title">患者信息</div>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">患者姓名：</span>
              <span className="info-value">{data.patientName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">联系电话：</span>
              <span className="info-value">{data.patientPhone}</span>
            </div>
            {data.patientIdCard && (
              <div className="info-item">
                <span className="info-label">身份证号：</span>
                <span className="info-value">{data.patientIdCard}</span>
              </div>
            )}
          </div>
          {data.symptom && (
            <div className="info-item" style={{ marginTop: 8 }}>
              <span className="info-label">主诉症状：</span>
              <span className="info-value">{data.symptom}</span>
            </div>
          )}
        </div>

        <div className="receipt-footer">
          <p>请您在预约时间前15分钟到达门诊取号</p>
          <p>如需取消预约，请提前24小时操作</p>
          {data.clinicPhone && <p>咨询电话：{data.clinicPhone}</p>}
          <div className="receipt-id">
            预约单号：{data.id} · 生成时间：{data.createdAt || dayjs().format('YYYY-MM-DD HH:mm:ss')}
          </div>
        </div>
      </div>

      {showPrint && (
        <div className="receipt-actions">
          <button className="btn-print" onClick={handlePrint}>
            打印
          </button>
          <button className="btn-download" onClick={handleDownload}>
            下载PDF
          </button>
        </div>
      )}
    </div>
  )
}

export default AppointmentReceipt

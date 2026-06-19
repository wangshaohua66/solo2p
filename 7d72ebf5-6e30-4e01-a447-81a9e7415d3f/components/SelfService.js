class SelfService extends BaseComponent {
  constructor() {
    super();
    this.state = {
      currentStep: 0,
      steps: [
        { id: 'auth', name: '身份认证', icon: 'fas fa-id-card' },
        { id: 'select', name: '选择业务', icon: 'fas fa-list-ul' },
        { id: 'upload', name: '材料上传', icon: 'fas fa-cloud-upload-alt' },
        { id: 'confirm', name: '信息确认', icon: 'fas fa-check-square' },
        { id: 'signature', name: '电子签名', icon: 'fas fa-pen' },
        { id: 'complete', name: '办理完成', icon: 'fas fa-check-circle' }
      ],
      idCard: '',
      selectedItem: null,
      uploadedMaterials: [],
      confirmed: false,
      signatureData: null,
      receiptCode: '',
      scanning: false
    };
    this._canvasHandlers = null;
  }

  init() {}

  canProceed() {
    const { currentStep, idCard, selectedItem, uploadedMaterials, confirmed, signatureData } = this.state;

    switch (currentStep) {
      case 0:
        return /^\d{17}[\dXx]$/.test(idCard);
      case 1:
        return selectedItem !== null;
      case 2:
        return uploadedMaterials.length > 0;
      case 3:
        return confirmed;
      case 4:
        return signatureData !== null;
      default:
        return true;
    }
  }

  handleCardReaderClick() {
    if (this.state.scanning) return;
    this.setState({ scanning: true });
    this.setTimeout(() => {
      const mockIdCard = '110101199001011234';
      this.setState({ scanning: false, idCard: mockIdCard });
    }, 2000);
  }

  handleIdCardInput(e) {
    this.state.idCard = e.target.value;
    const nextBtn = this.query('#nextBtn');
    if (nextBtn) {
      nextBtn.disabled = !this.canProceed();
    }
  }

  handleServiceItemClick(itemId) {
    const selectedItem = MockData.serviceItems.find(i => i.id === itemId);
    this.setState({ selectedItem });
  }

  handleUploadClick() {
    const materials = MockData.materials[this.state.selectedItem?.id] || [];
    if (materials.length > 0) {
      const randomMaterial = materials[Math.floor(Math.random() * materials.length)];
      const newMaterials = [...this.state.uploadedMaterials, {
        id: 'mat-' + Date.now(),
        name: randomMaterial.name,
        size: `${(Math.random() * 2 + 0.5).toFixed(1)} MB`
      }];
      this.setState({ uploadedMaterials: newMaterials });
    }
  }

  handleUploadDragOver(e) {
    e.preventDefault();
    const uploadArea = this.query('#uploadArea');
    if (uploadArea) uploadArea.classList.add('drag-over');
  }

  handleUploadDragLeave() {
    const uploadArea = this.query('#uploadArea');
    if (uploadArea) uploadArea.classList.remove('drag-over');
  }

  handleUploadDrop(e) {
    e.preventDefault();
    const uploadArea = this.query('#uploadArea');
    if (uploadArea) uploadArea.classList.remove('drag-over');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const newMaterials = [...this.state.uploadedMaterials];
      Array.from(files).forEach(file => {
        newMaterials.push({
          id: 'mat-' + Date.now(),
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(1)} MB`
        });
      });
      this.setState({ uploadedMaterials: newMaterials });
    }
  }

  handleDeleteMaterial(index) {
    const newMaterials = [...this.state.uploadedMaterials];
    newMaterials.splice(index, 1);
    this.setState({ uploadedMaterials: newMaterials });
  }

  handleConfirmCheckbox() {
    this.setState({ confirmed: !this.state.confirmed });
  }

  handleClearSignature() {
    const canvas = this.query('#signatureCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.state.signatureData = null;
      const confirmBtn = this.query('#confirmSignatureBtn');
      if (confirmBtn) confirmBtn.disabled = true;
    }
  }

  handleConfirmSignature() {
    if (this.state.signatureData) {
      this.handleNextStep();
    }
  }

  setupCanvas() {
    const canvas = this.query('#signatureCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    ctx.strokeStyle = '#1a202c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDrawing = (e) => {
      e.preventDefault();
      isDrawing = true;
      const pos = getPos(e);
      lastX = pos.x;
      lastY = pos.y;
    };

    const draw = (e) => {
      if (!isDrawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastX = pos.x;
      lastY = pos.y;
      this.state.signatureData = canvas.toDataURL();
      const confirmBtn = this.query('#confirmSignatureBtn');
      if (confirmBtn) confirmBtn.disabled = false;
    };

    const stopDrawing = () => {
      isDrawing = false;
    };

    this._canvasHandlers = { startDrawing, draw, stopDrawing };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
  }

  handlePrevStep() {
    if (this.state.currentStep > 0) {
      this.setState({ currentStep: this.state.currentStep - 1 });
    }
  }

  handleNextStep() {
    if (this.state.currentStep < this.state.steps.length - 1 && this.canProceed()) {
      const newState = { currentStep: this.state.currentStep + 1 };
      if (this.state.currentStep === 4) {
        newState.receiptCode = 'SL' + Date.now().toString().slice(-8);
      }
      this.setState(newState);
    }
  }

  handlePrintReceipt() {
    alert('正在打印凭证...');
  }

  handleRestart() {
    this.setState({
      currentStep: 0,
      idCard: '',
      selectedItem: null,
      uploadedMaterials: [],
      confirmed: false,
      signatureData: null,
      receiptCode: '',
      scanning: false
    });
  }

  renderStepContent() {
    const step = this.state.currentStep;
    const { steps, idCard, selectedItem, uploadedMaterials, confirmed, receiptCode, scanning } = this.state;
    const currentStepData = steps[step];

    switch (step) {
      case 0:
        return `
          <div class="card">
            <h2 class="card-title">${this.escapeHtml(currentStepData.name)}</h2>
            <p class="card-desc"><i class="${currentStepData.icon}"></i> 请将身份证放置在读卡区，或手动输入身份证号码</p>
            
            <div class="id-card-reader ${scanning ? 'scanning' : ''}" id="cardReader" 
                 onclick="this.getRootNode().host.handleCardReaderClick()">
              <i class="${currentStepData.icon} id-card-icon"></i>
              <span class="id-card-text">${scanning ? '正在读取...' : '请放置身份证'}</span>
            </div>

            <div class="divider"><span>或</span></div>

            <div class="form-group">
              <label class="form-label">身份证号码</label>
              <input type="text" class="form-input" id="idCardInput" 
                     placeholder="请输入18位身份证号码" 
                     value="${this.escapeHtml(idCard)}" maxlength="18"
                     oninput="this.getRootNode().host.handleIdCardInput(event)">
            </div>
          </div>
        `;

      case 1:
        const services = MockData.serviceItems.slice(0, 6);
        return `
          <div class="card">
            <h2 class="card-title">${this.escapeHtml(currentStepData.name)}</h2>
            <p class="card-desc"><i class="${currentStepData.icon}"></i> 请选择您需要办理的业务事项</p>
            
            <div class="service-grid">
              ${services.map(item => {
                const category = MockData.categories.find(c => c.id === item.category);
                return `
                  <div class="service-item ${selectedItem?.id === item.id ? 'selected' : ''}" 
                       onclick="this.getRootNode().host.handleServiceItemClick('${item.id}')">
                    <i class="service-icon fas ${category?.icon || 'fa-file-alt'}"></i>
                    <div class="service-name">${this.escapeHtml(item.name)}</div>
                    <div class="service-desc">约${item.estimatedTime}分钟</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;

      case 2:
        const materials = MockData.materials[selectedItem?.id] || [];
        return `
          <div class="card">
            <h2 class="card-title">${this.escapeHtml(currentStepData.name)}</h2>
            <p class="card-desc"><i class="${currentStepData.icon}"></i> 请上传办理${this.escapeHtml(selectedItem?.name || '业务')}所需的材料</p>
            
            <div class="upload-area" id="uploadArea"
                 onclick="this.getRootNode().host.handleUploadClick()"
                 ondragover="this.getRootNode().host.handleUploadDragOver(event)"
                 ondragleave="this.getRootNode().host.handleUploadDragLeave()"
                 ondrop="this.getRootNode().host.handleUploadDrop(event)">
              <i class="fas fa-cloud-upload-alt upload-icon"></i>
              <div class="upload-text">点击或拖拽材料到此处上传</div>
              <div class="upload-hint">支持 PDF、JPG、PNG 格式</div>
            </div>

            <div class="material-list">
              ${uploadedMaterials.length === 0 ? `
                <div style="text-align: center; padding: 30px; color: #a0aec0;">
                  暂无上传材料
                </div>
              ` : uploadedMaterials.map((mat, index) => `
                <div class="material-item">
                  <div class="material-info">
                    <i class="fas fa-file-check material-icon"></i>
                    <div>
                      <div class="material-name">${this.escapeHtml(mat.name)}</div>
                      <div class="material-size">${this.escapeHtml(mat.size)}</div>
                    </div>
                  </div>
                  <button class="btn-delete" 
                          onclick="this.getRootNode().host.handleDeleteMaterial(${index})">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              `).join('')}
            </div>

            <div style="background: #f7fafc; padding: 16px; border-radius: 8px;">
              <div style="font-size: 14px; color: #4a5568; margin-bottom: 8px;">
                <strong>所需材料清单：</strong>
              </div>
              ${materials.map(m => `
                <div style="font-size: 14px; color: #718096; padding: 4px 0;">
                  ${m.required ? '<span style="color: #e53e3e;">*</span>' : ''} ${this.escapeHtml(m.name)}
                </div>
              `).join('')}
            </div>
          </div>
        `;

      case 3:
        const maskedIdCard = idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
        return `
          <div class="card">
            <h2 class="card-title">${this.escapeHtml(currentStepData.name)}</h2>
            <p class="card-desc"><i class="${currentStepData.icon}"></i> 请仔细核对以下信息是否准确无误</p>
            
            <div class="summary-section">
              <div class="summary-row">
                <span class="summary-label">业务事项</span>
                <span class="summary-value">${this.escapeHtml(selectedItem?.name || '-')}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">身份证号</span>
                <span class="summary-value">${this.escapeHtml(maskedIdCard)}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">已上传材料</span>
                <span class="summary-value">${uploadedMaterials.length} 份</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">预计办理时间</span>
                <span class="summary-value">${selectedItem?.estimatedTime || 15} 分钟</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">申请时间</span>
                <span class="summary-value">${new Date().toLocaleString('zh-CN')}</span>
              </div>
            </div>

            <div class="checkbox-group ${confirmed ? 'checked' : ''}" id="confirmCheckbox"
                 onclick="this.getRootNode().host.handleConfirmCheckbox()">
              <div class="checkbox">
                ${confirmed ? '<i class="fas fa-check"></i>' : ''}
              </div>
              <div class="checkbox-label">
                我已仔细核对以上信息，确认所填内容真实有效，如有虚假愿承担相应法律责任。
              </div>
            </div>
          </div>
        `;

      case 4:
        return `
          <div class="card">
            <h2 class="card-title">${this.escapeHtml(currentStepData.name)}</h2>
            <p class="card-desc"><i class="${currentStepData.icon}"></i> 请在下方区域进行电子签名确认</p>
            
            <div class="signature-container">
              <canvas class="signature-canvas" id="signatureCanvas"></canvas>
            </div>

            <div class="signature-actions">
              <button class="btn btn-warning" id="clearSignatureBtn"
                      onclick="this.getRootNode().host.handleClearSignature()">
                清除签名
              </button>
              <button class="btn btn-success" id="confirmSignatureBtn" 
                      ${!this.state.signatureData ? 'disabled' : ''}
                      onclick="this.getRootNode().host.handleConfirmSignature()">
                确认签名
              </button>
            </div>
          </div>
        `;

      case 5:
        const maskedIdCardComplete = idCard.replace(/(\d{6})\d{8}(\d{4})/, '$1********$2');
        return `
          <div class="card">
            <div class="success-container">
              <div class="success-icon">
                <i class="fas fa-check"></i>
              </div>
              <h2 class="success-title">办理完成</h2>
              <p class="success-desc">您的${this.escapeHtml(selectedItem?.name || '业务')}申请已提交成功</p>
            </div>

            <div class="receipt-preview">
              <div class="receipt-title">办理凭证</div>
              <div class="receipt-row">
                <span class="receipt-label">业务名称</span>
                <span class="receipt-value">${this.escapeHtml(selectedItem?.name || '-')}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">申请人</span>
                <span class="receipt-value">${this.escapeHtml(maskedIdCardComplete)}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">申请时间</span>
                <span class="receipt-value">${new Date().toLocaleString('zh-CN')}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">办理状态</span>
                <span class="receipt-value" style="color: #48bb78;">已提交</span>
              </div>
              <div class="receipt-code">
                <div class="receipt-code-label">取件凭证码</div>
                <div class="receipt-code-value">${receiptCode || 'SL' + Date.now().toString().slice(-8)}</div>
              </div>
            </div>
          </div>
        `;

      default:
        return '';
    }
  }

  getStyles() {
    return `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :host {
          display: block;
          width: 100%;
          height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow: hidden;
        }

        .container {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-width: 720px;
          margin: 0 auto;
          background: #f5f7fa;
        }

        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 40px 30px 20px;
          text-align: center;
        }

        .header h1 {
          font-size: 36px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .step-indicator {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 10px;
          position: relative;
        }

        .step-indicator::before {
          content: '';
          position: absolute;
          top: 24px;
          left: 40px;
          right: 40px;
          height: 4px;
          background: rgba(255, 255, 255, 0.3);
          z-index: 0;
        }

        .step-progress {
          position: absolute;
          top: 24px;
          left: 40px;
          height: 4px;
          background: #4ade80;
          z-index: 1;
          transition: width 0.5s ease;
          width: ${this.state.currentStep * 20}%;
        }

        .step-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2;
          position: relative;
        }

        .step-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          margin-bottom: 8px;
          transition: all 0.3s ease;
        }

        .step-item.active .step-circle {
          background: #4ade80;
          transform: scale(1.1);
          box-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
        }

        .step-item.completed .step-circle {
          background: #4ade80;
        }

        .step-name {
          font-size: 12px;
          white-space: nowrap;
        }

        .content {
          flex: 1;
          padding: 30px;
          overflow-y: auto;
          background: #f5f7fa;
        }

        .step-content {
          animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .card {
          background: white;
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .card-title {
          font-size: 28px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 10px;
          text-align: center;
        }

        .card-desc {
          font-size: 16px;
          color: #718096;
          text-align: center;
          margin-bottom: 30px;
        }

        .id-card-reader {
          width: 280px;
          height: 180px;
          margin: 0 auto 30px;
          background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%);
          border-radius: 16px;
          border: 4px dashed #a0aec0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .id-card-reader:hover {
          border-color: #667eea;
          background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%);
        }

        .id-card-reader.scanning::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, transparent, #667eea, transparent);
          animation: scan 1.5s linear infinite;
        }

        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }

        .id-card-icon {
          font-size: 64px;
          color: #667eea;
          margin-bottom: 10px;
        }

        .id-card-text {
          font-size: 18px;
          color: #4a5568;
        }

        .divider {
          display: flex;
          align-items: center;
          margin: 30px 0;
          color: #a0aec0;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .divider span {
          padding: 0 20px;
          font-size: 16px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 18px;
          color: #2d3748;
          margin-bottom: 10px;
          font-weight: 500;
        }

        .form-input {
          width: 100%;
          padding: 20px 24px;
          font-size: 20px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          transition: all 0.3s ease;
          outline: none;
        }

        .form-input:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .service-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .service-item {
          background: white;
          border: 3px solid #e2e8f0;
          border-radius: 16px;
          padding: 30px 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .service-item:hover,
        .service-item.selected {
          border-color: #667eea;
          background: #f0f4ff;
          transform: translateY(-4px);
          box-shadow: 0 8px 25px rgba(102, 126, 234, 0.2);
        }

        .service-icon {
          font-size: 48px;
          color: #667eea;
          margin-bottom: 15px;
        }

        .service-name {
          font-size: 18px;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .service-desc {
          font-size: 14px;
          color: #718096;
        }

        .upload-area {
          border: 4px dashed #cbd5e0;
          border-radius: 16px;
          padding: 60px 30px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 30px;
          background: white;
        }

        .upload-area:hover,
        .upload-area.drag-over {
          border-color: #667eea;
          background: #f0f4ff;
        }

        .upload-icon {
          font-size: 72px;
          color: #a0aec0;
          margin-bottom: 15px;
        }

        .upload-text {
          font-size: 20px;
          color: #4a5568;
          font-weight: 500;
        }

        .upload-hint {
          font-size: 16px;
          color: #a0aec0;
          margin-top: 8px;
        }

        .material-list {
          margin-bottom: 20px;
        }

        .material-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .material-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .material-icon {
          font-size: 32px;
          color: #48bb78;
        }

        .material-name {
          font-size: 18px;
          color: #2d3748;
          font-weight: 500;
        }

        .material-size {
          font-size: 14px;
          color: #a0aec0;
        }

        .btn-delete {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: #fed7d7;
          color: #c53030;
          font-size: 24px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-delete:hover {
          background: #fc8181;
          color: white;
        }

        .summary-section {
          background: #f7fafc;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .summary-row:last-child {
          border-bottom: none;
        }

        .summary-label {
          font-size: 16px;
          color: #718096;
        }

        .summary-value {
          font-size: 16px;
          color: #2d3748;
          font-weight: 500;
        }

        .checkbox-group {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 20px;
          background: #f0fff4;
          border: 2px solid #9ae6b4;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .checkbox-group:hover {
          background: #c6f6d5;
        }

        .checkbox {
          width: 32px;
          height: 32px;
          border: 3px solid #48bb78;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: #48bb78;
          flex-shrink: 0;
          background: white;
        }

        .checkbox-group.checked .checkbox {
          background: #48bb78;
          color: white;
        }

        .checkbox-label {
          font-size: 18px;
          color: #2d3748;
          line-height: 1.5;
        }

        .signature-container {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .signature-canvas {
          width: 100%;
          height: 300px;
          border: 3px solid #e2e8f0;
          border-radius: 12px;
          background: #fafafa;
          cursor: crosshair;
          touch-action: none;
        }

        .signature-actions {
          display: flex;
          gap: 16px;
          margin-top: 20px;
        }

        .success-container {
          text-align: center;
          padding: 30px 0;
        }

        .success-icon {
          width: 140px;
          height: 140px;
          margin: 0 auto 30px;
          background: #48bb78;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: scaleIn 0.6s ease;
        }

        @keyframes scaleIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }

        .success-icon i {
          font-size: 80px;
          color: white;
        }

        .success-title {
          font-size: 36px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 16px;
        }

        .success-desc {
          font-size: 20px;
          color: #718096;
          margin-bottom: 40px;
        }

        .receipt-preview {
          background: white;
          border-radius: 16px;
          padding: 30px;
          text-align: left;
          margin-bottom: 30px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .receipt-title {
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          color: #1a202c;
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 2px dashed #e2e8f0;
        }

        .receipt-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          font-size: 16px;
        }

        .receipt-label {
          color: #718096;
        }

        .receipt-value {
          color: #2d3748;
          font-weight: 500;
        }

        .receipt-code {
          text-align: center;
          padding: 20px;
          background: #f7fafc;
          border-radius: 8px;
          margin-top: 20px;
        }

        .receipt-code-label {
          font-size: 14px;
          color: #718096;
          margin-bottom: 8px;
        }

        .receipt-code-value {
          font-size: 28px;
          font-weight: 700;
          color: #667eea;
          letter-spacing: 4px;
        }

        .footer {
          padding: 24px 30px;
          background: white;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 16px;
        }

        .btn {
          flex: 1;
          padding: 22px;
          font-size: 20px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #e2e8f0;
          color: #4a5568;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #cbd5e0;
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
        }

        .btn-success {
          background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(72, 187, 120, 0.4);
        }

        .btn-warning {
          background: #fed7d7;
          color: #c53030;
          flex: 0 0 auto;
          width: 140px;
        }

        .btn-warning:hover:not(:disabled) {
          background: #fc8181;
          color: white;
        }
      </style>
    `;
  }

  render() {
    const { currentStep, steps } = this.state;

    this.shadowRoot.innerHTML = this.getStyles() + `
      <div class="container">
        <div class="header">
          <h1>政务服务自助终端</h1>
          <div class="step-indicator">
            <div class="step-progress"></div>
            ${steps.map((step, index) => `
              <div class="step-item ${index < currentStep ? 'completed' : ''} ${index === currentStep ? 'active' : ''}">
                <div class="step-circle">
                  <i class="${step.icon}"></i>
                </div>
                <span class="step-name">${this.escapeHtml(step.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="content">
          <div class="step-content">
            ${this.renderStepContent()}
          </div>
        </div>
        <div class="footer">
          ${currentStep > 0 ? `
            <button class="btn btn-secondary" id="prevBtn"
                    onclick="this.getRootNode().host.handlePrevStep()">
              上一步
            </button>
          ` : ''}
          ${currentStep < steps.length - 1 ? `
            <button class="btn btn-primary" id="nextBtn" 
                    ${!this.canProceed() ? 'disabled' : ''}
                    onclick="this.getRootNode().host.handleNextStep()">
              下一步
            </button>
          ` : `
            <button class="btn btn-primary" id="printBtn"
                    onclick="this.getRootNode().host.handlePrintReceipt()">
              打印凭证
            </button>
            <button class="btn btn-secondary" id="restartBtn"
                    onclick="this.getRootNode().host.handleRestart()">
              返回首页
            </button>
          `}
        </div>
      </div>
    `;

    if (currentStep === 4) {
      this.setupCanvas();
    }
  }

  destroy() {
    super.destroy();
    const canvas = this.query('#signatureCanvas');
    if (canvas && this._canvasHandlers) {
      const { startDrawing, draw, stopDrawing } = this._canvasHandlers;
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    }
  }
}

customElements.define('self-service', SelfService);

class SmartGuide extends BaseComponent {
  constructor() {
    super();
    this.searchResults = [];
    this.selectedItem = null;
    this.materials = [];
    this.hotTags = ['身份证办理', '社保卡申领', '营业执照办理', '公积金提取', '户口迁移'];
    this._unsubscribes = [];
    this._searchDebounce = null;
    this.currentTemplate = null;
    this.templateLoading = false;
  }

  init() {
    this._unsubscribes.push(
      this.on('material:checked', this._onMaterialChecked.bind(this))
    );
    this._unsubscribes.push(
      this.on('search:query', this._onSearchQuery.bind(this))
    );
  }

  render() {
    this.shadowRoot.innerHTML = this._getTemplate();
    this._bindEvents();
    if (this.currentTemplate) {
      this._bindTemplateModalEvents();
    }
  }

  _getTemplate() {
    const checkedCount = this.materials.filter(m => m.checked).length;
    const totalCount = this.materials.length;
    const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

    return `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #333;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          padding: 24px;
        }
        .guide-header {
          text-align: center;
          margin-bottom: 24px;
        }
        .guide-header h2 {
          margin: 0 0 8px 0;
          font-size: 20px;
          color: #1a73e8;
        }
        .guide-header p {
          margin: 0;
          color: #666;
          font-size: 14px;
        }
        .search-section {
          margin-bottom: 20px;
        }
        .search-input-wrapper {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .search-input {
          flex: 1;
          padding: 14px 16px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 16px;
          transition: border-color 0.2s;
          outline: none;
        }
        .search-input:focus {
          border-color: #1a73e8;
        }
        .search-btn {
          padding: 14px 32px;
          background: #1a73e8;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .search-btn:hover {
          background: #1557b0;
        }
        .hot-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tag {
          padding: 6px 14px;
          background: #f0f7ff;
          color: #1a73e8;
          border-radius: 16px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tag:hover {
          background: #e0efff;
        }
        .results-section {
          margin-top: 24px;
        }
        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: #333;
        }
        .item-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        .item-card {
          padding: 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          background: #fff;
        }
        .item-card:hover {
          border-color: #1a73e8;
          box-shadow: 0 2px 8px rgba(26,115,232,0.15);
        }
        .item-card.selected {
          border-color: #1a73e8;
          background: #f0f7ff;
        }
        .item-name {
          font-size: 15px;
          font-weight: 600;
          margin-bottom: 6px;
          color: #333;
        }
        .item-desc {
          font-size: 13px;
          color: #666;
          margin-bottom: 8px;
          line-height: 1.4;
        }
        .item-time {
          font-size: 12px;
          color: #1a73e8;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .materials-section {
          margin-top: 24px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .materials-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .progress-bar {
          flex: 1;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          margin: 0 16px;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #34a853, #1a73e8);
          transition: width 0.3s;
        }
        .progress-text {
          font-size: 13px;
          color: #666;
          min-width: 80px;
          text-align: right;
        }
        .material-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .material-item {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background: #fff;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
        }
        .material-checkbox {
          width: 20px;
          height: 20px;
          margin-right: 12px;
          cursor: pointer;
        }
        .material-name {
          flex: 1;
          font-size: 14px;
        }
        .required-badge {
          padding: 2px 8px;
          background: #ffebee;
          color: #d32f2f;
          font-size: 12px;
          border-radius: 4px;
          margin-right: 12px;
        }
        .optional-badge {
          padding: 2px 8px;
          background: #f5f5f5;
          color: #757575;
          font-size: 12px;
          border-radius: 4px;
          margin-right: 12px;
        }
        .template-btn {
          padding: 6px 12px;
          background: #e8f0fe;
          color: #1a73e8;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .template-btn:hover {
          background: #d2e3fc;
        }
        .template-btn:disabled {
          background: #f5f5f5;
          color: #9e9e9e;
          cursor: not-allowed;
        }
        .appointment-btn {
          width: 100%;
          margin-top: 20px;
          padding: 14px;
          background: linear-gradient(90deg, #1a73e8, #34a853);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .appointment-btn:hover {
          opacity: 0.9;
        }
        .appointment-btn:disabled {
          background: #e0e0e0;
          cursor: not-allowed;
        }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #9e9e9e;
        }
        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .loading {
          text-align: center;
          padding: 20px;
          color: #1a73e8;
        }
        .hidden {
          display: none;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }
        .modal {
          background: #fff;
          border-radius: 12px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          animation: modalFadeIn 0.25s ease;
        }
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e8e8e8;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .modal-title {
          margin: 0 0 6px 0;
          font-size: 20px;
          color: #1a73e8;
        }
        .template-meta {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #666;
        }
        .meta-item i {
          margin-right: 4px;
          color: #1a73e8;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 28px;
          color: #999;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          transition: color 0.2s;
        }
        .modal-close:hover { color: #333; }
        .modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }
        .template-body {
          background: #f5f7fa;
        }
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e8e8e8;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }
        .btn {
          padding: 10px 24px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
          font-weight: 500;
        }
        .btn-primary {
          background: #1a73e8;
          color: #fff;
        }
        .btn-primary:hover { background: #1557b0; }
        .btn-outline {
          background: #fff;
          color: #666;
          border: 1px solid #d9d9d9;
        }
        .btn-outline:hover {
          color: #1a73e8;
          border-color: #1a73e8;
        }
        .loading-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 24px;
          color: #1a73e8;
          font-size: 16px;
        }
        .loading-indicator i { font-size: 24px; }
        .template-preview-card {
          background: #fff;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          overflow: hidden;
        }
        .template-header {
          background: linear-gradient(135deg, #1a73e8, #34a853);
          color: #fff;
          padding: 24px;
          text-align: center;
        }
        .template-title {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .template-subtitle {
          font-size: 13px;
          opacity: 0.9;
        }
        .template-form {
          padding: 24px;
        }
        .form-row {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }
        .form-field {
          margin-bottom: 16px;
        }
        .form-half { flex: 1; min-width: 0; }
        .form-full { width: 100%; }
        .field-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #333;
          margin-bottom: 6px;
        }
        .required-star { color: #d32f2f; margin-right: 2px; }
        .field-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          font-size: 14px;
          background: #fafafa;
          color: #333;
          box-sizing: border-box;
          font-family: inherit;
        }
        .field-input:disabled {
          cursor: default;
          background: #f5f5f5;
        }
        .field-textarea {
          min-height: 60px;
          resize: vertical;
        }
        .radio-group {
          display: flex;
          gap: 20px;
          padding-top: 6px;
        }
        .radio-item {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .signature-box {
          border: 1px dashed #bbb;
          border-radius: 4px;
          padding: 24px;
          background: #fafafa;
          min-height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .signature-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #999;
          font-size: 14px;
        }
        .signature-placeholder i { font-size: 28px; }
        .template-notices {
          padding: 20px 24px;
          background: #fffbe6;
          border-top: 1px solid #ffe58f;
        }
        .notices-title {
          font-weight: 600;
          color: #d48806;
          margin-bottom: 10px;
          font-size: 14px;
        }
        .template-notices ul {
          margin: 0;
          padding-left: 20px;
        }
        .template-notices li {
          color: #666;
          font-size: 13px;
          line-height: 1.8;
        }
      </style>
      <div class="guide-container">
        <div class="guide-header">
          <h2>智能导办</h2>
          <p>告诉我您想办理的业务，我来帮您快速找到办理入口</p>
        </div>
        <div class="search-section">
          <div class="search-input-wrapper">
            <input 
              type="text" 
              class="search-input" 
              id="searchInput"
              placeholder="请输入您想办理的业务，例如：我要办身份证"
            />
            <button class="search-btn" id="searchBtn">搜索</button>
          </div>
          <div class="hot-tags">
            <span class="section-title" style="margin-right: 8px; margin-bottom: 0;">热门推荐：</span>
            ${this.hotTags.map(tag => `<span class="tag" data-tag="${tag}">${tag}</span>`).join('')}
          </div>
        </div>
        <div class="results-section" id="resultsSection">
          <div class="section-title" id="resultsTitle">推荐事项</div>
          <div class="item-list" id="itemList"></div>
          <div class="empty-state hidden" id="emptyResults">
            <div class="empty-state-icon">🔍</div>
            <p>未找到匹配的事项，请尝试其他关键词</p>
          </div>
        </div>
        <div class="materials-section hidden" id="materialsSection">
          <div class="materials-header">
            <div class="section-title" style="margin-bottom: 0;" id="materialsTitle">材料清单</div>
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill" style="width: ${progressPercent}%"></div>
            </div>
            <div class="progress-text" id="progressText">${checkedCount}/${totalCount}</div>
          </div>
          <div class="material-list" id="materialList"></div>
          <button class="appointment-btn" id="appointmentBtn">立即预约办理</button>
        </div>
      </div>
      ${this._renderTemplateModal()}
    `;
  }

  _bindEvents() {
    const searchInput = this.$('#searchInput');
    const searchBtn = this.$('#searchBtn');
    const itemList = this.$('#itemList');
    const materialList = this.$('#materialList');
    const appointmentBtn = this.$('#appointmentBtn');
    const hotTags = this.$$('.tag');

    this._searchDebounce = this._debounce(this._onSearchInput, 300);

    this._bindEvent(searchInput, 'input', (e) => {
      this._searchDebounce(e.target.value);
    });

    this._bindEvent(searchInput, 'keypress', (e) => {
      if (e.key === 'Enter') {
        this._performSearch(e.target.value);
      }
    });

    this._bindEvent(searchBtn, 'click', () => {
      const input = this.$('#searchInput');
      this._performSearch(input.value);
    });

    hotTags.forEach(tag => {
      this._bindEvent(tag, 'click', (e) => {
        const tagText = e.target.dataset.tag;
        const input = this.$('#searchInput');
        input.value = tagText;
        this._performSearch(tagText);
      });
    });

    this._bindEvent(itemList, 'click', (e) => {
      const card = e.target.closest('.item-card');
      if (card) {
        const itemId = card.dataset.itemId;
        this._selectItem(itemId);
      }
    });

    this._bindEvent(materialList, 'change', (e) => {
      if (e.target.classList.contains('material-checkbox')) {
        const materialId = e.target.dataset.materialId;
        const checked = e.target.checked;
        this._handleMaterialCheck(materialId, checked);
      }
    });

    this._bindEvent(materialList, 'click', (e) => {
      if (e.target.classList.contains('template-btn')) {
        const materialId = e.target.dataset.materialId;
        this._previewTemplate(materialId);
      }
    });

    this._bindEvent(appointmentBtn, 'click', () => {
      this._startAppointment();
    });

    this._loadDefaultItems();
  }

  async _loadDefaultItems() {
    try {
      const response = await ApiService.searchItems('');
      if (response.code === 200) {
        this.searchResults = response.data;
        this._renderResults();
      }
    } catch (e) {
      console.error('Load default items failed:', e);
    }
  }

  _onSearchInput(value) {
    if (value.trim().length >= 2) {
      this._performSearch(value);
    }
  }

  async _performSearch(keyword) {
    if (!keyword.trim()) {
      this._loadDefaultItems();
      return;
    }

    try {
      const response = await ApiService.matchIntent(keyword);
      if (response.code === 200) {
        this.searchResults = response.data.items;
        this._renderResults();
        this.eventBus.emit('search:complete', {
          keyword,
          matchType: response.data.match,
          results: this.searchResults
        });
      }
    } catch (e) {
      console.error('Search failed:', e);
    }
  }

  _onSearchQuery(data) {
    if (data && data.keyword) {
      const input = this.$('#searchInput');
      if (input) {
        input.value = data.keyword;
      }
      this._performSearch(data.keyword);
    }
  }

  _renderResults() {
    const itemList = this.$('#itemList');
    const emptyResults = this.$('#emptyResults');
    const resultsTitle = this.$('#resultsTitle');

    if (this.searchResults.length === 0) {
      itemList.innerHTML = '';
      emptyResults.classList.remove('hidden');
      resultsTitle.textContent = '搜索结果';
      return;
    }

    emptyResults.classList.add('hidden');
    resultsTitle.textContent = `搜索结果（${this.searchResults.length}项）`;

    itemList.innerHTML = this.searchResults.map(item => `
      <div class="item-card ${this.selectedItem?.id === item.id ? 'selected' : ''}" data-item-id="${item.id}">
        <div class="item-name">${item.name}</div>
        <div class="item-desc">${item.description}</div>
        <div class="item-time">
          <span>⏱️</span>
          <span>预计 ${item.estimatedTime} 分钟</span>
        </div>
      </div>
    `).join('');
  }

  async _selectItem(itemId) {
    const item = this.searchResults.find(i => i.id === itemId);
    if (!item) return;

    this.selectedItem = item;
    this._renderResults();

    try {
      const response = await ApiService.getMaterials(itemId);
      if (response.code === 200) {
        this.materials = response.data.materials;
        this._renderMaterials(response.data.itemName);
      }
    } catch (e) {
      console.error('Get materials failed:', e);
    }
  }

  _renderMaterials(itemName) {
    const materialsSection = this.$('#materialsSection');
    const materialsTitle = this.$('#materialsTitle');
    const materialList = this.$('#materialList');

    materialsTitle.textContent = `${itemName} - 材料清单`;
    materialsSection.classList.remove('hidden');

    materialList.innerHTML = this.materials.map(material => `
      <div class="material-item" data-material-id="${material.id}">
        <input 
          type="checkbox" 
          class="material-checkbox" 
          data-material-id="${material.id}"
          ${material.checked ? 'checked' : ''}
        />
        <span class="material-name">${material.name}</span>
        <span class="${material.required ? 'required-badge' : 'optional-badge'}">
          ${material.required ? '必填' : '选填'}
        </span>
        <button 
          class="template-btn" 
          data-material-id="${material.id}"
          ${material.hasTemplate ? '' : 'disabled'}
        >
          ${material.hasTemplate ? '模板预览' : '无模板'}
        </button>
      </div>
    `).join('');

    this._updateProgress();
  }

  _handleMaterialCheck(materialId, checked) {
    const material = this.materials.find(m => m.id === materialId);
    if (material) {
      material.checked = checked;
      this._updateProgress();
      this.eventBus.emit('material:checked', {
        materialId,
        materialName: material.name,
        checked,
        itemId: this.selectedItem?.id,
        itemName: this.selectedItem?.name
      });
    }
  }

  _onMaterialChecked(data) {
    if (data && data.itemId === this.selectedItem?.id) {
      const material = this.materials.find(m => m.id === data.materialId);
      if (material) {
        material.checked = data.checked;
        this._updateProgress();
      }
    }
  }

  _updateProgress() {
    const checkedCount = this.materials.filter(m => m.checked).length;
    const totalCount = this.materials.length;
    const progressPercent = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

    const progressFill = this.$('#progressFill');
    const progressText = this.$('#progressText');

    if (progressFill) {
      progressFill.style.width = `${progressPercent}%`;
    }
    if (progressText) {
      progressText.textContent = `${checkedCount}/${totalCount}`;
    }
  }

  async _previewTemplate(materialId) {
    const material = this.materials.find(m => m.id === materialId);
    if (!material || !material.hasTemplate) return;

    this.templateLoading = true;
    this.render();

    try {
      const res = await ApiService.getMaterialTemplate(materialId);
      if (res.code === 200) {
        this.currentTemplate = res.data;
      } else {
        alert(res.message || '模板加载失败');
      }
    } catch (e) {
      console.error('Template load error:', e);
      alert('模板加载失败，请稍后重试');
    } finally {
      this.templateLoading = false;
      this.render();
      this._bindTemplateModalEvents();
    }
  }

  _closeTemplatePreview() {
    this.currentTemplate = null;
    this.render();
  }

  _renderTemplateModal() {
    if (this.templateLoading) {
      return `
        <div class="modal-overlay">
          <div class="modal template-modal">
            <div class="loading-indicator">
              <i class="fa fa-spinner fa-spin"></i>
              <span>正在加载模板...</span>
            </div>
          </div>
        </div>
      `;
    }

    if (!this.currentTemplate) return '';

    const t = this.currentTemplate;
    const fieldRows = this._renderTemplateFields(t.fields);

    return `
      <div class="modal-overlay" id="templateOverlay">
        <div class="modal template-modal">
          <div class="modal-header">
            <div>
              <h3 class="modal-title">${this.escapeHtml(t.formTitle)}</h3>
              <div class="template-meta">
                <span class="meta-item"><i class="fa fa-building"></i> ${this.escapeHtml(t.issuingAuthority)}</span>
                <span class="meta-item"><i class="fa fa-barcode"></i> 编号：${this.escapeHtml(t.formNumber)}</span>
              </div>
            </div>
            <button class="modal-close" id="closeTemplateBtn">&times;</button>
          </div>
          <div class="modal-body template-body">
            <div class="template-preview-card">
              <div class="template-header">
                <div class="template-title">${this.escapeHtml(t.formTitle)}</div>
                <div class="template-subtitle">${this.escapeHtml(t.issuingAuthority)} 监制</div>
              </div>
              <div class="template-form">
                ${fieldRows}
              </div>
              <div class="template-notices">
                <div class="notices-title"><i class="fa fa-info-circle"></i> 填表须知</div>
                <ul>
                  ${t.notices.map(n => `<li>${this.escapeHtml(n)}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="closeTemplateBtn2">关闭预览</button>
            <button class="btn btn-primary" id="downloadTemplateBtn">
              <i class="fa fa-download"></i> 下载模板
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderTemplateFields(fields) {
    let html = '';
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const nextField = fields[i + 1];
      const isHalfWidth = field.width === 'half';
      const nextIsHalf = nextField && nextField.width === 'half';

      if (isHalfWidth && nextIsHalf) {
        html += `
          <div class="form-row">
            ${this._renderSingleField(field)}
            ${this._renderSingleField(nextField)}
          </div>
        `;
        i++;
      } else {
        html += this._renderSingleField(field);
      }
    }
    return html;
  }

  _renderSingleField(field) {
    const widthClass = field.width === 'half' ? 'form-half' : 'form-full';
    const requiredMark = field.required ? '<span class="required-star">*</span>' : '';
    let inputHtml = '';

    switch (field.type) {
      case 'radio':
        inputHtml = `
          <div class="radio-group">
            ${field.options.map(opt => `
              <label class="radio-item">
                <input type="radio" disabled ${field.example === opt ? 'checked' : ''}>
                <span>${opt}</span>
              </label>
            `).join('')}
          </div>
        `;
        break;
      case 'select':
        inputHtml = `
          <select class="field-input" disabled>
            <option>${field.example}</option>
          </select>
        `;
        break;
      case 'textarea':
        inputHtml = `<textarea class="field-input field-textarea" disabled placeholder="${this.escapeHtml(field.placeholder || '')}">${this.escapeHtml(field.example || '')}</textarea>`;
        break;
      case 'signature':
        inputHtml = `
          <div class="signature-box">
            <div class="signature-placeholder">
              <i class="fa fa-pen"></i>
              <span>${this.escapeHtml(field.example)}</span>
            </div>
          </div>
        `;
        break;
      default:
        inputHtml = `<input type="${field.type}" class="field-input" disabled value="${this.escapeHtml(field.example || '')}" placeholder="${this.escapeHtml(field.placeholder || '')}">`;
    }

    return `
      <div class="form-field ${widthClass}">
        <label class="field-label">${requiredMark}${this.escapeHtml(field.name)}</label>
        ${inputHtml}
      </div>
    `;
  }

  _bindTemplateModalEvents() {
    const closeBtn1 = this.$('#closeTemplateBtn');
    const closeBtn2 = this.$('#closeTemplateBtn2');
    const overlay = this.$('#templateOverlay');
    const downloadBtn = this.$('#downloadTemplateBtn');

    if (closeBtn1) this._bindEvent(closeBtn1, 'click', this._closeTemplatePreview);
    if (closeBtn2) this._bindEvent(closeBtn2, 'click', this._closeTemplatePreview);
    if (overlay) {
      this._bindEvent(overlay, 'click', (e) => {
        if (e.target.id === 'templateOverlay') this._closeTemplatePreview();
      });
    }
    if (downloadBtn) {
      this._bindEvent(downloadBtn, 'click', () => {
        alert('模板下载功能：在实际系统中此处将下载PDF格式的模板文件');
      });
    }
  }

  _startAppointment() {
    if (!this.selectedItem) return;

    const requiredChecked = this.materials
      .filter(m => m.required)
      .every(m => m.checked);

    if (!requiredChecked) {
      alert('请先准备好所有必填材料');
      return;
    }

    this.eventBus.emit('appointment:start', {
      itemId: this.selectedItem.id,
      itemName: this.selectedItem.name,
      materials: this.materials,
      checkedCount: this.materials.filter(m => m.checked).length,
      totalCount: this.materials.length
    });
  }

  destroy() {
    this._unsubscribes.forEach(unsub => {
      try { unsub(); } catch (e) {}
    });
    this._unsubscribes = [];
    this.searchResults = [];
    this.selectedItem = null;
    this.materials = [];
  }
}

customElements.define('smart-guide', SmartGuide);
window.SmartGuide = SmartGuide;

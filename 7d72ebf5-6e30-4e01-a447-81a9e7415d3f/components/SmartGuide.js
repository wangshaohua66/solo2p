class SmartGuide extends BaseComponent {
  constructor() {
    super();
    this.searchResults = [];
    this.selectedItem = null;
    this.materials = [];
    this.hotTags = ['身份证办理', '社保卡申领', '营业执照办理', '公积金提取', '户口迁移'];
    this._unsubscribes = [];
    this._searchDebounce = null;
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

  _previewTemplate(materialId) {
    const material = this.materials.find(m => m.id === materialId);
    if (material && material.hasTemplate) {
      console.log('Preview template for:', material.name);
      this.eventBus.emit('template:preview', {
        materialId,
        materialName: material.name
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

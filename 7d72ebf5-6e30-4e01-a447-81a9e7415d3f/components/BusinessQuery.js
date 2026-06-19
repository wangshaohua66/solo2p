class BusinessQuery extends BaseComponent {
  constructor() {
    super();
    this.state = {
      categories: [],
      items: [],
      filteredItems: [],
      activeCategory: 'all',
      searchKeyword: '',
      showAppointmentModal: false,
      showSuccessModal: false,
      selectedItem: null,
      selectedDate: '',
      selectedTimeSlot: null,
      dates: [],
      timeSlots: [],
      formData: {
        name: '',
        idCard: '',
        phone: ''
      },
      formErrors: {},
      appointmentResult: null
    };
  }

  async init() {
    const [categoriesRes, itemsRes, datesRes] = await Promise.all([
      ApiService.getCategories(),
      ApiService.searchItems(),
      ApiService.getAvailableDates(7)
    ]);

    const categories = [{ id: 'all', name: '全部', icon: 'fa-th-large' }, ...(categoriesRes.data || [])];
    const items = itemsRes.data || [];
    const dates = datesRes.data || [];

    this.setState({
      categories,
      items,
      filteredItems: items,
      dates,
      selectedDate: dates[0] || ''
    });

    if (this.state.selectedDate) {
      this.loadTimeSlots(this.state.selectedDate);
    }
  }

  async loadTimeSlots(date) {
    const res = await ApiService.getTimeSlots(date);
    this.setState({
      timeSlots: res.data || [],
      selectedTimeSlot: null
    });
  }

  handleCategoryChange(categoryId) {
    const filtered = categoryId === 'all'
      ? this.state.items
      : this.state.items.filter(item => item.category === categoryId);
    
    const keyword = this.state.searchKeyword.toLowerCase();
    const finalFiltered = keyword
      ? filtered.filter(item =>
          item.name.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword)
        )
      : filtered;

    this.setState({
      activeCategory: categoryId,
      filteredItems: finalFiltered
    });
  }

  handleSearch(keyword) {
    const filtered = this.state.activeCategory === 'all'
      ? this.state.items
      : this.state.items.filter(item => item.category === this.state.activeCategory);
    
    const kw = keyword.toLowerCase();
    const finalFiltered = kw
      ? filtered.filter(item =>
          item.name.toLowerCase().includes(kw) ||
          item.description.toLowerCase().includes(kw)
        )
      : filtered;

    this.setState({
      searchKeyword: keyword,
      filteredItems: finalFiltered
    });
  }

  openAppointmentModal(item) {
    this.setState({
      showAppointmentModal: true,
      selectedItem: item,
      formData: { name: '', idCard: '', phone: '' },
      formErrors: {}
    });
  }

  closeAppointmentModal() {
    this.setState({
      showAppointmentModal: false,
      selectedItem: null,
      selectedTimeSlot: null
    });
  }

  closeSuccessModal() {
    this.setState({
      showSuccessModal: false,
      appointmentResult: null
    });
  }

  handleDateChange(date) {
    this.setState({ selectedDate: date });
    this.loadTimeSlots(date);
  }

  handleTimeSlotSelect(slot) {
    if (!slot.available) return;
    this.setState({ selectedTimeSlot: slot });
  }

  handleFormInput(field, value) {
    const formData = { ...this.state.formData, [field]: value };
    const formErrors = { ...this.state.formErrors };
    delete formErrors[field];
    
    this.setState({ formData, formErrors });
  }

  validateForm() {
    const schema = {
      name: ['required', { rule: 'minLength', params: [2] }],
      idCard: ['required', 'idCard'],
      phone: ['required', 'phone']
    };

    const { isValid, errors } = FormValidator.validateForm(this.state.formData, schema);
    this.setState({ formErrors: errors });
    return isValid;
  }

  async handleSubmitAppointment() {
    if (!this.state.selectedItem) return;
    if (!this.state.selectedTimeSlot) {
      alert('请选择预约时段');
      return;
    }
    if (!this.validateForm()) {
      return;
    }

    const res = await ApiService.createAppointment({
      itemId: this.state.selectedItem.id,
      date: this.state.selectedDate,
      timeSlot: `${this.state.selectedTimeSlot.start}-${this.state.selectedTimeSlot.end}`,
      citizenInfo: { ...this.state.formData }
    });

    if (res.code === 200) {
      this.emit('appointment:created', res.data);
      this.setState({
        showAppointmentModal: false,
        showSuccessModal: true,
        appointmentResult: res.data
      });
    } else {
      alert(res.message || '预约失败');
    }
  }

  formatDateWithWeekday(dateStr) {
    const date = new Date(dateStr);
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `今天 (${month}/${day})`;
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `明天 (${month}/${day})`;
    }
    return `${weekday} (${month}/${day})`;
  }

  getStyles() {
    return `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #333;
        }
        .container {
          padding: 20px;
          background: #f5f7fa;
          min-height: 100vh;
        }
        .header {
          text-align: center;
          margin-bottom: 24px;
        }
        .header h2 {
          margin: 0 0 8px 0;
          color: #2c3e50;
          font-size: 28px;
        }
        .header p {
          margin: 0;
          color: #7f8c8d;
          font-size: 14px;
        }
        .search-box {
          margin-bottom: 20px;
          position: relative;
        }
        .search-box input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .search-box input:focus {
          outline: none;
          border-color: #3498db;
        }
        .search-box i {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: #95a5a6;
        }
        .category-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 8px;
        }
        .category-tab {
          flex-shrink: 0;
          padding: 10px 20px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 20px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .category-tab:hover {
          border-color: #3498db;
          color: #3498db;
        }
        .category-tab.active {
          background: #3498db;
          color: white;
          border-color: #3498db;
        }
        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }
        .item-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        }
        .item-name {
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
        }
        .item-desc {
          font-size: 14px;
          color: #7f8c8d;
          margin-bottom: 16px;
          line-height: 1.5;
        }
        .item-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .item-time {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #3498db;
        }
        .item-category {
          font-size: 12px;
          padding: 4px 10px;
          background: #ecf0f1;
          color: #7f8c8d;
          border-radius: 12px;
        }
        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary {
          background: #3498db;
          color: white;
          width: 100%;
        }
        .btn-primary:hover {
          background: #2980b9;
        }
        .btn-primary:disabled {
          background: #bdc3c7;
          cursor: not-allowed;
        }
        .btn-outline {
          background: transparent;
          border: 1px solid #ddd;
          color: #333;
        }
        .btn-outline:hover {
          border-color: #3498db;
          color: #3498db;
        }
        .btn-block {
          width: 100%;
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
          z-index: 1000;
        }
        .modal {
          background: white;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-header {
          padding: 20px 24px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-title {
          font-size: 18px;
          font-weight: 600;
          color: #2c3e50;
          margin: 0;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #95a5a6;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .modal-body {
          padding: 24px;
        }
        .modal-footer {
          padding: 16px 24px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #2c3e50;
          margin-bottom: 8px;
        }
        .form-control {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .form-control:focus {
          outline: none;
          border-color: #3498db;
        }
        .form-control.is-invalid {
          border-color: #e74c3c;
        }
        .invalid-feedback {
          color: #e74c3c;
          font-size: 12px;
          margin-top: 4px;
        }
        .date-selector {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 8px;
          margin-bottom: 20px;
        }
        .date-option {
          flex-shrink: 0;
          padding: 12px 16px;
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          text-align: center;
          min-width: 100px;
          transition: all 0.2s;
        }
        .date-option:hover {
          border-color: #3498db;
        }
        .date-option.active {
          background: #e8f4fd;
          border-color: #3498db;
          color: #3498db;
        }
        .date-option .date-text {
          font-size: 13px;
          font-weight: 500;
        }
        .time-slots {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }
        .time-slot {
          padding: 12px;
          text-align: center;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.2s;
        }
        .time-slot:hover:not(.disabled) {
          border-color: #3498db;
        }
        .time-slot.active {
          background: #e8f4fd;
          border-color: #3498db;
          color: #3498db;
        }
        .time-slot.disabled {
          background: #f0f0f0;
          color: #bdc3c7;
          cursor: not-allowed;
          text-decoration: line-through;
        }
        .section-title {
          font-size: 14px;
          font-weight: 600;
          color: #2c3e50;
          margin: 0 0 12px 0;
        }
        .selected-item-info {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .selected-item-info .name {
          font-size: 16px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 4px;
        }
        .selected-item-info .desc {
          font-size: 13px;
          color: #7f8c8d;
        }
        .success-modal {
          text-align: center;
          padding: 40px;
        }
        .success-icon {
          width: 80px;
          height: 80px;
          background: #d5f5e3;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        .success-icon i {
          font-size: 40px;
          color: #27ae60;
        }
        .success-title {
          font-size: 24px;
          font-weight: 600;
          color: #2c3e50;
          margin-bottom: 8px;
        }
        .success-subtitle {
          font-size: 14px;
          color: #7f8c8d;
          margin-bottom: 24px;
        }
        .appointment-code {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .appointment-code .label {
          font-size: 13px;
          color: #7f8c8d;
          margin-bottom: 8px;
        }
        .appointment-code .code {
          font-size: 36px;
          font-weight: bold;
          color: #3498db;
          letter-spacing: 4px;
        }
        .appointment-info {
          text-align: left;
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
        }
        .appointment-info .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
        }
        .appointment-info .info-row .label {
          color: #7f8c8d;
        }
        .appointment-info .info-row .value {
          color: #2c3e50;
          font-weight: 500;
        }
        .qrcode-placeholder {
          width: 150px;
          height: 150px;
          background: #f0f0f0;
          border: 2px dashed #bdc3c7;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: #95a5a6;
          font-size: 12px;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #95a5a6;
        }
        .empty-state i {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .empty-state p {
          margin: 0;
        }
      </style>
    `;
  }

  renderCategories() {
    return `
      <div class="category-tabs">
        ${this.state.categories.map(cat => `
          <div 
            class="category-tab ${this.state.activeCategory === cat.id ? 'active' : ''}"
            onclick="this.getRootNode().host.handleCategoryChange('${cat.id}')"
          >
            <i class="fas ${cat.icon}"></i>
            ${this.escapeHtml(cat.name)}
          </div>
        `).join('')}
      </div>
    `;
  }

  renderItems() {
    if (!this.state.filteredItems || this.state.filteredItems.length === 0) {
      return `
        <div class="empty-state">
          <i class="fas fa-search"></i>
          <p>没有找到匹配的事项，请尝试其他关键词</p>
        </div>
      `;
    }

    const categoryMap = {};
    this.state.categories.forEach(c => categoryMap[c.id] = c.name);

    return `
      <div class="items-grid">
        ${this.state.filteredItems.map(item => `
          <div class="item-card">
            <div class="item-name">${this.escapeHtml(item.name)}</div>
            <div class="item-desc">${this.escapeHtml(item.description)}</div>
            <div class="item-meta">
              <div class="item-time">
                <i class="fas fa-clock"></i>
                <span>预计 ${item.estimatedTime} 分钟</span>
              </div>
              <span class="item-category">${categoryMap[item.category] || ''}</span>
            </div>
            <button 
              class="btn btn-primary"
              onclick="this.getRootNode().host.openAppointmentModal(${JSON.stringify(item).replace(/"/g, '&quot;')})"
            >
              立即预约
            </button>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderAppointmentModal() {
    if (!this.state.showAppointmentModal || !this.state.selectedItem) return '';

    const item = this.state.selectedItem;
    const formData = this.state.formData;
    const errors = this.state.formErrors;

    return `
      <div class="modal-overlay" onclick="if(event.target === this) this.getRootNode().host.closeAppointmentModal()">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">预约办理</h3>
            <button class="modal-close" onclick="this.getRootNode().host.closeAppointmentModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="selected-item-info">
              <div class="name">${this.escapeHtml(item.name)}</div>
              <div class="desc">${this.escapeHtml(item.description)}</div>
            </div>

            <h4 class="section-title">选择日期</h4>
            <div class="date-selector">
              ${this.state.dates.map(date => `
                <div 
                  class="date-option ${this.state.selectedDate === date ? 'active' : ''}"
                  onclick="this.getRootNode().host.handleDateChange('${date}')"
                >
                  <div class="date-text">${this.formatDateWithWeekday(date)}</div>
                </div>
              `).join('')}
            </div>

            <h4 class="section-title">选择时段</h4>
            <div class="time-slots">
              ${this.state.timeSlots.map((slot, index) => `
                <div 
                  class="time-slot ${!slot.available ? 'disabled' : ''} ${this.state.selectedTimeSlot?.start === slot.start ? 'active' : ''}"
                  onclick="this.getRootNode().host.handleTimeSlotSelect(${JSON.stringify(slot).replace(/"/g, '&quot;')})"
                >
                  ${slot.start} - ${slot.end}
                  ${!slot.available ? '<br><small>已约满</small>' : ''}
                </div>
              `).join('')}
            </div>

            <h4 class="section-title">个人信息</h4>
            <div class="form-group">
              <label class="form-label">姓名</label>
              <input 
                type="text" 
                class="form-control ${errors.name ? 'is-invalid' : ''}"
                name="name"
                placeholder="请输入姓名"
                value="${this.escapeHtml(formData.name)}"
                oninput="this.getRootNode().host.handleFormInput('name', this.value)"
              />
              ${errors.name ? `<div class="invalid-feedback">${errors.name[0]}</div>` : ''}
            </div>
            <div class="form-group">
              <label class="form-label">身份证号</label>
              <input 
                type="text" 
                class="form-control ${errors.idCard ? 'is-invalid' : ''}"
                name="idCard"
                placeholder="请输入身份证号码"
                value="${this.escapeHtml(formData.idCard)}"
                oninput="this.getRootNode().host.handleFormInput('idCard', this.value)"
              />
              ${errors.idCard ? `<div class="invalid-feedback">${errors.idCard[0]}</div>` : ''}
            </div>
            <div class="form-group">
              <label class="form-label">手机号</label>
              <input 
                type="tel" 
                class="form-control ${errors.phone ? 'is-invalid' : ''}"
                name="phone"
                placeholder="请输入手机号码"
                value="${this.escapeHtml(formData.phone)}"
                oninput="this.getRootNode().host.handleFormInput('phone', this.value)"
              />
              ${errors.phone ? `<div class="invalid-feedback">${errors.phone[0]}</div>` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="this.getRootNode().host.closeAppointmentModal()">取消</button>
            <button class="btn btn-primary" onclick="this.getRootNode().host.handleSubmitAppointment()">提交预约</button>
          </div>
        </div>
      </div>
    `;
  }

  renderSuccessModal() {
    if (!this.state.showSuccessModal || !this.state.appointmentResult) return '';

    const result = this.state.appointmentResult;

    return `
      <div class="modal-overlay" onclick="if(event.target === this) this.getRootNode().host.closeSuccessModal()">
        <div class="modal">
          <div class="success-modal">
            <div class="success-icon">
              <i class="fas fa-check"></i>
            </div>
            <div class="success-title">预约成功</div>
            <div class="success-subtitle">请准时前往办理，祝您办事愉快</div>
            
            <div class="qrcode-placeholder">
              <i class="fas fa-qrcode" style="font-size: 48px;"></i>
              <br>预约二维码
            </div>

            <div class="appointment-code">
              <div class="label">预约码</div>
              <div class="code">${this.escapeHtml(result.code)}</div>
            </div>

            <div class="appointment-info">
              <div class="info-row">
                <span class="label">事项名称</span>
                <span class="value">${this.escapeHtml(result.itemName)}</span>
              </div>
              <div class="info-row">
                <span class="label">预约日期</span>
                <span class="value">${this.escapeHtml(result.date)}</span>
              </div>
              <div class="info-row">
                <span class="label">预约时段</span>
                <span class="value">${this.escapeHtml(result.timeSlot)}</span>
              </div>
              <div class="info-row">
                <span class="label">排队位置</span>
                <span class="value">第 ${result.queuePosition} 位</span>
              </div>
            </div>

            <button class="btn btn-primary btn-block" onclick="this.getRootNode().host.closeSuccessModal()">
              完成
            </button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = this.getStyles() + `
      <div class="container">
        <div class="header">
          <h2>业务查询与预约</h2>
          <p>查询可办理事项，在线预约更便捷</p>
        </div>

        <div class="search-box">
          <i class="fas fa-search"></i>
          <input 
            type="text" 
            placeholder="搜索事项名称、描述..."
            value="${this.escapeHtml(this.state.searchKeyword)}"
            oninput="this.getRootNode().host.handleSearch(this.value)"
          />
        </div>

        ${this.renderCategories()}

        ${this.renderItems()}

        ${this.renderAppointmentModal()}

        ${this.renderSuccessModal()}
      </div>
    `;
  }
}

customElements.define('business-query', BusinessQuery);
window.BusinessQuery = BusinessQuery;

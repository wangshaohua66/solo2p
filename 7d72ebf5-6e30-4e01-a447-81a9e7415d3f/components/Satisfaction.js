class Satisfaction extends BaseComponent {
  constructor() {
    super();
    this.state = {
      rating: 0,
      hoverRating: 0,
      comment: '',
      selectedTags: [],
      history: [],
      submitting: false
    };
    this._ratingLabels = ['', '非常不满意', '不满意', '一般', '满意', '非常满意'];
    this._quickTags = [
      { id: 'attitude', name: '服务态度好', icon: 'fas fa-smile' },
      { id: 'efficiency', name: '办事效率高', icon: 'fas fa-bolt' },
      { id: 'process', name: '流程清晰', icon: 'fas fa-sitemap' },
      { id: 'environment', name: '环境整洁', icon: 'fas fa-leaf' },
      { id: 'improve', name: '需要改进', icon: 'fas fa-exclamation-circle' }
    ];
    this._isDragging = false;
  }

  async init() {
    await this.loadHistory();
  }

  async loadHistory() {
    try {
      const res = await ApiService.getEvaluationHistory();
      if (res.code === 200) {
        this.setState({ history: res.data });
      }
    } catch (e) {
      console.error('Load history failed:', e);
    }
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
    
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }

  getRatingFromEvent(e, starsContainer) {
    const rect = starsContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const starWidth = rect.width / 5;
    const rating = Math.min(5, Math.max(1, Math.ceil(x / starWidth)));
    return rating;
  }

  updateStarDisplay(rating, starsContainer) {
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star, index) => {
      star.classList.toggle('active', rating >= index + 1);
    });
    const label = this.query('.rating-label');
    if (label) {
      label.textContent = rating ? this._ratingLabels[rating] : '请点击星星进行评分';
    }
  }

  handleRatingMouseDown(e) {
    const starsContainer = this.query('#ratingStars');
    this._isDragging = true;
    const rating = this.getRatingFromEvent(e, starsContainer);
    this.state.rating = rating;
    this.state.hoverRating = 0;
    this.updateStarDisplay(rating, starsContainer);
    this.updateSubmitButton();
  }

  handleRatingMouseMove(e) {
    if (!this._isDragging) {
      const starsContainer = this.query('#ratingStars');
      const rating = this.getRatingFromEvent(e, starsContainer);
      this.state.hoverRating = rating;
      this.updateStarDisplay(rating, starsContainer);
    }
  }

  handleRatingMouseLeave() {
    if (!this._isDragging) {
      const starsContainer = this.query('#ratingStars');
      this.state.hoverRating = 0;
      this.updateStarDisplay(this.state.rating, starsContainer);
    }
  }

  handleRatingTouchStart(e) {
    e.preventDefault();
    const starsContainer = this.query('#ratingStars');
    this._isDragging = true;
    const rating = this.getRatingFromEvent(e, starsContainer);
    this.state.rating = rating;
    this.state.hoverRating = 0;
    this.updateStarDisplay(rating, starsContainer);
    this.updateSubmitButton();
  }

  handleRatingTouchMove(e) {
    e.preventDefault();
    if (this._isDragging) {
      const starsContainer = this.query('#ratingStars');
      const rating = this.getRatingFromEvent(e, starsContainer);
      this.state.rating = rating;
      this.updateStarDisplay(rating, starsContainer);
      this.updateSubmitButton();
    }
  }

  handleRatingTouchEnd() {
    this._isDragging = false;
  }

  handleStarClick(index) {
    this.setState({ rating: index + 1, hoverRating: 0 });
  }

  handleCommentInput(e) {
    this.state.comment = e.target.value;
  }

  handleTagClick(tagId) {
    const index = this.state.selectedTags.indexOf(tagId);
    const newTags = [...this.state.selectedTags];
    if (index > -1) {
      newTags.splice(index, 1);
    } else {
      newTags.push(tagId);
    }
    this.setState({ selectedTags: newTags });
  }

  updateSubmitButton() {
    const submitBtn = this.query('#submitBtn');
    if (submitBtn) {
      submitBtn.disabled = this.state.rating === 0 || this.state.submitting;
    }
  }

  async handleSubmit() {
    if (this.state.rating === 0 || this.state.submitting) return;

    this.setState({ submitting: true });

    try {
      const data = {
        rating: this.state.rating,
        comment: this.state.comment,
        tags: this.state.selectedTags,
        itemName: MockData.serviceItems[0]?.name || '综合服务',
        window: '综合窗口'
      };

      const res = await ApiService.submitEvaluation(data);
      
      if (res.code === 200) {
        this.emit('satisfaction:submitted', res.data);
        this.showSuccessToast();
        
        this.setState({
          rating: 0,
          comment: '',
          selectedTags: [],
          submitting: false
        });
        
        await this.loadHistory();
      }
    } catch (e) {
      console.error('Submit evaluation failed:', e);
      this.setState({ submitting: false });
    }
  }

  showSuccessToast() {
    const toast = this.query('#successToast');
    if (toast) {
      toast.classList.add('show');
      this.setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  bindRatingEvents() {
    const starsContainer = this.query('#ratingStars');
    if (!starsContainer) return;

    this._bindEvent(starsContainer, 'mousedown', this.handleRatingMouseDown);
    this._bindEvent(starsContainer, 'mousemove', this.handleRatingMouseMove);
    this._bindEvent(starsContainer, 'mouseleave', this.handleRatingMouseLeave);
    this._bindEvent(document, 'mouseup', () => { this._isDragging = false; });
    
    this._bindEvent(starsContainer, 'touchstart', this.handleRatingTouchStart, { passive: false });
    this._bindEvent(starsContainer, 'touchmove', this.handleRatingTouchMove, { passive: false });
    this._bindEvent(starsContainer, 'touchend', this.handleRatingTouchEnd);

    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star, index) => {
      this._bindEvent(star, 'click', (e) => {
        e.stopPropagation();
        this.handleStarClick(index);
      });
    });
  }

  renderHistoryItem(item) {
    const tagNames = item.tags?.map(tagId => {
      const tag = this._quickTags.find(t => t.id === tagId);
      return tag ? tag.name : '';
    }).filter(Boolean) || [];

    return `
      <div class="history-card">
        <div class="history-header">
          <span class="history-item">${this.escapeHtml(item.itemName || '未知事项')}</span>
          <div class="history-stars">
            ${[1, 2, 3, 4, 5].map(i => `
              <span class="star ${item.rating >= i ? 'active' : ''}">
                <i class="fas fa-star"></i>
              </span>
            `).join('')}
          </div>
        </div>
        ${item.comment ? `<div class="history-comment">${this.escapeHtml(item.comment)}</div>` : ''}
        ${tagNames.length > 0 ? `
          <div class="history-tags">
            ${tagNames.map(name => `<span class="history-tag">${this.escapeHtml(name)}</span>`).join('')}
          </div>
        ` : ''}
        <div class="history-footer">
          <span class="history-window">
            <i class="fas fa-door-open"></i>
            ${this.escapeHtml(item.window || '综合窗口')}
          </span>
          <span class="history-time">
            <i class="fas fa-clock"></i>
            ${this.formatTime(item.createTime)}
          </span>
        </div>
      </div>
    `;
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
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .container {
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 20px;
        }

        .header {
          text-align: center;
          color: white;
          margin-bottom: 40px;
        }

        .header h1 {
          font-size: 36px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .header p {
          font-size: 18px;
          opacity: 0.9;
        }

        .card {
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          margin-bottom: 30px;
        }

        .section-title {
          font-size: 24px;
          font-weight: 600;
          color: #1a202c;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .section-title i {
          color: #667eea;
        }

        .rating-section {
          text-align: center;
          padding: 20px 0 30px;
        }

        .rating-stars {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-bottom: 20px;
          cursor: pointer;
          user-select: none;
          touch-action: none;
        }

        .star {
          font-size: 56px;
          color: #e2e8f0;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .star.active {
          color: #f6e05e;
          text-shadow: 0 0 20px rgba(246, 224, 94, 0.5);
          transform: scale(1.1);
        }

        .star:hover {
          transform: scale(1.2);
        }

        .rating-label {
          font-size: 24px;
          font-weight: 600;
          color: #667eea;
          min-height: 36px;
        }

        .form-group {
          margin-bottom: 30px;
        }

        .form-label {
          display: block;
          font-size: 18px;
          color: #2d3748;
          margin-bottom: 12px;
          font-weight: 500;
        }

        .form-textarea {
          width: 100%;
          padding: 20px;
          font-size: 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          resize: vertical;
          min-height: 120px;
          transition: all 0.3s ease;
          outline: none;
          font-family: inherit;
        }

        .form-textarea:focus {
          border-color: #667eea;
          box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        }

        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .tag {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: #f7fafc;
          border: 2px solid #e2e8f0;
          border-radius: 100px;
          font-size: 16px;
          color: #4a5568;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .tag:hover {
          border-color: #667eea;
          background: #f0f4ff;
        }

        .tag.selected {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-color: #667eea;
          color: white;
        }

        .tag i {
          font-size: 18px;
        }

        .submit-btn {
          width: 100%;
          padding: 20px;
          font-size: 20px;
          font-weight: 600;
          color: white;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .submit-btn.loading {
          position: relative;
          color: transparent;
        }

        .submit-btn.loading::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 24px;
          height: 24px;
          margin: -12px 0 0 -12px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .history-section {
          margin-top: 20px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .history-card {
          background: #f7fafc;
          border-radius: 16px;
          padding: 24px;
          border-left: 4px solid #667eea;
          transition: all 0.3s ease;
        }

        .history-card:hover {
          transform: translateX(4px);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .history-item {
          font-size: 18px;
          font-weight: 600;
          color: #2d3748;
        }

        .history-stars {
          display: flex;
          gap: 4px;
        }

        .history-stars .star {
          font-size: 20px;
          color: #e2e8f0;
          text-shadow: none;
          transform: none;
        }

        .history-stars .star.active {
          color: #f6e05e;
        }

        .history-comment {
          font-size: 15px;
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 12px;
        }

        .history-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 12px;
        }

        .history-tag {
          padding: 4px 12px;
          background: #edf2f7;
          border-radius: 100px;
          font-size: 13px;
          color: #4a5568;
        }

        .history-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          font-size: 14px;
          color: #a0aec0;
        }

        .history-window {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .empty-history {
          text-align: center;
          padding: 40px 20px;
          color: #a0aec0;
        }

        .empty-history i {
          font-size: 48px;
          margin-bottom: 16px;
          display: block;
        }

        .success-toast {
          position: fixed;
          top: 40px;
          left: 50%;
          transform: translateX(-50%) translateY(-100px);
          background: #48bb78;
          color: white;
          padding: 16px 32px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          box-shadow: 0 10px 30px rgba(72, 187, 120, 0.4);
          opacity: 0;
          transition: all 0.4s ease;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .success-toast.show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      </style>
    `;
  }

  render() {
    const { rating, hoverRating, comment, selectedTags, history, submitting } = this.state;
    const displayRating = hoverRating || rating;

    this.shadowRoot.innerHTML = this.getStyles() + `
      <div class="container">
        <div class="success-toast" id="successToast">
          <i class="fas fa-check-circle"></i>
          评价提交成功，感谢您的反馈！
        </div>

        <div class="header">
          <h1>服务评价</h1>
          <p>您的评价是我们改进的动力</p>
        </div>

        <div class="card">
          <h2 class="section-title">
            <i class="fas fa-star"></i>
            服务评分
          </h2>
          <div class="rating-section">
            <div class="rating-stars" id="ratingStars">
              ${[1, 2, 3, 4, 5].map(i => `
                <span class="star ${displayRating >= i ? 'active' : ''}" data-rating="${i}">
                  <i class="fas fa-star"></i>
                </span>
              `).join('')}
            </div>
            <div class="rating-label">${displayRating ? this._ratingLabels[displayRating] : '请点击星星进行评分'}</div>
          </div>

          <div class="form-group">
            <label class="form-label">评价内容</label>
            <textarea 
              class="form-textarea" 
              id="commentInput" 
              placeholder="请输入您的评价建议（选填）"
              oninput="this.getRootNode().host.handleCommentInput(event)"
            >${this.escapeHtml(comment)}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label">快捷标签</label>
            <div class="tags-container">
              ${this._quickTags.map(tag => `
                <span class="tag ${selectedTags.includes(tag.id) ? 'selected' : ''}" 
                      onclick="this.getRootNode().host.handleTagClick('${tag.id}')">
                  <i class="${tag.icon}"></i>
                  ${this.escapeHtml(tag.name)}
                </span>
              `).join('')}
            </div>
          </div>

          <button 
            class="submit-btn ${submitting ? 'loading' : ''}" 
            id="submitBtn"
            ${rating === 0 || submitting ? 'disabled' : ''}
            onclick="this.getRootNode().host.handleSubmit()"
          >
            ${submitting ? '提交中...' : '提交评价'}
          </button>
        </div>

        <div class="card">
          <h2 class="section-title">
            <i class="fas fa-history"></i>
            历史评价
          </h2>
          <div class="history-section">
            ${history.length === 0 ? `
              <div class="empty-history">
                <i class="fas fa-inbox"></i>
                暂无历史评价
              </div>
            ` : `
              <div class="history-list">
                ${history.map(item => this.renderHistoryItem(item)).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    this.bindRatingEvents();
  }

  destroy() {
    super.destroy();
  }
}

customElements.define('satisfaction-evaluation', Satisfaction);

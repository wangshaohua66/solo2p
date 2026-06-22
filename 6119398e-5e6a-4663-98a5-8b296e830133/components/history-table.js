import '../utils/widget-factory.js';
import { AppStore } from '../store.js';
import { formatCurrency, formatDate } from '../utils/gold-price.js';
import { exportToExcel } from '../utils/report-generator.js';

const CAT_COLOR = { gold: '#F59E0B', platinum: '#94A3B8', diamond: '#0EA5E9', jade: '#10B981', pearl: '#F472B6' };
const CAT_LABEL = { gold: '黄金K金', platinum: '铂金钯金', palladium: '铂金钯金', diamond: '钻石彩宝', jade: '翡翠和田玉', pearl: '珍珠琥珀' };
const STATUS_LABEL = { draft: '草稿', pending: '待审批', approved: '已批准', rejected: '已驳回', completed: '已完成' };
const STATUS_CLASS = { draft: 'status-draft', pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected', completed: 'status-completed' };

$.widget('jw.historyTable', {
    options: {
        store: null,
        pageSize: 15,
        onViewDetail: $.noop,
        onStatusChange: $.noop
    },

    _create() {
        this.store = this.options.store || AppStore;
        this.pageSize = this.options.pageSize;
        this.page = 1;
        this.data = [];
        this.filtered = [];
        this.sortKey = 'createdAt';
        this.sortDir = -1;
        this.filters = this.store.getState().filters || {};
        this._buildLayout();
        this._bindEvents();
        this._loadData();
        this._bindStore();
    },

    _bindStore() {
        const self = this;
        this._savedHandler = () => self._loadData();
        this._statusHandler = () => self._loadData();
        this.store.events.on('record:saved', this._savedHandler);
        this.store.events.on('record:statusChanged', this._statusHandler);
    },

    _buildLayout() {
        const html = `
            <div class="mb-3">
                <button class="btn filter-toggle-btn btn-sm mb-2" type="button" data-bs-toggle="collapse" data-bs-target="#filterCollapse">
                    <i class="bi bi-funnel me-1"></i>筛选条件 <i class="bi bi-chevron-down ms-1"></i>
                </button>
                <div class="collapse show" id="filterCollapse">
                    <div class="filter-collapse">
                        <div class="row g-2">
                            <div class="col-md-2">
                                <input type="text" class="form-control form-control-sm f-order" placeholder="回收单号...">
                            </div>
                            <div class="col-md-2">
                                <input type="text" class="form-control form-control-sm f-customer" placeholder="顾客姓名...">
                            </div>
                            <div class="col-md-2">
                                <select class="form-select form-select-sm f-category">
                                    <option value="">全部品类</option>
                                    ${Object.entries(CAT_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-2">
                                <select class="form-select form-select-sm f-status">
                                    <option value="">全部状态</option>
                                    ${Object.entries(STATUS_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-2">
                                <input type="date" class="form-control form-control-sm f-start" title="开始日期">
                            </div>
                            <div class="col-md-2">
                                <input type="date" class="form-control form-control-sm f-end" title="结束日期">
                            </div>
                        </div>
                        <div class="row g-2 mt-2">
                            <div class="col-md-4">
                                <select class="form-select form-select-sm f-store">
                                    <option value="">全部门店</option>
                                    ${Array.from({length:18},(_,i)=>`<option value="store${String(i+1).padStart(3,'0')}">${String(i+1).padStart(3,'0')}号店</option>`).join('')}
                                </select>
                            </div>
                            <div class="col-md-4 d-flex gap-2 align-items-center">
                                <span class="text-muted small">金额:</span>
                                <input type="number" class="form-control form-control-sm f-min-price" placeholder="最低">
                                <span class="text-muted">-</span>
                                <input type="number" class="form-control form-control-sm f-max-price" placeholder="最高">
                            </div>
                            <div class="col-md-4 d-flex gap-2 justify-content-end">
                                <button class="btn btn-outline-secondary btn-sm btn-clear-filter">
                                    <i class="bi bi-x-circle me-1"></i>清空
                                </button>
                                <button class="btn btn-gold btn-sm btn-apply-filter">
                                    <i class="bi bi-search me-1"></i>查询
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div class="text-muted small" id="tableSummary">共 0 条记录</div>
                <div class="d-flex gap-2">
                    <select class="form-select form-select-sm w-auto page-size">
                        <option value="10">10条/页</option>
                        <option value="15" selected>15条/页</option>
                        <option value="30">30条/页</option>
                        <option value="50">50条/页</option>
                    </select>
                </div>
            </div>
            <div class="table-responsive">
                <table class="table table-hover align-middle">
                    <thead>
                        <tr>
                            <th class="sortable" data-key="orderNo" style="cursor:pointer">回收单号 <i class="bi bi-arrow-down-up small opacity-50"></i></th>
                            <th>顾客</th>
                            <th class="sortable" data-key="category" style="cursor:pointer">品类 <i class="bi bi-arrow-down-up small opacity-50"></i></th>
                            <th>首饰摘要</th>
                            <th class="sortable" data-key="finalPrice" style="cursor:pointer">回收价 <i class="bi bi-arrow-down-up small opacity-50"></i></th>
                            <th class="sortable" data-key="status" style="cursor:pointer">状态 <i class="bi bi-arrow-down-up small opacity-50"></i></th>
                            <th class="sortable" data-key="createdAt" style="cursor:pointer">登记时间 <i class="bi bi-arrow-down-up small opacity-50"></i></th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="historyTbody"></tbody>
                </table>
            </div>
            <nav class="mt-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div class="text-muted small" id="pageInfo">第 0/0 页</div>
                <ul class="pagination pagination-sm mb-0" id="historyPagination"></ul>
            </nav>
        `;
        this.element.html(html);
    },

    _bindEvents() {
        const self = this;
        this.element.on('click', '.sortable', function () {
            const key = $(this).data('key');
            if (self.sortKey === key) self.sortDir *= -1;
            else { self.sortKey = key; self.sortDir = -1; }
            self._applySortFilter();
        });

        this.element.on('click', '.btn-view', function () {
            const orderNo = $(this).data('order');
            self._viewDetail(orderNo);
        });

        this.element.on('click', '.btn-status', function () {
            const orderNo = $(this).data('order');
            const status = $(this).data('status');
            self._changeStatus(orderNo, status);
        });

        this.element.on('click', '.page-link', function () {
            const p = +$(this).data('page');
            if (!p) return;
            self.page = p;
            self._renderPage();
        });

        this.element.on('change', '.page-size', function () {
            self.pageSize = +$(this).val() || 15;
            self.page = 1;
            self._renderPage();
        });

        this.element.on('click', '.btn-apply-filter', () => self._collectFilters());
        this.element.on('click', '.btn-clear-filter', () => self._clearFilters());
        this.element.on('keypress', '.f-order, .f-customer', function (e) {
            if (e.key === 'Enter') self._collectFilters();
        });
    },

    async _loadData() {
        const t0 = performance.now();
        const data = await this.store.queryRecords({});
        const t1 = performance.now();
        this.data = data;
        console.debug(`[History] 加载 ${data.length} 条记录, 耗时 ${(t1 - t0).toFixed(1)}ms`);
        this._applyFilterToDom();
        this._applySortFilter();
    },

    _applyFilterToDom() {
        const f = this.filters;
        this.element.find('.f-order').val(f.orderNo || '');
        this.element.find('.f-customer').val(f.customer || '');
        this.element.find('.f-category').val(f.category || '');
        this.element.find('.f-status').val(f.status || '');
        this.element.find('.f-store').val(f.storeId || '');
        this.element.find('.f-min-price').val(f.minPrice || '');
        this.element.find('.f-max-price').val(f.maxPrice || '');
        if (f.startDate) {
            const d = new Date(f.startDate);
            this.element.find('.f-start').val(d.toISOString().slice(0, 10));
        }
        if (f.endDate) {
            const d = new Date(f.endDate);
            this.element.find('.f-end').val(d.toISOString().slice(0, 10));
        }
    },

    _collectFilters() {
        const get = (sel) => this.element.find(sel).val().trim();
        const f = {
            orderNo: get('.f-order'),
            customer: get('.f-customer'),
            category: get('.f-category'),
            status: get('.f-status'),
            storeId: get('.f-store'),
            minPrice: parseFloat(get('.f-min-price')) || null,
            maxPrice: parseFloat(get('.f-max-price')) || null
        };
        const sd = get('.f-start');
        const ed = get('.f-end');
        if (sd) f.startDate = new Date(sd).getTime();
        if (ed) f.endDate = new Date(ed).getTime();
        this.filters = f;
        this.store.setState({ filters: f });
        this.page = 1;
        this._applySortFilter();
    },

    _clearFilters() {
        this.filters = {};
        this.store.setState({ filters: {} });
        this._applyFilterToDom();
        this.page = 1;
        this._applySortFilter();
    },

    _applySortFilter() {
        const f = this.filters;
        const list = this.data.filter(r => {
            if (f.orderNo && !r.orderNo.toLowerCase().includes(f.orderNo.toLowerCase())) return false;
            if (f.customer && !(r.customer?.name || '').includes(f.customer)) return false;
            if (f.category && r.category !== f.category) return false;
            if (f.status && r.status !== f.status) return false;
            if (f.storeId && r.storeId !== f.storeId) return false;
            if (f.minPrice && (r.finalPrice || 0) < f.minPrice) return false;
            if (f.maxPrice && (r.finalPrice || 0) > f.maxPrice) return false;
            if (f.startDate && r.createdAt < f.startDate) return false;
            if (f.endDate && r.createdAt > f.endDate + 86400000) return false;
            return true;
        });

        list.sort((a, b) => {
            const k = this.sortKey;
            let va, vb;
            if (k === 'finalPrice') { va = a.finalPrice || 0; vb = b.finalPrice || 0; }
            else if (k === 'createdAt') { va = a.createdAt || 0; vb = b.createdAt || 0; }
            else if (k === 'category') { va = CAT_LABEL[a[k]] || a[k]; vb = CAT_LABEL[b[k]] || b[k]; }
            else if (k === 'status') { va = STATUS_LABEL[a[k]] || a[k]; vb = STATUS_LABEL[b[k]] || b[k]; }
            else { va = String(a[k] || ''); vb = String(b[k] || ''); }
            if (typeof va === 'number' && typeof vb === 'number') {
                return (va - vb) * this.sortDir;
            }
            return String(va).localeCompare(String(vb), 'zh-CN') * this.sortDir;
        });

        this.filtered = list;
        this.page = Math.min(this.page, Math.max(1, Math.ceil(list.length / this.pageSize)));
        this._renderPage();
    },

    _renderPage() {
        const tbody = this.element.find('#historyTbody');
        const start = (this.page - 1) * this.pageSize;
        const rows = this.filtered.slice(start, start + this.pageSize);
        if (!rows.length) {
            tbody.html(`<tr><td colspan="8" class="text-center py-5 text-muted">
                <i class="bi bi-inbox" style="font-size:3rem;opacity:.3"></i>
                <p class="mt-2 mb-0">暂无符合条件的记录</p>
            </td></tr>`);
        } else {
            tbody.html(rows.map(r => this._renderRow(r)).join(''));
        }
        this.element.find('#tableSummary').text(`共 ${this.filtered.length} 条记录`);
        const totalPages = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
        this.element.find('#pageInfo').text(`第 ${this.page}/${totalPages} 页 · 显示 ${this.filtered.length ? (start + 1) : 0}-${Math.min(start + this.pageSize, this.filtered.length)} 条`);
        this._renderPagination(totalPages);
        this._renderSortIndicators();
    },

    _renderRow(r) {
        const cat = r.category || 'gold';
        const catBadge = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${CAT_COLOR[cat] || '#999'};margin-right:6px"></span>${CAT_LABEL[cat] || cat}`;
        const jewelry = [
            r.jewelry?.brand,
            r.jewelry?.purity,
            r.jewelry?.weight ? r.jewelry.weight + 'g' : ''
        ].filter(Boolean).join(' · ') || (r.inspection?.basic_4c?.carat ? r.inspection.basic_4c.carat + 'ct' : '--');
        const status = r.status || 'draft';
        const actions = [];
        actions.push(`<button class="btn btn-sm btn-outline-primary btn-view" data-order="${r.orderNo}"><i class="bi bi-eye"></i>详情</button>`);
        if (status === 'draft') {
            actions.push(`<button class="btn btn-sm btn-outline-warning btn-status" data-order="${r.orderNo}" data-status="pending"><i class="bi bi-send"></i>提交</button>`);
        } else if (status === 'approved') {
            actions.push(`<button class="btn btn-sm btn-outline-success btn-status" data-order="${r.orderNo}" data-status="completed"><i class="bi bi-check2"></i>完成</button>`);
        }
        return `
            <tr class="${r.resolvedConflict ? '' : ''}${r._conflict ? 'conflict-row' : ''}">
                <td class="fw-bold"><code class="small">${r.orderNo}</code></td>
                <td>
                    <div class="fw-semibold">${r.customer?.name || '--'}</div>
                    <div class="text-muted small">${r.customer?.phone || ''}</div>
                </td>
                <td>${catBadge}</td>
                <td><div class="small">${jewelry}</div><div class="text-muted small">${r.jewelry?.model || ''}</div></td>
                <td class="fw-bold" style="color:var(--gold-700)">${formatCurrency(r.finalPrice || 0)}</td>
                <td><span class="status-badge ${STATUS_CLASS[status] || ''}">${STATUS_LABEL[status] || status}</span></td>
                <td><small>${formatDate(r.createdAt)}</small><br><small class="text-muted">${r.storeId || ''} · ${r.inspector?.name || ''}</small></td>
                <td><div class="d-flex gap-1">${actions.join('')}</div></td>
            </tr>
        `;
    },

    _renderPagination(total) {
        const $ul = this.element.find('#historyPagination');
        const pages = [];
        const p = this.page;
        if (total <= 7) {
            for (let i = 1; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            if (p > 3) pages.push('...');
            const s = Math.max(2, p - 1), e = Math.min(total - 1, p + 1);
            for (let i = s; i <= e; i++) pages.push(i);
            if (p < total - 2) pages.push('...');
            pages.push(total);
        }
        $ul.html(`
            <li class="page-item ${p === 1 ? 'disabled' : ''}"><a class="page-link" data-page="${p - 1}"><i class="bi bi-chevron-left"></i></a></li>
            ${pages.map(v => v === '...' ? '<li class="page-item disabled"><span class="page-link">...</span></li>'
                : `<li class="page-item ${v === p ? 'active' : ''}"><a class="page-link" data-page="${v}">${v}</a></li>`).join('')}
            <li class="page-item ${p === total ? 'disabled' : ''}"><a class="page-link" data-page="${p + 1}"><i class="bi bi-chevron-right"></i></a></li>
        `);
    },

    _renderSortIndicators() {
        this.element.find('.sortable').each(function () {
            const key = $(this).data('key');
            const $i = $(this).find('i');
            if (key === undefined) return;
        });
    },

    _viewDetail(orderNo) {
        this.store.getRecord(orderNo).then(r => {
            if (!r) return;
            this.options.onViewDetail.call(this, r);
            this.store.events.emit('history:viewDetail', { record: r });
        });
    },

    async _changeStatus(orderNo, status) {
        await this.store.updateRecordStatus(orderNo, status);
        this.options.onStatusChange.call(this, { orderNo, status });
    },

    exportCurrent() {
        if (!this.filtered.length) {
            this.store.events.emit('toast:show', { msg: '没有可导出的数据', type: 'warning' });
            return false;
        }
        const t0 = performance.now();
        const ok = exportToExcel(this.filtered, `珠宝回收记录_${this._dateStr()}.xlsx`);
        const t1 = performance.now();
        if (ok) {
            this.store.events.emit('toast:show', { msg: `成功导出 ${this.filtered.length} 条记录 (${(t1 - t0).toFixed(0)}ms)`, type: 'success' });
        }
        return ok;
    },

    _dateStr() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    },

    refresh() { this._loadData(); },

    getFiltered() { return this.filtered; },

    _destroy() {
        this.store.events.off('record:saved', this._savedHandler);
        this.store.events.off('record:statusChanged', this._statusHandler);
        this.element.empty();
    }
});

export default $.jw.historyTable;

import './utils/widget-factory.js';
import { AppStore } from './store.js';
import { GoldPriceFetcher, GOLD_FETCH_INTERVAL, formatCurrency, formatDate, parseDiamondRapaport } from './utils/gold-price.js';
import {
    groupRecordsByDate, groupRecordsByCategory, groupByStore,
    groupByInspector, calcKpi, getDateRange, buildQuotePdfData, exportToExcel
} from './utils/report-generator.js';
import './components/recycle-form.js';
import './components/inspection-panel.js';
import './components/price-calculator.js';
import './components/history-table.js';

class JewelryRecycleApp {
    constructor() {
        this.store = AppStore;
        this.priceFetcher = new GoldPriceFetcher(this.store);
        this.currentFormData = null;
        this.currentInspectionData = null;
        this.currentPriceResult = null;
        this.currentPage = 'recycle';
        this.charts = {};
    }

    async init() {
        console.time('[App] 初始化');
        this._setupGlobalErrorHandler();
        this._initEvents();
        this._initComponents();
        this._initNav();
        this._initSync();
        this._initGoldPrices();
        this._seedDemoDataIfEmpty();
        this._initCharts();
        this._refreshAll();
        console.timeEnd('[App] 初始化');
        this._showToast('系统初始化完成 · 欢迎使用臻品汇珠宝回收管理系统', 'success');
    }

    _setupGlobalErrorHandler() {
        window.addEventListener('error', (e) => {
            console.error('[Global Error]', e.error || e.message);
        });
        window.addEventListener('unhandledrejection', (e) => {
            console.error('[Promise Rejection]', e.reason);
        });
    }

    _initEvents() {
        const s = this.store.events;

        s.on('toast:show', ({ msg, type = 'info', duration = 3000 }) => this._showToast(msg, type, duration));
        s.on('goldPrices:updated', (p) => this._updatePriceMarquee(p));
        s.on('diamondPrices:updated', (data) => {
            this._showToast(`钻石报价表已更新, 共 ${Object.keys(data || {}).length} 条价格`, 'success');
        });
        s.on('form:categoryChanged', ({ category }) => this._onCategoryChange(category));
        s.on('form:submitted', ({ data }) => this._onFormSubmitted(data));
        s.on('form:jewelryChanged', ({ jewelry }) => this._updateCalc());
        s.on('form:customerChange', () => this._updateCalc());
        s.on('inspection:dataChanged', ({ data }) => this._onInspectionData(data));
        s.on('inspection:completed', ({ data }) => this._onInspectionCompleted(data));
        s.on('price:calculated', ({ result, elapsedMs }) => {
            this.currentPriceResult = result;
            if (elapsedMs > 30) console.debug(`[Perf] 报价计算 ${elapsedMs.toFixed(1)}ms`);
        });
        s.on('price:needApproval', ({ result }) => this._showApproval(result));
        s.on('price:confirmed', ({ result }) => this._saveRecordWithStatus('approved'));
        s.on('history:viewDetail', ({ record }) => this._showDetail(record));
        s.on('record:saved', () => {
            this._refreshPending();
            this._refreshSyncStats();
            if (this.currentPage === 'report') this._renderReports();
            if (this.currentPage === 'history') this.$history?.refresh?.();
        });
        s.on('sync:done', () => this._refreshSyncStats());
        s.on('sync:completed', ({ successCount, conflicts }) => {
            this._refreshSyncStats();
            if (conflicts) this._showToast(`同步完成: 成功${successCount}条, 需人工处理${conflicts}条冲突`, 'warning');
            else this._showToast(`同步完成: 成功 ${successCount} 条记录`, 'success');
        });
        s.on('store:changed', async ({ storeId }) => {
            this._showToast(`门店数据分区已切换, 正在加载 ${storeId} 数据...`, 'info');
            await this._refreshPending();
            await this._refreshSyncStats();
            this.$history?.refresh?.();
            if (this.currentPage === 'report') this._renderReports();
            const p = this.store.getState().goldPrices;
            if (p) this._updatePriceMarquee(p);
        });
    }

    _initComponents() {
        this.$recycleForm = $('#recycleFormContainer').recycleForm({
            store: this.store,
            onCustomerChange: () => this._updateCalc(),
            onJewelryChange: () => this._updateCalc(),
            onPhotosChange: () => {},
            onCategoryChange: (cat) => this._onCategoryChange(cat),
            onSubmit: (data) => this._onFormSubmitted(data),
            onSaveDraft: (d) => this._saveDraftRecord(d)
        });

        this.$inspection = $('#inspectionPanelContainer').inspectionPanel({
            store: this.store,
            category: 'gold',
            onStepChange: () => {},
            onDataChange: (d) => this._onInspectionData(d),
            onComplete: (d) => this._onInspectionCompleted(d)
        });

        this.$priceCalc = $('#priceCalcContainer').priceCalculator({
            store: this.store,
            onPriceChange: (r) => { this.currentPriceResult = r; },
            onNeedApproval: (r) => this._showApproval(r)
        });

        this.$history = $('#historyContainer').historyTable({
            store: this.store,
            pageSize: 15,
            onViewDetail: (r) => this._showDetail(r)
        });

        $('#manualAdjustSwitch').on('change', (e) => {
            const enabled = e.target.checked;
            this.$priceCalc.priceCalculator('setManualAdjust', enabled);
        });

        $('#btnNewRecycle').on('click', () => this._newRecycle());
        $('#btnDraft').on('click', () => this._showDrafts());
        $('#btnExportExcel').on('click', () => this.$history.historyTable('exportCurrent'));
        $('#btnExportReport').on('click', () => this._exportReport());
        $('#reportRange').on('change', () => this._renderReports());

        $('#btnApprove').on('click', () => {
            this._requestScanAuth('报价审批授权', (auth) => {
                this._handleApproval(true, auth);
            });
        });
        $('#btnReject').on('click', () => this._handleApproval(false));

        $('#btnPrintQuote').on('click', () => this._printQuoteTemplate());
        $('#btnSyncNow').on('click', () => this._doSync());

        $('#storeSelect').val(this.store.getState().currentStoreId).on('change', (e) => {
            this.store.setCurrentStore(e.target.value);
            const label = e.target.options[e.target.selectedIndex].text;
            this._showToast(`已切换到 ${label}, 数据分区已隔离`, 'info');
        });

        $('#menuRapaport').on('click', (e) => {
            e.preventDefault();
            this._openRapaportModal();
        });
        this._initRapaportUpload();
        this._initScanAuth();
    }

    _initNav() {
        $('#sideMenu').on('click', '.nav-link', (e) => {
            e.preventDefault();
            const page = $(e.currentTarget).data('page');
            this._switchPage(page);
        });
    }

    _switchPage(page) {
        this.currentPage = page;
        this.store.setCurrentPage(page);
        $('#sideMenu .nav-link').removeClass('active');
        $(`#sideMenu .nav-link[data-page="${page}"]`).addClass('active');
        $('.page-section').removeClass('active');
        $(`#page-${page}`).addClass('active');
        if (page === 'report') this._renderReports();
        if (page === 'history') this.$history?.refresh?.();
        if (page === 'pending') this._refreshPending();
        if (page === 'sync') this._refreshSyncStats();
    }

    _initSync() {
        window.addEventListener('online', () => {
            $('#netStatus').removeClass('text-danger').addClass('text-success').html('<i class="bi bi-wifi me-1"></i>在线');
            this._showToast('网络已恢复, 数据将自动同步', 'success');
            setTimeout(() => this._doSync(), 2000);
        });
        window.addEventListener('offline', () => {
            $('#netStatus').removeClass('text-success').addClass('text-danger').html('<i class="bi bi-wifi-off me-1"></i>离线 · 核心功能可用');
            this._showToast('网络已断开, 数据将在恢复后同步', 'warning');
        });
    }

    _initGoldPrices() {
        this.priceFetcher.start(GOLD_FETCH_INTERVAL);
    }

    _updatePriceMarquee(p) {
        $('#goldPrice999').text(p.au9999 ? p.au9999.toFixed(2) : '--');
        $('#goldPrice995').text(p.au9995 ? p.au9995.toFixed(2) : '--');
        $('#ptPrice950').text(p.pt950 ? p.pt950.toFixed(2) : '--');
        $('#pdPrice').text(p.pd999 ? p.pd999.toFixed(2) : '--');
        if (p.fetchedAt) $('#priceUpdateTime').text('更新时间: ' + formatDate(p.fetchedAt));
    }

    _onCategoryChange(cat) {
        this.$inspection.inspectionPanel('option', 'category', cat);
        this._updateCalc();
    }

    _onFormSubmitted(data) {
        this.currentFormData = data;
        this._updateCalc();
        this._showToast('回收信息已提交, 请继续完成检测流程', 'success');
        $('#inspectionPanelContainer .progress-step-card').first().find('.step-card-body').slideDown(200);
    }

    _onInspectionData(data) {
        this.currentInspectionData = data;
        this._updateCalc();
    }

    _onInspectionCompleted(data) {
        this.currentInspectionData = data;
        this._updateCalc();
        this._showToast('检测流程已完成, 请确认报价', 'success');
    }

    _updateCalc() {
        const form = this.$recycleForm?.recycleForm('getData') || this.currentFormData;
        const ins = this.currentInspectionData || this.$inspection?.inspectionPanel('getData') || {};
        this.currentFormData = form;
        this.$priceCalc.priceCalculator('setFormData', form);
        this.$priceCalc.priceCalculator('setInspectionData', ins);
    }

    _newRecycle() {
        this.currentFormData = null;
        this.currentInspectionData = null;
        this.currentPriceResult = null;
        this.$recycleForm.recycleForm('setData', null);
        this.$inspection.inspectionPanel('option', 'category', 'gold');
        this.$inspection.inspectionPanel('setData', {});
        this.$priceCalc.priceCalculator('setFormData', null);
        this.$priceCalc.priceCalculator('setInspectionData', null);
        $('#manualAdjustSwitch').prop('checked', false);
        this.$priceCalc.priceCalculator('setManualAdjust', false);
        this._switchPage('recycle');
    }

    async _saveRecordWithStatus(status, extra = {}) {
        const form = this.$recycleForm.recycleForm('getData');
        const ins = this.$inspection.inspectionPanel('getData');
        const price = this.currentPriceResult || this.$priceCalc.priceCalculator('getLastResult');
        if (!price || !price.finalPrice) {
            this._showToast('请先完成报价计算', 'warning');
            return;
        }
        const record = {
            ...form,
            inspection: ins,
            priceDetail: price,
            finalPrice: price.finalPrice,
            status,
            approvedAt: status === 'approved' ? (extra.approvedAt || Date.now()) : null,
            approvedBy: status === 'approved' ? (extra.approvedBy || this.store.getState().currentInspector.name || '系统') : null,
            authToken: extra.authToken || null,
            synced: navigator.onLine ? false : false
        };
        const t0 = performance.now();
        const saved = await this.store.saveRecord(record);
        const t1 = performance.now();
        console.debug(`[Perf] 保存记录 ${(t1 - t0).toFixed(1)}ms`);
        this._showToast(`回收单 ${saved.orderNo} 已${status === 'approved' ? '审批通过' : status === 'pending' ? '提交待审批' : status === 'draft' ? '保存草稿' : '更新'}`, 'success');
        if (status !== 'draft') {
            setTimeout(() => {
                this._showDetail(saved);
                this._newRecycle();
            }, 500);
        }
    }

    async _saveDraftRecord(data) {
        const record = {
            ...data,
            status: 'draft',
            synced: false
        };
        await this.store.saveRecord(record);
    }

    async _showDrafts() {
        const drafts = await this.store.getDrafts();
        if (!drafts.length) {
            this._showToast('暂无草稿记录', 'info');
            return;
        }
        const html = `
            <div class="mb-3 text-muted small">共 ${drafts.length} 条草稿</div>
            <div class="list-group">
                ${drafts.slice(0, 10).map(d => `
                    <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center draft-item" data-id="${d.id}">
                        <div>
                            <div class="fw-bold">${d.orderNo || '未编号'}</div>
                            <div class="small text-muted">${d.customer?.name || '未知顾客'} · ${({gold:'黄金',platinum:'铂金',diamond:'钻石',jade:'玉石',pearl:'珍珠'})[d.category] || d.category} · ${formatDate(d._ts || d.createdAt)}</div>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-secondary btn-del-draft" data-id="${d.id}">删除</button>
                            <button class="btn btn-sm btn-gold btn-load-draft" data-id="${d.id}">加载</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        $('#detailOrderNo').text('草稿箱');
        $('#detailBody').html(html);
        const modal = new bootstrap.Modal(document.getElementById('detailModal'));
        modal.show();
        $('#detailBody').on('click', '.btn-load-draft', async (e) => {
            const id = $(e.target).data('id');
            const d = drafts.find(x => x.id === id);
            if (!d) return;
            this.currentFormData = d;
            this.$recycleForm.recycleForm('setData', d);
            this.$inspection.inspectionPanel('option', 'category', d.category || 'gold');
            this._updateCalc();
            this.store.deleteDraft(id);
            modal.hide();
            this._switchPage('recycle');
            this._showToast('草稿已加载', 'success');
        });
        $('#detailBody').on('click', '.btn-del-draft', async (e) => {
            const id = $(e.target).data('id');
            await this.store.deleteDraft(id);
            this._showToast('草稿已删除', 'info');
            modal.hide();
            this._showDrafts();
        });
    }

    _showApproval(result) {
        const form = this.$recycleForm.recycleForm('getData');
        const ins = this.currentInspectionData || {};
        const threshold = this.store.getState().approvalThreshold || 30000;
        const diff = result.finalPrice - threshold;
        const diffPct = (diff / threshold * 100).toFixed(1);
        const profit = (result.marketValue || 0) - result.finalPrice;
        const profitRate = result.marketValue ? (profit / result.marketValue * 100).toFixed(1) : '--';
        const html = `
            <div class="alert alert-warning">
                <i class="bi bi-shield-exclamation me-2"></i>
                本单回收价 <strong>${formatCurrency(result.finalPrice)}</strong> 超过审批阈值 ${formatCurrency(threshold)},
                超出 <strong class="text-danger">${formatCurrency(diff)} (${diffPct}%)</strong>, 请店长审批后生效
            </div>
            <div class="row g-4 mb-3">
                <div class="col-md-6">
                    <h6 class="fw-bold text-warning"><i class="bi bi-file-person me-1"></i>基本信息</h6>
                    <div class="detail-grid">
                        <div class="detail-item"><span class="k">回收单号</span><span class="v">${form.orderNo}</span></div>
                        <div class="detail-item"><span class="k">顾客姓名</span><span class="v">${form.customer?.name || '--'}</span></div>
                        <div class="detail-item"><span class="k">联系电话</span><span class="v">${form.customer?.phone || '--'}</span></div>
                        <div class="detail-item"><span class="k">首饰品类</span><span class="v">${({gold:'黄金K金',platinum:'铂金钯金',diamond:'钻石彩宝',jade:'翡翠和田玉',pearl:'珍珠琥珀'})[form.category] || form.category}</span></div>
                        <div class="detail-item"><span class="k">重量/规格</span><span class="v">${form.jewelry?.weight ? form.jewelry.weight + 'g' : (ins.basic_4c?.carat ? ins.basic_4c.carat + 'ct' : '--')}</span></div>
                        <div class="detail-item"><span class="k">提交时间</span><span class="v">${formatDate(Date.now())}</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-primary"><i class="bi bi-graph-up me-1"></i>利润分析</h6>
                    <div class="detail-grid">
                        <div class="detail-item"><span class="k">市场估价</span><span class="v">${formatCurrency(result.marketValue || 0)}</span></div>
                        <div class="detail-item"><span class="k">回收报价</span><span class="v fw-bold text-warning">${formatCurrency(result.finalPrice)}</span></div>
                        <div class="detail-item"><span class="k">预估利润</span><span class="v fw-bold text-success">${formatCurrency(Math.max(0, profit))}</span></div>
                        <div class="detail-item"><span class="k">利润率</span><span class="v fw-bold">${profitRate}%</span></div>
                        <div class="detail-item"><span class="k">回收系数</span><span class="v">${(result.adjustCoef * 100).toFixed(1)}%</span></div>
                        <div class="detail-item"><span class="k">调价说明</span><span class="v">${result.manualReason || '无'}</span></div>
                    </div>
                </div>
            </div>
            <div class="card p-3 mb-3" style="background:#FAFAFA">
                <h6 class="fw-bold mb-2"><i class="bi bi-cash-coin me-1"></i>报价明细</h6>
                ${result.detail.map(d => `
                    <div class="price-breakdown-item ${d.highlight ? 'highlight' : ''}">
                        <span class="label">${d.label}</span>
                        <span class="value">${d.value}</span>
                    </div>
                `).join('')}
            </div>
            <div class="text-center text-muted small">
                <i class="bi bi-qr-code-scan me-1"></i>请店长使用专用APP扫码授权, 或点击下方按钮完成授权流程
            </div>
        `;
        $('#approvalBody').html(html);
        this._pendingApprovalData = { form, ins, result };
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('approvalModal'));
        modal.show();
    }

    async _handleApproval(approved, authInfo = null) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('approvalModal'));
        if (modal) modal.hide();
        if (approved) {
            const extra = authInfo ? { approvedBy: '店长' + (authInfo.managerId || ''), approvedAt: Date.now(), authToken: authInfo } : {};
            await this._saveRecordWithStatus('approved', extra);
        } else {
            await this._saveRecordWithStatus('rejected');
            this._showToast('报价单已驳回', 'warning');
        }
    }

    async _showDetail(record) {
        this._currentDetail = record;
        $('#detailOrderNo').text(record.orderNo);
        const price = record.priceDetail || {};
        const cat = ({gold:'黄金K金',platinum:'铂金钯金',diamond:'钻石彩宝',jade:'翡翠和田玉',pearl:'珍珠琥珀'})[record.category] || record.category;
        const photos = (record.photos || []).map(p => `<img src="${p}" alt="photo">`).join('');
        const ins = record.inspection || {};
        const insSummary = this._renderInspectionSummary(record.category, ins);
        const status = ({draft:'草稿',pending:'待审批',approved:'已批准',rejected:'已驳回',completed:'已完成'})[record.status] || record.status;
        const html = `
            <div class="row g-4 mb-3">
                <div class="col-md-5">
                    <div class="detail-section">
                        <div class="detail-section-title">顾客信息</div>
                        <div class="detail-grid">
                            <div class="detail-item"><span class="k">姓名</span><span class="v">${record.customer?.name || '--'}</span></div>
                            <div class="detail-item"><span class="k">电话</span><span class="v">${record.customer?.phone || '--'}</span></div>
                            <div class="detail-item"><span class="k">身份证</span><span class="v">${record.customer?.idNo || '--'}</span></div>
                            <div class="detail-item"><span class="k">地址</span><span class="v">${record.customer?.address || '--'}</span></div>
                        </div>
                    </div>
                    <div class="detail-section">
                        <div class="detail-section-title">首饰信息</div>
                        <div class="detail-grid">
                            <div class="detail-item"><span class="k">品类</span><span class="v">${cat}</span></div>
                            <div class="detail-item"><span class="k">品牌</span><span class="v">${record.jewelry?.brand || '--'}</span></div>
                            <div class="detail-item"><span class="k">款式</span><span class="v">${record.jewelry?.model || '--'}</span></div>
                            <div class="detail-item"><span class="k">纯度</span><span class="v">${record.jewelry?.purity || '--'}</span></div>
                            <div class="detail-item"><span class="k">重量</span><span class="v">${record.jewelry?.weight ? record.jewelry.weight + ' g' : '--'}</span></div>
                            <div class="detail-item"><span class="k">证书号</span><span class="v">${record.certificate?.no || '--'}</span></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-7">
                    <div class="detail-section">
                        <div class="detail-section-title">报价明细</div>
                        <div class="mb-2 p-3 rounded text-center" style="background:linear-gradient(135deg,var(--gold-gradient-light),#fff);border:2px solid var(--gold-border)">
                            <div class="text-muted small">最终回收价</div>
                            <div class="price-display-lg" style="font-size:1.8rem">${formatCurrency(record.finalPrice || 0)}</div>
                            <div class="mt-1"><span class="status-badge ${({draft:'status-draft',pending:'status-pending',approved:'status-approved',rejected:'status-rejected',completed:'status-completed'})[record.status] || ''}">${status}</span></div>
                        </div>
                        ${(price.detail || []).map(d => `
                            <div class="price-breakdown-item ${d.highlight ? 'highlight' : ''}">
                                <span class="label">${d.label}</span>
                                <span class="value">${d.value}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="detail-section">
                        <div class="detail-section-title">流程信息</div>
                        <div class="detail-grid">
                            <div class="detail-item"><span class="k">门店</span><span class="v">${record.storeId || '--'}</span></div>
                            <div class="detail-item"><span class="k">鉴定师</span><span class="v">${record.inspector?.name || '--'}</span></div>
                            <div class="detail-item"><span class="k">登记时间</span><span class="v">${formatDate(record.createdAt)}</span></div>
                            <div class="detail-item"><span class="k">更新时间</span><span class="v">${formatDate(record.updatedAt)}</span></div>
                            <div class="detail-item"><span class="k">审批人</span><span class="v">${record.approvedBy || '--'}</span></div>
                            <div class="detail-item"><span class="k">同步状态</span><span class="v">${record.synced ? '<span class="text-success"><i class="bi bi-cloud-check"></i>已同步</span>' : '<span class="text-warning"><i class="bi bi-cloud-arrow-up"></i>待同步</span>'}</span></div>
                        </div>
                    </div>
                </div>
            </div>
            ${insSummary ? `<div class="detail-section"><div class="detail-section-title">检测记录</div>${insSummary}</div>` : ''}
            ${photos ? `<div class="detail-section"><div class="detail-section-title">照片 (${record.photos.length})</div><div class="photo-gallery">${photos}</div></div>` : ''}
            ${record.remark ? `<div class="detail-section"><div class="detail-section-title">备注</div><div class="p-2 small text-muted" style="background:#FAFAFA;border-radius:8px">${record.remark}</div></div>` : ''}
        `;
        $('#detailBody').html(html);
        this._currentDetail = record;
        const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('detailModal'));
        modal.show();
    }

    _renderInspectionSummary(category, ins) {
        if (!ins || !Object.keys(ins).length) return '<div class="text-muted small">暂无检测记录</div>';
        const flat = [];
        for (const [stepId, stepData] of Object.entries(ins)) {
            if (!stepData) continue;
            for (const [k, v] of Object.entries(stepData)) {
                if (v === '' || v === undefined || v === null) continue;
                if (typeof v === 'number' && v === 0) continue;
                const label = this._guessLabel(stepId, k);
                flat.push({ step: stepId, label, value: v });
            }
        }
        if (!flat.length) return '<div class="text-muted small">暂无检测记录</div>';
        return `
            <div class="detail-grid" style="grid-template-columns: repeat(3, 1fr)">
                ${flat.slice(0, 18).map(f => `
                    <div class="detail-item">
                        <span class="k">${f.label}</span>
                        <span class="v">${typeof f.value === 'number' ? (Number.isInteger(f.value) ? f.value : f.value.toFixed(2)) : f.value}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    _guessLabel(stepId, key) {
        const map = {
            fireResult: '火烧试金结论', fireNote: '火烧备注',
            densityAir: '空气中称重', densityWater: '水中称重', densityResult: '密度结果', densityPurity: '密度推算纯度',
            xrfAu: '金含量(%)', xrfAg: '银含量(%)', xrfCu: '铜含量(%)', xrfZn: '锌含量(%)', xrfOther: '其他(%)', xrfConclusion: 'XRF结论',
            markExist: '印记标识', markNote: '印记备注',
            touchMatch: '划痕对比', touchNote: '试金石备注',
            xrfPt: '铂含量(%)', xrfPd: '钯含量(%)', xrfRh: '铑含量(%)',
            carat: '重量(ct)', color: '颜色', clarity: '净度', cut: '切工', polish: '抛光', symmetry: '对称', fluorescence: '荧光',
            certNo: '证书编号', certIssuer: '发证机构', certMatch: '证物核对', certNote: '证书备注',
            thermalConduct: '热导反应', inclusion: '内含物', scopeConclusion: '最终判定',
            type: '玉石种类', origin: '产地判断',
            sc_kind: '种分', sc_water: '水头', sc_color: '色泽', sc_base: '地子', sc_work: '雕工', totalScore: '综合评分',
            crack: '裂纹', cotton: '棉絮', blackspot: '黑点', defectNote: '瑕疵描述',
            size: '直径(mm)', quantity: '数量', shape: '形状', weight_g: '总重(g)',
            q_luster: '光泽/通透', q_surface: '表皮/纯净', q_color: '颜色/浓度', q_match: '匹配/工艺',
            treatment: '优化处理', setting: '配托材质', note: '备注'
        };
        return map[key] || `${stepId}:${key}`;
    }

    async _refreshPending() {
        const list = await this.store.queryRecords({ status: 'pending' });
        $('#pendingBadge').text(list.length);
        $('#pendingCount').text(list.length);
        const $container = $('#pendingContainer');
        if (!list.length) {
            $container.html(`<div class="text-center py-5 text-muted"><i class="bi bi-check2-circle" style="font-size:4rem;opacity:.3"></i><p class="mt-3">暂无待审批的报价单</p></div>`);
            return;
        }
        $container.html(list.map(r => `
            <div class="pending-card">
                <div class="pending-card-header">
                    <div>
                        <code class="fw-bold">${r.orderNo}</code>
                        <span class="ms-2 badge bg-gold">${({gold:'黄金',platinum:'铂金',diamond:'钻石',jade:'玉石',pearl:'珍珠'})[r.category] || r.category}</span>
                        <span class="ms-2 text-muted small">${formatDate(r.createdAt)}</span>
                    </div>
                    <div class="fw-bold text-warning">${formatCurrency(r.finalPrice || 0)}</div>
                </div>
                <div class="row">
                    <div class="col-md-6 small">
                        <span class="text-muted">顾客:</span> <strong>${r.customer?.name || '--'}</strong> · ${r.customer?.phone || ''}
                    </div>
                    <div class="col-md-6 small">
                        <span class="text-muted">门店/鉴定师:</span> ${r.storeId || '--'} · ${r.inspector?.name || '--'}
                    </div>
                    <div class="col-md-6 mt-1 small">
                        <span class="text-muted">首饰:</span> ${r.jewelry?.brand || ''} ${r.jewelry?.purity || ''} ${r.jewelry?.weight ? r.jewelry.weight + 'g' : ''}
                    </div>
                    <div class="col-md-6 mt-1 small">
                        <span class="text-muted">利润率预估:</span>
                        <strong class="text-success">${r.priceDetail?.marketValue ? (((r.priceDetail.marketValue - (r.finalPrice || 0)) / r.priceDetail.marketValue) * 100).toFixed(1) + '%' : '--'}</strong>
                    </div>
                </div>
                <div class="mt-2 d-flex justify-content-end gap-2">
                    <button class="btn btn-sm btn-outline-secondary btn-view-detail" data-order="${r.orderNo}"><i class="bi bi-eye"></i>查看</button>
                    <button class="btn btn-sm btn-outline-danger btn-reject-quick" data-order="${r.orderNo}"><i class="bi bi-x-lg"></i>驳回</button>
                    <button class="btn btn-sm btn-gold btn-approve-quick" data-order="${r.orderNo}"><i class="bi bi-check-lg"></i>批准</button>
                </div>
            </div>
        `).join(''));
        $container.off('click').on('click', '.btn-view-detail', (e) => {
            const orderNo = $(e.currentTarget).data('order');
            this.store.getRecord(orderNo).then(r => r && this._showDetail(r));
        }).on('click', '.btn-approve-quick', async (e) => {
            const orderNo = $(e.currentTarget).data('order');
            this._requestScanAuth('快速审批授权', async (auth) => {
                await this.store.updateRecordStatus(orderNo, 'approved', {
                    approvedAt: Date.now(),
                    approvedBy: '店长' + (auth.managerId || ''),
                    authToken: auth
                });
                this._showToast('已批准 (已扫码授权)', 'success');
                this._refreshPending();
            });
        }).on('click', '.btn-reject-quick', async (e) => {
            const orderNo = $(e.currentTarget).data('order');
            await this.store.updateRecordStatus(orderNo, 'rejected');
            this._showToast('已驳回', 'warning');
            this._refreshPending();
        });
    }

    async _refreshSyncStats() {
        const s = await this.store.getAllStats();
        $('#localCount').text(s.local);
        $('#pendingSyncCount').text(s.pendingSync);
        $('#conflictCount').text(s.conflicts);
        const $sb = $('#syncBadge');
        if (s.pendingSync > 0) $sb.removeClass('d-none').text(`待同步${s.pendingSync}`);
        else $sb.addClass('d-none');
        if (!navigator.onLine) {
            $('#netStatus').removeClass('text-success').addClass('text-danger').html('<i class="bi bi-wifi-off me-1"></i>离线');
        }
        const state = this.store.getState();
        if (state.sync.conflicts.length) {
            $('#conflictList').html(state.sync.conflicts.map(c => `
                <div class="conflict-item">
                    <div class="conflict-item-title">
                        <i class="bi bi-exclamation-triangle"></i>
                        单号: <code>${c.orderNo}</code>
                        <small class="text-muted ms-2">本地/远端价格不一致</small>
                    </div>
                    <div class="conflict-values">
                        <div class="conflict-value-box local">
                            <div class="small text-muted fw-bold mb-1">本地版本 <i class="bi bi-laptop"></i></div>
                            <div class="small">价格: <strong class="text-primary">${formatCurrency(c.local.finalPrice)}</strong></div>
                            <div class="small">时间: ${formatDate(c.local.updatedAt || c.local.createdAt)}</div>
                            <div class="small">门店: ${c.local.storeId}</div>
                        </div>
                        <div class="conflict-value-box remote">
                            <div class="small text-muted fw-bold mb-1">远端版本 <i class="bi bi-cloud"></i></div>
                            <div class="small">价格: <strong class="text-warning">${formatCurrency(c.remote.finalPrice)}</strong></div>
                            <div class="small">时间: ${formatDate(c.remote.lastModified || c.remote.updatedAt)}</div>
                            <div class="small">差价: <strong class="${c.local.finalPrice > c.remote.finalPrice ? 'text-danger' : 'text-success'}">${formatCurrency(Math.abs(c.local.finalPrice - c.remote.finalPrice))}</strong></div>
                        </div>
                    </div>
                    <div class="d-flex gap-2 justify-content-end">
                        <button class="btn btn-sm btn-outline-primary btn-keep-local" data-order="${c.orderNo}">采用本地</button>
                        <button class="btn btn-sm btn-outline-warning btn-keep-remote" data-order="${c.orderNo}">采用远端</button>
                    </div>
                </div>
            `).join(''));
            $('#conflictList').off('click').on('click', '.btn-keep-local', (e) => {
                const orderNo = $(e.currentTarget).data('order');
                this.store.resolveConflict(orderNo, 'local');
                this._refreshSyncStats();
                this._showToast('已采用本地版本', 'success');
            }).on('click', '.btn-keep-remote', (e) => {
                const orderNo = $(e.currentTarget).data('order');
                this.store.resolveConflict(orderNo, 'remote');
                this._refreshSyncStats();
                this._showToast('已采用远端版本', 'info');
            });
        } else {
            $('#conflictList').html('<div class="text-center py-4 text-muted small">暂无冲突记录</div>');
        }
    }

    async _doSync() {
        this._showToast('正在同步数据...', 'info');
        await this.store.simulateSync();
    }

    _initCharts() {
        const opts = { textStyle: { fontFamily: '-apple-system, "PingFang SC", sans-serif' } };
        this.charts.trend = echarts.init(document.getElementById('chartTrend'), null, opts);
        this.charts.category = echarts.init(document.getElementById('chartCategory'), null, opts);
        this.charts.store = echarts.init(document.getElementById('chartStore'), null, opts);
        this.charts.inspector = echarts.init(document.getElementById('chartInspector'), null, opts);
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(c => c && c.resize());
        });
    }

    async _renderReports() {
        const rangeKey = $('#reportRange').val() || 'week';
        const { start, end } = getDateRange(rangeKey);
        const all = await this.store.queryRecords({});
        const records = all.filter(r => {
            const t = r.createdAt || 0;
            if (start && t < start) return false;
            if (end && t > end) return false;
            return true;
        });
        const prevStart = start ? (start - (end - start)) : null;
        const prevRecords = prevStart ? all.filter(r => {
            const t = r.createdAt || 0;
            return t >= prevStart && t < start;
        }) : [];

        const kpi = calcKpi(records, prevRecords);
        this._renderKpi(kpi, rangeKey);

        const trend = groupRecordsByDate(records);
        this.charts.trend.setOption({
            tooltip: { trigger: 'axis', valueFormatter: v => typeof v === 'number' ? v.toLocaleString() : v },
            legend: { data: ['回收件数', '回收金额(元)'], top: 0 },
            grid: { left: 50, right: 50, top: 40, bottom: 30 },
            xAxis: { type: 'category', data: trend.labels, axisLine: { lineStyle: { color: '#E5E7EB' } } },
            yAxis: [
                { type: 'value', name: '件数', splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
                { type: 'value', name: '金额', splitLine: { show: false } }
            ],
            series: [
                {
                    name: '回收件数', type: 'bar', data: trend.counts, barWidth: 18,
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#FBBF24' }, { offset: 1, color: '#F59E0B' }
                        ])
                    }
                },
                {
                    name: '回收金额(元)', type: 'line', yAxisIndex: 1, data: trend.amounts,
                    smooth: true, symbol: 'circle', symbolSize: 8,
                    lineStyle: { width: 3, color: '#0EA5E9' },
                    itemStyle: { color: '#0EA5E9', borderColor: '#fff', borderWidth: 2 }
                }
            ]
        });

        const cat = groupRecordsByCategory(records);
        this.charts.category.setOption({
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { bottom: 0, left: 'center' },
            series: [{
                type: 'pie', radius: ['45%', '72%'], center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
                data: cat.pie.length ? cat.pie : [{ name: '暂无数据', value: 1, itemStyle: { color: '#E5E7EB' } }]
            }]
        });

        const store = groupByStore(records);
        this.charts.store.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            grid: { left: 90, right: 30, top: 20, bottom: 30 },
            xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
            yAxis: { type: 'category', data: store.bar.labels.slice(0, 10).reverse(), axisLine: { lineStyle: { color: '#E5E7EB' } } },
            series: [{
                type: 'bar', data: store.bar.amounts.slice(0, 10).reverse(), barWidth: 16,
                itemStyle: {
                    borderRadius: [0, 6, 6, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#FCD34D' }, { offset: 1, color: '#D97706' }
                    ])
                },
                label: { show: true, position: 'right', formatter: p => '¥' + (p.value / 10000).toFixed(1) + 'w', fontSize: 11 }
            }]
        });

        const ins = groupByInspector(records);
        this.charts.inspector.setOption({
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
            legend: { data: ['检测件数', '金额(元)'], top: 0 },
            grid: { left: 50, right: 50, top: 40, bottom: 30 },
            xAxis: { type: 'category', data: ins.bar.labels, axisLine: { lineStyle: { color: '#E5E7EB' } } },
            yAxis: [
                { type: 'value', name: '件数', splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
                { type: 'value', name: '金额', splitLine: { show: false } }
            ],
            series: [
                {
                    name: '检测件数', type: 'bar', data: ins.bar.counts, barWidth: 20,
                    itemStyle: {
                        borderRadius: [6, 6, 0, 0],
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#34D399' }, { offset: 1, color: '#10B981' }
                        ])
                    }
                },
                {
                    name: '金额(元)', type: 'line', yAxisIndex: 1, data: ins.bar.amounts,
                    smooth: true, symbol: 'diamond', symbolSize: 10,
                    lineStyle: { width: 3, color: '#8B5CF6' }, itemStyle: { color: '#8B5CF6' }
                }
            ]
        });
        this._cachedReportRecords = records;
    }

    _renderKpi(kpi, rangeKey) {
        const rangeLabel = { today: '今日', week: '本周', month: '本月', quarter: '本季度', custom: '自定义' }[rangeKey] || '本期';
        const growthHtml = kpi.growthRate >= 0
            ? `<span class="kpi-delta up"><i class="bi bi-arrow-up-right me-1"></i>环比 +${kpi.growthRate}%</span>`
            : `<span class="kpi-delta down"><i class="bi bi-arrow-down-right me-1"></i>环比 ${kpi.growthRate}%</span>`;
        const html = `
            <div class="kpi-row">
                <div class="kpi-card">
                    <div class="kpi-label">${rangeLabel}回收件数</div>
                    <div class="kpi-value">${kpi.totalRecords.toLocaleString()}</div>
                    ${growthHtml}
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">${rangeLabel}回收总额</div>
                    <div class="kpi-value">¥${(kpi.totalAmount / 10000).toFixed(2)}<span class="fs-5 text-muted">万</span></div>
                    <div class="kpi-delta up"><i class="bi bi-graph-up me-1"></i>目标达成率 ${Math.min(100, (kpi.totalAmount / 500000 * 100)).toFixed(1)}%</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">平均回收单价</div>
                    <div class="kpi-value">¥${kpi.avgPrice.toLocaleString()}</div>
                    <div class="kpi-delta ${kpi.growthRate >= 0 ? 'up' : 'down'}"><i class="bi ${kpi.growthRate >= 0 ? 'bi-arrow-up' : 'bi-arrow-down'}-circle me-1"></i>客单价趋势</div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-label">热门品类</div>
                    <div class="kpi-value" style="font-size:1.4rem;color:var(--gold-700)">${kpi.topCategory}</div>
                    <div class="kpi-delta up"><i class="bi bi-fire me-1"></i>品类排名 TOP1</div>
                </div>
            </div>
        `;
        const $page = $('#page-report');
        if (!$page.find('.kpi-row').length) {
            $page.find('.page-header').after(html);
        } else {
            $page.find('.kpi-row').replaceWith($(html).find('.kpi-row'));
        }
    }

    async _exportReport() {
        const records = this._cachedReportRecords || await this.store.queryRecords({});
        if (!records.length) {
            this._showToast('无数据可导出', 'warning');
            return;
        }
        exportToExcel(records, `珠宝回收报表_${this._dateStr()}.xlsx`);
        this._showToast(`报表已导出 (${records.length} 条)`, 'success');
    }

    async _seedDemoDataIfEmpty() {
        const all = await this.store.queryRecords({});
        if (all.length >= 50) return;
        const categories = ['gold', 'platinum', 'diamond', 'jade', 'pearl'];
        const catWeight = [0.45, 0.15, 0.18, 0.12, 0.10];
        const names = ['王女士', '李先生', '张阿姨', '刘先生', '陈女士', '赵先生', '孙女士', '周先生', '吴女士', '郑先生',
            '冯女士', '何先生', '黄女士', '林先生', '徐女士', '高先生', '马女士', '朱先生', '胡女士', '郭先生'];
        const brands = ['周大福', '老凤祥', '周生生', '六福珠宝', '中国黄金', '老庙黄金', '菜百', '潮宏基', '明牌', '周大生', '谢瑞麟', 'DR', '金伯利', '戴梦得', '自营'];
        const statuses = ['completed', 'completed', 'completed', 'approved', 'completed', 'pending', 'rejected'];
        const stores = Array.from({ length: 18 }, (_, i) => 'store' + String(i + 1).padStart(3, '0'));
        const inspectors = [
            { id: 'INS001', name: '张鉴定师' }, { id: 'INS002', name: '李鉴定师' }, { id: 'INS003', name: '王鉴定师' },
            { id: 'INS004', name: '赵鉴定师' }, { id: 'INS005', name: '陈鉴定师' }, { id: 'INS006', name: '刘鉴定师' }
        ];
        const now = Date.now();
        const demoCount = 80;
        for (let i = 0; i < demoCount; i++) {
            const rnd = Math.random();
            let cat = categories[0], acc = 0;
            for (let j = 0; j < categories.length; j++) {
                acc += catWeight[j];
                if (rnd < acc) { cat = categories[j]; break; }
            }
            const daysAgo = Math.floor(Math.random() * 60);
            const hoursAgo = Math.floor(Math.random() * 24);
            const minsAgo = Math.floor(Math.random() * 60);
            const ts = now - (daysAgo * 86400000) - (hoursAgo * 3600000) - (minsAgo * 60000);
            const phone = '1' + [3, 5, 7, 8, 9][Math.floor(Math.random() * 5)] + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
            const catData = this._demoCategoryData(cat);
            const finalPrice = catData.basePrice * (0.7 + Math.random() * 0.35);
            const record = {
                orderNo: this.store.generateOrderNo(stores[i % stores.length]),
                storeId: stores[i % stores.length],
                inspector: inspectors[i % inspectors.length],
                customer: {
                    name: names[i % names.length] + (i > 20 ? (Math.floor(i / 20)) : ''),
                    phone,
                    idNo: Math.random() > 0.4 ? '310' + String(Math.floor(Math.random() * 1e15)).padStart(15, '0') : '',
                    address: ['上海市黄浦区', '上海市徐汇区', '上海市浦东新区', '上海市静安区', '上海市长宁区'][i % 5]
                },
                category: cat,
                jewelry: {
                    brand: brands[i % brands.length],
                    model: catData.model,
                    purity: catData.purity,
                    weight: catData.weight,
                    color_desc: catData.desc || ''
                },
                certificate: {
                    no: catData.cert ? 'NGTC' + String(Math.floor(Math.random() * 1e10)).padStart(10, '0') : '',
                    issuer: catData.cert ? 'NGTC' : ''
                },
                inspection: catData.inspection || {},
                photos: [],
                remark: Math.random() > 0.75 ? '老顾客介绍, 价格可稍优惠' : '',
                priceDetail: {
                    finalPrice: +finalPrice.toFixed(2),
                    subtotal: +(finalPrice * 1.08).toFixed(2),
                    metalValue: +(finalPrice * (cat === 'diamond' ? 0.3 : cat === 'jade' || cat === 'pearl' ? 0.05 : 0.9)).toFixed(2),
                    stoneValue: +(finalPrice * (cat === 'diamond' ? 0.7 : 0)).toFixed(2),
                    extraValue: +(finalPrice * (cat === 'jade' || cat === 'pearl' ? 0.95 : 0)).toFixed(2),
                    adjustCoef: +(0.9 + Math.random() * 0.08).toFixed(3),
                    detail: [
                        { label: '基准价', value: formatCurrency(catData.basePrice) },
                        { label: '折旧/成色系数', value: '-' + formatCurrency(catData.basePrice * 0.1) },
                        { label: '回收系数', value: formatCurrency(finalPrice) },
                        { label: '最终回收价', value: formatCurrency(finalPrice), highlight: true }
                    ],
                    marketValue: +(finalPrice * (1.05 + Math.random() * 0.2)).toFixed(2)
                },
                finalPrice: +finalPrice.toFixed(2),
                status: statuses[i % statuses.length],
                createdAt: ts,
                updatedAt: ts + Math.floor(Math.random() * 3600000),
                synced: Math.random() > 0.08,
                approvedBy: Math.random() > 0.4 ? '李店长' : null,
                approvedAt: ts + Math.floor(Math.random() * 7200000)
            };
            await this.store.saveRecord(record);
        }
        console.info(`[Seed] 已生成 ${demoCount} 条演示数据`);
    }

    _demoCategoryData(cat) {
        switch (cat) {
            case 'gold': {
                const purities = [
                    ['9999', 1.0], ['9995', 0.999], ['999', 0.998], ['990', 0.985],
                    ['750', 0.745], ['916', 0.912], ['585', 0.58]
                ];
                const [p, mul] = purities[Math.floor(Math.random() * purities.length)];
                const w = +(2 + Math.random() * 40).toFixed(3);
                return {
                    purity: p, weight: w, cert: false,
                    model: ['足金手镯', '黄金项链', '黄金戒指', '黄金耳环', '金条', '黄金吊坠'][Math.floor(Math.random() * 6)],
                    basePrice: +(730 * mul * w * 0.98).toFixed(2),
                    inspection: {
                        fire_test: { fireResult: ['normal', 'normal', 'normal', 'discolor'][Math.floor(Math.random() * 4)] },
                        density: { densityAir: w, densityWater: +(w * 0.95).toFixed(3), densityResult: +(19.3 * mul).toFixed(2), densityPurity: '推算符合' },
                        xrf: { xrfAu: +(99 * mul).toFixed(2), xrfConclusion: 'pass' }
                    }
                };
            }
            case 'platinum': {
                const w = +(3 + Math.random() * 20).toFixed(3);
                return {
                    purity: ['PT950', 'PT900'][Math.floor(Math.random() * 2)], weight: w, cert: false,
                    model: ['铂金项链', '铂金戒指', '铂金手镯', '铂金耳钉'][Math.floor(Math.random() * 4)],
                    basePrice: +(850 * w * 0.95).toFixed(2),
                    inspection: {
                        mark: { markExist: ['PT950', 'PT900', 'unclear'][Math.floor(Math.random() * 3)] },
                        xrf_plat: { xrfPt: 94.5 + Math.random() * 3, xrfPd: 2 + Math.random() * 3, xrfConclusion: 'pass' }
                    }
                };
            }
            case 'diamond': {
                const ct = +(0.15 + Math.random() * 2).toFixed(3);
                const colors = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
                const clarities = ['FL', 'IF', 'VVS1', 'VVS2', 'VS1', 'VS2', 'SI1', 'SI2'];
                const cuts = ['EX', 'VG', 'GD', 'F'];
                return {
                    purity: 'AU750', weight: +(1 + Math.random() * 5).toFixed(3), cert: true,
                    model: `${ct}ct钻戒`,
                    desc: `${colors[Math.floor(Math.random()*8)]}色, ${clarities[Math.floor(Math.random()*8)]}净度`,
                    basePrice: +(ct * (12000 + Math.random() * 40000)).toFixed(2),
                    inspection: {
                        basic_4c: {
                            carat: ct,
                            color: colors[Math.floor(Math.random() * colors.length)],
                            clarity: clarities[Math.floor(Math.random() * clarities.length)],
                            cut: cuts[Math.floor(Math.random() * cuts.length)],
                            polish: cuts[Math.floor(Math.random() * 3)],
                            symmetry: cuts[Math.floor(Math.random() * 3)],
                            fluorescence: ['NONE', 'FAINT', 'MEDIUM', 'STRONG'][Math.floor(Math.random() * 4)]
                        },
                        cert_verify: { certMatch: Math.random() > 0.1 ? 'match' : 'weight_match', certIssuer: Math.random() > 0.5 ? 'GIA' : 'NGTC' },
                        scope_test: { scopeConclusion: 'natural_diamond' }
                    }
                };
            }
            case 'jade': {
                const types = ['feicui_A', 'hetian_seed', 'hetian_mountain', 'jasper', 'nanhong'];
                return {
                    purity: types[Math.floor(Math.random() * types.length)],
                    weight: +(8 + Math.random() * 80).toFixed(3), cert: true,
                    model: ['翡翠手镯', '和田玉吊坠', '碧玉手串', '翡翠挂件', '南红手串'][Math.floor(Math.random() * 5)],
                    basePrice: +(1500 + Math.random() * 30000).toFixed(2),
                    inspection: {
                        type_judge: { type: types[Math.floor(Math.random() * types.length)], origin: ['缅甸', '新疆和田', '俄罗斯', '云南保山'][Math.floor(Math.random() * 4)] },
                        score_card: {
                            sc_kind: 5 + Math.floor(Math.random() * 6),
                            sc_water: 5 + Math.floor(Math.random() * 6),
                            sc_color: 5 + Math.floor(Math.random() * 6),
                            sc_base: 5 + Math.floor(Math.random() * 6),
                            sc_work: 5 + Math.floor(Math.random() * 6),
                            totalScore: ''
                        },
                        defects: { crack: ['none', 'hair', 'obvious'][Math.floor(Math.random() * 3)], cotton: ['none', 'micro', 'visible'][Math.floor(Math.random() * 3)], blackspot: 'none' }
                    }
                };
            }
            case 'pearl': {
                const types = ['seawater_akoya', 'freshwater_edison', 'seawater_south_gold', 'seawater_tahiti', 'amber', 'beeswax'];
                const t = types[Math.floor(Math.random() * types.length)];
                const isAmber = t === 'amber' || t === 'beeswax';
                return {
                    purity: t,
                    weight: isAmber ? +(3 + Math.random() * 30).toFixed(2) : '',
                    cert: Math.random() > 0.5,
                    model: isAmber ? (t === 'amber' ? '琥珀吊坠' : '蜜蜡手串') : ['珍珠项链', '珍珠耳钉', '珍珠戒指', '珍珠吊坠'][Math.floor(Math.random() * 4)],
                    basePrice: +(300 + Math.random() * 15000).toFixed(2),
                    inspection: {
                        basic: {
                            type: t,
                            size: isAmber ? '' : +(6 + Math.random() * 10).toFixed(1),
                            quantity: isAmber ? '' : (t === 'seawater_akoya' ? (Math.random() > 0.5 ? 1 : 38) : (Math.random() > 0.4 ? 1 : 42)),
                            shape: ['perfect_round', 'round', 'drop', 'baroque'][Math.floor(Math.random() * 4)],
                            weight_g: isAmber ? +(3 + Math.random() * 30).toFixed(2) : ''
                        },
                        quality: {
                            q_luster: 5 + Math.floor(Math.random() * 6),
                            q_surface: 5 + Math.floor(Math.random() * 6),
                            q_color: 5 + Math.floor(Math.random() * 6),
                            q_match: 5 + Math.floor(Math.random() * 6)
                        },
                        additional: { treatment: Math.random() > 0.8 ? 'dye' : 'natural' }
                    }
                };
            }
        }
        return { purity: '999', weight: 10, cert: false, model: '黄金首饰', basePrice: 5000 };
    }

    async _refreshAll() {
        const p = this.store.getState().goldPrices;
        if (p) this._updatePriceMarquee(p);
        await this._refreshPending();
        await this._refreshSyncStats();
    }

    _openRapaportModal() {
        const cur = this.store.getState().diamondPriceList;
        $('#rapaportPreview').html(cur && Object.keys(cur).length
            ? `<div class="text-success small"><i class="bi bi-check-circle me-1"></i>当前已加载 <strong>${Object.keys(cur).length}</strong> 条钻石报价</div>`
            : `<div class="text-muted small"><i class="bi bi-info-circle me-1"></i>尚未加载任何钻石报价表</div>`);
        $('#rapaportStatus').addClass('d-none');
        $('#rapaportFile').val('');
        $('#btnImportRapaport').prop('disabled', true);
        this._rapaportParsedData = null;
        const m = bootstrap.Modal.getOrCreateInstance(document.getElementById('rapaportModal'));
        m.show();
    }

    _initRapaportUpload() {
        $('#rapaportFile').on('change', async (e) => {
            const file = e.target.files[0];
            const $status = $('#rapaportStatus');
            const $btn = $('#btnImportRapaport');
            $status.removeClass('d-none alert-danger alert-success').addClass('alert alert-info');
            $status.html('<i class="bi bi-hourglass-split me-1"></i>正在解析文件...');
            $btn.prop('disabled', true);
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                $status.removeClass('alert-info').addClass('alert-danger').html('<i class="bi bi-x-circle me-1"></i>文件过大, 最大支持10MB');
                return;
            }
            try {
                const text = await file.text();
                const data = parseDiamondRapaport(text);
                const count = Object.keys(data).length;
                if (!count) throw new Error('未解析到有效数据');
                this._rapaportParsedData = data;
                const sample = Object.entries(data).slice(0, 5).map(([k, v]) => {
                    const [wt, col, cla] = k.split('|');
                    return `<tr><td>${wt}ct</td><td>${col}</td><td>${cla}</td><td class="text-end">$${v.toLocaleString()}/ct</td></tr>`;
                }).join('');
                $status.removeClass('alert-info').addClass('alert-success').html(`<i class="bi bi-check-circle me-1"></i>解析成功, 共 <strong>${count}</strong> 条报价`);
                $('#rapaportPreview').html(`
                    <div class="mt-2"><strong>数据预览 (前5条):</strong></div>
                    <div class="table-responsive mt-1"><table class="table table-sm table-bordered small">
                        <thead class="table-light"><tr><th>重量</th><th>颜色</th><th>净度</th><th class="text-end">单价</th></tr></thead>
                        <tbody>${sample}</tbody>
                    </table></div>
                `);
                $btn.prop('disabled', false);
            } catch (err) {
                $status.removeClass('alert-info').addClass('alert-danger').html(`<i class="bi bi-x-circle me-1"></i>解析失败: ${err.message}`);
            }
        });
        $('#btnImportRapaport').on('click', async () => {
            if (!this._rapaportParsedData) return;
            await this.store.saveDiamondPriceList(this._rapaportParsedData);
            const m = bootstrap.Modal.getInstance(document.getElementById('rapaportModal'));
            if (m) m.hide();
        });
    }

    _initScanAuth() {
        this._scanAuthCallback = null;
        const $input = $('#scanAuthInput');
        const closeModal = () => {
            const m = bootstrap.Modal.getInstance(document.getElementById('scanAuthModal'));
            if (m) m.hide();
        };
        $('#btnScanCancel, #btnScanCancel2').on('click', () => {
            this._scanAuthCallback = null;
            closeModal();
        });
        $input.on('keydown', (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const val = $input.val();
                this._verifyScanInput(String(val || '').trim());
            }
        });
        $('#scanAuthModal').on('shown.bs.modal', () => {
            setTimeout(() => $input.trigger('focus'), 100);
        }).on('hidden.bs.modal', () => {
            $input.val('');
            $('#scanAuthResult').html('');
            $('#scanAuthHint').text('等待扫码输入...');
        });
    }

    _requestScanAuth(actionLabel, callback) {
        this._scanAuthCallback = callback;
        $('#scanAuthHint').text(`请店长扫码完成: ${actionLabel} (扫码枪自动回车确认)`);
        $('#scanAuthResult').html('');
        $('#scanAuthInput').val('');
        const m = bootstrap.Modal.getOrCreateInstance(document.getElementById('scanAuthModal'));
        m.show();
    }

    _verifyScanInput(code) {
        const $result = $('#scanAuthResult');
        const $hint = $('#scanAuthHint');
        if (!code) {
            $result.html(`<div class="alert alert-danger small py-2 mb-0"><i class="bi bi-x-circle me-1"></i>请输入授权码</div>`);
            return;
        }
        $hint.text('正在验证授权...');
        setTimeout(() => {
            const auth = this.store.verifyManagerAuth(code);
            if (auth.success) {
                $result.html(`<div class="alert alert-success small py-2 mb-0"><i class="bi bi-check-circle me-1"></i>验证通过: 店长 ${auth.managerId}, 即将执行操作...</div>`);
                $hint.text('授权验证成功');
                const cb = this._scanAuthCallback;
                this._scanAuthCallback = null;
                setTimeout(() => {
                    const m = bootstrap.Modal.getInstance(document.getElementById('scanAuthModal'));
                    if (m) m.hide();
                    if (cb) try { cb(auth); } catch (err) { console.error(err); }
                }, 600);
            } else {
                $result.html(`<div class="alert alert-danger small py-2 mb-0"><i class="bi bi-shield-exclamation me-1"></i>授权失败: ${auth.reason === 'invalid' ? '授权码不正确, 请联系管理员' : '请输入授权码'}</div>`);
                $hint.text('验证失败, 请重试');
                $('#scanAuthInput').val('').trigger('focus');
            }
        }, 350);
    }

    _buildQuotePrintTemplate(record) {
        const cat = ({gold:'黄金K金',platinum:'铂金钯金',diamond:'钻石彩宝',jade:'翡翠和田玉',pearl:'珍珠琥珀'})[record.category] || record.category;
        const price = record.priceDetail || {};
        const ins = record.inspection || {};
        const insRows = [];
        for (const [stepId, stepData] of Object.entries(ins)) {
            if (!stepData) continue;
            for (const [k, v] of Object.entries(stepData)) {
                if (v === '' || v === null || v === undefined) continue;
                if (typeof v === 'number' && v === 0 && k !== 'carat' && !k.startsWith('sc_')) continue;
                const labelMap = {
                    fireResult: '火烧试金结论', fireNote: '火烧备注',
                    densityAir: '空气中称重(g)', densityWater: '水中称重(g)', densityResult: '密度结果(g/cm³)', densityPurity: '密度推算纯度',
                    xrfAu: '金含量(%)', xrfAg: '银含量(%)', xrfCu: '铜含量(%)', xrfZn: '锌含量(%)', xrfOther: '其他(%)', xrfConclusion: 'XRF光谱结论',
                    markExist: '印记标识', carat: '重量(ct)', color: '颜色(Color)', clarity: '净度(Clarity)', cut: '切工(Cut)',
                    polish: '抛光', symmetry: '对称', fluorescence: '荧光',
                    certNo: '证书编号', certIssuer: '发证机构', certMatch: '证物核对', certNote: '证书备注',
                    thermalConduct: '热导反应', inclusion: '内含物', scopeConclusion: '专业仪器判定',
                    type: '玉石种类', origin: '产地判断',
                    sc_kind: '种分(10分)', sc_water: '水头(10分)', sc_color: '色泽(10分)', sc_base: '地子(10分)', sc_work: '雕工(10分)', totalScore: '综合评分',
                    crack: '裂纹', cotton: '棉絮', blackspot: '黑点', defectNote: '瑕疵描述',
                    size: '直径(mm)', quantity: '数量(颗)', shape: '形状', weight_g: '总重(g)',
                    q_luster: '光泽/通透', q_surface: '表皮/纯净', q_color: '颜色/浓度', q_match: '匹配/工艺',
                    treatment: '优化处理', setting: '配托材质', note: '备注'
                };
                insRows.push({ label: labelMap[k] || `${stepId}.${k}`, value: typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v });
            }
        }
        const detailRows = (price.detail || []).map(d => `
            <tr>
                <td class="py-1" style="${d.highlight ? 'font-weight:bold;color:#B8860B' : ''}">${d.label}</td>
                <td class="text-end py-1" style="${d.highlight ? 'font-weight:bold;color:#B8860B' : ''}">${d.value}</td>
            </tr>
        `).join('');
        const insTable = insRows.length ? `
            <table class="table table-bordered table-sm" style="font-size:12px;">
                <thead><tr style="background:#FFF8E7"><th style="width:40%">检测项目</th><th>检测结果</th></tr></thead>
                <tbody>${insRows.slice(0, 16).map(r => `<tr><td class="py-1">${r.label}</td><td class="py-1">${r.value}</td></tr>`).join('')}</tbody>
            </table>
        ` : '<div class="text-muted small">暂无检测数据</div>';
        return `
        <div id="quotePrintArea" style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#222;padding:20px;">
            <div style="text-align:center;border-bottom:3px double #B8860B;padding-bottom:15px;margin-bottom:20px;">
                <div style="font-size:26px;font-weight:bold;color:#8B6914;letter-spacing:4px;">臻 品 汇 珠 宝</div>
                <div style="font-size:14px;color:#666;margin-top:4px;letter-spacing:2px;">ZHENPINHUI JEWELRY RECYCLE · 专业回收 · 诚信经营</div>
                <div style="font-size:12px;color:#888;margin-top:6px;">
                    门店: ${record.storeId || '001号店'} &nbsp;|&nbsp; 电话: 400-888-6666 &nbsp;|&nbsp; 地址: 上海市黄浦区南京东路88号
                </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <div>
                    <div style="font-size:20px;font-weight:bold;color:#8B6914;">珠 宝 回 收 报 价 单</div>
                    <div style="font-size:12px;color:#666;margin-top:2px;">QUOTATION SHEET</div>
                </div>
                <div style="text-align:right;font-size:12px;">
                    <div>单号: <strong style="font-family:monospace;">${record.orderNo}</strong></div>
                    <div>日期: ${formatDate(record.createdAt || Date.now())}</div>
                    <div>鉴定师: ${record.inspector?.name || '--'}</div>
                </div>
            </div>
            <table class="table table-bordered table-sm" style="font-size:13px;">
                <thead><tr style="background:#FFF8E7"><th style="width:25%">顾客信息</th><th style="width:25%"></th><th style="width:25%">首饰信息</th><th></th></tr></thead>
                <tbody>
                    <tr><td class="py-1" style="background:#FAFAFA">姓名</td><td class="py-1">${record.customer?.name || '--'}</td>
                        <td class="py-1" style="background:#FAFAFA">品类</td><td class="py-1">${cat}</td></tr>
                    <tr><td class="py-1" style="background:#FAFAFA">联系电话</td><td class="py-1">${record.customer?.phone || '--'}</td>
                        <td class="py-1" style="background:#FAFAFA">品牌/款式</td><td class="py-1">${record.jewelry?.brand || '--'} / ${record.jewelry?.model || '--'}</td></tr>
                    <tr><td class="py-1" style="background:#FAFAFA">身份证号</td><td class="py-1">${record.customer?.idNo || '--'}</td>
                        <td class="py-1" style="background:#FAFAFA">材质纯度</td><td class="py-1">${record.jewelry?.purity || '--'}</td></tr>
                    <tr><td class="py-1" style="background:#FAFAFA">联系地址</td><td class="py-1">${record.customer?.address || '--'}</td>
                        <td class="py-1" style="background:#FAFAFA">重量/规格</td><td class="py-1">${record.jewelry?.weight ? record.jewelry.weight + ' g' : '--'}</td></tr>
                </tbody>
            </table>
            <div style="margin-top:4px;margin-bottom:6px;font-size:13px;font-weight:bold;color:#8B6914;"><i class="bi bi-clipboard2-check"></i> 检测明细</div>
            ${insTable}
            <div style="margin-top:16px;margin-bottom:6px;font-size:13px;font-weight:bold;color:#8B6914;"><i class="bi bi-cash-coin"></i> 报价明细</div>
            <table class="table table-bordered table-sm" style="font-size:13px;">
                <thead><tr style="background:#FFF8E7"><th style="width:70%">项目</th><th class="text-end">金额</th></tr></thead>
                <tbody>
                    ${detailRows}
                    <tr style="background:linear-gradient(135deg,#FFF8E7,#FFE4A3);font-size:15px;">
                        <td style="font-weight:bold;">最终回收价 (人民币)</td>
                        <td class="text-end" style="font-weight:bold;color:#8B6914;">${formatCurrency(record.finalPrice || 0)}</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top:12px;padding:10px;background:#FFF8E7;border:1px dashed #D4A017;border-radius:6px;font-size:12px;color:#666;">
                <div><strong>特别说明:</strong></div>
                <div>1. 本报价单有效期24小时, 价格随国际贵金属/宝石行情波动; 2. 本回收价已包含成色折旧、工艺折旧等全部扣减项; 3. 本单经双方签字确认后生效, 已回收首饰恕不退回; 4. 顾客须保证所售首饰来源合法, 如有纠纷由顾客自行承担。</div>
            </div>
            <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:13px;">
                <div style="text-align:center;width:40%;">
                    <div style="border-bottom:1px solid #999;height:40px;width:100%;"></div>
                    <div style="margin-top:6px;">鉴定师签字:</div>
                </div>
                <div style="text-align:center;width:40%;">
                    <div style="border-bottom:1px solid #999;height:40px;width:100%;"></div>
                    <div style="margin-top:6px;">顾客签字确认:</div>
                </div>
            </div>
            ${record.approvedBy ? `<div style="margin-top:14px;text-align:right;font-size:12px;color:#666;">本单已由 <strong>${record.approvedBy}</strong> 于 ${formatDate(record.approvedAt)} 审批授权</div>` : ''}
            <div style="margin-top:20px;text-align:center;font-size:11px;color:#999;border-top:1px dashed #ccc;padding-top:8px;">
                臻品汇珠宝 · 全国连锁 · 本单一式两份 · 公司保留最终解释权
            </div>
        </div>`;
    }

    async _printQuoteTemplate() {
        const record = this._currentDetail;
        if (!record) {
            this._showToast('请先选择要打印的回收单', 'warning');
            return;
        }
        const tpl = this._buildQuotePrintTemplate(record);
        let $area = $('#quotePrintArea');
        if (!$area.length) {
            $('body').append('<div id="quotePrintWrap"></div>');
            $area = $('#quotePrintWrap');
        }
        $area.html(tpl);
        this._showToast('正在生成报价单...', 'info');
        await new Promise(r => setTimeout(r, 150));
        try {
            window.print();
        } finally {
            setTimeout(() => { $('#quotePrintWrap').remove(); }, 500);
        }
    }

    _showToast(msg, type = 'info', duration = 3000) {
        const $toast = $('#appToast');
        const $body = $('#toastBody');
        const icons = { success: 'bi-check-circle-fill text-success', error: 'bi-x-circle-fill text-danger', warning: 'bi-exclamation-triangle-fill text-warning', info: 'bi-info-circle-fill text-primary' };
        $body.html(`<i class="bi ${icons[type] || icons.info} me-2"></i>${msg}`);
        const toast = bootstrap.Toast.getOrCreateInstance(document.getElementById('appToast'), { delay: duration });
        toast.show();
    }

    _dateStr() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    }
}

const app = new JewelryRecycleApp();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

export default app;

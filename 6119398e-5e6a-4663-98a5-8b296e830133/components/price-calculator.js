import '../utils/widget-factory.js';
import { AppStore } from '../store.js';
import { formatCurrency, getDepreciationRate, getPurityCategory } from '../utils/gold-price.js';

$.widget('jw.priceCalculator', {
    options: {
        store: null,
        onPriceChange: $.noop,
        onNeedApproval: $.noop
    },

    _create() {
        this.store = this.options.store || AppStore;
        this._formData = null;
        this._inspectionData = null;
        this._manualAdjust = false;
        this._buildLayout();
        this._bindEvents();
        this._bindStoreEvents();
        this._render();
    },

    _bindStoreEvents() {
        const self = this;
        this._goldHandler = () => self._render();
        this._adjustHandler = () => self._render();
        this.store.events.on('goldPrices:updated', this._goldHandler);
        this.store.events.on('config:adjustChanged', this._adjustHandler);
    },

    _buildLayout() {
        const html = `
            <div class="mb-3 p-3 rounded text-center" style="background:linear-gradient(135deg,var(--gold-gradient-light),#fff);border:2px solid var(--gold-border)">
                <div class="text-muted small mb-1">预估回收价</div>
                <div class="price-display-lg" id="finalPriceDisplay">¥ --</div>
                <div class="small mt-1">
                    <span class="badge ${this._overThreshold() ? 'bg-danger' : 'bg-gold'} d-none" id="approvalBadge">
                        ${this._overThreshold() ? '<i class="bi bi-shield-exclamation me-1"></i>需店长审批' : ''}
                    </span>
                    <span class="text-muted small ms-2" id="profitHint"></span>
                </div>
            </div>
            <div class="mb-3">
                <h6 class="small fw-bold text-muted mb-2 text-uppercase">价格明细</h6>
                <div id="priceBreakdown"></div>
            </div>
            <div class="manual-adjust-box mb-3 d-none p-3 rounded" style="background:#FFF7ED;border:1px solid var(--gold-300)">
                <h6 class="small fw-bold text-warning mb-2"><i class="bi bi-sliders me-1"></i>人工调价系数</h6>
                <div class="mb-2">
                    <label class="form-label small mb-1">综合系数(%) <span id="manualCoefVal" class="text-warning">96.0%</span></label>
                    <input type="range" class="form-range manual-coef-range" min="50" max="110" value="96" step="0.5">
                    <div class="d-flex justify-content-between text-muted small">
                        <span>50%</span><span>基准</span><span>110%</span>
                    </div>
                </div>
                <div class="mb-2">
                    <label class="form-label small mb-1">加减金额(元)</label>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text">¥</span>
                        <input type="number" class="form-control manual-amount" step="10" value="0" placeholder="0">
                    </div>
                </div>
                <div class="mb-1">
                    <label class="form-label small mb-1">调价原因</label>
                    <select class="form-select form-select-sm manual-reason">
                        <option value="">请选择原因</option>
                        <option value="VIP">VIP老顾客优惠</option>
                        <option value="URGENT">顾客急需变现</option>
                        <option value="QUALITY">品质超预期</option>
                        <option value="MARKET">市场行情上涨</option>
                        <option value="DEFECT">瑕疵折价</option>
                        <option value="OTHER">其他</option>
                    </select>
                </div>
            </div>
            <div class="mb-3 p-2 rounded" style="background:#EFF6FF;border:1px solid #BFDBFE">
                <h6 class="small fw-bold text-primary mb-1"><i class="bi bi-graph-arrow-up me-1"></i>实时行情参考</h6>
                <div class="row g-2 text-center small">
                    <div class="col-6">
                        <div class="text-muted">Au99.99</div>
                        <div class="fw-bold text-success" id="ref9999">--</div>
                    </div>
                    <div class="col-6">
                        <div class="text-muted">Pt950</div>
                        <div class="fw-bold text-primary" id="refPt">--</div>
                    </div>
                </div>
            </div>
            <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-outline-secondary flex-grow-1 btn-quote-detail">
                    <i class="bi bi-list-check me-1"></i>报价明细
                </button>
                <button class="btn btn-gold flex-grow-1 btn-confirm-quote" disabled>
                    <i class="bi bi-check2-circle me-1"></i>确认报价
                </button>
            </div>
        `;
        this.element.html(html);
    },

    _bindEvents() {
        const self = this;
        this.element.find('.manual-coef-range').on('input', function () {
            $(this).siblings('#manualCoefVal, #manualCoefVal').text($(this).val() + '%');
            self._render();
        });
        this.element.find('.manual-amount, .manual-reason').on('input change', () => self._render());
        this.element.find('.btn-confirm-quote').on('click', () => self._confirmQuote());
        this.element.find('.btn-quote-detail').on('click', () => self._showDetail());
    },

    setManualAdjust(enabled) {
        this._manualAdjust = !!enabled;
        this.element.find('.manual-adjust-box').toggleClass('d-none', !enabled);
        if (!enabled) {
            this.element.find('.manual-coef-range').val(96);
            this.element.find('#manualCoefVal').text('96.0%');
            this.element.find('.manual-amount').val(0);
            this.element.find('.manual-reason').val('');
        }
        this._render();
    },

    setFormData(data) {
        this._formData = data;
        this._render();
    },

    setInspectionData(data) {
        this._inspectionData = data;
        this._render();
    },

    _overThreshold() {
        const t = this.store.getState().approvalThreshold || 30000;
        return (this._lastResult?.finalPrice || 0) > t;
    },

    _render() {
        const t0 = performance.now();
        const state = this.store.getState();
        const prices = state.goldPrices || {};
        const coef = state.adjustCoefficients || {};
        const dep = state.depreciationConfig || {};
        const form = this._formData || {};
        const ins = this._inspectionData || {};
        const category = form.category || 'gold';
        const result = this._calcPrice({ prices, coef, dep, category, form, ins });

        this._lastResult = result;
        this.element.find('#finalPriceDisplay').text(formatCurrency(result.finalPrice));
        this.element.find('#ref9999').text(prices.au9999 ? formatCurrency(prices.au9999) + '/g' : '--');
        this.element.find('#refPt').text(prices.pt950 ? formatCurrency(prices.pt950) + '/g' : '--');

        const threshold = state.approvalThreshold || 30000;
        const needApproval = result.finalPrice > threshold;
        const $badge = this.element.find('#approvalBadge');
        if (needApproval) {
            $badge.removeClass('d-none').addClass('bg-danger').html('<i class="bi bi-shield-exclamation me-1"></i>超¥' + (threshold / 10000).toFixed(1) + '万 · 需审批');
        } else if (result.finalPrice > threshold * 0.8) {
            $badge.removeClass('d-none bg-danger').addClass('bg-gold').html('<i class="bi bi-info-circle me-1"></i>接近审批阈值');
        } else {
            $badge.addClass('d-none');
        }

        const profitPct = result.marketValue ? ((result.finalPrice / result.marketValue - 1) * 100) : 0;
        const $profit = this.element.find('#profitHint');
        if (profitPct) {
            $profit.html(`残值率 <strong class="${profitPct > 0 ? 'text-success' : 'text-danger'}">${profitPct.toFixed(1)}%</strong>`);
        }

        this.element.find('#priceBreakdown').html(this._renderBreakdown(result));

        const ready = !!form.customer?.name && !!form.customer?.phone && (result.rawWeight > 0 || category === 'diamond' ? (result.rawCarat > 0 || result.rawWeight > 0) : true);
        this.element.find('.btn-confirm-quote').prop('disabled', !ready || result.finalPrice <= 0);

        const t1 = performance.now();
        const elapsed = t1 - t0;
        if (elapsed > 40) {
            console.warn(`[PriceCalc] 计算耗时偏高: ${elapsed.toFixed(1)}ms`);
        }

        this.options.onPriceChange.call(this, result);
        this.store.events.emit('price:calculated', { result, elapsedMs: elapsed });
    },

    _calcPrice({ prices, coef, dep, category, form, ins }) {
        const jewelry = form.jewelry || {};
        const weight = parseFloat(jewelry.weight) || 0;
        const catCoef = coef[category] || 0.9;
        let metalValue = 0;
        let stoneValue = 0;
        let extraValue = 0;
        let detail = [];
        let depreciationRate = 0;
        let rawWeight = weight;
        let rawCarat = 0;
        let baseUnitPrice = 0;

        if (category === 'gold') {
            const purityCat = getPurityCategory('gold', jewelry.purity || '999');
            depreciationRate = getDepreciationRate(purityCat, dep);
            baseUnitPrice = (prices.au9999 || 730) * ({'9999': 1, '9995': 0.999, '999': 0.998, '990': 0.985, '916': 0.912, '750': 0.745, '585': 0.580}[purityCat] || 0.75);
            metalValue = baseUnitPrice * weight * depreciationRate;
            detail.push({ label: '材料基准价', value: formatCurrency(baseUnitPrice) + '/g' });
            detail.push({ label: `重量 × ${weight.toFixed(3)}g`, value: formatCurrency(baseUnitPrice * weight) });
            detail.push({ label: `折旧率 ${(depreciationRate * 100).toFixed(0)}%`, value: '-' + formatCurrency(baseUnitPrice * weight * (1 - depreciationRate)) });
        } else if (category === 'platinum' || category === 'palladium') {
            const purityCat = getPurityCategory(category === 'platinum' ? 'platinum' : 'palladium', jewelry.purity || 'PT950');
            depreciationRate = getDepreciationRate(purityCat, dep);
            const unitPrice = category === 'palladium' ? (prices.pd999 || 1050) : (prices.pt950 || 850);
            baseUnitPrice = unitPrice * (purityCat.includes('950') ? 0.95 : purityCat.includes('900') ? 0.90 : 0.94);
            metalValue = baseUnitPrice * weight * depreciationRate;
            detail.push({ label: '材料基准价', value: formatCurrency(baseUnitPrice) + '/g' });
            detail.push({ label: `重量 × ${weight.toFixed(3)}g`, value: formatCurrency(baseUnitPrice * weight) });
            detail.push({ label: `折旧率 ${(depreciationRate * 100).toFixed(0)}%`, value: '-' + formatCurrency(baseUnitPrice * weight * (1 - depreciationRate)) });
        } else if (category === 'diamond') {
            const d = ins.basic_4c || ins.cert_verify || {};
            const carat = parseFloat(d.carat || jewelry.carat || 0);
            rawCarat = carat;
            const diamondMap = this.store.getState().diamondPriceList || {};
            const key = `${carat.toFixed(2)}|${d.color || 'H'}|${d.clarity || 'VS1'}`;
            let perCarat = diamondMap[key] || 0;
            if (!perCarat) {
                const ct = carat || 0.5;
                const base = ct < 0.3 ? 6000 : ct < 0.5 ? 10000 : ct < 1.0 ? 18000 : ct < 2.0 ? 35000 : 60000;
                const colorMul = {D:1.2,E:1.15,F:1.1,G:1.05,H:1.0,I:0.94,J:0.88,K:0.80,L:0.72,M:0.65,'<N':0.55}[d.color] || 1.0;
                const claMul = {FL:1.5,IF:1.4,VVS1:1.25,VVS2:1.18,VS1:1.1,VS2:1.05,SI1:0.9,SI2:0.78,I1:0.6,I2:0.45,I3:0.3}[d.clarity] || 1.0;
                const cutMul = {EX:1.1,VG:1.0,GD:0.92,F:0.85,P:0.7}[d.cut] || 1.0;
                perCarat = base * colorMul * claMul * cutMul;
            }
            stoneValue = perCarat * carat * (coef.diamond || 0.92);
            baseUnitPrice = perCarat;
            detail.push({ label: `单价(${d.color || 'H'}/${d.clarity || 'VS1'})`, value: formatCurrency(perCarat) + '/ct' });
            detail.push({ label: `克拉 × ${(carat || 0).toFixed(3)}ct`, value: formatCurrency(perCarat * carat) });
            detail.push({ label: `回收系数 ${((coef.diamond || 0.92) * 100).toFixed(0)}%`, value: '-' + formatCurrency(perCarat * carat * (1 - (coef.diamond || 0.92))) });
            if (weight > 0) {
                const settingPrice = (prices.au9999 || 730) * 0.7 * weight * 0.95;
                metalValue = settingPrice;
                detail.push({ label: `金托估价(${weight.toFixed(2)}g)`, value: formatCurrency(settingPrice) });
            }
        } else if (category === 'jade') {
            const score = ins.score_card || {};
            const total = (score.sc_kind || 0) + (score.sc_water || 0) + (score.sc_color || 0) + (score.sc_base || 0) + (score.sc_work || 0);
            const avg = total / 50;
            const defectMul = this._jadeDefectMul(ins.defects || {});
            let unitBase = 0;
            const type = (ins.type_judge || {}).type || 'hetian_seed';
            unitBase = {
                feicui_A: 8000, feicui_B: 1500, feicui_C: 800, feicui_B_C: 600,
                hetian_seed: 12000, hetian_mountain: 3500, hetian_river: 6000,
                jasper: 2800, xiuyan: 500, dushan: 1200, nanhong: 3000, other: 800
            }[type] || 1500;
            const jadeMul = 0.15 + avg * 0.9;
            extraValue = unitBase * (weight || 10) * jadeMul * defectMul * (coef.jade || 0.85);
            baseUnitPrice = unitBase * jadeMul * defectMul;
            detail.push({ label: `种类估价基准`, value: formatCurrency(unitBase) + '/g' });
            detail.push({ label: `品质评分 ${total}/50 (${(avg * 100).toFixed(0)}%)`, value: '×' + jadeMul.toFixed(2) });
            detail.push({ label: `瑕疵系数`, value: '×' + defectMul.toFixed(2) });
            detail.push({ label: `重量 × ${(weight || 0).toFixed(2)}g`, value: formatCurrency(unitBase * (weight || 0)) });
        } else if (category === 'pearl') {
            const basic = ins.basic || {};
            const q = ins.quality || {};
            const total = (q.q_luster || 0) + (q.q_surface || 0) + (q.q_color || 0) + (q.q_match || 0);
            const avg = total / 40;
            const typeBase = {
                seawater_south_gold: 1800, seawater_tahiti: 1500, seawater_south_white: 1200,
                seawater_akoya: 800, freshwater_edison: 300, freshwater_normal: 120,
                amber: 250, beeswax: 400, other: 80
            }[basic.type] || 150;
            const size = parseFloat(basic.size) || 8;
            const qty = parseInt(basic.quantity) || 1;
            const sizeMul = Math.max(0.3, (size / 8) * (size / 8));
            extraValue = typeBase * sizeMul * (0.3 + avg * 1.2) * qty * (coef.pearl || 0.8);
            if (basic.weight_g > 0 && (basic.type === 'amber' || basic.type === 'beeswax')) {
                extraValue = typeBase * basic.weight_g * (0.3 + avg * 1.2) * (coef.pearl || 0.8);
                baseUnitPrice = typeBase * (0.3 + avg * 1.2);
            }
            detail.push({ label: `种类单价基准`, value: formatCurrency(typeBase) });
            detail.push({ label: `规格系数 Ø${size}mm`, value: '×' + sizeMul.toFixed(2) });
            detail.push({ label: `品质评分 ${total}/40`, value: '×' + (0.3 + avg * 1.2).toFixed(2) });
            if (basic.type === 'amber' || basic.type === 'beeswax') {
                detail.push({ label: `重量 × ${(basic.weight_g || 0).toFixed(2)}g`, value: formatCurrency(typeBase * (basic.weight_g || 0)) });
            } else {
                detail.push({ label: `数量 × ${qty}颗`, value: '×' + qty });
            }
        }

        let subtotal = metalValue + stoneValue + extraValue;
        detail.push({ label: '小计', value: formatCurrency(subtotal), highlight: true });

        let adjCoef = catCoef;
        if (this._manualAdjust) {
            const r = parseFloat(this.element.find('.manual-coef-range').val()) || 96;
            adjCoef = r / 100;
        }
        let afterAdjust = subtotal * adjCoef;
        detail.push({ label: `回收系数 ${(adjCoef * 100).toFixed(1)}%`, value: formatCurrency(afterAdjust) });

        let manualAmount = 0;
        let manualReason = '';
        if (this._manualAdjust) {
            manualAmount = parseFloat(this.element.find('.manual-amount').val()) || 0;
            manualReason = this.element.find('.manual-reason').val() || '';
            afterAdjust += manualAmount;
            if (manualAmount) {
                detail.push({ label: `人工调整${manualAmount > 0 ? '加' : '减'}价`, value: (manualAmount > 0 ? '+' : '') + formatCurrency(manualAmount) });
            }
        }

        const finalPrice = Math.max(0, Math.round(afterAdjust * 100) / 100);
        const marketValue = subtotal / Math.max(0.5, adjCoef);

        return {
            category,
            metalValue: +metalValue.toFixed(2),
            stoneValue: +stoneValue.toFixed(2),
            extraValue: +extraValue.toFixed(2),
            subtotal: +subtotal.toFixed(2),
            adjustCoef: adjCoef,
            manualAmount,
            manualReason,
            finalPrice,
            marketValue: +marketValue.toFixed(2),
            baseUnitPrice: +baseUnitPrice.toFixed(2),
            depreciationRate,
            detail,
            rawWeight,
            rawCarat
        };
    },

    _jadeDefectMul(def) {
        let m = 1;
        const crackMul = { none: 1, hair: 0.9, obvious: 0.7, broken: 0.45 };
        const cottonMul = { none: 1, micro: 0.95, visible: 0.85, heavy: 0.65 };
        const spotMul = { none: 1, micro: 0.96, some: 0.88, many: 0.72 };
        m *= crackMul[def.crack] || 1;
        m *= cottonMul[def.cotton] || 1;
        m *= spotMul[def.blackspot] || 1;
        return m;
    },

    _renderBreakdown(result) {
        return result.detail.map(d => `
            <div class="price-breakdown-item ${d.highlight ? 'highlight' : ''}">
                <span class="label">${d.label}</span>
                <span class="value">${d.value}</span>
            </div>
        `).join('');
    },

    _confirmQuote() {
        const result = this._lastResult;
        if (!result || result.finalPrice <= 0) return;
        if (this._overThreshold()) {
            this.options.onNeedApproval.call(this, result);
            this.store.events.emit('price:needApproval', { result });
        } else {
            this.store.events.emit('price:confirmed', { result });
        }
    },

    _showDetail() {
        this.store.events.emit('price:showDetail', { result: this._lastResult });
    },

    getLastResult() { return this._lastResult; },

    _destroy() {
        this.store.events.off('goldPrices:updated', this._goldHandler);
        this.store.events.off('config:adjustChanged', this._adjustHandler);
        this.element.empty();
    }
});

export default $.jw.priceCalculator;

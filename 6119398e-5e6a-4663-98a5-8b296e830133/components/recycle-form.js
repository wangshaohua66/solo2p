import '../utils/widget-factory.js';
import { AppStore } from '../store.js';
import { formatDate } from '../utils/gold-price.js';

const CATEGORY_OPTIONS = [
    { value: 'gold', label: '黄金K金', icon: 'bi-circle-fill', color: '#F59E0B' },
    { value: 'platinum', label: '铂金钯金', icon: 'bi-square-fill', color: '#94A3B8' },
    { value: 'diamond', label: '钻石彩宝', icon: 'bi-diamond', color: '#0EA5E9' },
    { value: 'jade', label: '翡翠和田玉', icon: 'bi-hexagon-fill', color: '#10B981' },
    { value: 'pearl', label: '珍珠琥珀', icon: 'bi-circle-half', color: '#F472B6' }
];

$.widget('jw.recycleForm', {
    options: {
        store: null,
        onCustomerChange: $.noop,
        onCategoryChange: $.noop,
        onJewelryChange: $.noop,
        onPhotosChange: $.noop,
        onSubmit: $.noop,
        onSaveDraft: $.noop
    },

    _create() {
        this.store = this.options.store || AppStore;
        this.data = this._emptyData();
        this._buildLayout();
        this._bindEvents();
        this._resetForm();
    },

    _emptyData() {
        return {
            orderNo: this.store.generateOrderNo(),
            customer: { name: '', phone: '', idNo: '', address: '' },
            category: 'gold',
            jewelry: { brand: '', model: '', purity: '', weight: '', size: '', color_desc: '' },
            certificate: { no: '', issuer: '', date: '' },
            photos: [],
            remark: ''
        };
    },

    _buildLayout() {
        const html = `
            <div class="mb-3">
                <label class="form-label">回收单号</label>
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-upc-scan"></i></span>
                    <input type="text" class="form-control fw-bold order-no-input" readonly>
                    <button class="btn btn-outline-secondary btn-new-order" type="button" title="生成新单号">
                        <i class="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
                <div class="small text-muted mt-1">自动生成 · ${formatDate(Date.now())}</div>
            </div>
            <div class="card card-body mb-3 p-3" style="background:var(--gold-50);border-color:var(--gold-200)">
                <h6 class="mb-2"><i class="bi bi-person-vcard me-1"></i>顾客信息</h6>
                <div class="row g-2 mb-2">
                    <div class="col-md-6">
                        <label class="form-label small mb-1">姓名 <span class="text-danger">*</span></label>
                        <input type="text" class="form-control form-control-sm cust-name" placeholder="请输入姓名">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small mb-1">手机号 <span class="text-danger">*</span></label>
                        <input type="tel" class="form-control form-control-sm cust-phone" placeholder="11位手机号">
                    </div>
                </div>
                <div class="mb-2">
                    <label class="form-label small mb-1">身份证号</label>
                    <input type="text" class="form-control form-control-sm cust-id" placeholder="用于贵重物品回收备案">
                </div>
                <div class="mb-1">
                    <label class="form-label small mb-1">联系地址</label>
                    <input type="text" class="form-control form-control-sm cust-addr" placeholder="选填">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">首饰品类 <span class="text-danger">*</span></label>
                <div class="row g-2 category-grid"></div>
            </div>
            <div class="card card-body mb-3 p-3" style="background:#F0F9FF;border-color:#BAE6FD">
                <h6 class="mb-2"><i class="bi bi-gem me-1"></i>首饰基础信息</h6>
                <div class="row g-2 mb-2">
                    <div class="col-md-6">
                        <label class="form-label small mb-1">品牌</label>
                        <input type="text" class="form-control form-control-sm jewelry-brand" placeholder="周大福/老凤祥/...">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small mb-1">款式名称</label>
                        <input type="text" class="form-control form-control-sm jewelry-model" placeholder="如: 足金手镯">
                    </div>
                </div>
                <div class="row g-2 mb-2 jewelry-fields-gold">
                    <div class="col-md-6">
                        <label class="form-label small mb-1">材质纯度</label>
                        <select class="form-select form-select-sm jewelry-purity">
                            <option value="9999">AU9999 (万足金)</option>
                            <option value="9995">AU9995</option>
                            <option value="999" selected>AU999 (千足金)</option>
                            <option value="990">AU990 (足金)</option>
                            <option value="916">AU916 (22K金)</option>
                            <option value="750">AU750 (18K金)</option>
                            <option value="585">AU585 (14K金)</option>
                        </select>
                    </div>
                    <div class="col-md-6">
                        <label class="form-label small mb-1">称重(克) <span class="text-danger">*</span></label>
                        <div class="input-group input-group-sm">
                            <input type="number" step="0.001" class="form-control jewelry-weight" placeholder="0.000">
                            <span class="input-group-text">g</span>
                        </div>
                    </div>
                </div>
                <div class="mb-2">
                    <label class="form-label small mb-1">外观描述</label>
                    <textarea class="form-control form-control-sm jewelry-desc" rows="2" placeholder="新旧程度、划痕、磨损等..."></textarea>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">证书信息</label>
                <div class="row g-2">
                    <div class="col-md-7">
                        <input type="text" class="form-control form-control-sm cert-no" placeholder="证书编号">
                    </div>
                    <div class="col-md-5">
                        <input type="text" class="form-control form-control-sm cert-issuer" placeholder="签发机构 NGTC/GIA/...">
                    </div>
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">首饰照片 <small class="text-muted">(最多6张)</small></label>
                <div class="photo-upload-zone" id="photoDrop">
                    <i class="bi bi-cloud-arrow-up" style="font-size:2rem;color:var(--gold-500)"></i>
                    <div class="mt-1 small text-muted">点击或拖拽图片到此处上传</div>
                    <input type="file" accept="image/*" multiple class="d-none photo-file-input">
                </div>
                <div class="photo-preview-grid"></div>
            </div>
            <div class="mb-3">
                <label class="form-label">备注</label>
                <textarea class="form-control remark-input" rows="2" placeholder="其他需要记录的信息"></textarea>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-outline-secondary flex-grow-1 btn-save-draft">
                    <i class="bi bi-file-earmark me-1"></i>存草稿
                </button>
                <button class="btn btn-gold flex-grow-1 btn-submit">
                    <i class="bi bi-check-lg me-1"></i>提交检测
                </button>
            </div>
        `;
        this.element.html(html);
        this._buildCategoryGrid();
    },

    _buildCategoryGrid() {
        const $grid = this.element.find('.category-grid');
        $grid.html(CATEGORY_OPTIONS.map(c => `
            <div class="col-4">
                <div class="category-card ${c.value === 'gold' ? 'active' : ''}" data-val="${c.value}">
                    <i class="bi ${c.icon}" style="color:${c.color};font-size:1.4rem"></i>
                    <div class="small mt-1">${c.label}</div>
                </div>
            </div>
        `).join(''));
        $grid.find('.category-card').css({
            border: '2px solid #E5E7EB', borderRadius: '10px', padding: '0.7rem 0.5rem',
            textAlign: 'center', cursor: 'pointer', background: '#fff', transition: 'all .2s'
        });
        $grid.find('.category-card.active').css({
            borderColor: 'var(--gold-500)', background: 'var(--gold-gradient-light)',
            boxShadow: 'var(--shadow-gold-sm)', fontWeight: '600'
        });
    },

    _bindEvents() {
        const $el = this.element;
        const self = this;

        $el.find('.btn-new-order').on('click', () => {
            self.data.orderNo = self.store.generateOrderNo();
            $el.find('.order-no-input').val(self.data.orderNo);
        });

        $el.find('.cust-name, .cust-phone, .cust-id, .cust-addr').on('input', function () {
            const n = $(this).prop('class').match(/cust-(name|phone|id|addr)/)[1];
            self.data.customer[n] = $(this).val();
            self._emitCustomer();
        }).on('blur', function () { self._validateField($(this)); });

        $el.find('.category-grid').on('click', '.category-card', function () {
            const val = $(this).data('val');
            self.data.category = val;
            $(this).siblings().removeClass('active').css({
                borderColor: '#E5E7EB', background: '#fff', fontWeight: '400', boxShadow: 'none'
            });
            $(this).addClass('active').css({
                borderColor: 'var(--gold-500)', background: 'var(--gold-gradient-light)',
                boxShadow: 'var(--shadow-gold-sm)', fontWeight: '600'
            });
            self._updateJewelryFields();
            self.options.onCategoryChange.call(self, val);
            self.store.events.emit('form:categoryChanged', { category: val });
        });

        $el.find('.jewelry-brand, .jewelry-model, .jewelry-purity, .jewelry-weight, .jewelry-desc').on('input', function () {
            const key = $(this).prop('class').match(/jewelry-(brand|model|purity|weight|desc)/)[1];
            const map = { desc: 'color_desc' };
            const k = map[key] || key;
            self.data.jewelry[k] = $(this).val();
            self._emitJewelry();
            self.store.events.emit('form:jewelryChanged', { jewelry: self.data.jewelry });
        }).on('blur', function () { self._validateField($(this)); });

        $el.find('.cert-no, .cert-issuer').on('input', function () {
            const k = $(this).hasClass('cert-no') ? 'no' : 'issuer';
            self.data.certificate[k] = $(this).val();
        });

        $el.find('.remark-input').on('input', function () {
            self.data.remark = $(this).val();
        });

        const $drop = $el.find('#photoDrop');
        const $file = $el.find('.photo-file-input');
        $drop.on('click', () => $file.trigger('click'));
        $drop.on('dragover', e => { e.preventDefault(); $drop.addClass('dragover'); });
        $drop.on('dragleave', () => $drop.removeClass('dragover'));
        $drop.on('drop', e => {
            e.preventDefault();
            $drop.removeClass('dragover');
            self._handleFiles(e.originalEvent.dataTransfer.files);
        });
        $file.on('change', function () { self._handleFiles(this.files); });

        $el.find('.photo-preview-grid').on('click', '.remove-btn', function () {
            const idx = $(this).data('idx');
            self.data.photos.splice(idx, 1);
            self._renderPhotos();
            self.options.onPhotosChange.call(self, self.data.photos);
        });

        $el.find('.btn-save-draft').on('click', () => self._saveDraft());
        $el.find('.btn-submit').on('click', () => self._submit());
    },

    _updateJewelryFields() {
        const cat = this.data.category;
        const $purity = this.element.find('.jewelry-purity');
        const options = {
            gold: [
                ['9999', 'AU9999 (万足金)'], ['9995', 'AU9995'], ['999', 'AU999 (千足金)'],
                ['990', 'AU990 (足金)'], ['916', 'AU916 (22K金)'], ['750', 'AU750 (18K金)'], ['585', 'AU585 (14K金)']
            ],
            platinum: [
                ['PT950', 'PT950 (铂950)'], ['PT900', 'PT900 (铂900)'], ['PT990', 'PT990 (足铂)']
            ],
            palladium: [
                ['PD950', 'PD950 (钯950)'], ['PD999', 'PD999 (足钯)']
            ],
            diamond: [
                ['PT950', 'PT950镶钻'], ['AU750', '18K金镶钻'], ['PT900', 'PT900镶钻'], ['无托', '仅裸石']
            ],
            jade: [
                ['翡翠A货', '翡翠A货'], ['翡翠B货', '翡翠B货'], ['和田玉籽料', '和田玉籽料'],
                ['和田玉山料', '和田玉山料'], ['碧玉', '碧玉'], ['其他', '其他玉石']
            ],
            pearl: [
                ['海水珍珠', '海水珍珠'], ['淡水珍珠', '淡水珍珠'], ['南洋金珠', '南洋金珠'],
                ['大溪地黑珍珠', '大溪地黑珍珠'], ['琥珀', '琥珀'], ['蜜蜡', '蜜蜡']
            ]
        };
        const list = options[cat] || options.gold;
        $purity.html(list.map(([v, l]) => `<option value="${v}">${l}</option>`).join(''));
        this.data.jewelry.purity = list[0][0];
        this.store.events.emit('form:purityChanged', { purity: this.data.jewelry.purity });
    },

    async _handleFiles(fileList) {
        const files = Array.from(fileList).slice(0, 6 - this.data.photos.length);
        for (const f of files) {
            if (!f.type.startsWith('image/')) continue;
            const dataUrl = await this._fileToDataUrl(f);
            this.data.photos.push(dataUrl);
        }
        this._renderPhotos();
        this.options.onPhotosChange.call(this, this.data.photos);
    },

    _fileToDataUrl(file) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    },

    _renderPhotos() {
        const $grid = this.element.find('.photo-preview-grid');
        $grid.html(this.data.photos.map((p, i) => `
            <div class="photo-thumb">
                <img src="${p}" alt="photo-${i}">
                <button type="button" class="remove-btn" data-idx="${i}">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        `).join(''));
    },

    _validateField($input) {
        const val = $input.val();
        if ($input.hasClass('cust-name') && !val.trim()) {
            return this._markError($input, '请输入顾客姓名');
        }
        if ($input.hasClass('cust-phone')) {
            if (!/^1[3-9]\d{9}$/.test(val.trim())) {
                return this._markError($input, '请输入有效的11位手机号');
            }
        }
        if ($input.hasClass('cust-id') && val) {
            if (!/(^\d{15}$)|(^\d{17}(\d|X|x)$)/.test(val.trim())) {
                return this._markError($input, '身份证号格式不正确');
            }
        }
        if ($input.hasClass('jewelry-weight')) {
            if (!val || parseFloat(val) <= 0) {
                return this._markError($input, '请输入有效的重量');
            }
        }
        $input.removeClass('input-error');
        $input.siblings('.error-text').remove();
        return true;
    },

    _markError($input, msg) {
        $input.addClass('input-error');
        $input.siblings('.error-text').remove();
        $input.after(`<div class="error-text"><i class="bi bi-exclamation-circle me-1"></i>${msg}</div>`);
        return false;
    },

    _validate() {
        let ok = true;
        const $n = this.element.find('.cust-name'); if (!this._validateField($n)) ok = false;
        const $p = this.element.find('.cust-phone'); if (!this._validateField($p)) ok = false;
        const $w = this.element.find('.jewelry-weight'); if (!this._validateField($w)) ok = false;
        return ok;
    },

    _emitCustomer() { this.options.onCustomerChange.call(this, this.data.customer); },
    _emitJewelry() { this.options.onJewelryChange.call(this, this.data.jewelry); },

    getData() {
        return JSON.parse(JSON.stringify(this.data));
    },

    setData(data) {
        if (!data) return;
        this.data = Object.assign(this._emptyData(), data || {});
        if (!this.data.orderNo) this.data.orderNo = this.store.generateOrderNo();
        this._fillForm();
    },

    _fillForm() {
        const $el = this.element;
        const d = this.data;
        $el.find('.order-no-input').val(d.orderNo);
        $el.find('.cust-name').val(d.customer?.name || '');
        $el.find('.cust-phone').val(d.customer?.phone || '');
        $el.find('.cust-id').val(d.customer?.idNo || '');
        $el.find('.cust-addr').val(d.customer?.address || '');
        const $card = $el.find(`.category-card[data-val="${d.category}"]`);
        if ($card.length) {
            $card.siblings().removeClass('active').css({
                borderColor: '#E5E7EB', background: '#fff', fontWeight: '400', boxShadow: 'none'
            });
            $card.addClass('active').css({
                borderColor: 'var(--gold-500)', background: 'var(--gold-gradient-light)',
                boxShadow: 'var(--shadow-gold-sm)', fontWeight: '600'
            });
        }
        this._updateJewelryFields();
        $el.find('.jewelry-brand').val(d.jewelry?.brand || '');
        $el.find('.jewelry-model').val(d.jewelry?.model || '');
        $el.find('.jewelry-purity').val(d.jewelry?.purity || '');
        $el.find('.jewelry-weight').val(d.jewelry?.weight || '');
        $el.find('.jewelry-desc').val(d.jewelry?.color_desc || '');
        $el.find('.cert-no').val(d.certificate?.no || '');
        $el.find('.cert-issuer').val(d.certificate?.issuer || '');
        $el.find('.remark-input').val(d.remark || '');
        this.data.photos = d.photos || [];
        this._renderPhotos();
    },

    _resetForm() {
        this.data = this._emptyData();
        this._fillForm();
        this.store.events.emit('form:reset', { orderNo: this.data.orderNo });
    },

    async _saveDraft() {
        const draft = { ...this.getData(), status: 'draft' };
        await this.store.saveDraft(draft);
        this.store.events.emit('toast:show', { msg: '草稿已保存', type: 'success' });
        this.options.onSaveDraft.call(this, draft);
    },

    _submit() {
        if (!this._validate()) {
            this.store.events.emit('toast:show', { msg: '请检查标红字段', type: 'error' });
            return;
        }
        const result = this.getData();
        this.store.events.emit('form:submitted', { data: result });
        this.options.onSubmit.call(this, result);
    },

    _destroy() {
        this.element.empty();
    }
});

export default $.jw.recycleForm;

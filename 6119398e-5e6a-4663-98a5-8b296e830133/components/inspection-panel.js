import '../utils/widget-factory.js';
import { AppStore } from '../store.js';

const STEP_DEF = {
    gold: [
        {
            id: 'fire_test', name: '火烧试金', icon: 'bi-fire',
            desc: '氧焊火烧检验表面是否有包金、镀金现象',
            fields: [
                { key: 'fireResult', label: '观察结论', type: 'select', options: [
                    ['normal', '正常 · 金光色泽'], ['discolor', '变色 · 疑似K金不足'],
                    ['coating', '表层脱落 · 包金/镀金'], ['not_applicable', '未检测']
                ]},
                { key: 'fireNote', label: '备注说明', type: 'textarea', placeholder: '详细描述火烧前后色泽变化...' }
            ]
        },
        {
            id: 'density', name: '密度测试', icon: 'bi-droplet-half',
            desc: '阿基米德排水法测密度验证金含量',
            fields: [
                { key: 'densityAir', label: '空气称重(g)', type: 'number', step: '0.001', required: true },
                { key: 'densityWater', label: '水中称重(g)', type: 'number', step: '0.001', required: true },
                { key: 'densityResult', label: '测得密度(g/cm³)', type: 'number', step: '0.01', readOnly: true, calc: true },
                { key: 'densityPurity', label: '纯度换算结果', type: 'text', readOnly: true }
            ]
        },
        {
            id: 'xrf', name: 'X荧光光谱', icon: 'bi-cpu',
            desc: 'XRF光谱仪测各金属元素百分比含量',
            fields: [
                { key: 'xrfAu', label: 'Au金含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfAg', label: 'Ag银含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfCu', label: 'Cu铜含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfZn', label: 'Zn锌含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfOther', label: '其他元素(%)', type: 'number', step: '0.01' },
                { key: 'xrfConclusion', label: '综合判定', type: 'select', options: [
                    ['pass', '通过 · 符合标识纯度'], ['warning', '可疑 · 偏差>0.5%'],
                    ['fail', '不合格 · 严重偏差'], ['not_tested', '未检测']
                ]}
            ]
        }
    ],
    platinum: [
        {
            id: 'mark', name: '印记标识', icon: 'bi-signpost-split',
            desc: '检查厂家印记、铂含量印记',
            fields: [
                { key: 'markExist', label: '标识印记', type: 'select', options: [
                    ['pt950', 'PT950印记清晰'], ['pt900', 'PT900印记清晰'],
                    ['unclear', '印记模糊不清'], ['none', '无印记']
                ]},
                { key: 'markNote', label: '检测记录', type: 'textarea' }
            ]
        },
        {
            id: 'touchstone', name: '试金石法', icon: 'bi-patch-question',
            desc: '对比标样条与被测金属划痕色泽',
            fields: [
                { key: 'touchMatch', label: '划痕对比', type: 'select', options: [
                    ['exact', '与标样一致'], ['near', '接近标样'],
                    ['different', '明显差异'], ['not_tested', '未检测']
                ]},
                { key: 'touchNote', label: '备注', type: 'text' }
            ]
        },
        {
            id: 'xrf_plat', name: 'XRF光谱', icon: 'bi-cpu',
            desc: 'XRF测铂钯铑含量',
            fields: [
                { key: 'xrfPt', label: 'Pt铂含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfPd', label: 'Pd钯含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfRh', label: 'Rh铑含量(%)', type: 'number', step: '0.01' },
                { key: 'xrfConclusion', label: '综合判定', type: 'select', options: [
                    ['pass', '通过'], ['warning', '偏差>1%'], ['fail', '不合格'], ['not_tested', '未检测']
                ]}
            ]
        }
    ],
    diamond: [
        {
            id: 'basic_4c', name: '4C参数登记', icon: 'bi-diamond',
            desc: '重量、颜色、净度、切工四项基础参数',
            fields: [
                { key: 'carat', label: '重量 Carat(ct)', type: 'number', step: '0.001', required: true, placeholder: '如 1.050' },
                { key: 'color', label: '颜色 Color', type: 'select', options: [
                    ['D','D - 无色极白'],['E','E - 无色'],['F','F - 无色优白'],
                    ['G','G - 优白'],['H','H - 白'],['I','I - 微黄白'],
                    ['J','J - 微黄白'],['K','K - 浅黄白'],['L','L - 浅黄'],
                    ['M','M - 浅黄'],['N','N - 黄'],['<N','<N 黄调']
                ]},
                { key: 'clarity', label: '净度 Clarity', type: 'select', options: [
                    ['FL','FL - 无瑕'],['IF','IF - 内无瑕'],['VVS1','VVS1 - 极微瑕1'],
                    ['VVS2','VVS2 - 极微瑕2'],['VS1','VS1 - 微瑕1'],['VS2','VS2 - 微瑕2'],
                    ['SI1','SI1 - 小瑕1'],['SI2','SI2 - 小瑕2'],['I1','I1 - 瑕疵1'],
                    ['I2','I2 - 瑕疵2'],['I3','I3 - 瑕疵3']
                ]},
                { key: 'cut', label: '切工 Cut', type: 'select', options: [
                    ['EX','Excellent - 极优'],['VG','Very Good - 优良'],
                    ['GD','Good - 良好'],['F','Fair - 一般'],['P','Poor - 差']
                ]},
                { key: 'polish', label: '抛光 Polish', type: 'select', options: [['EX','EX'],['VG','VG'],['GD','GD'],['F','F']] },
                { key: 'symmetry', label: '对称 Symmetry', type: 'select', options: [['EX','EX'],['VG','VG'],['GD','GD'],['F','F']] },
                { key: 'fluorescence', label: '荧光 Fluorescence', type: 'select', options: [
                    ['NONE','无'],['FAINT','微弱'],['MEDIUM','中等'],['STRONG','强'],['VERY_STRONG','很强']
                ]}
            ]
        },
        {
            id: 'cert_verify', name: '证书编号校验', icon: 'bi-shield-check',
            desc: '核对证书编号、机构与参数一致性',
            fields: [
                { key: 'certNo', label: '证书编号', type: 'text', placeholder: '输入证书编号' },
                { key: 'certIssuer', label: '发证机构', type: 'select', options: [
                    ['GIA','GIA · 美国宝石学院'],['HRD','HRD · 比利时钻石高层议会'],
                    ['IGI','IGI · 国际宝石学院'],['NGTC','NGTC · 国家珠宝玉石检测中心'],
                    ['GIC','GIC · 中国地质大学'],['EGL','EGL · 欧洲宝石实验室'],
                    ['OTHER','其他机构'],['NONE','无证书']
                ]},
                { key: 'certMatch', label: '证书与实物', type: 'select', options: [
                    ['match','完全一致'], ['weight_match','仅重量匹配'],
                    ['param_diff','参数有差异'], ['not_found','未查询到']
                ]},
                { key: 'certNote', label: '备注', type: 'textarea' }
            ]
        },
        {
            id: 'scope_test', name: '专业仪器检测', icon: 'bi-microscope',
            desc: '热导仪、莫桑仪、显微镜观察',
            fields: [
                { key: 'thermalConduct', label: '热导仪反应', type: 'select', options: [
                    ['diamond','钻石级'], ['moissanite','莫桑石级'], ['other','其他']
                ]},
                { key: 'inclusion', label: '内含物观察', type: 'text', placeholder: '描述内部特征...' },
                { key: 'scopeConclusion', label: '最终判定', type: 'select', options: [
                    ['natural_diamond','天然钻石'], ['synthetic','合成钻石'],
                    ['moissanite','莫桑石'], ['cz','立方氧化锆'], ['other','其他仿钻']
                ]}
            ]
        }
    ],
    jade: [
        {
            id: 'type_judge', name: '种类判定', icon: 'bi-hexagon-fill',
            desc: '区分翡翠/和田玉/其他玉石种类',
            fields: [
                { key: 'type', label: '玉石种类', type: 'select', options: [
                    ['feicui_A','翡翠A货(天然)'],['feicui_B','翡翠B货(酸洗)'],
                    ['feicui_C','翡翠C货(染色)'],['feicui_B_C','翡翠B+C货'],
                    ['hetian_seed','和田玉籽料'],['hetian_mountain','和田玉山料'],
                    ['hetian_river','和田玉山流水'],['jasper','碧玉'],
                    ['xiuyan','岫玉'],['dushan','独山玉'],['nanhong','南红玛瑙'],['other','其他玉石']
                ]},
                { key: 'origin', label: '产地判断', type: 'text', placeholder: '如: 缅甸/新疆和田...' }
            ]
        },
        {
            id: 'score_card', name: '种水色地评分', icon: 'bi-stars',
            desc: '按照国标对种、水、色、地、工五项打分(10分制)',
            fields: [
                { key: 'sc_kind', label: '种 · 结构颗粒', type: 'score', max: 10 },
                { key: 'sc_water', label: '水 · 透明度润度', type: 'score', max: 10 },
                { key: 'sc_color', label: '色 · 色泽浓正匀', type: 'score', max: 10 },
                { key: 'sc_base', label: '地 · 底色纯净度', type: 'score', max: 10 },
                { key: 'sc_work', label: '工 · 雕工工艺', type: 'score', max: 10 },
                { key: 'totalScore', label: '综合评分', type: 'text', readOnly: true }
            ]
        },
        {
            id: 'defects', name: '瑕疵缺陷检查', icon: 'bi-exclamation-triangle',
            desc: '裂纹、棉絮、黑点、石纹等',
            fields: [
                { key: 'crack', label: '裂纹', type: 'select', options: [
                    ['none','无裂纹'],['hair','发丝纹·轻微'],['obvious','明显纹路'],['broken','断裂风险']
                ]},
                { key: 'cotton', label: '棉絮', type: 'select', options: [
                    ['none','无棉'],['micro','微量棉'],['visible','可见棉'],['heavy','重棉']
                ]},
                { key: 'blackspot', label: '黑点/杂质', type: 'select', options: [
                    ['none','无'],['micro','极少'],['some','少许'],['many','较多']
                ]},
                { key: 'defectNote', label: '综合描述', type: 'textarea' }
            ]
        }
    ],
    pearl: [
        {
            id: 'basic', name: '基础参数', icon: 'bi-circle-half',
            desc: '珍珠种类、大小、形状',
            fields: [
                { key: 'type', label: '珍珠种类', type: 'select', options: [
                    ['seawater_akoya','海水 · Akoya'],['seawater_south_gold','海水 · 南洋金珠'],
                    ['seawater_south_white','海水 · 南洋白珠'],['seawater_tahiti','海水 · 大溪地黑珍珠'],
                    ['freshwater_edison','淡水 · 爱迪生'],['freshwater_normal','淡水 · 常规'],
                    ['amber','琥珀'],['beeswax','蜜蜡'],['other','其他']
                ]},
                { key: 'size', label: '直径(mm)', type: 'number', step: '0.1' },
                { key: 'quantity', label: '数量(颗)', type: 'number', step: '1' },
                { key: 'shape', label: '形状', type: 'select', options: [
                    ['perfect_round','正圆'],['round','近圆'],['oval','椭圆'],
                    ['drop','水滴形'],['baroque','异形'],['button','扁圆']
                ]},
                { key: 'weight_g', label: '总重(g)', type: 'number', step: '0.01' }
            ]
        },
        {
            id: 'quality', name: '品质评分', icon: 'bi-stars',
            desc: '光泽、表皮、匹配度(珍珠)或质地、颜色、通透度(琥珀)',
            fields: [
                { key: 'q_luster', label: '光泽/通透度', type: 'score', max: 10 },
                { key: 'q_surface', label: '表皮/纯净度', type: 'score', max: 10 },
                { key: 'q_color', label: '颜色/浓度', type: 'score', max: 10 },
                { key: 'q_match', label: '匹配度/工艺', type: 'score', max: 10 },
                { key: 'totalScore', label: '综合评分', type: 'text', readOnly: true }
            ]
        },
        {
            id: 'additional', name: '附加检查', icon: 'bi-ui-checks-grid',
            desc: '特殊检查项目',
            fields: [
                { key: 'treatment', label: '优化处理', type: 'select', options: [
                    ['natural','天然无优化'],['bleach','漂白处理'],
                    ['dye','染色处理'],['irradiation','辐照改色'],
                    ['heated','加热优化'],['press','压合再造']
                ]},
                { key: 'setting', label: '配金属托', type: 'select', options: [
                    ['none','无托'],['18k','18K金托'],['pt950','PT950托'],
                    ['925','925银托'],['other','其他材质']
                ]},
                { key: 'note', label: '备注', type: 'textarea' }
            ]
        }
    ]
};

$.widget('jw.inspectionPanel', {
    options: {
        store: null,
        category: 'gold',
        onStepChange: $.noop,
        onDataChange: $.noop,
        onComplete: $.noop
    },

    _create() {
        this.store = this.options.store || AppStore;
        this.data = {};
        this.activeStep = 0;
        this.category = this.options.category;
        this._render();
    },

    _setOption(key, value) {
        if (key === 'category' && value !== this.category) {
            this.category = value;
            this.data = {};
            this.activeStep = 0;
            this._render();
        }
        this._super(key, value);
    },

    _getSteps() {
        if (this.category === 'platinum' || this.category === 'palladium') return STEP_DEF.platinum;
        return STEP_DEF[this.category] || STEP_DEF.gold;
    },

    _render() {
        const steps = this._getSteps();
        const catLabel = { gold:'黄金K金', platinum:'铂金钯金', palladium:'铂金钯金', diamond:'钻石彩宝', jade:'翡翠和田玉', pearl:'珍珠琥珀' }[this.category] || '未知';
        $('#categoryLabel').text(`· ${catLabel} · ${steps.length}步检测`);

        const indicator = steps.map((s, i) => `
            <div class="step-item ${i === 0 ? 'active' : ''}" data-step="${i}">
                <div class="step-circle">
                    <i class="bi ${i < this.activeStep ? 'bi-check-lg' : ''}" style="${i < this.activeStep ? '' : 'display:none'}"></i>
                    <span style="${i < this.activeStep ? 'display:none' : ''}">${i + 1}</span>
                </div>
                <div class="step-label">${s.name}</div>
            </div>
        `).join('');

        const stepCards = steps.map((s, i) => this._buildStepCard(s, i)).join('');

        this.element.html(`
            <div class="step-indicator mb-4">${indicator}</div>
            <div class="progress-steps">${stepCards}</div>
            <div class="mt-3 d-flex justify-content-between">
                <button class="btn btn-outline-secondary btn-prev" ${this.activeStep === 0 ? 'disabled' : ''}>
                    <i class="bi bi-chevron-left me-1"></i>上一步
                </button>
                <div class="text-muted small align-self-center">
                    完成进度: <strong class="text-warning" id="inspectProgress">${this.activeStep}/${steps.length}</strong>
                </div>
                <button class="btn btn-gold btn-next">
                    ${this.activeStep >= steps.length - 1 ? '完成检测<i class="bi bi-check-lg ms-1"></i>' : '下一步<i class="bi bi-chevron-right ms-1"></i>'}
                </button>
            </div>
        `);

        this._bindStepEvents();
    },

    _buildStepCard(step, idx) {
        const active = idx === this.activeStep;
        const done = idx < this.activeStep;
        return `
            <div class="progress-step-card ${active ? 'active' : ''} ${done ? 'done' : ''}" data-idx="${idx}">
                <div class="step-card-header">
                    <div class="step-card-title">
                        <span class="badge bg-gold" style="width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%">
                            ${done ? '<i class="bi bi-check-lg"></i>' : (idx + 1)}
                        </span>
                        <i class="bi ${step.icon}"></i>
                        <span>${step.name}</span>
                    </div>
                    <small class="text-muted">${step.desc}</small>
                </div>
                <div class="step-card-body">
                    ${step.fields.map(f => this._buildField(f, step.id)).join('')}
                </div>
            </div>
        `;
    },

    _buildField(field, stepId) {
        const scope = this.data[stepId] = this.data[stepId] || {};
        const val = scope[field.key] ?? '';
        let input = '';
        switch (field.type) {
            case 'select':
                input = `<select class="form-select form-select-sm insp-field" data-step="${stepId}" data-key="${field.key}" ${field.required ? 'required' : ''}>
                    ${(field.options || []).map(([v, l]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${l}</option>`).join('')}
                </select>`;
                break;
            case 'textarea':
                input = `<textarea class="form-control form-control-sm insp-field" data-step="${stepId}" data-key="${field.key}" rows="2" placeholder="${field.placeholder || ''}">${val}</textarea>`;
                break;
            case 'number':
                input = `<div class="input-group input-group-sm">
                    <input type="number" step="${field.step || '0.01'}" class="form-control insp-field" data-step="${stepId}" data-key="${field.key}" value="${val}" ${field.readOnly ? 'readonly' : ''} ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}" ${field.calc ? 'data-calc="density"' : ''}>
                </div>`;
                break;
            case 'text':
            default:
                input = `<input type="text" class="form-control form-control-sm insp-field" data-step="${stepId}" data-key="${field.key}" value="${val}" ${field.readOnly ? 'readonly' : ''} placeholder="${field.placeholder || ''}">`;
                break;
            case 'score':
                input = `<div class="score-rating" data-step="${stepId}" data-key="${field.key}" data-max="${field.max || 10}" data-current="${val || 0}">
                    ${Array.from({length: field.max || 10}, (_, i) => {
                        const n = i + 1;
                        return `<span class="score-pill ${n <= (val || 0) ? 'active' : ''}" data-val="${n}">${n}</span>`;
                    }).join('')}
                    <small class="text-muted ms-2 align-self-center score-current-val">${val || 0}分</small>
                </div>`;
                break;
        }
        return `
            <div class="mb-2">
                <label class="form-label small mb-1">${field.label}${field.required ? ' <span class="text-danger">*</span>' : ''}</label>
                ${input}
            </div>
        `;
    },

    _bindStepEvents() {
        const self = this;
        this.element.find('.progress-step-card').on('click', function (e) {
            if ($(e.target).closest('.insp-field, .score-pill, input, select, textarea, button').length) return;
            const idx = +$(this).data('idx');
            self._gotoStep(idx);
        });

        this.element.find('.step-item').on('click', function () {
            self._gotoStep(+$(this).data('step'));
        });

        this.element.find('.btn-next').on('click', () => self._nextStep());
        this.element.find('.btn-prev').on('click', () => self._prevStep());

        this.element.on('input change', '.insp-field', function () {
            const $this = $(this);
            const step = $this.data('step');
            const key = $this.data('key');
            self.data[step] = self.data[step] || {};
            let val = $this.val();
            if ($this.attr('type') === 'number') val = val === '' ? '' : +val;
            self.data[step][key] = val;
            if ($this.data('calc') === 'density') self._calcDensity();
            self._recalcScores();
            self.options.onDataChange.call(self, self.data);
            self.store.events.emit('inspection:dataChanged', { data: self.data });
        });

        this.element.on('click', '.score-pill', function () {
            const $parent = $(this).parent();
            const step = $parent.data('step');
            const key = $parent.data('key');
            const val = +$(this).data('val');
            self.data[step] = self.data[step] || {};
            self.data[step][key] = val;
            $parent.find('.score-pill').removeClass('active');
            $(this).addClass('active').prevAll().addClass('active');
            $parent.find('.score-current-val').text(val + '分');
            self._recalcScores();
            self.options.onDataChange.call(self, self.data);
            self.store.events.emit('inspection:dataChanged', { data: self.data });
        });
    },

    _calcDensity() {
        const d = this.data['density'] || {};
        const air = parseFloat(d.densityAir);
        const water = parseFloat(d.densityWater);
        if (air > 0 && water > 0 && air !== water) {
            const density = air / (air - water) * 0.998;
            d.densityResult = +density.toFixed(2);
            let purity = '';
            if (density >= 19.0) purity = '9999 · 万足金';
            else if (density >= 18.5) purity = '999 · 千足金';
            else if (density >= 17.5) purity = '足金 · 990';
            else if (density >= 16.0) purity = '22K金 · 916';
            else if (density >= 14.5) purity = '18K金 · 750';
            else if (density >= 12.0) purity = '14K金 · 585';
            else purity = '偏低 · 需进一步检测';
            d.densityPurity = `ρ=${density.toFixed(2)}g/cm³ → ${purity}`;
            this.element.find('[data-step="density"][data-key="densityResult"]').val(density.toFixed(2));
            this.element.find('[data-step="density"][data-key="densityPurity"]').val(d.densityPurity);
        }
    },

    _recalcScores() {
        const steps = this._getSteps();
        const step = steps.find(s => s.fields.some(f => f.key === 'totalScore'));
        if (!step) return;
        const d = this.data[step.id] || {};
        let sum = 0, cnt = 0;
        for (const f of step.fields) {
            if (f.type === 'score') { sum += +(d[f.key] || 0); cnt++; }
        }
        if (cnt > 0) {
            d.totalScore = `${sum}分 (平均 ${(sum / cnt).toFixed(1)}分)`;
            const $el = this.element.find(`[data-step="${step.id}"][data-key="totalScore"]`);
            if ($el.length) $el.val(d.totalScore);
        }
    },

    _gotoStep(idx) {
        const steps = this._getSteps();
        if (idx < 0 || idx >= steps.length) return;
        this.activeStep = idx;
        this.element.find('.progress-step-card').removeClass('active done');
        this.element.find('.progress-step-card').each(function () {
            const i = +$(this).data('idx');
            if (i < idx) $(this).addClass('done');
            else if (i === idx) $(this).addClass('active');
        });
        this.element.find('.step-item').removeClass('active done');
        this.element.find('.step-item').each(function () {
            const i = +$(this).data('step');
            const $c = $(this).find('.step-circle');
            if (i < idx) {
                $(this).addClass('done');
                $c.find('i').show();
                $c.find('span').hide();
            } else if (i === idx) {
                $(this).addClass('active');
                $c.find('i').hide();
                $c.find('span').show();
            } else {
                $c.find('i').hide();
                $c.find('span').show();
            }
        });
        this.element.find('.btn-prev').prop('disabled', idx === 0);
        this.element.find('#inspectProgress').text(`${idx}/${steps.length}`);
        const $next = this.element.find('.btn-next');
        if (idx >= steps.length - 1) {
            $next.html('完成检测<i class="bi bi-check-lg ms-1"></i>');
        } else {
            $next.html('下一步<i class="bi bi-chevron-right ms-1"></i>');
        }
        this.options.onStepChange.call(this, idx, steps[idx]);
        this.store.events.emit('inspection:stepChanged', { step: idx, stepDef: steps[idx] });
    },

    _nextStep() {
        const steps = this._getSteps();
        if (this.activeStep < steps.length - 1) {
            this._gotoStep(this.activeStep + 1);
        } else {
            this._complete();
        }
    },

    _prevStep() { this._gotoStep(Math.max(0, this.activeStep - 1)); },

    _complete() {
        const result = this.getData();
        this.store.events.emit('inspection:completed', { data: result });
        this.options.onComplete.call(this, result);
    },

    getData() { return JSON.parse(JSON.stringify(this.data)); },

    setData(data) {
        if (!data) return;
        this.data = JSON.parse(JSON.stringify(data));
        this._render();
    },

    getCategory() { return this.category; }
});

export default $.jw.inspectionPanel;

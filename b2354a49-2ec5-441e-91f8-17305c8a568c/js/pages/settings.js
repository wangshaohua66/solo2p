(function(global) {
    'use strict';

    var App = global.App || (global.App = {});
    App.pages = App.pages || {};

    function render() {
        return '<div class="container-fluid p-0">' +
            '<div class="row g-3 mb-4">' +
            '<div class="col-12"><div class="card bg-gradient-dark text-white shadow-sm">' +
            '<div class="card-body py-3">' +
            '<div class="row align-items-center g-3">' +
            '<div class="col-auto"><h4 class="mb-0 fw-bold"><i class="bi bi-gear me-2"></i>系统设置</h4>' +
            '<small class="opacity-75">配置与数据维护</small>' +
            '</div></div></div></div></div></div>' +

            '<div class="row g-4">' +

            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-database me-2 text-primary"></i>数据管理</h6></div>' +
            '<div class="card-body">' +
            '<div class="d-flex justify-content-between align-items-center p-3 border rounded mb-3">' +
            '<div><div class="fw-bold mb-1">当前数据量</div><div class="small text-muted">LocalStorage 使用量</div></div>' +
            '<div><div class="fs-3 fw-bold text-primary" id="storageSize">--</div>' +
            '<div class="small text-muted">/ 5MB 上限</div></div></div>' +

            '<div class="mb-3"><label class="form-label small text-muted mb-1">各数据类型数量统计</label>' +
            '<div class="row g-2 text-center small">' +
            statBox('会员', 0, 'memberCount') +
            statBox('宠物', 0, 'petCount') +
            statBox('服务', 0, 'svcCount') +
            statBox('小票', 0, 'rcCount') +
            '</div></div>' +

            '<div class="d-grid gap-2 d-flex mb-2">' +
            '<button class="btn btn-primary flex-grow-1" id="btnExportAll"><i class="bi bi-download me-1"></i>导出全部数据</button>' +
            '<button class="btn btn-outline-primary flex-grow-1" id="btnImportAll"><i class="bi bi-upload me-1"></i>导入数据</button>' +
            '</div>' +
            '<div class="d-grid gap-2 d-flex mb-2">' +
            '<button class="btn btn-outline-info flex-grow-1" id="btnGenLargeData"><i class="bi bi-plus-circle me-1"></i>生成大量测试数据</button>' +
            '<button class="btn btn-outline-success flex-grow-1" id="btnTestVScroll"><i class="bi bi-phone me-1"></i>测试虚拟滚动</button>' +
            '</div>' +
            '<div class="d-grid gap-2 d-flex">' +
            '<button class="btn btn-outline-danger flex-grow-1" id="btnResetData"><i class="bi bi-arrow-repeat me-1"></i>恢复默认演示数据</button>' +
            '<button class="btn btn-outline-warning flex-grow-1" id="btnClearData"><i class="bi bi-trash me-1"></i>清空全部数据</button>' +
            '</div></div></div></div>' +

            '<div class="col-lg-6"><div class="card shadow-sm h-100">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-info-circle me-2 text-info"></i>关于系统</h6></div>' +
            '<div class="card-body">' +
            '<div class="mb-4"><b>萌宠乐美 连锁宠物美容管理系统 v1.0</b>' +
            '<div class="small text-muted mt-1">基于 jQuery 3.7.1 · Bootstrap 5.3.3 架构</div></div>' +

            '<table class="table table-sm table-bordered small mb-4">' +
            '<tbody><tr><td colspan="2" class="table-light text-center fw-bold">架构与模块清单</td></tr>' +
            '<tr><td class="text-muted">应用入口</td><td class="fw-mono">index.html</td></tr>' +
            '<tr><td class="text-muted">数据状态</td><td class="fw-mono">js/store.js</td></tr>' +
            '<tr><td class="text-muted">路由控制</td><td class="fw-mono">js/router.js</td></tr>' +
            '<tr><td class="text-muted">工具函数</td><td class="fw-mono">js/utils/calculator.js</td></tr>' +
            '<tr><td class="text-muted">核心组件</td><td>pet-card / service-panel / schedule-grid</td></tr>' +
            '<tr><td class="text-muted">页面模块</td><td>reception / groomer / member / schedule / pets / checkout / dashboard / settings</td></tr>' +
            '<tr><td class="text-muted">样式扩展</td><td class="fw-mono">css/custom.css</td></tr>' +
            '</tbody></table>' +

            '<div class="alert alert-light small p-2">' +
            '<i class="bi bi-lightbulb me-1"></i> ' +
            '本系统使用 LocalStorage 持久化数据，建议定期导出备份。所有计算、排班数据容量约 5MB，可支持约 5000 条档案记录。</div></div></div></div>' +

            '<div class="col-lg-12"><div class="card shadow-sm">' +
            '<div class="card-header bg-white"><h6 class="mb-0 fw-bold"><i class="bi bi-puzzle me-2 text-success"></i>功能清单对照</h6></div>' +
            '<div class="card-body p-0">' +
            '<div class="row g-0 border-bottom small">' +
            featCol('跨店宠物档案', '录入基础信息 / 历史照片 / 过敏与疫苗', 'bi-heart-pets') +
            featCol('智能服务推荐', '品种适配 / 历史偏好 / 自定义组合', 'bi-lightbulb') +
            featCol('可视化排班', '周视图网格 / 拖拽 / 冲突警示', 'bi-calendar-week') +
            featCol('会员积分储值', '开卡充值 / 跨店通用 / 差异化积分', 'bi-credit-card') +
            '</div><div class="row g-0 small">' +
            featCol('服务进度追踪', '工单流转 / 大屏实时队列', 'bi-list-task') +
            featCol('费用结算收银', '多项目合并 / 混合支付 / 电子小票', 'bi-cash-coin') +
            featCol('经营数据看板', '营业额 / 绩效 / 趋势图 / 对比', 'bi-bar-chart') +
            featCol('响应式界面', '桌面 / 平板 / 移动三端适配', 'bi-phone') +
            '</div></div></div></div>' +

            '</div></div>' +

            '<input type="file" id="importAllFile" accept=".json" class="d-none">';
    }

    function statBox(label, val, id) {
        return '<div class="col-3"><div class="border rounded p-2 bg-light"><div class="fw-bold fs-4" id="' + id + '">' + val + '</div><div class="small text-muted">' + label + '</div></div></div>';
    }

    function featCol(title, desc, icon) {
        return '<div class="col-md-3 p-3 border-end">' +
            '<div class="d-flex align-items-start gap-2 mb-1"><i class="bi ' + icon + ' fs-5 text-success"></i>' +
            '<b>' + title + '</b></div><div class="small text-muted ps-4">' + desc + '</div></div>';
    }

    function bind() {
        $('#storageSize').text(App.store.getStorageSize());
        $('#memberCount').text(App.store.getCustomers().length);
        $('#petCount').text(App.store.getPets().length);
        $('#svcCount').text(App.store.getServices().length);
        $('#rcCount').text(App.store.getReceipts().length);

        $('#btnExportAll').on('click', function() {
            var data = App.store.exportData();
            var blob = new Blob([data], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'pet_grooming_' + Date.now() + '.json'; a.click();
            App.showToast('已导出全部数据', 'success');
        });

        $('#btnImportAll').on('click', function() { $('#importAllFile').click(); });
        $('#importAllFile').on('change', function(e) {
            var file = e.target.files && e.target.files[0];
            if (file) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    try {
                        if (confirm('导入将覆盖现有数据，确定继续？') && App.store.importData(ev.target.result)) {
                            App.showToast('导入成功！页面将刷新...', 'success');
                            setTimeout(function() { location.reload(); }, 1200);
                        } else App.showToast('导入失败', 'error');
                    } catch(err) { App.showToast('解析失败：' + err.message, 'error'); }
                };
                reader.readAsText(file);
            }
        });

        $('#btnResetData').on('click', function() {
            if (confirm('恢复演示数据将覆盖当前全部数据？')) {
                App.store.resetDefaults();
                App.showToast('已恢复默认数据，即将刷新...', 'success');
                setTimeout(function() { location.reload(); }, 1200);
            }
        });

        $('#btnClearData').on('click', function() {
            if (confirm('确定清空所有数据？此操作不可恢复！') && confirm('再次确认：所有宠物档案、会员、服务记录、排班、小票将全部清空？')) {
                localStorage.removeItem('pet_grooming_db_v1');
                App.showToast('数据已清空，刷新后为演示数据...', 'success');
                setTimeout(function() { location.reload(); }, 1200);
            }
        });

        $('#btnGenLargeData').on('click', function() {
            if (confirm('将生成 200 条宠物档案和 150 条会员数据用于测试，确定继续？')) {
                var result = App.store.generateLargeMockData(200, 150);
                App.showToast('已生成 ' + result.pets + ' 条宠物和 ' + result.members + ' 条会员数据，即将刷新...', 'success');
                setTimeout(function() { location.reload(); }, 1500);
            }
        });

        $('#btnTestVScroll').on('click', function() {
            var isMobile = window.innerWidth < 768;
            var petCount = App.store.getPets().length;
            var memberCount = App.store.getCustomers().length;
            var vScrollEnabled = petCount > 100 && isMobile;
            var body = '<div class="alert ' + (vScrollEnabled ? 'alert-success' : 'alert-info') + '">' +
                '<h6><i class="bi bi-info-circle me-2"></i>虚拟滚动检测</h6>' +
                '<ul class="mb-0 small">' +
                '<li>当前窗口宽度：<b>' + window.innerWidth + 'px</b>（移动端阈值：768px）</li>' +
                '<li>是否移动端：<b>' + (isMobile ? '是' : '否') + '</b></li>' +
                '<li>宠物档案数量：<b>' + petCount + '</b>（阈值：100）</li>' +
                '<li>会员数量：<b>' + memberCount + '</b>（阈值：100）</li>' +
                '<li>虚拟滚动状态：<b>' + (vScrollEnabled ? '已启用 ✓' : '未启用') + '</b></li>' +
                '</ul></div>' +
                '<div class="small text-muted">建议：点击「生成大量测试数据」后，再点击「测试虚拟滚动」按钮验证效果。</div>';
            App.showModal('虚拟滚动测试', body);
        });
    }

    App.pages.settings = {
        render: render,
        bind: bind
    };

})(typeof window !== 'undefined' ? window : this);

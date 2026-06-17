const MemberPage = (function() {
    let currentMember = null;
    let currentTab = 'members';
    let consumptionPage = 1;
    let filteredConsumptionRecords = [];

    function render() {
        const html = `
            <div class="fade-in">
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <h1 class="h2">会员中心</h1>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <button type="button" class="btn btn-primary" id="btnAddMember">
                            <i class="bi bi-person-plus me-1"></i>新增会员
                        </button>
                    </div>
                </div>

                <ul class="nav nav-tabs mb-4" id="mainTabs">
                    <li class="nav-item">
                        <button class="nav-link active" data-tab="members" id="tabMembers">
                            <i class="bi bi-people me-1"></i>会员列表
                        </button>
                    </li>
                    <li class="nav-item">
                        <button class="nav-link" data-tab="consumption" id="tabConsumption">
                            <i class="bi bi-receipt me-1"></i>消费记录
                        </button>
                    </li>
                </ul>

                <div id="membersTab">
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <div class="input-group">
                                        <span class="input-group-text"><i class="bi bi-search"></i></span>
                                        <input type="text" class="form-control" id="searchKeyword" placeholder="搜索会员姓名、手机号、卡号">
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <select class="form-select" id="filterCardType">
                                        <option value="">全部卡类型</option>
                                        <option value="prepaid">储值卡</option>
                                        <option value="count">次卡</option>
                                        <option value="year">年卡</option>
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <select class="form-select" id="filterStatus">
                                        <option value="">全部状态</option>
                                        <option value="normal">正常</option>
                                        <option value="warning">余额/次数不足</option>
                                        <option value="expired">已过期</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <button class="btn btn-outline-secondary w-100" id="btnResetSearch">
                                        <i class="bi bi-arrow-clockwise me-1"></i>重置
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-3">
                            <div class="card h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 class="text-muted mb-1">会员总数</h6>
                                            <h3 class="mb-0 text-primary fw-bold" id="statTotalMembers">0</h3>
                                        </div>
                                        <div class="bg-primary bg-opacity-10 rounded-circle p-3">
                                            <i class="bi bi-people fs-3 text-primary"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 class="text-muted mb-1">储值卡会员</h6>
                                            <h3 class="mb-0 text-info fw-bold" id="statPrepaidMembers">0</h3>
                                        </div>
                                        <div class="bg-info bg-opacity-10 rounded-circle p-3">
                                            <i class="bi bi-credit-card fs-3 text-info"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 class="text-muted mb-1">总储值余额</h6>
                                            <h3 class="mb-0 text-success fw-bold" id="statTotalBalance">¥0</h3>
                                        </div>
                                        <div class="bg-success bg-opacity-10 rounded-circle p-3">
                                            <i class="bi bi-wallet fs-3 text-success"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="card h-100">
                                <div class="card-body">
                                    <div class="d-flex justify-content-between align-items-start">
                                        <div>
                                            <h6 class="text-muted mb-1">总积分</h6>
                                            <h3 class="mb-0 text-warning fw-bold" id="statTotalPoints">0</h3>
                                        </div>
                                        <div class="bg-warning bg-opacity-10 rounded-circle p-3">
                                            <i class="bi bi-star fs-3 text-warning"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th>会员卡号</th>
                                            <th>姓名</th>
                                            <th>手机号</th>
                                            <th>卡类型</th>
                                            <th>余额/次数</th>
                                            <th>积分</th>
                                            <th>状态</th>
                                            <th>注册时间</th>
                                            <th>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody id="memberTableBody">
                                        <tr>
                                            <td colspan="9" class="text-center py-4 text-muted">加载中...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <nav class="p-3 border-top">
                                <ul class="pagination justify-content-center mb-0" id="pagination">
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>

                <div id="consumptionTab" style="display: none;">
                    <div class="card mb-4">
                        <div class="card-body">
                            <div class="row g-3 align-items-end">
                                <div class="col-md-2">
                                    <label class="form-label">开始日期</label>
                                    <input type="text" class="form-control datepicker" id="consStartDate" placeholder="选择开始日期">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">结束日期</label>
                                    <input type="text" class="form-control datepicker" id="consEndDate" placeholder="选择结束日期">
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">最低金额</label>
                                    <div class="input-group">
                                        <span class="input-group-text">¥</span>
                                        <input type="number" class="form-control" id="consMinAmount" min="0" step="0.01" placeholder="最低金额">
                                    </div>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">最高金额</label>
                                    <div class="input-group">
                                        <span class="input-group-text">¥</span>
                                        <input type="number" class="form-control" id="consMaxAmount" min="0" step="0.01" placeholder="最高金额">
                                    </div>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">会员卡号</label>
                                    <select class="form-select" id="consMemberCard">
                                        <option value="">全部会员</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <label class="form-label">&nbsp;</label>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-outline-secondary flex-fill" id="btnResetConsumption">
                                            <i class="bi bi-arrow-clockwise"></i>
                                        </button>
                                        <button class="btn btn-primary flex-fill" id="btnApplyConsumption">
                                            <i class="bi bi-filter me-1"></i>筛选
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div class="row g-3 mt-2">
                                <div class="col-md-12 d-flex justify-content-between align-items-center">
                                    <div>
                                        <span class="text-muted">共 <span class="fw-bold text-primary" id="consumptionTotalCount">0</span> 条记录</span>
                                        <span class="mx-3 text-muted">总金额: <span class="fw-bold text-success" id="consumptionTotalAmount">¥0.00</span></span>
                                    </div>
                                    <div class="btn-group">
                                        <button type="button" class="btn btn-outline-success" id="btnExportCSV">
                                            <i class="bi bi-filetype-csv me-1"></i>导出 CSV
                                        </button>
                                        <button type="button" class="btn btn-outline-success" id="btnExportExcel">
                                            <i class="bi bi-file-earmark-excel me-1"></i>导出 Excel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th>消费时间</th>
                                            <th>会员卡号</th>
                                            <th>会员姓名</th>
                                            <th>联系电话</th>
                                            <th>车牌号</th>
                                            <th>服务项目</th>
                                            <th>工时费</th>
                                            <th>材料费</th>
                                            <th>实付金额</th>
                                            <th>状态</th>
                                        </tr>
                                    </thead>
                                    <tbody id="consumptionTableBody">
                                        <tr>
                                            <td colspan="10" class="text-center py-4 text-muted">加载中...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <nav class="p-3 border-top">
                                <ul class="pagination justify-content-center mb-0" id="consumptionPagination">
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="memberModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="memberModalTitle">新增会员</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="memberForm" class="needs-validation" novalidate>
                            <input type="hidden" id="memberId">
                            <div class="modal-body">
                                <div class="row g-3">
                                    <div class="col-md-4">
                                        <label class="form-label">会员姓名 <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="memberName" name="name" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">手机号 <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="memberPhone" name="phone" maxlength="11" required>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">会员卡号</label>
                                        <input type="text" class="form-control" id="memberCardNo" name="cardNo" placeholder="系统自动生成">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">卡类型 <span class="text-danger">*</span></label>
                                        <select class="form-select" id="memberCardType" name="cardType" required>
                                            <option value="prepaid">储值卡</option>
                                            <option value="count">次卡</option>
                                            <option value="year">年卡</option>
                                        </select>
                                        <div class="invalid-feedback"></div>
                                    </div>
                                    <div class="col-md-4" id="prepaidField">
                                        <label class="form-label">初始余额 <span class="text-danger">*</span></label>
                                        <div class="input-group">
                                            <span class="input-group-text">¥</span>
                                            <input type="number" class="form-control" id="memberBalance" name="balance" min="0" step="0.01" value="0">
                                        </div>
                                    </div>
                                    <div class="col-md-4" id="countField" style="display: none;">
                                        <label class="form-label">初始次数 <span class="text-danger">*</span></label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="memberCount" name="remainingTimes" min="0" value="0">
                                            <span class="input-group-text">次</span>
                                        </div>
                                    </div>
                                    <div class="col-md-4" id="yearField" style="display: none;">
                                        <label class="form-label">有效期至</label>
                                        <input type="text" class="form-control datepicker" id="memberExpiryDate" name="expiryDate" placeholder="默认一年">
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">初始积分</label>
                                        <div class="input-group">
                                            <input type="number" class="form-control" id="memberPoints" name="points" min="0" value="0">
                                            <span class="input-group-text">分</span>
                                        </div>
                                    </div>
                                    <div class="col-md-12">
                                        <label class="form-label">备注</label>
                                        <textarea class="form-control" id="memberRemark" name="remark" rows="2"></textarea>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-save me-1"></i>保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="memberDetailModal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">会员详情</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="memberDetailContent">
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="rechargeModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="rechargeModalTitle">会员充值</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3" id="rechargeMemberInfo">
                            </div>
                            <div class="mb-3" id="rechargeAmountField">
                                <label class="form-label">充值金额 <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <span class="input-group-text">¥</span>
                                    <input type="number" class="form-control" id="rechargeAmount" min="1" step="0.01" placeholder="请输入充值金额">
                                </div>
                            </div>
                            <div class="mb-3" id="rechargeCountField" style="display: none;">
                                <label class="form-label">充值次数 <span class="text-danger">*</span></label>
                                <div class="input-group">
                                    <input type="number" class="form-control" id="rechargeCount" min="1" placeholder="请输入充值次数">
                                    <span class="input-group-text">次</span>
                                </div>
                            </div>
                            <div class="mb-3" id="rechargeYearField" style="display: none;">
                                <label class="form-label">续期年数 <span class="text-danger">*</span></label>
                                <select class="form-select" id="rechargeYear">
                                    <option value="1">1年</option>
                                    <option value="2">2年</option>
                                    <option value="3">3年</option>
                                    <option value="5">5年</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">备注</label>
                                <textarea class="form-control" id="rechargeRemark" rows="2" placeholder="充值备注"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" id="btnConfirmRecharge">
                                <i class="bi bi-check-circle me-1"></i>确认充值
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="exchangeModal" tabindex="-1" data-bs-backdrop="static">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">积分兑换</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info mb-3">
                                <i class="bi bi-info-circle me-2"></i>
                                当前积分: <span class="fw-bold" id="currentPoints">0</span> 分
                            </div>
                            <div class="list-group" id="exchangeRules">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $('#main-content').html(html);
        bindEvents();
        loadMemberCardOptions();
        loadMemberStats();
        loadMembers();
        initDatePicker();
    }

    function initDatePicker() {
        try {
            $('.datepicker').datepicker('destroy');
        } catch (e) {}
        $('.datepicker').off('click.datepicker-init').on('click.datepicker-init', function() {
            $(this).datepicker('show');
        });
        $('.datepicker').datepicker({
            format: 'yyyy-mm-dd',
            autoclose: true,
            todayHighlight: true,
            language: 'zh-CN'
        });
    }

    function bindEvents() {
        $('#btnAddMember').on('click', () => showModal());

        $('#mainTabs .nav-link').on('click', function() {
            switchTab($(this).data('tab'));
        });

        $('#searchKeyword').on('input', Helpers.debounce(function() {
            loadMembers();
        }, 300));

        $('#filterCardType, #filterStatus').on('change', function() {
            loadMembers();
        });

        $('#btnResetSearch').on('click', function() {
            $('#searchKeyword').val('');
            $('#filterCardType').val('');
            $('#filterStatus').val('');
            loadMembers();
        });

        $('#memberCardType').on('change', function() {
            const type = $(this).val();
            $('#prepaidField').toggle(type === 'prepaid');
            $('#countField').toggle(type === 'count');
            $('#yearField').toggle(type === 'year');
            if (type === 'year') {
                setTimeout(() => initDatePicker(), 30);
            }
        });

        $('#btnConfirmRecharge').on('click', handleRecharge);

        $('#btnApplyConsumption').on('click', function() {
            consumptionPage = 1;
            loadConsumptionRecords();
        });

        $('#btnResetConsumption').on('click', function() {
            $('#consStartDate').val('');
            $('#consEndDate').val('');
            $('#consMinAmount').val('');
            $('#consMaxAmount').val('');
            $('#consMemberCard').val('');
            consumptionPage = 1;
            loadConsumptionRecords();
        });

        $('#btnExportCSV').on('click', function() {
            exportConsumption('csv');
        });

        $('#btnExportExcel').on('click', function() {
            exportConsumption('excel');
        });

        Validator.extendJQueryValidation();
        $('#memberForm').validate({
            rules: {
                name: 'required',
                phone: {
                    required: true,
                    cnMobile: true
                },
                cardType: 'required',
                balance: {
                    required: {
                        depends: function() {
                            return $('#memberCardType').val() === 'prepaid';
                        }
                    },
                    amount: true
                },
                remainingTimes: {
                    required: {
                        depends: function() {
                            return $('#memberCardType').val() === 'count';
                        }
                    },
                    digits: true,
                    min: 1
                }
            },
            messages: {
                name: '请输入会员姓名',
                phone: {
                    required: '请输入手机号',
                    cnMobile: '请输入正确的手机号'
                },
                cardType: '请选择卡类型',
                balance: {
                    required: '请输入初始余额',
                    amount: '请输入有效的金额'
                },
                remainingTimes: {
                    required: '请输入初始次数',
                    digits: '请输入整数',
                    min: '次数必须大于0'
                }
            },
            errorElement: 'div',
            errorClass: 'invalid-feedback',
            highlight: function(element) {
                $(element).addClass('is-invalid').removeClass('is-valid');
            },
            unhighlight: function(element) {
                $(element).removeClass('is-invalid').addClass('is-valid');
            },
            submitHandler: function(form) {
                saveMember();
                return false;
            }
        });
    }

    function switchTab(tab) {
        currentTab = tab;
        $('#mainTabs .nav-link').removeClass('active');
        $('#tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).addClass('active');
        $('#membersTab').toggle(tab === 'members');
        $('#consumptionTab').toggle(tab === 'consumption');

        if (tab === 'consumption') {
            setTimeout(() => {
                initDatePicker();
                loadConsumptionRecords();
            }, 100);
        }
    }

    function loadMemberCardOptions() {
        const members = MemberService.findAll();
        const options = members
            .sort((a, b) => (a.cardNo || '').localeCompare(b.cardNo || ''))
            .map(m => `<option value="${m.id}">${m.cardNo || '无卡号'} - ${m.name}</option>`)
            .join('');
        $('#consMemberCard').append(options);
    }

    function showModal(memberId = null) {
        currentMember = null;

        $('#memberForm')[0].reset();
        $('#memberForm').find('.is-invalid, .is-valid').removeClass('is-invalid is-valid');
        $('#memberId').val('');
        $('#prepaidField').show();
        $('#countField').hide();
        $('#yearField').hide();
        $('#memberExpiryDate').val('');

        if (memberId) {
            const member = MemberService.findById(memberId);
            if (member) {
                currentMember = member;
                $('#memberModalTitle').text('编辑会员');
                $('#memberId').val(member.id);
                $('#memberName').val(member.name);
                $('#memberPhone').val(member.phone);
                $('#memberCardNo').val(member.cardNo || '');
                $('#memberCardType').val(member.cardType).trigger('change');
                $('#memberPoints').val(member.points || 0);
                $('#memberRemark').val(member.remark || '');

                if (member.cardType === 'prepaid') {
                    $('#memberBalance').val(member.balance || 0);
                } else if (member.cardType === 'count') {
                    $('#memberCount').val(member.remainingTimes || 0);
                } else if (member.cardType === 'year') {
                    $('#memberExpiryDate').val(member.expiryDate || '');
                }
            }
        } else {
            $('#memberModalTitle').text('新增会员');
            const cardNo = 'HY' + Date.now().toString().slice(-8);
            $('#memberCardNo').val(cardNo);
            $('#memberExpiryDate').val(new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0]);
        }

        const modal = new bootstrap.Modal(document.getElementById('memberModal'));
        modal.show();

        setTimeout(() => {
            initDatePicker();
            $('#memberName').focus();
        }, 500);
    }

    function saveMember() {
        if (!$('#memberForm').valid()) return;

        const formData = Helpers.serializeForm('memberForm');

        try {
            Helpers.showLoading(true, '保存中...');

            if (currentMember) {
                MemberService.update(currentMember.id, formData);
                Helpers.showToast('会员信息更新成功', 'success');
            } else {
                MemberService.create(formData);
                Helpers.showToast('会员注册成功', 'success');
                loadMemberCardOptions();
            }

            bootstrap.Modal.getInstance(document.getElementById('memberModal')).hide();
            loadMemberStats();
            loadMembers();
        } catch (error) {
            Helpers.showToast(error.message, 'error');
        } finally {
            Helpers.showLoading(false);
        }
    }

    function loadMemberStats() {
        const members = MemberService.findAll();
        const cardTypeDist = MemberService.getCardTypeDistribution();

        $('#statTotalMembers').text(members.length);
        $('#statPrepaidMembers').text(cardTypeDist.find(d => d.type === 'prepaid')?.count || 0);
        $('#statTotalBalance').text(Helpers.formatCurrency(members.reduce((sum, m) => sum + (m.balance || 0), 0)));
        $('#statTotalPoints').text(members.reduce((sum, m) => sum + (m.points || 0), 0).toLocaleString());
    }

    function loadMembers(page = 1) {
        const pageSize = 10;
        const keyword = $('#searchKeyword').val().trim().toLowerCase();
        const cardType = $('#filterCardType').val();
        const statusFilter = $('#filterStatus').val();

        let members = MemberService.findAll();

        if (keyword) {
            members = members.filter(m =>
                (m.name && m.name.toLowerCase().includes(keyword)) ||
                (m.phone && m.phone.includes(keyword)) ||
                (m.cardNo && m.cardNo.toLowerCase().includes(keyword))
            );
        }

        if (cardType) {
            members = members.filter(m => m.cardType === cardType);
        }

        if (statusFilter) {
            members = members.filter(m => {
                const stats = MemberService.getMemberStats(m.id);
                const status = stats ? stats.cardStatus : '正常';

                if (statusFilter === 'normal') return status === '正常';
                if (statusFilter === 'warning') return status === '余额不足' || status === '次数不足' || status === '即将过期';
                if (statusFilter === 'expired') return status === '已过期';
                return true;
            });
        }

        members.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const totalPages = Math.ceil(members.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const pageData = members.slice(startIndex, startIndex + pageSize);

        renderMemberTable(pageData);
        renderPagination(page, totalPages);
    }

    function renderMemberTable(members) {
        const tbody = $('#memberTableBody');

        if (members.length === 0) {
            tbody.html('<tr><td colspan="9" class="text-center py-4 text-muted">暂无会员数据</td></tr>');
            return;
        }

        tbody.html(members.map(member => {
            const stats = MemberService.getMemberStats(member.id);
            const status = stats ? stats.cardStatus : '正常';

            let statusBadge = '';
            if (status === '正常') {
                statusBadge = '<span class="badge bg-success">正常</span>';
            } else if (status === '已过期') {
                statusBadge = '<span class="badge bg-danger">已过期</span>';
            } else {
                statusBadge = '<span class="badge bg-warning text-dark">' + status + '</span>';
            }

            let balanceText = '';
            if (member.cardType === 'prepaid') {
                balanceText = Helpers.formatCurrency(member.balance || 0);
            } else if (member.cardType === 'count') {
                balanceText = (member.remainingTimes || 0) + ' 次';
            } else if (member.cardType === 'year') {
                balanceText = member.expiryDate || '长期有效';
            }

            return `
                <tr>
                    <td class="fw-bold text-primary">${member.cardNo || '-'}</td>
                    <td>${member.name}</td>
                    <td>${member.phone}</td>
                    <td><span class="${Helpers.getMemberCardTypeClass(member.cardType)}">${Helpers.getMemberCardTypeText(member.cardType)}</span></td>
                    <td>${balanceText}</td>
                    <td>${(member.points || 0).toLocaleString()} 分</td>
                    <td>${statusBadge}</td>
                    <td>${Helpers.formatDate(member.createdAt, 'MM-DD')}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="MemberPage.viewDetail('${member.id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="MemberPage.edit('${member.id}')">
                                <i class="bi bi-pencil"></i>
                            </button>
                            <button class="btn btn-outline-success" onclick="MemberPage.showRecharge('${member.id}')">
                                <i class="bi bi-plus-circle"></i>
                            </button>
                            <button class="btn btn-outline-warning" onclick="MemberPage.showExchange('${member.id}')">
                                <i class="bi bi-gift"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="MemberPage.remove('${member.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join(''));
    }

    function renderPagination(currentPage, totalPages) {
        const pagination = $('#pagination');
        if (totalPages <= 1) {
            pagination.empty();
            return;
        }

        let html = '';

        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="MemberPage.loadPage(${currentPage - 1}); return false;">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="MemberPage.loadPage(${i}); return false;">${i}</a>
                    </li>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="MemberPage.loadPage(${currentPage + 1}); return false;">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;

        pagination.html(html);
    }

    function loadPage(page) {
        loadMembers(page);
    }

    function loadConsumptionRecords(page = null) {
        if (page !== null) consumptionPage = page;

        const pageSize = 10;
        const filters = {
            startDate: $('#consStartDate').val() || null,
            endDate: $('#consEndDate').val() || null,
            minAmount: $('#consMinAmount').val() || null,
            maxAmount: $('#consMaxAmount').val() || null,
            memberId: $('#consMemberCard').val() || null
        };

        filteredConsumptionRecords = MemberService.getAllConsumptionRecords(filters);

        const totalCount = filteredConsumptionRecords.length;
        const totalAmount = filteredConsumptionRecords.reduce((sum, r) => sum + (r.actualAmount || 0), 0);
        $('#consumptionTotalCount').text(totalCount.toLocaleString());
        $('#consumptionTotalAmount').text(Helpers.formatCurrency(totalAmount));

        const totalPages = Math.ceil(totalCount / pageSize);
        const startIndex = (consumptionPage - 1) * pageSize;
        const pageData = filteredConsumptionRecords.slice(startIndex, startIndex + pageSize);

        renderConsumptionTable(pageData);
        renderConsumptionPagination(consumptionPage, totalPages);
    }

    function renderConsumptionTable(records) {
        const tbody = $('#consumptionTableBody');

        if (records.length === 0) {
            tbody.html('<tr><td colspan="10" class="text-center py-4 text-muted">暂无消费记录</td></tr>');
            return;
        }

        tbody.html(records.map(record => `
            <tr>
                <td>${Helpers.formatDate(record.createdAt, 'YYYY-MM-DD HH:mm')}</td>
                <td class="fw-bold text-primary">${record.memberCardNo}</td>
                <td>${record.memberName}</td>
                <td>${record.memberPhone}</td>
                <td>${record.plateNo || '-'}</td>
                <td><span class="text-truncate d-inline-block" style="max-width: 200px;" title="${record.serviceItems}">${record.serviceItems || '-'}</span></td>
                <td>${Helpers.formatCurrency(record.laborFee || 0)}</td>
                <td>${Helpers.formatCurrency(record.materialFee || 0)}</td>
                <td class="fw-bold text-success">${Helpers.formatCurrency(record.actualAmount || 0)}</td>
                <td>${Helpers.getStatusBadge(record.status)}</td>
            </tr>
        `).join(''));
    }

    function renderConsumptionPagination(currentPage, totalPages) {
        const pagination = $('#consumptionPagination');
        if (totalPages <= 1) {
            pagination.empty();
            return;
        }

        let html = '';

        html += `
            <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="MemberPage.loadConsumptionPage(${currentPage - 1}); return false;">
                    <i class="bi bi-chevron-left"></i>
                </a>
            </li>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                html += `
                    <li class="page-item ${i === currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" onclick="MemberPage.loadConsumptionPage(${i}); return false;">${i}</a>
                    </li>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        html += `
            <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="MemberPage.loadConsumptionPage(${currentPage + 1}); return false;">
                    <i class="bi bi-chevron-right"></i>
                </a>
            </li>
        `;

        pagination.html(html);
    }

    function loadConsumptionPage(page) {
        loadConsumptionRecords(page);
    }

    function exportConsumption(format) {
        if (!filteredConsumptionRecords || filteredConsumptionRecords.length === 0) {
            Helpers.showToast('暂无数据可导出', 'warning');
            return;
        }

        const count = filteredConsumptionRecords.length;
        const formatName = format === 'excel' ? 'Excel' : 'CSV';

        Helpers.showLoading(true, `正在导出${count}条${formatName}数据...`);

        setTimeout(() => {
            try {
                MemberService.exportConsumptionRecords(filteredConsumptionRecords, format);
                Helpers.showToast(`成功导出 ${count} 条记录为 ${formatName}`, 'success');
            } catch (error) {
                console.error('Export error:', error);
                Helpers.showToast('导出失败: ' + error.message, 'error');
            } finally {
                Helpers.showLoading(false);
            }
        }, 100);
    }

    function viewDetail(memberId) {
        const member = MemberService.findById(memberId);
        if (!member) return;

        currentMember = member;
        const stats = MemberService.getMemberStats(memberId);
        const transactions = MemberService.getTransactions(memberId, { limit: 20 });
        const history = MemberService.getConsumptionHistory(memberId, 10);

        let cardInfo = '';
        if (member.cardType === 'prepaid') {
            cardInfo = `余额: ${Helpers.formatCurrency(member.balance || 0)}`;
        } else if (member.cardType === 'count') {
            cardInfo = `剩余: ${member.remainingTimes || 0} 次`;
        } else if (member.cardType === 'year') {
            cardInfo = member.expiryDate ? `有效期至: ${member.expiryDate}` : '长期有效';
        }

        $('#memberDetailContent').html(`
            <div class="row g-3 mb-4">
                <div class="col-md-4">
                    <div class="card h-100 bg-primary text-white">
                        <div class="card-body">
                            <h5 class="card-title">${member.name}</h5>
                            <p class="card-text">
                                ${member.cardNo || '普通会员'}<br>
                                ${member.phone}<br>
                                ${cardInfo}
                            </p>
                            <div class="d-flex gap-4 mt-3">
                                <div>
                                    <small class="text-white-50">积分</small>
                                    <h3 class="mb-0">${(member.points || 0).toLocaleString()}</h3>
                                </div>
                                <div>
                                    <small class="text-white-50">累计消费</small>
                                    <h3 class="mb-0">${Helpers.formatCurrency(stats?.totalSpent || 0)}</h3>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-8">
                    <div class="card h-100">
                        <div class="card-body">
                            <div class="row g-3">
                                <div class="col-6">
                                    <small class="text-muted d-block">累计到店</small>
                                    <h4 class="mb-0">${stats?.totalVisits || 0} 次</h4>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block">平均消费</small>
                                    <h4 class="mb-0">${Helpers.formatCurrency(stats?.averageSpent || 0)}</h4>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block">上次到店</small>
                                    <h5 class="mb-0">${stats?.lastVisit ? Helpers.formatDate(stats.lastVisit, 'YYYY-MM-DD') : '首次到店'}</h5>
                                </div>
                                <div class="col-6">
                                    <small class="text-muted d-block">卡片状态</small>
                                    <h5 class="mb-0 ${stats?.cardStatus === '正常' ? 'text-success' : stats?.cardStatus === '已过期' ? 'text-danger' : 'text-warning'}">${stats?.cardStatus || '正常'}</h5>
                                </div>
                                <div class="col-12 mt-3">
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-outline-primary" onclick="MemberPage.edit('${memberId}')">
                                            <i class="bi bi-pencil me-1"></i>编辑信息
                                        </button>
                                        <button class="btn btn-outline-success" onclick="bootstrap.Modal.getInstance(document.getElementById('memberDetailModal')).hide(); MemberPage.showRecharge('${memberId}')">
                                            <i class="bi bi-plus-circle me-1"></i>充值/续期
                                        </button>
                                        <button class="btn btn-outline-warning" onclick="bootstrap.Modal.getInstance(document.getElementById('memberDetailModal')).hide(); MemberPage.showExchange('${memberId}')">
                                            <i class="bi bi-gift me-1"></i>积分兑换
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ul class="nav nav-tabs mb-3" id="detailTabs">
                <li class="nav-item">
                    <button class="nav-link active" data-tab="consumption">消费记录</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" data-tab="transaction">账户变动</button>
                </li>
            </ul>

            <div id="tabContent">
                <div id="consumptionTab">
                    ${history.length === 0 ? `
                        <div class="text-center text-muted py-5">
                            <i class="bi bi-receipt fs-1 d-block mb-3"></i>
                            <p class="mb-0">暂无消费记录</p>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead class="table-light">
                                    <tr>
                                        <th>时间</th>
                                        <th>服务项目</th>
                                        <th>金额</th>
                                        <th>状态</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${history.map(order => `
                                        <tr>
                                            <td>${Helpers.formatDate(order.createdAt, 'YYYY-MM-DD HH:mm')}</td>
                                            <td>${order.items.map(i => i.itemName).join('、')}</td>
                                            <td>${Helpers.formatCurrency(order.actualAmount)}</td>
                                            <td>${Helpers.getStatusBadge(order.status)}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                <div id="transactionTab" style="display: none;">
                    ${transactions.length === 0 ? `
                        <div class="text-center text-muted py-5">
                            <i class="bi bi-wallet fs-1 d-block mb-3"></i>
                            <p class="mb-0">暂无账户变动记录</p>
                        </div>
                    ` : `
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead class="table-light">
                                    <tr>
                                        <th>时间</th>
                                        <th>类型</th>
                                        <th>金额</th>
                                        <th>积分</th>
                                        <th>备注</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${transactions.map(t => `
                                        <tr>
                                            <td>${Helpers.formatDate(t.createdAt, 'YYYY-MM-DD HH:mm')}</td>
                                            <td>
                                                ${t.type === 'recharge' ? '<span class="text-success">充值</span>' :
                                                  t.type === 'consume' ? '<span class="text-primary">消费</span>' :
                                                  t.type === 'redeem' ? '<span class="text-warning">兑换</span>' : t.type}
                                            </td>
                                            <td>${t.amount > 0 ? '+' : ''}${Helpers.formatCurrency(t.amount)}</td>
                                            <td>${t.points > 0 ? '+' : ''}${t.points} 分</td>
                                            <td>${t.remark || '-'}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `);

        $('#detailTabs .nav-link').off('click').on('click', function() {
            $('#detailTabs .nav-link').removeClass('active');
            $(this).addClass('active');
            const tab = $(this).data('tab');
            $('#tabContent #consumptionTab').toggle(tab === 'consumption');
            $('#tabContent #transactionTab').toggle(tab === 'transaction');
        });

        const modal = new bootstrap.Modal(document.getElementById('memberDetailModal'));
        modal.show();
    }

    function showRecharge(memberId) {
        const member = MemberService.findById(memberId);
        if (!member) return;

        currentMember = member;

        $('#rechargeMemberInfo').html(`
            <div class="alert alert-info mb-0">
                <strong>${member.name}</strong> (${member.cardNo || '普通会员'})<br>
                <small class="text-muted">
                    ${Helpers.getMemberCardTypeText(member.cardType)} ·
                    ${member.cardType === 'prepaid' ? '当前余额: ' + Helpers.formatCurrency(member.balance || 0) :
                      member.cardType === 'count' ? '剩余次数: ' + (member.remainingTimes || 0) + ' 次' :
                      member.expiryDate ? '有效期至: ' + member.expiryDate : '长期有效'}
                </small>
            </div>
        `);

        $('#rechargeAmountField').toggle(member.cardType === 'prepaid');
        $('#rechargeCountField').toggle(member.cardType === 'count');
        $('#rechargeYearField').toggle(member.cardType === 'year');
        $('#rechargeAmount').val('');
        $('#rechargeCount').val('');
        $('#rechargeRemark').val('');

        const titles = {
            'prepaid': '储值充值',
            'count': '次卡充值',
            'year': '年卡续期'
        };
        $('#rechargeModalTitle').text(titles[member.cardType] || '会员充值');

        const modal = new bootstrap.Modal(document.getElementById('rechargeModal'));
        modal.show();
    }

    function handleRecharge() {
        if (!currentMember) return;

        try {
            if (currentMember.cardType === 'prepaid') {
                const amount = parseFloat($('#rechargeAmount').val());
                if (!amount || amount <= 0) {
                    Helpers.showToast('请输入有效的充值金额', 'error');
                    return;
                }
                MemberService.rechargeBalance(currentMember.id, amount);
                Helpers.showToast(`充值成功，余额: ${Helpers.formatCurrency(currentMember.balance + amount)}`, 'success');
            } else if (currentMember.cardType === 'count') {
                const count = parseInt($('#rechargeCount').val(), 10);
                if (!count || count <= 0) {
                    Helpers.showToast('请输入有效的充值次数', 'error');
                    return;
                }
                MemberService.rechargeCount(currentMember.id, count);
                Helpers.showToast(`充值成功，剩余次数: ${(currentMember.remainingTimes || 0) + count} 次`, 'success');
            } else if (currentMember.cardType === 'year') {
                const years = parseInt($('#rechargeYear').val(), 10) || 1;
                MemberService.renewYearCard(currentMember.id, years);
                Helpers.showToast(`续期成功，有效期延长 ${years} 年`, 'success');
            }

            const remark = $('#rechargeRemark').val().trim();
            if (remark) {
                MemberService.addTransaction(currentMember.id, {
                    type: 'recharge',
                    remark: remark
                });
            }

            bootstrap.Modal.getInstance(document.getElementById('rechargeModal')).hide();
            loadMemberStats();
            loadMembers();
            loadMemberCardOptions();
        } catch (error) {
            Helpers.showToast(error.message, 'error');
        }
    }

    function showExchange(memberId) {
        const member = MemberService.findById(memberId);
        if (!member) return;

        currentMember = member;
        $('#currentPoints').text(member.points || 0);

        const rules = MemberService.getPointsExchangeRules();
        $('#exchangeRules').html(rules.map(rule => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${rule.reward}</h6>
                    <small class="text-muted">价值: ${Helpers.formatCurrency(rule.value)}</small>
                </div>
                <button class="btn btn-outline-warning ${(member.points || 0) < rule.points ? 'disabled' : ''}"
                        onclick="MemberPage.doExchange('${memberId}', ${rule.points}, '${rule.reward}')"
                        ${(member.points || 0) < rule.points ? 'disabled' : ''}>
                    ${rule.points} 积分兑换
                </button>
            </div>
        `).join(''));

        const modal = new bootstrap.Modal(document.getElementById('exchangeModal'));
        modal.show();
    }

    function doExchange(memberId, points, reward) {
        Helpers.showConfirm(`确定使用 ${points} 积分兑换"${reward}"吗？`, '确认兑换').then(confirmed => {
            if (confirmed) {
                try {
                    MemberService.redeemPoints(memberId, points, reward);
                    Helpers.showToast('兑换成功', 'success');
                    bootstrap.Modal.getInstance(document.getElementById('exchangeModal')).hide();
                    loadMemberStats();
                    loadMembers();
                } catch (error) {
                    Helpers.showToast(error.message, 'error');
                }
            }
        });
    }

    function edit(id) {
        showModal(id);
    }

    function remove(id) {
        Helpers.showConfirm('确定要删除该会员吗？删除后所有关联记录将被清除，无法恢复。', '确认删除').then(confirmed => {
            if (confirmed) {
                try {
                    MemberService.remove(id);
                    Helpers.showToast('删除成功', 'success');
                    loadMemberStats();
                    loadMembers();
                    loadMemberCardOptions();
                } catch (error) {
                    Helpers.showToast(error.message, 'error');
                }
            }
        });
    }

    function init() {
        $(document).off('dataSynced.member').on('dataSynced.member', function(e, data) {
            if (data.key === 'members') {
                loadMemberStats();
                if (currentTab === 'members') {
                    loadMembers();
                }
                if (currentTab === 'consumption') {
                    loadMemberCardOptions();
                    loadConsumptionRecords();
                }
            }
        });
    }

    return {
        render,
        init,
        loadPage,
        loadConsumptionPage,
        edit,
        viewDetail,
        showRecharge,
        showExchange,
        doExchange,
        remove
    };
})();

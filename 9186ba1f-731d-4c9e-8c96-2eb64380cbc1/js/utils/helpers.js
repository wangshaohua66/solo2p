const Helpers = (function() {
    function formatCurrency(amount) {
        return '¥' + parseFloat(amount || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatDate(dateStr, format = 'YYYY-MM-DD') {
        const date = dateStr ? new Date(dateStr) : new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }

    function formatDateTime(dateStr) {
        return formatDate(dateStr, 'YYYY-MM-DD HH:mm');
    }

    function getStatusText(status) {
        const statusMap = {
            'pending': '待接车',
            'repairing': '维修中',
            'settlement': '待结算',
            'completed': '已完成'
        };
        return statusMap[status] || status;
    }

    function getStatusClass(status) {
        const classMap = {
            'pending': 'bg-secondary',
            'repairing': 'bg-warning text-dark',
            'settlement': 'bg-primary',
            'completed': 'bg-success'
        };
        return classMap[status] || 'bg-secondary';
    }

    function getStatusBadge(status) {
        return '<span class="badge ' + getStatusClass(status) + '">' + getStatusText(status) + '</span>';
    }

    function getMemberCardTypeText(type) {
        const typeMap = {
            'prepaid': '储值卡',
            'count': '次卡',
            'year': '年卡'
        };
        return typeMap[type] || type;
    }

    function getMemberCardTypeClass(type) {
        const classMap = {
            'prepaid': 'text-primary',
            'count': 'text-success',
            'year': 'text-warning'
        };
        return classMap[type] || 'text-secondary';
    }

    function getPackageTypeText(type) {
        const typeMap = {
            'standard': '标准保养',
            'seasonal': '季节性套餐',
            'member': '会员专享'
        };
        return typeMap[type] || type;
    }

    function getServiceCategoryText(category) {
        const categoryMap = {
            'maintenance': '保养',
            'repair': '维修',
            'beauty': '美容'
        };
        return categoryMap[category] || category;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    function generateRandomId(prefix = 'id') {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function downloadCSV(data, filename) {
        if (!data || data.length === 0) {
            alert('没有数据可导出');
            return;
        }

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    let value = row[header] === null || row[header] === undefined ? '' : row[header];
                    value = String(value).replace(/"/g, '""');
                    return '"' + value + '"';
                }).join(',')
            )
        ].join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename + '_' + formatDate(null, 'YYYYMMDD') + '.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function showToast(message, type = 'info', duration = 3000) {
        const toastId = 'toast_' + Date.now();
        const iconClass = {
            'success': 'bi-check-circle-fill text-success',
            'error': 'bi-x-circle-fill text-danger',
            'warning': 'bi-exclamation-triangle-fill text-warning',
            'info': 'bi-info-circle-fill text-primary'
        }[type] || 'bi-info-circle-fill text-primary';

        const toastHtml = `
            <div id="${toastId}" class="toast align-items-center border-0 shadow-lg" role="alert" style="min-width: 300px;">
                <div class="d-flex">
                    <div class="toast-body d-flex align-items-center">
                        <i class="${iconClass} fs-4 me-2"></i>
                        <span>${message}</span>
                    </div>
                    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        if ($('#toast-container').length === 0) {
            $('body').append('<div id="toast-container" class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999;"></div>');
        }

        $('#toast-container').append(toastHtml);
        const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: duration });
        toast.show();

        $('#' + toastId).on('hidden.bs.toast', function() {
            $(this).remove();
        });
    }

    function showConfirm(message, title = '确认操作') {
        return new Promise((resolve) => {
            const modalId = 'confirm_modal_' + Date.now();
            const modalHtml = `
                <div class="modal fade" id="${modalId}" tabindex="-1">
                    <div class="modal-dialog modal-dialog-centered">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">${title}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <p class="mb-0">${message}</p>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                                <button type="button" class="btn btn-primary btn-confirm">确认</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            $('body').append(modalHtml);
            const modal = new bootstrap.Modal(document.getElementById(modalId));
            modal.show();

            $('#' + modalId + ' .btn-confirm').on('click', function() {
                modal.hide();
                setTimeout(() => {
                    $('#' + modalId).remove();
                    resolve(true);
                }, 200);
            });

            $('#' + modalId).on('hidden.bs.modal', function() {
                $(this).remove();
                resolve(false);
            });
        });
    }

    function showLoading(show = true, text = '加载中...') {
        if (show) {
            if ($('#loading-overlay').length === 0) {
                const loadingHtml = `
                    <div id="loading-overlay" class="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-flex align-items-center justify-content-center" style="z-index: 99999;">
                        <div class="text-center text-white">
                            <div class="spinner-border mb-2" style="width: 3rem; height: 3rem;"></div>
                            <div class="loading-text">${text}</div>
                        </div>
                    </div>
                `;
                $('body').append(loadingHtml);
            } else {
                $('#loading-overlay .loading-text').text(text);
                $('#loading-overlay').show();
            }
        } else {
            $('#loading-overlay').hide();
        }
    }

    function serializeForm(formId) {
        const data = {};
        const formArray = $('#' + formId).serializeArray();
        $.each(formArray, function() {
            if (data[this.name] !== undefined) {
                if (!data[this.name].push) {
                    data[this.name] = [data[this.name]];
                }
                data[this.name].push(this.value || '');
            } else {
                data[this.name] = this.value || '';
            }
        });
        return data;
    }

    function getDateRange(range) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let start, end;

        switch (range) {
            case 'today':
                start = end = today;
                break;
            case 'week':
                start = new Date(today);
                start.setDate(today.getDate() - today.getDay());
                end = new Date(start);
                end.setDate(start.getDate() + 6);
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                start = new Date(today.getFullYear(), quarter * 3, 1);
                end = new Date(today.getFullYear(), quarter * 3 + 3, 0);
                break;
            case 'year':
                start = new Date(today.getFullYear(), 0, 1);
                end = new Date(today.getFullYear(), 11, 31);
                break;
            default:
                start = end = today;
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
            startDate: start,
            endDate: end
        };
    }

    function getDaysBetween(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function storageAvailable(type) {
        let storage;
        try {
            storage = window[type];
            const x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return e instanceof DOMException && (
                e.code === 22 ||
                e.code === 1014 ||
                e.name === 'QuotaExceededError' ||
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                (storage && storage.length !== 0);
        }
    }

    function copyToClipboard(text) {
        return navigator.clipboard.writeText(text).then(() => {
            showToast('已复制到剪贴板', 'success');
            return true;
        }).catch(() => {
            showToast('复制失败', 'error');
            return false;
        });
    }

    function getBrandSeriesModelData() {
        return {
            '大众': {
                '一汽大众': ['宝来', '速腾', '迈腾', '高尔夫', 'CC'],
                '上汽大众': ['朗逸', '帕萨特', '途观', '途昂', 'POLO']
            },
            '丰田': {
                '一汽丰田': ['卡罗拉', '凯美瑞', 'RAV4', '亚洲龙', '皇冠'],
                '广汽丰田': ['雷凌', '汉兰达', '凯美瑞', 'CHR', '致炫']
            },
            '本田': {
                '东风本田': ['思域', 'CRV', 'XRV', '雅阁', '英仕派'],
                '广汽本田': ['飞度', '凌派', '雅阁', '冠道', '缤智']
            },
            '奥迪': {
                '一汽奥迪': ['A3', 'A4L', 'A6L', 'Q3', 'Q5L'],
                '进口奥迪': ['A8L', 'Q7', 'Q8', 'R8', 'TT']
            },
            '宝马': {
                '华晨宝马': ['1系', '3系', '5系', 'X1', 'X3'],
                '进口宝马': ['7系', 'X5', 'X7', 'M3', 'M5']
            },
            '奔驰': {
                '北京奔驰': ['A级', 'C级', 'E级', 'GLA', 'GLC'],
                '进口奔驰': ['S级', 'GLE', 'GLS', 'AMG GT', '迈巴赫']
            },
            '别克': {
                '上汽通用别克': ['英朗', '威朗', '君威', '君越', '昂科威']
            },
            '日产': {
                '东风日产': ['轩逸', '天籁', '奇骏', '逍客', '骐达']
            },
            '现代': {
                '北京现代': ['伊兰特', '索纳塔', '途胜', 'ix35', '名图']
            },
            '比亚迪': {
                '比亚迪': ['宋', '汉', '唐', '元', '秦']
            }
        };
    }

    function getServiceItems() {
        return {
            maintenance: [
                { id: 'mt_01', name: '机油更换', laborFee: 50, materialFee: 280, defaultQty: 1 },
                { id: 'mt_02', name: '机滤更换', laborFee: 20, materialFee: 50, defaultQty: 1 },
                { id: 'mt_03', name: '空滤更换', laborFee: 20, materialFee: 80, defaultQty: 1 },
                { id: 'mt_04', name: '空调滤更换', laborFee: 30, materialFee: 100, defaultQty: 1 },
                { id: 'mt_05', name: '燃油滤更换', laborFee: 40, materialFee: 120, defaultQty: 1 },
                { id: 'mt_06', name: '变速箱油更换', laborFee: 150, materialFee: 400, defaultQty: 1 },
                { id: 'mt_07', name: '刹车油更换', laborFee: 80, materialFee: 150, defaultQty: 1 },
                { id: 'mt_08', name: '转向助力油更换', laborFee: 60, materialFee: 100, defaultQty: 1 },
                { id: 'mt_09', name: '防冻液更换', laborFee: 80, materialFee: 200, defaultQty: 1 },
                { id: 'mt_10', name: '火花塞更换', laborFee: 100, materialFee: 320, defaultQty: 4 },
                { id: 'mt_11', name: '正时皮带更换', laborFee: 300, materialFee: 500, defaultQty: 1 },
                { id: 'mt_12', name: '全车检查', laborFee: 100, materialFee: 0, defaultQty: 1 }
            ],
            repair: [
                { id: 'rp_01', name: '刹车片更换', laborFee: 80, materialFee: 350, defaultQty: 1 },
                { id: 'rp_02', name: '刹车盘更换', laborFee: 150, materialFee: 600, defaultQty: 1 },
                { id: 'rp_03', name: '轮胎更换', laborFee: 50, materialFee: 550, defaultQty: 1 },
                { id: 'rp_04', name: '轮胎修补', laborFee: 30, materialFee: 20, defaultQty: 1 },
                { id: 'rp_05', name: '四轮定位', laborFee: 150, materialFee: 0, defaultQty: 1 },
                { id: 'rp_06', name: '动平衡', laborFee: 40, materialFee: 0, defaultQty: 1 },
                { id: 'rp_07', name: '电瓶更换', laborFee: 50, materialFee: 450, defaultQty: 1 },
                { id: 'rp_08', name: '发电机维修', laborFee: 200, materialFee: 300, defaultQty: 1 },
                { id: 'rp_09', name: '起动机维修', laborFee: 180, materialFee: 250, defaultQty: 1 },
                { id: 'rp_10', name: '空调压缩机维修', laborFee: 300, materialFee: 800, defaultQty: 1 },
                { id: 'rp_11', name: '冷凝器更换', laborFee: 200, materialFee: 500, defaultQty: 1 },
                { id: 'rp_12', name: '散热器更换', laborFee: 250, materialFee: 400, defaultQty: 1 },
                { id: 'rp_13', name: '水泵更换', laborFee: 180, materialFee: 350, defaultQty: 1 },
                { id: 'rp_14', name: '节温器更换', laborFee: 100, materialFee: 150, defaultQty: 1 },
                { id: 'rp_15', name: '排气管维修', laborFee: 150, materialFee: 200, defaultQty: 1 },
                { id: 'rp_16', name: '减震器更换', laborFee: 120, materialFee: 450, defaultQty: 1 },
                { id: 'rp_17', name: '悬挂系统维修', laborFee: 350, materialFee: 500, defaultQty: 1 },
                { id: 'rp_18', name: '转向机维修', laborFee: 300, materialFee: 600, defaultQty: 1 },
                { id: 'rp_19', name: '离合器更换', laborFee: 280, materialFee: 400, defaultQty: 1 },
                { id: 'rp_20', name: '变速箱维修', laborFee: 500, materialFee: 1000, defaultQty: 1 },
                { id: 'rp_21', name: '发动机大修', laborFee: 1500, materialFee: 3000, defaultQty: 1 },
                { id: 'rp_22', name: '喷油嘴清洗', laborFee: 100, materialFee: 80, defaultQty: 1 },
                { id: 'rp_23', name: '节气门清洗', laborFee: 80, materialFee: 30, defaultQty: 1 },
                { id: 'rp_24', name: '三元催化清洗', laborFee: 150, materialFee: 100, defaultQty: 1 },
                { id: 'rp_25', name: '油路清洗', laborFee: 120, materialFee: 150, defaultQty: 1 }
            ],
            beauty: [
                { id: 'bt_01', name: '普洗', laborFee: 30, materialFee: 5, defaultQty: 1 },
                { id: 'bt_02', name: '精洗', laborFee: 80, materialFee: 20, defaultQty: 1 },
                { id: 'bt_03', name: '打蜡', laborFee: 50, materialFee: 80, defaultQty: 1 },
                { id: 'bt_04', name: '封釉', laborFee: 150, materialFee: 200, defaultQty: 1 },
                { id: 'bt_05', name: '镀膜', laborFee: 200, materialFee: 400, defaultQty: 1 },
                { id: 'bt_06', name: '镀晶', laborFee: 300, materialFee: 600, defaultQty: 1 },
                { id: 'bt_07', name: '内饰清洁', laborFee: 100, materialFee: 50, defaultQty: 1 },
                { id: 'bt_08', name: '臭氧消毒', laborFee: 30, materialFee: 10, defaultQty: 1 }
            ]
        };
    }

    function getTechnicians() {
        return [
            { id: 'tech_01', name: '张师傅', level: '高级技师', specialty: '发动机维修' },
            { id: 'tech_02', name: '李师傅', level: '高级技师', specialty: '底盘维修' },
            { id: 'tech_03', name: '王师傅', level: '中级技师', specialty: '电气维修' },
            { id: 'tech_04', name: '赵师傅', level: '中级技师', specialty: '美容装潢' },
            { id: 'tech_05', name: '刘师傅', level: '初级技师', specialty: '常规保养' }
        ];
    }

    function getStores() {
        return [
            { id: 'store_1', name: '中心店', address: '市中心大道88号', phone: '400-888-0001' },
            { id: 'store_2', name: '城东店', address: '东区开发路66号', phone: '400-888-0002' },
            { id: 'store_3', name: '城西店', address: '西区科技路99号', phone: '400-888-0003' }
        ];
    }

    return {
        formatCurrency,
        formatDate,
        formatDateTime,
        getStatusText,
        getStatusClass,
        getStatusBadge,
        getMemberCardTypeText,
        getMemberCardTypeClass,
        getPackageTypeText,
        getServiceCategoryText,
        debounce,
        throttle,
        generateRandomId,
        downloadCSV,
        showToast,
        showConfirm,
        showLoading,
        serializeForm,
        getDateRange,
        getDaysBetween,
        storageAvailable,
        copyToClipboard,
        getBrandSeriesModelData,
        getServiceItems,
        getTechnicians,
        getStores
    };
})();

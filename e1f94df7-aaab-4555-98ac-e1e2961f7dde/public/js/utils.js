(function(window) {
  var STATUS_MAP = {
    submitted:   { label: '已提交', cls: 'status-submitted' },
    appraising:  { label: '鉴定中', cls: 'status-appraising' },
    photographed:{ label: '已拍摄', cls: 'status-photographed' },
    cataloging:  { label: '图录中', cls: 'status-cataloging' },
    previewing:  { label: '预展中', cls: 'status-previewing' },
    bidding:     { label: '竞拍中', cls: 'status-bidding' },
    sold:        { label: '已成交', cls: 'status-sold' },
    passed:      { label: '流拍', cls: 'status-passed' },
    settled:     { label: '已结算', cls: 'status-settled' },
    delivered:   { label: '已交付', cls: 'status-delivered' }
  };

  var CATEGORY_MAP = {
    painting: '书画',
    calligraphy: '书法',
    ceramics: '瓷器',
    jade: '玉器',
    bronze: '青铜器',
    furniture: '古典家具',
    jewelry: '珠宝',
    wine: '名酒',
    watch: '腕表',
    other: '其他'
  };

  var ROLE_MAP = {
    admin: '管理员',
    auctioneer: '拍卖师',
    appraiser: '鉴定师',
    consignor: '委托方',
    bidder: '竞买人',
    clerk: '书记员'
  };

  function formatDate(date) {
    if (!date) return '';
    var d = new Date(date);
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min;
  }

  function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '¥0.00';
    var num = parseFloat(amount);
    if (isNaN(num)) return '¥0.00';
    var parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '¥' + parts.join('.');
  }

  function getStatusLabel(status) {
    var info = STATUS_MAP[status];
    if (!info) return '<span class="status-label status-submitted">' + status + '</span>';
    return '<span class="status-label ' + info.cls + '">' + info.label + '</span>';
  }

  function getStatusText(status) {
    var info = STATUS_MAP[status];
    return info ? info.label : status;
  }

  function getCategoryLabel(category) {
    return CATEGORY_MAP[category] || category;
  }

  function getRoleLabel(role) {
    return ROLE_MAP[role] || role;
  }

  function showLoading() {
    $('#loading-overlay').stop(true).fadeIn(200);
  }

  function hideLoading() {
    $('#loading-overlay').stop(true).fadeOut(200);
  }

  function showToast(message, type) {
    type = type || 'info';
    var $toast = $('#app-toast');
    $toast.removeClass('toast-gold toast-success toast-danger toast-warning toast-info')
          .addClass('toast-' + type);
    $('#toast-body').text(message);
    var bsToast = bootstrap.Toast.getOrCreateInstance($toast[0], { delay: 3000 });
    bsToast.show();
  }

  function paginate(total, page, perPage) {
    var totalPages = Math.ceil(total / perPage);
    if (totalPages <= 1) return '';
    var html = '<nav><ul class="pagination justify-content-center mb-0">';
    html += '<li class="page-item ' + (page <= 1 ? 'disabled' : '') + '">';
    html += '<a class="page-link" href="#" data-page="' + (page - 1) + '"><i class="bi bi-chevron-left"></i></a></li>';

    var start = Math.max(1, page - 2);
    var end = Math.min(totalPages, page + 2);

    if (start > 1) {
      html += '<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>';
      if (start > 2) html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
    }

    for (var i = start; i <= end; i++) {
      html += '<li class="page-item ' + (i === page ? 'active' : '') + '">';
      html += '<a class="page-link" href="#" data-page="' + i + '">' + i + '</a></li>';
    }

    if (end < totalPages) {
      if (end < totalPages - 1) html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
      html += '<li class="page-item"><a class="page-link" href="#" data-page="' + totalPages + '">' + totalPages + '</a></li>';
    }

    html += '<li class="page-item ' + (page >= totalPages ? 'disabled' : '') + '">';
    html += '<a class="page-link" href="#" data-page="' + (page + 1) + '"><i class="bi bi-chevron-right"></i></a></li>';
    html += '</ul></nav>';
    return html;
  }

  function debounce(fn, delay) {
    var timer;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(context, args); }, delay);
    };
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.utils = {
    formatDate: formatDate,
    formatCurrency: formatCurrency,
    getStatusLabel: getStatusLabel,
    getStatusText: getStatusText,
    getCategoryLabel: getCategoryLabel,
    getRoleLabel: getRoleLabel,
    showLoading: showLoading,
    hideLoading: hideLoading,
    showToast: showToast,
    paginate: paginate,
    debounce: debounce,
    STATUS_MAP: STATUS_MAP,
    CATEGORY_MAP: CATEGORY_MAP,
    ROLE_MAP: ROLE_MAP
  };
})(window);

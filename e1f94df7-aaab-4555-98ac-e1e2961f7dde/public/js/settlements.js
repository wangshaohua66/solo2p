(function(window, $) {
  var api = window.AuctionApp.api;
  var utils = window.AuctionApp.utils;
  var _state = {
    settlements: [],
    total: 0,
    page: 1,
    perPage: 15,
    statusFilter: 'all',
    currentSettlement: null
  };

  function init() {
    loadSettlements();
    bindEvents();
  }

  function loadSettlements() {
    var params = {
      page: _state.page,
      perPage: _state.perPage
    };
    if (_state.statusFilter && _state.statusFilter !== 'all') {
      params.status = _state.statusFilter;
    }

    utils.showLoading();
    api.get('/settlements', params)
      .then(function(res) {
        var data = res.data || res;
        _state.settlements = data.items || data.settlements || [];
        _state.total = data.total || _state.settlements.length;
        renderSettlements();
        renderPagination();
        loadCommissionSummary();
      })
      .fail(function() {
        $('#settlement-table tbody').html('<tr><td colspan="8" class="text-center text-muted py-3">加载结算列表失败</td></tr>');
      })
      .always(function() {
        utils.hideLoading();
      });
  }

  function renderSettlements() {
    var $tbody = $('#settlement-table tbody');
    if (!_state.settlements.length) {
      $tbody.html('<tr><td colspan="8" class="text-center text-muted py-4"><i class="bi bi-inbox d-block fs-4 mb-1"></i>暂无结算记录</td></tr>');
      return;
    }

    var html = '';
    _state.settlements.forEach(function(s) {
      var statusMap = {
        pending: { label: '待付款', cls: 'status-bidding' },
        paid: { label: '已付款', cls: 'status-settled' },
        completed: { label: '已完成', cls: 'status-delivered' },
        refunded: { label: '已退款', cls: 'status-passed' }
      };
      var st = statusMap[s.status] || { label: s.status, cls: 'status-submitted' };

      html += '<tr>';
      html += '  <td style="font-family:var(--font-num)">' + (s.lot_number || '-') + '</td>';
      html += '  <td>' + (s.lot_name || '-') + '</td>';
      html += '  <td>' + (s.buyer_name || '-') + '</td>';
      html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(s.hammer_price) + '</td>';
      html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(s.buyer_premium) + '</td>';
      html += '  <td style="font-family:var(--font-num);font-weight:600">' + utils.formatCurrency(s.total_amount) + '</td>';
      html += '  <td><span class="status-label ' + st.cls + '">' + st.label + '</span></td>';
      html += '  <td>';
      html += '    <div class="btn-group btn-group-sm">';
      if (s.status === 'pending') {
        html += '      <button class="btn btn-sm btn-gold-outline btn-pay" data-id="' + s.id + '" title="确认付款"><i class="bi bi-check2-circle"></i></button>';
        html += '      <button class="btn btn-sm btn-outline-danger btn-refund" data-id="' + s.id + '" title="退款"><i class="bi bi-arrow-counterclockwise"></i></button>';
      }
      if (s.status === 'paid') {
        html += '      <button class="btn btn-sm btn-gold-outline btn-complete" data-id="' + s.id + '" title="完成结算"><i class="bi bi-check-lg"></i></button>';
      }
      html += '    </div>';
      html += '  </td>';
      html += '</tr>';
    });
    $tbody.html(html);
  }

  function renderPagination() {
    $('#settlement-pagination').html(utils.paginate(_state.total, _state.page, _state.perPage));
  }

  function loadCommissionSummary() {
    api.get('/settlements/commission-summary')
      .then(function(res) {
        var data = res.data || res || [];
        var html = '';
        if (!data.length) {
          html = '<tr><td colspan="5" class="text-center text-muted py-3">暂无佣金数据</td></tr>';
        } else {
          data.forEach(function(row) {
            html += '<tr>';
            html += '  <td>' + (row.auction_name || '-') + '</td>';
            html += '  <td style="font-family:var(--font-num)">' + (row.total_lots || 0) + '</td>';
            html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(row.total_hammer) + '</td>';
            html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(row.total_premium) + '</td>';
            html += '  <td style="font-family:var(--font-num);font-weight:600;color:var(--gold)">' + utils.formatCurrency(row.total_commission) + '</td>';
            html += '</tr>';
          });
        }
        $('#commission-table tbody').html(html);
      });
  }

  function markPaid(id) {
    api.put('/settlements/' + id, { status: 'paid' })
      .then(function() {
        utils.showToast('已确认付款', 'success');
        loadSettlements();
      })
      .fail(function(err) {
        utils.showToast(err.message || '操作失败', 'danger');
      });
  }

  function markComplete(id) {
    api.put('/settlements/' + id, { status: 'completed' })
      .then(function() {
        utils.showToast('结算已完成', 'success');
        loadSettlements();
      })
      .fail(function(err) {
        utils.showToast(err.message || '操作失败', 'danger');
      });
  }

  function refundDeposit(id) {
    if (!confirm('确认退款？此操作不可撤销。')) return;
    api.put('/settlements/' + id, { status: 'refunded' })
      .then(function() {
        utils.showToast('已退款', 'success');
        loadSettlements();
      })
      .fail(function(err) {
        utils.showToast(err.message || '退款失败', 'danger');
      });
  }

  function batchRefund() {
    var ids = [];
    _state.settlements.forEach(function(s) {
      if (s.status === 'pending') ids.push(s.id);
    });
    if (!ids.length) {
      utils.showToast('没有待付款的结算记录', 'warning');
      return;
    }
    if (!confirm('确认批量退款 ' + ids.length + ' 条待付款记录？')) return;
    api.post('/settlements/batch-refund', { ids: ids })
      .then(function() {
        utils.showToast('批量退款成功', 'success');
        loadSettlements();
      })
      .fail(function(err) {
        utils.showToast(err.message || '批量退款失败', 'danger');
      });
  }

  function showDepositForm(settlementId) {
    var html = '<div class="modal fade" id="depositModal" tabindex="-1">';
    html += '<div class="modal-dialog modal-dialog-centered"><div class="modal-content">';
    html += '<div class="modal-header"><h5 class="modal-title text-gold">支付保证金</h5>';
    html += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>';
    html += '<div class="modal-body">';
    html += '  <form id="deposit-form">';
    html += '    <div class="mb-3"><label class="form-label">支付金额 (¥)</label>';
    html += '      <input type="number" class="form-control" name="amount" step="0.01" required></div>';
    html += '    <div class="mb-3"><label class="form-label">支付方式</label>';
    html += '      <select class="form-select" name="method">';
    html += '        <option value="bank_transfer">银行转账</option>';
    html += '        <option value="credit_card">信用卡</option>';
    html += '        <option value="wechat">微信支付</option>';
    html += '        <option value="alipay">支付宝</option>';
    html += '      </select></div>';
    html += '    <div class="mb-3"><label class="form-label">备注</label>';
    html += '      <textarea class="form-control" name="note" rows="2"></textarea></div>';
    html += '  </form>';
    html += '</div>';
    html += '<div class="modal-footer"><button type="button" class="btn btn-gold-outline" data-bs-dismiss="modal">取消</button>';
    html += '<button type="button" class="btn btn-gold" id="btn-submit-deposit">确认支付</button></div>';
    html += '</div></div></div>';

    $('body').append(html);
    var modal = new bootstrap.Modal($('#depositModal')[0]);
    modal.show();

    $(document).on('click', '#btn-submit-deposit', function() {
      var $form = $('#deposit-form');
      if (!$form[0].checkValidity()) { $form[0].reportValidity(); return; }
      var data = {};
      $form.serializeArray().forEach(function(f) { if (f.value) data[f.name] = f.name === 'amount' ? parseFloat(f.value) : f.value; });
      data.settlement_id = settlementId;

      api.post('/settlements/deposit', data)
        .then(function() {
          utils.showToast('保证金支付成功', 'success');
          modal.hide();
          loadSettlements();
        })
        .fail(function(err) {
          utils.showToast(err.message || '支付失败', 'danger');
        });
    });

    $('#depositModal').on('hidden.bs.modal', function() { $(this).remove(); });
  }

  function bindEvents() {
    $(document).off('click.settle-tab', '.settlement-tab').on('click.settle-tab', '.settlement-tab', function() {
      _state.statusFilter = $(this).data('status');
      _state.page = 1;
      $('.settlement-tab').removeClass('active');
      $(this).addClass('active');
      loadSettlements();
    });

    $(document).off('click.btn-pay', '.btn-pay').on('click.btn-pay', '.btn-pay', function(e) {
      e.stopPropagation();
      markPaid($(this).data('id'));
    });

    $(document).off('click.btn-refund', '.btn-refund').on('click.btn-refund', '.btn-refund', function(e) {
      e.stopPropagation();
      refundDeposit($(this).data('id'));
    });

    $(document).off('click.btn-complete', '.btn-complete').on('click.btn-complete', '.btn-complete', function(e) {
      e.stopPropagation();
      markComplete($(this).data('id'));
    });

    $(document).off('click.batch-refund', '#btn-batch-refund').on('click.batch-refund', '#btn-batch-refund', function() {
      batchRefund();
    });

    $(document).off('click.settle-page', '#settlement-pagination .page-link').on('click.settle-page', '#settlement-pagination .page-link', function(e) {
      e.preventDefault();
      var p = parseInt($(this).data('page'));
      if (p && p !== _state.page && p > 0) {
        _state.page = p;
        loadSettlements();
      }
    });

    $(document).off('click.btn-deposit', '.btn-deposit').on('click.btn-deposit', '.btn-deposit', function() {
      showDepositForm($(this).data('id'));
    });
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.settlements = {
    init: init,
    loadSettlements: loadSettlements
  };
})(window, jQuery);

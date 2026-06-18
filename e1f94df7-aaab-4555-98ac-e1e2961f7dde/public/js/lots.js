(function(window, $) {
  var api = window.AuctionApp.api;
  var utils = window.AuctionApp.utils;
  var _state = {
    lots: [],
    total: 0,
    page: 1,
    perPage: 12,
    filters: { category: '', status: '', auction_id: '', search: '' },
    currentLot: null
  };

  function init() {
    loadFilters();
    loadLots();
    bindEvents();
  }

  function loadFilters() {
    api.get('/auctions').then(function(res) {
      var auctions = res.data || res || [];
      var $sel = $('#filter-auction');
      $sel.empty().append('<option value="">全部拍卖会</option>');
      auctions.forEach(function(a) {
        $sel.append('<option value="' + a._id + '">' + a.name + '</option>');
      });
    });
  }

  function loadLots() {
    var params = {
      page: _state.page,
      perPage: _state.perPage
    };
    if (_state.filters.category) params.category = _state.filters.category;
    if (_state.filters.status) params.status = _state.filters.status;
    if (_state.filters.auction_id) params.auction_id = _state.filters.auction_id;
    if (_state.filters.search) params.search = _state.filters.search;

    utils.showLoading();
    api.get('/lots', params)
      .then(function(res) {
        var data = res.data || res;
        _state.lots = data.items || data.lots || [];
        _state.total = data.total || _state.lots.length;
        renderLots();
        renderPagination();
      })
      .fail(function() {
        $('#lot-grid').html('<div class="col-12 text-center py-4 text-muted">加载拍品列表失败</div>');
      })
      .always(function() {
        utils.hideLoading();
      });
  }

  function renderLots() {
    var $grid = $('#lot-grid');
    if (!_state.lots.length) {
      $grid.html('<div class="col-12 text-center py-5 text-muted"><i class="bi bi-inbox fs-1 d-block mb-2"></i>暂无拍品数据</div>');
      return;
    }
    var html = '';
    _state.lots.forEach(function(lot, idx) {
      var img = (lot.images && lot.images.length) ? lot.images[0] : '';
      var imgTag = img
        ? '<img src="' + img + '" class="lot-thumb" alt="' + lot.name + '" loading="lazy">'
        : '<div class="lot-thumb d-flex align-items-center justify-content-center"><i class="bi bi-image fs-1 text-muted"></i></div>';

      html += '<div class="card card-ink lot-card animate-fade-in-up" style="animation-delay:' + (idx * 0.05) + 's" data-id="' + lot._id + '">';
      html += '  ' + imgTag;
      html += '  <div class="card-body">';
      html += '    <div class="lot-number">LOT ' + (lot.lot_number || '') + '</div>';
      html += '    <div class="lot-name" title="' + lot.name + '">' + lot.name + '</div>';
      html += '    <div class="d-flex justify-content-between align-items-center mt-2">';
      html += '      <span class="lot-price">' + utils.formatCurrency(lot.reference_price) + '</span>';
      html += '      ' + utils.getStatusLabel(lot.status);
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    });
    $grid.html(html);
  }

  function renderPagination() {
    var $pag = $('#lot-pagination');
    $pag.html(utils.paginate(_state.total, _state.page, _state.perPage));
  }

  function showLotDetail(lotId) {
    utils.showLoading();
    api.get('/lots/' + lotId)
      .then(function(res) {
        var lot = res.data || res;
        _state.currentLot = lot;
        $.get('pages/lot-detail.html').done(function(html) {
          $('#page-container').html(html);
          renderLotDetail(lot);
          bindDetailEvents(lot);
        });
      })
      .fail(function() {
        utils.showToast('加载拍品详情失败', 'danger');
      })
      .always(function() {
        utils.hideLoading();
      });
  }

  function renderLotDetail(lot) {
    var mainImg = (lot.images && lot.images.length) ? lot.images[0] : '';
    var $main = $('#detail-main-image');
    if (mainImg) {
      $main.attr('src', mainImg).show();
    } else {
      $main.hide();
      $main.parent().append('<div class="d-flex align-items-center justify-content-center" style="height:400px"><i class="bi bi-image fs-1 text-muted"></i></div>');
    }

    var thumbsHtml = '';
    if (lot.images && lot.images.length > 1) {
      lot.images.forEach(function(img, idx) {
        thumbsHtml += '<img src="' + img + '" class="thumb ' + (idx === 0 ? 'active' : '') + '" data-src="' + img + '" alt="缩略图">';
      });
    }
    $('#detail-thumbnails').html(thumbsHtml);

    $('#detail-breadcrumb').html(
      '<a href="#lots" class="text-gold">拍品列表</a> <i class="bi bi-chevron-right mx-1" style="font-size:0.7rem"></i> ' + lot.name
    );
    $('#detail-status').html(utils.getStatusLabel(lot.status));
    $('#detail-lot-number').text(lot.lot_number || '-');
    $('#detail-name').text(lot.name);
    $('#detail-category').text(utils.getCategoryLabel(lot.category));
    $('#detail-description').text(lot.description || '暂无描述');
    $('#detail-reference-price').text(utils.formatCurrency(lot.reference_price));
    $('#detail-estimate').text(
      utils.formatCurrency(lot.estimate_min) + ' - ' + utils.formatCurrency(lot.estimate_max)
    );

    renderTimeline(lot);
    renderAppraisals(lot);
  }

  function renderTimeline(lot) {
    var statuses = ['submitted', 'appraising', 'photographed', 'cataloging', 'previewing', 'bidding', 'sold', 'settled', 'delivered'];
    var statusIdx = statuses.indexOf(lot.status);
    var html = '';
    statuses.forEach(function(s, idx) {
      var cls = idx < statusIdx ? 'completed' : (idx === statusIdx ? 'active' : '');
      html += '<div class="timeline-item ' + cls + '">';
      html += '  <div style="color:' + (idx <= statusIdx ? 'var(--gold)' : 'var(--text-muted)') + '">';
      html += '    <strong>' + utils.getStatusText(s) + '</strong>';
      html += '  </div>';
      html += '</div>';
    });
    $('#detail-timeline').html(html);
  }

  function renderAppraisals(lot) {
    var list = lot.appraisals || [];
    var html = '';
    if (!list.length) {
      html = '<p class="text-muted">暂无鉴定记录</p>';
    } else {
      list.forEach(function(a) {
        html += '<div class="card-dark p-3 mb-2">';
        html += '  <div class="d-flex justify-content-between">';
        html += '    <strong class="text-gold">' + (a.appraiser_name || '鉴定师') + '</strong>';
        html += '    <small class="text-muted">' + utils.formatDate(a.created_at) + '</small>';
        html += '  </div>';
        html += '  <p class="mb-1 mt-1">' + (a.opinion || '') + '</p>';
        html += '  <div class="text-gold" style="font-family:var(--font-num)">' + utils.formatCurrency(a.estimated_price) + '</div>';
        html += '</div>';
      });
    }
    $('#appraisal-list').html(html);
  }

  function bindEvents() {
    $(document).off('click.lot-grid', '.lot-card').on('click.lot-grid', '.lot-card', function() {
      var id = $(this).data('id');
      if (id) showLotDetail(id);
    });

    $(document).off('click.lot-fab', '#fab-add-lot').on('click.lot-fab', '#fab-add-lot', function() {
      showCreateLotForm();
    });

    $(document).off('submit.lot-filter', '#lot-filter-form').on('submit.lot-filter', '#lot-filter-form', function(e) {
      e.preventDefault();
      _state.filters.category = $('#filter-category').val();
      _state.filters.status = $('#filter-status').val();
      _state.filters.auction_id = $('#filter-auction').val();
      _state.filters.search = $('#filter-search').val().trim();
      _state.page = 1;
      loadLots();
    });

    $(document).off('click.lot-reset', '#btn-reset-filter').on('click.lot-reset', '#btn-reset-filter', function() {
      _state.filters = { category: '', status: '', auction_id: '', search: '' };
      $('#filter-category').val('');
      $('#filter-status').val('');
      $('#filter-auction').val('');
      $('#filter-search').val('');
      _state.page = 1;
      loadLots();
    });

    $(document).off('click.lot-page', '#lot-pagination .page-link').on('click.lot-page', '#lot-pagination .page-link', function(e) {
      e.preventDefault();
      var p = parseInt($(this).data('page'));
      if (p && p !== _state.page && p > 0) {
        _state.page = p;
        loadLots();
      }
    });
  }

  function bindDetailEvents(lot) {
    $(document).off('click.lot-thumb', '.image-gallery .thumb').on('click.lot-thumb', '.image-gallery .thumb', function() {
      var src = $(this).data('src');
      $('#detail-main-image').attr('src', src);
      $('.image-gallery .thumb').removeClass('active');
      $(this).addClass('active');
    });

    $(document).off('submit.appraisal', '#appraisal-form').on('submit.appraisal', '#appraisal-form', function(e) {
      e.preventDefault();
      var opinion = $('#appraisal-opinion').val().trim();
      var price = $('#appraisal-price').val();
      if (!opinion || !price) {
        utils.showToast('请填写鉴定意见和估价', 'warning');
        return;
      }
      api.post('/lots/' + lot._id + '/appraisal', { description: opinion, estimated_price: parseFloat(price) })
        .then(function() {
          utils.showToast('鉴定已提交', 'success');
          showLotDetail(lot._id);
        })
        .fail(function(err) {
          utils.showToast(err.message || '提交失败', 'danger');
        });
    });

    $(document).off('change.lot-status', '#lot-status-change').on('change.lot-status', '#lot-status-change', function() {
      var newStatus = $(this).val();
      if (newStatus && confirm('确认将状态变更为: ' + utils.getStatusText(newStatus) + '?')) {
        api.put('/lots/' + lot._id + '/status', { status: newStatus })
          .then(function() {
            utils.showToast('状态已更新', 'success');
            showLotDetail(lot._id);
          })
          .fail(function(err) {
            utils.showToast(err.message || '更新失败', 'danger');
          });
      }
    });
  }

  function showCreateLotForm() {
    var html = '<div class="modal fade" id="createLotModal" tabindex="-1">';
    html += '<div class="modal-dialog modal-lg"><div class="modal-content">';
    html += '<div class="modal-header"><h5 class="modal-title text-gold">新增拍品</h5>';
    html += '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>';
    html += '<div class="modal-body">';
    html += '<form id="create-lot-form">';
    html += '  <div class="row g-3">';
    html += '    <div class="col-md-6"><label class="form-label">拍品名称 *</label><input type="text" class="form-control" name="name" required></div>';
    html += '    <div class="col-md-6"><label class="form-label">分类 *</label><select class="form-select" name="category" required>';
    Object.keys(utils.CATEGORY_MAP).forEach(function(k) {
      html += '<option value="' + k + '">' + utils.CATEGORY_MAP[k] + '</option>';
    });
    html += '</select></div>';
    html += '    <div class="col-md-6"><label class="form-label">参考价</label><input type="number" class="form-control" name="reference_price" step="0.01"></div>';
    html += '    <div class="col-md-3"><label class="form-label">估价最低</label><input type="number" class="form-control" name="estimate_min" step="0.01"></div>';
    html += '    <div class="col-md-3"><label class="form-label">估价最高</label><input type="number" class="form-control" name="estimate_max" step="0.01"></div>';
    html += '    <div class="col-12"><label class="form-label">描述</label><textarea class="form-control" name="description" rows="3"></textarea></div>';
    html += '    <div class="col-md-6"><label class="form-label">所属拍卖会</label><select class="form-select" name="auction_id" id="create-lot-auction"></select></div>';
    html += '    <div class="col-md-6"><label class="form-label">拍品编号</label><input type="text" class="form-control" name="lot_number"></div>';
    html += '  </div>';
    html += '</form></div>';
    html += '<div class="modal-footer"><button type="button" class="btn btn-gold-outline" data-bs-dismiss="modal">取消</button>';
    html += '<button type="button" class="btn btn-gold" id="btn-submit-lot">提交</button></div>';
    html += '</div></div></div>';

    $('body').append(html);
    var modal = new bootstrap.Modal($('#createLotModal')[0]);
    modal.show();

    api.get('/auctions').then(function(res) {
      var auctions = res.data || res || [];
      var $sel = $('#create-lot-auction');
      $sel.append('<option value="">请选择拍卖会</option>');
      auctions.forEach(function(a) {
        $sel.append('<option value="' + a._id + '">' + a.name + '</option>');
      });
    });

    $(document).on('click', '#btn-submit-lot', function() {
      var $form = $('#create-lot-form');
      if (!$form[0].checkValidity()) {
        $form[0].reportValidity();
        return;
      }
      var data = {};
      $form.serializeArray().forEach(function(f) {
        if (f.value) data[f.name] = f.name.indexOf('price') > -1 || f.name.indexOf('estimate') > -1 ? parseFloat(f.value) : f.value;
      });
      api.post('/lots', data)
        .then(function() {
          utils.showToast('拍品创建成功', 'success');
          modal.hide();
          loadLots();
        })
        .fail(function(err) {
          utils.showToast(err.message || '创建失败', 'danger');
        });
    });

    $('#createLotModal').on('hidden.bs.modal', function() {
      $(this).remove();
    });
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.lots = {
    init: init,
    loadLots: loadLots,
    showLotDetail: showLotDetail
  };
})(window, jQuery);

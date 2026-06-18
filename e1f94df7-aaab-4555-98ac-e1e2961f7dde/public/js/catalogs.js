(function(window, $) {
  var api = window.AuctionApp.api;
  var utils = window.AuctionApp.utils;
  var _state = {
    auctionId: null,
    lots: [],
    groupedLots: {},
    sortOrders: {}
  };

  function init() {
    loadAuctionsForSelect();
    bindEvents();
  }

  function loadAuctionsForSelect() {
    api.get('/auctions').then(function(res) {
      var auctions = res.data || res || [];
      var $sel = $('#catalog-auction-select');
      $sel.empty().append('<option value="">请选择拍卖会</option>');
      auctions.forEach(function(a) {
        $sel.append('<option value="' + a.id + '">' + a.name + '</option>');
      });
      if (auctions.length) {
        $sel.val(auctions[0].id);
        loadCatalogLots(auctions[0].id);
      }
    });
  }

  function loadCatalogLots(auctionId) {
    if (!auctionId) return;
    _state.auctionId = auctionId;
    utils.showLoading();

    api.get('/lots', { auction_id: auctionId, perPage: 200 })
      .then(function(res) {
        var data = res.data || res;
        _state.lots = data.items || data.lots || [];
        groupLotsByCategory();
        renderCatalogLeft();
        renderCatalogPreview();
        initSortable();
      })
      .fail(function() {
        $('#catalog-left').html('<div class="text-center text-muted py-4">加载拍品失败</div>');
      })
      .always(function() {
        utils.hideLoading();
      });
  }

  function groupLotsByCategory() {
    _state.groupedLots = {};
    _state.lots.forEach(function(lot) {
      var cat = lot.category || 'other';
      if (!_state.groupedLots[cat]) _state.groupedLots[cat] = [];
      _state.groupedLots[cat].push(lot);
    });
  }

  function renderCatalogLeft() {
    var html = '';
    var categories = Object.keys(_state.groupedLots);

    if (!categories.length) {
      html = '<div class="text-center text-muted py-4"><i class="bi bi-book fs-1 d-block mb-2"></i>暂无拍品</div>';
      $('#catalog-left').html(html);
      return;
    }

    categories.forEach(function(cat) {
      var lots = _state.groupedLots[cat];
      html += '<div class="mb-3">';
      html += '  <div class="d-flex align-items-center mb-2 catalog-category-header" data-category="' + cat + '" style="cursor:pointer">';
      html += '    <i class="bi bi-chevron-down me-1 text-gold" style="font-size:0.75rem"></i>';
      html += '    <span class="text-gold fw-bold" style="font-size:0.85rem">' + utils.getCategoryLabel(cat) + '</span>';
      html += '    <span class="text-muted ms-2" style="font-size:0.75rem">(' + lots.length + ')</span>';
      html += '  </div>';
      html += '  <div class="catalog-category-items" data-category="' + cat + '">';

      lots.forEach(function(lot) {
        var img = (lot.images && lot.images.length) ? lot.images[0] : '';
        html += '<div class="d-flex align-items-center p-2 mb-1 rounded catalog-lot-item" data-id="' + lot.id + '" style="background:var(--ink-deep);border:1px solid var(--border-color)">';
        html += '  <i class="bi bi-grip-vertical drag-handle me-2"></i>';
        if (img) {
          html += '<img src="' + img + '" style="width:40px;height:40px;object-fit:cover;border-radius:3px" class="me-2">';
        } else {
          html += '<div style="width:40px;height:40px;background:var(--ink-mid);border-radius:3px;display:flex;align-items:center;justify-content:center" class="me-2"><i class="bi bi-image text-muted"></i></div>';
        }
        html += '  <div class="flex-grow-1" style="min-width:0">';
        html += '    <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-num)">LOT ' + (lot.lot_number || '') + '</div>';
        html += '    <div style="font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lot.name + '</div>';
        html += '  </div>';
        html += '</div>';
      });

      html += '  </div>';
      html += '</div>';
    });

    $('#catalog-left').html(html);
  }

  function renderCatalogPreview() {
    var html = '';
    html += '<h3>拍品图录</h3>';

    var categories = Object.keys(_state.groupedLots);
    categories.forEach(function(cat) {
      var lots = _state.groupedLots[cat];
      html += '<div class="mb-4">';
      html += '  <h5 style="color:var(--gold-dark);border-bottom:2px solid var(--gold);padding-bottom:0.3rem;margin-bottom:1rem">' + utils.getCategoryLabel(cat) + '</h5>';

      lots.forEach(function(lot) {
        var img = (lot.images && lot.images.length) ? lot.images[0] : '';
        html += '<div class="catalog-item">';
        if (img) {
          html += '<img src="' + img + '" alt="' + lot.name + '">';
        }
        html += '  <div class="flex-grow-1">';
        html += '    <div style="font-family:var(--font-num);color:#666;font-size:0.8rem">LOT ' + (lot.lot_number || '') + '</div>';
        html += '    <div style="font-weight:600;font-family:var(--font-title)">' + lot.name + '</div>';
        html += '    <div style="font-family:var(--font-num);color:var(--gold-dark)">' + utils.formatCurrency(lot.reference_price) + '</div>';
        if (lot.description) {
          html += '<div style="font-size:0.8rem;color:#666;margin-top:0.3rem">' + lot.description.substring(0, 80) + (lot.description.length > 80 ? '...' : '') + '</div>';
        }
        html += '  </div>';
        html += '</div>';
      });

      html += '</div>';
    });

    if (!categories.length) {
      html += '<div class="text-center py-4" style="color:#999">请选择拍卖会以预览图录</div>';
    }

    $('#catalog-preview').html(html);
  }

  function initSortable() {
    $('.catalog-category-items').each(function() {
      new Sortable(this, {
        group: 'catalog',
        handle: '.drag-handle',
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function(evt) {
          var categoryId = $(evt.from).data('category');
          saveSortOrder(categoryId);
          renderCatalogPreview();
        }
      });
    });
  }

  function saveSortOrder(categoryId) {
    var $items = $('.catalog-category-items[data-category="' + categoryId + '"] .catalog-lot-item');
    var ids = [];
    $items.each(function() { ids.push($(this).data('id')); });
    _state.sortOrders[categoryId] = ids;

    var catLots = _state.groupedLots[categoryId];
    if (catLots) {
      var ordered = [];
      ids.forEach(function(id) {
        var found = catLots.find(function(l) { return l.id === id; });
        if (found) ordered.push(found);
      });
      _state.groupedLots[categoryId] = ordered;
    }

    api.put('/catalogs/sort', { auction_id: _state.auctionId, category: categoryId, order: ids })
      .then(function() {
        utils.showToast('排序已保存', 'success');
      });
  }

  function generateCatalog() {
    if (!_state.auctionId) {
      utils.showToast('请先选择拍卖会', 'warning');
      return;
    }

    var $btn = $('#btn-generate-catalog');
    $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-1"></span>生成中...');

    api.post('/catalogs/generate', { auction_id: _state.auctionId })
      .then(function(res) {
        utils.showToast('图录生成成功', 'success');
        var data = res.data || res;
        if (data.url) {
          window.open(data.url, '_blank');
        }
      })
      .fail(function(err) {
        utils.showToast(err.message || '生成失败', 'danger');
      })
      .always(function() {
        $btn.prop('disabled', false).html('<i class="bi bi-file-earmark-pdf me-1"></i>生成PDF图录');
      });
  }

  function bindEvents() {
    $(document).off('change.catalog-auction', '#catalog-auction-select').on('change.catalog-auction', '#catalog-auction-select', function() {
      loadCatalogLots($(this).val());
    });

    $(document).off('click.generate-catalog', '#btn-generate-catalog').on('click.generate-catalog', '#btn-generate-catalog', function() {
      generateCatalog();
    });

    $(document).off('click.category-toggle', '.catalog-category-header').on('click.category-toggle', '.catalog-category-header', function() {
      var cat = $(this).data('category');
      var $items = $('.catalog-category-items[data-category="' + cat + '"]');
      var $icon = $(this).find('.bi');
      if ($items.is(':visible')) {
        $items.slideUp(200);
        $icon.removeClass('bi-chevron-down').addClass('bi-chevron-right');
      } else {
        $items.slideDown(200);
        $icon.removeClass('bi-chevron-right').addClass('bi-chevron-down');
      }
    });
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.catalogs = {
    init: init,
    loadCatalogLots: loadCatalogLots
  };
})(window, jQuery);

(function(window, $) {
  var api = window.AuctionApp.api;
  var utils = window.AuctionApp.utils;
  var app = window.AuctionApp.app;
  var _state = {
    auctions: [],
    currentAuction: null,
    currentLotIdx: 0,
    bidHistory: [],
    pollTimer: null,
    countdownTimer: null,
    countdownSeconds: 0
  };

  function init() {
    loadAuctions();
    bindEvents();
  }

  function loadAuctions(typeFilter) {
    var params = {};
    if (typeFilter && typeFilter !== 'all') params.type = typeFilter;

    utils.showLoading();
    api.get('/auctions', params)
      .then(function(res) {
        _state.auctions = res.data || res || [];
        renderAuctions();
      })
      .fail(function() {
        $('#auction-list').html('<div class="text-center py-4 text-muted">加载拍卖会列表失败</div>');
      })
      .always(function() {
        utils.hideLoading();
      });
  }

  function renderAuctions() {
    var $list = $('#auction-list');
    if (!_state.auctions.length) {
      $list.html('<div class="text-center py-5 text-muted"><i class="bi bi-calendar-x fs-1 d-block mb-2"></i>暂无拍卖会</div>');
      return;
    }
    var html = '<div class="row g-4">';
    _state.auctions.forEach(function(a, idx) {
      var typeCls = 'auction-type-' + (a.type || 'monthly_online');
      var statusHtml = utils.getStatusLabel(a.status);
      html += '<div class="col-lg-4 col-md-6 animate-fade-in-up" style="animation-delay:' + (idx * 0.08) + 's">';
      html += '  <div class="card card-ink auction-card" data-id="' + a._id + '" style="cursor:pointer">';
      html += '    <div class="card-body">';
      html += '      <div class="d-flex justify-content-between align-items-start mb-2">';
      html += '        <span class="auction-type ' + typeCls + '">' + getTypeLabel(a.type) + '</span>';
      html += '        ' + statusHtml;
      html += '      </div>';
      html += '      <h5 class="card-title mt-2" style="color:var(--ink-deep);font-family:var(--font-title)">' + a.name + '</h5>';
      html += '      <div class="d-flex align-items-center gap-1 text-muted mb-1" style="font-size:0.85rem">';
      html += '        <i class="bi bi-calendar3"></i> ' + utils.formatDate(a.date || a.start_date);
      html += '      </div>';
      html += '      <div class="d-flex align-items-center gap-1 text-muted mb-1" style="font-size:0.85rem">';
      html += '        <i class="bi bi-geo-alt"></i> ' + (a.venue || '线上');
      html += '      </div>';
      html += '      <div class="d-flex align-items-center gap-1 text-muted" style="font-size:0.85rem">';
      html += '        <i class="bi bi-gem"></i> ' + (a.lot_count || 0) + ' 件拍品';
      html += '      </div>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    });
    html += '</div>';
    $list.html(html);
  }

  function getTypeLabel(type) {
    var map = { spring: '春季拍', autumn: '秋季拍', monthly_online: '月度网拍' };
    return map[type] || type;
  }

  function showAuctionDetail(auctionId) {
    stopPolling();
    utils.showLoading();

    $.when(
      api.get('/auctions/' + auctionId),
      api.get('/lots', { auction_id: auctionId, perPage: 100 })
    ).then(function(auctionRes, lotsRes) {
      var auction = auctionRes[0].data || auctionRes[0];
      var lotsData = lotsRes[0].data || lotsRes[0];
      _state.currentAuction = auction;
      _state.currentAuction.lots = lotsData.items || lotsData.lots || [];
      _state.currentLotIdx = 0;
      _state.bidHistory = [];

      $.get('pages/auction-detail.html').done(function(html) {
        $('#page-container').html(html);
        renderAuctionDetail();
        bindDetailEvents();
        startPolling();
        _state.countdownSeconds = 60;
        startCountdown();
      });
    }).fail(function() {
      utils.showToast('加载拍卖会详情失败', 'danger');
    }).always(function() {
      utils.hideLoading();
    });
  }

  function renderAuctionDetail() {
    var auction = _state.currentAuction;
    if (!auction) return;

    $('#auction-detail-title').text(auction.name);
    $('#auction-detail-type').html('<span class="auction-type auction-type-' + auction.type + '">' + getTypeLabel(auction.type) + '</span>');

    renderCurrentLot();
    renderLeaderboard();
    renderLotNavigation();
    renderBidHistory();
  }

  function renderCurrentLot() {
    var auction = _state.currentAuction;
    if (!auction || !auction.lots || !auction.lots.length) return;
    var lot = auction.lots[_state.currentLotIdx];
    if (!lot) return;

    var img = (lot.images && lot.images.length) ? lot.images[0] : '';
    if (img) {
      $('#auction-lot-image').attr('src', img).show();
    } else {
      $('#auction-lot-image').hide();
    }

    $('#auction-lot-name').text(lot.name);
    $('#auction-lot-number').text('LOT ' + (lot.lot_number || ''));

    var currentBid = lot.current_bid || lot.reference_price || 0;
    $('#auction-current-bid').text(utils.formatCurrency(currentBid));

    var increment = Math.max(1000, Math.round(currentBid * 0.05 / 100) * 100);
    $('#bid-increment-btn').text('+' + utils.formatCurrency(increment));
    $('#bid-increment-btn').data('increment', increment);
  }

  function renderLeaderboard() {
    var lot = _state.currentAuction && _state.currentAuction.lots[_state.currentLotIdx];
    if (!lot) return;

    var bidders = lot.bids || _state.bidHistory.slice(0, 5);
    var html = '';
    if (!bidders.length) {
      html = '<div class="text-muted text-center py-3">暂无出价</div>';
    } else {
      bidders.forEach(function(b, idx) {
        var rankCls = idx === 0 ? 'rank-1' : (idx === 1 ? 'rank-2' : (idx === 2 ? 'rank-3' : 'rank-other'));
        html += '<div class="leaderboard-item">';
        html += '  <div class="rank ' + rankCls + '">' + (idx + 1) + '</div>';
        html += '  <div class="bidder-name">' + (b.bidder_name || b.name || '竞买人' + (idx + 1)) + '</div>';
        html += '  <div class="bidder-amount">' + utils.formatCurrency(b.amount || b.bid_amount) + '</div>';
        html += '</div>';
      });
    }
    $('#auction-leaderboard').html(html);
  }

  function renderLotNavigation() {
    var lots = _state.currentAuction ? _state.currentAuction.lots : [];
    var html = '';
    lots.forEach(function(lot, idx) {
      var img = (lot.images && lot.images.length) ? lot.images[0] : '';
      var active = idx === _state.currentLotIdx ? 'border:2px solid var(--gold);' : '';
      html += '<div class="text-center me-2 mb-2" style="cursor:pointer;display:inline-block" data-idx="' + idx + '">';
      if (img) {
        html += '<img src="' + img + '" style="width:50px;height:50px;object-fit:cover;border-radius:4px;' + active + '">';
      } else {
        html += '<div style="width:50px;height:50px;border-radius:4px;background:var(--ink-deep);display:flex;align-items:center;justify-content:center;' + active + '"><i class="bi bi-gem text-muted"></i></div>';
      }
      html += '<div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px">' + (lot.lot_number || '') + '</div>';
      html += '</div>';
    });
    $('#auction-lot-nav').html(html);
  }

  function renderBidHistory() {
    var html = '';
    if (!_state.bidHistory.length) {
      html = '<tr><td colspan="4" class="text-center text-muted py-3">暂无出价记录</td></tr>';
    } else {
      _state.bidHistory.forEach(function(b, idx) {
        html += '<tr>';
        html += '  <td>' + (idx + 1) + '</td>';
        html += '  <td>' + (b.bidder_name || '-') + '</td>';
        html += '  <td style="font-family:var(--font-num)">' + utils.formatCurrency(b.amount || b.bid_amount) + '</td>';
        html += '  <td>' + utils.formatDate(b.created_at || b.time) + '</td>';
        html += '</tr>';
      });
    }
    $('#auction-bid-history tbody').html(html);
  }

  function placeBid(amount) {
    var lot = _state.currentAuction && _state.currentAuction.lots[_state.currentLotIdx];
    if (!lot) return;

    api.post('/auctions/' + _state.currentAuction._id + '/bid', { lot_id: lot._id, amount: amount })
      .then(function(res) {
        var bid = res.data || res;
        _state.bidHistory.unshift(bid);
        lot.current_bid = amount;
        renderCurrentLot();
        renderLeaderboard();
        renderBidHistory();
        app.flipNumber($('#auction-current-bid'), utils.formatCurrency(amount));
        utils.showToast('出价成功: ' + utils.formatCurrency(amount), 'success');
      })
      .fail(function(err) {
        utils.showToast(err.message || '出价失败', 'danger');
      });
  }

  function hammerDown() {
    var lot = _state.currentAuction && _state.currentAuction.lots[_state.currentLotIdx];
    if (!lot) return;

    api.post('/auctions/' + _state.currentAuction._id + '/hammer', { lot_id: lot._id, result: lot.current_bid ? 'sold' : 'passed' })
      .then(function() {
        var status = lot.current_bid ? '成交' : '流拍';
        utils.showToast('落槌! ' + status, 'success');
        app.triggerHammerCelebration();
        lot.status = lot.current_bid ? 'sold' : 'passed';

        setTimeout(function() {
          if (_state.currentLotIdx < _state.currentAuction.lots.length - 1) {
            _state.currentLotIdx++;
            renderAuctionDetail();
          }
        }, 2000);
      })
      .fail(function(err) {
        utils.showToast(err.message || '落槌操作失败', 'danger');
      });
  }

  function startPolling() {
    stopPolling();
    _state.pollTimer = setInterval(function() {
      var lot = _state.currentAuction && _state.currentAuction.lots[_state.currentLotIdx];
      if (!lot) return;
      api.get('/lots/' + lot._id)
        .then(function(res) {
          var fresh = res.data || res;
          if (fresh.current_bid && fresh.current_bid !== lot.current_bid) {
            app.flipNumber($('#auction-current-bid'), utils.formatCurrency(fresh.current_bid));
            lot.current_bid = fresh.current_bid;
            if (fresh.bids && fresh.bids.length) {
              _state.bidHistory = fresh.bids;
              renderLeaderboard();
              renderBidHistory();
            }
          }
        });
    }, 2000);
  }

  function stopPolling() {
    if (_state.pollTimer) {
      clearInterval(_state.pollTimer);
      _state.pollTimer = null;
    }
    if (_state.countdownTimer) {
      clearInterval(_state.countdownTimer);
      _state.countdownTimer = null;
    }
  }

  function startCountdown() {
    if (_state.countdownTimer) clearInterval(_state.countdownTimer);
    _state.countdownSeconds = 60;
    updateCountdownRing();
    _state.countdownTimer = setInterval(function() {
      _state.countdownSeconds--;
      if (_state.countdownSeconds <= 0) {
        _state.countdownSeconds = 60;
      }
      updateCountdownRing();
    }, 1000);
  }

  function updateCountdownRing() {
    var $ring = $('#countdown-ring');
    if (!$ring.length) return;
    var progress = _state.countdownSeconds / 60;
    var circumference = 2 * Math.PI * 52;
    var offset = circumference * (1 - progress);
    $ring.find('.ring-progress').css('stroke-dashoffset', offset);
    $ring.find('.ring-text').text(_state.countdownSeconds + 's');
  }

  function bindEvents() {
    $(document).off('click.auction-card', '.auction-card').on('click.auction-card', '.auction-card', function() {
      var id = $(this).data('id');
      if (id) showAuctionDetail(id);
    });

    $(document).off('click.auction-filter', '.auction-filter-btn').on('click.auction-filter', '.auction-filter-btn', function() {
      var type = $(this).data('type');
      $('.auction-filter-btn').removeClass('active');
      $(this).addClass('active');
      loadAuctions(type);
    });
  }

  function bindDetailEvents() {
    $(document).off('click.bid-increment', '#bid-increment-btn').on('click.bid-increment', '#bid-increment-btn', function() {
      var lot = _state.currentAuction && _state.currentAuction.lots[_state.currentLotIdx];
      if (!lot) return;
      var currentBid = lot.current_bid || lot.reference_price || 0;
      var increment = $(this).data('increment') || 1000;
      placeBid(currentBid + increment);
    });

    $(document).off('click.bid-custom', '#bid-custom-btn').on('click.bid-custom', '#bid-custom-btn', function() {
      var amount = parseFloat($('#bid-custom-amount').val());
      var lot = _state.currentAuction && _state.currentAuction.lots[_state.currentLotIdx];
      if (!lot) return;
      var currentBid = lot.current_bid || lot.reference_price || 0;
      if (!amount || amount <= currentBid) {
        utils.showToast('出价必须高于当前价: ' + utils.formatCurrency(currentBid), 'warning');
        return;
      }
      placeBid(amount);
    });

    $(document).off('click.hammer', '#btn-hammer').on('click.hammer', '#btn-hammer', function() {
      if (confirm('确认落槌？')) hammerDown();
    });

    $(document).off('click.lot-nav', '#auction-lot-nav [data-idx]').on('click.lot-nav', '#auction-lot-nav [data-idx]', function() {
      var idx = parseInt($(this).data('idx'));
      if (!isNaN(idx)) {
        _state.currentLotIdx = idx;
        _state.bidHistory = [];
        renderCurrentLot();
        renderLeaderboard();
        renderLotNavigation();
        renderBidHistory();
        _state.countdownSeconds = 60;
      }
    });
  }

  window.AuctionApp = window.AuctionApp || {};
  window.AuctionApp.auctions = {
    init: init,
    showAuctionDetail: showAuctionDetail,
    stopPolling: stopPolling
  };
})(window, jQuery);

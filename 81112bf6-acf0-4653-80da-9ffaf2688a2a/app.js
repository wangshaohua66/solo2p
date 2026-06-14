var App = (function() {
    var timeInterval = null;
    var audioCtx = null;

    function init() {
        moment.locale('zh-cn');

        DataService.init();
        Router.init();
        bindGlobalEvents();
        startClock();
        updateTopbarStats();

        Store.subscribe('faults', updateTopbarStats);
        Store.subscribe('crews', updateTopbarStats);
        Store.subscribe('faults.add', handleNewFault);

        setTimeout(function() {
            DataService.startSimulation();
        }, 1000);
    }

    function bindGlobalEvents() {
        $(document).on('click', '.sidebar-toggle', toggleSidebar);

        $(window).on('resize', function() {
            if ($(window).width() >= 768) {
                $('#sidebar').removeClass('sidebar-open');
            }
        });

        $(document).on('click', function(e) {
            if ($(window).width() < 768) {
                if (!$(e.target).closest('#sidebar, .sidebar-toggle').length) {
                    $('#sidebar').removeClass('sidebar-open');
                }
            }
        });
    }

    function startClock() {
        updateTime();
        timeInterval = setInterval(updateTime, 1000);
    }

    function updateTime() {
        $('#current-time').text(moment().format('YYYY-MM-DD HH:mm:ss'));
    }

    function updateTopbarStats() {
        var crews = Store.get('crews') || [];
        var onlineCount = crews.filter(function(c) { return c.status !== 'offline'; }).length;
        $('#online-crew-count').text(onlineCount);

        var faults = Store.get('faults') || [];
        var urgentCount = faults.filter(function(f) {
            return f.level === 'urgent' && f.status !== 'resolved';
        }).length;
        $('#urgent-fault-count').text(urgentCount);

        var $badge = $('.emergency-badge');
        if (urgentCount > 0) {
            $badge.text(urgentCount).removeClass('d-none');
            $('.urgent-notification').removeClass('d-none');
        } else {
            $badge.addClass('d-none');
            $('.urgent-notification').addClass('d-none');
        }
    }

    function handleNewFault(fault) {
        if (fault && fault.level === 'urgent') {
            showEmergencyAlert('紧急故障告警！' + fault.location + ' 发生 ' + fault.typeText + '，影响用户 ' + fault.affectedUsers + ' 户');
            playAlertSound();
        }
    }

    function showEmergencyAlert(text) {
        var $alert = $('#emergency-alert');
        $('#emergency-text').text(text);
        $alert.removeClass('d-none');
        setTimeout(function() {
            $alert.addClass('show');
        }, 10);
    }

    function hideEmergencyAlert() {
        var $alert = $('#emergency-alert');
        $alert.removeClass('show');
        setTimeout(function() {
            $alert.addClass('d-none');
        }, 300);
    }

    function playAlertSound() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            var oscillator = audioCtx.createOscillator();
            var gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.15);
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3);

            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.log('Audio playback not supported');
        }
    }

    function toggleSidebar() {
        $('#sidebar').toggleClass('sidebar-open');
    }

    return {
        init: init,
        toggleSidebar: toggleSidebar,
        showEmergencyAlert: showEmergencyAlert,
        hideEmergencyAlert: hideEmergencyAlert
    };
})();

$(document).ready(function() {
    App.init();
});

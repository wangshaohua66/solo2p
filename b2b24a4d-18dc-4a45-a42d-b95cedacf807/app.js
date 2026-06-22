require.config({
    baseUrl: './',
    paths: {
        'jquery': 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min',
        'bootstrap': 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min',
        'chart': 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min',
        'jspdf': 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min',
        'datatables': 'https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min',
        'datatables-bs5': 'https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min',
        'validator': 'https://cdn.jsdelivr.net/npm/bootstrap5-validator@1.0.0/dist/validator.min',
        'dataStore': 'utils/dataStore',
        'router': 'utils/router',
        'sampleRegister': 'modules/sampleRegister',
        'detectInput': 'modules/detectInput',
        'scoreJudge': 'modules/scoreJudge',
        'statistics': 'modules/statistics',
        'historyQuery': 'modules/historyQuery',
        'reportGen': 'modules/reportGen'
    },
    shim: {
        'bootstrap': { deps: ['jquery'] },
        'datatables': { deps: ['jquery'], exports: '$.fn.dataTable' },
        'datatables-bs5': { deps: ['datatables', 'bootstrap'] },
        'validator': { deps: ['jquery', 'bootstrap'] }
    },
    waitSeconds: 60
});

define('datatables.net', ['datatables'], function (dt) {
    return dt;
});

require(['jquery', 'bootstrap', 'datatables', 'datatables-bs5', 'router'], function ($, bootstrap, dt1, dt2, router) {
    $(function () {
        router.init();
    });
});

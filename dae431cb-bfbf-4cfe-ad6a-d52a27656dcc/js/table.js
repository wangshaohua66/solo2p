(function(global) {
  'use strict';

  function BVTable(selector, options) {
    const defaults = {
      dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>rt<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
      pageLength: 25,
      lengthMenu: [[10, 25, 50, 100, 250, 500], [10, 25, 50, 100, 250, 500]],
      deferRender: true,
      processing: true,
      colReorder: true,
      select: { style: 'multi', selector: 'td:first-child' },
      language: {
        search: '搜索:',
        lengthMenu: '显示 _MENU_ 条',
        info: '显示第 _START_ 到 _END_ 条，共 _TOTAL_ 条',
        infoEmpty: '没有数据',
        emptyTable: '暂无数据',
        paginate: { first: '首页', last: '末页', next: '下一页', previous: '上一页' },
        select: { rows: '已选择 %d 行' }
      },
      scrollX: true,
      responsive: false
    };
    const config = $.extend(true, {}, defaults, options);
    const api = $(selector).DataTable(config);
    api.exportSelectedCSV = function(filename) {
      const data = api.rows({ selected: true }).data().toArray();
      if (data.length === 0) return null;
      const cols = api.columns().header().toArray().map(h => $(h).text());
      const rows = [cols.join(',')];
      data.forEach(row => {
        const line = cols.map((_, i) => {
          let v = row[i];
          if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) {
            v = '"' + v.replace(/"/g, '""') + '"';
          }
          return v ?? '';
        }).join(',');
        rows.push(line);
      });
      const csv = '\uFEFF' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = (filename || 'export') + '.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      return data.length;
    };
    return api;
  }

  global.BVTable = BVTable;
})(window);

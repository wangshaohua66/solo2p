var Exporter = (function() {
    function init() {
        $('#btnExport').on('click', function(e) {
            e.preventDefault();
            doExport();
        });
        $('#btnImportTrigger').on('click', function(e) {
            e.preventDefault();
            $('#importFile').click();
        });
        $('#importFile').on('change', handleImportFile);
        $('#btnClearAll').on('click', function(e) {
            e.preventDefault();
            showConfirm('确定清空所有数据吗？此操作不可撤销。', function() {
                AppDB.clearAll().then(function() {
                    AppState.clearCompare();
                    AppState.publish('exp:deleted');
                    AppState.publish('toast:show', { type: 'success', message: '数据已清空并恢复默认原料库' });
                });
            });
        });
    }

    function doExport() {
        AppDB.exportAll().then(function(data) {
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = '陶釉实验备份_' + formatDate(new Date()) + '.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            AppState.publish('toast:show', { type: 'success', message: '导出成功' });
        });
    }

    function handleImportFile(e) {
        var file = e.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) {
            AppState.publish('toast:show', { type: 'error', message: '文件过大，不支持超过50MB' });
            return;
        }
        var reader = new FileReader();
        reader.onload = function(ev) {
            try {
                var data = JSON.parse(ev.target.result);
                if (!data.experiments || !data.materials) throw new Error('格式不正确');
                showConfirm('导入将覆盖现有数据，是否继续？', function() {
                    AppDB.importAll(data).then(function() {
                        AppState.clearCompare();
                        AppState.publish('exp:created');
                        AppState.publish('toast:show', { type: 'success', message: '导入成功：' +
                            (data.experiments || []).length + '条实验，' +
                            (data.materials || []).length + '种原料' });
                    }).catch(function(err) {
                        AppState.publish('toast:show', { type: 'error', message: '导入失败：' + err.message });
                    });
                });
            } catch (err) {
                AppState.publish('toast:show', { type: 'error', message: 'JSON解析失败：' + err.message });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    }

    function formatDate(d) {
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
               '_' + pad(d.getHours()) + pad(d.getMinutes());
    }
    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function compressImage(file, maxSizeKB) {
        return new Promise(function(resolve, reject) {
            maxSizeKB = maxSizeKB || 1024;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var img = new Image();
                img.onload = function() {
                    var canvas = document.createElement('canvas');
                    var maxDim = 1280;
                    var w = img.width, h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
                        else { w = Math.round(w * maxDim / h); h = maxDim; }
                    }
                    canvas.width = w;
                    canvas.height = h;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);

                    var quality = 0.85;
                    function tryQuality(q) {
                        var dataUrl = canvas.toDataURL('image/jpeg', q);
                        var sizeKB = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4 / 1024);
                        if (sizeKB <= maxSizeKB || q <= 0.3) {
                            resolve({ dataBase64: dataUrl, sizeKB: sizeKB });
                        } else {
                            tryQuality(q - 0.1);
                        }
                    }
                    tryQuality(quality);
                };
                img.onerror = function() { reject(new Error('图片加载失败')); };
                img.src = ev.target.result;
            };
            reader.onerror = function() { reject(new Error('文件读取失败')); };
            reader.readAsDataURL(file);
        });
    }

    function showConfirm(msg, onOk) {
        $('#confirmMessage').text(msg);
        $('#confirmOk').off('click').on('click', function() {
            bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
            onOk && onOk();
        });
        new bootstrap.Modal(document.getElementById('confirmModal')).show();
    }

    return {
        init: init,
        compressImage: compressImage,
        showConfirm: showConfirm
    };
})();

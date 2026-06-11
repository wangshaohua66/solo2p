var AppDB = (function() {
    var db;
    var DEFAULT_MATERIALS = [
        { name: '长石', chemicalFormula: 'KAlSi3O8', minRange: 20, maxRange: 60, notes: '助熔剂，常用', usageCount: 0 },
        { name: '石英', chemicalFormula: 'SiO2', minRange: 15, maxRange: 45, notes: '玻璃相形成', usageCount: 0 },
        { name: '高岭土', chemicalFormula: 'Al2Si2O5(OH)4', minRange: 10, maxRange: 40, notes: '增加黏度', usageCount: 0 },
        { name: '碳酸钙', chemicalFormula: 'CaCO3', minRange: 5, maxRange: 25, notes: '助熔剂，钙釉', usageCount: 0 },
        { name: '氧化锌', chemicalFormula: 'ZnO', minRange: 0, maxRange: 15, notes: '助熔，结晶釉', usageCount: 0 },
        { name: '氧化镁', chemicalFormula: 'MgO', minRange: 0, maxRange: 10, notes: '乳浊，无光', usageCount: 0 },
        { name: '碳酸钡', chemicalFormula: 'BaCO3', minRange: 0, maxRange: 20, notes: '助熔，高光泽', usageCount: 0 },
        { name: '氧化铁', chemicalFormula: 'Fe2O3', minRange: 0.5, maxRange: 10, notes: '着色剂，青瓷/灰釉', usageCount: 0 },
        { name: '氧化钛', chemicalFormula: 'TiO2', minRange: 0, maxRange: 8, notes: '乳浊，结晶', usageCount: 0 },
        { name: '氧化铜', chemicalFormula: 'CuO', minRange: 0.5, maxRange: 5, notes: '绿色，还原变红色', usageCount: 0 },
        { name: '氧化钴', chemicalFormula: 'CoO', minRange: 0.1, maxRange: 3, notes: '蓝色着色', usageCount: 0 },
        { name: '氧化锰', chemicalFormula: 'MnO2', minRange: 0.5, maxRange: 8, notes: '紫色/褐色', usageCount: 0 },
        { name: '骨灰', chemicalFormula: 'Ca3(PO4)2', minRange: 0, maxRange: 10, notes: '乳浊，磷光', usageCount: 0 },
        { name: '硼砂', chemicalFormula: 'Na2B4O7', minRange: 0, maxRange: 20, notes: '低温助熔', usageCount: 0 },
        { name: '瓷土', chemicalFormula: '-', minRange: 10, maxRange: 40, notes: '基础原料', usageCount: 0 },
        { name: '球土', chemicalFormula: '-', minRange: 0, maxRange: 20, notes: '可塑性', usageCount: 0 }
    ];

    function init() {
        db = new Dexie('GlazeLab3');
        db.version(1).stores({
            experiments: '++id, name, date, glazeCategory, kilnType, atmosphere, cone, createdAt',
            materials:   '++id, name, usageCount',
            tags:        '++id, name, type',
            media:       '++id, experimentId, order'
        });

        return db.open().then(function() {
            return ensureDefaultMaterials();
        }).then(function() {
            return cacheMaterials();
        });
    }

    function ensureDefaultMaterials() {
        return db.materials.count().then(function(count) {
            if (count > 0) return Promise.resolve();
            return addMaterialsSequentially(DEFAULT_MATERIALS.slice(), 0);
        });
    }

    function addMaterialsSequentially(list, idx) {
        if (idx >= list.length) return Promise.resolve();
        var mat = list[idx];
        return db.materials.add(mat).then(function() {
            return addMaterialsSequentially(list, idx + 1);
        }).catch(function() {
            return addMaterialsSequentially(list, idx + 1);
        });
    }

    function cacheMaterials() {
        return db.materials.orderBy('usageCount').reverse().toArray().then(function(mats) {
            AppState.set('materialsCache', mats);
            return mats;
        });
    }

    function getDB() { return db; }

    function getAllExperiments() {
        return db.experiments.orderBy('createdAt').reverse().toArray();
    }

    function getExperiment(id) {
        return db.experiments.get(parseInt(id));
    }

    function getExperimentWithMedia(id) {
        return Promise.all([
            db.experiments.get(parseInt(id)),
            db.media.where('experimentId').equals(parseInt(id)).sortBy('order')
        ]).then(function(results) {
            var exp = results[0];
            if (exp) exp.media = results[1];
            return exp;
        });
    }

    function createExperiment(expData, mediaList) {
        return db.experiments.add(expData).then(function(expId) {
            return addMediaSequentially(expId, mediaList || [], 0).then(function() {
                return updateMaterialUsage(expData.recipe || []).then(function() {
                    return cacheMaterials();
                }).then(function() {
                    return expId;
                });
            });
        });
    }

    function addMediaSequentially(expId, list, idx) {
        if (idx >= list.length) return Promise.resolve();
        var m = list[idx];
        return db.media.add({
            experimentId: expId,
            dataBase64: m.dataBase64,
            caption: m.caption || '',
            order: idx
        }).then(function() {
            return addMediaSequentially(expId, list, idx + 1);
        });
    }

    function updateMaterialUsage(recipe) {
        var names = recipe.map(function(r) { return r.materialName; }).filter(Boolean);
        if (names.length === 0) return Promise.resolve();
        return db.materials.where('name').anyOf(names).toArray().then(function(mats) {
            return updateUsageSeq(mats, 0);
        });
    }

    function updateUsageSeq(mats, idx) {
        if (idx >= mats.length) return Promise.resolve();
        var m = mats[idx];
        return db.materials.update(m.id, { usageCount: (m.usageCount || 0) + 1 }).then(function() {
            return updateUsageSeq(mats, idx + 1);
        });
    }

    function updateExperiment(id, expData, newMediaList, removeMediaIds) {
        expData.updatedAt = new Date().toISOString();
        return db.experiments.update(parseInt(id), expData).then(function() {
            return deleteMediaSeq(removeMediaIds || [], 0);
        }).then(function() {
            if (!newMediaList || newMediaList.length === 0) return Promise.resolve(id);
            return db.media.where('experimentId').equals(parseInt(id)).sortBy('order').then(function(existing) {
                var nextOrder = existing.length;
                return addNewMediaSeq(parseInt(id), newMediaList, 0, nextOrder).then(function() { return id; });
            });
        });
    }

    function deleteMediaSeq(ids, idx) {
        if (idx >= ids.length) return Promise.resolve();
        return db.media.delete(parseInt(ids[idx])).then(function() {
            return deleteMediaSeq(ids, idx + 1);
        });
    }

    function addNewMediaSeq(expId, list, idx, baseOrder) {
        if (idx >= list.length) return Promise.resolve();
        var m = list[idx];
        return db.media.add({
            experimentId: expId,
            dataBase64: m.dataBase64,
            caption: m.caption || '',
            order: baseOrder + idx
        }).then(function() {
            return addNewMediaSeq(expId, list, idx + 1, baseOrder);
        });
    }

    function deleteExperiment(id) {
        return Promise.all([
            db.experiments.delete(parseInt(id)),
            db.media.where('experimentId').equals(parseInt(id)).delete()
        ]);
    }

    function getMaterials() {
        return db.materials.orderBy('usageCount').reverse().toArray();
    }

    function createMaterial(mat) {
        return db.materials.add(mat).then(function(id) {
            return cacheMaterials().then(function() {
                AppState.publish('material:changed');
                return id;
            });
        });
    }

    function updateMaterial(id, mat) {
        return db.materials.update(parseInt(id), mat).then(function(r) {
            return cacheMaterials().then(function() {
                AppState.publish('material:changed');
                return r;
            });
        });
    }

    function deleteMaterial(id) {
        return db.materials.delete(parseInt(id)).then(function() {
            return cacheMaterials().then(function() {
                AppState.publish('material:changed');
            });
        });
    }

    function getMediaByExpId(expId) {
        return db.media.where('experimentId').equals(parseInt(expId)).sortBy('order');
    }

    function exportAll() {
        return Promise.all([
            db.experiments.toArray(),
            db.materials.toArray(),
            db.tags.toArray(),
            db.media.toArray()
        ]).then(function(results) {
            return {
                version: 1,
                exportedAt: new Date().toISOString(),
                experiments: results[0],
                materials: results[1],
                tags: results[2],
                media: results[3]
            };
        });
    }

    function importAll(data) {
        return putSeq(db.experiments, data.experiments || [], 0).then(function() {
            return putSeq(db.materials, data.materials || [], 0);
        }).then(function() {
            return putSeq(db.tags, data.tags || [], 0);
        }).then(function() {
            return putSeq(db.media, data.media || [], 0);
        }).then(function() {
            return cacheMaterials();
        });
    }

    function putSeq(table, list, idx) {
        if (idx >= list.length) return Promise.resolve();
        return table.put(list[idx]).then(function() {
            return putSeq(table, list, idx + 1);
        });
    }

    function clearAll() {
        return Promise.all([
            db.experiments.clear(),
            db.materials.clear(),
            db.tags.clear(),
            db.media.clear()
        ]).then(function() {
            return ensureDefaultMaterials();
        }).then(function() {
            return cacheMaterials();
        });
    }

    return {
        init: init,
        getDB: getDB,
        getAllExperiments: getAllExperiments,
        getExperiment: getExperiment,
        getExperimentWithMedia: getExperimentWithMedia,
        createExperiment: createExperiment,
        updateExperiment: updateExperiment,
        deleteExperiment: deleteExperiment,
        getMaterials: getMaterials,
        createMaterial: createMaterial,
        updateMaterial: updateMaterial,
        deleteMaterial: deleteMaterial,
        getMediaByExpId: getMediaByExpId,
        exportAll: exportAll,
        importAll: importAll,
        clearAll: clearAll
    };
})();

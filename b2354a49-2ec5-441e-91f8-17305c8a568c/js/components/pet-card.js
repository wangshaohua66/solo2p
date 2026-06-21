(function(global) {
    'use strict';

    var App = global.App || (global.App = {});

    App.components = App.components || {};

    function renderPetCard(pet, options) {
        options = options || {};
        var owner = pet.ownerId ? App.store.getCustomerById(pet.ownerId) : null;
        var history = pet.serviceHistory ? App.store.getPetServices(pet.id, 3) : [];
        var photo = pet.photos && pet.photos.length ? pet.photos[0] :
            'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop';

        var personalityTags = '';
        (pet.personality || []).forEach(function(t) {
            personalityTags += '<span class="badge bg-info-subtle text-info-emphasis me-1 mb-1">' + t + '</span>';
        });

        var allergyHtml = '';
        if (pet.allergy && pet.allergy.length) {
            allergyHtml = '<div class="alert alert-warning py-1 px-2 small mb-2 mt-2"><i class="bi bi-exclamation-triangle me-1"></i>' +
                '过敏：' + pet.allergy.join('、') + '</div>';
        }

        var notesHtml = '';
        if (pet.specialNotes) {
            notesHtml = '<div class="alert alert-danger py-1 px-2 small mb-0"><i class="bi bi-info-circle me-1"></i>' +
                pet.specialNotes + '</div>';
        }

        var vaccinesHtml = '';
        (pet.vaccines || []).forEach(function(v) {
            vaccinesHtml += '<span class="badge bg-success-subtle text-success-emphasis me-1 mb-1">' + v.name + ' ' + v.date + '</span>';
        });

        var historyHtml = '';
        history.forEach(function(s) {
            var typeName = (App.store.getServiceTypes().find(function(t) { return t.id === s.type; }) || {}).name || s.type;
            historyHtml += '<div class="d-flex align-items-center gap-2 py-1 border-bottom last-border-none">' +
                '<span class="text-muted small">' + s.startTime.substring(5, 16) + '</span>' +
                '<span class="badge bg-secondary-subtle text-secondary-emphasis">' + typeName + '</span>' +
                '<span class="text-success small ms-auto">' + App.calculator.formatMoney(s.price) + '</span>' +
                '</div>';
        });

        var buttons = '';
        if (options.onEdit) {
            buttons += '<button class="btn btn-sm btn-outline-primary pet-action-edit" data-id="' + pet.id + '">' +
                '<i class="bi bi-pencil me-1"></i>编辑</button> ';
        }
        if (options.onSelect) {
            buttons += '<button class="btn btn-sm btn-primary pet-action-select" data-id="' + pet.id + '">' +
                '<i class="bi bi-check2 me-1"></i>选择</button>';
        }

        var ageText = '';
        if (pet.birthday) {
            var bd = new Date(pet.birthday);
            var diff = Date.now() - bd.getTime();
            var years = Math.floor(diff / (365 * 24 * 3600 * 1000));
            var months = Math.floor((diff % (365 * 24 * 3600 * 1000)) / (30 * 24 * 3600 * 1000));
            ageText = (years > 0 ? years + '岁' : '') + (months > 0 ? months + '月' : '');
        }

        return '<div class="card pet-card h-100 shadow-sm transition-hover" data-pet-id="' + pet.id + '">' +
            '<div class="row g-0">' +
            '<div class="col-4 col-md-3">' +
            '<img src="' + photo + '" class="pet-photo img-fluid rounded-start" alt="' + pet.name + '" onerror="this.src=\'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=200&h=200&fit=crop\'">' +
            '</div>' +
            '<div class="col-8 col-md-9">' +
            '<div class="card-body p-3">' +
            '<div class="d-flex justify-content-between align-items-start mb-2">' +
            '<div>' +
            '<h6 class="card-title mb-1 fw-bold">' +
            (pet.species === 'cat' ? '<i class="bi bi-cat text-info me-1"></i>' : '<i class="bi bi-dog text-warning me-1"></i>') +
            pet.name +
            '<span class="ms-2 small text-muted fw-normal">' + (pet.gender === '公' ? '♂' : '♀') + '</span>' +
            '</h6>' +
            '<p class="small text-muted mb-1">' + pet.breed +
            (ageText ? ' · ' + ageText : '') +
            (pet.weight ? ' · ' + pet.weight + 'kg' : '') + '</p>' +
            '</div>' +
            (owner ? '<span class="small text-muted"><i class="bi bi-person me-1"></i>' + owner.name + '</span>' : '') +
            '</div>' +
            '<div>' + personalityTags + '</div>' +
            (pet.hairType ? '<span class="badge bg-light text-dark me-1 mb-1">毛质：' + pet.hairType + '</span>' : '') +
            allergyHtml +
            notesHtml +
            (vaccinesHtml ? '<div class="mt-2"><small class="text-muted me-2">疫苗</small>' + vaccinesHtml + '</div>' : '') +
            (historyHtml ? '<div class="mt-2"><small class="d-block text-muted mb-1"><i class="bi bi-clock-history me-1"></i>最近服务</small>' + historyHtml + '</div>' : '') +
            (buttons ? '<div class="mt-3">' + buttons + '</div>' : '') +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>';
    }

    function renderPetForm(pet, customers) {
        pet = pet || {};
        var customerOptions = '';
        (customers || []).forEach(function(c) {
            customerOptions += '<option value="' + c.id + '" ' + (pet.ownerId === c.id ? 'selected' : '') + '>' + c.name + ' - ' + c.phone + '</option>';
        });

        return '<form id="petForm" class="row g-3">' +
            '<div class="col-12">' +
            '<label class="form-label">主人 <span class="text-danger">*</span></label>' +
            '<select name="ownerId" class="form-select" required><option value="">请选择主人</option>' + customerOptions + '</select>' +
            '</div>' +
            '<div class="col-md-4"><label class="form-label">宠物名 <span class="text-danger">*</span></label>' +
            '<input name="name" class="form-control" value="' + (pet.name || '') + '" required></div>' +
            '<div class="col-md-4"><label class="form-label">物种</label>' +
            '<select name="species" class="form-select">' +
            '<option value="dog" ' + (pet.species === 'dog' ? 'selected' : '') + '>狗狗</option>' +
            '<option value="cat" ' + (pet.species === 'cat' ? 'selected' : '') + '>猫咪</option>' +
            '</select></div>' +
            '<div class="col-md-4"><label class="form-label">性别</label>' +
            '<select name="gender" class="form-select">' +
            '<option value="公" ' + (pet.gender === '公' ? 'selected' : '') + '>公</option>' +
            '<option value="母" ' + (pet.gender === '母' ? 'selected' : '') + '>母</option>' +
            '</select></div>' +
            '<div class="col-md-6"><label class="form-label">品种</label>' +
            '<input name="breed" class="form-control" value="' + (pet.breed || '') + '"></div>' +
            '<div class="col-md-3"><label class="form-label">生日</label>' +
            '<input name="birthday" type="date" class="form-control" value="' + (pet.birthday || '') + '"></div>' +
            '<div class="col-md-3"><label class="form-label">体重 (kg)</label>' +
            '<input name="weight" type="number" step="0.1" class="form-control" value="' + (pet.weight || '') + '"></div>' +
            '<div class="col-md-4"><label class="form-label">毛质</label>' +
            '<select name="hairType" class="form-select">' +
            '<option value="">请选择</option>' +
            ['短毛','长毛','卷毛','双层毛','刚毛'].map(function(t) {
                return '<option value="' + t + '" ' + (pet.hairType === t ? 'selected' : '') + '>' + t + '</option>';
            }).join('') +
            '</select></div>' +
            '<div class="col-md-8"><label class="form-label">性格标签（逗号分隔）</label>' +
            '<input name="personalityStr" class="form-control" value="' + ((pet.personality || []).join('，')) + '"></div>' +
            '<div class="col-md-6"><label class="form-label">过敏史（逗号分隔）</label>' +
            '<input name="allergyStr" class="form-control" value="' + ((pet.allergy || []).join('，')) + '"></div>' +
            '<div class="col-md-6"><label class="form-label">特殊注意事项</label>' +
            '<input name="specialNotes" class="form-control" value="' + (pet.specialNotes || '') + '"></div>' +
            '<div class="col-12"><label class="form-label">疫苗记录（JSON格式调试用，可留空）</label>' +
            '<textarea name="vaccinesStr" class="form-control form-control-sm" rows="2">' + (pet.vaccines ? JSON.stringify(pet.vaccines) : '') + '</textarea></div>' +
            '<input type="hidden" name="id" value="' + (pet.id || '') + '">' +
            '</form>';
    }

    function collectPetForm() {
        var data = {};
        $('#petForm [name]').each(function() {
            var name = $(this).attr('name');
            var val = $(this).val();
            data[name] = val;
        });
        var result = {
            id: data.id || undefined,
            ownerId: data.ownerId,
            name: data.name,
            species: data.species,
            gender: data.gender,
            breed: data.breed,
            birthday: data.birthday || null,
            weight: data.weight ? parseFloat(data.weight) : null,
            hairType: data.hairType,
            personality: data.personalityStr ? data.personalityStr.split(/[，,]/).map(function(s) { return s.trim(); }).filter(Boolean) : [],
            allergy: data.allergyStr ? data.allergyStr.split(/[，,]/).map(function(s) { return s.trim(); }).filter(Boolean) : [],
            specialNotes: data.specialNotes
        };
        if (data.vaccinesStr) {
            try { result.vaccines = JSON.parse(data.vaccinesStr); } catch(e) { result.vaccines = []; }
        }
        if (!result.id) delete result.id;
        return result;
    }

    App.components.petCard = {
        render: renderPetCard,
        renderForm: renderPetForm,
        collectForm: collectPetForm
    };

})(typeof window !== 'undefined' ? window : this);

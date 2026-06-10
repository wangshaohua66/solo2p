(function ($) {
  'use strict';

  var pendingImage = null;

  function initImageUploader() {
    var $drop = $('#gearUploadDrop');
    var $input = $('#gearImageFile');
    var $preview = $('#gearImagePreview');
    var $img = $('#gearImagePreviewImg');

    $drop.on('click', function () { $input.trigger('click'); });
    $input.on('change', handleSelect);

    $drop.on('dragover dragenter', function (e) { e.preventDefault(); $drop.addClass('border-primary bg-primary-50'); });
    $drop.on('dragleave drop', function (e) { e.preventDefault(); $drop.removeClass('border-primary bg-primary-50'); });
    $drop.on('drop', function (e) {
      var files = e.originalEvent.dataTransfer.files;
      if (files && files.length) { $input.prop('files', files); handleSelect.call($input[0]); }
    });

    async function handleSelect() {
      var file = this.files && this.files[0];
      if (!file) return;
      try { file = await CampHub.image.compressIfNeeded(file, 5); } catch {}
      pendingImage = file;
      var url = await CampHub.image.dataUrlFromFile(file);
      $img.attr('src', url);
      $preview.removeClass('d-none');
      $drop.addClass('d-none');
    }

    $('#gearImageRemove').on('click', function () {
      pendingImage = null;
      $input.val('');
      $preview.addClass('d-none');
      $drop.removeClass('d-none');
    });
  }

  function initForm() {
    $('#gearCreateForm').validate({
      rules: {
        name: { required: true, minlength: 2, maxlength: 50 },
        category: { required: true }
      },
      submitHandler: function (form) {
        var $btn = $('#gearCreateBtn').prop('disabled', true).find('i').addClass('spinner-border spinner-border-sm').end();
        var fd = new FormData();
        fd.append('name', form.name.value.trim());
        fd.append('category', form.category.value);
        if (form.description.value) fd.append('description', form.description.value);
        if (form.purchasePrice.value) fd.append('purchasePrice', parseFloat(form.purchasePrice.value) || 0);
        if (form.nextMaintenanceAfterUses.value) fd.append('nextMaintenanceAfterUses', parseInt(form.nextMaintenanceAfterUses.value, 10) || 20);
        if (pendingImage) fd.append('image', pendingImage);

        CampHub.ajax.post('/gear', fd, { contentType: false }).then(function (gear) {
          CampHub.ui.toast('装备登记成功', 'success');
          setTimeout(function () { window.location.href = '/Gear'; }, 500);
        }).catch(function (err) {
          CampHub.ui.toast(err.message || '提交失败', 'error');
          $btn.prop('disabled', false).find('i.spinner-border').removeClass('spinner-border spinner-border-sm').addClass('bi-check-lg');
        });
        return false;
      }
    });
  }

  $(function () {
    if (!CampHub.auth.requireLogin()) return;
    initImageUploader();
    initForm();
  });
})(jQuery);

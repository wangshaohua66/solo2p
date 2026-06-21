$(function() {
    const token = getToken();
    if (token) {
        window.location.href = 'dashboard.html';
    }

    $('#loginForm').submit(function(e) {
        e.preventDefault();
        const form = $(this)[0];
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const username = $('#loginUsername').val().trim();
        const password = $('#loginPassword').val();

        showLoading($('#loginBtn'));

        ajax({
            url: API_BASE + '/auth/login',
            type: 'POST',
            data: {
                username: username,
                password: password
            },
            success: function(res) {
                if (res.code === 0) {
                    setToken(res.data.token);
                    setUserInfo(res.data.user);
                    showSuccess('登录成功！正在跳转...');
                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 500);
                } else {
                    showError(res.message || '登录失败');
                }
            },
            error: function(xhr) {
                const res = xhr.responseJSON;
                showError(res && res.message ? res.message : '网络错误，请稍后重试');
            },
            complete: function() {
                hideLoading($('#loginBtn'));
            }
        });
    });

    $('#registerForm').submit(function(e) {
        e.preventDefault();
        const form = $(this)[0];
        
        const password = $('#registerPassword').val();
        const confirmPassword = $('#registerConfirmPassword').val();
        
        if (password !== confirmPassword) {
            $('#registerConfirmPassword')[0].setCustomValidity('密码不一致');
        } else {
            $('#registerConfirmPassword')[0].setCustomValidity('');
        }

        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        const data = {
            username: $('#registerUsername').val().trim(),
            password: password,
            name: $('#registerName').val().trim(),
            phone: $('#registerPhone').val().trim(),
            idCard: $('#registerIDCard').val().trim()
        };

        showLoading($('#registerBtn'));

        ajax({
            url: API_BASE + '/auth/register',
            type: 'POST',
            data: data,
            success: function(res) {
                if (res.code === 0) {
                    showSuccess('注册成功！请使用账号登录');
                    setTimeout(function() {
                        const tab = new bootstrap.Tab($('#login-tab'));
                        tab.show();
                        $('#loginUsername').val(data.username);
                        $('#loginPassword').focus();
                    }, 1000);
                } else {
                    showError(res.message || '注册失败');
                }
            },
            error: function(xhr) {
                const res = xhr.responseJSON;
                showError(res && res.message ? res.message : '网络错误，请稍后重试');
            },
            complete: function() {
                hideLoading($('#registerBtn'));
            }
        });
    });

    $('#registerPassword, #registerConfirmPassword').on('keyup', function() {
        const password = $('#registerPassword').val();
        const confirmPassword = $('#registerConfirmPassword').val();
        if (password !== confirmPassword) {
            $('#registerConfirmPassword')[0].setCustomValidity('密码不一致');
        } else {
            $('#registerConfirmPassword')[0].setCustomValidity('');
        }
    });

    function showLoading($btn) {
        const originalText = $btn.html();
        $btn.data('original-text', originalText);
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>处理中...');
    }

    function hideLoading($btn) {
        $btn.prop('disabled', false).html($btn.data('original-text'));
    }
});

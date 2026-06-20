$(function() {
    const App = {
        currentPage: 'training',
        charts: {},

        init() {
            this.bindNavEvents();
            this.handleHashChange();
            $(window).on('hashchange', () => this.handleHashChange());
            this.initPage('training');
        },

        bindNavEvents() {
            $('.navbar-nav .nav-link[data-page]').on('click', (e) => {
                e.preventDefault();
                const page = $(e.currentTarget).data('page');
                this.navigateTo(page);
            });
        },

        handleHashChange() {
            const hash = window.location.hash.slice(1) || 'training';
            if (hash !== this.currentPage) {
                this.navigateTo(hash, false);
            }
        },

        navigateTo(page, updateHash = true) {
            if (updateHash) {
                window.location.hash = page;
            }
            
            $('.navbar-nav .nav-link[data-page]').removeClass('active');
            $(`.navbar-nav .nav-link[data-page="${page}"]`).addClass('active');
            
            $('.page-content').addClass('d-none');
            $(`#page-${page}`).removeClass('d-none');
            
            this.currentPage = page;
            this.initPage(page);
        },

        initPage(page) {
            switch (page) {
                case 'training':
                    TrainingModule.init();
                    break;
                case 'exam':
                    ExamModule.init();
                    break;
                case 'equipment':
                    EquipmentModule.init();
                    break;
                case 'statistic':
                    StatisticModule.init();
                    break;
            }
        }
    };

    App.init();
    window.App = App;
});

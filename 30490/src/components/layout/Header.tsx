import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  Moon,
  Search,
  Globe,
  User,
  Menu,
  Radio,
} from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { useAudioStore } from '@/store/audioStore';
import { translate } from '@/i18n';
import styles from './Header.module.css';

export const Header = () => {
  const theme = useSettingsStore((s) => s.theme);
  const language = useSettingsStore((s) => s.language);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const { toggleTheme, setLanguage, toggleSidebar } = useSettingsStore(
    (s) => s.actions,
  );
  const filters = useAudioStore((s) => s.filters);
  const { setFilters } = useAudioStore((s) => s.actions);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const handleToggleTheme = useCallback(() => {
    toggleTheme();
  }, [toggleTheme]);

  const handleToggleLanguage = useCallback(() => {
    setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN');
  }, [language, setLanguage]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters({ search: e.target.value });
    },
    [setFilters],
  );

  const t = (key: string) => translate(language, key);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={handleToggleSidebar}
          aria-label={sidebarCollapsed ? '展开菜单' : '折叠菜单'}
        >
          <Menu className={styles.menuIcon} />
        </button>

        <Link to="/" className={styles.logoSection}>
          <Radio className={styles.logoIcon} />
          <div className={styles.titleGroup}>
            <span className={styles.titleMain}>声景档案</span>
            <span className={styles.titleSub}>SoundScape</span>
          </div>
        </Link>
      </div>

      <div className={styles.center}>
        <div className={styles.searchWrapper}>
          <Search className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('library.searchPlaceholder')}
            value={filters.search || ''}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={handleToggleTheme}
          aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}
        >
          {theme === 'dark' ? (
            <Sun className={styles.icon} />
          ) : (
            <Moon className={styles.icon} />
          )}
        </button>

        <button
          type="button"
          className={styles.languageToggle}
          onClick={handleToggleLanguage}
          aria-label={t('common.language')}
        >
          <Globe className={styles.globeIcon} />
          <span className={`${styles.langItem} ${language === 'zh-CN' ? styles.active : ''}`}>
            中
          </span>
          <span className={`${styles.langItem} ${language === 'en-US' ? styles.active : ''}`}>
            EN
          </span>
        </button>

        <div className={styles.avatar} role="button" tabIndex={0} aria-label="用户">
          <User className={styles.userIcon} />
        </div>
      </div>
    </header>
  );
};

export default Header;

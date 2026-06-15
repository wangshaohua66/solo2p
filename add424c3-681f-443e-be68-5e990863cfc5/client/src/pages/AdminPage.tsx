import { Users, Map, HardHat, Settings as SettingsIcon } from 'lucide-react';
import styles from './AdminPage.module.css';

export default function AdminPage() {
  const adminSections = [
    { title: '用户管理', description: '管理系统用户、角色和权限', icon: Users },
    { title: '路段管理', description: '管理道路信息和路段配置', icon: Map },
    { title: '施工队管理', description: '管理施工队信息和人员配置', icon: HardHat },
    { title: '系统设置', description: '配置系统参数和偏好设置', icon: SettingsIcon }
  ];

  return (
    <div className="page">
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>系统管理</h2>
      </div>
      <div className={styles.sectionGrid}>
        {adminSections.map((section, index) => (
          <div key={index} className={styles.adminCard}>
            <div className={styles.adminIcon}>
              <section.icon size={28} />
            </div>
            <h4 className={styles.adminTitle}>{section.title}</h4>
            <p className={styles.adminDesc}>{section.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

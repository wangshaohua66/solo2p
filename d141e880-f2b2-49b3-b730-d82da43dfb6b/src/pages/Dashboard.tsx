import React from 'react';
import { Layout } from 'antd';
import SiteDashboard from '@/components/SiteDashboard';
import { useNavigate } from 'react-router-dom';
import type { Site } from '@/types';

const { Content } = Layout;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const handleSiteSelect = (site: Site) => {
    navigate(`/workbench?siteId=${site.id}`);
  };

  return (
    <Layout className="min-h-screen">
      <Content className="p-6 bg-stone-50">
        <SiteDashboard onSiteSelect={handleSiteSelect} />
      </Content>
    </Layout>
  );
};

export default Dashboard;

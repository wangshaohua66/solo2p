import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <h2 className="not-found-title">页面未找到</h2>
        <p className="not-found-desc">您访问的页面不存在或已被移除。</p>
        <Link to="/patrol" className="btn btn-primary">
          <Home size={16} />
          返回首页
        </Link>
      </div>
    </div>
  );
}

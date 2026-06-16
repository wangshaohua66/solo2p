import { Link } from 'react-router-dom';
import { Home, Film } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sidebar via-sidebar to-[#181825]">
      <div className="flex flex-col items-center gap-6 p-8">
        <div className="relative">
          <div className="absolute -inset-4 bg-accent/20 rounded-full blur-3xl" />
          <Film className="w-24 h-24 text-accent relative" strokeWidth={1.5} />
        </div>
        <h1 className="text-6xl font-mono font-bold text-white tracking-tight">404</h1>
        <p className="text-sidebar-fg text-lg">页面不存在或项目已被删除</p>
        <Link
          to="/projects"
          className="btn-primary inline-flex items-center gap-2 mt-4"
        >
          <Home size={18} />
          返回项目列表
        </Link>
      </div>
    </div>
  );
};

export default NotFound;

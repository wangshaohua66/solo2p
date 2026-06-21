import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Home } from 'lucide-react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/plan');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dispatch-50 via-white to-slate-50 p-6">
      <div className="w-full max-w-lg text-center">
        <div className="mb-8">
          <h1 className="text-[140px] md:text-[180px] font-black leading-none mb-2 bg-gradient-to-br from-dispatch-500 via-dispatch-600 to-dispatch-800 bg-clip-text text-transparent">
            404
          </h1>
        </div>

        <Result
          status="404"
          title={
            <span className="text-2xl font-bold text-slate-800">
              您访问的页面不存在
            </span>
          }
          subTitle={
            <span className="text-base text-slate-500">
              抱歉，您请求的页面已被移除、名称已更改或暂时不可用。
            </span>
          }
          icon={null}
          extra={[
            <Button
              key="home"
              type="primary"
              size="large"
              icon={<Home size={18} />}
              onClick={handleGoHome}
              className="!px-8 !h-11 !rounded-lg !text-base"
            >
              返回首页
            </Button>,
          ]}
          className="!p-0"
        />

        <div className="mt-8 pt-8 border-t border-dashed border-slate-200">
          <p className="text-sm text-slate-400 mb-3">您可以尝试：</p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-dispatch-600 transition-colors"
            >
              返回上一页
            </button>
            <span className="w-px h-4 bg-slate-200" />
            <button
              onClick={handleGoHome}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-dispatch-600 transition-colors"
            >
              回到首页
            </button>
            <span className="w-px h-4 bg-slate-200" />
            <button
              onClick={() => navigate('/history')}
              className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-dispatch-600 transition-colors"
            >
              历史查询
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

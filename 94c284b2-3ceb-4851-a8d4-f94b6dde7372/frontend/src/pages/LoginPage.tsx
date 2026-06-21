import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAppStore();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ok = await login(username, password);
      if (ok) navigate('/', { replace: true });
      else setError('用户名或密码错误');
    } catch {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-200 mb-4">
            <Brain className="w-9 h-9" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">精神卫生中心数字化管理系统</h1>
          <p className="text-sm text-gray-500">请登录以继续使用系统</p>
        </div>

        <form onSubmit={submit} className="card p-8 space-y-5">
          <div>
            <label className="label">用户名</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoFocus
            />
          </div>
          <div>
            <label className="label">密码</label>
            <div className="relative">
              <input
                className="input pr-10"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {error && <div className="text-sm text-danger-600 bg-danger-50 rounded px-3 py-2">{error}</div>}
          <button type="submit" className="btn-primary w-full h-11" disabled={loading || !username || !password}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {loading ? '登录中...' : '登 录'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            测试账号：admin / 123456
          </p>
        </form>
      </div>
    </div>
  );
}

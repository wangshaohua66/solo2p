import { useState, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  onClick?: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  loadingText?: string;
}

export default function LoadingButton({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
  loadingText,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      if (onClick) await onClick();
    } finally {
      setLoading(false);
    }
  };

  const variantClass =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
      ? 'btn-danger'
      : 'btn-secondary';

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={loading || disabled}
      className={`${variantClass} ${className}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
          {loadingText || '处理中...'}
        </>
      ) : (
        children
      )}
    </button>
  );
}

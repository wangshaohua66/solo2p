import { useRef, useState, useEffect } from 'react';
import { Pen, Check, X, RotateCcw } from 'lucide-react';

interface Props {
  onConfirm?: (dataUrl: string) => void;
  onCancel?: () => void;
  title?: string;
}

export default function SignaturePad({ onConfirm, onCancel, title = '电子签名确认' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1E6FD9';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const end = () => {
    setDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const confirm = () => {
    if (!hasSignature) return;
    const dataUrl = canvasRef.current?.toDataURL('image/png') || '';
    onConfirm?.(dataUrl);
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-slide-up">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-primary-50">
        <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Pen className="w-5 h-5 text-primary-600" />
          {title}
        </h3>
        <button onClick={onCancel} className="btn-ghost p-1">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4">
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50">
          <canvas
            ref={canvasRef}
            width={500}
            height={200}
            className="w-full touch-none cursor-crosshair"
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
          {!hasSignature && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300 text-sm">
              请在上方区域签名
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <Pen className="w-3.5 h-3.5" />
          签名后将绑定到当前操作记录，不可篡改
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50">
        <button onClick={clear} className="btn-secondary text-sm">
          <RotateCcw className="w-4 h-4 mr-1" />
          清除
        </button>
        <button onClick={confirm} disabled={!hasSignature} className="btn-primary text-sm">
          <Check className="w-4 h-4 mr-1" />
          确认签名
        </button>
      </div>
    </div>
  );
}

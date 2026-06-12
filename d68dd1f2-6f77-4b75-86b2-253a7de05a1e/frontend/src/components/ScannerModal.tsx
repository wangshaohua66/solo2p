import React, { useEffect, useRef, useState } from 'react';
import { Modal, message, Button, Space, Alert } from 'antd';
import { CloseOutlined, CameraOutlined, ReloadOutlined } from '@ant-design/icons';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

interface ScannerModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (result: string) => void;
}

const ScannerModal: React.FC<ScannerModalProps> = ({ open, onCancel, onSuccess }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      startScanning();
    } else {
      stopScanning();
    }
    return () => stopScanning();
  }, [open]);

  const startScanning = async () => {
    setError(null);
    setScanning(true);

    try {
      if (!codeReaderRef.current) {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODABAR,
          BarcodeFormat.ITF,
          BarcodeFormat.DATA_MATRIX
        ]);
        codeReaderRef.current = new BrowserMultiFormatReader(hints);
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const result = await codeReaderRef.current.decodeFromConstraints(
        constraints,
        videoRef.current!,
        (result, err) => {
          if (result) {
            onSuccess(result.getText());
          }
        }
      );
    } catch (err: any) {
      console.error('Scanner error:', err);
      setError('无法访问摄像头，请检查权限设置。您也可以手动输入序列号。');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    try {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    } catch (e) {
      // ignore
    }
    setScanning(false);
  };

  const handleRetry = () => {
    stopScanning();
    setTimeout(startScanning, 500);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={
        <Space>
          {error && (
            <Button icon={<ReloadOutlined />} onClick={handleRetry}>
              重试
            </Button>
          )}
          <Button onClick={onCancel} icon={<CloseOutlined />}>
            关闭
          </Button>
        </Space>
      }
      width={520}
      centered
      closable={!scanning}
      title={
        <Space>
          <CameraOutlined />
          条码/二维码扫描
        </Space>
      }
      destroyOnClose
    >
      {error ? (
        <Alert type="error" showIcon message="摄像头访问失败" description={error} />
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '4 / 3',
            background: '#000',
            borderRadius: 8,
            overflow: 'hidden'
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '15%',
              left: '15%',
              right: '15%',
              bottom: '15%',
              border: '2px solid #1677ff',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              borderRadius: 8
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: '#52c41a',
                boxShadow: '0 0 8px #52c41a',
                animation: 'scan 2s ease-in-out infinite'
              }}
            />
          </div>
          <style>{`
            @keyframes scan {
              0%, 100% { top: 0; }
              50% { top: calc(100% - 2px); }
            }
          `}</style>
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 0,
              right: 0,
              textAlign: 'center',
              color: '#fff',
              fontSize: 13,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
            }}
          >
            {scanning ? '对准条码进行扫描...' : '正在初始化...'}
          </div>
        </div>
      )}

      <Alert
        type="info"
        showIcon
        style={{ marginTop: 16 }}
        message="支持的条码类型"
        description="二维码 (QR Code)、条形码 (EAN-13/8, Code 128, Code 39, UPC 等)、Data Matrix"
      />
    </Modal>
  );
};

export default ScannerModal;

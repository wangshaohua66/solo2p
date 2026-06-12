import dayjs from 'dayjs';
import type { WorkOrderStatus, Movement } from '@/types';

export const generateOrderNumber = (): string => {
  const now = dayjs();
  const date = now.format('YYYYMMDD');
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `WO${date}${random}`;
};

export const formatCurrency = (amount: number, currency: string = 'CNY'): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (date: string | Date, format: string = 'YYYY-MM-DD HH:mm'): string => {
  return dayjs(date).format(format);
};

export const daysBetween = (from: string | Date, to: string | Date): number => {
  return Math.abs(dayjs(to).diff(dayjs(from), 'day'));
};

export const validateInspection = (
  data: any,
  movement?: Movement
): { field: string; abnormal: boolean; actual: string; standard: string }[] => {
  const results: any[] = [];

  if (!movement) return results;

  if (data.amplitude && movement.standardAmplitude) {
    const actual = parseFloat(data.amplitude);
    const [min, max] = movement.standardAmplitude.split('-').map(Number);
    if (actual < min || actual > max) {
      results.push({
        field: '振幅',
        abnormal: true,
        actual: data.amplitude + '°',
        standard: movement.standardAmplitude + '°'
      });
    }
  }

  if (data.rate && movement.standardRate) {
    const actual = parseFloat(data.rate);
    const [min, max] = movement.standardRate.split('-').map(Number);
    if (actual < min || actual > max) {
      results.push({
        field: '日差',
        abnormal: true,
        actual: data.rate + 's/d',
        standard: movement.standardRate + 's/d'
      });
    }
  }

  if (data.powerReserve && movement.powerReserveHours) {
    const actual = parseFloat(data.powerReserve);
    const standard = movement.powerReserveHours;
    if (actual < standard * 0.8) {
      results.push({
        field: '动力储存',
        abnormal: true,
        actual: data.powerReserve + 'h',
        standard: standard + 'h'
      });
    }
  }

  return results;
};

export const compressImage = async (
  file: File,
  options: { maxSizeMB?: number; maxWidthOrHeight?: number; quality?: number } = {}
): Promise<File> => {
  const {
    maxSizeMB = 3,
    maxWidthOrHeight = 1920,
    quality = 0.8
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
        if (width > height) {
          height = (height / width) * maxWidthOrHeight;
          width = maxWidthOrHeight;
        } else {
          width = (width / height) * maxWidthOrHeight;
          height = maxWidthOrHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          if (blob.size > maxSizeMB * 1024 * 1024) {
            canvas.toBlob(
              (lowerBlob) => {
                if (!lowerBlob) {
                  resolve(file);
                  return;
                }
                const compressedFile = new File(
                  [lowerBlob],
                  file.name.replace(/\.[^.]+$/, '.webp'),
                  { type: 'image/webp' }
                );
                resolve(compressedFile);
              },
              'image/webp',
              0.6
            );
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.webp'),
            { type: 'image/webp' }
          );
          resolve(compressedFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
};

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

export const statusTransitionAllowed = (
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  role: string = 'admin'
): { allowed: boolean; reason?: string } => {
  const rolePermissions: Record<string, WorkOrderStatus[]> = {
    reception: ['draft', 'pending_quote', 'quoted'],
    technician: ['pending_quote', 'quoted', 'in_repair', 'pending_qa'],
    manager: ['draft', 'pending_quote', 'quoted', 'in_repair', 'pending_qa', 'ready_for_pickup', 'delivered'],
    admin: ['draft', 'pending_quote', 'quoted', 'in_repair', 'pending_qa', 'ready_for_pickup', 'delivered', 'warranty', 'archived']
  };

  const stateRequiresRole: Partial<Record<WorkOrderStatus, string[]>> = {
    draft: ['reception', 'manager', 'admin'],
    pending_quote: ['reception', 'technician', 'manager', 'admin'],
    quoted: ['reception', 'technician', 'manager', 'admin'],
    in_repair: ['technician', 'manager', 'admin'],
    pending_qa: ['technician', 'manager', 'admin'],
    ready_for_pickup: ['manager', 'admin'],
    delivered: ['manager', 'admin'],
    warranty: ['manager', 'admin'],
    archived: ['admin']
  };

  const transitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
    draft: ['pending_quote'],
    pending_quote: ['draft', 'quoted'],
    quoted: ['pending_quote', 'in_repair'],
    in_repair: ['quoted', 'pending_qa'],
    pending_qa: ['in_repair', 'ready_for_pickup'],
    ready_for_pickup: ['pending_qa', 'delivered'],
    delivered: ['ready_for_pickup', 'warranty'],
    warranty: ['delivered', 'archived'],
    archived: ['warranty']
  };

  if (role === 'admin') {
    return { allowed: true };
  }

  const allowedStates = rolePermissions[role] || [];
  if (!allowedStates.includes(from) || !allowedStates.includes(to)) {
    return { allowed: false, reason: `当前角色 [${role}] 无权操作 ${from} → ${to} 状态流转` };
  }

  const requiredRoles = stateRequiresRole[to];
  if (requiredRoles && !requiredRoles.includes(role)) {
    return { allowed: false, reason: `进入 [${to}] 状态需要 ${requiredRoles.join('/')} 角色权限` };
  }

  const allowed = transitions[from] || [];
  if (!allowed.includes(to)) {
    return { allowed: false, reason: `不允许从 ${from} 直接跳转到 ${to}` };
  }

  return { allowed: true };
};

import React, { useState, useEffect, useCallback } from 'react';
import { Tag, Button, Space, Tooltip, Badge } from 'antd';
import { BellOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useCommandStore } from '@/store/commandStore';
import { NOTIFICATION_CHANNEL_MAP, NOTIFICATION_STATUS_MAP, NOTIFICATION_STATUS_COLOR, INCIDENT_LEVEL_COLOR } from '@/constants/dictionary';
import { confirmReceipt } from '@/api/notification';
import { Notification as NotificationType } from '@/types';
import dayjs from 'dayjs';

const NotificationToast: React.FC = () => {
  const { notifications, addNotification } = useCommandStore();
  const [visibleNotifications, setVisibleNotifications] = useState<NotificationType[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const recent = notifications
      .filter((n) => !dismissedIds.has(n.id) && n.status !== 4)
      .slice(0, 5);
    setVisibleNotifications(recent);
  }, [notifications, dismissedIds]);

  const handleDismiss = useCallback((id: number) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  }, []);

  const handleConfirm = useCallback(
    async (receiptId: number) => {
      try {
        await confirmReceipt(receiptId);
        addNotification({
          ...notifications[0],
          readCount: (notifications[0]?.readCount || 0) + 1,
        } as NotificationType);
      } catch (error) {
        console.error('Failed to confirm receipt:', error);
      }
    },
    [notifications, addNotification]
  );

  const getNotificationColor = (notification: NotificationType) => {
    if (notification.priority === 1) return '#ff4d4f';
    if (notification.priority === 2) return '#fa8c16';
    if (notification.incidentLevel && notification.incidentLevel <= 2) {
      return INCIDENT_LEVEL_COLOR[notification.incidentLevel];
    }
    return '#1890ff';
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="notification-toast">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className="notification-item"
          style={{ borderLeftColor: getNotificationColor(notification) }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge
                status="processing"
                color={getNotificationColor(notification)}
                dot={notification.priority <= 2}
              >
                <BellOutlined style={{ color: getNotificationColor(notification) }} />
              </Badge>
              <span style={{ fontWeight: 500, color: '#fff' }}>{notification.title}</span>
            </div>
            <Space size="small">
              {notification.status !== 4 && (
                <Tooltip title="标记已读">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={() => handleConfirm(notification.id)}
                    style={{ color: '#52c41a', padding: 0, width: 24, height: 24 }}
                  />
                </Tooltip>
              )}
              <Tooltip title="关闭">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleDismiss(notification.id)}
                  style={{ color: 'rgba(255,255,255,0.45)', padding: 0, width: 24, height: 24 }}
                />
              </Tooltip>
            </Space>
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.75)',
              marginBottom: 8,
              lineHeight: 1.5,
            }}
          >
            {notification.summary || notification.content}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 11,
            }}
          >
            <Space size="small">
              <Tag color={NOTIFICATION_STATUS_COLOR[notification.status]} style={{ margin: 0, fontSize: 10 }}>
                {NOTIFICATION_STATUS_MAP[notification.status]}
              </Tag>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                {NOTIFICATION_CHANNEL_MAP[notification.channel]}
              </span>
              {notification.targetCount > 0 && (
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {notification.successCount}/{notification.targetCount}人已送达
                </span>
              )}
            </Space>
            <span style={{ color: 'rgba(255,255,255,0.45)' }}>
              {dayjs(notification.createdAt).format('HH:mm:ss')}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationToast;

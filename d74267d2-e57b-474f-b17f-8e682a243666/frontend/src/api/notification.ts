import request from '@/utils/request';
import { Notification, NotificationSendRequest, PageResult } from '@/types';

export const sendNotification = (data: NotificationSendRequest): Promise<number> => {
  return request.post('/notification/notifications/send', data);
};

export const sendIncidentAlert = (incidentId: number): Promise<number> => {
  return request.post('/notification/notifications/send-incident-alert', { incidentId });
};

export const broadcastNotification = (title: string, content: string, regionCode?: string, incidentLevel?: number): Promise<number[]> => {
  return request.post('/notification/notifications/broadcast', { title, content, regionCode, incidentLevel });
};

export const getNotificationList = (params: any): Promise<PageResult<Notification>> => {
  return request.get('/notification/notifications', { params });
};

export const getNotificationDetail = (id: number): Promise<Notification> => {
  return request.get(`/notification/notifications/${id}`);
};

export const getMyNotifications = (pageNum = 1, pageSize = 10): Promise<Notification[]> => {
  return request.get('/notification/notifications/my', { params: { pageNum, pageSize } });
};

export const getNotificationReceipts = (notificationId: number): Promise<any[]> => {
  return request.get(`/notification/notifications/${notificationId}/receipts`);
};

export const confirmReceipt = (receiptId: number): Promise<boolean> => {
  return request.post(`/notification/notifications/receipts/${receiptId}/confirm`);
};

export const getNotificationsByIncident = (incidentId: number): Promise<Notification[]> => {
  return request.get(`/notification/notifications/incident/${incidentId}`);
};

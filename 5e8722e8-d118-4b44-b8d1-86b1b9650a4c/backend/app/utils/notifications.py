import json
from app import redis_client


class NotificationService:
    QUEUE_KEY = 'appointment:notifications'
    REMINDER_KEY = 'appointment:reminders'

    @classmethod
    def push_notification(cls, notification_type, data):
        notification = {
            'type': notification_type,
            'data': data,
        }
        redis_client.lpush(cls.QUEUE_KEY, json.dumps(notification))
        return True

    @classmethod
    def pop_notification(cls):
        result = redis_client.rpop(cls.QUEUE_KEY)
        if result:
            return json.loads(result)
        return None

    @classmethod
    def schedule_reminder(cls, appointment_id, remind_time, message):
        reminder = {
            'appointment_id': appointment_id,
            'message': message,
            'remind_time': remind_time.isoformat() if hasattr(remind_time, 'isoformat') else str(remind_time),
        }
        redis_client.zadd(cls.REMINDER_KEY, {json.dumps(reminder): remind_time.timestamp() if hasattr(remind_time, 'timestamp') else 0})
        return True

    @classmethod
    def get_due_reminders(cls, current_time):
        timestamp = current_time.timestamp() if hasattr(current_time, 'timestamp') else 0
        reminders = redis_client.zrangebyscore(cls.REMINDER_KEY, 0, timestamp)
        result = []
        for r in reminders:
            try:
                result.append(json.loads(r))
            except (json.JSONDecodeError, TypeError):
                pass
        return result

    @classmethod
    def remove_reminder(cls, reminder):
        redis_client.zrem(cls.REMINDER_KEY, json.dumps(reminder))


def send_sms(phone, message):
    print(f'[SMS] Sending to {phone}: {message}')
    return True


def send_in_app_message(user_id, message):
    key = f'messages:user:{user_id}'
    msg = {
        'message': message,
        'read': False,
    }
    redis_client.lpush(key, json.dumps(msg))
    return True

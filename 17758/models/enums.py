from enum import Enum


class ContactStatus(str, Enum):
    POTENTIAL = "potential"
    IN_COMMUNICATION = "in_communication"
    CLOSED = "closed"
    LOST = "lost"


class Priority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class CommunicationChannel(str, Enum):
    EMAIL = "email"
    PHONE = "phone"
    MEETING = "meeting"
    WECHAT = "wechat"
    OTHER = "other"


class ReminderStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    OVERDUE = "overdue"

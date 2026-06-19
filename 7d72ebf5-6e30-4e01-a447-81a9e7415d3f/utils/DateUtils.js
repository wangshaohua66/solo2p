const DateUtils = {
  format(date, pattern = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const pad = (n) => n.toString().padStart(2, '0');

    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekDay = weekDays[d.getDay()];

    return pattern
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('WW', weekDay);
  },

  formatDate(date) {
    return this.format(date, 'YYYY-MM-DD');
  },

  formatTime(date) {
    return this.format(date, 'HH:mm');
  },

  formatDateTime(date) {
    return this.format(date, 'YYYY-MM-DD HH:mm');
  },

  formatRelative(date) {
    const now = Date.now();
    const d = new Date(date).getTime();
    const diff = now - d;

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)}小时前`;
    if (diff < 7 * day) return `${Math.floor(diff / day)}天前`;
    return this.formatDate(date);
  },

  getToday() {
    return this.formatDate(new Date());
  },

  getTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return this.formatDate(d);
  },

  getDateRange(days = 7) {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(this.formatDate(d));
    }
    return dates;
  },

  getTimeSlots(start = '09:00', end = '17:00', interval = 30) {
    const slots = [];
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let current = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    while (current < endMinutes) {
      const h = Math.floor(current / 60);
      const m = current % 60;
      const next = current + interval;
      const nh = Math.floor(next / 60);
      const nm = next % 60;
      slots.push({
        start: `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`,
        end: `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`,
        available: Math.random() > 0.3
      });
      current = next;
    }
    return slots;
  },

  formatWaitTime(minutes) {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  },

  isToday(date) {
    return this.formatDate(date) === this.getToday();
  },

  addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }
};

window.DateUtils = DateUtils;

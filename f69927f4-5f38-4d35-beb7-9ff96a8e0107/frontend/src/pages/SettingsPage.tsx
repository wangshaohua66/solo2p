import { useState } from 'react';
import { Card, Form, Input, Switch, Slider, Select, Button, Divider, message } from 'antd';
import { Save, Building2, Bell, Shield, Flame } from 'lucide-react';
import { mockKilns } from '@/mocks';

const PRIMARY = '#E8602C';

const SECTION_ICON_STYLE = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 };

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);

  const [basicSettings, setBasicSettings] = useState({
    studioName: '琉璃工坊',
    contactEmail: 'info@glassstudio.com',
    phone: '021-8888-9999',
  });

  const [notifications, setNotifications] = useState({
    temperatureAlert: true,
    scheduleReminder: true,
    materialArrival: false,
    maintenanceDue: true,
  });

  const [security, setSecurity] = useState({
    sessionTimeout: 120,
    passwordPolicy: 'standard' as 'simple' | 'standard' | 'strong',
  });

  const [kilnParams, setKilnParams] = useState<Record<number, { maxTemp: number; coolingThreshold: number; maintenanceInterval: number }>>(
    Object.fromEntries(
      mockKilns.map((k) => [
        k.id,
        {
          maxTemp: k.type === 'ANNEALING' ? 600 : k.type === 'EXPERIMENTAL' ? 1200 : 1100,
          coolingThreshold: k.type === 'ANNEALING' ? 370 : 460,
          maintenanceInterval: 90,
        },
      ]),
    ),
  );

  const handleSave = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('设置已保存');
    }, 800);
  };

  const timeoutMarks = {
    30: '30分钟',
    60: '1小时',
    120: '2小时',
    180: '3小时',
    240: '4小时',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>
      <Card>
        <div style={SECTION_ICON_STYLE}>
          <Building2 size={20} color={PRIMARY} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>基础设置</span>
        </div>
        <Form layout="vertical">
          <Form.Item label="工作室名称">
            <Input
              value={basicSettings.studioName}
              onChange={(e) => setBasicSettings({ ...basicSettings, studioName: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="联系邮箱">
            <Input
              value={basicSettings.contactEmail}
              onChange={(e) => setBasicSettings({ ...basicSettings, contactEmail: e.target.value })}
            />
          </Form.Item>
          <Form.Item label="联系电话">
            <Input
              value={basicSettings.phone}
              onChange={(e) => setBasicSettings({ ...basicSettings, phone: e.target.value })}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <div style={SECTION_ICON_STYLE}>
          <Bell size={20} color={PRIMARY} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>通知设置</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>温度告警通知</span>
            <Switch
              checked={notifications.temperatureAlert}
              onChange={(v) => setNotifications({ ...notifications, temperatureAlert: v })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>排程提醒通知</span>
            <Switch
              checked={notifications.scheduleReminder}
              onChange={(v) => setNotifications({ ...notifications, scheduleReminder: v })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>原料到货通知</span>
            <Switch
              checked={notifications.materialArrival}
              onChange={(v) => setNotifications({ ...notifications, materialArrival: v })}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>维护到期通知</span>
            <Switch
              checked={notifications.maintenanceDue}
              onChange={(v) => setNotifications({ ...notifications, maintenanceDue: v })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div style={SECTION_ICON_STYLE}>
          <Shield size={20} color={PRIMARY} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>安全设置</span>
        </div>
        <Form layout="vertical">
          <Form.Item label={`会话超时时间: ${security.sessionTimeout} 分钟`}>
            <Slider
              min={30}
              max={240}
              step={10}
              marks={timeoutMarks}
              value={security.sessionTimeout}
              onChange={(v: number) => setSecurity({ ...security, sessionTimeout: v })}
            />
          </Form.Item>
          <Form.Item label="密码策略">
            <Select
              value={security.passwordPolicy}
              onChange={(v) => setSecurity({ ...security, passwordPolicy: v })}
              options={[
                { label: '简单 (6位以上)', value: 'simple' },
                { label: '标准 (8位+数字+字母)', value: 'standard' },
                { label: '强 (10位+数字+字母+特殊字符)', value: 'strong' },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <div style={SECTION_ICON_STYLE}>
          <Flame size={20} color={PRIMARY} />
          <span style={{ fontSize: 16, fontWeight: 600 }}>窑炉参数</span>
        </div>
        {mockKilns.map((kiln, idx) => (
          <div key={kiln.id}>
            {idx > 0 && <Divider />}
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{kiln.name}</div>
            <Form layout="vertical">
              <Form.Item label="最高温度 (°C)">
                <Input
                  type="number"
                  value={kilnParams[kiln.id]?.maxTemp}
                  onChange={(e) =>
                    setKilnParams({
                      ...kilnParams,
                      [kiln.id]: { ...kilnParams[kiln.id], maxTemp: Number(e.target.value) },
                    })
                  }
                />
              </Form.Item>
              <Form.Item label="冷却阈值 (°C)">
                <Input
                  type="number"
                  value={kilnParams[kiln.id]?.coolingThreshold}
                  onChange={(e) =>
                    setKilnParams({
                      ...kilnParams,
                      [kiln.id]: { ...kilnParams[kiln.id], coolingThreshold: Number(e.target.value) },
                    })
                  }
                />
              </Form.Item>
              <Form.Item label="维护间隔 (天)">
                <Input
                  type="number"
                  value={kilnParams[kiln.id]?.maintenanceInterval}
                  onChange={(e) =>
                    setKilnParams({
                      ...kilnParams,
                      [kiln.id]: { ...kilnParams[kiln.id], maintenanceInterval: Number(e.target.value) },
                    })
                  }
                />
              </Form.Item>
            </Form>
          </div>
        ))}
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          size="large"
          icon={<Save size={16} />}
          loading={loading}
          onClick={handleSave}
          style={{ background: PRIMARY, borderColor: PRIMARY, minWidth: 140 }}
        >
          保存设置
        </Button>
      </div>
    </div>
  );
}

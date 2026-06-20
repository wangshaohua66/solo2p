import { useState, useEffect } from 'react';
import { Card, Button, Space, Select, Modal, Form, Input, InputNumber, message, Row, Col } from 'antd';
import { ReloadOutlined, PlusOutlined, SettingOutlined, EnvironmentOutlined } from '@ant-design/icons';
import BoothMap from '../components/BoothMap';
import { generateMockBooths, generateMockVenues } from '../utils/mockData';
import type { Booth, Venue, HeatmapData } from '../types';

const { Option } = Select;

const BoothPage: React.FC = () => {
  const [booths, setBooths] = useState<Booth[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>('venue-1');
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocateModalVisible, setAllocateModalVisible] = useState(false);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [selectedBooth, setSelectedBooth] = useState<Booth | null>(null);
  const [form] = Form.useForm();
  const [priceForm] = Form.useForm();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      const mockVenues = generateMockVenues();
      setVenues(mockVenues);
      const mockBooths = generateMockBooths(selectedVenue, 50);
      setBooths(mockBooths);
      const mockHeatmap: HeatmapData[] = mockBooths.map(b => ({
        boothId: b.id,
        visitorCount: Math.floor(Math.random() * 5000),
        avgStayTime: Math.floor(Math.random() * 30) + 5,
        peakHour: `${Math.floor(Math.random() * 8) + 9}:00`,
      }));
      setHeatmapData(mockHeatmap);
      setLoading(false);
    };
    fetchData();
  }, [selectedVenue]);

  const handleVenueChange = (venueId: string) => {
    setSelectedVenue(venueId);
  };

  const handleBoothClick = (booth: Booth) => {
    setSelectedBooth(booth);
  };

  const handleBoothAllocate = (booth: Booth) => {
    setSelectedBooth(booth);
    form.setFieldsValue({
      boothNo: booth.boothNo,
      exhibitorName: '',
      price: booth.basePrice,
    });
    setAllocateModalVisible(true);
  };

  const handleAllocateSubmit = async (values: any) => {
    try {
      setBooths(prev => prev.map(b => 
        b.id === selectedBooth?.id 
          ? { ...b, status: 'sold' as const, exhibitorName: values.exhibitorName, customPrice: values.price }
          : b
      ));
      message.success(`展位 ${selectedBooth?.boothNo} 已分配给 ${values.exhibitorName}`);
      setAllocateModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('分配失败');
    }
  };

  const handlePriceConfig = () => {
    priceForm.setFieldsValue({
      zone: 'A',
      basePrice: 10000,
      premiumRate: 1.2,
    });
    setPriceModalVisible(true);
  };

  const handlePriceSubmit = async (values: any) => {
    try {
      setBooths(prev => prev.map(b => 
        b.zone === values.zone
          ? { ...b, basePrice: Math.round(values.basePrice * (values.premiumRate || 1)) }
          : b
      ));
      message.success(`${values.zone}区价格策略已更新`);
      setPriceModalVisible(false);
      priceForm.resetFields();
    } catch (error) {
      message.error('配置失败');
    }
  };

  const currentVenue = venues.find(v => v.id === selectedVenue);

  return (
    <div className="space-y-6">
      <Card
        title={
          <Space>
            <EnvironmentOutlined className="text-blue-500" />
            展位分布管理
          </Space>
        }
        extra={
          <Space wrap>
            <Select
              value={selectedVenue}
              onChange={handleVenueChange}
              style={{ width: 180 }}
            >
              {venues.filter(v => v.type === 'exhibition_hall').map(v => (
                <Option key={v.id} value={v.id}>
                  {v.name} ({v.area}㎡)
                </Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />}>刷新</Button>
            <Button icon={<SettingOutlined />} onClick={handlePriceConfig}>价格策略</Button>
            <Button type="primary" icon={<PlusOutlined />}>新增展位</Button>
          </Space>
        }
      >
        <BoothMap
          booths={booths}
          venue={currentVenue}
          heatmapData={heatmapData}
          loading={loading}
          onBoothClick={handleBoothClick}
          onBoothAllocate={handleBoothAllocate}
        />
      </Card>

      <Modal
        title="分配展位"
        open={allocateModalVisible}
        onCancel={() => setAllocateModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleAllocateSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="boothNo" label="展位编号">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="price"
                label="成交价格"
                rules={[{ required: true, message: '请输入成交价格' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  prefix="¥"
                  min={0}
                  precision={2}
                  placeholder="请输入成交价格"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="exhibitorName"
            label="参展商名称"
            rules={[{ required: true, message: '请输入参展商名称' }]}
          >
            <Input placeholder="请输入参展商名称" />
          </Form.Item>
          <Form.Item
            name="exhibitorContact"
            label="联系人"
            rules={[{ required: true, message: '请输入联系人' }]}
          >
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>
          <Form.Item
            name="exhibitorPhone"
            label="联系电话"
            rules={[{ required: true, message: '请输入联系电话' }]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setAllocateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认分配</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="展位定价策略配置"
        open={priceModalVisible}
        onCancel={() => setPriceModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={priceForm} layout="vertical" onFinish={handlePriceSubmit}>
          <Form.Item
            name="zone"
            label="选择区域"
            rules={[{ required: true, message: '请选择区域' }]}
          >
            <Select placeholder="请选择要配置的区域">
              <Option value="A">A区（黄金位置）</Option>
              <Option value="B">B区（优质位置）</Option>
              <Option value="C">C区（标准位置）</Option>
              <Option value="D">D区（普通位置）</Option>
              <Option value="E">E区（偏远位置）</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="basePrice"
            label="基础价格 (元/9㎡)"
            rules={[{ required: true, message: '请输入基础价格' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              prefix="¥"
              min={0}
              placeholder="请输入基础价格"
            />
          </Form.Item>
          <Form.Item
            name="premiumRate"
            label="位置溢价系数"
            rules={[{ required: true, message: '请输入溢价系数' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0.5}
              max={3}
              step={0.1}
              placeholder="例如：1.2 表示溢价20%"
            />
          </Form.Item>
          <Form.Item
            name="description"
            label="策略说明"
          >
            <Input.TextArea rows={3} placeholder="请输入定价策略说明（可选）" />
          </Form.Item>
          <Form.Item className="!mb-0">
            <Space className="w-full justify-end">
              <Button onClick={() => setPriceModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">保存配置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BoothPage;

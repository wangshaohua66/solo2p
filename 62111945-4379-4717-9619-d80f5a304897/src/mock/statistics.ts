import { StatisticsData } from '@/types'

export const mockGetStatistics = (): Promise<StatisticsData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data: StatisticsData = {
        totalEnterprises: 2000,
        totalJobs: 15680,
        totalJobseekers: 50000,
        totalRecruitments: 180,
        monthlyData: [
          { month: '1月', count: 1200 },
          { month: '2月', count: 1800 },
          { month: '3月', count: 3200 },
          { month: '4月', count: 2800 },
          { month: '5月', count: 2400 },
          { month: '6月', count: 3600 },
          { month: '7月', count: 4200 },
          { month: '8月', count: 3800 },
          { month: '9月', count: 3100 },
          { month: '10月', count: 2700 },
          { month: '11月', count: 2300 },
          { month: '12月', count: 1900 }
        ],
        industryDistribution: [
          { name: '互联网', value: 3500 },
          { name: '金融', value: 2200 },
          { name: '制造业', value: 2800 },
          { name: '教育', value: 1800 },
          { name: '医疗健康', value: 2000 },
          { name: '房地产', value: 1200 },
          { name: '零售', value: 1500 },
          { name: '物流', value: 1000 }
        ],
        salaryDistribution: [
          { name: '5k以下', value: 5000 },
          { name: '5k-10k', value: 18000 },
          { name: '10k-15k', value: 15000 },
          { name: '15k-20k', value: 7000 },
          { name: '20k-30k', value: 3500 },
          { name: '30k以上', value: 1500 }
        ],
        centerData: [
          { name: '东城区', recruitmentCount: 28, jobCount: 2200, attendeeCount: 8500 },
          { name: '西城区', recruitmentCount: 22, jobCount: 1800, attendeeCount: 6800 },
          { name: '朝阳区', recruitmentCount: 32, jobCount: 3500, attendeeCount: 12000 },
          { name: '海淀区', recruitmentCount: 35, jobCount: 4200, attendeeCount: 15000 },
          { name: '丰台区', recruitmentCount: 18, jobCount: 1200, attendeeCount: 4500 },
          { name: '石景山区', recruitmentCount: 15, jobCount: 900, attendeeCount: 3200 },
          { name: '通州区', recruitmentCount: 16, jobCount: 1100, attendeeCount: 4000 },
          { name: '顺义区', recruitmentCount: 14, jobCount: 780, attendeeCount: 3000 }
        ]
      }
      resolve(data)
    }, 500)
  })
}

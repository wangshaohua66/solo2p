package service

import (
	"gas-network-system/internal/alarm"
	"time"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

type CronScheduler struct {
	cron        *cron.Cron
	scheduler   *SchedulerService
	dispatch    *DispatchService
	hazard      *HazardService
	assessment  *AssessmentService
	alarmEngine *alarm.AlarmEngine
	logger      *zap.Logger
}

func NewCronScheduler(
	scheduler *SchedulerService,
	dispatch *DispatchService,
	hazard *HazardService,
	assessment *AssessmentService,
	alarmEngine *alarm.AlarmEngine,
	logger *zap.Logger,
) *CronScheduler {
	return &CronScheduler{
		cron:        cron.New(cron.WithLocation(time.Local)),
		scheduler:   scheduler,
		dispatch:    dispatch,
		hazard:      hazard,
		assessment:  assessment,
		alarmEngine: alarmEngine,
		logger:      logger,
	}
}

func (cs *CronScheduler) Start() error {
	if _, err := cs.cron.AddFunc("0 6 * * *", cs.dailyPlanJob); err != nil {
		return err
	}

	if _, err := cs.cron.AddFunc("0 2 * * *", cs.archiveJob); err != nil {
		return err
	}

	if _, err := cs.cron.AddFunc("*/10 * * * *", cs.expiredTaskJob); err != nil {
		return err
	}

	if _, err := cs.cron.AddFunc("*/5 * * * *", cs.overdueAlarmJob); err != nil {
		return err
	}

	if _, err := cs.cron.AddFunc("0 4 * * *", cs.overdueHazardJob); err != nil {
		return err
	}

	if _, err := cs.cron.AddFunc("0 3 1 * *", cs.monthlyAssessmentJob); err != nil {
		return err
	}

	cs.cron.Start()
	cs.logger.Info("定时任务调度器已启动",
		zap.Strings("jobs", []string{
			"每日06:00 巡检计划生成",
			"每日02:00 压力数据归档",
			"每10分钟 超时任务检查",
			"每5分钟 超时告警检查",
			"每日04:00 超期隐患检查",
			"每月1日03:00 月度考核生成",
		}),
	)

	return nil
}

func (cs *CronScheduler) Stop() {
	ctx := cs.cron.Stop()
	<-ctx.Done()
	cs.logger.Info("定时任务调度器已停止")
}

func (cs *CronScheduler) dailyPlanJob() {
	cs.logger.Info("开始执行定时任务: 巡检计划生成")
	result, err := cs.scheduler.GenerateDailyPlans()
	if err != nil {
		cs.logger.Error("定时巡检计划生成失败", zap.Error(err))
		return
	}
	cs.logger.Info("定时巡检计划生成完成",
		zap.Int("generated", result.GeneratedTasks),
		zap.String("message", result.Message))
}

func (cs *CronScheduler) archiveJob() {
	cs.logger.Info("开始执行定时任务: 压力数据归档")
	count, err := cs.alarmEngine.ArchiveOldData()
	if err != nil {
		cs.logger.Error("定时压力数据归档失败", zap.Error(err))
		return
	}
	cs.logger.Info("定时压力数据归档完成",
		zap.Int64("archived_count", count))
}

func (cs *CronScheduler) expiredTaskJob() {
	tasks, err := cs.scheduler.CheckExpiredTasks()
	if err != nil {
		cs.logger.Error("定时超时任务检查失败", zap.Error(err))
		return
	}
	if len(tasks) > 0 {
		cs.logger.Info("定时超时任务检查完成",
			zap.Int("expired_count", len(tasks)))
	}
}

func (cs *CronScheduler) overdueAlarmJob() {
	alarms, err := cs.dispatch.CheckOverdueAlarms()
	if err != nil {
		cs.logger.Error("定时超时告警检查失败", zap.Error(err))
		return
	}
	if len(alarms) > 0 {
		cs.logger.Info("发现超时未调度告警",
			zap.Int("count", len(alarms)))
	}
}

func (cs *CronScheduler) overdueHazardJob() {
	hazards, err := cs.hazard.CheckOverdueHazards()
	if err != nil {
		cs.logger.Error("定时超期隐患检查失败", zap.Error(err))
		return
	}
	if len(hazards) > 0 {
		cs.logger.Info("发现超期重大隐患",
			zap.Int("count", len(hazards)))
	}
}

func (cs *CronScheduler) monthlyAssessmentJob() {
	cs.logger.Info("开始执行定时任务: 月度考核生成")
	now := time.Now()
	year := now.Year()
	month := int(now.Month()) - 1
	if month == 0 {
		year--
		month = 12
	}

	result, err := cs.assessment.GenerateMonthlyAssessment(GenerateAssessmentRequest{
		Year:  year,
		Month: month,
	})
	if err != nil {
		cs.logger.Error("定时月度考核生成失败", zap.Error(err))
		return
	}
	cs.logger.Info("定时月度考核生成完成",
		zap.Int("generated", result.Generated),
		zap.Int("skipped", result.Skipped),
		zap.String("message", result.Message))
}

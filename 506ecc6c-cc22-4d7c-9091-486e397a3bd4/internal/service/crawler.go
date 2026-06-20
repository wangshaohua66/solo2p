package service

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/store"
	"github.com/labelops/backend/internal/util"
	wspkg "github.com/labelops/backend/internal/ws"
)

type PlatformAdapter interface {
	Name() string
	FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error)
	BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error)
}

type WSNotifier interface {
	NotifyPiracy(p *model.PiracyRecord, work *model.Work) error
	NotifyCrawlProgress(p *wspkg.CrawlProgressPayload) error
	NotifyAlert(level, title, message string) error
}

type NetEaseAdapter struct {
	baseURL string
}

func (a *NetEaseAdapter) Name() string { return "netease" }
func (a *NetEaseAdapter) FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.02 {
		return nil, fmt.Errorf("netease: request timeout after 30s")
	}
	return simulateFetch(workID, model.PlatformNetEase, date, 0.008), nil
}
func (a *NetEaseAdapter) BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.03 {
		return nil, fmt.Errorf("netease: API rate limit exceeded, please retry later")
	}
	return simulateBatch(workIDs, model.PlatformNetEase, start, end, 0.008), nil
}

type QQMusicAdapter struct{}

func (a *QQMusicAdapter) Name() string { return "qqmusic" }
func (a *QQMusicAdapter) FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.02 {
		return nil, fmt.Errorf("qqmusic: service unavailable (503)")
	}
	return simulateFetch(workID, model.PlatformQQMusic, date, 0.007), nil
}
func (a *QQMusicAdapter) BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.03 {
		return nil, fmt.Errorf("qqmusic: invalid response format")
	}
	return simulateBatch(workIDs, model.PlatformQQMusic, start, end, 0.007), nil
}

type KugouAdapter struct{}

func (a *KugouAdapter) Name() string { return "kugou" }
func (a *KugouAdapter) FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.02 {
		return nil, fmt.Errorf("kugou: connection reset by peer")
	}
	return simulateFetch(workID, model.PlatformKugou, date, 0.006), nil
}
func (a *KugouAdapter) BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.03 {
		return nil, fmt.Errorf("kugou: empty data response")
	}
	return simulateBatch(workIDs, model.PlatformKugou, start, end, 0.006), nil
}

type KuwoAdapter struct{}

func (a *KuwoAdapter) Name() string { return "kuwo" }
func (a *KuwoAdapter) FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.02 {
		return nil, fmt.Errorf("kuwo: dns resolution failed")
	}
	return simulateFetch(workID, model.PlatformKuwo, date, 0.0055), nil
}
func (a *KuwoAdapter) BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.03 {
		return nil, fmt.Errorf("kuwo: tls handshake timeout")
	}
	return simulateBatch(workIDs, model.PlatformKuwo, start, end, 0.0055), nil
}

type SpotifyAdapter struct{}

func (a *SpotifyAdapter) Name() string { return "spotify" }
func (a *SpotifyAdapter) FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.025 {
		return nil, fmt.Errorf("spotify: OAuth token expired")
	}
	return simulateFetch(workID, model.PlatformSpotify, date, 0.04), nil
}
func (a *SpotifyAdapter) BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.035 {
		return nil, fmt.Errorf("spotify: API quota exhausted")
	}
	return simulateBatch(workIDs, model.PlatformSpotify, start, end, 0.04), nil
}

type AppleMusicAdapter struct{}

func (a *AppleMusicAdapter) Name() string { return "apple_music" }
func (a *AppleMusicAdapter) FetchWorkData(ctx context.Context, workID string, date time.Time) (*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.025 {
		return nil, fmt.Errorf("applemusic: invalid developer token")
	}
	return simulateFetch(workID, model.PlatformAppleMusic, date, 0.05), nil
}
func (a *AppleMusicAdapter) BatchFetch(ctx context.Context, workIDs []string, start, end time.Time) ([]*model.PlatformData, error) {
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if rand.Float64() < 0.035 {
		return nil, fmt.Errorf("applemusic: storefront not available")
	}
	return simulateBatch(workIDs, model.PlatformAppleMusic, start, end, 0.05), nil
}

func simulateFetch(workID string, platform model.Platform, date time.Time, unitPrice float64) *model.PlatformData {
	seed := int64(len(workID))*31 + int64(platform[0])*7 + date.Unix()/86400
	r := rand.New(rand.NewSource(seed))
	playCount := 500 + r.Int63n(10000)
	return &model.PlatformData{
		ID:            util.NewID(),
		WorkID:        workID,
		Platform:      platform,
		DataDate:      date.Format("2006-01-02"),
		PlayCount:     playCount,
		DownloadCount: playCount / 20,
		FavoriteCount: playCount / 15,
		ShareCount:    playCount / 50,
		CommentCount:  playCount / 100,
		UnitPrice:     unitPrice,
		Revenue:       util.RoundFloat(float64(playCount)*unitPrice, 2),
		CreatedAt:     time.Now(),
	}
}

func simulateBatch(workIDs []string, platform model.Platform, start, end time.Time, unitPrice float64) []*model.PlatformData {
	results := make([]*model.PlatformData, 0)
	for _, wid := range workIDs {
		for d := util.TruncDate(start); !d.After(util.TruncDate(end)); d = d.AddDate(0, 0, 1) {
			results = append(results, simulateFetch(wid, platform, d, unitPrice))
		}
	}
	return results
}

type CrawlerService struct {
	repo      *store.MockRepo
	redis     *store.RedisStore
	adapters  map[model.Platform]PlatformAdapter
	ws        WSNotifier
	mu        sync.Mutex
	tasks     map[string]*model.CrawlerTask
}

func NewCrawlerService(repo *store.MockRepo, redis *store.RedisStore) *CrawlerService {
	svc := &CrawlerService{
		repo:     repo,
		redis:    redis,
		adapters: make(map[model.Platform]PlatformAdapter),
		tasks:    make(map[string]*model.CrawlerTask),
	}
	svc.adapters[model.PlatformNetEase] = &NetEaseAdapter{baseURL: "https://music.163.com/api"}
	svc.adapters[model.PlatformQQMusic] = &QQMusicAdapter{}
	svc.adapters[model.PlatformKugou] = &KugouAdapter{}
	svc.adapters[model.PlatformKuwo] = &KuwoAdapter{}
	svc.adapters[model.PlatformSpotify] = &SpotifyAdapter{}
	svc.adapters[model.PlatformAppleMusic] = &AppleMusicAdapter{}
	return svc
}

func (s *CrawlerService) SetWSHandler(ws WSNotifier) {
	s.ws = ws
}

func (s *CrawlerService) GetAdapter(p model.Platform) (PlatformAdapter, bool) {
	a, ok := s.adapters[p]
	return a, ok
}

func (s *CrawlerService) CrawlPlatformData(ctx context.Context, platform model.Platform, workIDs []string, start, end time.Time, maxRetries int) (*model.CrawlerTask, error) {
	adapter, ok := s.adapters[platform]
	if !ok {
		return nil, fmt.Errorf("unsupported platform: %s", platform)
	}

	if len(workIDs) == 0 {
		workIDs = s.repo.GetAllWorkIDs()
	}

	task := &model.CrawlerTask{
		ID:         util.NewID(),
		Platform:   platform,
		TaskType:   "data_fetch",
		Status:     "running",
		RetryCount: 0,
		CreatedAt:  time.Now(),
	}
	now := time.Now()
	task.StartedAt = &now

	s.mu.Lock()
	s.tasks[task.ID] = task
	s.mu.Unlock()

	go s.doCrawlWithRetry(task, adapter, workIDs, start, end, maxRetries)

	return task, nil
}

func (s *CrawlerService) doCrawlWithRetry(task *model.CrawlerTask, adapter PlatformAdapter, workIDs []string, start, end time.Time, maxRetries int) {
	totalDays := int(end.Sub(start).Hours()/24) + 1
	totalRecords := len(workIDs) * totalDays

	s.pushCrawlProgress(task, 0.0, "running", "")

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			s.pushCrawlProgress(task, float64(attempt)/float64(maxRetries+1)*0.3,
				"retrying",
				fmt.Sprintf("第 %d 次重试，等待 %v", attempt, backoff))
			time.Sleep(backoff)
			task.RetryCount = attempt
		}

		results, err := adapter.BatchFetch(context.Background(), workIDs, start, end)
		if err == nil {
			for idx, pd := range results {
				s.repo.SavePlatformData(pd)
				s.repo.PersistPlatformData(pd)

				key := store.KeyPlatformData(pd.DataDate, store.PlatformKey(pd.Platform))
				_ = s.redis.HSet(context.Background(), key, map[string]interface{}{
					pd.WorkID: pd,
				})

				if idx%50 == 0 && totalRecords > 0 {
					progress := 0.3 + 0.7*float64(idx)/float64(totalRecords)
					s.pushCrawlProgress(task, progress, "writing",
						fmt.Sprintf("已处理 %d/%d 条数据", idx, totalRecords))
				}
			}
			task.Status = "success"
			now := time.Now()
			task.FinishedAt = &now
			task.RecordCount = len(results)
			lastErr = nil
			s.pushCrawlProgress(task, 1.0, "success",
				fmt.Sprintf("完成，共 %d 条数据", len(results)))
			break
		}

		lastErr = err
		task.ErrorMsg = err.Error()
		s.pushCrawlProgress(task, 0.1+float64(attempt)*0.05, "failed",
			fmt.Sprintf("第 %d 次尝试失败: %v", attempt+1, err))
	}

	if lastErr != nil {
		task.Status = "failed"
		now := time.Now()
		task.FinishedAt = &now
		s.pushCrawlProgress(task, 1.0, "failed",
			fmt.Sprintf("最终失败: %v", lastErr))

		if s.ws != nil {
			alertMsg := fmt.Sprintf("平台 [%s] 数据采集失败，已重试 %d 次，错误: %v",
				task.Platform, task.RetryCount, lastErr)
			_ = s.ws.NotifyAlert("error", "数据采集失败告警", alertMsg)
		}
	}

	s.mu.Lock()
	s.tasks[task.ID] = task
	s.mu.Unlock()
}

func (s *CrawlerService) pushCrawlProgress(task *model.CrawlerTask, progress float64, status string, msg string) {
	if s.ws != nil {
		_ = s.ws.NotifyCrawlProgress(&wspkg.CrawlProgressPayload{
			TaskID:   task.ID,
			Platform: string(task.Platform),
			Progress: progress,
			Status:   status,
			ErrorMsg: msg,
		})
	}
}

func (s *CrawlerService) GetTask(taskID string) *model.CrawlerTask {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.tasks[taskID]
}

type PiracyMatchResult struct {
	Score  float64
	Reason string
}

type MonitorService struct {
	repo  *store.MockRepo
	redis *store.RedisStore
	ws    WSNotifier
	mu    sync.Mutex
}

func NewMonitorService(repo *store.MockRepo, redis *store.RedisStore) *MonitorService {
	return &MonitorService{repo: repo, redis: redis}
}

func (s *MonitorService) SetWSHandler(ws WSNotifier) {
	s.ws = ws
}

func (s *MonitorService) CompareFingerprints(fp1, fp2 string) PiracyMatchResult {
	if len(fp1) == 0 || len(fp2) == 0 {
		return PiracyMatchResult{Score: 0, Reason: "empty fingerprint"}
	}

	minLen := len(fp1)
	if len(fp2) < minLen {
		minLen = len(fp2)
	}

	matching := 0
	for i := 0; i < minLen; i++ {
		if fp1[i] == fp2[i] {
			matching++
		}
	}

	score := float64(matching) / float64(minLen)

	seed := int64(fp1[0])*31 + int64(fp2[0])
	r := rand.New(rand.NewSource(seed))
	jitter := (r.Float64() - 0.5) * 0.3
	score = score + jitter*0.1
	if score < 0 {
		score = 0
	}
	if score > 1 {
		score = 1
	}

	reason := "低相似度"
	if score >= 0.9 {
		reason = "高度匹配（疑似直接拷贝）"
	} else if score >= 0.8 {
		reason = "较高相似度（疑似翻唱/采样）"
	} else if score >= 0.6 {
		reason = "中度相似（旋律借鉴）"
	}
	return PiracyMatchResult{Score: util.RoundFloat(score, 4), Reason: reason}
}

func (s *MonitorService) ScanPiracyForWork(ctx context.Context, workID string, threshold float64) ([]*model.PiracyRecord, error) {
	work := s.repo.GetWork(workID)
	if work == nil {
		return nil, fmt.Errorf("work not found")
	}
	if len(work.Versions) == 0 {
		return nil, fmt.Errorf("work has no versions")
	}

	lockKey := fmt.Sprintf("lock:piracy:%s", workID)
	ok, token, err := s.redis.AcquireLock(ctx, lockKey, 60*time.Second)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("scan already in progress")
	}
	defer s.redis.ReleaseLock(ctx, lockKey, token)

	baseFP := work.Versions[0].AudioFingerprint
	titles := []string{
		fmt.Sprintf("%s (翻唱版)", work.Title),
		fmt.Sprintf("%s - DJ Remix", work.Title),
		fmt.Sprintf("%s 钢琴独奏", work.Title),
		fmt.Sprintf("%s 街头艺人表演", work.Title),
		fmt.Sprintf("%s 改编版", work.Title),
	}
	platforms := []string{"Bilibili", "抖音", "快手", "YouTube", "小红书", "微信视频号", "微博"}
	seed := int64(work.ID[0])*101 + int64(len(work.Title))
	r := rand.New(rand.NewSource(seed))

	suspects := make([]*model.PiracyRecord, 0)
	numSuspects := 2 + r.Intn(4)
	for i := 0; i < numSuspects; i++ {
		simFP := generateSimilarFingerprint(baseFP, 0.5+r.Float64()*0.4)
		match := s.CompareFingerprints(baseFP, simFP)
		if match.Score < threshold {
			continue
		}

		status := model.PiracySuspected
		if match.Score >= 0.92 {
			status = model.PiracyConfirmed
		} else if match.Score >= 0.85 && r.Intn(2) == 0 {
			status = model.PiracyConfirmed
		}

		pr := &model.PiracyRecord{
			ID:                util.NewID(),
			WorkID:            workID,
			WorkTitle:         work.Title,
			WorkFingerprint:   baseFP,
			SuspectTitle:      titles[r.Intn(len(titles))],
			SuspectArtist:     fmt.Sprintf("民间歌手_%d", r.Intn(100)),
			SuspectPlatform:   platforms[r.Intn(len(platforms))],
			SuspectURL:        fmt.Sprintf("https://example.com/p/%s-%d", workID, i),
			SuspectFingerprint: simFP,
			MatchScore:        match.Score,
			MatchThreshold:    threshold,
			Status:            status,
			Note:              fmt.Sprintf("自动扫描: %s", match.Reason),
			DiscoveredAt:      time.Now(),
		}
		s.repo.SavePiracy(pr)
		s.repo.PersistPiracy(pr)
		suspects = append(suspects, pr)

		if s.ws != nil && status == model.PiracyConfirmed {
			_ = s.ws.NotifyPiracy(pr, work)
		}
	}

	return suspects, nil
}

func (s *MonitorService) ScanAllWorks(ctx context.Context, threshold float64) (int, error) {
	workIDs := s.repo.GetAllWorkIDs()
	total := 0
	for _, wid := range workIDs {
		recs, err := s.ScanPiracyForWork(ctx, wid, threshold)
		if err != nil {
			continue
		}
		total += len(recs)
	}
	return total, nil
}

func (s *MonitorService) GenerateRightsLetter(piracyID string, templateType string) (*model.RightsLetter, error) {
	pr := s.repo.GetPiracy(piracyID)
	if pr == nil {
		return nil, fmt.Errorf("piracy record not found")
	}

	work := s.repo.GetWork(pr.WorkID)
	if work == nil {
		return nil, fmt.Errorf("work not found")
	}

	owner := "LabelOps Music Group"
	artists := make([]string, 0)
	for _, c := range work.Contributors {
		if c.Role == model.RoleComposer || c.Role == model.RoleLyricist {
			artists = append(artists, c.ArtistName)
		}
	}

	var content string
	switch templateType {
	case "cease_desist":
		content = fmt.Sprintf(CEASE_DESIST_TEMPLATE,
			owner, time.Now().Format("2006年01月02日"),
			pr.SuspectPlatform, pr.SuspectArtist, work.Title,
			pr.SuspectURL, owner, owner, owner,
		)
	case "license_offer":
		content = fmt.Sprintf(LICENSE_OFFER_TEMPLATE,
			owner, time.Now().Format("2006年01月02日"),
			pr.SuspectArtist, work.Title, joinStr(artists, "/"),
			pr.SuspectURL, owner,
		)
	default:
		content = fmt.Sprintf(STANDARD_NOTICE_TEMPLATE,
			owner, time.Now().Format("2006年01月02日"),
			pr.SuspectPlatform, work.Title, joinStr(artists, "/"),
			pr.SuspectURL, pr.SuspectArtist, owner,
		)
	}

	letter := &model.RightsLetter{
		ID:             util.NewID(),
		PiracyID:       piracyID,
		WorkID:         pr.WorkID,
		WorkTitle:      work.Title,
		CopyrightOwner: owner,
		Infringer:      pr.SuspectArtist,
		InfringingURL:  pr.SuspectURL,
		Platform:       pr.SuspectPlatform,
		TemplateType:   templateType,
		Content:        content,
		GeneratedAt:    time.Now(),
		GeneratedBy:    "system",
	}

	pr.Status = model.PiracyProcessing
	s.repo.SavePiracy(pr)

	return letter, nil
}

func (s *MonitorService) ResolvePiracy(id string, dismissed bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	pr := s.repo.GetPiracy(id)
	if pr == nil {
		return fmt.Errorf("piracy record not found")
	}
	now := time.Now()
	pr.ResolvedAt = &now
	if dismissed {
		pr.Status = model.PiracyDismissed
		pr.Note = pr.Note + " | 人工复核：误报，已驳回"
	} else {
		pr.Status = model.PiracyResolved
		pr.Note = pr.Note + " | 已完成维权"
	}
	s.repo.SavePiracy(pr)
	return nil
}

func generateSimilarFingerprint(base string, similarity float64) string {
	b := []byte(base)
	numChanges := int(float64(len(b)) * (1 - similarity))
	hexChars := []byte("0123456789abcdef")
	r := rand.New(rand.NewSource(int64(len(base)) + int64(b[0])*7))
	for i := 0; i < numChanges; i++ {
		idx := r.Intn(len(b))
		b[idx] = hexChars[r.Intn(len(hexChars))]
	}
	return string(b)
}

func joinStr(arr []string, sep string) string {
	result := ""
	for i, s := range arr {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}

const CEASE_DESIST_TEMPLATE = `【停止侵权函】

致：%s平台 / %s

发函日期：%s

事由：关于立即停止未经授权使用音乐作品《%s》的函

一、我方权利声明
我方 %s 系音乐作品《%s》（以下简称"本作品"）的合法著作权人或独家授权管理方，对本作品享有完整的词曲著作权、录音制作权及信息网络传播权。本作品原始创作人员已将全部财产性权利独家授权我方管理。

二、侵权事实
我方近期监控发现，贵方在平台 %s 上发布/传播了未经授权使用本作品的内容（链接：%s）。该行为违反了《中华人民共和国著作权法》第十条、第四十八条及相关法规的规定，已构成对我方著作权的严重侵犯。

三、我方要求
请贵方在收到本函后 3 个工作日内完成以下事项：
1. 立即删除、下线所有涉及本作品的侵权内容；
2. 向我方提供侵权责任人的完整注册信息（真实姓名、联系方式、身份证明）；
3. 就本次侵权行为向我方提交书面致歉与保证；
4. 与我方协商侵权损害赔偿事宜，我方保留通过法律途径追究全部责任的权利。

四、法律后果
如贵方未在上述期限内采取有效措施，我方将采取包括但不限于平台投诉、行政举报、民事诉讼、刑事报案等一切合法手段，追究贵方法律责任，届时由此产生的一切费用（包括但不限于诉讼费、公证费、律师费、差旅费等）均由贵方承担。

联系人：法务部
联系邮箱：legal@labelops.com
联系电话：400-000-0000

特此函告。

%s
%s
`

const LICENSE_OFFER_TEMPLATE = `【授权合作邀约函】

致：%s

发函日期：%s

事由：关于音乐作品《%s》的合法使用授权邀约

尊敬的 %s 先生/女士：

您好！我方近期注意到您在 %s 平台发布了使用音乐作品《%s》（词曲作者：%s）的内容（链接：%s）。我方理解创作者之间的灵感碰撞，为促进双方友好合作，特向您发出本授权邀约。

关于作品《%s》，我方 %s 系其独家版权管理方，现将合作方式告知如下：

【方案一：标准化授权】
- 授权类型：非独家信息网络传播权
- 授权范围：全球范围、互联网全平台
- 授权费用：人民币 2,000 元 / 单作品（含翻唱、改编）
- 结算方式：一次性支付，永久授权

【方案二：分成合作】
- 授权类型：非独家信息网络传播权
- 收益分成：扣除平台成本后，我方 20% / 您方 80%
- 结算周期：按月结算

【方案三：商务合作】
如需用于商业广告、影视配乐、游戏等商用场景，请联系我方案部定制合作方案。

请您在收到本函后 7 个工作日内与我方案权专员联系（email: license@labelops.com），选择合适的合作方案并签署授权协议。逾期未回复我方视为拒绝授权，我方将按照正常版权维权流程处理。

期待与您的合作！

%s
版权运营部
`

const STANDARD_NOTICE_TEMPLATE = `【版权侵权告知函】

致：%s平台

发函日期：%s

平台依据《信息网络传播权保护条例》及"避风港规则"，请对以下侵权内容进行处理：

一、作品信息
作品名称：%s
词曲作者：%s
版权方：%s （独家版权管理方）

二、侵权链接
内容发布者：%s
内容链接：%s
侵权类型：□ 未经授权翻唱  □ 未经授权采样  □ 未经授权改编  □ 直接盗录

三、我方声明
1. 我方是本作品的合法著作权人/独家授权管理方，本告知函内容真实；
2. 上述链接内容未获得我方任何形式的授权，已侵犯我方合法权益；
3. 我方请求平台立即删除、屏蔽或断开上述侵权内容链接；
4. 我方理解平台如不适用"避风港规则"的情形下，将依法承担共同侵权责任。

请贵平台在收到本告知后 24 小时内完成下线处理，并反馈处理结果。
联系邮箱：copyright@labelops.com
官方投诉通道：https://labelops.com/dmca

附件：作品著作权登记证书、授权委托书（见邮箱附件）

%s
版权法务部
`

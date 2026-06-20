package store

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/util"
)

type MockRepo struct {
	mu         sync.RWMutex
	works      map[string]*model.Work
	artists    map[string]*model.Artist
	users      map[string]*model.User
	rules      map[string]*model.RoyaltyRule
	platform   map[string]*model.PlatformData
	settlements map[string]*model.Settlement
	piracies   map[string]*model.PiracyRecord
	auditLogs  []*model.AuditLog
}

var defaultRepo *MockRepo
var defaultOnce sync.Once

func GetDefaultRepo() *MockRepo {
	defaultOnce.Do(func() {
		defaultRepo = &MockRepo{
			works:       make(map[string]*model.Work),
			artists:     make(map[string]*model.Artist),
			users:       make(map[string]*model.User),
			rules:       make(map[string]*model.RoyaltyRule),
			platform:    make(map[string]*model.PlatformData),
			settlements: make(map[string]*model.Settlement),
			piracies:    make(map[string]*model.PiracyRecord),
		}
		defaultRepo.seedMockData()
	})
	return defaultRepo
}

func (r *MockRepo) seedMockData() {
	brands := []model.Brand{model.BrandA, model.BrandB, model.BrandC}
	artistNames := []string{
		"林溪", "陈默", "苏晚", "江野", "顾白", "沈墨", "南风", "北岸", "西屿", "东篱",
		"青禾", "慕白", "知秋", "望舒", "清欢", "听风", "观云", "揽月", "枕星", "眠雨",
		"破晓", "黄昏", "夜雨", "晨曦", "落霞", "晚风", "初雪", "暖阳", "寒梅", "青竹",
		"幽兰", "墨菊", "雪松", "翠柏", "银杉", "梧桐", "红枫", "银杏", "石榴", "碧桃",
		"栀子", "茉莉", "海棠", "丁香", "紫薇",
	}

	for i, name := range artistNames {
		a := &model.Artist{
			ID:        util.NewID(),
			Name:      name,
			Brand:     brands[i%3],
			Signature: fmt.Sprintf("%s - 独立音乐人", name),
			Contact:   fmt.Sprintf("artist%d@labelops.com", i+1),
			JoinDate:  time.Date(2023, time.Month((i%12)+1), (i%27)+1, 0, 0, 0, 0, time.Local),
			CreatedAt: time.Date(2023, time.Month((i%12)+1), (i%27)+1, 0, 0, 0, 0, time.Local),
		}
		r.artists[a.ID] = a
	}

	roles := []model.UserRole{model.RoleAdmin, model.RoleFinance, model.RoleCopyright, model.RoleUserProducer}
	roleNames := map[model.UserRole]string{
		model.RoleAdmin:     "admin",
		model.RoleFinance:   "finance",
		model.RoleCopyright: "copyright",
		model.RoleUserProducer:  "producer",
		model.RoleArtist:    "artist",
	}
	for _, role := range roles {
		realNames := map[model.UserRole]string{
			model.RoleAdmin:     "厂牌管理员",
			model.RoleFinance:   "财务专员",
			model.RoleCopyright: "版权专员",
			model.RoleUserProducer:  "制作人",
		}
		u := &model.User{
			ID:        util.NewID(),
			Username:  string(roleNames[role]),
			RealName:  realNames[role],
			Email:     fmt.Sprintf("%s@labelops.com", roleNames[role]),
			Phone:     fmt.Sprintf("138%08d", len(r.users)+1000),
			Role:      role,
			CreatedAt: time.Date(2023, 1, 1, 0, 0, 0, 0, time.Local),
		}
		r.users[u.ID] = u
	}

	artistIDs := r.GetAllArtistIDs()
	for i := 0; i < len(artistNames) && i < len(artistIDs); i++ {
		u := &model.User{
			ID:        util.NewID(),
			Username:  fmt.Sprintf("artist_%s", artistNames[i]),
			RealName:  artistNames[i],
			Email:     fmt.Sprintf("artist%d@labelops.com", i+1),
			Phone:     fmt.Sprintf("139%08d", i+1),
			Role:      model.RoleArtist,
			ArtistID:  &artistIDs[i],
			CreatedAt: time.Date(2023, 6, 1, 0, 0, 0, 0, time.Local),
		}
		r.users[u.ID] = u
	}

	workTitles := []string{
		"午夜星河", "城市雨", "候鸟南飞", "夏日来信", "旧时光", "不眠夜", "长安行", "山海谣",
		"晚风集", "少年游", "忆江南", "夜航船", "月半弯", "春日颂", "秋意浓", "冬日絮语",
		"烟火人间", "岁月神偷", "青春纪念册", "梦想家", "流浪者之歌", "小镇故事", "北方的风",
		"南方的雨", "星辰大海", "日出东方", "月光奏鸣曲", "森林物语", "海边的卡夫卡",
		"城市边缘人", "时光机", "梦里花落知多少", "明天会更好", "往事随风", "夜空中最亮的星",
		"追光者", "消愁", "像我这样的人", "平凡之路", "成都", "安和桥", "斑马斑马",
		"南方姑娘", "理想三旬", "南山南",
	}
	genres := []string{"民谣", "摇滚", "电子", "爵士", "嘻哈", "古典", "流行", "后摇", "R&B", "独立"}
	types := []model.WorkType{model.WorkTypeAlbum, model.WorkTypeSingle, model.WorkTypeEP}
	statuses := []model.WorkStatus{
		model.WorkStatusDemo, model.WorkStatusArranging, model.WorkStatusMixing,
		model.WorkStatusMastering, model.WorkStatusReviewing, model.WorkStatusReleased,
	}

	for i, title := range workTitles {
		wID := util.NewID()
		artistIdx := i % len(artistIDs)
		brand := brands[i%3]
		var release *time.Time
		status := statuses[i%len(statuses)]
		if status == model.WorkStatusReleased {
			t := time.Date(2024, time.Month(((i+2)%12)+1), ((i*3)%27)+1, 0, 0, 0, 0, time.Local)
			release = &t
		}

		w := &model.Work{
			ID:          wID,
			Title:       title,
			Type:        types[i%len(types)],
			Brand:       brand,
			Status:      status,
			ISRC:        fmt.Sprintf("CN-A01-%06d", i+1),
			ISWC:        fmt.Sprintf("T-000.%06d-0", i+1),
			Duration:    180 + (i*17)%180,
			Genre:       genres[i%len(genres)],
			ReleaseDate: release,
			CreatedAt:   time.Date(2023, time.Month(((i+5)%12)+1), ((i*2)%27)+1, 0, 0, 0, 0, time.Local),
			UpdatedAt:   time.Date(2024, time.Month(((i+1)%12)+1), ((i*5)%27)+1, 0, 0, 0, 0, time.Local),
		}

		w.Contributors = []model.Contributor{
			{
				ID:           util.NewID(),
				WorkID:       wID,
				ArtistID:     artistIDs[artistIdx],
				ArtistName:   artistNames[artistIdx],
				Role:         model.RolePerformer,
				RoyaltyRuleID: fmt.Sprintf("rule-perf-%d", artistIdx),
			},
			{
				ID:           util.NewID(),
				WorkID:       wID,
				ArtistID:     artistIDs[(artistIdx+1)%len(artistIDs)],
				ArtistName:   artistNames[(artistIdx+1)%len(artistIDs)],
				Role:         model.RoleComposer,
				RoyaltyRuleID: fmt.Sprintf("rule-comp-%d", (artistIdx+1)%len(artistIDs)),
			},
			{
				ID:           util.NewID(),
				WorkID:       wID,
				ArtistID:     artistIDs[(artistIdx+2)%len(artistIDs)],
				ArtistName:   artistNames[(artistIdx+2)%len(artistIDs)],
				Role:         model.RoleLyricist,
				RoyaltyRuleID: fmt.Sprintf("rule-lyr-%d", (artistIdx+2)%len(artistIDs)),
			},
			{
				ID:           util.NewID(),
				WorkID:       wID,
				ArtistID:     artistIDs[(artistIdx+3)%len(artistIDs)],
				ArtistName:   artistNames[(artistIdx+3)%len(artistIDs)],
				Role:         model.RoleArranger,
				RoyaltyRuleID: fmt.Sprintf("rule-arr-%d", (artistIdx+3)%len(artistIDs)),
			},
		}

		versions := make([]model.WorkVersion, 0, 3)
		vStatuses := []model.WorkStatus{model.WorkStatusDemo, model.WorkStatusMixing, model.WorkStatusMastering}
		for vi := 0; vi < ((i%3)+1); vi++ {
			versions = append(versions, model.WorkVersion{
				ID:         util.NewID(),
				WorkID:     wID,
				Version:    fmt.Sprintf("v%d.0", vi+1),
				Status:     vStatuses[vi%len(vStatuses)],
				FileURL:    fmt.Sprintf("https://cdn.labelops.com/works/%s/v%d.wav", wID, vi+1),
				FileSize:   int64((vi+1) * 25 * 1024 * 1024),
				AudioFingerprint: util.RandomHex(32),
				CreatedAt:  w.CreatedAt.AddDate(0, 0, vi*7),
				CreatedBy:  r.GetUserIDsByRole(model.RoleUserProducer)[0],
				Note:       fmt.Sprintf("第%d次迭代，调整%s", vi+1, []string{"旋律走向", "配器", "动态范围", "混音细节", "母带处理"}[vi%5]),
			})
		}
		w.Versions = versions

		if i%5 == 0 && i > 0 {
			parentIdx := (i * 3) % len(workTitles)
			parentWorkID := util.NewID()
			_ = parentWorkID
			authType := []model.AuthType{model.AuthTypeCover, model.AuthTypeSample, model.AuthTypeAdapt, model.AuthTypeRemix}[i%4]
			w.AuthChain = []model.AuthLink{
				{
					ID:           util.NewID(),
					WorkID:       wID,
					ParentWorkID: &wID,
					ParentTitle:  workTitles[parentIdx],
					AuthType:     authType,
					LicenseType:  "标准授权",
					AuthStatus:   model.AuthStatusApproved,
					AuthDocURL:   fmt.Sprintf("https://cdn.labelops.com/auth/%s.pdf", wID),
					AuthDate:     &w.CreatedAt,
					Fee:          5000.0 + float64(i*137),
					Note:         "已完成授权协议签署",
				},
			}
		}

		r.works[wID] = w
	}

	allWorkIDs := r.GetAllWorkIDs()
	allArtistIDs := r.GetAllArtistIDs()

	for _, wID := range allWorkIDs {
		w := r.works[wID]
		for _, contrib := range w.Contributors {
			rate := 0.0
			switch contrib.Role {
			case model.RolePerformer:
				rate = 0.35
			case model.RoleComposer:
				rate = 0.25
			case model.RoleLyricist:
				rate = 0.20
			case model.RoleArranger:
				rate = 0.12
			case model.RoleProducer:
				rate = 0.08
			}

			ruleType := model.RuleFixed
			rid := util.NewID()
			rule := &model.RoyaltyRule{
				ID:             rid,
				Name:           fmt.Sprintf("%s-%s", w.Title, contrib.Role),
				WorkID:         &wID,
				ArtistID:       &contrib.ArtistID,
				ContributorRole: contrib.Role,
				RuleType:       ruleType,
				FixedRate:      &rate,
				Period:         model.PeriodMonthly,
				CreatedAt:      w.CreatedAt,
			}

			_ = allArtistIDs
			r.rules[rid] = rule

			contrib.RoyaltyRuleID = rid
		}
		r.works[wID] = w
	}

	platforms := []model.Platform{
		model.PlatformNetEase, model.PlatformQQMusic, model.PlatformKugou,
		model.PlatformKuwo, model.PlatformSpotify, model.PlatformAppleMusic,
	}
	unitPrices := map[model.Platform]float64{
		model.PlatformNetEase:    0.008,
		model.PlatformQQMusic:    0.007,
		model.PlatformKugou:      0.006,
		model.PlatformKuwo:       0.0055,
		model.PlatformSpotify:    0.04,
		model.PlatformAppleMusic: 0.05,
	}

	for month := 1; month <= 6; month++ {
		for day := 1; day <= 28; day++ {
			date := fmt.Sprintf("2024-%02d-%02d", month, day)
			for _, wID := range allWorkIDs {
				for _, p := range platforms {
					basePlay := int64(500 + ((int(wID[0])+month*13+day*7+int(p[0])) % 9500))
					pd := &model.PlatformData{
						ID:            util.NewID(),
						WorkID:        wID,
						Platform:      p,
						DataDate:      date,
						PlayCount:     basePlay,
						DownloadCount: basePlay / 20,
						FavoriteCount: basePlay / 15,
						ShareCount:    basePlay / 50,
						CommentCount:  basePlay / 100,
						UnitPrice:     unitPrices[p],
						Revenue:       util.RoundFloat(float64(basePlay)*unitPrices[p], 2),
						CreatedAt:     time.Date(2024, time.Month(month), day, 0, 0, 0, 0, time.Local),
					}
					key := fmt.Sprintf("%s|%s|%s", wID, p, date)
					r.platform[key] = pd
				}
			}
		}
	}

	piracyTitles := []string{
		"午夜星河 (翻唱)", "城市雨 remix", "候鸟南飞 - 街头艺人版",
		"深夜电台版·夏日来信", "旧时光钢琴独奏", "不眠夜DJ版",
	}
	suspectPlatforms := []string{"Bilibili", "抖音", "快手", "YouTube", "小红书", "微信视频号"}

	for i := 0; i < 15; i++ {
		wID := allWorkIDs[(i*7)%len(allWorkIDs)]
		w := r.works[wID]
		statuses := []model.PiracyStatus{
			model.PiracySuspected, model.PiracyConfirmed,
			model.PiracyProcessing, model.PiracyResolved, model.PiracyDismissed,
		}
		score := 0.75 + float64((i*13)%24)/100.0
		pr := &model.PiracyRecord{
			ID:                util.NewID(),
			WorkID:            wID,
			WorkTitle:         w.Title,
			WorkFingerprint:   w.Versions[0].AudioFingerprint,
			SuspectTitle:      piracyTitles[i%len(piracyTitles)],
			SuspectArtist:     fmt.Sprintf("民间歌手_%d", i+1),
			SuspectPlatform:   suspectPlatforms[i%len(suspectPlatforms)],
			SuspectURL:        fmt.Sprintf("https://example.com/infringe/%d", i+100),
			SuspectFingerprint: util.RandomHex(32),
			MatchScore:        util.RoundFloat(score, 4),
			MatchThreshold:    0.80,
			Status:            statuses[i%len(statuses)],
			Note:              fmt.Sprintf("疑似侵权作品匹配度 %.1f%%，待核实", score*100),
			DiscoveredAt:      time.Date(2024, time.Month(((i%5)+1)), ((i*5)%27)+1, 0, 0, 0, 0, time.Local),
		}
		if pr.Status == model.PiracyResolved {
			t := pr.DiscoveredAt.AddDate(0, 0, 14)
			pr.ResolvedAt = &t
		}
		r.piracies[pr.ID] = pr
	}

	for i := 0; i < 5; i++ {
		periods := []model.SettlementPeriod{model.PeriodMonthly, model.PeriodQuarter}
		period := periods[i%2]
		artistID := allArtistIDs[i]
		artistName := artistNames[i]

		now := time.Date(2024, time.Month(i+1), 1, 0, 0, 0, 0, time.Local)
		start, end := util.GetPeriodRange(string(period), now)

		statuses := []model.SettlementStatus{
			model.SettleDraft, model.SettlePending, model.SettleApproved, model.SettlePaid, model.SettleRejected,
		}

		sID := util.NewID()
		platformBd := make(map[model.Platform]float64)
		workBd := make(map[string]float64)
		contribBd := make(map[string]float64)
		totalRevenue := 0.0

		for idx, p := range platforms {
			v := float64(5000 + (i*1000)+(idx*800))
			platformBd[p] = util.RoundFloat(v, 2)
			totalRevenue += v
		}
		for j := 0; j < ((i*3)%5)+3; j++ {
			wid := allWorkIDs[(i+j*2)%len(allWorkIDs)]
			v := float64(2000 + (i*500)+(j*300))
			workBd[wid] = util.RoundFloat(v, 2)
		}
		for j := 0; j < 4; j++ {
			aid := allArtistIDs[(i+j)%len(allArtistIDs)]
			ratio := []float64{0.35, 0.25, 0.20, 0.12}[j]
			contribBd[aid] = util.RoundFloat(totalRevenue*ratio, 2)
		}

		s := &model.Settlement{
			ID:                 sID,
			Period:             period,
			PeriodStart:        start,
			PeriodEnd:          end,
			ArtistID:           artistID,
			ArtistName:         artistName,
			Brand:              brands[i%3],
			TotalRevenue:       util.RoundFloat(totalRevenue, 2),
			PlatformBreakdown:  platformBd,
			WorkBreakdown:      workBd,
			ContributorBreakdown: contribBd,
			Status:             statuses[i%len(statuses)],
			Remark:             fmt.Sprintf("%s 第%d期结算", artistName, i+1),
			CreatedAt:          end.AddDate(0, 0, 3),
		}

		if s.Status == model.SettleApproved || s.Status == model.SettlePaid {
			t := s.CreatedAt.AddDate(0, 0, 5)
			s.ApprovedAt = &t
		}
		if s.Status == model.SettlePaid {
			t := s.CreatedAt.AddDate(0, 0, 10)
			s.PaidAt = &t
		}

		r.settlements[sID] = s
	}
}

func (r *MockRepo) GetAllWorkIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0, len(r.works))
	for id := range r.works {
		ids = append(ids, id)
	}
	return ids
}

func (r *MockRepo) GetAllArtistIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0, len(r.artists))
	for id := range r.artists {
		ids = append(ids, id)
	}
	return ids
}

func (r *MockRepo) GetUserIDsByRole(role model.UserRole) []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0)
	for id, u := range r.users {
		if u.Role == role {
			ids = append(ids, id)
		}
	}
	return ids
}

func (r *MockRepo) ListWorks(brand model.Brand, status model.WorkStatus, wtype model.WorkType, keyword string, offset, limit int) ([]*model.Work, int64) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	matches := make([]*model.Work, 0)
	for _, w := range r.works {
		if brand != "" && w.Brand != brand {
			continue
		}
		if status != "" && w.Status != status {
			continue
		}
		if wtype != "" && w.Type != wtype {
			continue
		}
		if keyword != "" {
			found := false
			if contains(w.Title, keyword) {
				found = true
			}
			for _, c := range w.Contributors {
				if contains(c.ArtistName, keyword) {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		matches = append(matches, w)
	}

	total := int64(len(matches))
	if offset >= len(matches) {
		return []*model.Work{}, total
	}
	end := offset + limit
	if end > len(matches) {
		end = len(matches)
	}
	return matches[offset:end], total
}

func (r *MockRepo) GetWork(id string) *model.Work {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.works[id]
}

func (r *MockRepo) SaveWork(w *model.Work) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if w.CreatedAt.IsZero() {
		w.CreatedAt = time.Now()
	}
	w.UpdatedAt = time.Now()
	r.works[w.ID] = w
}

func (r *MockRepo) ListArtists(brand model.Brand, offset, limit int) ([]*model.Artist, int64) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	matches := make([]*model.Artist, 0)
	for _, a := range r.artists {
		if brand != "" && a.Brand != brand {
			continue
		}
		matches = append(matches, a)
	}
	total := int64(len(matches))
	if offset >= len(matches) {
		return []*model.Artist{}, total
	}
	end := offset + limit
	if end > len(matches) {
		end = len(matches)
	}
	return matches[offset:end], total
}

func (r *MockRepo) GetArtist(id string) *model.Artist {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.artists[id]
}

func (r *MockRepo) ListUsers(role model.UserRole, offset, limit int) ([]*model.User, int64) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	matches := make([]*model.User, 0)
	for _, u := range r.users {
		if role != "" && u.Role != role {
			continue
		}
		matches = append(matches, u)
	}
	total := int64(len(matches))
	if offset >= len(matches) {
		return []*model.User{}, total
	}
	end := offset + limit
	if end > len(matches) {
		end = len(matches)
	}
	return matches[offset:end], total
}

func (r *MockRepo) GetUser(id string) *model.User {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.users[id]
}

func (r *MockRepo) GetUserByUsername(username string) *model.User {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, u := range r.users {
		if u.Username == username {
			return u
		}
	}
	return nil
}

func (r *MockRepo) ListPlatformData(workID string, platform model.Platform, startDate, endDate string) []*model.PlatformData {
	r.mu.RLock()
	defer r.mu.RUnlock()
	results := make([]*model.PlatformData, 0)
	for key, pd := range r.platform {
		parts := split3(key)
		if workID != "" && parts[0] != workID {
			continue
		}
		if platform != "" && model.Platform(parts[1]) != platform {
			continue
		}
		if startDate != "" && parts[2] < startDate {
			continue
		}
		if endDate != "" && parts[2] > endDate {
			continue
		}
		results = append(results, pd)
	}
	return results
}

func (r *MockRepo) SavePlatformData(pd *model.PlatformData) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := fmt.Sprintf("%s|%s|%s", pd.WorkID, pd.Platform, pd.DataDate)
	r.platform[key] = pd
}

func (r *MockRepo) ListRules(workID, artistID string) []*model.RoyaltyRule {
	r.mu.RLock()
	defer r.mu.RUnlock()
	results := make([]*model.RoyaltyRule, 0)
	for _, rule := range r.rules {
		if workID != "" && rule.WorkID != nil && *rule.WorkID != workID {
			continue
		}
		if artistID != "" && rule.ArtistID != nil && *rule.ArtistID != artistID {
			continue
		}
		results = append(results, rule)
	}
	return results
}

func (r *MockRepo) GetRule(id string) *model.RoyaltyRule {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.rules[id]
}

func (r *MockRepo) SaveRule(rule *model.RoyaltyRule) {
	r.mu.Lock()
	defer r.mu.Unlock()
	rule.CreatedAt = time.Now()
	r.rules[rule.ID] = rule
}

func (r *MockRepo) ListSettlements(artistID string, status model.SettlementStatus, brand model.Brand, offset, limit int) ([]*model.Settlement, int64) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	matches := make([]*model.Settlement, 0)
	for _, s := range r.settlements {
		if artistID != "" && s.ArtistID != artistID {
			continue
		}
		if status != "" && s.Status != status {
			continue
		}
		if brand != "" && s.Brand != brand {
			continue
		}
		matches = append(matches, s)
	}
	total := int64(len(matches))
	if offset >= len(matches) {
		return []*model.Settlement{}, total
	}
	end := offset + limit
	if end > len(matches) {
		end = len(matches)
	}
	return matches[offset:end], total
}

func (r *MockRepo) GetSettlement(id string) *model.Settlement {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.settlements[id]
}

func (r *MockRepo) SaveSettlement(s *model.Settlement) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = time.Now()
	}
	r.settlements[s.ID] = s
}

func (r *MockRepo) ListPiracies(status model.PiracyStatus, workID string, offset, limit int) ([]*model.PiracyRecord, int64) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	matches := make([]*model.PiracyRecord, 0)
	for _, p := range r.piracies {
		if status != "" && p.Status != status {
			continue
		}
		if workID != "" && p.WorkID != workID {
			continue
		}
		matches = append(matches, p)
	}
	total := int64(len(matches))
	if offset >= len(matches) {
		return []*model.PiracyRecord{}, total
	}
	end := offset + limit
	if end > len(matches) {
		end = len(matches)
	}
	return matches[offset:end], total
}

func (r *MockRepo) GetPiracy(id string) *model.PiracyRecord {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.piracies[id]
}

func (r *MockRepo) SavePiracy(p *model.PiracyRecord) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p.DiscoveredAt.IsZero() {
		p.DiscoveredAt = time.Now()
	}
	r.piracies[p.ID] = p
}

func (r *MockRepo) AddAuditLog(log *model.AuditLog) {
	r.mu.Lock()
	defer r.mu.Unlock()
	log.CreatedAt = time.Now()
	r.auditLogs = append(r.auditLogs, log)
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

func split3(s string) []string {
	result := make([]string, 0, 3)
	start := 0
	count := 0
	for i := 0; i < len(s) && count < 2; i++ {
		if s[i] == '|' {
			result = append(result, s[start:i])
			start = i + 1
			count++
		}
	}
	result = append(result, s[start:])
	return result
}

func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

func (r *MockRepo) GetAllSettlements() []*model.Settlement {
	r.mu.RLock()
	defer r.mu.RUnlock()
	arr := make([]*model.Settlement, 0, len(r.settlements))
	for _, s := range r.settlements {
		arr = append(arr, s)
	}
	return arr
}

func (r *MockRepo) GetWorksByArtist(artistID string) []*model.Work {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*model.Work, 0)
	for _, w := range r.works {
		for _, c := range w.Contributors {
			if c.ArtistID == artistID {
				result = append(result, w)
				break
			}
		}
	}
	return result
}

func (r *MockRepo) GetAllPlatformData() []*model.PlatformData {
	r.mu.RLock()
	defer r.mu.RUnlock()
	arr := make([]*model.PlatformData, 0, len(r.platform))
	for _, p := range r.platform {
		arr = append(arr, p)
	}
	return arr
}

package service

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/labelops/backend/internal/model"
	"github.com/labelops/backend/internal/store"
	"github.com/labelops/backend/internal/util"
)

type CalcService struct {
	repo  *store.MockRepo
	redis *store.RedisStore
	mu    sync.Mutex
}

func NewCalcService(repo *store.MockRepo, redis *store.RedisStore) *CalcService {
	return &CalcService{repo: repo, redis: redis}
}

func (s *CalcService) calcShareForRule(rule *model.RoyaltyRule, revenue float64, cumulativeRevenue float64) float64 {
	switch rule.RuleType {
	case model.RuleFixed:
		if rule.FixedRate != nil {
			return util.RoundFloat(revenue * *rule.FixedRate, 2)
		}
		return 0

	case model.RuleTiered:
		if len(rule.TieredRates) == 0 {
			return 0
		}
		sort.Slice(rule.TieredRates, func(i, j int) bool {
			return rule.TieredRates[i].Threshold < rule.TieredRates[j].Threshold
		})
		rate := rule.TieredRates[0].Rate
		for _, tr := range rule.TieredRates {
			if cumulativeRevenue >= tr.Threshold {
				rate = tr.Rate
			}
		}
		return util.RoundFloat(revenue * rate, 2)

	case model.RuleGuarantee:
		share := 0.0
		if rule.FixedRate != nil {
			share = revenue * *rule.FixedRate
		}
		if rule.Guaranteed != nil && share < *rule.Guaranteed {
			share = *rule.Guaranteed
		}
		return util.RoundFloat(share, 2)

	default:
		return 0
	}
}

func (s *CalcService) calcShareByRole(role model.ContributorRole, platformRevenue float64) float64 {
	roleWeights := map[model.ContributorRole]float64{
		model.RolePerformer: 0.35,
		model.RoleComposer:  0.25,
		model.RoleLyricist:  0.20,
		model.RoleArranger:  0.12,
		model.RoleProducer:  0.08,
	}
	if w, ok := roleWeights[role]; ok {
		return util.RoundFloat(platformRevenue * w, 2)
	}
	return 0
}

type CalcSettlementResult struct {
	Settlement *model.Settlement
	Details    []model.SettlementDetail
}

func (s *CalcService) GenerateArtistSettlement(ctx context.Context, artistID string, period model.SettlementPeriod, reference time.Time) (*CalcSettlementResult, error) {
	lockKey := fmt.Sprintf("lock:settlement:%s:%s", artistID, period)
	ok, token, err := s.redis.AcquireLock(ctx, lockKey, 30*time.Second)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("another settlement is in progress for this artist and period")
	}
	defer s.redis.ReleaseLock(ctx, lockKey, token)

	artist := s.repo.GetArtist(artistID)
	if artist == nil {
		return nil, fmt.Errorf("artist not found")
	}

	start, end := util.GetPeriodRange(string(period), reference)
	startStr := start.Format("2006-01-02")
	endStr := end.Format("2006-01-02")

	works := s.repo.GetWorksByArtist(artistID)
	if len(works) == 0 {
		return &CalcSettlementResult{
			Settlement: &model.Settlement{
				ArtistID:   artistID,
				ArtistName: artist.Name,
				Brand:      artist.Brand,
				Period:     period,
				PeriodStart: start,
				PeriodEnd:  end,
				Status:     model.SettleDraft,
				PlatformBreakdown: make(map[model.Platform]float64),
				WorkBreakdown:     make(map[string]float64),
				ContributorBreakdown: make(map[string]float64),
			},
			Details: []model.SettlementDetail{},
		}, nil
	}

	platforms := []model.Platform{
		model.PlatformNetEase, model.PlatformQQMusic, model.PlatformKugou,
		model.PlatformKuwo, model.PlatformSpotify, model.PlatformAppleMusic,
	}

	platformRevenue := make(map[model.Platform]float64)
	workRevenue := make(map[string]float64)
	contributorRevenue := make(map[string]float64)
	totalRevenue := 0.0
	var details []model.SettlementDetail
	artistCumulativeRevenue := s.getHistoricalRevenue(artistID, reference)

	for _, w := range works {
		var wTotal float64
		for _, p := range platforms {
			pdList := s.repo.ListPlatformData(w.ID, p, startStr, endStr)
			var pTotal float64
			for _, pd := range pdList {
				pTotal += pd.Revenue
			}
			pTotal = util.RoundFloat(pTotal, 2)
			if pTotal <= 0 {
				continue
			}

			platformRevenue[p] += pTotal
			wTotal += pTotal
			totalRevenue += pTotal

			rolesWithContributors := make(map[model.ContributorRole][]model.Contributor)
			for _, c := range w.Contributors {
				rolesWithContributors[c.Role] = append(rolesWithContributors[c.Role], c)
			}

			for role, contributors := range rolesWithContributors {
				roleTotalShare := s.calcShareByRole(role, pTotal)
				if len(contributors) == 0 {
					continue
				}
				perPerson := util.RoundFloat(roleTotalShare/float64(len(contributors)), 2)
				for _, c := range contributors {
					cShare := perPerson
					rules := s.repo.ListRules(w.ID, c.ArtistID)
					for _, r := range rules {
						if r.ContributorRole == role {
							cShare = s.calcShareForRule(r, perPerson, artistCumulativeRevenue+totalRevenue)
							break
						}
					}

					ruleType := model.RuleFixed
					var rate float64
					for _, r := range rules {
						if r.ContributorRole == role {
							ruleType = r.RuleType
							if r.FixedRate != nil {
								rate = *r.FixedRate
							}
							break
						}
					}
					if rate == 0 {
						roleWeights := map[model.ContributorRole]float64{
							model.RolePerformer: 0.35, model.RoleComposer: 0.25,
							model.RoleLyricist: 0.20, model.RoleArranger: 0.12, model.RoleProducer: 0.08,
						}
						if w, ok := roleWeights[role]; ok {
							rate = w / float64(len(contributors))
						}
					}

					detail := model.SettlementDetail{
						ID:               util.NewID(),
						WorkID:           w.ID,
						WorkTitle:        w.Title,
						Platform:         p,
						ContributorID:    c.ArtistID,
						ContributorName:  c.ArtistName,
						ContributorRole:  role,
						TotalRevenue:     pTotal,
						PlatformRevenue:  pTotal,
						ContributorShare: cShare,
						ShareRate:        util.RoundFloat(rate, 4),
						RuleType:         ruleType,
					}
					details = append(details, detail)
					contributorRevenue[c.ArtistID] += cShare
				}
			}
		}
		if wTotal > 0 {
			workRevenue[w.ID] = util.RoundFloat(wTotal, 2)
		}
	}

	for p := range platformRevenue {
		platformRevenue[p] = util.RoundFloat(platformRevenue[p], 2)
	}
	for id := range contributorRevenue {
		contributorRevenue[id] = util.RoundFloat(contributorRevenue[id], 2)
	}

	settlement := &model.Settlement{
		ID:                   util.NewID(),
		Period:               period,
		PeriodStart:          start,
		PeriodEnd:            end,
		ArtistID:             artistID,
		ArtistName:           artist.Name,
		Brand:                artist.Brand,
		TotalRevenue:         util.RoundFloat(totalRevenue, 2),
		PlatformBreakdown:    platformRevenue,
		WorkBreakdown:        workRevenue,
		ContributorBreakdown: contributorRevenue,
		Status:               model.SettleDraft,
		Remark:               fmt.Sprintf("%s 结算单 (%s - %s)", artist.Name, startStr, endStr),
	}

	return &CalcSettlementResult{Settlement: settlement, Details: details}, nil
}

func (s *CalcService) getHistoricalRevenue(artistID string, reference time.Time) float64 {
	settlements := s.repo.GetAllSettlements()
	var total float64
	for _, s := range settlements {
		if s.ArtistID == artistID && s.PeriodEnd.Before(reference) &&
			(s.Status == model.SettleApproved || s.Status == model.SettlePaid) {
			total += s.TotalRevenue
		}
	}
	return total
}

func (s *CalcService) SaveSettlement(settlement *model.Settlement, details []model.SettlementDetail) *model.Settlement {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range details {
		details[i].SettlementID = settlement.ID
	}
	settlement.Details = details
	s.repo.SaveSettlement(settlement)
	return settlement
}

func (s *CalcService) ApproveSettlement(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s_ := s.repo.GetSettlement(id)
	if s_ == nil {
		return fmt.Errorf("settlement not found")
	}
	if s_.Status != model.SettlePending && s_.Status != model.SettleDraft {
		return fmt.Errorf("invalid status transition")
	}
	now := time.Now()
	s_.Status = model.SettleApproved
	s_.ApprovedAt = &now
	s.repo.SaveSettlement(s_)
	return nil
}

func (s *CalcService) MarkPaid(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s_ := s.repo.GetSettlement(id)
	if s_ == nil {
		return fmt.Errorf("settlement not found")
	}
	if s_.Status != model.SettleApproved {
		return fmt.Errorf("invalid status transition")
	}
	now := time.Now()
	s_.Status = model.SettlePaid
	s_.PaidAt = &now
	s.repo.SaveSettlement(s_)
	return nil
}

func (s *CalcService) DashboardSummary(ctx context.Context, startDate, endDate time.Time, brand model.Brand) (*model.DashboardSummary, error) {
	cacheKey := fmt.Sprintf("%s%s_%s_%s", store.KeyDashboardCache, startDate.Format("20060102"), endDate.Format("20060102"), brand)
	var cached model.DashboardSummary
	found, err := s.redis.Get(ctx, cacheKey, &cached)
	if err == nil && found {
		return &cached, nil
	}

	startStr := startDate.Format("2006-01-02")
	endStr := endDate.Format("2006-01-02")

	allData := s.repo.ListPlatformData("", "", startStr, endStr)

	dailyMap := make(map[string]float64)
	workPlay := make(map[string]int64)
	workRev := make(map[string]float64)
	platformRev := make(map[model.Platform]float64)
	artistRev := make(map[string]float64)
	artistPlay := make(map[string]int64)
	totalRev := 0.0
	albumCount := 0
	singleCount := 0
	epCount := 0

	for _, pd := range allData {
		work := s.repo.GetWork(pd.WorkID)
		if work == nil {
			continue
		}
		if brand != "" && work.Brand != brand {
			continue
		}

		dailyMap[pd.DataDate] += pd.Revenue
		workPlay[pd.WorkID] += pd.PlayCount
		workRev[pd.WorkID] += pd.Revenue
		platformRev[pd.Platform] += pd.Revenue
		totalRev += pd.Revenue

		for _, c := range work.Contributors {
			artistRev[c.ArtistID] += s.calcShareByRole(c.Role, pd.Revenue)
			artistPlay[c.ArtistID] += pd.PlayCount
		}
	}

	workIDs := s.repo.GetAllWorkIDs()
	for _, wid := range workIDs {
		w := s.repo.GetWork(wid)
		if w == nil {
			continue
		}
		if brand != "" && w.Brand != brand {
			continue
		}
		if w.ReleaseDate != nil && !w.ReleaseDate.Before(startDate) && !w.ReleaseDate.After(endDate) {
			switch w.Type {
			case model.WorkTypeAlbum:
				albumCount++
			case model.WorkTypeSingle:
				singleCount++
			case model.WorkTypeEP:
				epCount++
			}
		}
	}

	var revenueTrend []model.DailyRevenue
	for _, date := range util.DaysInRange(startDate, endDate) {
		revenueTrend = append(revenueTrend, model.DailyRevenue{
			Date:    date,
			Revenue: util.RoundFloat(dailyMap[date], 2),
		})
	}

	type revPair struct {
		id    string
		value float64
		plays int64
	}

	var workList []revPair
	for id, rev := range workRev {
		workList = append(workList, revPair{id: id, value: rev, plays: workPlay[id]})
	}
	sort.Slice(workList, func(i, j int) bool { return workList[i].value > workList[j].value })

	var playRanking []model.WorkRanking
	for i, wp := range workList {
		if i >= 10 {
			break
		}
		w := s.repo.GetWork(wp.id)
		if w == nil {
			continue
		}
		playRanking = append(playRanking, model.WorkRanking{
			Rank:      i + 1,
			WorkID:    wp.id,
			WorkTitle: w.Title,
			PlayCount: wp.plays,
			Revenue:   util.RoundFloat(wp.value, 2),
		})
	}

	var platformShare []model.PlatformShareItem
	for p, rev := range platformRev {
		share := 0.0
		if totalRev > 0 {
			share = util.RoundFloat(rev/totalRev*100, 2)
		}
		platformShare = append(platformShare, model.PlatformShareItem{
			Platform: p,
			Name:     model.PlatformNames[p],
			Revenue:  util.RoundFloat(rev, 2),
			Share:    share,
		})
	}
	sort.Slice(platformShare, func(i, j int) bool { return platformShare[i].Revenue > platformShare[j].Revenue })

	var artistList []revPair
	for id, rev := range artistRev {
		artistList = append(artistList, revPair{id: id, value: rev, plays: artistPlay[id]})
	}
	sort.Slice(artistList, func(i, j int) bool { return artistList[i].value > artistList[j].value })

	var artistRanking []model.ArtistRankingItem
	for i, ap := range artistList {
		if i >= 10 {
			break
		}
		a := s.repo.GetArtist(ap.id)
		if a == nil {
			continue
		}
		artistRanking = append(artistRanking, model.ArtistRankingItem{
			Rank:       i + 1,
			ArtistID:   ap.id,
			ArtistName: a.Name,
			Revenue:    util.RoundFloat(ap.value, 2),
			PlayCount:  ap.plays,
		})
	}

	summary := &model.DashboardSummary{
		PeriodRange:   [2]time.Time{startDate, endDate},
		TotalRevenue:  util.RoundFloat(totalRev, 2),
		RevenueTrend:  revenueTrend,
		PlayRanking:   playRanking,
		PlatformShare: platformShare,
		ArtistRanking: artistRanking,
		ReleaseStats: model.ReleaseStats{
			AlbumCount:  albumCount,
			SingleCount: singleCount,
			EPCount:     epCount,
			TotalCount:  albumCount + singleCount + epCount,
		},
	}

	_ = s.redis.Set(ctx, cacheKey, summary, 5*time.Minute)
	return summary, nil
}

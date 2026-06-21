package parser

import (
	"strings"
	"sync"
	"time"

	"copyright-monitor/internal/config"
	"copyright-monitor/internal/models"
	"copyright-monitor/internal/storage"
	"copyright-monitor/pkg/simhash"

	"go.uber.org/zap"
)

type MatchResult struct {
	Work       *models.CopyrightWork
	Content    *models.CrawledContent
	Similarity float64
}

type Parser struct {
	logger    *zap.Logger
	workCache []*models.CopyrightWork
	mu        sync.RWMutex
}

var globalParser *Parser

func NewParser(logger *zap.Logger) *Parser {
	return &Parser{
		logger: logger,
	}
}

func Init(logger *zap.Logger) {
	globalParser = NewParser(logger)
}

func Global() *Parser {
	return globalParser
}

func (p *Parser) LoadWorks() error {
	works, err := storage.Global().GetAllWorks()
	if err != nil {
		return err
	}

	p.mu.Lock()
	p.workCache = works
	p.mu.Unlock()

	p.logger.Info("Works loaded into parser cache",
		zap.Int("count", len(works)),
	)

	return nil
}

func (p *Parser) ComputeFingerprint(text string) uint64 {
	return simhash.Compute(text)
}

func (p *Parser) CalculateSimilarity(fp1, fp2 uint64) float64 {
	return simhash.Similarity(fp1, fp2)
}

func (p *Parser) MatchContent(content *models.CrawledContent, threshold float64) []*MatchResult {
	p.mu.RLock()
	works := p.workCache
	p.mu.RUnlock()

	var results []*MatchResult
	threshold = config.Get().SimThreshold

	contentFP := content.Fingerprint
	if contentFP == 0 {
		contentFP = p.ComputeFingerprint(content.Title + " " + content.Content)
	}

	for _, work := range works {
		if work.Fingerprint == 0 {
			continue
		}

		sim := p.CalculateSimilarity(contentFP, work.Fingerprint)
		if sim >= threshold {
			results = append(results, &MatchResult{
				Work:       work,
				Content:    content,
				Similarity: sim,
			})
		}
	}

	return results
}

func (p *Parser) BatchMatch(contents []*models.CrawledContent) []*MatchResult {
	var allResults []*MatchResult
	var mu sync.Mutex
	var wg sync.WaitGroup

	sem := make(chan struct{}, 10)

	for _, content := range contents {
		wg.Add(1)
		sem <- struct{}{}

		go func(c *models.CrawledContent) {
			defer wg.Done()
			defer func() { <-sem }()

			results := p.MatchContent(c, config.Get().SimThreshold)
			if len(results) > 0 {
				mu.Lock()
				allResults = append(allResults, results...)
				mu.Unlock()
			}
		}(content)
	}

	wg.Wait()
	return allResults
}

func (p *Parser) MatchByWorkType(contents []*models.CrawledContent, workType models.WorkType) []*MatchResult {
	p.mu.RLock()
	works := p.workCache
	p.mu.RUnlock()

	var filteredWorks []*models.CopyrightWork
	for _, w := range works {
		if w.WorkType == workType {
			filteredWorks = append(filteredWorks, w)
		}
	}

	var results []*MatchResult
	for _, content := range contents {
		contentFP := content.Fingerprint
		if contentFP == 0 {
			contentFP = p.ComputeFingerprint(content.Title + " " + content.Content)
		}

		for _, work := range filteredWorks {
			if work.Fingerprint == 0 {
				continue
			}

			sim := p.CalculateSimilarity(contentFP, work.Fingerprint)
			if sim >= config.Get().SimThreshold {
				results = append(results, &MatchResult{
					Work:       work,
					Content:    content,
					Similarity: sim,
				})
			}
		}
	}

	return results
}

func (p *Parser) CreateInfringementClue(result *MatchResult, taskID int64) *models.InfringementClue {
	return &models.InfringementClue{
		TaskID:            taskID,
		WorkID:            result.Work.ID,
		WorkTitle:         result.Work.Title,
		WorkType:          result.Work.WorkType,
		Owner:             result.Work.Owner,
		OwnerContact:      result.Work.OwnerContact,
		RegistrationNo:    result.Work.RegistrationNo,
		PlatformName:      result.Content.PlatformName,
		InfringementURL:   result.Content.URL,
		InfringementTitle: result.Content.Title,
		Similarity:        result.Similarity,
		DiscoverTime:      time.Now(),
		Status:            "pending",
	}
}

func (p *Parser) ProcessCrawledContents(contents []*models.CrawledContent, taskID int64) ([]*models.InfringementClue, error) {
	matches := p.BatchMatch(contents)
	var clues []*models.InfringementClue

	for _, match := range matches {
		clue := p.CreateInfringementClue(match, taskID)

		clueID, err := storage.Global().AddClue(clue)
		if err != nil {
			p.logger.Error("Failed to add clue",
				zap.String("work", match.Work.Title),
				zap.String("url", match.Content.URL),
				zap.Error(err),
			)
			continue
		}
		clue.ID = clueID

		evidence := &models.Evidence{
			ClueID:       clueID,
			URL:          match.Content.URL,
			RawHTML:      match.Content.RawHTML,
			HTTPHeaders:  match.Content.HTTPHeaders,
			CrawlTime:    match.Content.CrawlTime,
		}
		evidenceID, err := storage.Global().AddEvidence(evidence)
		if err != nil {
			p.logger.Error("Failed to add evidence", zap.Error(err))
		}
		clue.EvidenceID = evidenceID

		reportPath, err := storage.Global().GenerateEvidenceFile(clue, match.Content)
		if err != nil {
			p.logger.Error("Failed to generate evidence report", zap.Error(err))
		} else {
			storage.Global().SaveEvidenceReport(clueID, reportPath)
		}

		storage.Global().IncrementInfringementCount(match.Work.ID)

		clues = append(clues, clue)

		p.logger.Warn("Infringement detected",
			zap.String("work", match.Work.Title),
			zap.String("platform", match.Content.PlatformName),
			zap.Float64("similarity", match.Similarity),
			zap.String("url", match.Content.URL),
		)
	}

	return clues, nil
}

func (p *Parser) RefreshWorkCache() error {
	return p.LoadWorks()
}

func CleanText(text string) string {
	text = strings.TrimSpace(text)
	text = strings.ReplaceAll(text, "\r", "")
	text = strings.ReplaceAll(text, "\t", " ")

	var builder strings.Builder
	prevSpace := false
	for _, r := range text {
		if r == ' ' || r == '\n' {
			if !prevSpace {
				builder.WriteRune(' ')
				prevSpace = true
			}
		} else {
			builder.WriteRune(r)
			prevSpace = false
		}
	}

	return strings.TrimSpace(builder.String())
}

func ExtractKeywords(text string, maxCount int) []string {
	words := strings.Fields(strings.ToLower(text))
	freq := make(map[string]int)

	for _, word := range words {
		if len(word) < 2 {
			continue
		}
		freq[word]++
	}

	type kv struct {
		word  string
		count int
	}
	var sorted []kv
	for w, c := range freq {
		sorted = append(sorted, kv{w, c})
	}

	for i := 0; i < len(sorted)-1; i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].count > sorted[i].count {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	var keywords []string
	for i := 0; i < maxCount && i < len(sorted); i++ {
		keywords = append(keywords, sorted[i].word)
	}

	return keywords
}

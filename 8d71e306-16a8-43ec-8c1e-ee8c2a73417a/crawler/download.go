package crawler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/cdproto/browser"
	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/chromedp"
	"go.uber.org/zap"

	"drug-bid-crawler/config"
	"drug-bid-crawler/parser"
	"drug-bid-crawler/storage"
)

type Downloader struct {
	browser       *Browser
	projectID     string
	projectName   string
	downloadDir   string
	concurrency   int
	progressChan  chan DownloadProgress
	stats         *InternalDownloadStats
	startTime     time.Time
}

type InternalDownloadStats struct {
	TotalFiles     int64
	CompletedFiles int64
	FailedFiles    int64
	SkippedFiles   int64
	TotalBytes     int64
	DownloadedBytes int64
	mu             sync.Mutex
}

type DownloadProgress struct {
	FileName       string
	Current        int64
	Total          int64
	Percentage     float64
	Speed          float64
	ETA            string
	Status         string
}

type downloadTask struct {
	file    storage.QualificationFile
	company storage.BidCompany
}

func NewDownloader(b *Browser, projectID string) *Downloader {
	project, _ := storage.GetProject(projectID)
	projectName := ""
	if project != nil {
		projectName = project.ProjectName
	}

	return &Downloader{
		browser:     b,
		projectID:   projectID,
		projectName: projectName,
		downloadDir: config.GlobalConfig.DownloadDir,
		concurrency: config.GlobalConfig.Concurrency,
		stats:       &InternalDownloadStats{},
		progressChan: make(chan DownloadProgress, 100),
	}
}

func (d *Downloader) GetProgressChan() <-chan DownloadProgress {
	return d.progressChan
}

func (d *Downloader) Start() error {
	d.startTime = time.Now()
	config.Logger.Info("开始下载资质文件",
		zap.String("project_id", d.projectID),
		zap.Int("concurrency", d.concurrency),
	)

	files, err := storage.GetPendingFiles(d.projectID)
	if err != nil {
		return fmt.Errorf("get pending files: %w", err)
	}

	if config.GlobalConfig.RetryFailed {
		files, err = storage.GetFilesByProject(d.projectID, storage.StatusFailed)
		if err != nil {
			return fmt.Errorf("get failed files: %w", err)
		}
	}

	if len(files) == 0 {
		config.Logger.Info("没有待下载的文件")
		return nil
	}

	atomic.StoreInt64(&d.stats.TotalFiles, int64(len(files)))
	config.Logger.Info("待下载文件数", zap.Int("count", len(files)))

	companies, err := storage.GetCompaniesByProject(d.projectID)
	if err != nil {
		return fmt.Errorf("get companies: %w", err)
	}

	companyMap := make(map[string]storage.BidCompany)
	for _, c := range companies {
		companyMap[c.CompanyID] = c
	}

	taskChan := make(chan downloadTask, len(files))
	for _, file := range files {
		taskChan <- downloadTask{
			file:    file,
			company: companyMap[file.CompanyID],
		}
	}
	close(taskChan)

	var wg sync.WaitGroup
	for i := 0; i < d.concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			d.worker(workerID, taskChan)
		}(i)
	}

	go d.monitorProgress()

	wg.Wait()
	close(d.progressChan)

	d.printSummary()
	return nil
}

func (d *Downloader) worker(workerID int, taskChan <-chan downloadTask) {
	for task := range taskChan {
		ctx, cancel, err := d.browser.NewTab()
		if err != nil {
			config.Logger.Error("创建标签页失败", zap.Int("worker", workerID), zap.Error(err))
			d.handleDownloadError(&task.file, err)
			continue
		}

		if err := d.downloadFile(ctx, &task.file, &task.company); err != nil {
			d.handleDownloadError(&task.file, err)
		}

		cancel()
		d.browser.RandomSleep(0, 0)
	}
}

func (d *Downloader) downloadFile(ctx context.Context, file *storage.QualificationFile, company *storage.BidCompany) error {
	storage.UpdateFileStatus(file.FileID, storage.StatusDownloading, "")
	atomic.AddInt64(&d.stats.TotalFiles, 1)

	startTime := time.Now()
	record := &storage.DownloadRecord{
		FileID:    file.FileID,
		ProjectID: d.projectID,
		CompanyID: file.CompanyID,
		StartTime: startTime,
		Status:    storage.StatusDownloading,
	}
	storage.SaveDownloadRecord(record)

	if config.GlobalConfig.Incremental {
		if d.checkExistingFile(file) {
			d.markSkipped(file, record, startTime)
			return nil
		}
	}

	targetDir := d.getCompanyDir(file.CompanyName)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("create dir: %w", err)
	}

	var downloadedPath string
	var err error

	for i := 0; i < config.GlobalConfig.MaxRetry; i++ {
		if i > 0 {
			storage.IncrementRetryCount(file.FileID)
			config.Logger.Info("重试下载", zap.String("file", file.FileName), zap.Int("retry", i+1))
		}

		downloadedPath, err = d.triggerDownload(ctx, file, targetDir)
		if err == nil {
			break
		}
		config.Logger.Warn("下载失败",
			zap.String("file", file.FileName),
			zap.Int("retry", i+1),
			zap.Error(err),
		)
	}

	if err != nil {
		return err
	}

	downloadTime := time.Since(startTime).Seconds()
	fileSize, _ := getFileSize(downloadedPath)
	speed := float64(fileSize) / downloadTime / 1024 / 1024

	newFileName, err := d.renameFile(downloadedPath, file, company)
	if err != nil {
		config.Logger.Warn("重命名文件失败", zap.Error(err))
		newFileName = downloadedPath
	}

	fileHash := calculateFileHash(newFileName)

	now := time.Now()
	endTime := now
	file.LocalPath = newFileName
	file.DownloadStatus = storage.StatusCompleted
	file.DownloadedAt = &now
	file.DownloadTime = downloadTime
	file.FileSize = fileSize
	file.FileHash = fileHash
	storage.SaveFile(file)

	record.EndTime = &endTime
	record.FileSize = fileSize
	record.DownloadTime = downloadTime
	record.Speed = speed
	record.Status = storage.StatusCompleted
	storage.SaveDownloadRecord(record)

	d.updateCompanyStats(company)

	d.sendProgress(file.FileName, fileSize, fileSize, downloadTime)

	atomic.AddInt64(&d.stats.CompletedFiles, 1)
	d.stats.mu.Lock()
	d.stats.DownloadedBytes += fileSize
	d.stats.mu.Unlock()

	config.Logger.Info("下载完成",
		zap.String("file", filepath.Base(newFileName)),
		zap.Int64("size", fileSize),
		zap.Float64("time", downloadTime),
		zap.Float64("speed_mb", speed),
	)

	return nil
}

func (d *Downloader) triggerDownload(ctx context.Context, file *storage.QualificationFile, targetDir string) (string, error) {
	if err := d.browser.Navigate(ctx, file.FileURL, config.GlobalConfig.DownloadTimeout); err != nil {
		return "", fmt.Errorf("navigate: %w", err)
	}

	downloadFinished := make(chan string, 1)
	downloadErr := make(chan error, 1)

	chromedp.ListenTarget(ctx, func(ev interface{}) {
		switch e := ev.(type) {
		case *browser.EventDownloadWillBegin:
			config.Logger.Debug("开始下载",
				zap.String("url", e.URL),
				zap.String("file", e.SuggestedFilename),
			)

		case *browser.EventDownloadProgress:
			if e.State == browser.DownloadProgressStateCompleted {
				dlPath := filepath.Join(targetDir, filepath.Base(e.GUID))
				downloadFinished <- dlPath
			}
		}
	})

	canDownload := make(chan bool, 1)
	go func() {
		err := chromedp.Run(ctx,
			browser.SetDownloadBehavior(browser.SetDownloadBehaviorBehaviorAllowAndName).
				WithDownloadPath(targetDir),
			chromedp.WaitVisible("a.download-btn, .download-link", chromedp.ByQuery),
			chromedp.Click("a.download-btn, .download-link", chromedp.ByQuery),
		)
		if err != nil {
			downloadErr <- err
			return
		}
		canDownload <- true
	}()

	select {
	case <-canDownload:
	case err := <-downloadErr:
		return "", err
	}

	select {
	case path := <-downloadFinished:
		return path, nil
	case <-time.After(config.GlobalConfig.DownloadTimeout):
		return "", fmt.Errorf("download timeout")
	}
}

func (d *Downloader) checkExistingFile(file *storage.QualificationFile) bool {
	if file.LocalPath == "" {
		return false
	}

	if _, err := os.Stat(file.LocalPath); os.IsNotExist(err) {
		return false
	}

	existingSize, _ := getFileSize(file.LocalPath)
	if file.FileSize > 0 && existingSize == file.FileSize {
		existingHash := calculateFileHash(file.LocalPath)
		if existingHash == file.FileHash {
			return true
		}
	}

	return false
}

func (d *Downloader) markSkipped(file *storage.QualificationFile, record *storage.DownloadRecord, startTime time.Time) {
	file.DownloadStatus = storage.StatusSkipped
	storage.SaveFile(file)

	now := time.Now()
	record.EndTime = &now
	record.Status = storage.StatusSkipped
	storage.SaveDownloadRecord(record)

	atomic.AddInt64(&d.stats.SkippedFiles, 1)
	d.sendProgress(file.FileName, 0, 0, 0)

	config.Logger.Info("跳过已存在文件", zap.String("file", file.FileName))
}

func (d *Downloader) renameFile(downloadedPath string, file *storage.QualificationFile, company *storage.BidCompany) (string, error) {
	info := parser.ParseFileInfo(file.FileName, company.CompanyName)

	var expiryStr string
	if file.ExpiryDate != nil {
		expiryStr = file.ExpiryDate.Format("20060102")
	} else if info.ExpiryDate != nil {
		expiryStr = info.ExpiryDate.Format("20060102")
		file.ExpiryDate = info.ExpiryDate
	} else {
		expiryStr = "长期"
	}

	certType := info.CertType
	if certType == "" {
		certType = file.CertType
	}
	if certType == "" {
		certType = "资质文件"
	}

	ext := filepath.Ext(downloadedPath)
	if ext == "" {
		ext = file.Extension
		if ext == "" {
			ext = ".pdf"
		}
	}

	cleanName := sanitizeFileName(fmt.Sprintf("%s_%s_%s%s",
		company.CompanyName,
		certType,
		expiryStr,
		ext,
	))

	newPath := filepath.Join(filepath.Dir(downloadedPath), cleanName)

	if _, err := os.Stat(newPath); err == nil {
		base := strings.TrimSuffix(newPath, ext)
		counter := 1
		for {
			newPath = fmt.Sprintf("%s_%d%s", base, counter, ext)
			if _, err := os.Stat(newPath); os.IsNotExist(err) {
				break
			}
			counter++
		}
	}

	if err := os.Rename(downloadedPath, newPath); err != nil {
		return "", err
	}

	return newPath, nil
}

func (d *Downloader) getCompanyDir(companyName string) string {
	safeProjectName := sanitizeFileName(d.projectName)
	if safeProjectName == "" {
		safeProjectName = d.projectID
	}
	safeCompanyName := sanitizeFileName(companyName)
	return filepath.Join(d.downloadDir, safeProjectName, safeCompanyName)
}

func (d *Downloader) handleDownloadError(file *storage.QualificationFile, err error) {
	atomic.AddInt64(&d.stats.FailedFiles, 1)
	file.DownloadStatus = storage.StatusFailed
	file.ErrorMsg = err.Error()
	storage.SaveFile(file)

	storage.LogExecution(d.projectID, "ERROR",
		fmt.Sprintf("下载失败: %s", file.FileName),
		err.Error(),
	)

	config.Logger.Error("文件下载失败",
		zap.String("file_id", file.FileID),
		zap.String("file_name", file.FileName),
		zap.Error(err),
	)
}

func (d *Downloader) updateCompanyStats(company *storage.BidCompany) {
	company.Downloaded++
	storage.SaveCompany(company)
}

func (d *Downloader) sendProgress(fileName string, current, total int64, elapsed float64) {
	if !config.GlobalConfig.ShowProgress {
		return
	}

	percentage := 0.0
	if total > 0 {
		percentage = float64(current) / float64(total) * 100
	}

	speed := 0.0
	if elapsed > 0 {
		speed = float64(current) / elapsed / 1024 / 1024
	}

	var eta string
	if speed > 0 && total > current {
		remainingBytes := total - current
		remainingSeconds := float64(remainingBytes) / (speed * 1024 * 1024)
		eta = fmt.Sprintf("%.0fs", remainingSeconds)
	}

	select {
	case d.progressChan <- DownloadProgress{
		FileName:   fileName,
		Current:    current,
		Total:      total,
		Percentage: percentage,
		Speed:      speed,
		ETA:        eta,
		Status:     "downloading",
	}:
	default:
	}
}

func (d *Downloader) monitorProgress() {
	if !config.GlobalConfig.ShowProgress {
		return
	}

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		completed := atomic.LoadInt64(&d.stats.CompletedFiles)
		failed := atomic.LoadInt64(&d.stats.FailedFiles)
		skipped := atomic.LoadInt64(&d.stats.SkippedFiles)
		total := atomic.LoadInt64(&d.stats.TotalFiles)

		if total == 0 {
			continue
		}

		processed := completed + failed + skipped
		progress := float64(processed) / float64(total) * 100

		elapsed := time.Since(d.startTime).Seconds()
		speed := 0.0
		if elapsed > 0 {
			d.stats.mu.Lock()
			speed = float64(d.stats.DownloadedBytes) / elapsed / 1024 / 1024
			d.stats.mu.Unlock()
		}

		var eta string
		if speed > 0 && processed < total {
			d.stats.mu.Lock()
			remainingBytes := d.stats.TotalBytes - d.stats.DownloadedBytes
			d.stats.mu.Unlock()
			if remainingBytes > 0 {
				remainingSeconds := float64(remainingBytes) / (speed * 1024 * 1024)
				eta = formatDuration(remainingSeconds)
			}
		}

		bar := drawProgressBar(progress, 50)

		fmt.Printf("\r%s 已完成:%d/%d 失败:%d 跳过:%d 速度:%.2fMB/s ETA:%s",
			bar, completed, total, failed, skipped, speed, eta,
		)

		if processed >= total {
			fmt.Println()
			break
		}
	}
}

func (d *Downloader) printSummary() {
	elapsed := time.Since(d.startTime)
	completed := atomic.LoadInt64(&d.stats.CompletedFiles)
	failed := atomic.LoadInt64(&d.stats.FailedFiles)
	skipped := atomic.LoadInt64(&d.stats.SkippedFiles)
	total := atomic.LoadInt64(&d.stats.TotalFiles)

	d.stats.mu.Lock()
	downloadedMB := float64(d.stats.DownloadedBytes) / 1024 / 1024
	d.stats.mu.Unlock()

	successRate := 0.0
	if total > 0 {
		successRate = float64(completed) / float64(total) * 100
	}

	config.Logger.Info("下载任务完成",
		zap.Int64("total", total),
		zap.Int64("completed", completed),
		zap.Int64("failed", failed),
		zap.Int64("skipped", skipped),
		zap.Float64("success_rate", successRate),
		zap.Float64("downloaded_mb", downloadedMB),
		zap.Duration("elapsed", elapsed),
	)

	fmt.Println("\n" + strings.Repeat("=", 60))
	fmt.Println("下载完成统计:")
	fmt.Printf("  总文件数:    %d\n", total)
	fmt.Printf("  成功:        %d\n", completed)
	fmt.Printf("  失败:        %d\n", failed)
	fmt.Printf("  跳过:        %d\n", skipped)
	fmt.Printf("  成功率:      %.2f%%\n", successRate)
	fmt.Printf("  下载总量:    %.2f MB\n", downloadedMB)
	fmt.Printf("  总耗时:      %s\n", elapsed)
	fmt.Println(strings.Repeat("=", 60))
}

func (d *Downloader) ParseBidProjects(ctx context.Context) ([]storage.BidProject, error) {
	if err := d.browser.Navigate(ctx, config.GlobalConfig.BidListURL, 30*time.Second); err != nil {
		return nil, fmt.Errorf("navigate to bid list: %w", err)
	}

	html, err := d.browser.GetHTML(ctx, "body")
	if err != nil {
		return nil, fmt.Errorf("get html: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}

	var projects []storage.BidProject
	doc.Find(".bid-list .bid-item").Each(func(i int, s *goquery.Selection) {
		projectID, _ := s.Attr("data-project-id")
		projectName := strings.TrimSpace(s.Find(".project-name").Text())
		projectURL, _ := s.Find(".project-link").Attr("href")
		signupStart := parseDate(s.Find(".signup-start").Text())
		signupEnd := parseDate(s.Find(".signup-end").Text())
		bidOpenTime := parseDate(s.Find(".bid-open-time").Text())

		if projectID != "" && projectName != "" {
			project := storage.BidProject{
				ProjectID:   projectID,
				ProjectName: projectName,
				ProjectURL:  projectURL,
				SignUpStart: signupStart,
				SignUpEnd:   signupEnd,
				BidOpenTime: bidOpenTime,
				Status:      "active",
			}
			projects = append(projects, project)
		}
	})

	return projects, nil
}

func (d *Downloader) ParseCompanyList(ctx context.Context, projectURL string) ([]storage.BidCompany, error) {
	if err := d.browser.Navigate(ctx, projectURL, 30*time.Second); err != nil {
		return nil, fmt.Errorf("navigate to project: %w", err)
	}

	hasMore := true
	for hasMore {
		var err error
		hasMore, err = d.browser.LoadMore(ctx, ".load-more-btn")
		if err != nil {
			config.Logger.Warn("加载更多失败", zap.Error(err))
			break
		}
	}

	html, err := d.browser.GetHTML(ctx, "body")
	if err != nil {
		return nil, fmt.Errorf("get html: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}

	var companies []storage.BidCompany
	doc.Find(".company-list .company-item").Each(func(i int, s *goquery.Selection) {
		companyID, _ := s.Attr("data-company-id")
		companyName := strings.TrimSpace(s.Find(".company-name").Text())
		detailURL, _ := s.Find(".detail-link").Attr("href")
		contact := strings.TrimSpace(s.Find(".contact").Text())
		phone := strings.TrimSpace(s.Find(".phone").Text())

		if companyID != "" && companyName != "" {
			company := storage.BidCompany{
				ProjectID:   d.projectID,
				CompanyID:   companyID,
				CompanyName: companyName,
				DetailURL:   detailURL,
				Contact:     contact,
				Phone:       phone,
			}
			companies = append(companies, company)
		}
	})

	return companies, nil
}

func (d *Downloader) ParseCompanyFiles(ctx context.Context, company *storage.BidCompany) ([]storage.QualificationFile, error) {
	if err := d.browser.Navigate(ctx, company.DetailURL, 30*time.Second); err != nil {
		return nil, fmt.Errorf("navigate to company: %w", err)
	}

	hasMore := true
	for hasMore {
		var err error
		hasMore, err = d.browser.LoadMore(ctx, ".load-more-files")
		if err != nil {
			break
		}
	}

	html, err := d.browser.GetHTML(ctx, "body")
	if err != nil {
		return nil, fmt.Errorf("get html: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}

	var files []storage.QualificationFile
	doc.Find(".file-list .file-item").Each(func(i int, s *goquery.Selection) {
		fileID, _ := s.Attr("data-file-id")
		fileName := strings.TrimSpace(s.Find(".file-name").Text())
		fileType := strings.TrimSpace(s.Find(".file-type").Text())
		certType := strings.TrimSpace(s.Find(".cert-type").Text())
		certNumber := strings.TrimSpace(s.Find(".cert-number").Text())
		expiryDateStr := strings.TrimSpace(s.Find(".expiry-date").Text())
		fileURL, _ := s.Find(".download-link").Attr("href")
		fileSizeStr := strings.TrimSpace(s.Find(".file-size").Text())

		if fileID != "" && fileName != "" {
			info := parser.ParseFileInfo(fileName, company.CompanyName)

			var expiryDate *time.Time
			if expiryDateStr != "" {
				t := parseDate(expiryDateStr)
				if !t.IsZero() {
					expiryDate = &t
				}
			}
			if expiryDate == nil && info.ExpiryDate != nil {
				expiryDate = info.ExpiryDate
			}

			certStatus := storage.CertValid
			if expiryDate != nil {
				daysLeft := int(time.Until(*expiryDate).Hours() / 24)
				if daysLeft <= 0 {
					certStatus = storage.CertExpired
				} else if daysLeft <= config.GlobalConfig.WarnDays {
					certStatus = storage.CertWarning
				}
			}

			if info.CertType != "" {
				certType = info.CertType
			}

			file := storage.QualificationFile{
				ProjectID:      d.projectID,
				CompanyID:      company.CompanyID,
				CompanyName:    company.CompanyName,
				FileID:         fileID,
				FileName:       fileName,
				FileType:       fileType,
				CertType:       certType,
				CertNumber:     certNumber,
				ExpiryDate:     expiryDate,
				CertStatus:     certStatus,
				FileURL:        fileURL,
				FileSize:       parseFileSize(fileSizeStr),
				Extension:      filepath.Ext(fileName),
				DownloadStatus: storage.StatusPending,
			}
			files = append(files, file)
		}
	})

	company.FileCount = len(files)
	storage.SaveCompany(company)

	return files, nil
}

func parseDate(s string) time.Time {
	formats := []string{
		"2006-01-02",
		"2006/01/02",
		"2006年01月02日",
		"2006-01-02 15:04:05",
		"2006/01/02 15:04:05",
		time.RFC3339,
	}

	for _, format := range formats {
		if t, err := time.ParseInLocation(format, strings.TrimSpace(s), time.Local); err == nil {
			return t
		}
	}
	return time.Time{}
}

func parseFileSize(s string) int64 {
	s = strings.ToUpper(strings.TrimSpace(s))
	var size int64
	var unit string

	re := regexp.MustCompile(`([\d.]+)\s*(KB|MB|GB|B)`)
	matches := re.FindStringSubmatch(s)
	if len(matches) == 3 {
		fmt.Sscanf(matches[1], "%f", &size)
		unit = matches[2]
	}

	switch unit {
	case "KB":
		size *= 1024
	case "MB":
		size *= 1024 * 1024
	case "GB":
		size *= 1024 * 1024 * 1024
	}

	return size
}

func getFileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

func calculateFileHash(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return ""
	}

	return hex.EncodeToString(h.Sum(nil))
}

func sanitizeFileName(name string) string {
	reg := regexp.MustCompile(`[\\/:*?"<>|\r\n\t]`)
	name = reg.ReplaceAllString(name, "_")
	name = strings.TrimSpace(name)
	name = strings.Trim(name, ".")
	return name
}

func drawProgressBar(progress float64, width int) string {
	filled := int(progress / 100 * float64(width))
	bar := "["
	for i := 0; i < width; i++ {
		if i < filled {
			bar += "="
		} else {
			bar += " "
		}
	}
	bar += fmt.Sprintf("] %.1f%%", progress)
	return bar
}

func formatDuration(seconds float64) string {
	if seconds < 60 {
		return fmt.Sprintf("%.0fs", seconds)
	} else if seconds < 3600 {
		minutes := int(seconds) / 60
		secs := int(seconds) % 60
		return fmt.Sprintf("%dm%ds", minutes, secs)
	} else {
		hours := int(seconds) / 3600
		minutes := (int(seconds) % 3600) / 60
		return fmt.Sprintf("%dh%dm", hours, minutes)
	}
}

func (d *Downloader) WaitForDownload(ctx context.Context, timeout time.Duration) (string, error) {
	var downloadStarted bool

	chromedp.ListenTarget(ctx, func(ev interface{}) {
		switch e := ev.(type) {
		case *network.EventResponseReceived:
			if strings.Contains(e.Response.MimeType, "application/pdf") ||
				strings.Contains(e.Response.MimeType, "octet-stream") {
				config.Logger.Debug("检测到文件响应", zap.String("url", e.Response.URL))
			}

		case *browser.EventDownloadWillBegin:
			downloadStarted = true
			config.Logger.Info("开始下载",
				zap.String("file", e.SuggestedFilename),
			)
		}
	})

	startTime := time.Now()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	var initialFiles map[string]time.Time
	files, _ := filepath.Glob(filepath.Join(d.downloadDir, "*"))
	initialFiles = make(map[string]time.Time)
	for _, f := range files {
		if info, err := os.Stat(f); err == nil {
			initialFiles[f] = info.ModTime()
		}
	}

	for {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		case <-ticker.C:
			if time.Since(startTime) > timeout {
				return "", fmt.Errorf("download timeout after %v", timeout)
			}

			files, _ := filepath.Glob(filepath.Join(d.downloadDir, "*"))
			for _, f := range files {
				info, err := os.Stat(f)
				if err != nil {
					continue
				}

				if info.Size() == 0 {
					continue
				}

				oldMod, exists := initialFiles[f]
				if !exists || info.ModTime().After(oldMod) {
					if strings.HasSuffix(strings.ToLower(f), ".crdownload") ||
						strings.HasSuffix(strings.ToLower(f), ".part") {
						continue
					}

					if downloadStarted || time.Since(info.ModTime()) < 5*time.Second {
						config.Logger.Info("检测到新下载文件",
							zap.String("file", filepath.Base(f)),
							zap.Int64("size", info.Size()),
						)
						return f, nil
					}
				}
			}
		}
	}
}

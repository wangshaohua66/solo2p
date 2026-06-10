package crawler

import (
	"regexp"
	"strings"
	"sync"

	"github.com/gocolly/colly/v2"
)

type AnnouncementLink struct {
	Title string
	URL   string
	Date  string
}

type ParsedAnnouncement struct {
	Title               string
	CaseNumber          string
	Debtor              string
	Creditors           string
	Administrator       string
	Court               string
	RulingNumber        string
	AnnouncementDateStr string
	ClaimDeadlineStr    string
	HearingDateStr      string
	Content             string
	SourceURL           string
	SourceCourt         string
	RawHTML             string
}

type AnnouncementParser interface {
	Name() string
	ListSelector() string
	DetailSelector() string
	NextPageSelector() string
	ParseList(el *colly.HTMLElement) []*AnnouncementLink
	ParseDetail(el *colly.HTMLElement, link *AnnouncementLink) (*ParsedAnnouncement, error)
	ConfigureCollector(c *colly.Collector)
}

var (
	_reCache   = make(map[string]*regexp.Regexp)
	_reCacheMu sync.Mutex
)

func reMatchFirst(pattern, text string) string {
	_reCacheMu.Lock()
	re, ok := _reCache[pattern]
	if !ok {
		var err error
		re, err = regexp.Compile(pattern)
		if err != nil {
			_reCacheMu.Unlock()
			return ""
		}
		_reCache[pattern] = re
	}
	_reCacheMu.Unlock()
	m := re.FindStringSubmatch(text)
	if len(m) == 0 {
		return ""
	}
	if len(m) >= 2 && m[1] != "" {
		return m[1]
	}
	return m[0]
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func cleanField(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "：:，,。.；;")
	return strings.TrimSpace(s)
}

func extractFields(pa *ParsedAnnouncement) {
	text := pa.Title + "\n" + pa.Content

	patterns := map[*string][]string{
		&pa.CaseNumber:        {`案[（(][^)）]*[)）][^号]*号`, `\d{4}[-—][^-—]+[-—][破清民商执][-—]\d+`},
		&pa.RulingNumber:      {`裁定[（(][^)）]*[)）][^号]*号`, `民事裁定[（(][^)）]*[)）]号`},
		&pa.Debtor:            {`债务人[:：\s]*([^\n，。；;]+)`, `被申请人[:：\s]*([^\n，。；;]+)`, `申请人[:：\s]*([^\n，。；;]+破产)`},
		&pa.Administrator:     {`管理人[:：\s]*([^\n，。；;]+)`, `破产管理人[:：\s]*([^\n，。；;]+)`},
		&pa.Court:             {`([^，。；;\s]*人民法院)`},
		&pa.ClaimDeadlineStr:  {`债权申报截止.*?(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)`, `申报期限.*?至\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)`},
		&pa.HearingDateStr:    {`[开庭听证][^，。；;\d]*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)`, `债权人会议.*?(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)`},
	}

	for field, pats := range patterns {
		for _, pat := range pats {
			if m := reMatchFirst(pat, text); m != "" {
				*field = cleanField(m)
				break
			}
		}
	}
}

type GenericParser struct{}

func (p *GenericParser) Name() string                      { return "generic" }
func (p *GenericParser) ListSelector() string              { return "a" }
func (p *GenericParser) DetailSelector() string            { return "body" }
func (p *GenericParser) NextPageSelector() string          { return "a.next, a[rel='next'], .page-next" }
func (p *GenericParser) ConfigureCollector(c *colly.Collector) {}

func (p *GenericParser) ParseList(el *colly.HTMLElement) []*AnnouncementLink {
	href := el.Attr("href")
	title := strings.TrimSpace(el.Text)
	if href == "" || title == "" || len(title) < 4 {
		return nil
	}
	return []*AnnouncementLink{{
		Title: title,
		URL:   href,
	}}
}

func (p *GenericParser) ParseDetail(el *colly.HTMLElement, link *AnnouncementLink) (*ParsedAnnouncement, error) {
	title := ""
	if link != nil {
		title = link.Title
	}
	if t := el.ChildText("h1, h2, h3, .title, .article-title"); t != "" {
		title = strings.TrimSpace(t)
	}
	content := el.ChildText("article, .content, .article-content, #content, .detail, .news-detail, body")
	if content == "" {
		content = el.Text
	}

	pa := &ParsedAnnouncement{
		Title:   title,
		Content: strings.TrimSpace(content),
	}
	if link != nil {
		if pa.Title == "" {
			pa.Title = link.Title
		}
		pa.AnnouncementDateStr = link.Date
	}

	extractFields(pa)
	return pa, nil
}

type SupremeCourtParser struct{}

func (p *SupremeCourtParser) Name() string            { return "supreme" }
func (p *SupremeCourtParser) ListSelector() string    { return ".news_list li, .list li, ul.list li" }
func (p *SupremeCourtParser) DetailSelector() string  { return ".detail, .article, #content" }
func (p *SupremeCourtParser) NextPageSelector() string { return ".pagination a.next, .page a.next" }
func (p *SupremeCourtParser) ConfigureCollector(c *colly.Collector) {}

func (p *SupremeCourtParser) ParseList(el *colly.HTMLElement) []*AnnouncementLink {
	a := el.DOM.Find("a")
	if a.Length() == 0 {
		return nil
	}
	href, _ := a.Attr("href")
	title := strings.TrimSpace(a.Text())
	date := strings.TrimSpace(el.DOM.Find(".date, .time, span.time").Text())
	return []*AnnouncementLink{{
		Title: title,
		URL:   href,
		Date:  date,
	}}
}

func (p *SupremeCourtParser) ParseDetail(el *colly.HTMLElement, link *AnnouncementLink) (*ParsedAnnouncement, error) {
	pa := &ParsedAnnouncement{}
	if link != nil {
		pa.Title = link.Title
		pa.AnnouncementDateStr = link.Date
	}
	pa.Title = firstNonEmpty(el.ChildText("h1, h2, .title, h3"), pa.Title)
	pa.Content = el.ChildText(".content, .article-content, .detail-content, #fontzoom")
	if pa.Content == "" {
		pa.Content = el.Text
	}
	pa.Court = "最高人民法院"
	extractFields(pa)
	return pa, nil
}

type HighCourtParser struct{}

func (p *HighCourtParser) Name() string             { return "high" }
func (p *HighCourtParser) ListSelector() string     { return "ul.news-list li, ul.list li, .list-item" }
func (p *HighCourtParser) DetailSelector() string   { return ".news-detail, .article-detail, .content" }
func (p *HighCourtParser) NextPageSelector() string { return ".pagination .next, .page-next, a.next" }
func (p *HighCourtParser) ConfigureCollector(c *colly.Collector) {}

func (p *HighCourtParser) ParseList(el *colly.HTMLElement) []*AnnouncementLink {
	a := el.DOM.Find("a")
	if a.Length() == 0 {
		return nil
	}
	href, _ := a.Attr("href")
	title := strings.TrimSpace(a.Text())
	date := strings.TrimSpace(el.DOM.Find(".date, span.time, .pub-time").Text())
	if title == "" {
		return nil
	}
	return []*AnnouncementLink{{
		Title: title,
		URL:   href,
		Date:  date,
	}}
}

func (p *HighCourtParser) ParseDetail(el *colly.HTMLElement, link *AnnouncementLink) (*ParsedAnnouncement, error) {
	pa := &ParsedAnnouncement{}
	if link != nil {
		pa.Title = link.Title
		pa.AnnouncementDateStr = link.Date
	}
	pa.Title = firstNonEmpty(el.ChildText("h1, h2, .title"), pa.Title)
	pa.Content = el.ChildText(".TRS_Editor, .content, .article, .news_content")
	if pa.Content == "" {
		pa.Content = el.Text
	}
	extractFields(pa)
	return pa, nil
}

type MiddleCourtParser struct{}

func (p *MiddleCourtParser) Name() string             { return "middle" }
func (p *MiddleCourtParser) ListSelector() string     { return ".news-list li, .list-group li, table.list tr" }
func (p *MiddleCourtParser) DetailSelector() string   { return ".article, .detail, .content-body" }
func (p *MiddleCourtParser) NextPageSelector() string { return ".pager .next, .pagination li.next a" }
func (p *MiddleCourtParser) ConfigureCollector(c *colly.Collector) {}

func (p *MiddleCourtParser) ParseList(el *colly.HTMLElement) []*AnnouncementLink {
	a := el.DOM.Find("a")
	if a.Length() == 0 {
		return nil
	}
	href, _ := a.Attr("href")
	title := strings.TrimSpace(a.Text())
	date := strings.TrimSpace(el.DOM.Find("td:last-child, .date, span").Last().Text())
	if title == "" {
		return nil
	}
	return []*AnnouncementLink{{
		Title: title,
		URL:   href,
		Date:  date,
	}}
}

func (p *MiddleCourtParser) ParseDetail(el *colly.HTMLElement, link *AnnouncementLink) (*ParsedAnnouncement, error) {
	pa := &ParsedAnnouncement{}
	if link != nil {
		pa.Title = link.Title
		pa.AnnouncementDateStr = link.Date
	}
	pa.Title = firstNonEmpty(el.ChildText("h1, h2, .article-title, .title"), pa.Title)
	pa.Content = el.ChildText(".content, .detail-content, .article-content, #content")
	if pa.Content == "" {
		pa.Content = el.Text
	}
	extractFields(pa)
	return pa, nil
}

type BasicCourtParser struct{}

func (p *BasicCourtParser) Name() string             { return "basic" }
func (p *BasicCourtParser) ListSelector() string     { return "ul li, .news li, .list li" }
func (p *BasicCourtParser) DetailSelector() string   { return "article, .content, body" }
func (p *BasicCourtParser) NextPageSelector() string { return "a:contains('下一页'), .page-next" }
func (p *BasicCourtParser) ConfigureCollector(c *colly.Collector) {}

func (p *BasicCourtParser) ParseList(el *colly.HTMLElement) []*AnnouncementLink {
	a := el.DOM.Find("a")
	if a.Length() == 0 {
		return nil
	}
	href, _ := a.Attr("href")
	title := strings.TrimSpace(a.Text())
	if len(title) < 4 {
		return nil
	}
	return []*AnnouncementLink{{
		Title: title,
		URL:   href,
	}}
}

func (p *BasicCourtParser) ParseDetail(el *colly.HTMLElement, link *AnnouncementLink) (*ParsedAnnouncement, error) {
	pa := &ParsedAnnouncement{}
	if link != nil {
		pa.Title = link.Title
	}
	pa.Title = firstNonEmpty(el.ChildText("h1, h2, h3, .title"), pa.Title)
	pa.Content = el.ChildText(".content, .article, .detail, body")
	extractFields(pa)
	return pa, nil
}

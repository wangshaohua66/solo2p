package scraper

var scraperFactories = map[string]func(SiteConfig, *BrowserPool, *StaticScraper, string) Scraper{}

func RegisterScraper(name string, factory func(SiteConfig, *BrowserPool, *StaticScraper, string) Scraper) {
	scraperFactories[name] = factory
}

func GetScraper(name string, config SiteConfig, pool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) (Scraper, bool) {
	factory, ok := scraperFactories[name]
	if !ok {
		return nil, false
	}
	return factory(config, pool, staticScraper, screenshotsDir), true
}

func GetAllScrapers(configs map[string]SiteConfig, pool *BrowserPool, staticScraper *StaticScraper, screenshotsDir string) map[string]Scraper {
	scrapers := make(map[string]Scraper)
	for name, factory := range scraperFactories {
		siteCfg, ok := configs[name]
		if !ok || !siteCfg.Enabled {
			continue
		}
		scrapers[name] = factory(siteCfg, pool, staticScraper, screenshotsDir)
	}
	return scrapers
}

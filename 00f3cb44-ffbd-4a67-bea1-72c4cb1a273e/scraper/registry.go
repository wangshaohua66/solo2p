package scraper

var scraperFactories = map[string]func(SiteConfig, *BrowserPool) Scraper{}

func RegisterScraper(name string, factory func(SiteConfig, *BrowserPool) Scraper) {
	scraperFactories[name] = factory
}

func GetScraper(name string, config SiteConfig, pool *BrowserPool) (Scraper, bool) {
	factory, ok := scraperFactories[name]
	if !ok {
		return nil, false
	}
	return factory(config, pool), true
}

func GetAllScrapers(configs map[string]SiteConfig, pool *BrowserPool) map[string]Scraper {
	scrapers := make(map[string]Scraper)
	for name, factory := range scraperFactories {
		siteCfg, ok := configs[name]
		if !ok || !siteCfg.Enabled {
			continue
		}
		scrapers[name] = factory(siteCfg, pool)
	}
	return scrapers
}

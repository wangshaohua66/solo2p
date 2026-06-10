import scrapy


class RetractionItem(scrapy.Item):
    record_id = scrapy.Field()
    source = scrapy.Field()
    source_url = scrapy.Field()
    crawl_time = scrapy.Field()

    doi = scrapy.Field()
    normalized_doi = scrapy.Field()
    title = scrapy.Field()
    authors = scrapy.Field()
    author_list = scrapy.Field()
    journal = scrapy.Field()
    publisher = scrapy.Field()
    publication_date = scrapy.Field()
    year = scrapy.Field()
    volume = scrapy.Field()
    issue = scrapy.Field()
    pages = scrapy.Field()

    retraction_type = scrapy.Field()
    retraction_reason = scrapy.Field()
    reason_categories = scrapy.Field()
    retraction_date = scrapy.Field()
    retraction_notice_url = scrapy.Field()
    retraction_notice_doi = scrapy.Field()

    severity_score = scrapy.Field()
    severity_level = scrapy.Field()
    is_high_risk = scrapy.Field()

    simhash = scrapy.Field()
    content_hash = scrapy.Field()

    abstract = scrapy.Field()
    keywords = scrapy.Field()
    affiliations = scrapy.Field()
    corresponding_author = scrapy.Field()
    corresponding_email = scrapy.Field()

    paper_url = scrapy.Field()
    pdf_url = scrapy.Field()
    raw_html_path = scrapy.Field()

    matched_team_papers = scrapy.Field()
    alert_sent = scrapy.Field()
    alert_channels = scrapy.Field()
    notes = scrapy.Field()

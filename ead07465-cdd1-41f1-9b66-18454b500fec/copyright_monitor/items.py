import scrapy


class CrawledPageItem(scrapy.Item):
    work_id = scrapy.Field()
    work_title = scrapy.Field()
    platform_key = scrapy.Field()
    platform_name = scrapy.Field()
    result_title = scrapy.Field()
    result_author = scrapy.Field()
    result_url = scrapy.Field()
    result_summary = scrapy.Field()
    content_text = scrapy.Field()
    raw_html = scrapy.Field()
    response_headers = scrapy.Field()
    crawl_time = scrapy.Field()
    entry_type = scrapy.Field()
    search_keyword = scrapy.Field()


class ComparisonResultItem(scrapy.Item):
    work_id = scrapy.Field()
    work_title = scrapy.Field()
    platform_key = scrapy.Field()
    platform_name = scrapy.Field()
    result_url = scrapy.Field()
    result_title = scrapy.Field()
    result_author = scrapy.Field()
    title_similarity = scrapy.Field()
    paragraph_similarity = scrapy.Field()
    ngram_similarity = scrapy.Field()
    overall_similarity = scrapy.Field()
    is_infringement = scrapy.Field()
    match_type = scrapy.Field()
    matched_paragraphs = scrapy.Field()
    crawl_time = scrapy.Field()


class ForensicsItem(scrapy.Item):
    comparison_id = scrapy.Field()
    work_id = scrapy.Field()
    result_url = scrapy.Field()
    screenshot_path = scrapy.Field()
    html_archive_path = scrapy.Field()
    sha256_hash = scrapy.Field()
    html_sha256 = scrapy.Field()
    forensics_time = scrapy.Field()
    forensics_status = scrapy.Field()

import scrapy
from scrapy.item import Item, Field


class PolicyItem(Item):
    url = Field()
    title = Field()
    content = Field()
    publish_date = Field()
    source = Field()
    site_name = Field()
    site_code = Field()
    category = Field()
    sub_category = Field()
    policy_type = Field()
    keywords = Field()
    summary = Field()
    attachments = Field()
    attachment_urls = Field()
    attachment_files = Field()
    raw_html = Field()
    created_at = Field()
    updated_at = Field()
    status = Field()
    references = Field()
    confidence = Field()


class AttachmentItem(Item):
    policy_url = Field()
    url = Field()
    filename = Field()
    file_type = Field()
    file_path = Field()
    content = Field()
    content_text = Field()
    ocr_result = Field()
    downloaded = Field()
    parsed = Field()
    error = Field()

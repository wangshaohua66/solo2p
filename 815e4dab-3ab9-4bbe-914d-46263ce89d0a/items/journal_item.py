import scrapy
from itemloaders.processors import TakeFirst, MapCompose, Identity
from w3lib.html import remove_tags


def clean_text(value):
    if value:
        value = str(value).strip()
        value = remove_tags(value)
        value = ' '.join(value.split())
        return value
    return None


def clean_issn(value):
    if value:
        value = str(value).strip().replace('-', '').replace(' ', '')
        if len(value) == 8:
            return f'{value[:4]}-{value[4:]}'
    return value


def clean_cn(value):
    if value:
        value = str(value).strip()
        return value
    return None


def clean_float(value):
    if value:
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return None
    return None


def clean_int(value):
    if value:
        try:
            return int(float(str(value).strip()))
        except (ValueError, TypeError):
            return None
    return None


class JournalItem(scrapy.Item):
    journal_id = scrapy.Field(output_processor=TakeFirst())
    journal_name_cn = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    journal_name_en = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    journal_alias = scrapy.Field(output_processor=Identity())
    issn_print = scrapy.Field(
        input_processor=MapCompose(clean_issn),
        output_processor=TakeFirst()
    )
    issn_online = scrapy.Field(
        input_processor=MapCompose(clean_issn),
        output_processor=TakeFirst()
    )
    cn_number = scrapy.Field(
        input_processor=MapCompose(clean_cn),
        output_processor=TakeFirst()
    )
    eissn = scrapy.Field(
        input_processor=MapCompose(clean_issn),
        output_processor=TakeFirst()
    )
    publisher = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    organizer = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=Identity()
    )
    publication_cycle = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    founding_year = scrapy.Field(
        input_processor=MapCompose(clean_int),
        output_processor=TakeFirst()
    )
    country = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    language = scrapy.Field(output_processor=Identity())
    subject_category = scrapy.Field(output_processor=Identity())
    indexed_databases = scrapy.Field(output_processor=Identity())
    impact_factor_current = scrapy.Field(
        input_processor=MapCompose(clean_float),
        output_processor=TakeFirst()
    )
    impact_factor_5year = scrapy.Field(
        input_processor=MapCompose(clean_float),
        output_processor=TakeFirst()
    )
    impact_factor_trend = scrapy.Field(output_processor=Identity())
    jcr_partition = scrapy.Field(output_processor=Identity())
    cas_partition = scrapy.Field(output_processor=Identity())
    cscd_status = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    pku_core = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    sci_status = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    ei_status = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    submission_guide_url = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    submission_url = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    official_website = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    review_cycle = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    publication_fee = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    open_access = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    acceptance_rate = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    editorial_board = scrapy.Field(output_processor=Identity())
    editor_in_chief = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    contact_email = scrapy.Field(output_processor=Identity())
    contact_phone = scrapy.Field(output_processor=Identity())
    contact_address = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    postal_code = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    journal_abstract = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    journal_scope = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    article_count = scrapy.Field(
        input_processor=MapCompose(clean_int),
        output_processor=TakeFirst()
    )
    citation_count = scrapy.Field(
        input_processor=MapCompose(clean_int),
        output_processor=TakeFirst()
    )
    h_index = scrapy.Field(
        input_processor=MapCompose(clean_int),
        output_processor=TakeFirst()
    )
    data_source = scrapy.Field(output_processor=TakeFirst())
    source_url = scrapy.Field(
        input_processor=MapCompose(clean_text),
        output_processor=TakeFirst()
    )
    crawl_timestamp = scrapy.Field(output_processor=TakeFirst())
    last_updated = scrapy.Field(output_processor=TakeFirst())
    field_conflicts = scrapy.Field(output_processor=Identity())
    source_quality_score = scrapy.Field(
        input_processor=MapCompose(clean_float),
        output_processor=TakeFirst()
    )

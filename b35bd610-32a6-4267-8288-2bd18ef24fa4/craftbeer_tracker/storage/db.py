from __future__ import annotations

import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "craftbeer.db"
MAX_DB_SIZE_MB = 2048

ZIP_PREFIX_TO_STATE: dict[str, str] = {
    "005": "NY", "006": "PR", "007": "PR", "008": "VI", "009": "PR",
    "010": "MA", "011": "MA", "012": "MA", "013": "MA", "014": "MA",
    "015": "MA", "016": "MA", "017": "MA", "018": "MA", "019": "MA",
    "020": "MA", "021": "MA", "022": "MA", "023": "MA", "024": "MA",
    "025": "MA", "026": "MA", "027": "MA", "028": "RI", "029": "RI",
    "030": "NH", "031": "NH", "032": "NH", "033": "NH", "034": "NH",
    "035": "NH", "036": "NH", "037": "NH", "038": "NH", "039": "ME",
    "040": "ME", "041": "ME", "042": "ME", "043": "ME", "044": "ME",
    "045": "ME", "046": "ME", "047": "ME", "048": "ME", "049": "ME",
    "050": "VT", "051": "VT", "052": "VT", "053": "VT", "054": "VT",
    "055": "VT", "056": "VT", "057": "VT", "058": "VT", "059": "VT",
    "060": "CT", "061": "CT", "062": "CT", "063": "CT", "064": "CT",
    "065": "CT", "066": "CT", "067": "CT", "068": "CT", "069": "CT",
    "070": "NJ", "071": "NJ", "072": "NJ", "073": "NJ", "074": "NJ",
    "075": "NJ", "076": "NJ", "077": "NJ", "078": "NJ", "079": "NJ",
    "080": "NJ", "081": "NJ", "082": "NJ", "083": "NJ", "084": "NJ",
    "085": "NJ", "086": "NJ", "087": "NJ", "088": "NJ", "089": "NJ",
    "090": "NJ", "091": "NJ", "092": "NJ", "093": "NJ", "094": "NJ",
    "095": "NJ", "096": "NJ", "097": "NJ", "098": "NJ", "099": "NJ",
    "100": "NY", "101": "NY", "102": "NY", "103": "NY", "104": "NY",
    "105": "NY", "106": "NY", "107": "NY", "108": "NY", "109": "NY",
    "110": "NY", "111": "NY", "112": "NY", "113": "NY", "114": "NY",
    "115": "NY", "116": "NY", "117": "NY", "118": "NY", "119": "NY",
    "120": "NY", "121": "NY", "122": "NY", "123": "NY", "124": "NY",
    "125": "NY", "126": "NY", "127": "NY", "128": "NY", "129": "NY",
    "130": "NY", "131": "NY", "132": "NY", "133": "NY", "134": "NY",
    "135": "NY", "136": "NY", "137": "NY", "138": "NY", "139": "NY",
    "140": "NY", "141": "NY", "142": "NY", "143": "NY", "144": "NY",
    "145": "NY", "146": "NY", "147": "NY", "148": "NY", "149": "NY",
    "150": "NY", "151": "NY", "152": "NY", "153": "NY", "154": "NY",
    "155": "NY", "156": "NY", "157": "NY", "158": "NY", "159": "NY",
    "160": "NY", "161": "NY", "162": "NY", "163": "NY", "164": "NY",
    "165": "NY", "166": "NY", "167": "NY", "168": "NY", "169": "NY",
    "170": "NY", "171": "NY", "172": "NY", "173": "NY", "174": "NY",
    "175": "NY", "176": "NY", "177": "NY", "178": "NY", "179": "NY",
    "180": "NY", "181": "NY", "182": "NY", "183": "NY", "184": "NY",
    "185": "NY", "186": "NY", "187": "NY", "188": "NY", "189": "NY",
    "190": "NY", "191": "NY", "192": "NY", "193": "NY", "194": "NY",
    "195": "NY", "196": "NY", "197": "NY", "198": "NY", "199": "NY",
    "200": "MD", "201": "DC", "202": "DC", "203": "DC", "204": "DC",
    "205": "DC", "206": "DC", "207": "ME", "208": "MD", "209": "MD",
    "210": "MD", "211": "MD", "212": "MD", "214": "MD", "215": "MD",
    "216": "MD", "217": "MD", "218": "MD", "219": "MD",
    "220": "VA", "221": "VA", "222": "VA", "223": "VA", "224": "VA",
    "225": "VA", "226": "VA", "227": "VA", "228": "VA", "229": "VA",
    "230": "VA", "231": "VA", "232": "VA", "233": "VA", "234": "VA",
    "235": "VA", "236": "VA", "237": "VA", "238": "VA", "239": "VA",
    "240": "MD", "241": "VA", "242": "WV", "243": "WV", "244": "WV",
    "245": "WV", "246": "WV", "247": "WV", "248": "WV", "249": "WV",
    "250": "WV", "251": "WV", "252": "WV", "253": "WV", "254": "WV",
    "255": "WV", "256": "AL", "257": "WV", "258": "WV", "259": "WV",
    "260": "IN", "261": "WV", "262": "WV", "263": "WV", "264": "WV",
    "265": "WV", "266": "WV", "267": "WV", "268": "WV", "269": "WV",
    "270": "NC", "271": "NC", "272": "NC", "273": "NC", "274": "NC",
    "275": "NC", "276": "NC", "277": "NC", "278": "NC", "279": "NC",
    "280": "NC", "281": "NC", "282": "NC", "283": "NC", "284": "NC",
    "285": "NC", "286": "NC", "287": "NC", "288": "NC", "289": "NC",
    "290": "SC", "291": "SC", "292": "SC", "293": "SC", "294": "SC",
    "295": "SC", "296": "SC", "297": "SC", "298": "SC", "299": "SC",
    "300": "GA", "301": "GA", "302": "GA", "303": "GA", "304": "GA",
    "305": "GA", "306": "GA", "307": "GA", "308": "GA", "309": "GA",
    "310": "GA", "311": "GA", "312": "GA", "313": "GA", "314": "GA",
    "315": "GA", "316": "GA", "317": "GA", "318": "GA", "319": "GA",
    "320": "FL", "321": "FL", "322": "FL", "323": "FL", "324": "FL",
    "325": "FL", "326": "FL", "327": "FL", "328": "FL", "329": "FL",
    "330": "OH", "331": "FL", "332": "FL", "333": "FL", "334": "FL",
    "335": "FL", "336": "FL", "337": "FL", "338": "FL", "339": "FL",
    "340": "FL", "341": "FL", "342": "FL", "344": "FL", "346": "FL",
    "347": "FL", "349": "FL", "350": "PR", "351": "MA", "352": "FL",
    "353": "FL", "354": "AL", "355": "AL", "356": "AL", "357": "AL",
    "358": "AL", "359": "AL",
    "360": "AL", "361": "AL", "362": "AL", "363": "AL", "364": "AL",
    "365": "AL", "366": "AL", "367": "AL", "368": "AL", "369": "AL",
    "370": "TN", "371": "TN", "372": "TN", "373": "TN", "374": "TN",
    "375": "TN", "376": "TN", "377": "TN", "378": "TN", "379": "TN",
    "380": "TN", "381": "TN", "382": "TN", "383": "TN", "384": "TN",
    "385": "TN", "386": "TN", "387": "TN", "388": "TN", "389": "TN",
    "390": "MS", "391": "MS", "392": "MS", "393": "MS", "394": "MS",
    "395": "MS", "396": "MS", "397": "MS", "398": "MS", "399": "MS",
    "400": "KY", "401": "KY", "402": "KY", "403": "KY", "404": "KY",
    "405": "KY", "406": "KY", "407": "KY", "408": "KY", "409": "KY",
    "410": "OH", "411": "OH", "412": "PA", "413": "MA", "414": "WI",
    "415": "CA", "416": "CA", "417": "MO", "418": "IL", "419": "OH",
    "420": "PA", "421": "IN", "422": "PA", "423": "TN", "424": "PA",
    "425": "MI", "426": "KY", "427": "PA", "428": "OH", "429": "OH",
    "430": "OH", "431": "OH", "432": "OH", "433": "OH", "434": "OH",
    "435": "OH", "436": "OH", "437": "OH", "438": "OH", "439": "OH",
    "440": "OH", "441": "OH", "442": "OH", "443": "MD", "444": "OH",
    "445": "OH", "446": "OH", "447": "IL", "448": "IN", "449": "IN",
    "450": "IN", "451": "IN", "452": "IN", "453": "IN", "454": "IN",
    "455": "IN", "456": "IN", "457": "IN", "458": "IN", "459": "IN",
    "460": "IN", "461": "IN", "462": "IN", "463": "IN", "464": "IN",
    "465": "IN", "466": "IN", "467": "IN", "468": "IN", "469": "IN",
    "470": "IN", "471": "IN", "472": "IN", "473": "IN", "474": "IN",
    "475": "IN", "476": "IN", "477": "IN", "478": "IN", "479": "IN",
    "480": "MI", "481": "MI", "482": "MI", "483": "MI", "484": "MI",
    "485": "MI", "486": "MI", "487": "MI", "488": "MI", "489": "MI",
    "490": "MI", "491": "MI", "492": "MI", "493": "MI", "494": "MI",
    "495": "MI", "496": "MI", "497": "MI", "498": "MI", "499": "MI",
    "500": "IA", "501": "AR", "502": "KY", "503": "OR", "504": "LA",
    "505": "NM", "506": "IA", "507": "MN", "508": "MA", "509": "WA",
    "510": "CA", "511": "CA", "512": "TX", "513": "OH", "514": "QC",
    "515": "IA", "516": "NY", "520": "AZ", "521": "IA", "522": "IA",
    "523": "IA", "524": "IA", "525": "IA", "526": "IA", "527": "IA",
    "528": "CO", "530": "WI", "531": "WI", "532": "WI", "535": "IA",
    "537": "WI", "538": "WI", "539": "OK",
    "540": "MO", "541": "WI", "542": "WI", "543": "WI", "544": "WI",
    "545": "WI", "546": "WI", "547": "WI", "548": "WI", "549": "WI",
    "550": "MN", "551": "MN", "553": "MN", "554": "MN", "555": "MN",
    "556": "MN", "557": "MN", "558": "MN", "559": "MN",
    "560": "WY", "561": "FL", "562": "FL", "563": "IA", "564": "MN",
    "565": "MN", "566": "MO", "567": "TX", "568": "KY", "569": "MN",
    "570": "SD", "571": "SD", "572": "SD", "573": "MO", "574": "IN",
    "575": "NM", "576": "ND", "577": "SD", "580": "KS", "581": "ND",
    "582": "ND", "583": "ND", "584": "ND", "585": "ND", "586": "KS",
    "587": "ND", "588": "ND", "589": "ND",
    "590": "NE", "591": "NE", "592": "NE", "593": "NE", "594": "NE",
    "595": "NE", "596": "NE", "597": "NE", "598": "NE", "599": "NE",
    "600": "IL", "601": "MS", "602": "AZ", "603": "NH", "604": "IL",
    "605": "IL", "606": "KY", "607": "NY", "608": "WI", "609": "NJ",
    "610": "PA", "611": "PA", "612": "MN", "613": "ON", "614": "OH",
    "615": "TN", "616": "MI", "617": "MA", "618": "IL", "619": "IL",
    "620": "KS", "622": "IL", "623": "AZ", "624": "IL", "625": "IL",
    "626": "CA", "627": "IL", "628": "IL", "629": "IL",
    "630": "IL", "631": "MO", "633": "MO", "634": "MO", "635": "MO",
    "636": "MO", "637": "MO", "638": "MO", "639": "MO",
    "640": "MO", "641": "IA", "644": "MO", "645": "MO", "646": "MO",
    "647": "MO", "648": "MO", "649": "MO",
    "650": "CA", "651": "MN", "652": "MO", "653": "MO", "654": "MO",
    "655": "MO", "656": "MO", "657": "CA", "658": "MO", "659": "AL",
    "660": "MO", "661": "CA", "662": "MS", "663": "NY", "664": "TX",
    "665": "KS", "666": "KS", "667": "KS", "668": "KS", "669": "KS",
    "670": "KS", "671": "KS", "672": "KS", "673": "KS", "674": "KS",
    "675": "KS", "676": "KS", "677": "KS", "678": "KS", "679": "KS",
    "680": "NE", "681": "NE", "683": "NE", "684": "NE", "685": "NE",
    "686": "NE", "687": "NE", "688": "NE", "689": "NE",
    "690": "NE", "691": "NE", "692": "NE", "693": "NE", "694": "NE",
    "695": "NE", "696": "NE", "697": "NE", "698": "NE", "699": "NE",
    "700": "LA", "701": "ND", "703": "VA", "704": "NC", "705": "LA",
    "706": "GA", "707": "CA", "708": "IL", "709": "IL",
    "710": "LA", "711": "LA", "712": "LA", "713": "TX", "714": "LA",
    "715": "LA", "716": "NY", "717": "PA", "718": "NY", "719": "CO",
    "720": "AR", "721": "AR", "722": "AR", "723": "AR", "724": "PA",
    "725": "AR", "726": "AR", "727": "AR", "728": "AR", "729": "AR",
    "730": "OK", "731": "TN", "733": "OK", "734": "OK", "735": "OK",
    "736": "OK", "737": "OK", "738": "OK", "739": "OK",
    "740": "OK", "741": "OK", "742": "OK", "743": "OK", "744": "OK",
    "745": "OK", "746": "OK", "747": "OK", "748": "OK", "749": "OK",
    "750": "TX", "751": "TX", "752": "TX", "753": "TX", "754": "TX",
    "755": "TX", "756": "TX", "757": "VA", "758": "TX", "759": "TX",
    "760": "TX", "761": "TX", "762": "TX", "763": "MN", "764": "TX",
    "765": "IN", "766": "TX", "767": "TX", "768": "TX", "769": "MS",
    "770": "TX", "771": "TX", "772": "TX", "773": "TX", "774": "MA",
    "775": "TX", "776": "TX", "777": "TX", "778": "TX", "779": "IL",
    "780": "TX", "781": "TX", "782": "TX", "783": "TX", "784": "TX",
    "785": "TX", "786": "TX", "787": "PR", "788": "TX", "789": "TX",
    "790": "TX", "791": "TX", "792": "TX", "793": "TX", "794": "TX",
    "795": "TX", "796": "TX", "797": "TX", "798": "TX", "799": "TX",
    "800": "CO", "801": "UT", "802": "VT", "803": "SC", "804": "VA",
    "805": "CA", "806": "TX", "807": "ON", "809": "DO",
    "810": "MI", "811": "WY", "812": "IN", "813": "FL", "814": "PA",
    "815": "IL", "816": "MO", "820": "TX", "821": "WY", "822": "WY",
    "823": "WY", "824": "WY", "825": "WY", "826": "WY", "827": "TX",
    "828": "NC", "829": "WY",
    "830": "TX", "831": "CA", "832": "TX", "833": "ID", "834": "ID",
    "835": "ID", "836": "ID", "837": "ID", "838": "ID", "839": "ID",
    "840": "UT", "841": "UT", "842": "UT", "843": "SC", "844": "AZ",
    "845": "AZ", "846": "AZ", "847": "IL", "849": "AZ",
    "850": "AZ", "851": "AZ", "852": "AZ", "853": "AZ", "854": "AZ",
    "855": "AZ", "856": "AZ", "857": "AZ", "858": "CA", "859": "KY",
    "860": "AZ", "863": "AZ", "864": "SC", "865": "TN", "870": "AR",
    "871": "NM", "872": "NM", "873": "NM", "874": "NM", "875": "NM",
    "876": "NM", "877": "NM", "878": "NM", "879": "NM",
    "880": "NM", "881": "NM", "882": "NM", "883": "NM", "884": "NM",
    "885": "NM", "886": "NM", "887": "NM", "888": "NM", "889": "NM",
    "890": "NM", "891": "NM", "892": "NM", "893": "NM", "894": "NM",
    "895": "NM", "896": "NM", "897": "NM", "898": "NM", "899": "NM",
    "900": "CA", "901": "TN", "902": "CA", "903": "CA", "904": "FL",
    "905": "CA", "906": "MI", "907": "AK", "908": "NJ", "909": "CA",
    "910": "CA", "911": "CA", "912": "GA", "913": "KS", "914": "NY",
    "915": "TX", "916": "CA", "917": "NY", "918": "OK", "919": "NC",
    "920": "CA", "921": "CA", "922": "CA", "923": "CA", "924": "CA",
    "925": "CA", "926": "CA", "927": "CA", "928": "AZ", "929": "NY",
    "930": "CA", "931": "CA", "932": "CA", "933": "CA", "934": "CA",
    "935": "CA", "936": "TX", "937": "OH", "938": "CA", "939": "PR",
    "940": "CA", "941": "FL", "942": "CA", "943": "CA", "944": "NY",
    "945": "CA", "946": "CA", "947": "CA", "948": "PR", "949": "CA",
    "950": "CA", "951": "CA", "952": "CA", "953": "CA", "954": "FL",
    "955": "CA", "956": "CA", "957": "CA", "958": "CA", "959": "CT",
    "960": "CA", "961": "CA", "962": "CA", "963": "CA", "964": "CA",
    "965": "CA", "966": "CA", "967": "HI", "968": "HI", "969": "GU",
    "970": "CO", "971": "OR", "972": "OR", "973": "NJ", "974": "OR",
    "975": "OR", "976": "OR", "977": "OR", "978": "MA", "979": "TX",
    "980": "WA", "981": "WA", "982": "WA", "983": "WA", "984": "WA",
    "985": "WA", "986": "ID", "987": "WA", "988": "WA", "989": "MI",
    "990": "WA", "991": "WA", "992": "WA", "993": "WA", "994": "WA",
    "995": "AK", "996": "AK", "997": "AK", "998": "AK", "999": "AK",
}


class Database:
    def __init__(self, db_path: Path | str | None = None):
        if db_path is None:
            db_path = DEFAULT_DB_PATH
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.execute("PRAGMA busy_timeout=30000")
        self._create_tables()
        logger.info("Database connected at {path}", path=self.db_path)

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self.connect()
        assert self._conn is not None
        return self._conn

    def _create_tables(self) -> None:
        cur = self.conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS breweries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                name_raw TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(name)
            );

            CREATE TABLE IF NOT EXISTS beers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT NOT NULL UNIQUE,
                brewery_id INTEGER NOT NULL,
                beer_name TEXT NOT NULL,
                beer_name_raw TEXT,
                batch_name TEXT,
                style TEXT,
                abv REAL,
                ibu INTEGER,
                release_date TEXT,
                is_limited INTEGER NOT NULL DEFAULT 0,
                limited_tags TEXT DEFAULT '',
                description TEXT,
                image_url TEXT,
                scarcity_score INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (brewery_id) REFERENCES breweries(id)
            );

            CREATE TABLE IF NOT EXISTS beer_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                source_url TEXT,
                price REAL,
                currency TEXT DEFAULT 'USD',
                availability_raw TEXT DEFAULT '{}',
                screenshot_path TEXT,
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id),
                UNIQUE(beer_id, source)
            );

            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                price REAL,
                currency TEXT DEFAULT 'USD',
                recorded_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id)
            );

            CREATE TABLE IF NOT EXISTS availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                region TEXT,
                zipcode_pattern TEXT,
                excluded_states TEXT DEFAULT '',
                is_available INTEGER NOT NULL DEFAULT 1,
                notes TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id),
                UNIQUE(beer_id, source, region)
            );

            CREATE TABLE IF NOT EXISTS kickstarter_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER,
                campaign_url TEXT NOT NULL,
                title TEXT,
                goal_amount REAL,
                pledged_amount REAL,
                backer_count INTEGER DEFAULT 0,
                days_left INTEGER,
                is_funded INTEGER DEFAULT 0,
                deadline TEXT,
                risk_score INTEGER DEFAULT 0,
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id),
                UNIQUE(campaign_url)
            );

            CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brewery_id INTEGER,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                source_type TEXT NOT NULL,
                published_at TEXT,
                content_snippet TEXT,
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (brewery_id) REFERENCES breweries(id),
                UNIQUE(url)
            );

            CREATE TABLE IF NOT EXISTS manual_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                error_message TEXT,
                last_attempt TEXT,
                attempt_count INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                UNIQUE(source)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                message TEXT,
                sent_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id)
            );

            CREATE INDEX IF NOT EXISTS idx_beers_fingerprint ON beers(fingerprint);
            CREATE INDEX IF NOT EXISTS idx_beers_brewery ON beers(brewery_id);
            CREATE INDEX IF NOT EXISTS idx_beers_scarcity ON beers(scarcity_score DESC);
            CREATE INDEX IF NOT EXISTS idx_beers_limited ON beers(is_limited);
            CREATE INDEX IF NOT EXISTS idx_beer_sources_beer ON beer_sources(beer_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_beer ON price_history(beer_id);
            CREATE INDEX IF NOT EXISTS idx_availability_beer ON availability(beer_id);
            CREATE INDEX IF NOT EXISTS idx_kickstarter_beer ON kickstarter_campaigns(beer_id);
            CREATE INDEX IF NOT EXISTS idx_blog_brewery ON blog_posts(brewery_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_beer ON notifications(beer_id);
        """)
        self.conn.commit()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def upsert_brewery(self, name: str, name_raw: str | None = None) -> int:
        now = self._now()
        cur = self.conn.execute(
            """INSERT INTO breweries (name, name_raw, created_at, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(name) DO UPDATE SET
                   name_raw=COALESCE(excluded.name_raw, breweries.name_raw),
                   updated_at=excluded.updated_at""",
            (name, name_raw, now, now),
        )
        self.conn.commit()
        row = self.conn.execute(
            "SELECT id FROM breweries WHERE name = ?", (name,)
        ).fetchone()
        return row["id"]

    def upsert_beer(self, data: dict[str, Any]) -> int:
        now = self._now()
        brewery_id = self.upsert_brewery(
            data["brewery_name"], data.get("brewery_name_raw")
        )
        fingerprint = data["fingerprint"]
        existing = self.conn.execute(
            "SELECT id FROM beers WHERE fingerprint = ?", (fingerprint,)
        ).fetchone()

        if existing:
            beer_id = existing["id"]
            updates = {
                "style": data.get("style"),
                "abv": data.get("abv"),
                "ibu": data.get("ibu"),
                "release_date": data.get("release_date"),
                "is_limited": int(data.get("is_limited", False)),
                "limited_tags": data.get("limited_tags", ""),
                "description": data.get("description"),
                "image_url": data.get("image_url"),
                "updated_at": now,
            }
            set_clause = ", ".join(f"{k}=COALESCE({k}, ?)" if k != "updated_at" else f"{k}=?" for k in updates)
            vals = list(updates.values()) + [beer_id]
            self.conn.execute(
                f"UPDATE beers SET {set_clause} WHERE id = ?", vals
            )
        else:
            cur = self.conn.execute(
                """INSERT INTO beers
                   (fingerprint, brewery_id, beer_name, beer_name_raw, batch_name,
                    style, abv, ibu, release_date, is_limited, limited_tags,
                    description, image_url, scarcity_score, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
                (
                    fingerprint, brewery_id, data["beer_name"],
                    data.get("beer_name_raw"), data.get("batch_name"),
                    data.get("style"), data.get("abv"), data.get("ibu"),
                    data.get("release_date"), int(data.get("is_limited", False)),
                    data.get("limited_tags", ""), data.get("description"),
                    data.get("image_url"), now, now,
                ),
            )
            beer_id = cur.lastrowid

        self._upsert_beer_source(beer_id, data)
        if data.get("price") is not None:
            self._insert_price(beer_id, data["source"], data["price"], data.get("currency", "USD"))
        if data.get("availability_raw"):
            self._upsert_availability(beer_id, data)
        self.conn.commit()
        return beer_id

    def _upsert_beer_source(self, beer_id: int, data: dict[str, Any]) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO beer_sources
               (beer_id, source, source_url, price, currency, availability_raw,
                screenshot_path, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(beer_id, source) DO UPDATE SET
                   source_url=excluded.source_url,
                   price=COALESCE(excluded.price, beer_sources.price),
                   currency=COALESCE(excluded.currency, beer_sources.currency),
                   availability_raw=excluded.availability_raw,
                   screenshot_path=COALESCE(excluded.screenshot_path, beer_sources.screenshot_path),
                   scraped_at=excluded.scraped_at""",
            (
                beer_id, data["source"], data.get("source_url"),
                data.get("price"), data.get("currency", "USD"),
                json.dumps(data.get("availability_raw", {})),
                data.get("screenshot_path"), data.get("scraped_at", now),
            ),
        )

    def _insert_price(self, beer_id: int, source: str, price: float, currency: str) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO price_history (beer_id, source, price, currency, recorded_at)
               VALUES (?, ?, ?, ?, ?)""",
            (beer_id, source, price, currency, now),
        )

    def _upsert_availability(self, beer_id: int, data: dict[str, Any]) -> None:
        now = self._now()
        avail = data.get("availability_raw", {})
        region = avail.get("region", "unknown")
        zipcode_pattern = avail.get("zipcode_pattern", "")
        excluded_states = avail.get("excluded_states", [])
        excluded_states_str = ",".join(excluded_states) if isinstance(excluded_states, list) else str(excluded_states)
        is_available = int(avail.get("is_available", True))
        notes = avail.get("notes", "")
        self.conn.execute(
            """INSERT INTO availability
               (beer_id, source, region, zipcode_pattern, excluded_states, is_available, notes, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(beer_id, source, region) DO UPDATE SET
                   zipcode_pattern=excluded.zipcode_pattern,
                   excluded_states=excluded.excluded_states,
                   is_available=excluded.is_available,
                   notes=excluded.notes,
                   updated_at=excluded.updated_at""",
            (beer_id, data["source"], region, zipcode_pattern, excluded_states_str, is_available, notes, now),
        )

    def upsert_kickstarter(self, data: dict[str, Any]) -> int:
        now = self._now()
        cur = self.conn.execute(
            """INSERT INTO kickstarter_campaigns
               (beer_id, campaign_url, title, goal_amount, pledged_amount,
                backer_count, days_left, is_funded, deadline, risk_score, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(campaign_url) DO UPDATE SET
                   title=excluded.title,
                   goal_amount=excluded.goal_amount,
                   pledged_amount=excluded.pledged_amount,
                   backer_count=excluded.backer_count,
                   days_left=excluded.days_left,
                   is_funded=excluded.is_funded,
                   deadline=excluded.deadline,
                   risk_score=excluded.risk_score,
                   scraped_at=excluded.scraped_at""",
            (
                data.get("beer_id"), data["campaign_url"], data.get("title"),
                data.get("goal_amount"), data.get("pledged_amount"),
                data.get("backer_count", 0), data.get("days_left"),
                int(data.get("is_funded", False)), data.get("deadline"),
                data.get("risk_score", 0), now,
            ),
        )
        self.conn.commit()
        return cur.lastrowid

    def upsert_blog_post(self, data: dict[str, Any]) -> int:
        now = self._now()
        cur = self.conn.execute(
            """INSERT INTO blog_posts
               (brewery_id, title, url, source_type, published_at, content_snippet, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(url) DO UPDATE SET
                   title=excluded.title,
                   content_snippet=excluded.content_snippet,
                   scraped_at=excluded.scraped_at""",
            (
                data.get("brewery_id"), data["title"], data["url"],
                data["source_type"], data.get("published_at"),
                data.get("content_snippet"), now,
            ),
        )
        self.conn.commit()
        return cur.lastrowid

    def add_to_manual_queue(self, source: str, error_message: str) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO manual_queue (source, error_message, last_attempt, attempt_count, created_at)
               VALUES (?, ?, ?, 1, ?)
               ON CONFLICT(source) DO UPDATE SET
                   error_message=excluded.error_message,
                   last_attempt=excluded.last_attempt,
                   attempt_count=attempt_count + 1""",
            (source, error_message, now, now),
        )
        self.conn.commit()

    def add_notification(self, beer_id: int, notification_type: str, message: str) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO notifications (beer_id, notification_type, message, sent_at)
               VALUES (?, ?, ?, ?)""",
            (beer_id, notification_type, message, now),
        )
        self.conn.commit()

    def get_beers_today(self) -> list[dict]:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        rows = self.conn.execute(
            """SELECT b.*, br.name as brewery_name
               FROM beers b
               JOIN breweries br ON b.brewery_id = br.id
               WHERE DATE(b.created_at) = ?
               ORDER BY b.scarcity_score DESC""",
            (today,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_scarcity_top(self, limit: int = 20) -> list[dict]:
        rows = self.conn.execute(
            """SELECT b.*, br.name as brewery_name
               FROM beers b
               JOIN breweries br ON b.brewery_id = br.id
               WHERE b.is_limited = 1
               ORDER BY b.scarcity_score DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_beer_by_fingerprint(self, fingerprint: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM beers WHERE fingerprint = ?", (fingerprint,)
        ).fetchone()
        return dict(row) if row else None

    def get_price_history(self, beer_id: int, hours: int = 48) -> list[dict]:
        rows = self.conn.execute(
            """SELECT * FROM price_history
               WHERE beer_id = ? AND datetime(recorded_at) >= datetime('now', ?)
               ORDER BY recorded_at DESC""",
            (beer_id, f"-{hours} hours"),
        ).fetchall()
        return [dict(r) for r in rows]

    def zipcode_to_state(self, zipcode: str) -> str | None:
        if not zipcode or len(zipcode) < 3:
            return None
        prefix = zipcode[:3]
        return ZIP_PREFIX_TO_STATE.get(prefix)

    def get_availability_for_zipcode(self, beer_id: int, zipcode: str) -> list[dict]:
        state = self.zipcode_to_state(zipcode)
        rows = self.conn.execute(
            """SELECT * FROM availability
               WHERE beer_id = ? AND is_available = 1""",
            (beer_id,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            excluded_str = d.get("excluded_states", "")
            excluded = [s.strip() for s in excluded_str.split(",")] if excluded_str else []
            if state and state in excluded:
                continue
            pattern = d.get("zipcode_pattern", "")
            if not pattern or self._zipcode_matches(zipcode, pattern):
                results.append(d)
        return results

    def _zipcode_matches(self, zipcode: str, pattern: str) -> bool:
        if not pattern or pattern == "*":
            return True
        patterns = [p.strip() for p in pattern.replace("-", ",").split(",") if p.strip()]
        for p in patterns:
            if not p:
                continue
            if "*" in p:
                prefix = p.rstrip("*")
                if zipcode.startswith(prefix):
                    return True
            elif zipcode == p:
                return True
        numeric_range = re.match(r"^(\d{3,5})\s*-\s*(\d{3,5})$", pattern.strip())
        if numeric_range:
            try:
                lo, hi = numeric_range.group(1), numeric_range.group(2)
                if int(zipcode[:5]) >= int(lo) and int(zipcode[:5]) <= int(hi):
                    return True
            except ValueError:
                pass
        return False

    def get_kickstarter_active(self) -> list[dict]:
        rows = self.conn.execute(
            """SELECT k.*, b.beer_name, br.name as brewery_name,
                      CASE WHEN k.goal_amount > 0
                           THEN ROUND((k.pledged_amount / k.goal_amount) * 100, 1)
                           ELSE 0 END as funding_pct
               FROM kickstarter_campaigns k
               LEFT JOIN beers b ON k.beer_id = b.id
               LEFT JOIN breweries br ON b.brewery_id = br.id
               WHERE k.is_funded = 0
               ORDER BY k.risk_score DESC, funding_pct ASC, k.backer_count ASC"""
        ).fetchall()
        return [dict(r) for r in rows]

    def get_manual_queue(self) -> list[dict]:
        rows = self.conn.execute("SELECT * FROM manual_queue").fetchall()
        return [dict(r) for r in rows]

    def get_recent_blogs(self, limit: int = 50) -> list[dict]:
        rows = self.conn.execute(
            """SELECT bp.*, br.name as brewery_name
               FROM blog_posts bp
               LEFT JOIN breweries br ON bp.brewery_id = br.id
               ORDER BY bp.scraped_at DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_beers_for_price_recheck(self, hours: int = 48) -> list[dict]:
        rows = self.conn.execute(
            """SELECT DISTINCT b.*, bs.source, bs.source_url, bs.price
               FROM beers b
               JOIN beer_sources bs ON b.id = bs.beer_id
               WHERE bs.price IS NOT NULL
               AND datetime(bs.scraped_at) <= datetime('now', ?)
               ORDER BY bs.scraped_at ASC""",
            (f"-{hours} hours",),
        ).fetchall()
        return [dict(r) for r in rows]

    def update_scarcity_score(self, beer_id: int, score: int) -> None:
        now = self._now()
        self.conn.execute(
            "UPDATE beers SET scarcity_score = ?, updated_at = ? WHERE id = ?",
            (min(max(score, 0), 100), now, beer_id),
        )
        self.conn.commit()

    def check_db_size(self) -> float:
        if not self.db_path.exists():
            return 0.0
        return self.db_path.stat().st_size / (1024 * 1024)

    def get_scrape_queue_status(self) -> dict[str, Any]:
        manual = self.get_manual_queue()
        return {
            "manual_queue_count": len(manual),
            "manual_queue_sources": [m["source"] for m in manual],
            "db_size_mb": round(self.check_db_size(), 2),
        }

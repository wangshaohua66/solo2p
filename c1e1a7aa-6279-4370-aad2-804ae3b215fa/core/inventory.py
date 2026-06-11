import csv
from datetime import datetime, date, timedelta
from typing import List, Optional, Dict, Any
from storage.sqlite_db import Database, get_db
from core.ink_model import (
    Ink,
    InkCreate,
    Inventory,
    InventoryCreate,
    StockAlert,
    CIELAB,
)
from utils.logger import get_logger
from utils.config import load_config

logger = get_logger()


class InkManager:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()
        self.config = load_config()

    def add_ink(self, ink: InkCreate) -> Ink:
        tags_str = ",".join(ink.tags) if ink.tags else None

        ink_id = self.db.execute(
            """
            INSERT INTO inks (brand, line, color_name, volume_ml, price,
                              l, a, b, ink_type, tags, purchase_date, expiration_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                ink.brand,
                ink.line,
                ink.color_name,
                ink.volume_ml,
                ink.price,
                ink.cielab.l,
                ink.cielab.a,
                ink.cielab.b,
                ink.ink_type.value,
                tags_str,
                ink.purchase_date.isoformat() if ink.purchase_date else None,
                ink.expiration_date.isoformat() if ink.expiration_date else None,
                ink.notes,
            ),
        )

        inv_create = InventoryCreate(
            ink_id=ink_id,
            bottle_count=1,
            current_ml=ink.volume_ml,
        )
        InventoryManager(self.db).add_inventory(inv_create)

        logger.info(f"Added ink: {ink.brand} {ink.color_name} (ID: {ink_id})")
        return self.get_ink(ink_id)

    def get_ink(self, ink_id: int) -> Ink:
        row = self.db.query_one("SELECT * FROM inks WHERE id = ?", (ink_id,))
        if not row:
            raise ValueError(f"Ink with ID {ink_id} not found")
        return self._row_to_ink(row)

    def list_inks(
        self,
        brand: Optional[str] = None,
        ink_type: Optional[str] = None,
        tag: Optional[str] = None,
        search: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Ink]:
        sql = "SELECT * FROM inks WHERE 1=1"
        params: List[Any] = []

        if brand:
            sql += " AND brand LIKE ?"
            params.append(f"%{brand}%")
        if ink_type:
            sql += " AND ink_type = ?"
            params.append(ink_type)
        if tag:
            sql += " AND tags LIKE ?"
            params.append(f"%{tag}%")
        if search:
            sql += " AND (brand LIKE ? OR color_name LIKE ? OR line LIKE ?)"
            params.extend([f"%{search}%"] * 3)

        sql += " ORDER BY brand, color_name"

        if limit:
            sql += " LIMIT ?"
            params.append(limit)

        rows = self.db.query(sql, tuple(params))
        return [self._row_to_ink(row) for row in rows]

    def update_ink(self, ink_id: int, **kwargs) -> Ink:
        valid_fields = [
            "brand", "line", "color_name", "volume_ml", "price",
            "l", "a", "b", "ink_type", "tags", "purchase_date",
            "expiration_date", "notes"
        ]

        updates = []
        params = []
        for key, value in kwargs.items():
            if key in valid_fields:
                if key == "tags" and isinstance(value, list):
                    value = ",".join(value)
                updates.append(f"{key} = ?")
                params.append(value)

        if not updates:
            return self.get_ink(ink_id)

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(ink_id)

        sql = f"UPDATE inks SET {', '.join(updates)} WHERE id = ?"
        self.db.execute(sql, tuple(params))
        logger.info(f"Updated ink ID {ink_id}")
        return self.get_ink(ink_id)

    def delete_ink(self, ink_id: int) -> None:
        self.db.execute("DELETE FROM inks WHERE id = ?", (ink_id,))
        logger.info(f"Deleted ink ID {ink_id}")

    def _row_to_ink(self, row: Dict[str, Any]) -> Ink:
        tags_str = row.get("tags")
        tags = tags_str.split(",") if tags_str else []

        purchase_date = None
        if row.get("purchase_date"):
            try:
                purchase_date = date.fromisoformat(row["purchase_date"])
            except (ValueError, TypeError):
                pass

        expiration_date = None
        if row.get("expiration_date"):
            try:
                expiration_date = date.fromisoformat(row["expiration_date"])
            except (ValueError, TypeError):
                pass

        created_at = row.get("created_at")
        if created_at:
            try:
                created_at = datetime.fromisoformat(created_at)
            except (ValueError, TypeError):
                created_at = datetime.now()
        else:
            created_at = datetime.now()

        updated_at = row.get("updated_at")
        if updated_at:
            try:
                updated_at = datetime.fromisoformat(updated_at)
            except (ValueError, TypeError):
                updated_at = datetime.now()
        else:
            updated_at = datetime.now()

        return Ink(
            id=row.get("id", 0),
            brand=row.get("brand", "Unknown"),
            line=row.get("line"),
            color_name=row.get("color_name", "Unknown"),
            volume_ml=row.get("volume_ml", 0.0),
            price=row.get("price"),
            cielab=CIELAB(
                l=row.get("l", 50.0),
                a=row.get("a", 0.0),
                b=row.get("b", 0.0),
            ),
            ink_type=row.get("ink_type", "dye"),
            tags=tags,
            purchase_date=purchase_date,
            expiration_date=expiration_date,
            notes=row.get("notes"),
            created_at=created_at,
            updated_at=updated_at,
        )

    def get_inks_for_mixing(self) -> List[Dict[str, Any]]:
        rows = self.db.query(
            """
            SELECT i.*, inv.current_ml, inv.bottle_count
            FROM inks i
            JOIN inventory inv ON i.id = inv.ink_id
            WHERE inv.current_ml > 0
            ORDER BY i.brand, i.color_name
            """
        )
        result = []
        for row in rows:
            ink = self._row_to_ink(row)
            result.append({
                "id": row["id"],
                "full_name": ink.full_name(),
                "brand": row["brand"],
                "color_name": row["color_name"],
                "l": row["l"],
                "a": row["a"],
                "b": row["b"],
                "current_ml": row["current_ml"],
                "bottle_count": row["bottle_count"],
                "ink_type": row["ink_type"],
            })
        return result


class InventoryManager:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()
        self.config = load_config()

    def add_inventory(self, inventory: InventoryCreate) -> Inventory:
        inv_id = self.db.execute(
            """
            INSERT INTO inventory (ink_id, bottle_count, current_ml, location, batch_number)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                inventory.ink_id,
                inventory.bottle_count,
                inventory.current_ml,
                inventory.location,
                inventory.batch_number,
            ),
        )
        logger.info(f"Added inventory for ink ID {inventory.ink_id}")
        return self.get_inventory(inv_id)

    def get_inventory(self, inventory_id: int) -> Inventory:
        row = self.db.query_one(
            "SELECT * FROM inventory WHERE id = ?", (inventory_id,)
        )
        if not row:
            raise ValueError(f"Inventory with ID {inventory_id} not found")
        return self._row_to_inventory(row)

    def get_inventory_by_ink(self, ink_id: int) -> Optional[Inventory]:
        row = self.db.query_one(
            "SELECT * FROM inventory WHERE ink_id = ?", (ink_id,)
        )
        if not row:
            return None
        return self._row_to_inventory(row)

    def list_inventory(
        self,
        low_stock_only: bool = False,
        expiring_soon: bool = False,
    ) -> List[Inventory]:
        sql = """
            SELECT inv.id as inv_id, inv.ink_id, inv.bottle_count, inv.current_ml,
                   inv.location, inv.batch_number,
                   i.*
            FROM inventory inv
            JOIN inks i ON inv.ink_id = i.id
            WHERE 1=1
        """
        params: List[Any] = []

        if low_stock_only:
            sql += " AND inv.bottle_count <= ?"
            params.append(self.config.low_stock_threshold)

        if expiring_soon:
            cutoff = date.today() + timedelta(
                days=self.config.expiration_warning_days
            )
            sql += " AND i.expiration_date IS NOT NULL AND i.expiration_date <= ?"
            params.append(cutoff.isoformat())

        sql += " ORDER BY i.brand, i.color_name"

        rows = self.db.query(sql, tuple(params))
        return [self._row_to_inventory(row, include_ink=True) for row in rows]

    def update_stock(
        self, ink_id: int, bottle_count: Optional[int] = None, current_ml: Optional[float] = None
    ) -> Inventory:
        inventory = self.get_inventory_by_ink(ink_id)
        if not inventory:
            raise ValueError(f"No inventory found for ink ID {ink_id}")

        updates = []
        params = []
        if bottle_count is not None:
            updates.append("bottle_count = ?")
            params.append(bottle_count)
        if current_ml is not None:
            updates.append("current_ml = ?")
            params.append(current_ml)

        if not updates:
            return inventory

        params.append(ink_id)
        sql = f"UPDATE inventory SET {', '.join(updates)} WHERE ink_id = ?"
        self.db.execute(sql, tuple(params))

        logger.info(f"Updated stock for ink ID {ink_id}")
        return self.get_inventory_by_ink(ink_id)

    def get_stock_alerts(self) -> List[StockAlert]:
        alerts: List[StockAlert] = []
        today = date.today()

        rows = self.db.query(
            """
            SELECT inv.id as inv_id, inv.ink_id, inv.bottle_count, inv.current_ml,
                   inv.location, inv.batch_number,
                   i.*
            FROM inventory inv
            JOIN inks i ON inv.ink_id = i.id
            """
        )

        ink_mgr = InkManager(self.db)

        for row in rows:
            ink = ink_mgr._row_to_ink(row)
            ink_name = ink.full_name()

            if row["bottle_count"] <= self.config.low_stock_threshold:
                alerts.append(
                    StockAlert(
                        ink_id=row["ink_id"],
                        ink_name=ink_name,
                        alert_type="low_stock",
                        message=f"Low stock: {row['bottle_count']} bottle(s) remaining",
                        severity="warning",
                    )
                )

            if row["current_ml"] <= 10:
                alerts.append(
                    StockAlert(
                        ink_id=row["ink_id"],
                        ink_name=ink_name,
                        alert_type="low_volume",
                        message=f"Low volume: {row['current_ml']:.1f}ml remaining",
                        severity="warning",
                    )
                )

            if row["expiration_date"]:
                exp_date = date.fromisoformat(row["expiration_date"])
                days_left = (exp_date - today).days
                if days_left <= 0:
                    alerts.append(
                        StockAlert(
                            ink_id=row["ink_id"],
                            ink_name=ink_name,
                            alert_type="expired",
                            message=f"EXPIRED on {exp_date.isoformat()} ({-days_left} days ago)",
                            severity="error",
                        )
                    )
                elif days_left <= self.config.expiration_warning_days:
                    alerts.append(
                        StockAlert(
                            ink_id=row["ink_id"],
                            ink_name=ink_name,
                            alert_type="expiring_soon",
                            message=f"Expires {exp_date.isoformat()} (in {days_left} days)",
                            severity="warning",
                        )
                    )

        return alerts

    def import_csv(self, csv_path: str) -> int:
        import csv as csv_module

        if not csv_path.endswith(".csv"):
            raise ValueError("File must be a CSV")

        count = 0
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv_module.DictReader(f)
            for row in reader:
                try:
                    required_fields = ["brand", "color_name", "l", "a", "b"]
                    for field in required_fields:
                        if field not in row or not row[field]:
                            raise ValueError(f"Missing required field: {field}")

                    ink_create = InkCreate(
                        brand=row["brand"],
                        line=row.get("line"),
                        color_name=row["color_name"],
                        volume_ml=float(row.get("volume_ml", 50)),
                        price=float(row["price"]) if row.get("price") else None,
                        cielab=CIELAB(
                            l=float(row["l"]),
                            a=float(row["a"]),
                            b=float(row["b"]),
                        ),
                        ink_type=row.get("ink_type", "dye"),
                        tags=row.get("tags", ""),
                        purchase_date=(
                            date.fromisoformat(row["purchase_date"])
                            if row.get("purchase_date")
                            else None
                        ),
                        expiration_date=(
                            date.fromisoformat(row["expiration_date"])
                            if row.get("expiration_date")
                            else None
                        ),
                        notes=row.get("notes"),
                    )
                    InkManager(self.db).add_ink(ink_create)
                    count += 1
                except Exception as e:
                    logger.warning(f"Skipping row {count + 1}: {e}")
                    continue

        logger.info(f"Imported {count} inks from {csv_path}")
        return count

    def _row_to_inventory(self, row: Dict[str, Any], include_ink: bool = False) -> Inventory:
        ink = None
        if include_ink or "brand" in row:
            ink_mgr = InkManager(self.db)
            ink = ink_mgr._row_to_ink(row)

        inv_id = row.get("inv_id") or row.get("id", 0)

        return Inventory(
            id=inv_id,
            ink_id=row["ink_id"],
            bottle_count=row.get("bottle_count", 0),
            current_ml=row.get("current_ml", 0.0),
            location=row.get("location"),
            batch_number=row.get("batch_number"),
            ink=ink,
        )


def self_check(db: Optional[Database] = None) -> Dict[str, Any]:
    results = {
        "db_connection": False,
        "ink_list_roundtrip": False,
        "inventory_list_structure": False,
        "errors": [],
    }

    try:
        if db is None:
            db = get_db()
        results["db_connection"] = True
    except Exception as e:
        results["errors"].append(f"db_connection: {e}")
        return results

    try:
        ink_mgr = InkManager(db)
        inks = ink_mgr.list_inks(limit=5)
        if inks:
            ink = inks[0]
            required_fields = ["id", "brand", "color_name", "cielab", "tags", "volume_ml"]
            missing = [f for f in required_fields if not hasattr(ink, f)]
            if missing:
                results["errors"].append(f"ink missing fields: {missing}")
            else:
                results["ink_list_roundtrip"] = hasattr(ink.cielab, "l")
    except Exception as e:
        results["errors"].append(f"ink_list_roundtrip: {e}")

    try:
        inv_mgr = InventoryManager(db)
        inventory_list = inv_mgr.list_inventory()[:5]
        if inventory_list:
            inv = inventory_list[0]
            required_inv_fields = ["id", "ink_id", "bottle_count", "current_ml", "ink"]
            missing_inv = [f for f in required_inv_fields if not hasattr(inv, f)]
            if missing_inv:
                results["errors"].append(f"inventory missing fields: {missing_inv}")
            elif inv.ink is not None:
                required_ink_fields = ["id", "brand", "color_name", "cielab", "tags"]
                missing_ink = [f for f in required_ink_fields if not hasattr(inv.ink, f)]
                if missing_ink:
                    results["errors"].append(f"inventory.ink missing fields: {missing_ink}")
                else:
                    results["inventory_list_structure"] = hasattr(inv.ink.cielab, "l")
            else:
                results["inventory_list_structure"] = True
    except Exception as e:
        results["errors"].append(f"inventory_list_structure: {e}")

    results["all_passed"] = (
        results["db_connection"]
        and results["ink_list_roundtrip"]
        and results["inventory_list_structure"]
        and not results["errors"]
    )
    return results

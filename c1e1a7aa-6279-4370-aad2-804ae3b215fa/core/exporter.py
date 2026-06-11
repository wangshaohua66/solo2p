import json
import csv
from datetime import datetime, date
from pathlib import Path
from typing import List, Optional, Dict, Any
from storage.sqlite_db import Database, get_db
from core.ink_model import Ink, Recipe, JournalEntry, CIELAB
from core.color_engine import cielab_to_rgb
from utils.logger import get_logger

logger = get_logger()


class Exporter:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()

    def export_all_json(self, output_path: str) -> str:
        data = {
            "export_date": datetime.now().isoformat(),
            "version": "1.0",
            "inks": self._get_all_inks(),
            "inventory": self._get_all_inventory(),
            "recipes": self._get_all_recipes(),
            "journal": self._get_all_journal(),
        }

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)

        logger.info(f"Full database exported to {output_path}")
        return output_path

    def import_all_json(self, input_path: str) -> Dict[str, int]:
        path = Path(input_path)
        if not path.exists():
            raise FileNotFoundError(f"Import file not found: {input_path}")

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        counts = {"inks": 0, "inventory": 0, "recipes": 0, "journal": 0}

        for ink in data.get("inks", []):
            try:
                self._import_ink(ink)
                counts["inks"] += 1
            except Exception as e:
                logger.warning(f"Skipping ink import: {e}")

        for inv in data.get("inventory", []):
            try:
                self._import_inventory(inv)
                counts["inventory"] += 1
            except Exception as e:
                logger.warning(f"Skipping inventory import: {e}")

        for recipe in data.get("recipes", []):
            try:
                self._import_recipe(recipe)
                counts["recipes"] += 1
            except Exception as e:
                logger.warning(f"Skipping recipe import: {e}")

        for entry in data.get("journal", []):
            try:
                self._import_journal(entry)
                counts["journal"] += 1
            except Exception as e:
                logger.warning(f"Skipping journal import: {e}")

        logger.info(f"Import completed: {counts}")
        return counts

    def export_inks_csv(self, output_path: str) -> str:
        inks = self._get_all_inks()
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "id", "brand", "line", "color_name", "volume_ml", "price",
                "l", "a", "b", "ink_type", "tags", "purchase_date",
                "expiration_date", "notes", "hex_color"
            ])

            for ink in inks:
                cielab = CIELAB(l=ink["l"], a=ink["a"], b=ink["b"])
                rgb = cielab_to_rgb(cielab)
                writer.writerow([
                    ink["id"],
                    ink["brand"],
                    ink.get("line", ""),
                    ink["color_name"],
                    ink["volume_ml"],
                    ink.get("price", ""),
                    ink["l"],
                    ink["a"],
                    ink["b"],
                    ink["ink_type"],
                    ink.get("tags", ""),
                    ink.get("purchase_date", ""),
                    ink.get("expiration_date", ""),
                    ink.get("notes", ""),
                    rgb.to_hex(),
                ])

        logger.info(f"Inks exported to {output_path}")
        return output_path

    def export_journal_csv(self, output_path: str) -> str:
        journal = self._get_all_journal()
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "id", "date", "pen", "nib", "ink_id", "ink_name",
                "paper", "humidity", "rating", "notes"
            ])

            for entry in journal:
                ink_name = ""
                if entry.get("ink"):
                    ink_name = entry["ink"].get("full_name", "")
                writer.writerow([
                    entry["id"],
                    entry["date"],
                    entry["pen"],
                    entry.get("nib", ""),
                    entry["ink_id"],
                    ink_name,
                    entry["paper"],
                    entry.get("humidity", ""),
                    entry["rating"],
                    entry.get("notes", ""),
                ])

        logger.info(f"Journal exported to {output_path}")
        return output_path

    def export_recipe_pdf(self, recipe_id: int, output_path: str) -> str:
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.lib import colors
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            )
        except ImportError:
            raise ImportError("reportlab is required for PDF export. Install with: pip install reportlab")

        recipe = self._get_recipe(recipe_id)
        if not recipe:
            raise ValueError(f"Recipe with ID {recipe_id} not found")

        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        doc = SimpleDocTemplate(str(path), pagesize=letter)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle(
            "RecipeTitle",
            parent=styles["Title"],
            fontSize=24,
            spaceAfter=12,
        )
        story.append(Paragraph(f"Ink Mix Recipe: {recipe['name']}", title_style))
        story.append(Spacer(1, 0.25 * inch))

        cielab = CIELAB(l=recipe["target_l"], a=recipe["target_a"], b=recipe["target_b"])
        rgb = cielab_to_rgb(cielab)
        hex_color = rgb.to_hex()

        color_info = [
            ["Target Color", f"L*={recipe['target_l']:.1f}, a*={recipe['target_a']:.1f}, b*={recipe['target_b']:.1f}"],
            ["Hex Code", hex_color],
            ["ΔE", f"{recipe.get('delta_e', 'N/A'):.2f}" if recipe.get("delta_e") else "N/A"],
        ]

        color_table = Table(color_info, colWidths=[1.5 * inch, 4 * inch])
        color_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(color_table)
        story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("Color Swatch", styles["Heading2"]))
        story.append(Spacer(1, 0.1 * inch))

        from reportlab.graphics.shapes import Rect, Drawing
        from reportlab.lib.colors import HexColor

        d = Drawing(400, 80)
        swatch_color = HexColor(hex_color)
        d.add(Rect(0, 0, 400, 60, fillColor=swatch_color, strokeColor=colors.black, strokeWidth=1))
        story.append(d)
        story.append(Spacer(1, 0.3 * inch))

        story.append(Paragraph("Components", styles["Heading2"]))
        story.append(Spacer(1, 0.1 * inch))

        components_data = [["#", "Ink Name", "Ratio", "Volume (50ml batch)"]]
        for i, comp in enumerate(recipe.get("components", []), 1):
            components_data.append([
                str(i),
                comp.get("ink_name", f"Ink #{comp['ink_id']}"),
                f"{comp['volume_ratio'] * 100:.1f}%",
                f"{comp['volume_ratio'] * 50:.1f}ml",
            ])

        comp_table = Table(components_data, colWidths=[0.5 * inch, 3 * inch, 1 * inch, 1.5 * inch])
        comp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ]))
        story.append(comp_table)

        if recipe.get("notes"):
            story.append(Spacer(1, 0.3 * inch))
            story.append(Paragraph("Notes", styles["Heading2"]))
            story.append(Spacer(1, 0.1 * inch))
            story.append(Paragraph(recipe["notes"], styles["BodyText"]))

        story.append(Spacer(1, 0.5 * inch))
        story.append(Paragraph(
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            styles["Italic"],
        ))

        doc.build(story)
        logger.info(f"Recipe PDF exported to {output_path}")
        return output_path

    def _get_all_inks(self) -> List[Dict[str, Any]]:
        return self.db.query("SELECT * FROM inks ORDER BY id")

    def _get_all_inventory(self) -> List[Dict[str, Any]]:
        return self.db.query("SELECT * FROM inventory ORDER BY id")

    def _get_all_recipes(self) -> List[Dict[str, Any]]:
        recipes = self.db.query("SELECT * FROM recipes ORDER BY id")
        for recipe in recipes:
            recipe["components"] = self.db.query(
                "SELECT * FROM recipe_components WHERE recipe_id = ?",
                (recipe["id"],),
            )
        return recipes

    def _get_recipe(self, recipe_id: int) -> Optional[Dict[str, Any]]:
        recipe = self.db.query_one(
            "SELECT * FROM recipes WHERE id = ?", (recipe_id,)
        )
        if recipe:
            recipe["components"] = self.db.query(
                """
                SELECT rc.*, i.brand, i.line, i.color_name
                FROM recipe_components rc
                JOIN inks i ON rc.ink_id = i.id
                WHERE rc.recipe_id = ?
                """,
                (recipe_id,),
            )
            for comp in recipe["components"]:
                comp["ink_name"] = (
                    f"{comp['brand']} {comp.get('line', '')} - {comp['color_name']}".strip()
                )
        return recipe

    def _get_all_journal(self) -> List[Dict[str, Any]]:
        from core.journal import JournalManager
        jm = JournalManager(self.db)
        entries = jm.list_entries()
        result = []
        for entry in entries:
            entry_dict = entry.model_dump()
            entry_dict["date"] = entry.date.isoformat()
            entry_dict["ink"] = {
                "id": entry.ink.id,
                "full_name": entry.ink.full_name(),
            } if entry.ink else None
            result.append(entry_dict)
        return result

    def _import_ink(self, ink_data: Dict[str, Any]) -> None:
        from core.inventory import InkManager
        from core.ink_model import InkCreate, CIELAB

        cielab = CIELAB(l=ink_data["l"], a=ink_data["a"], b=ink_data["b"])
        ink_create = InkCreate(
            brand=ink_data["brand"],
            line=ink_data.get("line"),
            color_name=ink_data["color_name"],
            volume_ml=ink_data["volume_ml"],
            price=ink_data.get("price"),
            cielab=cielab,
            ink_type=ink_data.get("ink_type", "dye"),
            tags=ink_data.get("tags", []),
            purchase_date=(
                date.fromisoformat(ink_data["purchase_date"])
                if ink_data.get("purchase_date")
                else None
            ),
            expiration_date=(
                date.fromisoformat(ink_data["expiration_date"])
                if ink_data.get("expiration_date")
                else None
            ),
            notes=ink_data.get("notes"),
        )
        InkManager(self.db).add_ink(ink_create)

    def _import_inventory(self, inv_data: Dict[str, Any]) -> None:
        from core.inventory import InventoryManager, InventoryCreate

        inv_create = InventoryCreate(
            ink_id=inv_data["ink_id"],
            bottle_count=inv_data.get("bottle_count", 1),
            current_ml=inv_data.get("current_ml", inv_data.get("volume_ml", 50)),
            location=inv_data.get("location"),
            batch_number=inv_data.get("batch_number"),
        )
        InventoryManager(self.db).add_inventory(inv_create)

    def _import_recipe(self, recipe_data: Dict[str, Any]) -> None:
        from core.ink_model import CIELAB, RecipeComponent

        target_lab = CIELAB(
            l=recipe_data["target_l"],
            a=recipe_data["target_a"],
            b=recipe_data["target_b"],
        )

        components = []
        for comp in recipe_data.get("components", []):
            components.append(
                RecipeComponent(
                    ink_id=comp["ink_id"],
                    volume_ratio=comp["volume_ratio"],
                )
            )

        recipe_id = self.db.execute(
            """
            INSERT INTO recipes (name, target_l, target_a, target_b, delta_e, notes)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                recipe_data["name"],
                target_lab.l,
                target_lab.a,
                target_lab.b,
                recipe_data.get("delta_e"),
                recipe_data.get("notes"),
            ),
        )

        for comp in components:
            self.db.execute(
                """
                INSERT INTO recipe_components (recipe_id, ink_id, volume_ratio)
                VALUES (?, ?, ?)
                """,
                (recipe_id, comp.ink_id, comp.volume_ratio),
            )

    def _import_journal(self, entry_data: Dict[str, Any]) -> None:
        from core.journal import JournalManager
        from core.ink_model import JournalEntryCreate

        entry_date = entry_data["date"]
        if isinstance(entry_date, str):
            entry_date = date.fromisoformat(entry_date)

        entry_create = JournalEntryCreate(
            date=entry_date,
            pen=entry_data["pen"],
            nib=entry_data.get("nib"),
            ink_id=entry_data["ink_id"],
            paper=entry_data["paper"],
            humidity=entry_data.get("humidity"),
            rating=entry_data["rating"],
            notes=entry_data.get("notes"),
        )
        JournalManager(self.db).add_entry(entry_create)

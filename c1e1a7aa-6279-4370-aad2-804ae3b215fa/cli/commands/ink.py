import typer
from typing import Optional, List
from datetime import date
from rich.console import Console
from rich.table import Table
from cli.commands.ui import (
    color_block, get_color_hex, print_success, print_error, print_warning,
    print_info, print_json, create_table, bar_chart, set_no_color, OutputFormatter, print_header
)
from core.inventory import InkManager, InventoryManager
from core.ink_model import InkCreate, CIELAB, InkType
from core.color_engine import extract_dominant_colors, rgb_to_cielab, cielab_to_rgb
from utils.logger import get_logger

logger = get_logger()
app = typer.Typer(help="Manage ink library and inventory")
console = Console()


@app.command("add")
def add_ink(
    brand: str = typer.Option(..., "--brand", "-b", help="Ink brand"),
    line: Optional[str] = typer.Option(None, "--line", "-l", help="Ink line/series"),
    color_name: str = typer.Option(..., "--name", "-n", help="Color name"),
    volume_ml: float = typer.Option(50.0, "--volume", "-v", help="Bottle volume in ml"),
    price: Optional[float] = typer.Option(None, "--price", "-p", help="Purchase price"),
    l: Optional[float] = typer.Option(None, help="CIELAB L* value"),
    a: Optional[float] = typer.Option(None, help="CIELAB a* value"),
    b: Optional[float] = typer.Option(None, help="CIELAB b* value"),
    r: Optional[int] = typer.Option(None, help="RGB Red value"),
    g: Optional[int] = typer.Option(None, help="RGB Green value"),
    b_rgb: Optional[int] = typer.Option(None, "--rgb-b", help="RGB Blue value"),
    image: Optional[str] = typer.Option(None, "--image", "-i", help="Path to ink swatch image for color extraction"),
    ink_type: InkType = typer.Option(InkType.DYE, "--type", "-t", help="Ink type"),
    tags: Optional[str] = typer.Option(None, "--tag", help="Comma-separated tags"),
    purchase_date: Optional[str] = typer.Option(None, "--purchased", help="Purchase date (YYYY-MM-DD)"),
    expiration_date: Optional[str] = typer.Option(None, "--expires", help="Expiration date (YYYY-MM-DD)"),
    notes: Optional[str] = typer.Option(None, "--notes", help="Additional notes"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Add a new ink to the library with automatic inventory tracking."""
    try:
        set_no_color(no_color)

        cielab = None
        if image:
            print_info(f"Extracting colors from image...")
            colors = extract_dominant_colors(image)
            if not colors:
                cielab = colors[0][0]
                print_success(f"Extracted L*={cielab.l:.1f} a*={cielab.a:.1f} b*={cielab.b:.1f}")
        elif l is not None and a is not None and b is not None:
            cielab = CIELAB(l=l, a=a, b=b)
        elif r is not None and g is not None and b_rgb is not None:
            from core.ink_model import RGB
            rgb = RGB(r=r, g=g, b=b_rgb)
            cielab = rgb_to_cielab(rgb)
        else:
            print_error("Must provide either CIELAB values, RGB values, or an image path")
            raise typer.Exit(code=1)

        pur_date = None
        if purchase_date:
            pur_date = date.fromisoformat(purchase_date)

        exp_date = None
        if expiration_date:
            exp_date = date.fromisoformat(expiration_date)

        tag_list = []
        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]

        ink_create = InkCreate(
            brand=brand,
            line=line,
            color_name=color_name,
            volume_ml=volume_ml,
            price=price,
            cielab=cielab,
            ink_type=ink_type,
            tags=tag_list,
            purchase_date=pur_date,
            expiration_date=exp_date,
            notes=notes,
        )

        ink_mgr = InkManager()
        ink = ink_mgr.add_ink(ink_create)

        if json_output:
            print_json({
                "id": ink.id,
                "brand": ink.brand,
                "line": ink.line,
                "color_name": ink.color_name,
                "volume_ml": ink.volume_ml,
                "price": ink.price,
                "l": ink.cielab.l,
                "a": ink.cielab.a,
                "b": ink.cielab.b,
                "hex": get_color_hex(ink.cielab),
                "ink_type": ink.ink_type.value,
                "tags": ink.tags,
            })
        else:
            hex_color = get_color_hex(ink.cielab)
            print_success(f"Added ink #{ink.id}: {ink.full_name()}")
            table = create_table("", ["Field", "Value"])
            table.add_row("ID", str(ink.id))
            table.add_row("Brand", ink.brand)
            if ink.line:
                table.add_row("Line", ink.line)
            table.add_row("Color", f"{color_block(ink.cielab)} {ink.color_name} ({hex_color})")
            table.add_row("CIELAB", f"L*={ink.cielab.l:.1f} a*={ink.cielab.a:.1f} b*={ink.cielab.b:.1f}")
            table.add_row("Volume", f"{ink.volume_ml:.1f}ml")
            if ink.price:
                table.add_row("Price", f"${ink.price:.2f}")
            table.add_row("Type", ink.ink_type.value)
            if ink.tags:
                table.add_row("Tags", ", ".join(ink.tags))
            console.print(table)

    except Exception as e:
        logger.error(f"Failed to add ink: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("list")
def list_inks(
    brand: Optional[str] = typer.Option(None, "--brand", help="Filter by brand"),
    ink_type: Optional[str] = typer.Option(None, "--type", help="Filter by ink type"),
    tag: Optional[str] = typer.Option(None, "--tag", help="Filter by tag"),
    search: Optional[str] = typer.Option(None, "--search", "-s", help="Search by name/brand"),
    limit: Optional[int] = typer.Option(None, "--limit", help="Limit results"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """List all inks in the library with inventory status."""
    try:
        set_no_color(no_color)

        ink_mgr = InkManager()
        inks = ink_mgr.list_inks(brand=brand, ink_type=ink_type, tag=tag, search=search, limit=limit)

        inv_mgr = InventoryManager()

        if json_output:
            result = []
            for ink in inks:
                inv = inv_mgr.get_inventory_by_ink(ink.id)
                result.append({
                    "id": ink.id,
                    "brand": ink.brand,
                    "line": ink.line,
                    "color_name": ink.color_name,
                    "volume_ml": ink.volume_ml,
                    "l": ink.cielab.l,
                    "a": ink.cielab.a,
                    "b": ink.cielab.b,
                    "hex": get_color_hex(ink.cielab),
                    "ink_type": ink.ink_type.value,
                    "tags": ink.tags,
                    "bottle_count": inv.bottle_count if inv else 0,
                    "current_ml": inv.current_ml if inv else 0,
                })
            print_json(result)
            return

        if not inks:
            print_warning("No inks found")
            return

        table = create_table(f"Ink Library ({len(inks)} inks)", [
            "ID", "Color", "Brand", "Name", "Type", "Stock", "Volume"
        ])

        for ink in inks:
            inv = inv_mgr.get_inventory_by_ink(ink.id)
            bottle_count = inv.bottle_count if inv else 0
            current_ml = inv.current_ml if inv else 0

            stock_bar = bar_chart(bottle_count, 5, width=10)
            vol_bar = bar_chart(current_ml, ink.volume_ml, width=10)

            table.add_row(
                str(ink.id),
                f"{color_block(ink.cielab)} {get_color_hex(ink.cielab)}",
                ink.brand,
                ink.color_name,
                ink.ink_type.value,
                f"{stock_bar} {bottle_count}",
                f"{vol_bar} {current_ml:.0f}ml",
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to list inks: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("stock")
def ink_stock(
    low_stock: bool = typer.Option(False, "--low", help="Show only low stock items"),
    expiring: bool = typer.Option(False, "--expiring", help="Show only expiring items"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """View ink stock levels with low stock and expiration alerts."""
    try:
        set_no_color(no_color)

        inv_mgr = InventoryManager()
        inventory = inv_mgr.list_inventory(low_stock_only=low_stock, expiring_soon=expiring)
        alerts = inv_mgr.get_stock_alerts()

        if json_output:
            result = {
                "inventory": [],
                "alerts": [a.model_dump() for a in alerts],
            }
            for inv in inventory:
                if inv.ink:
                    result["inventory"].append({
                        "ink_id": inv.ink_id,
                        "ink_name": inv.ink.full_name(),
                        "bottle_count": inv.bottle_count,
                        "current_ml": inv.current_ml,
                        "hex": get_color_hex(inv.ink.cielab),
                    })
            print_json(result)
            return

        print_header("Stock Overview")

        if alerts:
            alert_table = create_table("Alerts", ["Ink", "Type", "Message", "Severity"])
            for alert in alerts:
                severity_style = "red" if alert.severity == "error" else "yellow"
                alert_table.add_row(
                    alert.ink_name,
                    alert.alert_type,
                    alert.message,
                    f"[{severity_style}]{alert.severity.upper()}[/]",
                )
            console.print(alert_table)
            console.print()

        if not inventory:
            print_warning("No inventory items found")
            return

        table = create_table(f"Inventory ({len(inventory)} items)", [
            "ID", "Ink", "Bottles", "Remaining", "Status", "Expires"
        ])

        from datetime import date
        today = date.today()

        for inv in inventory:
            if not inv.ink:
                continue

            bottle_bar = bar_chart(inv.bottle_count, 5, width=8)
            vol_bar = bar_chart(inv.current_ml, inv.ink.volume_ml, width=12)

            expires_text = "N/A"
            if inv.ink.expiration_date:
                days_left = (inv.ink.expiration_date - today).days
                if days_left <= 0:
                    expires_text = f"[red]EXPIRED[/]"
                elif days_left <= 180:
                    expires_text = f"[yellow]{inv.ink.expiration_date.isoformat()} ({days_left}d)[/]"
                else:
                    expires_text = inv.ink.expiration_date.isoformat()

            status = "[green]OK[/]"
            if inv.bottle_count <= 1:
                status = "[yellow]LOW[/]"
            if inv.current_ml <= 10:
                status = "[red]EMPTY[/]"

            table.add_row(
                str(inv.ink.id),
                f"{color_block(inv.ink.cielab)} {inv.ink.full_name()}",
                f"{bottle_bar} {inv.bottle_count}",
                f"{vol_bar} {inv.current_ml:.0f}ml",
                status,
                expires_text,
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to show stock: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("import")
def import_csv(
    file: str = typer.Argument(..., help="Path to CSV file"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Batch import inks from a CSV file."""
    try:
        set_no_color(no_color)

        inv_mgr = InventoryManager()
        count = inv_mgr.import_csv(file)

        if json_output:
            print_json({"imported": count, "file": file})
        else:
            print_success(f"Successfully imported {count} inks from {file}")

    except Exception as e:
        logger.error(f"Failed to import CSV: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("delete")
def delete_ink(
    ink_id: int = typer.Argument(..., help="Ink ID to delete"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Delete an ink from the library."""
    try:
        set_no_color(no_color)

        ink_mgr = InkManager()
        ink = ink_mgr.get_ink(ink_id)

        if not force:
            confirm = typer.confirm(f"Are you sure you want to delete '{ink.full_name()}'?")
            if not confirm:
                print_info("Deletion cancelled")
                raise typer.Exit(code=0)

        ink_mgr.delete_ink(ink_id)

        if json_output:
            print_json({"deleted": ink_id, "name": ink.full_name()})
        else:
            print_success(f"Deleted ink #{ink_id}: {ink.full_name()}")

    except Exception as e:
        logger.error(f"Failed to delete ink: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)

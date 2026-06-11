import typer
from typing import Optional, List, Tuple
from rich.console import Console
from rich.table import Table
from cli.commands.ui import (
    color_block, get_color_hex, print_success, print_error, print_warning,
    print_info, print_json, create_table, set_no_color, delta_e_display,
    print_header, two_column_layout
)
from core.inventory import InkManager
from core.journal import JournalManager
from core.ink_model import (
    CIELAB, RecipeCreate, RecipeComponent, MixRecommendation
)
from core.color_engine import (
    find_best_mix, mix_colors, delta_e2000, paper_white_adjustment, rgb_to_cielab
)
from utils.config import load_config
from utils.logger import get_logger

logger = get_logger()
app = typer.Typer(help="Mix recipes and color prediction")
console = Console()


@app.command("new")
def mix_new(
    name: str = typer.Option(..., "--name", "-n", help="Recipe name"),
    l: Optional[float] = typer.Option(None, help="Target CIELAB L* value"),
    a: Optional[float] = typer.Option(None, help="Target CIELAB a* value"),
    b: Optional[float] = typer.Option(None, help="Target CIELAB b* value"),
    r: Optional[int] = typer.Option(None, help="Target RGB Red value"),
    g: Optional[int] = typer.Option(None, help="Target RGB Green value"),
    b_rgb: Optional[int] = typer.Option(None, "--rgb-b", help="Target RGB Blue value"),
    max_inks: int = typer.Option(5, "--max-inks", "-m", help="Max inks in recipe"),
    save: bool = typer.Option(False, "--save", help="Save recipe to database"),
    batch_ml: float = typer.Option(50.0, "--batch", help="Batch size in ml for volume calculation"),
    notes: Optional[str] = typer.Option(None, "--notes", help="Recipe notes"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Find the best ink mix to match a target color using ΔE2000 optimization."""
    try:
        set_no_color(no_color)
        config = load_config()

        target_lab = None
        if l is not None and a is not None and b is not None:
            target_lab = CIELAB(l=l, a=a, b=b)
        elif r is not None and g is not None and b_rgb is not None:
            from core.ink_model import RGB
            rgb = RGB(r=r, g=g, b=b_rgb)
            target_lab = rgb_to_cielab(rgb)
        else:
            print_error("Must provide either target CIELAB or RGB values")
            raise typer.Exit(code=1)

        ink_mgr = InkManager()
        available_inks = ink_mgr.get_inks_for_mixing()

        if len(available_inks) < 2:
            print_error("Need at least 2 inks in inventory for mixing")
            raise typer.Exit(code=1)

        print_info(f"Searching best mix from {len(available_inks)} available inks...")

        components, predicted_lab, delta_e = find_best_mix(
            target=target_lab,
            available_inks=available_inks,
            max_inks=max_inks,
            delta_e_threshold=config.delta_e_threshold,
        )

        for comp in components:
            comp.volume_ml = round(comp.volume_ratio * batch_ml, 2)

        if save:
            recipe_create = RecipeCreate(
                name=name,
                target_cielab=target_lab,
                delta_e=delta_e,
                notes=notes,
                components=components,
            )
            _save_recipe(recipe_create)

        if json_output:
            result = {
                "recipe_name": name,
                "target": {
                    "l": target_lab.l,
                    "a": target_lab.a,
                    "b": target_lab.b,
                    "hex": get_color_hex(target_lab),
                },
                "predicted": {
                    "l": predicted_lab.l,
                    "a": predicted_lab.a,
                    "b": predicted_lab.b,
                    "hex": get_color_hex(predicted_lab),
                },
                "delta_e": delta_e,
                "within_threshold": delta_e <= config.delta_e_threshold,
                "components": [
                    {
                        "ink_id": c.ink_id,
                        "ink_name": c.ink_name,
                        "ratio": round(c.volume_ratio * 100, 2),
                        "volume_ml": c.volume_ml,
                    }
                    for c in components
                ],
            }
            print_json(result)
            return

        print_header(f"Mix Recipe: {name}")

        target_hex = get_color_hex(target_lab)
        predicted_hex = get_color_hex(predicted_lab)

        left_panel = f"""
[bold]Target Color[/bold]
{color_block(target_lab, width=20)}
[bold]{target_hex}[/bold]
L* = {target_lab.l:>6.1f}
a* = {target_lab.a:>6.1f}
b* = {target_lab.b:>6.1f}
        """.strip()

        right_panel = f"""
[bold]Predicted Color[/bold]
{color_block(predicted_lab, width=20)}
[bold]{predicted_hex}[/bold]
L* = {predicted_lab.l:>6.1f}
a* = {predicted_lab.a:>6.1f}
b* = {predicted_lab.b:>6.1f}

Color Difference: {delta_e_display(delta_e, config.delta_e_threshold)}
        """.strip()

        console.print(two_column_layout(left_panel, right_panel, left_width=35))
        console.print()

        if delta_e <= config.delta_e_threshold:
            print_success(f"Match within ΔE threshold ({config.delta_e_threshold})")
        else:
            print_warning(f"ΔE {delta_e:.2f} exceeds threshold {config.delta_e_threshold}")

        console.print()

        comp_table = create_table("Components", [
            "#", "Ink", "Color", "Ratio", f"Volume ({batch_ml:.0f}ml batch)"
        ])

        for i, comp in enumerate(components, 1):
            ink = ink_mgr.get_ink(comp.ink_id)
            comp_table.add_row(
                str(i),
                comp.ink_name or f"Ink #{comp.ink_id}",
                f"{color_block(ink.cielab)} {get_color_hex(ink.cielab)}",
                f"{comp.volume_ratio * 100:>5.1f}%",
                f"{comp.volume_ml:>6.1f}ml",
            )

        console.print(comp_table)

        if save:
            print_success(f"Recipe saved to database")

    except Exception as e:
        logger.error(f"Failed to create mix: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("predict")
def predict_mix(
    components: List[str] = typer.Option(..., "--ink", "-i", help="Ink ID:ratio pairs, e.g. --ink 1:0.5 --ink 2:0.5"),
    batch_ml: float = typer.Option(50.0, "--batch", help="Batch size in ml"),
    paper_white_l: Optional[float] = typer.Option(None, "--paper-l", help="Custom paper white L*"),
    paper_white_a: float = typer.Option(0.0, "--paper-a", help="Custom paper white a*"),
    paper_white_b: float = typer.Option(0.0, "--paper-b", help="Custom paper white b*"),
    save: bool = typer.Option(False, "--save", help="Save prediction to database"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Recipe name for saving"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Predict the resulting color of a custom ink mix with multi-level paper white comparison."""
    try:
        set_no_color(no_color)

        ink_mgr = InkManager()
        mix_input: List[Tuple[CIELAB, float]] = []
        comp_list: List[RecipeComponent] = []
        total_ratio = 0.0

        for comp_str in components:
            try:
                ink_id_str, ratio_str = comp_str.rsplit(":", 1)
                ink_id = int(ink_id_str)
                ratio = float(ratio_str)
            except ValueError:
                print_error(f"Invalid component format: '{comp_str}'. Use 'ink_id:ratio'")
                raise typer.Exit(code=1)

            ink = ink_mgr.get_ink(ink_id)
            mix_input.append((ink.cielab, ratio))
            comp_list.append(
                RecipeComponent(
                    ink_id=ink_id,
                    ink_name=ink.full_name(),
                    volume_ratio=ratio,
                    volume_ml=round(ratio * batch_ml, 2),
                )
            )
            total_ratio += ratio

        if abs(total_ratio - 1.0) > 0.01:
            print_warning(f"Ratios sum to {total_ratio:.3f}, should be 1.0")

        if total_ratio <= 0:
            print_error("Total ratio must be greater than 0")
            raise typer.Exit(code=1)

        for comp in comp_list:
            comp.volume_ratio = round(comp.volume_ratio / total_ratio, 4)
            comp.volume_ml = round(comp.volume_ratio * batch_ml, 2)

        normalized_input = [(c_lab, comp.volume_ratio) for c_lab, comp in zip(
            [ink_mgr.get_ink(c.ink_id).cielab for c in comp_list], comp_list
        )]

        result_lab = mix_colors(normalized_input)

        paper_whites = [
            ("Bright White (95)", CIELAB(l=95.0, a=0.0, b=0.0)),
            ("Standard (85)", CIELAB(l=85.0, a=0.0, b=0.0)),
            ("Cream/Tinted (75)", CIELAB(l=75.0, a=0.0, b=0.0)),
        ]

        if paper_white_l is not None:
            paper_whites.insert(0, (
                "Custom",
                CIELAB(l=paper_white_l, a=paper_white_a, b=paper_white_b),
            ))

        paper_results = []
        for label, pw in paper_whites:
            adjusted = paper_white_adjustment(result_lab, pw)
            shift = delta_e2000(result_lab, adjusted)
            paper_results.append({
                "label": label,
                "paper_white": pw,
                "adjusted": adjusted,
                "delta_e": shift,
            })

        if json_output:
            result = {
                "predicted": {
                    "l": result_lab.l,
                    "a": result_lab.a,
                    "b": result_lab.b,
                    "hex": get_color_hex(result_lab),
                },
                "paper_comparisons": [
                    {
                        "label": pr["label"],
                        "paper_white": {
                            "l": pr["paper_white"].l,
                            "a": pr["paper_white"].a,
                            "b": pr["paper_white"].b,
                        },
                        "adjusted": {
                            "l": pr["adjusted"].l,
                            "a": pr["adjusted"].a,
                            "b": pr["adjusted"].b,
                            "hex": get_color_hex(pr["adjusted"]),
                        },
                        "delta_e": pr["delta_e"],
                        "warning": pr["delta_e"] > 3.0,
                    }
                    for pr in paper_results
                ],
                "components": [
                    {
                        "ink_id": c.ink_id,
                        "ink_name": c.ink_name,
                        "ratio": round(c.volume_ratio * 100, 2),
                        "volume_ml": c.volume_ml,
                    }
                    for c in comp_list
                ],
            }
            print_json(result)
            return

        print_header("Mix Prediction")

        base_panel = f"""
[bold]Uncorrected Color[/bold]
{color_block(result_lab, width=20)}
[bold]{get_color_hex(result_lab)}[/bold]
L* = {result_lab.l:>6.1f}
a* = {result_lab.a:>6.1f}
b* = {result_lab.b:>6.1f}
        """.strip()

        first_pw = paper_results[0]
        first_panel = f"""
[bold]{first_pw['label']}[/bold]
{color_block(first_pw['adjusted'], width=20)}
[bold]{get_color_hex(first_pw['adjusted'])}[/bold]
L* = {first_pw['adjusted'].l:>6.1f}
a* = {first_pw['adjusted'].a:>6.1f}
b* = {first_pw['adjusted'].b:>6.1f}

ΔE: {delta_e_display(first_pw['delta_e'], 3.0)}
        """.strip()

        console.print(two_column_layout(base_panel, first_panel, left_width=35))
        console.print()

        comp_table = create_table("Components", [
            "#", "Ink", "Color", "Ratio", f"Volume"
        ])

        for i, comp in enumerate(comp_list, 1):
            ink = ink_mgr.get_ink(comp.ink_id)
            comp_table.add_row(
                str(i),
                comp.ink_name or f"Ink #{comp.ink_id}",
                f"{color_block(ink.cielab)} {get_color_hex(ink.cielab)}",
                f"{comp.volume_ratio * 100:>5.1f}%",
                f"{comp.volume_ml:>6.1f}ml",
            )

        console.print(comp_table)
        console.print()

        pw_table = create_table("Paper White Comparison (ΔE vs uncorrected)", [
            "Paper Type", "L*", "Color", "Hex", "ΔE", "Shift"
        ])

        from utils.config import load_config
        config = load_config()

        for pr in paper_results:
            shift_level = "None"
            if pr["delta_e"] > 5.0:
                shift_level = "[red]Major[/]"
            elif pr["delta_e"] > 3.0:
                shift_level = "[yellow]Moderate[/]"
            elif pr["delta_e"] > 1.0:
                shift_level = "[green]Slight[/]"
            else:
                shift_level = "[dim]Minimal[/]"

            pw_table.add_row(
                pr["label"],
                f"{pr['paper_white'].l:.0f}",
                color_block(pr["adjusted"]),
                get_color_hex(pr["adjusted"]),
                delta_e_display(pr["delta_e"], config.delta_e_threshold),
                shift_level,
            )

        console.print(pw_table)

        major_shifts = [pr for pr in paper_results if pr["delta_e"] > 3.0]
        if major_shifts:
            print_warning(
                f"Significant color shift detected on {len(major_shifts)} paper type(s). "
                f"Consider adjusting the mix for target paper."
            )

    except Exception as e:
        logger.error(f"Failed to predict mix: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("list")
def list_recipes(
    search: Optional[str] = typer.Option(None, "--search", "-s", help="Search recipe names"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """List saved mix recipes."""
    try:
        set_no_color(no_color)

        from storage.sqlite_db import get_db
        db = get_db()

        sql = "SELECT * FROM recipes WHERE 1=1"
        params = []
        if search:
            sql += " AND name LIKE ?"
            params.append(f"%{search}%")
        sql += " ORDER BY created_at DESC"

        rows = db.query(sql, tuple(params))

        if json_output:
            result = []
            for row in rows:
                comps = db.query(
                    """
                    SELECT rc.*, i.brand, i.color_name
                    FROM recipe_components rc
                    JOIN inks i ON rc.ink_id = i.id
                    WHERE recipe_id = ?
                    """,
                    (row["id"],),
                )
                result.append({
                    "id": row["id"],
                    "name": row["name"],
                    "target_hex": get_color_hex(CIELAB(l=row["target_l"], a=row["target_a"], b=row["target_b"])),
                    "delta_e": row["delta_e"],
                    "components": len(comps),
                    "created_at": row["created_at"],
                })
            print_json(result)
            return

        if not rows:
            print_warning("No recipes found")
            return

        table = create_table(f"Saved Recipes ({len(rows)})", [
            "ID", "Name", "Target", "ΔE", "Components", "Created"
        ])

        for row in rows:
            target_lab = CIELAB(l=row["target_l"], a=row["target_a"], b=row["target_b"])
            comps = db.query(
                "SELECT COUNT(*) as cnt FROM recipe_components WHERE recipe_id = ?",
                (row["id"],),
            )
            comp_count = comps[0]["cnt"]

            table.add_row(
                str(row["id"]),
                row["name"],
                f"{color_block(target_lab)} {get_color_hex(target_lab)}",
                f"{row['delta_e']:.2f}" if row["delta_e"] else "N/A",
                str(comp_count),
                row["created_at"][:10],
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to list recipes: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


def _save_recipe(recipe: RecipeCreate) -> int:
    from storage.sqlite_db import get_db
    db = get_db()

    recipe_id = db.execute(
        """
        INSERT INTO recipes (name, target_l, target_a, target_b, delta_e, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            recipe.name,
            recipe.target_cielab.l,
            recipe.target_cielab.a,
            recipe.target_cielab.b,
            recipe.delta_e,
            recipe.notes,
        ),
    )

    for comp in recipe.components:
        db.execute(
            """
            INSERT INTO recipe_components (recipe_id, ink_id, volume_ratio)
            VALUES (?, ?, ?)
            """,
            (recipe_id, comp.ink_id, comp.volume_ratio),
        )

    logger.info(f"Saved recipe '{recipe.name}' (ID: {recipe_id})")
    return recipe_id

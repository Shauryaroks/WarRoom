#!/usr/bin/env python3
"""
dossier_to_archetypes.py

Parses FMCG Stock Wars dossier text into structured Archetype JSON
suitable for POST /api/v1/admin/archetypes/seed or direct DB insertion.

Usage:
    python dossier_to_archetypes.py dossiers.txt > archetypes_seed.json
"""

import re
import json
import sys
from typing import Optional


def main():
    input_path = sys.argv[1] if len(sys.argv) > 1 else "dossiers.txt"
    with open(input_path, "r", encoding="utf-8") as f:
        raw = f.read()

    companies = parse_dossiers(raw)
    payload = {
        "archetypes": companies,
        "count": len(companies),
        "note": (
            "These records mirror the _PRESET_ARCHETYPES structure in admin.py. "
            "Ensure your Alembic/model adds 'bcg_classification' before seeding."
        ),
    }
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def parse_dossiers(text: str):
    """
    Split raw dossier text into company blocks.
    Matches headers like '**17. CrunchCraft Foods Ltd.**'
    """
    # Normalize windows line endings
    text = text.replace("\r\n", "\n")

    # Split on lines that begin with **NUMBER. NAME**
    # Use positive lookahead to keep the delimiter in the split result
    parts = re.split(r"\n(?=\*\*\d+\.\s+[^*\n]+\*\*)", text)

    records = []
    for part in parts:
        part = part.strip()
        if not part.startswith("**"):
            continue
        record = parse_company_block(part)
        if record:
            records.append(record)

    return records


def parse_company_block(text: str) -> Optional[dict]:
    # --- Basic Identity ---
    header = re.match(r"\*\*(\d+)\.\s+([^*]+?)\*\*", text)
    if not header:
        return None
    _num, name = header.groups()
    name = name.strip()

    # Skip the summary BCG matrix block at end of file
    if any(x in name.lower() for x in ["bcg portfolio", "end of", "additional 40"]):
        return None

    slug = re.sub(r"[^\w\s-]", "", name).lower().strip()
    slug = re.sub(r"[\s_]+", "-", slug)[:50]

    # --- Sector ---
    sector = "FOODS"
    if "beverage" in text.lower() or "drink" in text.lower() or "brew" in text.lower():
        sector = "BEVERAGES"
    # Override if explicit sector line exists
    sec_match = re.search(r"_Sector:\s*([^_\n]+)_", text)
    if sec_match:
        s = sec_match.group(1).lower()
        sector = "BEVERAGES" if "beverage" in s else "FOODS"

    # --- Description (first paragraph under About the Company) ---
    desc_match = re.search(
        r"\*\*About the Company\*\*\s*(.+?)(?=\n\s*\*\*|\n\s*\||\Z)",
        text,
        re.DOTALL,
    )
    description = ""
    if desc_match:
        description = clean_paragraph(desc_match.group(1))[:300]

    # --- Dossier Content (full narrative + financials + SWOT) ---
    # Capture from About through the SWOT / Financials up to BCG header
    dossier_match = re.search(
        r"(\*\*About the Company\*\*.*?)(?=\*\*BCG MATRIX CLASSIFICATION\*\*|\*\*BCG PORTFOLIO MATRIX\*\*|\Z)",
        text,
        re.DOTALL,
    )
    dossier_content = dossier_match.group(1).strip() if dossier_match else text.strip()

    # --- Real World Inspiration (present in File 2 format) ---
    inspire_match = re.search(r"Inspired by:\s*([^|\n]+)", text)
    real_world = (
        inspire_match.group(1).strip() if inspire_match else f"Composite: {name}"
    )

    # --- Financials Table Extraction ---
    fin = extract_financials(text)

    # --- SWOT Extraction ---
    swot = extract_swot(text)

    # --- BCG Classification ---
    bcg = extract_bcg(text)

    # --- Simulation Starting Values ---
    starting_stock_price = (
        parse_currency(fin.get("IPO Price / Share", "₹100.00")) or 100.0
    )
    starting_shares = parse_shares(fin.get("Shares Outstanding", "50 Cr"))

    # Dossiers don't list 'starting_cash' explicitly. We infer from revenue scale
    # so that small high-growth companies get more runway and large caps get
    # proportionally less float (mirroring the preset archetype logic).
    revenue_cr = parse_currency(fin.get("Revenue (Annual)", "0"))
    starting_cash = infer_starting_cash(revenue_cr)

    # --- Benchmark Bands ---
    bands = compute_benchmark_bands(fin)

    return {
        "name": name,
        "slug": slug,
        "description": description,
        "sector": sector,
        "dossier_content": dossier_content,
        "benchmark_bands": json.dumps(bands),
        "starting_cash": starting_cash,
        "starting_stock_price": starting_stock_price,
        "starting_shares": starting_shares,
        "swot_strengths": swot.get("strengths", ""),
        "swot_weaknesses": swot.get("weaknesses", ""),
        "swot_opportunities": swot.get("opportunities", ""),
        "swot_threats": swot.get("threats", ""),
        "real_world_inspiration": real_world,
        "is_preset": True,
        "bcg_classification": bcg,
    }


def extract_financials(text: str) -> dict:
    """Pull key-value pairs from the Financial Fundamentals markdown table."""
    fin = {}
    # Find the Financial Fundamentals section
    sec_match = re.search(
        r"\*\*Financial Fundamentals\*\*(.*?)(?=\*\*SWOT Analysis\*\*|\*\*BCG|\Z)",
        text,
        re.DOTALL,
    )
    if not sec_match:
        return fin

    table = sec_match.group(1)
    # Match rows like: | **Key** | Value |
    rows = re.findall(r"\|\s*\*\*([^*|]+?)\*\*\s*\|\s*([^|\n]*?)\s*(?=\|)", table)
    for k, v in rows:
        fin[k.strip()] = v.strip()
    return fin


def extract_swot(text: str) -> dict:
    """Extract the four SWOT quadrants from a 2-column markdown table."""
    swot = {}
    sec_match = re.search(r"\*\*SWOT Analysis\*\*(.*?)(?=\*\*BCG|\Z)", text, re.DOTALL)
    if not sec_match:
        return swot

    # Grab every line that looks like a table row
    rows = [
        ln.strip()
        for ln in sec_match.group(1).splitlines()
        if ln.strip().startswith("|")
    ]

    def next_content_row(start_idx: int) -> list:
        """Return the split cells of the next non-separator data row."""
        for j in range(start_idx + 1, len(rows)):
            if "---" in rows[j]:
                continue
            # Split by |, ignore empty first/last cells caused by leading/trailing pipes
            cells = [c.strip() for c in rows[j].split("|")[1:-1]]
            if len(cells) >= 2:
                return cells
        return []

    for i, row in enumerate(rows):
        left = row.split("|")[1].strip() if len(row.split("|")) > 1 else ""

        if "**STRENGTHS**" in left:
            cells = next_content_row(i)
            if cells:
                swot["strengths"] = clean_swot_cell(cells[0])
                swot["weaknesses"] = clean_swot_cell(cells[1])

        elif "**OPPORTUNITIES**" in left:
            cells = next_content_row(i)
            if cells:
                swot["opportunities"] = clean_swot_cell(cells[0])
                swot["threats"] = clean_swot_cell(cells[1])

    return swot


def clean_swot_cell(raw: str) -> str:
    raw = re.sub(r"<br\s*/?>", "\n", raw)
    raw = re.sub(r"\s+", " ", raw)
    return raw.strip()

    body = sec_match.group(1)
    # The table is 2×2: STRENGTHS | WEAKNESSES  then  OPPORTUNITIES | THREATS
    # We extract each quadrant by looking for the bold header and capturing
    # bullet text until the next cell boundary or table row end.
    for quad in ["STRENGTHS", "WEAKNESSES", "OPPORTUNITIES", "THREATS"]:
        # Non-greedy match of the cell content after the header
        pat = rf"\*\*{quad}\*\*.*?\|\s*([^\|]*?(?:•\s*[^\n]*(?:\n(?!\s*\|)[^\n]*)?)*)\s*(?=\||\n\s*\|)"
        m = re.search(pat, body, re.IGNORECASE | re.DOTALL)
        if not m:
            # Fallback: looser capture
            pat2 = rf"\*\*{quad}\*\*[^\|]*\|\s*([^\n\|]+(?:\n[^\n\|]+)*)"
            m = re.search(pat2, body, re.IGNORECASE | re.DOTALL)
        if m:
            raw = m.group(1)
            raw = re.sub(r"<br\s*/?>", "\n", raw)
            raw = re.sub(r"\n\s+", "\n", raw)
            swot[quad.lower()] = raw.strip()
    return swot


def extract_bcg(text: str) -> str:
    m = re.search(
        r"BCG MATRIX CLASSIFICATION\s*\n?\s*([A-Z][A-Z\s]+?)(?:\s*(?:\(|-)|\n|<|$)",
        text,
    )
    if not m:
        return "QUESTION_MARK"
    label = m.group(1).strip().upper().replace(" ", "_")
    mapping = {
        "STAR": "STAR",
        "CASH_COW": "CASH_COW",
        "QUESTION_MARK": "QUESTION_MARK",
        "QUESTION": "QUESTION_MARK",
        "DOG": "DOG",
    }
    for k, v in mapping.items():
        if k in label:
            return v
    return "QUESTION_MARK"


def compute_benchmark_bands(fin: dict) -> dict:
    """
    Derive [min, max] bands from the single-point financials in each dossier.
    These bands are used by the backend to initialize team fundamentals at the
    midpoint during archetype assignment.
    """

    def pct(key: str) -> Optional[float]:
        s = fin.get(key, "")
        # Multi-value strings like "16% South India │ 3% National" → last number
        if "│" in s or "|" in s:
            nums = re.findall(r"(\d+\.?\d*)\s*%", s)
            if nums:
                return float(nums[-1])
        # Single value: grab first float from strings like "4% (Foods)" or "24.0%"
        clean = s.replace(",", "").strip()
        m = re.search(r"(\d+\.?\d*)", clean)
        if m:
            return float(m.group(1))
        return None

    def days(key: str) -> Optional[int]:
        s = fin.get(key, "")
        m = re.search(r"(\d+)\s*days?", s, re.I)
        return int(m.group(1)) if m else None

    def crore(key: str) -> Optional[float]:
        s = fin.get(key, "")
        return parse_currency(s)

    market_share = pct("Market Share")
    margin = pct("EBITDA Margin")
    growth = pct("YoY Revenue Growth")
    ccc = days("Cash Conversion Cycle")
    roce = pct("ROCE")
    revenue = crore("Revenue (Annual)")

    # --- Market Share Band ---
    if market_share is not None:
        if market_share >= 10:
            lo = round(market_share * 0.8, 1)
            hi = round(min(100, market_share * 1.2), 1)
        else:
            lo = round(market_share * 0.5, 1)
            hi = round(market_share * 1.5, 1)
        ms = [max(0.5, lo), hi]
    else:
        ms = [1.0, 5.0]

    # --- Margin Band ---
    if margin is not None:
        lo = round(max(-5.0, margin * 0.6), 1)
        hi = round(min(100.0, margin * 1.4), 1)
        mgn = [lo, hi]
    else:
        mgn = [5.0, 15.0]

    # --- Growth Band ---
    if growth is not None:
        if growth > 30:
            lo = round(growth * 0.5, 1)
            hi = round(growth * 1.5, 1)
        else:
            lo = round(growth * 0.6, 1)
            hi = round(growth * 1.4, 1)
        lo = max(-10.0, lo)
        grw = [lo, hi]
    else:
        grw = [5.0, 20.0]

    # --- Ops Efficiency Band (composite heuristic) ---
    # Based on ROCE and Cash Conversion Cycle, adjusted for revenue scale.
    base = 65.0
    if roce is not None:
        base += roce * 2.5
    if ccc is not None:
        base -= ccc / 3.0
    if revenue is not None:
        if revenue > 1000:
            base += 5
        elif revenue < 200:
            base -= 5
    base = max(30.0, min(95.0, base))
    ops = [round(base - 8, 1), round(min(98, base + 8), 1)]

    return {
        "market_share": ms,
        "margin": mgn,
        "growth": grw,
        "ops_efficiency": ops,
    }


def infer_starting_cash(revenue_cr: Optional[float]) -> int:
    """
    Mirror the preset archetype cash logic:
    Large cap (Legacy Giant) gets ~0.25× revenue, small cap gets ~3× revenue.
    Returned as integer rupees (not Crores).
    """
    if revenue_cr is None or revenue_cr <= 0:
        return 1_000_000_000  # 100 Cr default

    if revenue_cr > 5_000:
        mult = 0.25
    elif revenue_cr > 1_000:
        mult = 0.5
    elif revenue_cr > 300:
        mult = 1.5
    else:
        mult = 3.0

    cash_cr = revenue_cr * mult
    return int(cash_cr * 10_000_000)  # Cr → rupees


def parse_currency(s: str) -> Optional[float]:
    """Extract first float from strings like '₹5,000 Cr' or '₹320 Cr' or '₹100.00'."""
    s = s.replace("₹", "").replace(",", "").strip()
    m = re.search(r"(\d+\.?\d*)", s)
    if not m:
        return None
    return float(m.group(1))


def parse_shares(s: str) -> int:
    """'50 Cr' → 50,000,000. '1,000,000' → 1000000."""
    s = s.replace(",", "").strip()
    m = re.search(r"(\d+\.?\d*)", s)
    if not m:
        return 50_000_000
    val = float(m.group(1))
    if "cr" in s.lower():
        val *= 10_000_000
    return int(val)


def clean_paragraph(text: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


if __name__ == "__main__":
    main()

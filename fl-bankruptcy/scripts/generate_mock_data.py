"""Generates a realistic mock dataset of Florida federal bankruptcy filings.

The structure mirrors what you would get from PACER / CourtListener so the
front-end can be re-pointed at a real data source later without changes.

Run:  python scripts/generate_mock_data.py
Out:  data/filings.json
"""
from __future__ import annotations

import json
import random
from datetime import date, timedelta
from pathlib import Path

random.seed(20260101)

OUT = Path(__file__).resolve().parent.parent / "data" / "filings.json"

# Three federal bankruptcy court districts of Florida and their divisional offices.
# (Real divisions per uscourts.gov — used here so the data feels authentic.)
DISTRICTS = {
    "FLND": {
        "name": "Northern District of Florida",
        "short": "N.D. Fla.",
        "divisions": {
            "Tallahassee": ["Leon", "Gadsden", "Wakulla", "Jefferson", "Madison", "Liberty"],
            "Pensacola":   ["Escambia", "Santa Rosa", "Okaloosa", "Walton"],
            "Panama City": ["Bay", "Calhoun", "Gulf", "Holmes", "Jackson", "Washington"],
            "Gainesville": ["Alachua", "Levy", "Dixie", "Gilchrist", "Lafayette"],
        },
        "judges": ["Hon. Karen K. Specie", "Hon. Jerry A. Funk"],
    },
    "FLMB": {
        "name": "Middle District of Florida",
        "short": "M.D. Fla.",
        "divisions": {
            "Tampa":         ["Hillsborough", "Pinellas", "Pasco", "Manatee", "Polk", "Sarasota"],
            "Orlando":       ["Orange", "Seminole", "Osceola", "Brevard", "Volusia", "Lake"],
            "Jacksonville":  ["Duval", "Clay", "St. Johns", "Nassau", "Putnam", "Flagler"],
            "Fort Myers":    ["Lee", "Collier", "Charlotte", "Hendry", "Glades"],
            "Ocala":         ["Marion", "Citrus", "Hernando", "Sumter"],
        },
        "judges": [
            "Hon. Catherine Peek McEwen",
            "Hon. Caryl E. Delano",
            "Hon. Tiffany P. Geyer",
            "Hon. Lori V. Vaughan",
            "Hon. Jason A. Burgess",
        ],
    },
    "FLSB": {
        "name": "Southern District of Florida",
        "short": "S.D. Fla.",
        "divisions": {
            "Miami":            ["Miami-Dade", "Monroe"],
            "Fort Lauderdale":  ["Broward"],
            "West Palm Beach":  ["Palm Beach", "Martin", "St. Lucie", "Indian River", "Okeechobee", "Highlands"],
        },
        "judges": [
            "Hon. Laurel M. Isicoff",
            "Hon. Robert A. Mark",
            "Hon. Erik P. Kimball",
            "Hon. Mindy A. Mora",
            "Hon. Scott M. Grossman",
            "Hon. Peter D. Russin",
        ],
    },
}

CHAPTERS = [
    # (chapter, weight, label)
    ("7",  62, "Chapter 7 \u2014 Liquidation"),
    ("13", 27, "Chapter 13 \u2014 Wage Earner"),
    ("11",  9, "Chapter 11 \u2014 Reorganization"),
    ("15",  2, "Chapter 15 \u2014 Cross-Border"),
]
CHAPTER_KEYS = [c[0] for c in CHAPTERS]
CHAPTER_WEIGHTS = [c[1] for c in CHAPTERS]
CHAPTER_LABEL = {c[0]: c[2] for c in CHAPTERS}

STATUSES = [
    ("Open",       55),
    ("Discharged", 25),
    ("Dismissed",  12),
    ("Closed",      8),
]

NATURES = [
    "Consumer / Non-Business",
    "Business",
]

# Realistic-sounding pools — entirely fictitious.
FIRST_NAMES = [
    "James","Maria","Robert","Patricia","John","Jennifer","Michael","Linda","David","Elizabeth",
    "William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen",
    "Christopher","Nancy","Daniel","Lisa","Matthew","Betty","Anthony","Helen","Mark","Sandra",
    "Donald","Donna","Steven","Carol","Paul","Ruth","Andrew","Sharon","Joshua","Michelle",
    "Kenneth","Laura","Kevin","Sarah","Brian","Kimberly","George","Deborah","Edward","Dorothy",
    "Ronald","Amy","Timothy","Angela","Jason","Ashley","Jeffrey","Brenda","Ryan","Emma",
    "Jacob","Olivia","Gary","Cynthia","Nicholas","Marie","Eric","Janet","Jonathan","Catherine",
    "Stephen","Frances","Larry","Christine","Justin","Samantha","Scott","Debra","Brandon","Rachel",
    "Benjamin","Carolyn","Samuel","Virginia","Gregory","Maria","Frank","Heather","Alexander","Diane",
    "Raymond","Julie","Patrick","Joyce","Jack","Victoria","Dennis","Kelly","Jerry","Christina",
    "Tyler","Joan","Aaron","Evelyn","Jose","Lauren","Henry","Judith","Adam","Megan",
    "Carlos","Cheryl","Luis","Andrea","Diego","Hannah","Antonio","Jacqueline","Miguel","Martha",
]

LAST_NAMES = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
    "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
    "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
    "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores",
    "Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts",
    "Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes",
    "Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper",
    "Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson",
    "Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes",
    "Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez",
]

BUSINESS_PREFIXES = [
    "Sunshine","Atlantic","Gulf Coast","Palmetto","Coastal","Everglades","Tropical","Bayfront",
    "Magnolia","Citrus","Mangrove","Seaside","Heritage","Southern","Florida","Cypress","Pelican",
    "Coral","Ibis","Manatee","Sandhill","Crescent","Oceanview","Riverbend","Reef","Anchor",
]

BUSINESS_SUFFIXES = [
    ("Construction Group", "Business"),
    ("Holdings", "Business"),
    ("Properties", "Business"),
    ("Restaurant Group", "Business"),
    ("Hospitality", "Business"),
    ("Logistics", "Business"),
    ("Trucking", "Business"),
    ("Marine Services", "Business"),
    ("Medical Associates", "Business"),
    ("Auto Group", "Business"),
    ("Real Estate Partners", "Business"),
    ("Roofing", "Business"),
    ("Landscaping", "Business"),
    ("Hotels", "Business"),
    ("Bakery", "Business"),
    ("Marketing", "Business"),
    ("Fitness", "Business"),
    ("Aviation", "Business"),
    ("Citrus Growers", "Business"),
    ("Yacht Sales", "Business"),
]

ENTITY_TYPES = ["LLC", "Inc.", "Corp.", "LP", ""]

ATTORNEYS = [
    "Stephanie Lieb", "Marcus Whitfield", "Elena Castaneda", "Brett Holloway",
    "Aisha Patel", "Daniel Krasnow", "Yvette Caro", "Trevor Linville",
    "Rachel Kahan", "Vincent Marrero", "Nicole DeSimone", "Omar Velasquez",
    "Samantha Ortega", "Bruce Levinson", "Priya Raghunathan", "Jordan McCabe",
    "Hector Salazar", "Maya Friedman", "Pro Se",  # self-represented
]


def make_case_number(district_code: str, year: int, seq: int) -> str:
    # Real PACER format: e.g. "8:24-bk-04123-CED" but bk court typically "24-12345"
    return f"{year % 100:02d}-{seq:05d}"


def make_debtor():
    if random.random() < 0.78:
        # Individual / consumer
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        if random.random() < 0.18:
            # Joint filing
            spouse_first = random.choice(FIRST_NAMES)
            return {
                "name": f"{first} {last} and {spouse_first} {last}",
                "type": "Individual (Joint)",
                "nature": "Consumer / Non-Business",
            }
        return {
            "name": f"{first} {last}",
            "type": "Individual",
            "nature": "Consumer / Non-Business",
        }
    # Business
    pref = random.choice(BUSINESS_PREFIXES)
    suf, nature = random.choice(BUSINESS_SUFFIXES)
    ent = random.choice(ENTITY_TYPES)
    name = f"{pref} {suf}{(' ' + ent) if ent else ''}"
    return {"name": name.strip(), "type": "Business", "nature": nature}


def money(low: int, high: int) -> int:
    # Skewed toward the low end via two-sample min — feels more realistic.
    return min(random.randint(low, high), random.randint(low, high))


def make_filing(seq: int) -> dict:
    today = date.today()
    days_back = int(random.triangular(0, 365, 60))  # most filings recent
    fdate = today - timedelta(days=days_back)

    district_code = random.choices(
        ["FLND", "FLMB", "FLSB"],
        weights=[12, 48, 40],  # roughly proportional to population / caseload
    )[0]
    district = DISTRICTS[district_code]
    division = random.choice(list(district["divisions"].keys()))
    county = random.choice(district["divisions"][division])

    chapter = random.choices(CHAPTER_KEYS, weights=CHAPTER_WEIGHTS)[0]
    debtor = make_debtor()

    # Chapter 11 / 15 are usually businesses — nudge it.
    if chapter in ("11", "15") and debtor["type"].startswith("Individual"):
        debtor = {
            "name": f"{random.choice(BUSINESS_PREFIXES)} {random.choice(BUSINESS_SUFFIXES)[0]} {random.choice(['LLC','Inc.','Corp.'])}",
            "type": "Business",
            "nature": "Business",
        }

    if debtor["type"] == "Business":
        assets = money(50_000, 25_000_000)
        liabilities = int(assets * random.uniform(0.6, 4.5))
    else:
        assets = money(2_000, 750_000)
        liabilities = int(assets * random.uniform(1.0, 6.0))

    status = random.choices(
        [s[0] for s in STATUSES],
        weights=[s[1] for s in STATUSES],
    )[0]
    # Recent filings biased toward Open
    if days_back < 60:
        status = "Open" if random.random() < 0.85 else status

    return {
        "id": f"flbk-{seq:05d}",
        "case_number": make_case_number(district_code, fdate.year, 4000 + seq),
        "filed_date": fdate.isoformat(),
        "chapter": chapter,
        "chapter_label": CHAPTER_LABEL[chapter],
        "district_code": district_code,
        "district_name": district["name"],
        "district_short": district["short"],
        "division": division,
        "county": county,
        "judge": random.choice(district["judges"]),
        "debtor": debtor["name"],
        "debtor_type": debtor["type"],
        "nature_of_debt": debtor["nature"],
        "attorney": random.choice(ATTORNEYS),
        "total_assets": assets,
        "total_liabilities": liabilities,
        "status": status,
    }


def main():
    n = 240
    filings = [make_filing(i + 1) for i in range(n)]
    filings.sort(key=lambda f: f["filed_date"], reverse=True)

    payload = {
        "generated_at": date.today().isoformat(),
        "source": "Synthetic / illustrative data — not real court records.",
        "districts": {
            code: {"name": d["name"], "short": d["short"]}
            for code, d in DISTRICTS.items()
        },
        "filings": filings,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(filings)} filings -> {OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Tag the catalog with 2026 U.S. News-style national ranks and add missing top-100 schools."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "universities.json"

DEFAULT_DEPARTMENTS = [
    "Computer Science",
    "Electrical Engineering and Computer Science",
    "Computer Engineering",
]

# Ordered 2026 U.S. News National Universities top 100 (ties share the listed rank).
TOP_100 = [
    ("princeton.edu", 1),
    ("mit.edu", 2),
    ("harvard.edu", 3),
    ("stanford.edu", 4),
    ("yale.edu", 4),
    ("uchicago.edu", 6),
    ("duke.edu", 7),
    ("jhu.edu", 7),
    ("northwestern.edu", 7),
    ("upenn.edu", 7),
    ("caltech.edu", 11),
    ("cornell.edu", 12),
    ("brown.edu", 13),
    ("dartmouth.edu", 13),
    ("columbia.edu", 15),
    ("berkeley.edu", 15),
    ("rice.edu", 17),
    ("ucla.edu", 17),
    ("vanderbilt.edu", 17),
    ("cmu.edu", 20),
    ("umich.edu", 20),
    ("nd.edu", 20),
    ("wustl.edu", 20),
    ("emory.edu", 24),
    ("georgetown.edu", 24),
    ("unc.edu", 26),
    ("virginia.edu", 26),
    ("usc.edu", 28),
    ("ucsd.edu", 29),
    ("ufl.edu", 30),
    ("utexas.edu", 30),
    ("gatech.edu", 32),
    ("nyu.edu", 32),
    ("ucdavis.edu", 32),
    ("uci.edu", 32),
    ("bc.edu", 36),
    ("tufts.edu", 36),
    ("illinois.edu", 36),
    ("wisc.edu", 36),
    ("ucsb.edu", 40),
    ("osu.edu", 41),
    ("bu.edu", 42),
    ("rutgers.edu", 42),
    ("umd.edu", 42),
    ("washington.edu", 42),
    ("lehigh.edu", 46),
    ("northeastern.edu", 46),
    ("purdue.edu", 46),
    ("uga.edu", 46),
    ("rochester.edu", 46),
    ("wm.edu", 51),
    ("case.edu", 51),
    ("tulane.edu", 51),
    ("villanova.edu", 54),
    ("fsu.edu", 54),
    ("umn.edu", 54),
    ("uconn.edu", 54),
    ("umass.edu", 60),
    ("psu.edu", 60),
    ("smu.edu", 60),
    ("miami.edu", 61),
    ("gwu.edu", 61),
    ("syracuse.edu", 61),
    ("fordham.edu", 61),
    ("wfu.edu", 61),
    ("brandeis.edu", 66),
    ("rpi.edu", 66),
    ("vt.edu", 68),
    ("pitt.edu", 68),
    ("tamu.edu", 68),
    ("stonybrook.edu", 72),
    ("indiana.edu", 73),
    ("msu.edu", 73),
    ("ncsu.edu", 75),
    ("pepperdine.edu", 76),
    ("du.edu", 76),
    ("american.edu", 78),
    ("baylor.edu", 80),
    ("tcu.edu", 80),
    ("yu.edu", 82),
    ("stevens.edu", 82),
    ("wpi.edu", 82),
    ("byu.edu", 85),
    ("colorado.edu", 85),
    ("arizona.edu", 87),
    ("asu.edu", 87),
    ("uiowa.edu", 89),
    ("udel.edu", 90),
    ("drexel.edu", 91),
    ("howard.edu", 92),
    ("sc.edu", 93),
    ("clemson.edu", 93),
    ("auburn.edu", 95),
    ("ua.edu", 96),
    ("utk.edu", 97),
    ("uky.edu", 98),
    ("ku.edu", 99),
    ("missouri.edu", 100),
    ("ou.edu", 100),
    ("uark.edu", 100),
]

MISSING = [
    {
        "name": "Baylor University",
        "shortName": "Baylor",
        "aliases": ["Baylor"],
        "domain": "baylor.edu",
        "departments": DEFAULT_DEPARTMENTS,
        "facultyDirectories": [
            "https://cs.ecs.baylor.edu/faculty",
            "https://www.ecs.baylor.edu/computer-science/faculty",
        ],
    },
    {
        "name": "Texas Christian University",
        "shortName": "TCU",
        "aliases": ["TCU"],
        "domain": "tcu.edu",
        "departments": DEFAULT_DEPARTMENTS,
        "facultyDirectories": [
            "https://engineering.tcu.edu/computer-science/faculty",
        ],
    },
    {
        "name": "Yeshiva University",
        "shortName": "Yeshiva",
        "aliases": ["YU"],
        "domain": "yu.edu",
        "departments": DEFAULT_DEPARTMENTS,
        "facultyDirectories": [
            "https://www.yu.edu/katz/faculty",
        ],
    },
]


def main() -> None:
    data = json.loads(CATALOG.read_text())
    rank_by_domain = {domain: rank for domain, rank in TOP_100}
    existing = {row["domain"] for row in data}

    for row in MISSING:
        if row["domain"] not in existing:
            data.append(row)
            existing.add(row["domain"])

    for row in data:
        rank = rank_by_domain.get(row["domain"])
        row["nationalRank"] = rank
        row["inTop100"] = rank is not None

    data.sort(
        key=lambda row: (
            0 if row.get("inTop100") else 1,
            row.get("nationalRank") or 9999,
            row["name"],
        )
    )
    CATALOG.write_text(json.dumps(data, indent=2) + "\n")
    top = [row for row in data if row.get("inTop100")]
    print(f"catalog={len(data)} top100={len(top)} unique_top_domains={len({r['domain'] for r in top})}")


if __name__ == "__main__":
    main()

"""Outreach copy for the broker pitch.

These pitch the lead-broker angle: 'I send you ready-to-call homeowners
who need plumbing work — pay only for qualified leads.'
"""
from __future__ import annotations

import os
from typing import Any

BROKER = {
    "company": os.getenv("BROKER_COMPANY_NAME", "PalmLeads"),
    "name":    os.getenv("BROKER_CONTACT_NAME", "Alex"),
    "phone":   os.getenv("BROKER_PHONE", "(561) 555-0100"),
    "website": os.getenv("BROKER_WEBSITE", "https://palmleads.example"),
}


def _city_from_address(address: str) -> str:
    if not address:
        return "Palm Beach County"
    parts = [p.strip() for p in address.split(",")]
    if len(parts) >= 3:
        return parts[-3]
    return parts[0] if parts else "Palm Beach County"


def render_templates(lead: dict[str, Any]) -> dict[str, str]:
    """Return a dict of {channel: message} for a given lead."""
    name = lead.get("name") or "there"
    first_name = name.split()[0]
    city = _city_from_address(lead.get("address", ""))
    rating = lead.get("rating")
    reviews = lead.get("reviews") or 0
    has_site = bool(lead.get("website"))

    rating_line = (
        f"Saw your {rating:.1f}\u2605 ({reviews:,} reviews) on Google "
        if rating else ""
    )

    no_site_line = (
        " I noticed you don't have a website yet, so we'd be your main "
        "online channel for new jobs."
        if not has_site else ""
    )

    return {
        "sms": (
            f"Hi {first_name} \u2014 {BROKER['name']} from {BROKER['company']}. "
            f"We send {city} homeowners who need a plumber NOW directly to "
            f"local pros. No upfront fee, you only pay for qualified leads. "
            f"Open to a 5-min call this week? \u2014 {BROKER['phone']}"
        ),
        "email_subject": (
            f"Ready-to-call plumbing leads in {city} (no upfront cost)"
        ),
        "email": (
            f"Hi {first_name},\n\n"
            f"{rating_line}\u2014 looks like {name} is one of the better-rated "
            f"shops in {city}.\n\n"
            f"Quick reason for reaching out: I run {BROKER['company']}. We "
            f"capture {city} homeowners actively searching for plumbing help "
            f"(burst pipes, water heaters, drain clogs, repipes) and route "
            f"them straight to one local plumber.{no_site_line}\n\n"
            f"How it works:\n"
            f"  \u2022 No setup fees, no monthly retainer\n"
            f"  \u2022 You pay per qualified lead (homeowner answered, real "
            f"job, in your service area)\n"
            f"  \u2022 You can pause anytime\n\n"
            f"Would it be worth a 10-minute call this week to see what "
            f"volume looks like for your zip codes?\n\n"
            f"Thanks,\n"
            f"{BROKER['name']}\n"
            f"{BROKER['company']} \u2014 {BROKER['phone']}\n"
            f"{BROKER['website']}"
        ),
        "voicemail": (
            f"Hi, this message is for {first_name} at {name}. "
            f"My name is {BROKER['name']} with {BROKER['company']}. "
            f"We send {city}-area homeowners who need a plumber today directly "
            f"to local pros \u2014 no upfront cost, you only pay for qualified "
            f"leads. I\u2019d love to see if we\u2019re a fit for your shop. "
            f"Give me a ring back at {BROKER['phone']}. Thanks!"
        ),
        "linkedin_dm": (
            f"Hey {first_name} \u2014 saw {name} comes up strong for "
            f"plumbing in {city}. I run {BROKER['company']}; we capture "
            f"homeowners in your area who need a plumber and route them to "
            f"one local pro per zip. Pay-per-lead, no contracts. Worth a "
            f"quick chat?"
        ),
    }

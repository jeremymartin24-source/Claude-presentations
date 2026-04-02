#!/usr/bin/env python3
"""
generate_deck.py — AI-powered PowerPoint generator matching the IT260 lecture deck style.

Claude chooses which slide types to use, in what order, and what content format
fits each slide best. No fixed sequence is hardcoded.

Usage:
    python generate_deck.py --topic "Network Security Fundamentals" \
                            --module 2 \
                            --course "IT260 · IT Risk Management" \
                            --professor "Professor Martin · University of Northwestern Ohio · Fall 2025" \
                            --output "Module2.pptx"

Environment:
    ANTHROPIC_API_KEY  — required
"""

import argparse
import json
import sys
from pptx import Presentation
from pptx.util import Emu, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
import anthropic

# ── Design constants ───────────────────────────────────────────────────────────
RED       = RGBColor(0x68, 0x00, 0x01)   # #680001  primary brand red
WHITE     = RGBColor(0xFF, 0xFF, 0xFF)
PINK      = RGBColor(0xF5, 0xC0, 0xC0)   # light pink — used on dark bg
DARK_GRAY = RGBColor(0x33, 0x33, 0x33)   # body text on white bg
CARD_BG   = RGBColor(0xF5, 0xF5, 0xF5)   # overview / key-term card background
CARD_BDR  = RGBColor(0xDD, 0xDD, 0xDD)   # card border

SLIDE_W = Emu(9144000)
SLIDE_H = Emu(5143500)
FONT    = "Calibri"

HEADER_H  = Emu(1005840)   # height of the red banner on white-bg slides
MARGIN    = Emu(365760)    # ~0.4 in
INNER_MAR = Emu(411480)    # intro/body left margin
GAP       = Emu(91440)     # inter-element gap


# ── Pptx helpers ──────────────────────────────────────────────────────────────

def new_presentation():
    prs = Presentation()
    prs.slide_width  = SLIDE_W
    prs.slide_height = SLIDE_H
    return prs


def blank_slide(prs):
    layout = prs.slide_layouts[6]   # completely blank
    return prs.slides.add_slide(layout)


def add_rect(slide, x, y, w, h, fill_rgb, border_rgb=None, border_w=Emu(12700)):
    from pptx.util import Emu as E
    shape = slide.shapes.add_shape(
        1,   # MSO_SHAPE_TYPE.RECTANGLE
        x, y, w, h
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_rgb
    line = shape.line
    if border_rgb:
        line.color.rgb = border_rgb
        line.width = border_w
    else:
        line.fill.background()
    return shape


def add_textbox(slide, x, y, w, h, text, size_pt, bold=False, color=WHITE,
                align=PP_ALIGN.LEFT, word_wrap=True, italic=False, space_before=0):
    txb = slide.shapes.add_textbox(x, y, w, h)
    tf  = txb.text_frame
    tf.word_wrap = word_wrap
    tf.auto_size = None


    p = tf.paragraphs[0]
    p.alignment = align
    if space_before:
        p.space_before = Pt(space_before)
    run = p.add_run()
    run.text = text
    run.font.name  = FONT
    run.font.size  = Pt(size_pt)
    run.font.bold  = bold
    run.font.italic = italic
    run.font.color.rgb = color
    return txb


def add_footer(slide, course_label, university):
    """Dark red footer bar at the bottom of white-bg slides."""
    footer_h = Emu(228600)
    y = SLIDE_H - footer_h
    add_rect(slide, Emu(0), y, SLIDE_W, footer_h, RED)
    # left text
    add_textbox(slide, MARGIN, y, Emu(4000000), footer_h,
                course_label, 9, color=WHITE, align=PP_ALIGN.LEFT)
    # right text
    add_textbox(slide, Emu(5144000), y, Emu(3800000), footer_h,
                university, 9, color=WHITE, align=PP_ALIGN.RIGHT)


def add_red_header(slide, title_text, course_label, university):
    """Full-width red header banner + slide title + footer for content slides."""
    add_rect(slide, Emu(0), Emu(0), SLIDE_W, HEADER_H, RED)
    add_textbox(slide, MARGIN, Emu(91440), Emu(7000000), HEADER_H - Emu(91440),
                title_text, 26, bold=True, color=WHITE, align=PP_ALIGN.LEFT)
    add_footer(slide, course_label, university)


# ── Slide builders ─────────────────────────────────────────────────────────────

def build_title_slide(prs, data, course, professor):
    """
    Slide type: "title"
    data keys: title, subtitle
    """
    slide = blank_slide(prs)
    bg = slide.background
    bg.fill.solid()
    bg.fill.fore_color.rgb = RED

    # White header bar (top strip)
    add_rect(slide, Emu(0), Emu(0), SLIDE_W, Emu(1051560), WHITE)

    # Course label (right-aligned, on white bar)
    add_textbox(slide, Emu(2926080), Emu(256032), Emu(5943600), Emu(502920),
                course, 13, color=DARK_GRAY, align=PP_ALIGN.RIGHT)

    # Module badge
    add_rect(slide, MARGIN, Emu(1389888), Emu(1554480), Emu(384048),
             RGBColor(0xFF, 0xFF, 0xFF),   # white, will look translucent-ish
             border_rgb=WHITE)
    add_textbox(slide, MARGIN, Emu(1389888), Emu(1554480), Emu(384048),
                data.get("badge", ""), 11, bold=True, color=RED, align=PP_ALIGN.CENTER)

    # Main title
    add_textbox(slide, MARGIN, Emu(1828800), Emu(8229600), Emu(1500000),
                data["title"], 48, bold=True, color=WHITE)

    # Subtitle
    add_textbox(slide, MARGIN, Emu(3350000), Emu(8229600), Emu(700000),
                data.get("subtitle", ""), 15, color=PINK)

    # Professor / institution line
    add_textbox(slide, MARGIN, Emu(4500000), Emu(8229600), Emu(400000),
                professor, 12, color=WHITE)

    return slide


def build_section_divider(prs, data, *_):
    """
    Slide type: "section_divider"
    data keys: label, title, subtitle
    """
    slide = blank_slide(prs)
    bg = slide.background
    bg.fill.solid()
    bg.fill.fore_color.rgb = RED

    # Small label (e.g. "Module 2")
    add_textbox(slide, MARGIN, Emu(1200000), Emu(7000000), Emu(400000),
                data.get("label", ""), 15, color=PINK)

    # Big title
    add_textbox(slide, MARGIN, Emu(1650000), Emu(8229600), Emu(1800000),
                data["title"], 44, bold=True, color=WHITE)

    # Tagline
    add_textbox(slide, MARGIN, Emu(3500000), Emu(8229600), Emu(600000),
                data.get("subtitle", ""), 16, color=PINK)

    return slide


def build_overview(prs, data, course, professor):
    """
    Slide type: "overview"
    data keys: heading, intro, sections:[{title, description}]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    # Intro paragraph
    add_textbox(slide, INNER_MAR, HEADER_H + GAP,
                SLIDE_W - INNER_MAR * 2, Emu(500000),
                data.get("intro", ""), 13, color=DARK_GRAY)

    # Topic cards in a grid (2 columns)
    sections = data.get("sections", [])
    card_w = Emu(4206240)
    card_h = Emu(1200000)
    top_stripe_h = Emu(54864)
    col_gap = Emu(182880)
    row_gap = Emu(91440)
    start_y = HEADER_H + Emu(620000)
    start_x = MARGIN

    for i, sec in enumerate(sections[:6]):
        col = i % 2
        row = i // 2
        x = start_x + col * (card_w + col_gap)
        y = start_y + row * (card_h + row_gap)

        # Card background
        add_rect(slide, x, y, card_w, card_h, CARD_BG, CARD_BDR)
        # Red top stripe
        add_rect(slide, x, y, card_w, top_stripe_h, RED)
        # Section heading
        add_textbox(slide, x + GAP, y + top_stripe_h + GAP,
                    card_w - GAP * 2, Emu(200000),
                    sec["title"], 13, bold=True, color=RED)
        # Section description
        add_textbox(slide, x + GAP, y + top_stripe_h + Emu(240000),
                    card_w - GAP * 2, card_h - top_stripe_h - Emu(260000),
                    sec["description"], 11.5, color=DARK_GRAY)

    return slide


def build_objectives(prs, data, course, professor):
    """
    Slide type: "objectives"
    data keys: heading, intro, items:[str]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    add_textbox(slide, INNER_MAR, HEADER_H + GAP,
                SLIDE_W - INNER_MAR * 2, Emu(380000),
                data.get("intro", "By the end of this module, you will be able to:"),
                13.5, color=DARK_GRAY)

    items = data.get("items", [])
    item_h = Emu(480000)
    badge_w = Emu(300000)
    badge_gap = Emu(60000)
    text_w = SLIDE_W - MARGIN * 2 - badge_w - badge_gap
    start_y = HEADER_H + Emu(480000)

    # Two-column layout for items
    col_count = 2 if len(items) > 3 else 1
    col_w = (SLIDE_W - MARGIN * 2 - GAP * (col_count - 1)) // col_count

    for i, item in enumerate(items[:6]):
        col = i % col_count if col_count == 2 else 0
        row = i // col_count if col_count == 2 else i
        x = MARGIN + col * (col_w + GAP)
        y = start_y + row * (item_h + GAP)

        # Number badge (red square)
        add_rect(slide, x, y, badge_w, badge_w, RED)
        num_str = f"{(i + 1):02d}"
        add_textbox(slide, x, y, badge_w, badge_w,
                    num_str, 13, bold=True, color=WHITE, align=PP_ALIGN.CENTER)

        # Item text
        add_textbox(slide, x + badge_w + badge_gap, y,
                    col_w - badge_w - badge_gap, item_h,
                    item, 13, color=DARK_GRAY)

    return slide


def build_content_bullets(prs, data, course, professor):
    """
    Slide type: "content_bullets"
    Single column: intro paragraph + sections with red headings and bullet lists.
    data keys: heading, intro, sections:[{heading, bullets:[str]}]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    y = HEADER_H + GAP
    if data.get("intro"):
        add_textbox(slide, INNER_MAR, y,
                    SLIDE_W - INNER_MAR * 2, Emu(480000),
                    data["intro"], 12.5, color=DARK_GRAY)
        y += Emu(500000)

    for sec in data.get("sections", []):
        # Red heading
        add_textbox(slide, INNER_MAR, y,
                    SLIDE_W - INNER_MAR * 2, Emu(240000),
                    sec["heading"], 14, bold=True, color=RED)
        y += Emu(250000)
        # Bullets
        for bullet in sec.get("bullets", []):
            add_textbox(slide, INNER_MAR + Emu(60000), y,
                        SLIDE_W - INNER_MAR * 2 - Emu(60000), Emu(200000),
                        f"▸  {bullet}", 10.5, color=DARK_GRAY)
            y += Emu(210000)
        y += GAP

    return slide


def build_content_columns(prs, data, course, professor):
    """
    Slide type: "content_columns"
    2-3 column layout, each column has a red header + bullet list.
    data keys: heading, intro, columns:[{heading, bullets:[str]}]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    y = HEADER_H + GAP
    if data.get("intro"):
        add_textbox(slide, INNER_MAR, y,
                    SLIDE_W - INNER_MAR * 2, Emu(420000),
                    data["intro"], 12.5, color=DARK_GRAY)
        y += Emu(440000)

    cols = data.get("columns", [])
    n = max(1, min(len(cols), 3))
    avail_w = SLIDE_W - MARGIN * 2
    col_w = (avail_w - GAP * (n - 1)) // n
    avail_h = SLIDE_H - y - Emu(300000)

    col_header_h = Emu(240000)

    for i, col in enumerate(cols[:3]):
        x = MARGIN + i * (col_w + GAP)
        # Column header bar
        add_rect(slide, x, y, col_w, col_header_h, RED)
        add_textbox(slide, x + GAP, y, col_w - GAP, col_header_h,
                    col["heading"], 14, bold=True, color=WHITE)
        # Bullets
        by = y + col_header_h + GAP
        for bullet in col.get("bullets", []):
            bh = Emu(200000)
            add_textbox(slide, x + Emu(30000), by,
                        col_w - Emu(30000), bh,
                        f"▸  {bullet}", 10.5, color=DARK_GRAY)
            by += bh + Emu(30000)

    return slide


def build_content_table(prs, data, course, professor):
    """
    Slide type: "content_table"
    A scenario/comparison table.
    data keys: heading, intro, rows:[{label, normal, threat, impact}]
    OR generic: columns:[str], rows:[[str]]
    """
    from pptx.util import Pt as P
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    y = HEADER_H + GAP
    if data.get("intro"):
        add_textbox(slide, INNER_MAR, y,
                    SLIDE_W - INNER_MAR * 2, Emu(380000),
                    data["intro"], 12.5, color=DARK_GRAY)
        y += Emu(400000)

    col_headers = data.get("columns", [])
    rows = data.get("rows", [])
    if not col_headers or not rows:
        return slide

    n_cols = len(col_headers)
    avail_w = SLIDE_W - MARGIN * 2
    col_w = avail_w // n_cols
    row_h = Emu(350000)
    hdr_h = Emu(280000)

    # Header row
    for ci, hdr in enumerate(col_headers):
        x = MARGIN + ci * col_w
        add_rect(slide, x, y, col_w, hdr_h, RED, WHITE, Emu(6350))
        add_textbox(slide, x + GAP, y, col_w - GAP, hdr_h,
                    hdr, 12, bold=True, color=WHITE)
    y += hdr_h

    # Data rows
    for ri, row in enumerate(rows):
        bg = CARD_BG if ri % 2 == 0 else WHITE
        for ci, cell in enumerate(row[:n_cols]):
            x = MARGIN + ci * col_w
            add_rect(slide, x, y, col_w, row_h, bg, CARD_BDR, Emu(6350))
            add_textbox(slide, x + GAP, y + GAP, col_w - GAP * 2,
                        row_h - GAP, cell, 10.5, color=DARK_GRAY)
        y += row_h

    return slide


def build_key_terms(prs, data, course, professor):
    """
    Slide type: "key_terms"
    data keys: heading, terms:[{term, definition}]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    terms = data.get("terms", [])
    col_count = 2 if len(terms) > 4 else 1
    avail_w = SLIDE_W - MARGIN * 2
    col_w = (avail_w - (GAP if col_count == 2 else 0)) // col_count
    item_h = Emu(380000)
    start_y = HEADER_H + Emu(100000)

    for i, t in enumerate(terms[:8]):
        col = i % col_count
        row = i // col_count
        x = MARGIN + col * (col_w + GAP)
        y = start_y + row * (item_h + GAP // 2)

        # Term (red, bold)
        add_textbox(slide, x, y, col_w, Emu(200000),
                    t["term"], 12, bold=True, color=RED)
        # Definition (gray)
        add_textbox(slide, x, y + Emu(200000), col_w, Emu(200000),
                    t["definition"], 11.5, color=DARK_GRAY)

    return slide


def build_case_study(prs, data, course, professor):
    """
    Slide type: "case_study"
    A real-world example with labelled panels.
    data keys: heading, intro, panels:[{label, content}]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    y = HEADER_H + GAP
    if data.get("intro"):
        add_textbox(slide, INNER_MAR, y,
                    SLIDE_W - INNER_MAR * 2, Emu(380000),
                    data["intro"], 12.5, color=DARK_GRAY)
        y += Emu(400000)

    panels = data.get("panels", [])
    label_w = Emu(1400000)
    content_w = SLIDE_W - MARGIN * 2 - label_w - GAP
    panel_h = Emu(350000)

    for panel in panels:
        # Label box (red)
        add_rect(slide, MARGIN, y, label_w, panel_h, RED)
        add_textbox(slide, MARGIN + Emu(30000), y, label_w - Emu(60000), panel_h,
                    panel["label"], 12, bold=True, color=WHITE)
        # Content box
        add_rect(slide, MARGIN + label_w + GAP, y, content_w, panel_h, CARD_BG, CARD_BDR)
        add_textbox(slide, MARGIN + label_w + GAP + Emu(30000), y + Emu(30000),
                    content_w - Emu(60000), panel_h - Emu(30000),
                    panel["content"], 11, color=DARK_GRAY)
        y += panel_h + GAP // 2

    return slide


def build_takeaways(prs, data, course, professor):
    """
    Slide type: "takeaways"
    data keys: heading, items:[str], next_module (optional)
    """
    slide = blank_slide(prs)
    bg = slide.background
    bg.fill.solid()
    bg.fill.fore_color.rgb = RED

    # Heading
    add_textbox(slide, MARGIN, Emu(150000), SLIDE_W - MARGIN * 2, Emu(400000),
                data["heading"], 28, bold=True, color=WHITE)

    items = data.get("items", [])
    badge_w = Emu(270000)
    item_h  = Emu(330000)
    text_w  = SLIDE_W - MARGIN * 2 - badge_w - GAP
    start_y = Emu(600000)

    col_count = 2 if len(items) > 4 else 1
    if col_count == 2:
        col_w = (SLIDE_W - MARGIN * 2 - GAP) // 2

    for i, item in enumerate(items[:8]):
        col = i % col_count if col_count == 2 else 0
        row = i // col_count if col_count == 2 else i
        x = MARGIN + col * (col_w + GAP) if col_count == 2 else MARGIN
        w = col_w if col_count == 2 else text_w + badge_w + GAP
        y = start_y + row * (item_h + GAP // 2)

        # Number badge (white)
        add_rect(slide, x, y, badge_w, badge_w, WHITE)
        add_textbox(slide, x, y, badge_w, badge_w,
                    str(i + 1), 12, bold=True, color=RED, align=PP_ALIGN.CENTER)
        # Item text
        tw = (col_w if col_count == 2 else SLIDE_W - MARGIN * 2) - badge_w - GAP
        add_textbox(slide, x + badge_w + GAP, y, tw, item_h,
                    item, 12.5, color=WHITE)

    if data.get("next_module"):
        add_textbox(slide, MARGIN, SLIDE_H - Emu(350000),
                    SLIDE_W - MARGIN * 2, Emu(250000),
                    data["next_module"], 12, color=PINK, italic=True)

    return slide


def build_assignment(prs, data, course, professor):
    """
    Slide type: "assignment"
    data keys: heading, intro, items:[{number, text}]
    """
    slide = blank_slide(prs)
    add_red_header(slide, data["heading"], course, professor)

    y = HEADER_H + GAP
    if data.get("intro"):
        add_textbox(slide, INNER_MAR, y,
                    SLIDE_W - INNER_MAR * 2, Emu(400000),
                    data["intro"], 13, color=DARK_GRAY)
        y += Emu(430000)

    for item in data.get("items", []):
        # Number badge
        badge_w = Emu(270000)
        add_rect(slide, INNER_MAR, y, badge_w, badge_w, RED)
        add_textbox(slide, INNER_MAR, y, badge_w, badge_w,
                    str(item["number"]), 13, bold=True,
                    color=WHITE, align=PP_ALIGN.CENTER)
        # Text
        add_textbox(slide, INNER_MAR + badge_w + GAP, y,
                    SLIDE_W - INNER_MAR * 2 - badge_w - GAP, Emu(280000),
                    item["text"], 13, color=DARK_GRAY)
        y += Emu(290000) + GAP // 2

    return slide


# ── Slide dispatch ─────────────────────────────────────────────────────────────

BUILDERS = {
    "title":            build_title_slide,
    "section_divider":  build_section_divider,
    "overview":         build_overview,
    "objectives":       build_objectives,
    "content_bullets":  build_content_bullets,
    "content_columns":  build_content_columns,
    "content_table":    build_content_table,
    "key_terms":        build_key_terms,
    "case_study":       build_case_study,
    "takeaways":        build_takeaways,
    "assignment":       build_assignment,
}


def build_slide(prs, slide_data, course, professor):
    stype = slide_data.get("type")
    builder = BUILDERS.get(stype)
    if builder is None:
        print(f"  ⚠  Unknown slide type '{stype}' — skipping.", file=sys.stderr)
        return
    builder(prs, slide_data, course, professor)


# ── Claude API call ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """
You are an expert instructional designer who creates university lecture slides
in the exact style of the IT260 course at the University of Northwestern Ohio.

The deck uses a rich dark-red (#680001) and white color scheme, Calibri font,
and follows these slide types. YOU choose which types to use and in what order
based on what will best communicate the topic. Do not follow a fixed sequence.

Available slide types and their required JSON fields:

1. title
   { "type": "title", "badge": "MODULE N", "title": "...", "subtitle": "..." }

2. section_divider  (use to introduce each major section)
   { "type": "section_divider", "label": "Module N", "title": "...", "subtitle": "..." }

3. overview  (module overview / agenda — typically slide 2)
   { "type": "overview", "heading": "Module N · Overview",
     "intro": "...",
     "sections": [ { "title": "...", "description": "..." }, ... ] }
   Up to 6 sections, laid out 2-per-row.

4. objectives  (learning objectives — use early in the deck)
   { "type": "objectives", "heading": "Module N · Learning Objectives",
     "intro": "By the end of this module, you will be able to:",
     "items": [ "Describe ...", "Define ...", "Explain ..." ] }
   Up to 6 items. Each is a complete sentence starting with an action verb.

5. content_bullets  (single-column with red sub-headings + bullet lists)
   { "type": "content_bullets", "heading": "Slide Title",
     "intro": "Optional paragraph.",
     "sections": [ { "heading": "Sub-heading", "bullets": [ "...", "..." ] } ] }
   Best for narrative-heavy topics. Keep bullets concise (1–2 sentences max).

6. content_columns  (2–3 parallel columns, each with a heading + bullets)
   { "type": "content_columns", "heading": "Slide Title",
     "intro": "Optional paragraph.",
     "columns": [ { "heading": "...", "bullets": [ "..." ] } ] }
   Best for comparing/contrasting concepts or presenting parallel categories.

7. content_table  (a simple labeled table)
   { "type": "content_table", "heading": "Slide Title",
     "intro": "Optional paragraph.",
     "columns": [ "Col A", "Col B", "Col C" ],
     "rows": [ [ "cell", "cell", "cell" ], ... ] }
   Best for structured comparisons, timelines, or side-by-side data.

8. key_terms  (glossary of terms with definitions)
   { "type": "key_terms", "heading": "Module N · Key Terms",
     "terms": [ { "term": "...", "definition": "..." } ] }
   Up to 8 terms. Definitions: 1–2 sentences, plain language.

9. case_study  (real-world scenario with labelled panels)
   { "type": "case_study", "heading": "Slide Title",
     "intro": "Brief framing sentence.",
     "panels": [ { "label": "The Situation", "content": "..." },
                 { "label": "The Risk Gap",   "content": "..." },
                 { "label": "⚠ Outcome",      "content": "..." } ] }
   Best for real-world examples that illustrate a concept.

10. takeaways  (closing summary — always use as the last content slide)
    { "type": "takeaways", "heading": "Module N · Key Takeaways",
      "items": [ "...", "..." ],
      "next_module": "Next: Module N+1 — ..." }
    6–8 items. Each starts with the key concept, not a number.

11. assignment  (weekly focus / reflection prompts)
    { "type": "assignment", "heading": "This Week — Focus and Assignment",
      "intro": "...",
      "items": [ { "number": 1, "text": "..." } ] }

RULES:
- Always start with a "title" slide and end with "takeaways".
- Use "overview" as slide 2 and "objectives" as slide 3.
- Use "section_divider" to introduce each major topic section.
- Choose the best content slide type for each concept — do not default to
  content_bullets for everything. Use tables for comparisons, columns for
  parallel concepts, case_study for real examples.
- Write like a professor speaking to students: clear, engaging, no jargon without explanation.
- Total slides: 15–22 depending on depth needed.
- Output ONLY valid JSON — no markdown fences, no prose, no comments.
  The top-level JSON object must have a single key "slides" whose value is an array.
""".strip()


def generate_content(topic, module_num, course, professor, client):
    user_msg = (
        f"Create a complete lecture deck for the following:\n\n"
        f"Course: {course}\n"
        f"Module number: {module_num}\n"
        f"Topic: {topic}\n"
        f"Instructor line: {professor}\n\n"
        f"Choose the right slide types, order, and content formats to best teach this topic."
    )

    print("Calling Claude API to generate slide content...", file=sys.stderr)
    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=8000,
        thinking={"type": "adaptive"},
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    ) as stream:
        response = stream.get_final_message()

    # Extract the text block (thinking blocks come first, skip them)
    raw = ""
    for block in response.content:
        if block.type == "text":
            raw = block.text
            break

    # Strip any accidental markdown fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


# ── CLI entry point ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate a styled PowerPoint deck using the Anthropic API."
    )
    parser.add_argument("--topic",     required=True,  help="Module topic (e.g. 'Network Security Fundamentals')")
    parser.add_argument("--module",    required=True,  help="Module number (e.g. 2)")
    parser.add_argument("--course",    default="IT260 · IT Risk Management",
                        help="Course name label")
    parser.add_argument("--professor", default="Professor Martin · University of Northwestern Ohio · Fall 2025",
                        help="Professor / institution / term line")
    parser.add_argument("--output",    default=None,   help="Output .pptx path (default: Module<N>.pptx)")
    args = parser.parse_args()

    output_path = args.output or f"Module{args.module}.pptx"

    client = anthropic.Anthropic()   # reads ANTHROPIC_API_KEY from env

    # 1. Generate slide content via Claude
    deck_data = generate_content(args.topic, args.module, args.course, args.professor, client)

    slides = deck_data.get("slides", [])
    print(f"Generated {len(slides)} slides.", file=sys.stderr)

    # 2. Build the PPTX
    prs = new_presentation()
    for i, slide_data in enumerate(slides):
        stype = slide_data.get("type", "?")
        print(f"  Building slide {i+1}/{len(slides)}: {stype}", file=sys.stderr)
        build_slide(prs, slide_data, args.course, args.professor)

    prs.save(output_path)
    print(f"\n✓ Saved: {output_path}", file=sys.stderr)
    print(output_path)


if __name__ == "__main__":
    main()

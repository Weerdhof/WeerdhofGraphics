#!/usr/bin/env python3
"""Converts the ByTomorrow design handoff (templates/*/*.dc.html) into socials/templates.js.

The handoff files are "Design Components": HTML with {{ holes }}, <sc-if>, <x-import> (Logo, Monogram)
and <image-slot>, plus a small `class Component extends DCLogic` block that maps the props
(pillar colours, sport icons, ...) to the hole values. This script keeps the HTML and the logic
as they are and only swaps the three runtime-only tags for plain HTML, so a changed or new
template is brought in by editing ENABLED and running it again:

    python3 socials/build_socials.py [path/to/design_handoff_bytomorrow]
"""
import base64, html, json, os, re, sys

HANDOFF = sys.argv[1] if len(sys.argv) > 1 else "/Users/Tom/CLAUDE-map/ByTomorrow-stijl/handoff/templates/_handoff/design_handoff_bytomorrow"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates.js")

# folder, asset, format label (the formats of one asset share one card and one editor)
ENABLED = [
    ("social-wedstrijd", "wedstrijd", "Feed"),
    ("social-wedstrijd-story", "wedstrijd", "Story"),
    ("wedstrijd-linkedin", "wedstrijd", "LinkedIn"),
    ("social-artikel", "artikel", "Slide 1 · Artikel"),
    ("social-quote", "artikel", "Slide 2 · Quote"),
    ("social-teamlid", "teamlid", "Feed"),
    ("social-eindstand", "eindstand", "Feed"),
    ("social-story", "story", "Story"),
    ("jump-update", "jump-update", "Feed"),
    ("jump-update-story", "jump-update", "Story"),
    ("jump-update-linkedin", "jump-update", "LinkedIn"),
    ("social-functies", "functies", "Feed"),
    ("video-thumbnail", "video-thumbnail", "16:9"),
]
ASSETS = {
    "wedstrijd": {"label": "Wedstrijd aankondiging", "desc": "Competitie en tijd, grote titel, sport-icoon en LIVE OP over de foto. Kies feed, story of LinkedIn."},
    "artikel": {"label": "Artikel en quote", "desc": "Een carrousel van twee slides. Slide 1: de titel van het artikel in een pijlerblok met een persoon, over een volledige foto. Slide 2: een quote met auteur en een knop naar het artikel."},
    "teamlid": {"label": "Teamlid", "desc": "Een uitgesneden portret voor de grote B, met naam en functie."},
    "eindstand": {"label": "Eindstand", "desc": "De uitslag van een wedstrijd met teams, score en platform."},
    "story": {"label": "Story achtergrond", "desc": "Een vlak in de kleur van de pijler met een kort label en een titel."},
    "jump-update": {"label": "JUMP update", "desc": "Een nieuwe versie van JUMP: titel, intro en drie updates. Kies feed, story of LinkedIn."},
    "functies": {"label": "JUMP functies", "desc": "De functies van JUMP op een rij (vaste template)."},
    "video-thumbnail": {"label": "Video thumbnail", "desc": "Een YouTube-thumbnail in 16:9 met titel, foto en pijler."},
}

# channel logos for the "LIVE OP" capsule (dark on white), embedded as data URIs: the export renders the page as an image
CHANNELS = [("jump", "JUMP (pijl in de achtergrondkleur)", "jump.svg", "image/svg+xml"), ("jump-green", "JUMP (groene pijl)", "jump.svg", "image/svg+xml"),
            ("jump-mono", "JUMP (mono, lichtgrijze pijl)", "jump.svg", "image/svg+xml"), ("lvl", "LVL", "lvl.svg", "image/svg+xml"),
            ("shltv", "SHL TV", "shltv.png", "image/png"), ("hnl", "HandbalNL TV", "hnl.png", "image/png"),
            ("knltb", "KNLTB TV", "knltb.svg", "image/svg+xml")]   # knltb.svg / knltb.png: add the logo to socials/channels and it shows up

def read(p):
    with open(os.path.join(HANDOFF, p), encoding="utf8") as f:
        return f.read()

def const_path(jsx, name):
    return re.search(r'const %s = "([^"]+)"' % name, jsx).group(1)

LOGO_PATH = const_path(read("components/core/Logo.jsx"), "BYT_PATH")
BUG_PATH = const_path(read("components/core/Monogram.jsx"), "BUG_PATH")

def attrs(tag):
    return dict(re.findall(r'([\w:-]+)="([^"]*)"', tag))

def logo(m):
    a = attrs(m.group(0))
    w = float(a.get("width", 130)); h = w / 993 * 193
    color = a.get("color", "#ffffff")
    return ('<div style="line-height:0;text-align:left;width:%gpx;display:inline-block"><svg width="%g" height="%.2f" viewBox="0 0 993 193" '
            'xmlns="http://www.w3.org/2000/svg" style="display:block"><path style="fill:%s" fill-rule="evenodd" d="%s"/></svg></div>' % (w, w, h, color, LOGO_PATH))

def bug(m):
    a = attrs(m.group(0))
    h = float(a.get("height", 48)); w = h / 1121 * 988
    color = a.get("color", "#060228")
    return ('<svg width="%.2f" height="%g" viewBox="0 0 988 1121" xmlns="http://www.w3.org/2000/svg" style="display:block"><path style="fill:%s" fill-rule="evenodd" d="%s"/></svg>' % (w, h, color, BUG_PATH))

def convert(folder, asset, fmt):
    src = read("templates/%s/%s" % (folder, [f for f in os.listdir(os.path.join(HANDOFF, "templates", folder)) if f.endswith(".dc.html")][0]))
    body = re.search(r"</helmet>(.*?)</x-dc>", src, re.S).group(1)
    # the template's own style rules (from its <helmet>), scoped to the frame; the page-level body rule is dropped
    css = "".join(re.findall(r"<style>(.*?)</style>", re.search(r"<helmet>(.*?)</helmet>", src, re.S).group(1), re.S))
    css = re.sub(r"body\s*\{[^}]*\}", "", css).strip()
    if css:
        css = re.sub(r"(^|\})\s*([^{}]+)\{", lambda m: m.group(1) + " .byt-frame " + m.group(2).strip() + " {", css)
        body = "<style>" + css + "</style>" + body
    meta = re.search(r'<!-- template name="([^"]*)" description="([^"]*)"', src)
    logic = re.search(r'<script type="text/x-dc" data-dc-script[^>]*>(.*?)</script>', src, re.S).group(1).strip()
    props = json.loads(html.unescape(re.search(r'data-props="([^"]*)"', src).group(1)))
    # runtime-only tags -> plain HTML
    body = re.sub(r'<x-import[^>]*Logo"[^>]*>\s*</x-import>', logo, body)
    body = re.sub(r'<x-import[^>]*Monogram"[^>]*>\s*</x-import>', bug, body)
    body = re.sub(r'<image-slot\b([^>]*)>\s*</image-slot>', lambda m: '<div class="byt-slot" data-slot="%s" data-ph="%s" style="%s"></div>' % (
        attrs("<x " + m.group(1) + ">").get("id", "foto"), attrs("<x " + m.group(1) + ">").get("placeholder", "Sleep hier een foto"), attrs("<x " + m.group(1) + ">").get("style", "")), body)
    # older templates draw their own striped photo placeholder instead of an <image-slot>
    body = re.sub(r'<div style="(position:absolute;[^"]*?)background:repeating-linear-gradient[^"]*">\s*<span[^>]*>(.*?)</span>\s*</div>',
                  lambda m: '<div class="byt-slot" data-slot="foto" data-ph="%s"%s style="%sdisplay:block;"></div>' % (
                      re.sub(r"<br\s*/?>", " ", m.group(2)).strip(), ' data-fit="contain"' if folder == "social-teamlid" else "", m.group(1)), body)
    # logo images are inlined: the export renders the page as an image, which cannot load files
    def inline_img(m):
        path = os.path.join(HANDOFF, "assets", "logos", os.path.basename(m.group(2)))
        uri = "data:image/svg+xml;base64," + base64.b64encode(open(path, "rb").read()).decode()
        return '<img%ssrc="%s"' % (m.group(1), uri)
    body = re.sub(r'<img([^>]*?)src="(\.\./\.\./assets/logos/[^"]+)"', inline_img, body)
    body = re.sub(r'<sc-if value="\{\{\s*(\w+)\s*\}\}"[^>]*>(.*?)</sc-if>', r"<!--if:\1-->\2<!--/if-->", body, flags=re.S)
    assert "<x-import" not in body and "<image-slot" not in body and "<sc-if" not in body, folder
    m = re.search(r"width:(\d+)px;\s*height:(\d+)px", body.split("</style>")[-1])
    # the logic sets its colours on documentElement; the generator sets them on the frame instead
    logic = logic.replace("document.documentElement.style", "window.__bytRoot.style")
    return {
        "id": folder, "asset": asset, "format": fmt,
        "name": meta.group(1) if meta else folder, "description": meta.group(2) if meta else "",
        "w": int(m.group(1)), "h": int(m.group(2)),
        "html": body.strip(), "logic": logic,
        "props": {k: v for k, v in props.items() if not k.startswith("$")},
    }

data = [convert(*e) for e in ENABLED]
with open(OUT, "w", encoding="utf8") as f:
    f.write("/* generated by socials/build_socials.py from the ByTomorrow design handoff: do not edit */\nwindow.BYT_TEMPLATES = ")
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write(";\nwindow.BYT_ASSETS = ")
    json.dump(ASSETS, f, ensure_ascii=False, indent=1)
    f.write(";\nwindow.BYT_CHANNELS = ")
    json.dump([{"id": i, "label": l, "src": "data:%s;base64,%s" % (m, base64.b64encode(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "channels", fn), "rb").read()).decode())}
               for i, l, fn, m in CHANNELS if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), "channels", fn))], f, ensure_ascii=False)
    f.write(";\n")
print("written", OUT, [(d["id"], d["w"], d["h"]) for d in data])

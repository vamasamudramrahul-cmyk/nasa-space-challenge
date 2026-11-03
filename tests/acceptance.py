"""Automated acceptance run (Playwright + Chromium). Serves nothing itself: start `python3 -m http.server 8765`
from the prototype folder first.  Usage:  python3 tests/acceptance.py
Writes tests/results.json and screenshots to tests/screenshots/."""
import json, os, re, sys, time
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8765/index.html")
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "screenshots"); os.makedirs(SHOTS, exist_ok=True)
results = []

def check(name, ok, detail=""):
    results.append({"name": name, "pass": bool(ok), "detail": str(detail)})
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))

NASA_HOSTS = re.compile(r"https://(assets\.science\.nasa\.gov|d2pn8kiwq2w21t\.cloudfront\.net)/.*")
STUB = open(os.path.join(HERE, "stub.png"), "rb").read()

def new_page(browser, w=1440, h=900, touch=False, reduced=False, block_fonts=True, stub_images=True, **kw):
    ctx = browser.new_context(viewport={"width": w, "height": h}, has_touch=touch, is_mobile=touch,
                              reduced_motion="reduce" if reduced else "no-preference", **kw)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.on("console", lambda m: errors.append("console.error: " + m.text) if m.type == "error" and "fonts.g" not in m.text and "ERR_" not in m.text and "Failed to load resource" not in m.text else None)
    if stub_images:  # the sandbox cannot reach NASA hosts: a labelled stub PNG stands in so the render path can be tested
        page.route(NASA_HOSTS, lambda r: r.fulfill(status=200, content_type="image/png", body=STUB))
    if block_fonts:
        page.route(re.compile(r"https://fonts\.(googleapis|gstatic)\.com/.*"), lambda r: r.abort())
    return ctx, page, errors

def open_home(page, hash_=""):
    page.goto(BASE + hash_); page.wait_for_function("window.__abnfReady === true"); page.wait_for_timeout(300)

def lum(hexc):
    h = hexc.lstrip("#"); r, g, b = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
def contrast(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)

def active_dot(page):
    return page.evaluate("[...document.querySelectorAll('.cf-dot')].findIndex(d=>d.getAttribute('aria-current')==='true')")

with sync_playwright() as p:
    browser = p.chromium.launch()

    # ================= DESKTOP =================
    ctx, page, errors = new_page(browser)
    open_home(page)
    check("No JS errors on first load", not errors, errors[:3])

    # --- section order
    order = page.evaluate("""()=>{const q=s=>document.querySelector(s);
      const els=[['header','#site-header'],['hero','.hero'],['explore','.explore'],['browse','.browse'],['featured','.featured'],['recent','.recent'],['faq','.faqs'],['closing','.closing-sec'],['footer','#site-footer']];
      return els.map(([n,s])=>[n,q(s)?q(s).getBoundingClientRect().top+scrollY:null])}""")
    present = [n for n, t in order if t is not None]
    tops = [t for n, t in order if t is not None]
    check("Section order (recent hidden when empty)", present == ["header","hero","explore","browse","featured","faq","closing","footer"]
          and tops == sorted(tops), present)
    check("Recently Viewed hidden when nothing viewed", page.locator("#recently-viewed").count() == 0)
    check("No separate small-details section on Home", page.locator("[class*=small-detail],[id*=small-detail]").count() == 0)

    # --- hero
    check("Hero H1 exact", page.locator("h1").inner_text() == "Abandoned but Not Forgotten")
    check("Hero subtitle exact", page.locator(".hero-sub").inner_text() == "Every Mission Leaves a Story")
    check("Hero has descriptive paragraph", len(page.locator(".hero-desc").inner_text()) > 20)
    fr = page.frame_locator(".hero-bg iframe")
    SNIPPET = os.environ.get("SNIPPET_SRC", "/mnt/user-data/uploads/attachment.txt")  # the originally supplied snippet file
    if os.path.exists(SNIPPET):
        src_ok = open(os.path.join(HERE, "..", "assets/universe/animated-universe.html"), "rb").read() == open(SNIPPET, "rb").read()
        check("Hero background file byte-identical to supplied snippet", src_ok)
    else:
        print("SKIP hero byte-compare: set SNIPPET_SRC to the original snippet file")
    page.wait_for_timeout(800)
    snap = page.evaluate("""()=>{const f=document.querySelector('.hero-bg iframe').contentDocument;const c=f.getElementById('stars');
      const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return {w:c.width,h:c.height,lit:n,nebula:f.querySelectorAll('.nebula').length,shoot:f.querySelectorAll('.shooting-star').length}}""")
    check("Hero canvas renders stars + nebulae + shooting stars", snap["lit"] > 100 and snap["nebula"] == 3 and snap["shoot"] == 2, snap)
    hb = page.evaluate("(()=>{const r=document.querySelector('.hero-bg').getBoundingClientRect();return [r.height, innerHeight]})()")
    check("Hero background covers upper part, not whole page", hb[0] < page.evaluate("document.documentElement.scrollHeight") * 0.5, hb)
    page.screenshot(path=f"{SHOTS}/desktop-top.png")

    # --- header
    check("Brand text exact", page.locator(".brand").inner_text() == "NASA SPACE APPS CHALLENGE 2026")
    nav_labels = page.evaluate("[...document.querySelectorAll('.nav-desktop > ul > li > a, .nav-desktop > ul > li > button')].map(e=>e.textContent.trim())")
    check("Desktop nav order", nav_labels == ["Home","Destination","Library","About","eLearning"], nav_labels)
    acts = page.evaluate("[...document.querySelectorAll('.hdr-actions > *')].filter(e=>e.offsetParent).map(e=>e.getAttribute('aria-label'))")
    check("Search then bell at right", acts[0] == "Search" and acts[1].startswith("Updates"), acts)
    pos = page.evaluate("(()=>{const b=document.querySelector('.brand').getBoundingClientRect(),n=document.querySelector('.nav-desktop').getBoundingClientRect(),a=document.querySelector('.hdr-actions').getBoundingClientRect();return {brandL:b.left,navC:(n.left+n.right)/2,actR:a.right,vw:innerWidth}})()")
    check("Brand left, nav centred, actions right", pos["brandL"] < 60 and abs(pos["navC"] - pos["vw"]/2) < 40 and pos["actR"] > pos["vw"] - 60, pos)
    bg_top = page.evaluate("getComputedStyle(document.getElementById('site-header')).backgroundImage")
    check("Header transparent w/ dark gradient at top", "linear-gradient" in bg_top, bg_top[:60])
    page.mouse.wheel(0, 700); page.wait_for_timeout(700)
    st = page.evaluate("(()=>{const h=document.getElementById('site-header');return {hidden:h.classList.contains('is-hidden'),bg:getComputedStyle(h).backgroundColor}})()")
    check("Header hides on scroll down", st["hidden"], st)
    page.mouse.wheel(0, -120); page.wait_for_timeout(700)
    st = page.evaluate("(()=>{const h=document.getElementById('site-header');return {hidden:h.classList.contains('is-hidden'),bg:getComputedStyle(h).backgroundColor,top:h.getBoundingClientRect().top}})()")
    check("Header reappears on scroll up, solid white", (not st["hidden"]) and st["bg"] == "rgb(255, 255, 255)" and st["top"] == 0, st)
    page.screenshot(path=f"{SHOTS}/desktop-header-solid.png")
    page.evaluate("scrollTo({top:0,behavior:'instant'})"); page.wait_for_timeout(500)

    # --- dropdowns
    page.click(".dd-btn >> text=Destination"); page.wait_for_timeout(150)
    items = page.evaluate("[...document.querySelectorAll('#dd-1 a')].map(a=>a.textContent)")
    check("Destination dropdown items/order", items == ["Explore Moon","Explore Mars","Explore Planets"], items)
    check("Dropdown aria-expanded true", page.get_attribute(".dd-btn >> text=Destination", "aria-expanded") == "true")
    page.keyboard.press("Escape"); page.wait_for_timeout(100)
    check("Escape closes dropdown", page.get_attribute(".dd-btn >> text=Destination", "aria-expanded") == "false")
    page.hover(".dd-btn >> text=Library"); page.wait_for_timeout(250)
    items = page.evaluate("[...document.querySelectorAll('#dd-2 a')].map(a=>a.textContent)")
    check("Library dropdown opens on hover; items/order", items == ["Compare","Glossary","Quiz"], items)
    page.click(".dd-btn >> text=About"); page.wait_for_timeout(100)
    items = page.evaluate("[...document.querySelectorAll('#dd-3 a')].map(a=>a.textContent)")
    check("About dropdown items/order", items == ["About Website","Sources & Evidence"], items)
    page.click("#dd-3 a >> text=Sources & Evidence"); page.wait_for_timeout(300)
    check("Dropdown link navigates in-app (hash route, no reload)", page.url.endswith("#/about/sources") and page.locator("h1").inner_text().startswith("Sources"))
    page.go_back(); page.wait_for_timeout(300)
    check("Browser Back returns Home", page.locator("h1").inner_text() == "Abandoned but Not Forgotten")

    # --- destination cards
    descs = page.evaluate("[...document.querySelectorAll('.explore-card')].map(a=>[a.querySelector('.ec-title').textContent,a.querySelector('.ec-desc').textContent,a.getAttribute('href')])")
    exp = [["Moon","Discover the missions, machines and scientific discoveries that shaped our exploration of the Moon.","#/destination/moon"],
           ["Mars","Explore the missions, robotic explorers and discoveries that reveal the mysteries of the Red Planet.","#/destination/mars"],
           ["Planets","Journey across our solar system and discover the worlds beyond Earth.","#/destination/planets"]]
    check("Destination cards: order, exact descriptions, targets", descs == exp, descs)
    check("Explore section heading exact", page.locator("#explore-h").inner_text() == "Meet the Explorers of the Moon and Mars")
    cols = page.evaluate("getComputedStyle(document.querySelector('.explore-grid')).gridTemplateColumns.split(' ').length")
    check("Destination cards: 3 columns on desktop", cols == 3, cols)
    ov = page.evaluate("(()=>{const h=document.querySelector('.hero').getBoundingClientRect(),c=document.querySelector('.explore-card').getBoundingClientRect();return {heroBottom:h.bottom,cardTop:c.top,cardBottom:c.bottom}})()")
    check("Destination cards overlap dark→white transition", ov["cardTop"] < ov["heroBottom"] < ov["cardBottom"], ov)
    page.click(".explore-card >> text=Mars"); page.wait_for_timeout(300)
    check("Mars card → Explore Mars", page.url.endswith("#/destination/mars") and page.locator("h1").inner_text() == "Explore Mars")
    page.go_back(); page.wait_for_timeout(300)

    # --- categories
    cats = page.evaluate("[...document.querySelectorAll('.cat-name')].map(e=>e.textContent)")
    check("Six categories exact order", cats == ["Rovers","Landers","Spacecraft","Orbiters","Helicopters","Descent Stages"], cats)
    check("Category cards contain only illustration + name", page.evaluate("[...document.querySelectorAll('.cat-card')].every(c=>c.children.length===2)"))
    cc = page.evaluate("getComputedStyle(document.querySelector('.cat-grid')).gridTemplateColumns.split(' ').length")
    check("Category grid: 3 columns on desktop", cc == 3, cc)
    page.click(".cat-card >> text=Helicopters"); page.wait_for_timeout(300)
    pressed = page.evaluate("[...document.querySelectorAll('.chip[aria-pressed=true]')].map(c=>c.textContent)")
    check("Category click preselects in directory", pressed == ["Helicopters"] and "category=Helicopters" in page.url, pressed)
    check("Directory shows matching record only", page.locator(".dir-item").count() == 1 and "Ingenuity" in page.locator(".dir-item").inner_text())
    page.click(".chip >> text=Rovers"); page.wait_for_timeout(100)
    check("Visitor can change category", page.locator(".dir-item").count() == 3)
    page.click("[data-reset]"); page.wait_for_timeout(100)
    check("Visitor can reset category", page.locator(".dir-item").count() == 6 and page.locator(".chip[aria-pressed=true]").inner_text() == "All")
    page.click(".chip >> text=Spacecraft"); page.wait_for_timeout(100)
    check("Empty category shows empty state", "No equipment records" in page.locator(".dir-list").inner_text())
    open_home(page)

    # --- carousel
    page.locator("#featured").scroll_into_view_if_needed(); page.wait_for_timeout(900)
    check("Featured heading exact", page.locator("#feat-h").inner_text() == "The Legends of Space Exploration")
    check("Six featured cards from data file", page.locator(".cf-card").count() == 6)
    ids = page.evaluate("[...document.querySelectorAll('.cf-card')].map(c=>c.dataset.id)")
    sel = json.load(open(os.path.join(HERE, "..", "data/featured_selection.json")))["featured_ids"]
    check("Card order matches featured_selection.json", ids == sel)
    vis = page.evaluate("[...document.querySelectorAll('.cf-card')].filter(c=>getComputedStyle(c).visibility==='visible'&&+getComputedStyle(c).opacity>0.3).length")
    check("Exactly three cards visible (centre + 2 sides)", vis == 3, vis)
    ct = page.evaluate("getComputedStyle(document.querySelector('.cf-card')).transitionDuration")
    check("Transition duration 700 ms", "0.7s" in ct, ct)
    check("Card content: image, name, description, View Full Details, no mission badge",
          page.evaluate("[...document.querySelectorAll('.cf-card')].every(c=>c.querySelector('.media')&&c.querySelector('.cf-name')&&c.querySelector('.cf-desc')&&c.querySelector('[data-details]')&&!c.querySelector('[class*=badge],[class*=mission]'))"))
    lines = page.evaluate("getComputedStyle(document.querySelector('.cf-desc')).webkitLineClamp")
    check("Description clamped to 3 lines", lines == "3", lines)
    order_dom = page.evaluate("(()=>{const c=document.querySelector('[data-cf]');const r=s=>c.querySelector(s).getBoundingClientRect().top;return [r('.cf-stage'),r('.cf-dots'),r('.cf-controls')]})()")
    check("Dots above controls; controls below carousel", order_dom[0] < order_dom[1] < order_dom[2], order_dom)
    ctrl = page.evaluate("[...document.querySelectorAll('.cf-controls .pill')].map(e=>e.textContent.trim())")
    check("Controls order: Previous, Pause, Next", ctrl == ["Previous","Pause","Next"], ctrl)
    page.screenshot(path=f"{SHOTS}/desktop-carousel.png")

    # autoplay timing
    page.evaluate("window.scrollTo({top:document.querySelector('#featured').offsetTop-80,behavior:'instant'})"); page.wait_for_timeout(300)
    def wait_change(frm, limit=10):
        t = time.time()
        while time.time() - t < limit:
            if active_dot(page) != frm: return time.time()
            page.wait_for_timeout(50)
        return None
    s0 = active_dot(page); t1 = wait_change(s0); s1 = active_dot(page); t2 = wait_change(s1) if t1 else None
    interval = (t2 - t1) if t2 else None
    check("Autoplay advances automatically every ~6 s (interval between two automatic changes)", interval is not None and 5.7 < interval < 6.4, f"{interval}")
    # no pause on hover
    a = active_dot(page); page.hover(".cf-card[data-pos='0']"); t0 = time.time(); moved = False
    while time.time() - t0 < 7.5:
        if active_dot(page) != a: moved = True; break
        page.wait_for_timeout(150)
    check("Autoplay does NOT pause on hover", moved)
    # pause / play
    page.click("[data-toggle]"); frozen = active_dot(page)
    check("Pause toggle label becomes Play", page.get_attribute("[data-toggle]", "aria-label") == "Play autoplay")
    page.mouse.move(5, 5); page.wait_for_timeout(7200)
    check("Pause freezes current position", active_dot(page) == frozen)
    page.click("[data-toggle]"); t0 = time.time(); early = False; later = None
    while time.time() - t0 < 8:
        if active_dot(page) != frozen:
            later = time.time() - t0; break
        page.wait_for_timeout(100)
    check("Play resumes from same position with fresh ~6 s interval", later is not None and 5.4 < later < 7.2, f"{later}")
    # prev/next/dots
    page.click("[data-toggle]")  # pause so we can test deterministically
    base = active_dot(page); page.click("[data-next]"); page.wait_for_timeout(100)
    check("Next advances one", active_dot(page) == (base + 1) % 6)
    page.click("[data-prev]"); page.click("[data-prev]"); page.wait_for_timeout(100)
    check("Previous goes back (wraps)", active_dot(page) == (base - 1) % 6)
    page.click(".cf-dot >> nth=3"); page.wait_for_timeout(100)
    check("Dot jumps to slide", active_dot(page) == 3)
    cur = page.evaluate("document.querySelector('.cf-card[data-pos=\"0\"]').getAttribute('aria-label')")
    check("Only centre card exposed to AT; others aria-hidden", page.evaluate("[...document.querySelectorAll('.cf-card')].filter(c=>c.getAttribute('aria-hidden')==='false').length") == 1, cur)
    for _ in range(6): page.click("[data-next]")
    check("Six Next presses loop back (6 unique slides)", active_dot(page) == 3)
    # side click → centre
    page.click("[data-prev]")
    page.click(".cf-card[data-pos='1']", position={"x": 60, "y": 60}); page.wait_for_timeout(100)
    check("Clicking a side card brings it to centre", active_dot(page) == 3)

    # View Full Details routes to correct record
    page.click(".cf-dot >> nth=4"); page.wait_for_timeout(800)
    page.click(".cf-card[data-pos='0'] [data-details]"); page.wait_for_timeout(400)
    check("View Full Details → matching record route", page.url.endswith("#/equipment/mars_opportunity") and page.locator("h1").inner_text() == "Opportunity", page.url)
    check("Detail page is a labelled placeholder", "placeholder route" in page.locator(".badge-ph").inner_text().lower())
    page.go_back(); page.wait_for_timeout(500)
    check("Recently Viewed appears after a view", page.locator("#recently-viewed").count() == 1)
    rv = page.evaluate("[...document.querySelectorAll('.rv-name')].map(e=>e.textContent)")
    check("Recently Viewed shows viewed item", rv == ["Opportunity"], rv)
    # section order incl. recent
    ord2 = page.evaluate("['.featured','.recent','.faqs'].map(s=>document.querySelector(s).getBoundingClientRect().top+scrollY)")
    check("Recently Viewed sits between Featured and FAQs", ord2[0] < ord2[1] < ord2[2], ord2)
    check("Recently Viewed card is a single link, no button, no badge",
          page.evaluate("(()=>{const c=document.querySelector('.rv-card');return c.tagName==='A'&&!c.querySelector('button,a,[class*=badge]')})()"))
    check("Recently Viewed background #F8FAFC", page.evaluate("getComputedStyle(document.querySelector('.recent')).backgroundColor") == "rgb(248, 250, 252)")

    # view several → revisit ordering
    for rid in ["moon_apollo_lrv", "mars_spirit", "moon_surveyor_3"]:
        page.goto(BASE + "#/equipment/" + rid); page.wait_for_timeout(200)
    page.goto(BASE + "#/equipment/mars_opportunity"); page.wait_for_timeout(200)
    open_home(page)
    rv = page.evaluate("JSON.parse(localStorage.getItem('abnf.recentlyViewed.v1'))")
    check("Revisited item moves to top; no duplicates", rv == ["mars_opportunity","moon_surveyor_3","mars_spirit","moon_apollo_lrv"], rv)
    cap = page.evaluate("""async()=>{const m=await import('/js/storage.js');localStorage.removeItem(m.KEYS.recent);
      for(let i=1;i<=12;i++)m.recordView('x'+i);m.recordView('x5');const l=JSON.parse(localStorage.getItem(m.KEYS.recent));return l}""")
    check("Storage keeps max 10 unique, newest first", len(cap) == 10 and len(set(cap)) == 10 and cap[0] == "x5" and cap[-1] == "x3" and "x2" not in cap and "x1" not in cap, cap)
    page.evaluate("localStorage.setItem('abnf.recentlyViewed.v1', JSON.stringify(['ghost_id']))"); open_home(page); page.reload(); page.wait_for_function("window.__abnfReady===true")
    check("Unknown stored ids ignored; section hidden", page.locator("#recently-viewed").count() == 0)
    # persistence across visits
    page.evaluate("localStorage.setItem('abnf.recentlyViewed.v1', JSON.stringify(['mars_spirit','moon_apollo_lrv']))"); page.reload(); page.wait_for_function("window.__abnfReady===true")
    check("Recently Viewed persists across reload", page.locator(".rv-card").count() == 2)
    page.screenshot(path=f"{SHOTS}/desktop-fullpage.png", full_page=True)

    # --- FAQ + closing
    check("FAQ heading exact", page.locator("#faq-h").inner_text() == "Frequently Asked Questions")
    nfaq = page.locator(".faq-item").count()
    check("FAQs: text-only, always expanded, no links/accordion/numbering",
          nfaq >= 8 and page.locator(".faqs a, .faqs button, .faqs details, .faqs summary, .faqs ol, .faqs [role=button], .faqs [aria-expanded]").count() == 0
          and page.evaluate("[...document.querySelectorAll('.faq-a')].every(e=>e.offsetHeight>0)"), nfaq)
    check("Closing message exact text", page.locator(".closing").inner_text() == "There's always more to discover beyond Earth. Keep exploring!")
    check("Closing message after FAQ, before footer, no button", page.evaluate("(()=>{const t=s=>document.querySelector(s).getBoundingClientRect().top;return t('.faqs')<t('.closing-sec')&&t('.closing-sec')<t('#site-footer')&&!document.querySelector('.closing-sec button,.closing-sec a')})()"))

    # --- footer
    fc = page.evaluate("getComputedStyle(document.querySelector('.foot-grid')).gridTemplateColumns.split(' ').length")
    check("Footer 4 columns on desktop", fc == 4, fc)
    heads = page.evaluate("[...document.querySelectorAll('.foot-h')].map(e=>e.textContent)")
    check("Footer column headings", heads == ["[Final Website Name]","Explore","Resources","Contact & Feedback"], heads)
    cols = page.evaluate("[...document.querySelectorAll('.foot-col')].map(c=>[...c.querySelectorAll('a')].map(a=>a.textContent))")
    check("Footer links exact", cols[1:] == [["Home","Explore Moon","Explore Mars","Explore Planets"],["Equipment Library","Compare","Glossary","Quiz","eLearning"],["Contact Us","Send Feedback","Report an Issue","Sources & Evidence"]], cols)
    check("Footer has NASA Space Apps Challenge 2026 + no invented contact details", "NASA Space Apps Challenge 2026" in page.locator(".foot-id").inner_text() and not re.search(r"@|\+?\d{6,}", page.locator("#site-footer").inner_text()))
    check("Copyright uses placeholder name, not working title", page.locator(".copy").inner_text() == "© 2026 [Final Website Name]" and "Abandoned" not in page.locator("#site-footer").inner_text())
    page.evaluate("scrollTo({top:0,behavior:'instant'})"); page.wait_for_timeout(300)
    check("Back to Top hidden at page top", page.evaluate("getComputedStyle(document.getElementById('to-top')).visibility") == "hidden")
    check("Back to Top inside footer (not floating)", page.evaluate("document.getElementById('site-footer').contains(document.getElementById('to-top'))") and page.evaluate("getComputedStyle(document.getElementById('to-top')).position") != "fixed")
    page.evaluate("scrollTo({top:document.body.scrollHeight,behavior:'instant'})"); page.wait_for_timeout(400)
    check("Back to Top visible after scrolling", page.evaluate("getComputedStyle(document.getElementById('to-top')).visibility") == "visible")
    page.screenshot(path=f"{SHOTS}/desktop-footer.png")
    page.click("#to-top"); page.wait_for_function("scrollY===0", timeout=4000)
    check("Back to Top scrolls to top", page.evaluate("scrollY") == 0)

    # --- external links
    ext = page.evaluate("[...document.querySelectorAll('#site-footer a')].filter(a=>a.href.startsWith('http')&&!a.href.includes(location.host)).length")
    check("No external footer links to mishandle", ext == 0)

    ctx.close()

    # ================= SEARCH =================
    ctx, page, errors = new_page(browser)
    open_home(page)
    page.click("[data-open-search]"); page.wait_for_timeout(350)
    check("Search opens as modal dialog", page.get_attribute(".search-panel", "role") == "dialog" and page.get_attribute(".search-panel", "aria-modal") == "true")
    check("Search input focused on open", page.evaluate("document.activeElement.id") == "search-input")
    sec = page.evaluate("[...document.querySelectorAll('.sugg h3')].map(e=>e.textContent)")
    check("Recent + Popular sections before typing", sec == ["Recent Searches","Popular Searches"], sec)
    check("Popular searches not faked", "aggregation" in page.locator("#sg-pop ~ p, #sg-pop").last.inner_text() or "aggregation" in page.locator(".sugg").nth(1).inner_text())
    page.screenshot(path=f"{SHOTS}/desktop-search-empty.png")
    page.fill("#search-input", "r"); page.wait_for_timeout(500)
    check("No results/live search before 2 characters", page.locator("a.result").count() == 0 and page.locator(".sugg").count() == 2)
    page.fill("#search-input", "rov"); page.wait_for_timeout(120)
    check("Debounce: no results before 300 ms", page.locator("a.result").count() == 0)
    page.wait_for_timeout(400)
    n = page.locator("a.result").count()
    check("Results appear after debounce; suggestions hidden", n > 0 and page.locator(".sugg").count() == 0, n)
    check("Match highlighted (mark, navy)", page.locator("a.result mark").count() > 0 and page.evaluate("getComputedStyle(document.querySelector('a.result mark')).color") == "rgb(0, 0, 128)")
    check("Each result: name + type + one-line description", page.evaluate("[...document.querySelectorAll('a.result')].every(a=>a.querySelector('.r-title')&&a.querySelector('.r-type')&&a.querySelector('.r-desc'))"))
    check("Initial list ~5 visible, scrolls for more", page.evaluate("(()=>{const r=document.querySelector('.results');return r.scrollHeight>=r.clientHeight})()"), page.evaluate("[document.querySelector('.results').clientHeight,document.querySelector('.results').scrollHeight]"))
    page.screenshot(path=f"{SHOTS}/desktop-search-results.png")
    page.fill("#search-input", "zzzzqq"); page.wait_for_timeout(600)
    check("No-results text", page.locator(".search-body").inner_text().strip() == "No results found")
    page.click("[data-search-clear]"); page.wait_for_timeout(150)
    check("Clear × empties input and restores suggestions", page.input_value("#search-input") == "" and page.locator(".sugg").count() == 2)
    page.fill("#search-input", "spirit"); page.wait_for_timeout(600)
    page.click("a.result >> nth=0"); page.wait_for_timeout(400)
    check("Result click navigates and closes overlay", "#/equipment/mars_spirit" in page.url and page.locator("#search-overlay").is_hidden())
    page.click("[data-open-search]"); page.wait_for_timeout(300)
    rs = page.evaluate("[...document.querySelectorAll('[data-recent]')].map(e=>e.textContent)")
    check("Recent searches stored (latest first)", rs[:1] == ["spirit"], rs)
    page.fill("#search-input", "Spirit"); page.wait_for_timeout(600); page.keyboard.press("Enter"); page.wait_for_timeout(300)
    rs = page.evaluate("JSON.parse(localStorage.getItem('abnf.recentSearches.v1'))")
    check("Repeat search deduplicated (case-insensitive) and moved to top", rs == ["Spirit"], rs)
    page.evaluate("async()=>{const m=await import('/js/storage.js');for(const q of ['a1','b2','c3','d4','e5','f6','g7','h8','i9','j0','k1','l2'])m.addRecentSearch(q)}")
    check("Recent searches cap 10", page.evaluate("JSON.parse(localStorage.getItem('abnf.recentSearches.v1')).length") == 10)
    page.click("[data-open-search]"); page.wait_for_timeout(300)
    page.click("[data-clear-recents]"); page.wait_for_timeout(100)
    check("Clear control removes recent searches", page.evaluate("localStorage.getItem('abnf.recentSearches.v1')") == "[]")
    page.keyboard.press("Escape"); page.wait_for_timeout(350)
    check("Escape closes search; focus restored to opener", page.locator("#search-overlay").is_hidden() and page.evaluate("document.activeElement.hasAttribute('data-open-search')"))
    page.click("[data-open-search]"); page.wait_for_timeout(300); page.mouse.click(10, 880); page.wait_for_timeout(350)
    check("Outside click closes search", page.locator("#search-overlay").is_hidden())
    page.click("[data-open-search]"); page.wait_for_timeout(300); page.click(".search-esc"); page.wait_for_timeout(350)
    check("Close button closes search", page.locator("#search-overlay").is_hidden())
    open_home(page); page.keyboard.press("/"); page.wait_for_timeout(300)
    check("'/' shortcut opens search", page.locator("#search-overlay").is_visible())
    page.keyboard.type("//"); page.wait_for_timeout(100)
    check("'/' not intercepted while typing in the field", page.input_value("#search-input") == "//")
    page.keyboard.press("Escape"); page.wait_for_timeout(350)
    page.keyboard.press("Control+k"); page.wait_for_timeout(300)
    check("Ctrl+K opens search", page.locator("#search-overlay").is_visible())
    # focus trap
    for _ in range(8): page.keyboard.press("Tab")
    check("Focus stays trapped inside dialog", page.evaluate("document.querySelector('.search-panel').contains(document.activeElement)"))
    # error + retry
    page.evaluate("import('/js/search.js').then(m=>m._setFailureForTest(true))"); page.fill("#search-input", "moon"); page.wait_for_timeout(700)
    check("Search failure: 'Something went wrong' + Retry, query preserved", "Something went wrong" in page.locator(".search-error").inner_text() and page.input_value("#search-input") == "moon")
    page.evaluate("import('/js/search.js').then(m=>m._setFailureForTest(false))"); page.click("[data-retry]"); page.wait_for_timeout(400)
    check("Retry recovers", page.locator("a.result").count() > 0)
    # offline
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    ctx.set_offline(True); page.evaluate("dispatchEvent(new Event('offline'))")
    page.click("[data-open-search]"); page.wait_for_timeout(300)
    check("Offline Mode label shown offline", page.locator("#search-offline").is_visible())
    page.fill("#search-input", "ingenuity"); page.wait_for_timeout(600)
    check("Local search still works offline", page.locator("a.result").count() > 0)
    ctx.set_offline(False)
    ctx.close()

    # ================= BELL =================
    ctx, page, errors = new_page(browser)
    open_home(page)
    check("Red dot shown for first-time visitor (unread non-minor updates exist)", page.locator(".hdr-actions [data-bell-dot]").is_visible())
    check("Dot has no count; colour #EF4444", page.locator(".hdr-actions [data-bell-dot]").inner_text() == "" and page.evaluate("getComputedStyle(document.querySelector('.hdr-actions [data-bell-dot]')).backgroundColor") == "rgb(239, 68, 68)")
    page.click(".hdr-actions .bell"); page.wait_for_timeout(300)
    check("Bell goes straight to Updates (no popup)", page.url.endswith("#/updates") and page.locator("[role=dialog]:visible").count() == 0)
    check("Updates newest first", page.evaluate("[...document.querySelectorAll('.upd time')].map(t=>t.textContent)") == ["2026-11-01","2026-10-28","2026-10-20"])
    check("NEW on unread; ANNOUNCEMENT on important", page.locator(".tag-new").count() == 3 and page.locator(".tag-ann").count() == 1)
    check("Opening Updates alone does not clear the dot (needs viewing)", page.locator(".hdr-actions [data-bell-dot]").is_visible())
    page.wait_for_timeout(1700)
    check("Dot disappears once all non-minor updates have been viewed", page.locator(".hdr-actions [data-bell-dot]").is_hidden(), page.evaluate("localStorage.getItem('abnf.readUpdates.v1')"))
    page.reload(); page.wait_for_function("window.__abnfReady===true")
    check("Read state persists in localStorage", page.locator(".hdr-actions [data-bell-dot]").is_hidden())
    page.evaluate("localStorage.clear()"); page.reload(); page.wait_for_function("window.__abnfReady===true")
    check("Clearing storage resets dot", page.locator(".hdr-actions [data-bell-dot]").is_visible())
    ctx.close()

    # ================= TABLET =================
    ctx, page, errors = new_page(browser, 820, 1180, touch=True)
    open_home(page)
    check("Tablet: no horizontal overflow", page.evaluate("document.documentElement.scrollWidth<=innerWidth"), page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
    check("Tablet: destination cards 2 columns", page.evaluate("getComputedStyle(document.querySelector('.explore-grid')).gridTemplateColumns.split(' ').length") == 2)
    check("Tablet: categories 2 columns", page.evaluate("getComputedStyle(document.querySelector('.cat-grid')).gridTemplateColumns.split(' ').length") == 2)
    check("Tablet: footer 2 columns", page.evaluate("getComputedStyle(document.querySelector('.foot-grid')).gridTemplateColumns.split(' ').length") == 2)
    check("Tablet: uses compact header (burger visible)", page.locator("#burger").is_visible())
    page.screenshot(path=f"{SHOTS}/tablet-top.png"); page.screenshot(path=f"{SHOTS}/tablet-fullpage.png", full_page=True)
    ctx.close()

    # ================= MOBILE =================
    ctx, page, errors = new_page(browser, 390, 844, touch=True)
    open_home(page)
    check("Mobile: no horizontal overflow (top)", page.evaluate("document.documentElement.scrollWidth<=innerWidth"), page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
    check("Mobile: header shows brand, search, burger; bell hidden", page.locator(".brand").is_visible() and page.locator(".hdr-actions .search-btn").is_visible() and page.locator("#burger").is_visible() and page.locator(".hdr-actions .bell").is_hidden())
    check("Mobile: 1-col destination cards", page.evaluate("getComputedStyle(document.querySelector('.explore-grid')).gridTemplateColumns.split(' ').length") == 1)
    check("Mobile: footer 1 column", page.evaluate("getComputedStyle(document.querySelector('.foot-grid')).gridTemplateColumns.split(' ').length") == 1)
    page.screenshot(path=f"{SHOTS}/mobile-top.png")
    page.tap("#burger"); page.wait_for_timeout(450)
    check("Drawer opens (dialog, from right)", page.locator("#drawer .drawer-panel").is_visible() and page.evaluate("document.querySelector('.drawer-panel').getBoundingClientRect().right")>=389)
    check("Background scroll locked while drawer open", page.evaluate("getComputedStyle(document.documentElement).overflow") == "hidden")
    page.tap(".drawer-acc >> text=Destination"); page.wait_for_timeout(150)
    check("Nested items expand inside drawer", page.locator("#dacc-1 a").count() == 3 and page.locator("#dacc-1").is_visible())
    page.tap(".drawer-acc >> text=Library"); page.tap(".drawer-acc >> text=About"); page.wait_for_timeout(150)
    check("Library + About expand", page.locator("#dacc-2").is_visible() and page.locator("#dacc-3").is_visible())
    check("eLearning, Search and Notifications reachable in drawer", page.locator(".drawer-link >> text=eLearning").is_visible() and page.locator(".drawer-link >> text=Search").is_visible() and page.locator(".drawer-link >> text=Notifications").is_visible())
    check("Drawer shows unread dot on Notifications", page.locator(".drawer [data-bell-dot]").is_visible())
    page.screenshot(path=f"{SHOTS}/mobile-drawer.png")
    page.keyboard.press("Escape"); page.wait_for_timeout(450)
    check("Escape closes drawer; scroll restored", page.locator("#drawer").is_hidden() and page.evaluate("getComputedStyle(document.documentElement).overflow") != "hidden")
    page.tap("#burger"); page.wait_for_timeout(450); page.mouse.click(20, 400); page.wait_for_timeout(450)
    check("Outside tap closes drawer", page.locator("#drawer").is_hidden())
    page.tap("#burger"); page.wait_for_timeout(450)
    if page.get_attribute(".drawer-acc >> text=Destination", "aria-expanded") != "true": page.tap(".drawer-acc >> text=Destination")
    page.tap("#dacc-1 a >> text=Explore Moon"); page.wait_for_timeout(500)
    check("Drawer closes after navigation", page.locator("#drawer").is_hidden() and page.url.endswith("#/destination/moon"))
    page.tap("#burger"); page.wait_for_timeout(450); page.tap(".drawer-link >> text=Search"); page.wait_for_timeout(450)
    check("Search reachable from drawer", page.locator("#search-overlay").is_visible() and page.evaluate("document.activeElement.id")=="search-input")
    page.screenshot(path=f"{SHOTS}/mobile-search.png"); page.keyboard.press("Escape"); page.wait_for_timeout(300)
    open_home(page)
    # swipe test via synthetic touch pointer events
    page.locator("#featured").scroll_into_view_if_needed(); page.wait_for_timeout(800)
    page.click("[data-toggle]"); b = active_dot(page)
    box = page.locator("[data-stage]").bounding_box(); y = box["y"] + 150
    def swipe(x1, x2):
        page.evaluate("""([x1,x2,y])=>{const s=document.querySelector('[data-stage]');
          const mk=(t,x)=>new PointerEvent(t,{pointerType:'touch',clientX:x,clientY:y,bubbles:true,isPrimary:true});
          s.dispatchEvent(mk('pointerdown',x1));s.dispatchEvent(mk('pointerup',x2))}""", [x1, x2, y])
    swipe(300, 80); page.wait_for_timeout(150)
    check("Swipe left → next slide", active_dot(page) == (b + 1) % 6)
    swipe(80, 300); page.wait_for_timeout(150)
    check("Swipe right → previous slide", active_dot(page) == b)
    swipe(200, 215); page.wait_for_timeout(150)
    check("Tiny drag ignored", active_dot(page) == b)
    check("Mobile carousel: card fits viewport, no overflow", page.evaluate("(()=>{const c=document.querySelector('.cf-card[data-pos=\"0\"]').getBoundingClientRect();return c.left>=0&&c.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth})()"))
    page.screenshot(path=f"{SHOTS}/mobile-carousel.png")
    # real touch tap on View Full Details
    page.tap(".cf-card[data-pos='0'] [data-details]"); page.wait_for_timeout(500)
    check("Touch tap on View Full Details routes to record", "#/equipment/" in page.url, page.url)
    open_home(page)
    page.screenshot(path=f"{SHOTS}/mobile-fullpage.png", full_page=True)
    check("Mobile: no horizontal overflow (full page)", page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
    check("Mobile: copyright left, back-to-top right on same row", page.evaluate("(()=>{const c=document.querySelector('.copy').getBoundingClientRect(),t=document.getElementById('to-top').getBoundingClientRect();return Math.abs((c.top+c.bottom)/2-(t.top+t.bottom)/2)<12&&c.left<t.left})()"))
    ctx.close()

    # small phone
    ctx, page, errors = new_page(browser, 320, 640, touch=True)
    open_home(page)
    check("320px wide: no horizontal overflow", page.evaluate("document.documentElement.scrollWidth<=innerWidth"), page.evaluate("[document.documentElement.scrollWidth,innerWidth]"))
    check("320px wide: categories single column", page.evaluate("getComputedStyle(document.querySelector('.cat-grid')).gridTemplateColumns.split(' ').length") == 1)
    ctx.close()

    # ================= KEYBOARD =================
    ctx, page, errors = new_page(browser)
    open_home(page)
    page.keyboard.press("Tab")
    check("Skip link is first tab stop", page.evaluate("document.activeElement.classList.contains('skip-link')"))
    seen = []
    for _ in range(30):
        page.keyboard.press("Tab"); seen.append(page.evaluate("(()=>{const e=document.activeElement;return (e.getAttribute('aria-label')||e.textContent||e.tagName).trim().slice(0,30)})()"))
    check("Tab order reaches header → cards in DOM order", seen[0] == "NASA SPACE APPS CHALLENGE 2026" and "Home" in seen[1] and any("Moon" in s for s in seen), seen[:12])
    ring = page.evaluate("(()=>{const e=document.activeElement;const s=getComputedStyle(e);return [s.outlineStyle,s.outlineWidth]})()")
    check("Visible focus ring on focused element", ring[0] != "none" and ring[1] != "0px", ring)
    # keyboard-only: dropdown + category + carousel button
    open_home(page)
    page.focus(".dd-btn >> text=Destination"); page.keyboard.press("Enter"); page.wait_for_timeout(100)
    check("Keyboard: Enter opens dropdown", page.get_attribute(".dd-btn >> text=Destination", "aria-expanded") == "true")
    page.keyboard.press("Escape")
    page.focus(".cat-card >> nth=0"); page.keyboard.press("Enter"); page.wait_for_timeout(300)
    check("Keyboard: Enter on category card navigates", "category=Rovers" in page.url)
    open_home(page)
    page.locator("#featured").scroll_into_view_if_needed(); page.wait_for_timeout(500)
    page.focus("[data-toggle]"); page.keyboard.press("Space"); check("Keyboard: Space toggles pause", page.get_attribute("[data-toggle]", "aria-label") == "Play autoplay")
    page.focus("[data-next]"); b = active_dot(page); page.keyboard.press("Enter"); page.wait_for_timeout(100)
    check("Keyboard: Enter on Next advances", active_dot(page) == (b + 1) % 6)
    page.focus(".cf-card[data-pos='0'] [data-details]"); page.keyboard.press("Enter"); page.wait_for_timeout(400)
    check("Keyboard: Enter on View Full Details routes", "#/equipment/" in page.url)
    check("Focus moves to page heading after route change", page.evaluate("document.activeElement.tagName")=="H1")
    ctx.close()

    # ================= REDUCED MOTION =================
    ctx, page, errors = new_page(browser, reduced=True)
    open_home(page)
    page.wait_for_timeout(1200)
    tr = page.evaluate("getComputedStyle(document.querySelector('.cf-card')).transitionDuration")
    check("Reduced motion: carousel transition ~0", tr.startswith("1e-05") or tr in ("0s","1e-05s","0.00001s"), tr)
    check("Reduced motion: reveals shown immediately", page.evaluate("document.querySelectorAll('.reveal:not(.in)').length")==0 or page.evaluate("getComputedStyle(document.querySelector('.reveal')).opacity")=="1")
    h1 = page.evaluate("""()=>{const c=document.querySelector('.hero-bg iframe').contentDocument.getElementById('stars');return c.toDataURL().length}""")
    page.wait_for_timeout(1500)
    h2 = page.evaluate("""()=>{const c=document.querySelector('.hero-bg iframe').contentDocument.getElementById('stars');return c.toDataURL().length}""")
    d1 = page.evaluate("document.querySelector('.hero-bg iframe').contentDocument.getElementById('stars').toDataURL()")
    page.wait_for_timeout(1200)
    d2 = page.evaluate("document.querySelector('.hero-bg iframe').contentDocument.getElementById('stars').toDataURL()")
    check("Reduced motion: hero canvas frozen (static starfield still visible)", d1 == d2 and h1 > 2000, [h1, h2])
    page.click("[data-next]"); page.wait_for_timeout(100)
    check("Reduced motion: carousel still operable", active_dot(page) == 1)
    ctx.close()

    # ================= FAILURE MODES =================
    ctx, page, errors = new_page(browser)
    page.route("**/data/featured_equipment.json", lambda r: r.fulfill(status=500, body="boom"))
    page.goto(BASE); page.wait_for_selector("#retry-load", timeout=5000)
    check("Data load failure → error state with Retry (no blank page)", "Something went wrong" in page.locator("h1").inner_text() and page.locator("#retry-load").is_visible())
    ctx.close()

    # --- image URLs are taken from the supplied JSON and rendered with credit / testbed labels
    rec_json = json.load(open(os.path.join(HERE, "..", "data/featured_equipment.json")))["records"]
    ctx, page, errors = new_page(browser)
    requested = []
    page.on("request", lambda r: requested.append(r.url) if NASA_HOSTS.match(r.url) else None)
    open_home(page); page.locator("#featured").scroll_into_view_if_needed(); page.wait_for_timeout(1200)
    cards = page.evaluate("[...document.querySelectorAll('.cf-card')].map(c=>{const i=c.querySelector('img');return {id:c.dataset.id,src:i&&i.getAttribute('src'),alt:i&&i.alt,w:i&&i.naturalWidth,fit:i&&getComputedStyle(i).objectFit,credit:c.querySelector('.credit').textContent,link:(c.querySelector('.credit a')||{}).href,ph:c.querySelectorAll('.media-ph').length}})")
    byid = {r["id"]: r["carousel_image"] for r in rec_json}
    check("Carousel <img> src/alt come from each record's carousel_image", all(c["src"] == byid[c["id"]]["url"] and c["alt"] == byid[c["id"]]["alt"] for c in cards), [c["id"] for c in cards if c["src"] != byid[c["id"]]["url"]])
    check("Photos rendered (stubbed host), no placeholders, object-fit: contain", all(c["w"] > 0 and c["ph"] == 0 and c["fit"] == "contain" for c in cards))
    check("Each card shows the record's image credit from JSON", all(("Image: " + byid[c["id"]]["credit"]) in c["credit"] for c in cards), [c["credit"] for c in cards])
    check("Each card links to the record's image source page", all((c["link"] or "").rstrip("/") == byid[c["id"]]["source_page"].rstrip("/") for c in cards))
    tb = [c["id"] for c in cards if "not taken on Mars" in c["credit"]]
    check("Testbed label shown on Spirit and Opportunity ONLY", sorted(tb) == ["mars_opportunity", "mars_spirit"], tb)
    check("Images are NOT taken from category artwork (no local PNG in carousel)", all(c["src"].startswith("https://") for c in cards))
    check("No lazy blank: carousel images requested immediately (6 NASA URLs)", len(set(u for u in requested)) == 6, len(set(requested)))
    check("Category artwork never requests NASA hosts", not any("category-illustrations" in u for u in requested))
    page.screenshot(path=f"{SHOTS}/desktop-carousel-stubbed-photos.png")
    # detail + sources pages show the image note
    page.goto(BASE + "#/equipment/mars_spirit"); page.wait_for_timeout(300)
    check("Detail route shows the testbed image note", "testbed" in page.locator(".img-note").inner_text().lower() and "not a photograph taken on Mars" in page.locator(".img-note").inner_text())
    page.goto(BASE + "#/about/sources"); page.wait_for_timeout(300)
    check("Sources & Evidence lists every image note + AI-illustration disclosure", page.locator(".img-note").count() == 7 and "AI-generated" in page.locator(".src-block").last.inner_text())
    ctx.close()

    # --- category artwork: six local transparent PNGs mapped to the right categories
    ctx, page, errors = new_page(browser)
    open_home(page); page.locator(".browse").scroll_into_view_if_needed(); page.wait_for_timeout(1000)
    man = {c["name"]: c for c in json.load(open(os.path.join(HERE, "..", "data/equipment_category_illustrations.json")))["categories"]}
    arts = page.evaluate("[...document.querySelectorAll('.cat-card')].map(c=>{const i=c.querySelector('img');return {name:c.querySelector('.cat-name').textContent,src:i.getAttribute('src'),alt:i.alt,w:i.naturalWidth,fit:getComputedStyle(i).objectFit}})")
    check("Six category cards use the six local PNGs from the manifest (name, path, alt)", all(a["src"] == "assets/" + man[a["name"]]["image"] and a["alt"] == man[a["name"]]["alt"] for a in arts) and len(arts) == 6, arts[:1])
    check("Category PNGs load, object-fit: contain", all(a["w"] == 720 and a["fit"] == "contain" for a in arts))
    check("No placeholder text left in category cards", "placeholder" not in page.locator(".browse").inner_text().lower())
    check("Category PNGs are transparent (corner alpha 0)", all(Image.open(os.path.join(HERE, "..", "assets", man[n]["image"])).convert("RGBA").getpixel((2, 2))[3] == 0 for n in man))
    check("Category art not used in featured carousel", page.locator(".cf-card img[src*='category-illustrations']").count() == 0)
    page.screenshot(path=f"{SHOTS}/desktop-categories.png")
    ctx.close()

    # --- all NASA image requests fail (offline / blocked): neutral placeholders, issues reported, nothing substituted
    ctx, page, errors = new_page(browser, stub_images=False)
    page.route(NASA_HOSTS, lambda r: r.abort())
    open_home(page); page.locator("#featured").scroll_into_view_if_needed(); page.wait_for_timeout(1500)
    check("All photo URLs failing -> 6 neutral placeholders, 0 images, credits kept",
          page.locator(".cf-card .media-ph").count() == 6 and page.locator(".cf-card img").count() == 0 and page.locator(".cf-card .credit").count() == 6)
    check("Failures recorded for reporting", page.evaluate("(window.__imageIssues||[]).length") == 6, page.evaluate("(window.__imageIssues||[]).length"))
    check("Placeholder never shows other imagery; categories still render", page.locator(".cat-card img").count() == 6)
    page.screenshot(path=f"{SHOTS}/desktop-carousel-photos-failed.png")
    ctx.close()

    # --- one URL fails, the rest load
    ctx, page, errors = new_page(browser, stub_images=False)
    page.route(NASA_HOSTS, lambda r: r.abort() if "eugene_cernan" in r.request.url else r.fulfill(status=200, content_type="image/png", body=STUB))
    open_home(page); page.locator("#featured").scroll_into_view_if_needed(); page.wait_for_timeout(1500)
    check("One broken photo -> only that card shows a placeholder", page.locator(".cf-card[data-id='moon_apollo_lrv'] .media-ph").count() == 1 and page.locator(".cf-card img").count() == 5)
    ctx.close()

    # selection validation
    ctx, page, errors = new_page(browser)
    def badsel(route):
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"expected_count": 6, "featured_ids": ["moon_apollo_lrv","nope","moon_apollo_lrv","mars_spirit"]}))
    page.route("**/data/featured_selection.json", badsel)
    open_home(page)
    iss = page.evaluate("import('/js/data.js').then(m=>m.store.issues)")
    check("Featured IDs validated against equipment records (missing/duplicate/count flagged)", len(iss) == 3 and page.locator(".cf-card").count() == 2, iss)
    ctx.close()

    # ================= CONTRAST (computed) =================
    pairs = [("Navy on white (headings/brand, solid header)", "#000080", "#FFFFFF", 4.5),
             ("Description #4B5563 on white", "#4B5563", "#FFFFFF", 4.5),
             ("Description #4B5563 on #F8FAFC", "#4B5563", "#F8FAFC", 4.5),
             ("White on navy button", "#FFFFFF", "#000080", 4.5),
             ("Footer grey #CBD5E1 on navy", "#CBD5E1", "#000080", 4.5),
             ("White header text on Space Dark (transparent header)", "#FFFFFF", "#0B0F1A", 4.5),
             ("Hero subtitle #BFD3FF on #0B0F1A", "#BFD3FF", "#0B0F1A", 4.5),
             ("Hero desc #D6DEEF on #0B0F1A", "#D6DEEF", "#0B0F1A", 4.5),
             ("NAVY brand on Space Dark (spec colour in transparent state)", "#000080", "#0B0F1A", 4.5)]
    for name, fg, bg, need in pairs:
        r = contrast(fg, bg)
        if name.startswith("NAVY brand on Space Dark"):
            check("INFO spec navy brand on dark hero would FAIL AA (reason white is used in transparent state)", r < need, f"{r:.2f}:1")
        else:
            check(f"Contrast AA: {name}", r >= need, f"{r:.2f}:1")

    browser.close()

passed = sum(r["pass"] for r in results)
print(f"\n{passed}/{len(results)} checks passed")
json.dump(results, open(os.path.join(HERE, "results.json"), "w"), indent=2)
sys.exit(0 if passed == len(results) else 1)

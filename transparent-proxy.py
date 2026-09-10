#!/usr/bin/env python3
"""
Transparency gateway for the Padel scoreboard.

The scoreboard at padel-scoreboard-eight.vercel.app hardcodes a solid
dark-blue page background, so it never looks transparent in OBS/vMix/etc.
even with ?transparent=true in the URL. This proxy mirrors every request
to that site unchanged, except it injects a small CSS override into the
HTML page that forces the <html>/<body> background to be transparent.
Everything else (API calls, images, fonts, live score updates) passes
through untouched.

Usage:
    python3 transparent-proxy.py [port]

The port can also be supplied via the PORT environment variable (this is
what Railway and most other hosting platforms do automatically), which
takes precedence when no command-line argument is given.

Then point your streaming software's Browser Source at:
    http://localhost:4000/scoreboard?view=streamoverlay&transparent=true
instead of the vercel.app URL.

Add &delay=60 to the URL to have the displayed score lag 60 seconds
behind the real live score (handy for syncing graphics to a delayed
video feed). Omit it, or use delay=0, for the normal live behaviour.
"""

import os
import sys
import urllib.request
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TARGET_ORIGIN = "https://padel-scoreboard-eight.vercel.app"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 4000))

# Response headers that must not be copied straight through to the client.
HOP_BY_HOP = {
    "connection",
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "upgrade",
}

STYLE_OVERRIDE = (
    b'<style id="transparent-gateway-override">'
    b"html,body{background:transparent !important;background-color:transparent !important;}"
    b"</style></head>"
)

# Injected just before </body>. Only activates when ?delay=<seconds> is
# present in the URL; otherwise it's a no-op and the page behaves exactly
# as before. When active, it hides the real (live) content off-screen,
# keeps recording snapshots of it as it changes, and shows a full-page
# overlay that always lags `delay` seconds behind the live snapshots.
# Live data (e.g. a websocket) keeps flowing to the hidden real page
# exactly as normal - only what the viewer *sees* is time-shifted.
DELAY_SCRIPT = b"""<script id="transparent-gateway-delay">
(function () {
  var params = new URLSearchParams(location.search);
  var delaySec = parseFloat(params.get('delay') || '0');
  if (!delaySec || isNaN(delaySec) || delaySec <= 0) return;
  var delayMs = delaySec * 1000;
  var MARK = 'data-gateway-ignore';

  // Hide every real (non-gateway) direct child of <body> via a stylesheet
  // rule rather than by touching each element's own style attribute.
  // That keeps their outerHTML pristine, so the snapshots we clone into
  // the overlay never inherit the "hidden" styling themselves.
  var hideStyle = document.createElement('style');
  hideStyle.textContent =
    'body > :not([' + MARK + ']){position:fixed !important;top:0 !important;' +
    'left:0 !important;opacity:0 !important;pointer-events:none !important;' +
    'z-index:-1 !important;}';
  document.head.appendChild(hideStyle);

  var overlay = document.createElement('div');
  overlay.setAttribute(MARK, '1');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  document.body.appendChild(overlay);

  function isReal(el) {
    return el.nodeType === 1 && !el.hasAttribute(MARK) &&
      el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'LINK';
  }

  var buffer = [];
  var lastSig = null;

  function tick() {
    var parts = [];
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (isReal(el)) parts.push(el.outerHTML);
    });
    var html = parts.join('');
    if (html !== lastSig) {
      lastSig = html;
      var now = Date.now();
      buffer.push({ t: now, html: html });
      var cutoff = now - delayMs - 10000;
      while (buffer.length > 1 && buffer[0].t < cutoff) buffer.shift();
    }
  }

  var shown = null;
  function render() {
    var target = Date.now() - delayMs;
    var chosen = null;
    for (var i = buffer.length - 1; i >= 0; i--) {
      if (buffer[i].t <= target) { chosen = buffer[i]; break; }
    }
    if (!chosen && buffer.length > 0) {
      // Not enough history yet (e.g. just after page load): show the
      // most recent snapshot instead of leaving the page blank or stuck
      // on a stale/incomplete first frame. This means the overlay tracks
      // live for the first `delay` seconds, then genuine lag kicks in
      // once the buffer actually spans that far back.
      chosen = buffer[buffer.length - 1];
    }
    if (chosen && chosen.html !== shown) {
      shown = chosen.html;
      overlay.innerHTML = chosen.html;
    }
  }

  new MutationObserver(tick).observe(document.body, {
    childList: true, subtree: true, characterData: true, attributes: true
  });
  tick();
  setInterval(render, 200);
})();
</script></body>"""


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _proxy(self, method):
        target_url = TARGET_ORIGIN + self.path
        body = None
        if "Content-Length" in self.headers:
            body = self.rfile.read(int(self.headers["Content-Length"]))

        req_headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower() not in ("host", "accept-encoding", "connection")
        }
        req_headers["Accept-Encoding"] = "identity"

        req = urllib.request.Request(
            target_url, data=body, headers=req_headers, method=method
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                status = resp.status
                resp_headers = resp.headers
                content = resp.read()
        except urllib.error.HTTPError as e:
            status = e.code
            resp_headers = e.headers
            content = e.read()
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(f"Gateway error: {e}".encode())
            return

        content_type = resp_headers.get("Content-Type", "")
        if "text/html" in content_type:
            if b"</head>" in content:
                content = content.replace(b"</head>", STYLE_OVERRIDE, 1)
            if b"</body>" in content:
                content = content.replace(b"</body>", DELAY_SCRIPT, 1)

        self.send_response(status)
        for k, v in resp_headers.items():
            if k.lower() not in HOP_BY_HOP:
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if method != "HEAD":
            self.wfile.write(content)

    def do_GET(self):
        self._proxy("GET")

    def do_HEAD(self):
        self._proxy("HEAD")

    def do_POST(self):
        self._proxy("POST")

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), ProxyHandler)
    print(f"Transparent scoreboard gateway running on http://localhost:{PORT}")
    print(f"Point your Browser Source at, e.g.:")
    print(f"  http://localhost:{PORT}/scoreboard?view=streamoverlay&transparent=true")
    server.serve_forever()

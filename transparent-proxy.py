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
        if "text/html" in content_type and b"</head>" in content:
            content = content.replace(b"</head>", STYLE_OVERRIDE, 1)

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

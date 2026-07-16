// Production server for the TanStack Start (Vite-native) build. `vite build` outputs
// dist/client (static assets) and dist/server/server.js (a Fetch-API handler, not a
// self-starting HTTP server) — this serves dist/client directly and forwards everything
// else to that handler. See TanStack Start's "Custom Node.js servers" hosting docs.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

const { default: handler } = await import("./dist/server/server.js");

const clientDir = fileURLToPath(new URL("./dist/client/", import.meta.url));

const mimeTypes = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

async function tryServeStatic(pathname) {
  if (pathname === "/") return null;
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(clientDir, safePath);
  if (!filePath.startsWith(clientDir)) return null;
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const body = await readFile(filePath);
    const ext = extname(filePath);
    return new Response(body, {
      headers: {
        "content-type": mimeTypes[ext] || "application/octet-stream",
        "cache-control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600",
      },
    });
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let response = null;

    if (req.method === "GET" || req.method === "HEAD") {
      response = await tryServeStatic(url.pathname);
    }

    if (!response) {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
        else headers.set(key, value);
      }
      const webReq = new Request(url, {
        method: req.method,
        headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : Readable.toWeb(req),
        duplex: "half",
      });
      response = await handler.fetch(webReq);
    }

    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      Readable.fromWeb(response.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[server] request error:", err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`Ninety frontend listening on :${port}`);
});

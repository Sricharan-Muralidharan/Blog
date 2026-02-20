const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const vm = require("vm");

const HOST = "127.0.0.1";
const PORT = 3000;
const ROOT = __dirname;
const POSTS_FILE = path.join(ROOT, "js", "posts.js");
const UPLOAD_DIR = path.join(ROOT, "assets", "uploads");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sanitizePath(requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  const joined = path.join(ROOT, decoded);
  const normalized = path.normalize(joined);
  if (!normalized.startsWith(ROOT)) return null;
  return normalized;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function loadPostsFromJs() {
  const code = fs.readFileSync(POSTS_FILE, "utf8");
  const sandbox = { result: null };
  vm.runInNewContext(`${code}\nresult = posts;`, sandbox);
  if (!Array.isArray(sandbox.result)) {
    throw new Error("posts.js did not evaluate to an array");
  }
  return sandbox.result;
}

function savePostsToJs(posts) {
  const serialized = `const posts = ${JSON.stringify(posts, null, 2)};\n`;
  fs.writeFileSync(POSTS_FILE, serialized, "utf8");
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": MIME_TYPES[".json"],
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function fileExtensionFromMime(mimeType) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/webp") return ".webp";
  return null;
}

function slugifyTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "post";
}

async function ensureUniqueFilePath(basePath) {
  const ext = path.extname(basePath);
  const noExt = basePath.slice(0, -ext.length);
  let candidate = basePath;
  let counter = 2;
  while (true) {
    try {
      await fsp.access(candidate);
      candidate = `${noExt}-${counter}${ext}`;
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

async function renamePostUploads(post) {
  const imageList = Array.isArray(post.images)
    ? post.images.map((src) => String(src || "").trim()).filter(Boolean)
    : [];

  const sources = imageList.length > 0
    ? imageList
    : (post.image ? [String(post.image).trim()] : []);

  if (sources.length === 0) return post;

  const slug = slugifyTitle(post.title);
  const renamedImages = [];

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (!source.startsWith("assets/uploads/")) {
      renamedImages.push(source);
      continue;
    }

    const sourceName = source.slice("assets/uploads/".length);
    const sourcePath = path.join(UPLOAD_DIR, sourceName);
    const ext = path.extname(sourceName) || ".png";
    const desiredName = `${slug}-image-${i + 1}${ext}`;
    const desiredPath = await ensureUniqueFilePath(path.join(UPLOAD_DIR, desiredName));

    try {
      await fsp.copyFile(sourcePath, desiredPath);
      renamedImages.push(`assets/uploads/${path.basename(desiredPath)}`);
    } catch {
      renamedImages.push(source);
    }
  }

  return {
    ...post,
    images: renamedImages,
    image: renamedImages[0] || post.image || "",
  };
}

function collectReferencedUploadFiles(posts) {
  const refs = new Set();
  const uploadPrefix = "assets/uploads/";
  const uploadPattern = /assets\/uploads\/([A-Za-z0-9._-]+)/g;

  posts.forEach((post) => {
    const sources = [];
    if (post.image) sources.push(String(post.image));
    if (Array.isArray(post.images)) {
      post.images.forEach((src) => sources.push(String(src || "")));
    }
    if (post.contentHtml) sources.push(String(post.contentHtml));
    if (post.content) sources.push(String(post.content));

    sources.forEach((value) => {
      if (!value) return;
      if (value.startsWith(uploadPrefix)) {
        refs.add(value.slice(uploadPrefix.length));
      }
      let match;
      while ((match = uploadPattern.exec(value)) !== null) {
        refs.add(match[1]);
      }
      uploadPattern.lastIndex = 0;
    });
  });

  return refs;
}

async function cleanupUnusedUploads(posts) {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  const files = await fsp.readdir(UPLOAD_DIR, { withFileTypes: true });
  const referencedFiles = collectReferencedUploadFiles(posts);
  const deletions = files
    .filter((entry) => entry.isFile() && !referencedFiles.has(entry.name))
    .map((entry) => fsp.unlink(path.join(UPLOAD_DIR, entry.name)));
  await Promise.all(deletions);
}

async function handleApi(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return true;
  }

  if (req.method === "GET" && req.url.startsWith("/api/posts")) {
    try {
      const posts = loadPostsFromJs();
      return sendJson(res, 200, { posts });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === "POST" && req.url === "/api/auth") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && req.url === "/api/upload-image") {
    try {
      const { dataUrl, filename } = await readBody(req);
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
        return sendJson(res, 400, { ok: false, error: "Invalid image payload" });
      }

      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return sendJson(res, 400, { ok: false, error: "Unsupported data URL" });
      }

      const [, mimeType, base64Payload] = match;
      const ext = fileExtensionFromMime(mimeType);
      if (!ext) {
        return sendJson(res, 400, { ok: false, error: "Unsupported image type" });
      }

      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
      const baseName = (filename || "upload")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 40) || "upload";
      const savedName = `${Date.now()}-${baseName}${ext}`;
      const savedPath = path.join(UPLOAD_DIR, savedName);
      await fsp.writeFile(savedPath, Buffer.from(base64Payload, "base64"));

      return sendJson(res, 200, { ok: true, imagePath: `assets/uploads/${savedName}` });
    } catch {
      return sendJson(res, 400, { ok: false, error: "Invalid request" });
    }
  }

  if (req.method === "POST" && req.url === "/api/save-post") {
    try {
      const { post, index } = await readBody(req);
      if (!post || typeof post !== "object") {
        return sendJson(res, 400, { ok: false, error: "Missing post payload" });
      }

      let normalizedPost = {
        title: String(post.title || "").trim(),
        contentHtml: String(post.contentHtml || "").trim(),
        content: String(post.content || "").trim(),
        image: String(post.image || "").trim(),
        images: Array.isArray(post.images)
          ? [...new Set(post.images.map((src) => String(src || "").trim()).filter(Boolean))]
          : [],
        tags: Array.isArray(post.tags)
          ? post.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [],
      };

      if (!normalizedPost.image && normalizedPost.images.length > 0) {
        normalizedPost.image = normalizedPost.images[0];
      }

      normalizedPost = await renamePostUploads(normalizedPost);

      if (!normalizedPost.title || (!normalizedPost.content && !normalizedPost.contentHtml)) {
        return sendJson(res, 400, { ok: false, error: "Title and content are required" });
      }

      const posts = loadPostsFromJs();
      if (Number.isInteger(index) && index >= 0 && index < posts.length) {
        posts[index] = normalizedPost;
      } else {
        posts.unshift(normalizedPost);
      }

      savePostsToJs(posts);
      await cleanupUnusedUploads(posts);
      return sendJson(res, 200, { ok: true, posts });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  if (req.method === "POST" && req.url === "/api/delete-post") {
    try {
      const { index } = await readBody(req);
      if (!Number.isInteger(index)) {
        return sendJson(res, 400, { ok: false, error: "Invalid post index" });
      }

      const posts = loadPostsFromJs();
      if (index < 0 || index >= posts.length) {
        return sendJson(res, 400, { ok: false, error: "Post index out of range" });
      }

      posts.splice(index, 1);
      savePostsToJs(posts);
      await cleanupUnusedUploads(posts);
      return sendJson(res, 200, { ok: true, posts });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      const handled = await handleApi(req, res);
      if (handled !== false) return;
    }

    const requestPath = req.url === "/" ? "/index.html" : req.url;
    const safePath = sanitizePath(requestPath);
    if (!safePath) {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }

    let filePath = safePath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": mimeType });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (req.url.startsWith("/api/")) {
      sendJson(res, 500, { ok: false, error: error.message || "Server error" });
      return;
    }
    res.writeHead(500);
    res.end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Blog server running at http://${HOST}:${PORT}`);
});

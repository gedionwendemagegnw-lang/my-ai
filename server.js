// Arjun server - step 1: text chat proxy. Keeps the Gemini key off the public page.
const http = require("http");

const PORT = process.env.PORT || 8080;
const KEY = process.env.GEMINI_API_KEY || "";
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://gedionwendemagegnw-lang.github.io";
const MODELS = (process.env.ALLOWED_MODELS || "gemini-3.5-flash-lite")
  .split(",").map(function(s){ return s.trim(); }).filter(Boolean);
const MAX_BODY = 25 * 1024 * 1024;

function send(res, code, obj){
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(obj));
}

const IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-nano-banana-2.1";

// Image step: sends a prompt to the image model and returns the generated picture.
function handleImage(req, res){
  if(!KEY){ return send(res, 500, {error: "The server has no API key set."}); }
  let raw = "";
  let size = 0;
  req.on("data", function(chunk){ size += chunk.length; if(size <= MAX_BODY){ raw += chunk; } });
  req.on("end", async function(){
    let body;
    try{ body = JSON.parse(raw); }catch(e){ return send(res, 400, {error: "Bad request."}); }
    const prompt = String(body.prompt || "").trim();
    if(!prompt){ return send(res, 400, {error: "Please describe the image."}); }
    try{
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(IMAGE_MODEL) + ":generateContent", {
        method: "POST",
        headers: {"Content-Type": "application/json", "x-goog-api-key": KEY},
        body: JSON.stringify({
          contents: [{role: "user", parts: [{text: prompt}]}],
          generationConfig: {responseModalities: ["IMAGE", "TEXT"]}
        })
      });
      const data = await r.json();
      if(!r.ok){ return send(res, r.status, {error: (data.error && data.error.message) || "Image request failed."}); }
      const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
      const img = parts.find(function(p){ return p.inlineData; });
      if(!img){ return send(res, 502, {error: "No image came back. Try a different description."}); }
      send(res, 200, {mimeType: img.inlineData.mimeType, data: img.inlineData.data});
    }catch(e){
      send(res, 502, {error: "Could not reach the image service."});
    }
  });
}

const server = http.createServer(function(req, res){
  if(req.method === "OPTIONS"){ return send(res, 204, {}); }
  if(req.method === "GET" && req.url === "/health"){ return send(res, 200, {ok: true, keySet: !!KEY, models: MODELS}); }
  if(req.method === "POST" && req.url === "/image"){ return handleImage(req, res); }
  if(req.method !== "POST" || req.url !== "/chat"){ return send(res, 404, {error: "Not found"}); }
  if(!KEY){ return send(res, 500, {error: "The server has no API key set."}); }

  let raw = "";
  let size = 0;
  let tooBig = false;
  req.on("data", function(chunk){
    size += chunk.length;
    if(size > MAX_BODY){ tooBig = true; } else { raw += chunk; }
  });
  req.on("end", async function(){
    if(tooBig){ return send(res, 413, {error: "The file is too large."}); }
    let body;
    try{ body = JSON.parse(raw); }catch(e){ return send(res, 400, {error: "Bad request."}); }
    const model = body.model || MODELS[0];
    if(!MODELS.includes(model)){ return send(res, 400, {error: "That model is not allowed."}); }
    try{
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
        method: "POST",
        headers: {"Content-Type": "application/json", "x-goog-api-key": KEY},
        body: JSON.stringify({
          systemInstruction: body.systemInstruction,
          contents: body.contents,
          generationConfig: body.generationConfig,
          tools: body.tools
        })
      });
      const data = await r.json();
      send(res, r.status, data);
    }catch(e){
      send(res, 502, {error: "Could not reach the AI service."});
    }
  });
});

server.listen(PORT, function(){ console.log("Arjun server running on port " + PORT); });

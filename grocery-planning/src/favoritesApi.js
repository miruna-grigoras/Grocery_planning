// src/favoritesApi.js
import { get, post, del } from "aws-amplify/api";

const API_NAME = "recipeapi";   
const PATH = "/favorites";

// ——— utils pentru citirea corpului răspunsului (indiferent de formă)
async function readBody(body) {
  try {
    if (!body) return "";
    if (typeof body.text === "function") return await body.text();
    if (typeof body.json === "function") {
      const j = await body.json();
      return typeof j === "string" ? j : JSON.stringify(j);
    }
    if (typeof body === "string") return body;
    return JSON.stringify(body);
  } catch {
    return "";
  }
}

async function parse(op) {
  const res = await op.response;
  const txt = await readBody(res.body);
  return {
    status: res.statusCode,
    data: txt ? (() => { try { return JSON.parse(txt); } catch { return null; } })() : null,
    raw: txt
  };
}

// ——— format erori Amplify (când status ≠ 2xx)
async function toError(e) {
  const r = e?.response;
  if (r) {
    const t = await readBody(r.body);
    let msg = t || "Unknown error";
    try {
      const j = JSON.parse(t);
      msg = j.error || j.detail || t;
    } catch {}
    return `HTTP ${r.statusCode}: ${msg}`;
  }
  return e?.message || "Unknown error";
}

export async function listFavorites() {
  try {
    return await parse(get({ apiName: API_NAME, path: PATH }));
  } catch (e) {
    throw new Error(await toError(e));
  }
}

export async function addFavorite(recipe) {
  try {
    return await parse(
      post({
        apiName: API_NAME,
        path: PATH,
        options: {
          headers: { "Content-Type": "application/json" }, // NU adăuga Authorization
          body: recipe,
        },
      })
    );
  } catch (e) {
    throw new Error(await toError(e));
  }
}

export async function removeFavorite(id) {
  try {
    return await parse(
      del({
        apiName: API_NAME,
        path: `${PATH}/${encodeURIComponent(id)}`
      })
    );
  } catch (e) {
    throw new Error(await toError(e));
  }
}

import React, { useEffect, useMemo, useState } from "react";
import { post } from "aws-amplify/api";
import { addFavorite, listFavorites, removeFavorite } from "./favoritesApi";

// Config API (Bedrock recipe generation)
const API_NAME = "recipeapi";
const API_PATH = "/recipes";


const DEFAULT_INGREDIENTS = [
  "eggs","milk","flour","tomatoes","onion","garlic","chicken","rice","carrots","potatoes",
  "olive oil","cheese","spinach","corn","bell pepper","mushrooms","tuna","pasta","zucchini","basil",
  "broth","butter","yogurt","cream","parsley","paprika","lemon"
];

// Mic card UI
function SectionCard({ title, right, children }) {
  return (
    <div style={{
      background:"#fff",
      borderRadius:16,
      boxShadow:"0 8px 24px rgba(0,0,0,0.08)",
      padding:16,
      border:"1px solid #e6e8eb"
    }}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <h2 style={{margin:0,fontSize:18}}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

//  Pagina principală 
export default function RecipesPage() {
  const [allIngredients, setAllIngredients] = useState(DEFAULT_INGREDIENTS);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [daily, setDaily] = useState(null);
  const [custom, setCustom] = useState(null);

  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [error, setError] = useState("");

  // favorites state
  const [favorites, setFavorites] = useState([]);
  const [favBusy, setFavBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return allIngredients;
    const q = query.toLowerCase();
    return allIngredients.filter(i => i.toLowerCase().includes(q));
  }, [query, allIngredients]);

  function toggleItem(item) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(item) ? next.delete(item) : next.add(item);
      return next;
    });
  }

  function addManual() {
    const v = manual.trim();
    if (!v) return;
    if (!allIngredients.includes(v)) setAllIngredients(prev => [v, ...prev]);
    setSelected(prev => new Set(prev).add(v));
    setManual("");
  }

  //API helper cu timeout 
  async function callApi(payload) {
    const TIMEOUT_MS = 30000;

    const restOp = post({
      apiName: API_NAME,
      path: API_PATH,
      options: {
        body: payload,
        headers: { "Content-Type": "application/json" },
      },
    });

    const respPromise = (async () => {
      const { body } = await restOp.response;
      const text = await body.text();

      console.log("[/recipes] raw response:", text);

      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        const cleaned = text
          .replace(/```(?:json|tabular-data-json)?/gi, "")
          .replace(/```/g, "")
          .trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          throw new Error("BAD_BACKEND_PAYLOAD");
        }
      }

      if (parsed && typeof parsed === "object" && parsed.error) {
        const msg = parsed.detail
          ? `${parsed.error}: ${parsed.detail}`
          : parsed.error;
        throw new Error(msg);
      }

      return parsed;
    })();

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), TIMEOUT_MS)
    );

    return await Promise.race([respPromise, timeout]);
  }


  async function loadDaily() {
    setError("");
    setLoadingDaily(true);
    setDaily(null);
    try {
      const res = await callApi({ mode: "daily" });
      setDaily(res);
    } catch (e) {
      console.error(e);
      setError(
        e?.message === "TIMEOUT"
          ? "The request is taking too long (over 30s). Try again in a moment."
          : e?.message || "Could not load Recipe. Please check the backend."
      );
    } finally {
      setLoadingDaily(false);
    }
  }

  // Generare din selecție 
  async function generateFromSelected() {
    const ingredients = Array.from(selected);
    if (!ingredients.length) {
      setError("Please select or add at least one ingredient.");
      return;
    }
    setError("");
    setLoadingCustom(true);
    setCustom(null);
    try {
      const res = await callApi({ mode: "custom", ingredients });
      setCustom(res);
    } catch (e) {
      console.error(e);
      setError(
        e?.message === "TIMEOUT"
          ? "The request is taking too long (over 30s). Try again in a moment."
          : e?.message || "Could not generate the recipe. Please try again or check the backend."
      );
    } finally {
      setLoadingCustom(false);
    }
  }

  // Favorites API 
  async function refreshFavorites() {
    try {
      const r = await listFavorites();
      if (r?.status === 200) setFavorites(r.data || []);
    } catch (e) {
      console.warn("List favorites failed:", e);
    }
  }

  async function handleAddFavorite(recipe) {
    try {
      setFavBusy(true);
      const r = await addFavorite(recipe);
      if (r?.status === 200) {
        await refreshFavorites();
        alert("Added to favorites ✅");
      } else {
        alert(`Unexpected response (${r?.status || "?"}).`);
      }
    } catch (e) {
      alert(e.message || "Unknown error");
    } finally {
      setFavBusy(false);
    }
  }

  async function handleRemoveFavorite(id) {
    if (!window.confirm("Remove this favorite?")) return;
    try {
      setFavBusy(true);
      const r = await removeFavorite(id);
      if (r?.status === 200) {
        await refreshFavorites();
      } else {
        alert(`Unexpected response (${r?.status || "?"}).`);
      }
    } catch (e) {
      alert(e.message || "Unknown error");
    } finally {
      setFavBusy(false);
    }
  }

  useEffect(() => { loadDaily(); }, []);
  useEffect(() => { refreshFavorites(); }, []);

  return (
    <div style={{padding:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start"}}>
      {/* Left column */}
      <div style={{display:"grid", gap:16}}>
        <SectionCard
          title="Ingredients"
          right={<span style={{fontSize:12, color:"#6b7280"}}>selected: {selected.size}</span>}
        >
          <div style={{display:"flex", gap:8, marginBottom:12}}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search ingredients…"
              style={{flex:1, padding:"10px 12px", borderRadius:12, border:"1px solid #d1d5db"}}
            />
          </div>

          <div style={{display:"flex", gap:8, marginBottom:12}}>
            <input
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder="Add ingredient (e.g., salmon)"
              style={{flex:1, padding:"10px 12px", borderRadius:12, border:"1px solid #d1d5db"}}
              onKeyDown={(e) => { if (e.key === "Enter") addManual(); }}
            />
            <button
              onClick={addManual}
              style={{padding:"10px 14px", borderRadius:12, border:"1px solid #10b981", background:"#10b981", color:"#fff", cursor:"pointer"}}
            >
              Add
            </button>
          </div>

          <div style={{maxHeight:320, overflow:"auto", border:"1px solid #e5e7eb", borderRadius:12, padding:8}}>
            {filtered.length === 0 && (
              <div style={{color:"#6b7280", fontSize:14}}>No ingredients found.</div>
            )}
            {filtered.map(item => (
              <label key={item} style={{display:"flex", alignItems:"center", gap:8, padding:"6px 8px", borderRadius:8, cursor:"pointer"}}>
                <input type="checkbox" checked={selected.has(item)} onChange={() => toggleItem(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <div style={{display:"flex", gap:8, marginTop:12}}>
            <button
              onClick={generateFromSelected}
              disabled={loadingCustom}
              style={{padding:"12px 16px", borderRadius:12, border:"1px solid #111827", background:"#111827", color:"#fff", cursor:"pointer", flex:1}}
            >
              {loadingCustom ? "Generating..." : "Generate recipe"}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{padding:"12px 16px", borderRadius:12, border:"1px solid #e5e7eb", background:"#fff", cursor:"pointer"}}
            >
              Clear selection
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Generated recipe" right={
          custom && (
            <button
              onClick={() => handleAddFavorite({ title: custom?.title || "Recipe", steps: custom?.steps || [] })}
              disabled={favBusy}
              style={{padding:"8px 12px", borderRadius:10, border:"1px solid #2563eb", background:"#2563eb", color:"#fff", cursor:"pointer"}}
            >
              {favBusy ? "Saving..." : "Add to favorites"}
            </button>
          )
        }>
          {loadingCustom && <p>Generating recipe...</p>}
          {!loadingCustom && !custom && <p>Select ingredients and click “Generate recipe”.</p>}
          {custom && <RecipeView recipe={custom} />}
        </SectionCard>
      </div>

      {/* Right column */}
      <div style={{display:"grid", gap:16}}>
        <SectionCard
          title="Random Recipe Generator"
          right={
            <div style={{display:"flex", gap:8}}>
              <button
                onClick={loadDaily}
                disabled={loadingDaily}
                style={{padding:"8px 12px", borderRadius:10, border:"1px solid #2563eb", background:"#2563eb", color:"#fff", cursor:"pointer"}}
              >
                {loadingDaily ? "Reloading..." : "Reload"}
              </button>
              {daily && (
                <button
                  onClick={() => handleAddFavorite({ title: daily?.title || "Recipe", steps: daily?.steps || [] })}
                  disabled={favBusy}
                  style={{padding:"8px 12px", borderRadius:10, border:"1px solid #111827", background:"#111827", color:"#fff", cursor:"pointer"}}
                >
                  {favBusy ? "Saving..." : "Add to favorites"}
                </button>
              )}
            </div>
          }
        >
          {loadingDaily && <p>Loading recipe...</p>}
          {!loadingDaily && daily && (
            <>
              {Array.isArray(daily.picked) && daily.picked.length > 0 && (
                <div style={{marginBottom:8}}>
                  <b>Picked ingredients:</b>
                  <ul style={{margin:"6px 0 0 18px"}}>
                    {daily.picked.map((x,i)=> <li key={i}>{x}</li>)}
                  </ul>
                </div>
              )}
              <RecipeView recipe={daily} />
            </>
          )}
        </SectionCard>

        <SectionCard
          title="My favorites"
          right={
            <button
              onClick={refreshFavorites}
              disabled={favBusy}
              style={{padding:"8px 12px", borderRadius:10, border:"1px solid #e5e7eb", background:"#fff", cursor:"pointer"}}
            >
              Refresh
            </button>
          }
        >
          {favorites.length === 0 && <p>No favorites yet.</p>}
          {favorites.length > 0 && (
            <ul style={{margin:"0", padding:"0 0 0 18px", display:"grid", gap:8}}>
              {favorites.map((f) => (
                <li key={`${f.userSub}:${f.id}`} style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:8}}>
                  <span style={{fontWeight:600}}>{f.title}</span>
                  <button
                    onClick={() => handleRemoveFavorite(f.id)}
                    disabled={favBusy}
                    style={{padding:"6px 10px", borderRadius:8, border:"1px solid #ef4444", background:"#ef4444", color:"#fff", cursor:"pointer"}}
                  >
                    {favBusy ? "..." : "Remove"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {error && (
          <div style={{padding:12, borderRadius:12, background:"#fef2f2", color:"#991b1b", border:"1px solid #fecaca"}}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}


function RecipeView({ recipe }) {
  const title = recipe?.title || "Recipe";
  let steps = [];

  if (Array.isArray(recipe?.steps)) {
    steps = recipe.steps.map(s => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        const action = s.action || s.title || s.text || "";
        const mins = s.minutes ? ` (${s.minutes} min)` : "";
        const temp = s.celsius ? ` @ ${s.celsius}°C` : "";
        return String(action + mins + temp).trim();
      }
      return String(s);
    });
  }

  return (
    <div>
      <h3 style={{margin:"8px 0"}}>{title}</h3>
      {steps.length ? (
        <ol style={{paddingLeft:20, lineHeight:1.6}}>
          {steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      ) : (
        <p>No steps returned.</p>
      )}
    </div>
  );
}

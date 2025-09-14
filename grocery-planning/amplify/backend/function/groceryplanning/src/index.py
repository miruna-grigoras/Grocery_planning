import os, re, json, boto3, uuid, random, hashlib
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key


#Config Bedrock (rețete)

REGION     = os.environ.get("AWS_REGION", "eu-central-1").strip()
MODEL_ID   = os.environ.get("MODEL_ID", "amazon.titan-text-lite-v1").strip()
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "600"))
TEMP       = float(os.environ.get("TEMPERATURE", "0.3"))

bedrock = boto3.client("bedrock-runtime", region_name=REGION)

DAILY_POOL = [
    "eggs","milk","flour","tomatoes","onion","garlic","chicken","rice","carrots","potatoes",
    "olive oil","cheese","spinach","corn","bell pepper","mushrooms","tuna","pasta","zucchini","basil",
    "broth","butter","yogurt","cream","parsley","paprika","lemon"
]

def pick_daily_ingredients():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    seed = int(hashlib.sha256(f"{today}|recipe-of-the-day".encode()).hexdigest(), 16)
    rnd = random.Random(seed)
    k = rnd.randint(5, 9)
    k = min(k, len(DAILY_POOL))
    return rnd.sample(DAILY_POOL, k)


# DynamoDB (favorite)
TABLE_NAME = os.environ.get("TABLE_NAME") or os.environ.get("STORAGE_FAVORITESTABLE_NAME")
ddb = boto3.resource("dynamodb") if TABLE_NAME else None
table = ddb.Table(TABLE_NAME) if ddb and TABLE_NAME else None


# Utils HTTP / API GW

def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",  # sau "http://localhost:3000"
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
        "Content-Type": "application/json",
    }

def get_method_path(event):
    if isinstance(event, dict):
        return event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method"), \
               event.get("path") or event.get("requestContext", {}).get("http", {}).get("path")
    return None, None

def get_json_body(event):
    try:
        body = event.get("body")
        if isinstance(body, str):
            return json.loads(body)
        return body or {}
    except Exception:
        return {}

def get_user_id(event):
    """
    Suportă atât JWT (Cognito User Pool) cât și IAM (Cognito Identity Pool).
    """
    rc = (event or {}).get("requestContext", {}) if isinstance(event, dict) else {}
    # JWT
    claims = rc.get("authorizer", {}).get("claims") or rc.get("authorizer", {}).get("jwt", {}).get("claims") or {}
    sub = claims.get("sub")
    if sub:
        return sub
    # IAM
    ident = rc.get("identity", {}).get("cognitoIdentityId")
    if ident:
        return ident
    return None


# Helpers Bedrock + rețete

def _clean_backticks(text: str) -> str:
    text = re.sub(r"```(?:json|tabular-data-json)?", "", str(text), flags=re.I)
    return text.replace("```", "").strip()

def extract_last_json(text: str):
    if not text:
        return {}
    for candidate in (text, _clean_backticks(text)):
        try:
            return json.loads(candidate)
        except Exception:
            pass
    cleaned = _clean_backticks(text)
    stack, start, last = 0, -1, None
    for i, ch in enumerate(cleaned):
        if ch == "{":
            if stack == 0: start = i
            stack += 1
        elif ch == "}":
            stack -= 1
            if stack == 0 and start != -1:
                cand = cleaned[start:i+1]
                try:
                    last = json.loads(cand)
                except Exception:
                    pass
                start = -1
    return last if isinstance(last, dict) else {}

def detect_refusal(text: str) -> bool:
    if not isinstance(text, str): 
        return True
    bads = [r"\bI\s+can(?:not|'t)\b", r"\bI\s+am\s+unable\b", r"model\s+is\s+unable",
            r"\bas\s+an\s+AI\b", r"\bpolicy\b", r"\brefuse\b"]
    return any(re.search(p, text, flags=re.I) for p in bads)

def normalize_steps(raw):
    out = []
    for s in (raw or []):
        if isinstance(s, dict):
            text = s.get("action") or s.get("title") or s.get("instruction") or s.get("step") or s.get("text") or ""
            mins = s.get("minutes") or s.get("mins") or s.get("time") or ""
            tc   = s.get("temperature_c") or s.get("temp_c") or s.get("celsius") or ""
            line = " ".join(x for x in [str(text).strip(), f"({mins} min)" if mins else "", f"{tc}°C" if tc else ""] if x).strip()
            s = line
        else:
            s = str(s).strip()
        s = re.sub(r"\([^)]*\bingredient[^)]*\)", "", s, flags=re.I).strip()
        if s: out.append(s)
    return out

def good_steps(steps):
    if not isinstance(steps, list) or len(steps) < 6:
        return False
    joined = " ".join(map(str, steps))
    return not re.search(r"\bStep\s*\d+\b|where\s+relevant|\bplaceholder\b|\.\.\.", joined, flags=re.I)

def call_bedrock_text(prompt: str, max_tokens=None, temperature=None) -> str:
    max_tokens  = int(max_tokens or MAX_TOKENS)
    temperature = float(temperature or TEMP)

    if MODEL_ID.startswith("amazon.titan-text"):
        body = {
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": max_tokens,
                "temperature": temperature,
                "topP": 0.9,
                "stopSequences": []
            }
        }
    else:
        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
        }

    resp = bedrock.invoke_model(
        modelId=MODEL_ID, contentType="application/json", accept="application/json",
        body=json.dumps(body)
    )
    payload = json.loads(resp["body"].read().decode("utf-8"))

    if MODEL_ID.startswith("amazon.titan-text"):
        results = payload.get("results") or []
        return results[0].get("outputText", "") if results else ""
    else:
        parts = payload.get("output", {}).get("content") or payload.get("content") or []
        texts = [p.get("text") for p in parts if isinstance(p, dict) and p.get("type") == "text"]
        return "\n".join([t for t in texts if t])

EXAMPLES = """
EXAMPLE
Ingredients: ["pasta","tomatoes","garlic","basil"]
Output JSON:
{"title":"Pasta al Pomodoro","steps":["Boil pasta in salted water 8–10 min; drain.","Warm 2 tbsp olive oil (2 min).","Sauté 2 minced garlic cloves 1–2 min.","Add 300 g crushed tomatoes; simmer 6–8 min; season.","Toss with pasta; add torn basil; 1 min; serve.","Optional: finish with grated Parmesan."]}

EXAMPLE
Ingredients: ["eggs","potatoes","onion"]
Output JSON:
{"title":"Spanish Tortilla","steps":["Slice potatoes and onion thinly.","Fry in 4 tbsp oil until tender (10–12 min).","Beat 6 eggs; season.","Mix eggs with drained potatoes/onion.","Cook on medium-low until almost set (5–6 min).","Flip; cook 3–4 min; rest; slice; serve."]}

EXAMPLE
Ingredients: ["rice","mushrooms","onion"]
Output JSON:
{"title":"Mushroom Risotto","steps":["Warm 800 ml stock on low heat.","Sauté chopped onion in 2 tbsp butter (3–4 min).","Add 300 g Arborio rice; toast 2 min.","Add sliced mushrooms; cook 2–3 min.","Add hot stock ladle by ladle ~18 min until creamy.","Finish with butter; season; rest 1 min; serve."]}
""".strip()

def system_prompt(ingredients):
    ing = ", ".join(ingredients) if ingredients else "basic pantry staples"
    return f"""
You are a Michelin-trained recipe developer. Create ONE authentic, cookable ENGLISH recipe that uses ONLY these ingredients when possible: {ing}.
You MAY assume salt, pepper, oil and water/stock. Do NOT introduce other major ingredients.
Prefer a classic dish name if a well-known recipe fits; otherwise propose a sensible home-style dish.

Return ONLY a pure JSON object (no markdown, no commentary) with EXACTLY:
{{
  "title": "Short specific dish name",
  "steps": [
    "Action with minutes and, when relevant, °C.",
    "... (6–8 total)"
  ]
}}

Hard rules:
- 6–8 steps, imperative, concrete; include times and °C where reasonable.
- Do NOT echo the word "ingredients" inside parentheses.
- No markdown, no extra keys.

{EXAMPLES}

Now generate the JSON for: {ingredients}
""".strip()

def strict_prompt(ingredients):
    ing = ", ".join(ingredients) if ingredients else "basic pantry staples"
    return f"""
Return ONLY a JSON object with "title" and "steps".
- Use ONLY: {ing} (+ salt/pepper/oil/water/stock).
- 6–8 concrete steps with minutes and °C when reasonable.
- No markdown, no commentary, no extra keys.
""".strip()

def repair_prompt(prev):
    prev = (prev or "")[:6000]
    return f"""
Extract the BEST VALID JSON like:
{{"title":"...","steps":["...", "..."]}}
Return ONLY the pure JSON (no markdown). Remove parentheses that just repeat ingredients.
Previous:
{prev}
""".strip()

def generate_recipe(ingredients):
    raw1 = call_bedrock_text(system_prompt(ingredients))
    if detect_refusal(raw1):
        raw1 = call_bedrock_text(system_prompt(ingredients), temperature=min(0.55, TEMP+0.2))

    data1 = extract_last_json(raw1)
    if isinstance(data1, dict):
        steps = normalize_steps(data1.get("steps"))
        if good_steps(steps):
            return {"title": (data1.get("title") or "Suggested Recipe").strip(), "steps": steps}

    raw2 = call_bedrock_text(strict_prompt(ingredients), max_tokens=620, temperature=min(0.5, TEMP+0.15))
    if detect_refusal(raw2):
        raw2 = call_bedrock_text(strict_prompt(ingredients), max_tokens=620, temperature=min(0.6, TEMP+0.25))
    data2 = extract_last_json(raw2)
    if isinstance(data2, dict):
        steps = normalize_steps(data2.get("steps"))
        if good_steps(steps):
            return {"title": (data2.get("title") or "Suggested Recipe").strip(), "steps": steps}

    raw3  = call_bedrock_text(repair_prompt(raw2 or raw1), max_tokens=580, temperature=min(0.55, TEMP+0.2))
    data3 = extract_last_json(raw3)
    if isinstance(data3, dict):
        steps = normalize_steps(data3.get("steps"))
        if good_steps(steps):
            return {"title": (data3.get("title") or "Suggested Recipe").strip(), "steps": steps}

    return {
        "title": "Weeknight Dish",
        "steps": [
            "Heat 2 tbsp oil over medium heat (2 min).",
            "Sauté aromatics if present (onion/garlic) 3–4 min.",
            "Add main ingredients; cook 8–12 min, stirring.",
            "Season to taste; keep it simple and warm.",
            "Serve hot."
        ]
    }


# Handler

def handler(event, context):
    try:
        method, path = get_method_path(event)

        
        if method == "OPTIONS":
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        
        if path and path.endswith("/favorites") and method == "GET":
            if not table:
                return {"statusCode": 500, "headers": cors_headers(), "body": json.dumps({"error":"TABLE_NOT_CONFIGURED"})}
            user_id = get_user_id(event)
            if not user_id:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error":"UNAUTHENTICATED"})}
            resp = table.query(KeyConditionExpression=Key("userSub").eq(str(user_id)))
            items = resp.get("Items", [])
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(items)}

        if path and path.endswith("/favorites") and method == "POST":
            if not table:
                return {"statusCode": 500, "headers": cors_headers(), "body": json.dumps({"error":"TABLE_NOT_CONFIGURED"})}
            user_id = get_user_id(event)
            if not user_id:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error":"UNAUTHENTICATED"})}
            data = get_json_body(event)
            rid = data.get("id") or str(uuid.uuid4())
            title = (data.get("title") or "Recipe").strip()
            steps = data.get("steps") or []
            item = {"userSub": str(user_id), "id": str(rid), "title": title, "steps": steps}
            table.put_item(Item=item)
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True, "id": rid})}

        if path and "/favorites/" in path and method == "DELETE":
            if not table:
                return {"statusCode": 500, "headers": cors_headers(), "body": json.dumps({"error":"TABLE_NOT_CONFIGURED"})}
            user_id = get_user_id(event)
            if not user_id:
                return {"statusCode": 401, "headers": cors_headers(), "body": json.dumps({"error":"UNAUTHENTICATED"})}
            rid = path.rsplit("/", 1)[-1]
            table.delete_item(Key={"userSub": str(user_id), "id": str(rid)})
            return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps({"ok": True})}

        # ---------- RECIPES ----------
      
        payload = {}
        if isinstance(event, dict) and event.get("body"):
            try:
                payload = json.loads(event["body"])
            except Exception:
                payload = {}
        elif isinstance(event, dict):
            payload = event

        mode = (payload.get("mode") or "custom").strip().lower() if isinstance(payload, dict) else "custom"
        if mode == "daily":
            ingredients = pick_daily_ingredients()
        else:
            raw_ing = payload.get("ingredients") if isinstance(payload, dict) else None
            if raw_ing is None and isinstance(event, dict):
                raw_ing = event.get("ingredients")
            ingredients = [str(x).strip() for x in (raw_ing or []) if str(x).strip()]

        result = generate_recipe(ingredients)
        return {"statusCode": 200, "headers": cors_headers(), "body": json.dumps(result, ensure_ascii=False)}

    except Exception as e:
        print("Handler error:", repr(e))
        return {"statusCode": 500, "headers": cors_headers(), "body": json.dumps({"error": "Server error", "detail": str(e)})}


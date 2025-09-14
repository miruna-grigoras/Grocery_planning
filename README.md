# `NoWaste – Recipe Helper`

Web app that suggests recipe ideas from available ingredients and lets users save favourites.  
**Auth:** Amazon Cognito (Amplify) • **API:** API Gateway → Lambda (Python) • **DB:** DynamoDB

**Live :** https://d1bbrjg6tnywdt.cloudfront.net/


## Tech stack
- **Frontend:** React + Amplify UI  
- **Auth:** Amazon Cognito (Amplify Auth)  
- **API:** API Gateway (REST) → AWS Lambda (Python 3.11)  
- **Database:** DynamoDB (`favoritesTable`)  
- **Hosting:** S3 + CloudFront via Amplify Hosting  


## Features
- Sign up / Sign in / Sign out via Cognito
- Generate recipe from selected ingredients (Bedrock text model)
- Save / Delete favourites (per user account)
- “My Account” page: profile + change password (Cognito accounts)
- Responsive, simple UI


## Prerequisites

- **Node.js 18+** – check with `node -v`
- **Git**
- **AWS CLI v2** – <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>
- **Amplify CLI** – `npm i -g @aws-amplify/cli`
- An **AWS account** (or an **Amplify Studio invite**) from the owner

Amplify init / env
```bash
amplify init
amplify add auth
amplify add function
amplify add api
amplify add storage
amplify push
amplify hosting add # choose "Amazon CloudFront and S3"
amplify publish
```


Useful commands
```bash
# status & consoles
amplify status
amplify console auth|api|function|hosting --profile nowaste

# update categories
amplify update function        # env vars, permissions
amplify update api             # routes, methods

# add/remove categories
amplify add <auth|api|function|storage|hosting>
amplify remove <category>

# deploy backend
amplify push --profile nowaste

# publish frontend
npm run build
amplify publish --profile nowaste
```

Lambda (amplify update function → Environment variables):
```bash
TABLE_NAME=favoritesTable-<ENV>
AWS_REGION=eu-central-1
MODEL_ID=amazon.titan-text-lite-v1
```

# `ARHITECTURE`
```markdown
User (Browser) → React (Amplify Auth & UI) → API Gateway (JWT Authorizer) → Lambda (Python)
→ DynamoDB (favorites) | Bedrock Runtime (text model) → back to user

Frontend (React): Amplify handles tokens; .env.local supplies REACT_APP_API_URL.
Auth (Cognito User Pool): Email/password; JWT in Authorization: Bearer <id_token>.

API (REST):
POST /recipes – generate (body: {mode: "custom"|"daily", ingredients: [...]})
GET /favorites – list
POST /favorites – create
DELETE /favorites/{id} – delete
Lambda (Python): validates user, calls Bedrock model (Titan), normalizes JSON, stores/reads DynamoDB items.
DynamoDB: favoritesTable
```

# `BACKLOG`
```markdown


Legend: P1 = must, P2 = should, P3 = could.  
Each item includes short acceptance criteria.

P1 – Must

1. User authentication (Cognito)
   - Email/password sign-up, email confirmation, sign-in, sign-out.
   - AC: User can sign up, confirm email, sign in, sign out; tokens are stored by Amplify.

2. Generate recipe from ingredients
   - UI checklist + free-text add; call Lambda/Bedrock; show title + 6–8 steps.
   - AC: Selecting ingredients and clicking Generate returns a coherent recipe in < 30 s.

3. Save to favourites
   - Persist recipe under `userSub + id` in DynamoDB.
   - AC: After Add to favourites, the item is in DynamoDB and appears on refresh.

4. List & delete favourites
   - GET `/favorites`, DELETE `/favorites/{id}`.
   - AC: Items are listed for the current user; delete removes the item.

5. My Account
   - Show email, userId (sub), provider; change password for Cognito user/pass accounts.
   - AC: Data visible; change password works and shows friendly feedback.

6. Hosting
   - Publish with Amplify Hosting (S3 + CloudFront).
   - AC: Public URL accessible; basic cache headers; CORS OK.

P2 – Should

1. My Account
   - Show email, userId (sub), provider; change password for Cognito user/pass accounts.
   - AC: Data visible; change password works and shows friendly feedback.

2. Loading & error states
   - Skeleton or spinners; user-friendly error banners.
   - AC: No raw stack traces; timeouts handled.


P3 – Could

1. Dark mode
    - Toggle with CSS variables.
    - AC: Theme switch persists locally.

```
# `Implementation Roadmap`

## Goals & Scope
- Deliver MVP: Auth, Recipe generator, Favourites, My Account, Hosting.

## Assumptions
- Region: eu-central-1; Bedrock model: amazon.titan-text-lite-v1;

## Milestones

```bash
### M1 — Core Platform (Week 1)
Reqs: R-Auth, R-Gen
- Tasks:
  - Setup Cognito with Amplify Auth (R-Auth)  -`Miruna`
  - Lambda + Bedrock call + JSON normalization (R-Gen) -`Miruna+Daria`
- Acceptance: New user can sign in and generate recipe in < 10s. Logs visible.

### M2 — Favourites & Account (Week 2)
Reqs: R-Fav, R-Account
- Tasks:
  - DynamoDB table (PK userSub, SK id) + CRUD endpoints (GET/POST/DELETE) -`Miruna`
  - “My Account” page + change password (Cognito-only) `Miruna+Daria`
- Acceptance: Save/delete favourite; password change success states.

### M3 — Hosting & Ops (Week 3)
Reqs: R-Host, R-Obs, R-Budget
- Tasks:
  - Amplify Hosting (S3+CloudFront), CORS -`Miruna`
- Acceptance: Public URL works end-to-end; budget alert tested.

### M4 — Polish (Week 4)
Reqs: R-UX
- Tasks:
 - Header/buttons polish, accessibility basics, docs completion-`Miruna`
 - QA for testing-`Andra`
- Acceptance: GETTING_STARTED works for a new dev in < 30 min.


```
# `Risks & blockers`

Intermittent high latency from Bedrock (Titan) triggers fallback

**Observation:** Occasionally the `amazon.titan-text-lite-v1` model takes too long to respond. When the end-to-end request exceeds the UI timeout, the app shows the predefined fallback recipe. Refreshing/retrying a few times typically returns a correct recipe.

**Impact:** Inconsistent UX, user confusion (“why did I get a generic recipe?”), and extra retries that may increase cost.

**Likely causes:**
- Model-side queueing or transient throttling in Bedrock.
- Lambda cold starts / limited concurrency.
- Large prompt size or high `MAX_TOKENS` → longer generation time.
- API Gateway’s hard timeout (≈29s) combined with the UI timeout (30s).

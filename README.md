# NoWaste – Recipe Helper

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
- Save / Delete favourites (per user)
- “My Account” page: profile + change password (Cognito accounts)
- Responsive, simple UI

## Local development
**Requirements:** Node 18+, Amplify CLI (`npm i -g @aws-amplify/cli`)

1. Clone & install
   ```bash
   git clone https://github.com/<org-or-user>/<repo>.git
   cd <repo>/grocery-planning
   npm install
2. Configure API URL
   Create .env.local in the React app root:
      amplify env add      # ex. "qa"
      amplify push
      https://g3doh0m91f.execute-api.eu-central-1.amazonaws.com/

3.Run
   npm start

## Prerequisites

- **Node.js 18+** – check with `node -v`
- **Git**
- **AWS CLI v2** – <https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html>
- **Amplify CLI** – `npm i -g @aws-amplify/cli`
- An **AWS account** (or an **Amplify Studio invite**) from the owner

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


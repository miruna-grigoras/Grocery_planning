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


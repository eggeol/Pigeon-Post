# Pigeon Post

Pigeon Post is a cute full-stack web app where letters do not arrive instantly. A message leaves from the sender's perch, travels toward the recipient's saved roost, and only appears once the pigeon has finished the trip.

## Stack

- React + Vite frontend
- Express API serving the built frontend
- Prisma + PostgreSQL
- Google Identity Services for sign-in
- Geoapify geocoding for place search and reverse geocoding
- Browser Geolocation API for live location access
- Docker + Docker Compose for local testing
- `render.yaml` Blueprint for Render deployment

## What the app does

- Signs users in with Google
- Lets each user save a pigeon tag plus a home location
- Allows sending a message only to another registered user
- Calculates delivery time from sender and recipient locations
- Shows delivered mail in the inbox and in-flight mail in the outbox

## Local Docker setup

1. Copy `.env.example` to `.env`.
2. Fill in `GOOGLE_CLIENT_ID`, `GEOAPIFY_API_KEY`, and set a strong `JWT_SECRET`.
3. Start the app:

```bash
docker compose up --build
```

4. Open `http://localhost:3000`.

The app service runs on port `3000` locally, and PostgreSQL is exposed on `5432`.

## Google sign-in setup

Create a Google OAuth client for a web application, then add these Authorized JavaScript Origins:

- `http://localhost:3000`
- Your Render app URL, such as `https://pigeon-post.onrender.com`

Use the resulting client ID as `GOOGLE_CLIENT_ID`.

## Geoapify place search setup

Create a free Geoapify account, create a project, and copy the generated API key.

Use that key as `GEOAPIFY_API_KEY`.

For production, restrict the key to your frontend origins in Geoapify:

- `http://localhost:3000/*`
- Your Render URL, such as `https://pigeon-post.onrender.com/*`

The app uses the browser's Geolocation API for live current location, so location permission still requires HTTPS in production.

## Local non-Docker setup

1. Install dependencies:

```bash
npm install
```

2. Start PostgreSQL locally and make sure `DATABASE_URL` points to it.
3. Run migrations:

```bash
npx prisma migrate dev
```

4. Start the dev servers:

```bash
npm run dev
```

The Vite frontend runs on `5173` and proxies API calls to the Express server on `8787`.

## Deploying to Render

This repo includes a `render.yaml` Blueprint for the web service.

Use Neon for the database instead of Render's free Postgres if you want the free setup to keep working long-term.

### Deploy steps

1. Push this project to GitHub.
2. Create a free PostgreSQL database in Neon.
3. Copy Neon's direct connection string and use it as `DATABASE_URL`.
4. In Render, create a new Blueprint instance from the repo.
5. When prompted, enter `DATABASE_URL`, `GOOGLE_CLIENT_ID`, and `GEOAPIFY_API_KEY`.
6. After the service is created, add your Render URL to the Google OAuth client's Authorized JavaScript Origins.
7. Redeploy once the Google origin is added.

The app automatically runs `prisma migrate deploy` on startup, so the database schema will be applied during deploy.

## Important Render note

Render's free web service is good for hobby projects, but it spins down after inactivity and has monthly free-hour limits. Render's free Postgres also expires after 30 days, so Neon is the better free database choice for this repo.

## Main files

- `src/` contains the frontend
- `server/` contains the API and auth logic
- `prisma/schema.prisma` defines the database schema
- `prisma/migrations/` contains the migration history
- `Dockerfile` builds the production image
- `docker-compose.yml` runs the app and Postgres locally
- `render.yaml` provisions Render resources

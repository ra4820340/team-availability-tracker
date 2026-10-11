# Team Availability Tracker + JWT Authentication

Responsive team dashboard built with Node.js, Express, HTML, CSS and JavaScript. Includes 40 seed records and a JWT authentication layer.

## Run locally
1. Install Node.js.
2. In this folder run `npm install` then `npm start`.
3. Open `http://localhost:3000`.
4. Import `postman/Team-Availability-Tracker-Auth.postman_collection.json` into Postman.

## Authentication endpoints
- `POST /api/auth/register` — JSON `{ "name": "Demo User", "email": "demo@example.com", "password": "DemoPass123!" }`
- `POST /api/auth/login` — JSON `{ "email": "demo@example.com", "password": "DemoPass123!" }`
- `GET /api/auth/me` — protected; accepts the `token` HTTP-only cookie or `Authorization: Bearer <token>`.
- `POST /api/auth/logout` — clears the HTTP-only cookie.

Passwords are hashed with bcryptjs (12 rounds); JWTs are signed with `JWT_SECRET` and expire after 2 hours. The API sets an HTTP-only, SameSite=Lax cookie and also returns a token for API clients such as Postman. For production, set a strong `JWT_SECRET` environment variable and `NODE_ENV=production` (HTTPS is required for secure cookies).

**Storage note:** to keep the demo quick and dependency-light, accounts are saved to `data/users.json`, not a database. For a production submission, move users to MongoDB/PostgreSQL and keep secrets in deployment environment variables. JSON files on Render may be lost during restarts/redeploys.

## Team API
- `GET /api/health`
- `GET /api/team` (public read, supports `status`, `role`, `search` query parameters)
- `PATCH /api/team/:id/status` — protected; body `{ "status": "Busy" }`
- `POST /api/team` — protected; body `{ "name": "Taylor Example", "role": "Developer" }`
- `DELETE /api/team/:id` — protected
- `POST /api/team/reset` — protected

## Deploy to Render
Push the project to GitHub, create a Render Web Service, set Build Command to `npm install` and Start Command to `npm start`. Add environment variable `JWT_SECRET` with a long random value, and `NODE_ENV=production`. The JSON-file storage is for demo purposes only; use a managed database for durable production storage.

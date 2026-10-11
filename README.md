# Team Availability Tracker

Responsive team dashboard built with Node.js, Express, HTML, CSS and JavaScript. Includes the 40 supplied seed records, availability updates, search, role/status filters, add/remove members, and five-second auto-refresh.

## Run locally
1. Install Node.js.
2. In this folder run `npm install` then `npm start`.
3. Open http://localhost:3000.

## API
- `GET /api/health`
- `GET /api/team` (optional query parameters: `status`, `role`, `search`)
- `PATCH /api/team/:id/status` body: `{"status":"Busy"}`
- `POST /api/team` body: `{"name":"Alex Morgan","role":"Design","timezone":"Asia/Kolkata"}`
- `DELETE /api/team/:id`
- `POST /api/team/reset` restores the original seed records

## Deploy to Render
Push this folder to GitHub, create a Render Web Service from the repository, set Build Command to `npm install` and Start Command to `npm start`. Render usually uses an ephemeral filesystem; JSON file edits may be lost after restart/redeploy. For durable production persistence, connect a managed database such as MongoDB Atlas.

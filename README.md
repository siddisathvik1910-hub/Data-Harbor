# Dataset Sharing Platform

Two separate websites sharing one backend API and one PostgreSQL database.

| App | Folder | URL | Purpose |
|---|---|---|---|
| Backend API | `backend/` | http://localhost:4000 | Express + Prisma REST API, all business rules |
| Admin website | `admin-portal/` | http://localhost:5173 | Review publish requests, manage users |
| User website | `user-portal/` | http://localhost:5174 | Publish, browse, request and download datasets |

**Stack:** React + Vite + Tailwind + React Router + Axios - Node/Express - PostgreSQL + Prisma - JWT in httpOnly cookies + bcrypt - Multer - Zod - helmet, CORS allow-list, rate limiting.

---

## 1. Prerequisites

- Node.js 18.18+ (22 recommended) and npm
- PostgreSQL 14+ (the easiest way is Docker, below)

## 2. Run it (first time)

Open **four terminals** in the project root (`dataset-platform/`).

### Terminal 1 - database
```bash
docker compose up -d
```
If port `5432` is already in use, set `DB_PORT` to an available host port before starting (PowerShell: `$env:DB_PORT='5433'`; Bash: `export DB_PORT=5433`) and use the same port in `backend/.env`.
No Docker? Install PostgreSQL yourself, create a database named `dataset_platform`, and edit `DATABASE_URL` in `backend/.env`.

### Terminal 2 - backend
```bash
cd backend
cp .env.example .env          # Windows: copy .env.example .env
# edit .env and set JWT_SECRET to a long random string:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm install
npm run setup                 # generates Prisma client, applies the migration, creates admin + demo data
npm run dev                   # API on http://localhost:4000
```
Check it: open http://localhost:4000/api/health - you should see `{"ok":true}`.

### Terminal 3 - admin website
```bash
cd admin-portal
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

### Terminal 4 - user website
```bash
cd user-portal
cp .env.example .env
npm install
npm run dev                   # http://localhost:5174
```

## 3. Log in and see the output

| Site | URL | Email | Password |
|---|---|---|---|
| Admin | http://localhost:5173 | `admin@example.com` | `Admin@12345` |
| User (demo) | http://localhost:5174 | `alice@example.com` | `Demo@12345` |
| User (demo) | http://localhost:5174 | `bob@example.com` | `Demo@12345` |
| User (demo) | http://localhost:5174 | `carol@example.com` | `Demo@12345` |

Or create your own account on the user site's **Sign up** page.

The seed script created demo data in every state: public + private approved datasets, two pending datasets (appear in the admin's *Publish Requests*), one rejected dataset with a reason, and a pending access request from Bob to Alice's private dataset.

**A 2-minute tour**
1. User site as **Bob**: *Publish dataset* -> upload any `.csv` -> it shows as *Pending* in *My Datasets* and is **not** in the catalog.
2. Admin site: *Publish Requests* -> *Download to inspect* -> *Approve*.
3. Bob gets a bell notification, and the dataset is now in the catalog.
4. User site as **Carol**: open Bob's *private* dataset -> *Request access*.
5. As **Bob**: *Requests Received* -> *Approve*. Carol gets a notification and the Download button unlocks.

## 4. Creating / changing the admin account

There is no admin signup. The admin is created by the seed script from `backend/.env`:
```
ADMIN_NAME="Platform Admin"
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD="Admin@12345"
```
Edit those, then run `npm run seed` in `backend/` (it updates the existing admin or creates a new one). **Change the default password before deploying anywhere real.**
Set `SEED_DEMO=false` to skip the demo users and datasets.

## 5. Useful commands

```bash
# backend/
npm run dev          # start with auto-restart
npm start            # start (production)
npm run seed         # (re)create admin + demo data - safe to repeat
npm run db:migrate   # create a new migration after editing prisma/schema.prisma
npm run db:deploy    # apply existing migrations (production)
npx prisma studio    # browse the database in a web UI

# admin-portal/ and user-portal/
npm run build        # production build into dist/
npm run preview      # serve the production build on the same port

# reset everything (deletes ALL data)
docker compose down -v && docker compose up -d && cd backend && npm run setup
```

## 6. Configuration

**backend/.env**

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | **Required.** Long random string used to sign login tokens |
| `ADMIN_ORIGIN` / `USER_ORIGIN` | The only two origins CORS will accept (defaults `:5173` / `:5174`) |
| `UPLOAD_DIR` | Where files are stored (default `./uploads`, never served statically) |
| `MAX_FILE_MB` | Max upload size (default 50). If you change it, also change `MAX_MB` in `user-portal/src/pages/DatasetForm.jsx` |
| `COOKIE_SAMESITE` | `lax` for localhost/same-site. Use `none` (needs HTTPS) if the sites live on different domains |
| `SEED_DEMO` | `true` to create demo data when seeding |

**admin-portal/.env and user-portal/.env:** `VITE_API_URL=http://localhost:4000/api`

## 7. How the security rules are enforced (all on the backend)

| # | Rule | Where |
|---|---|---|
| 1 | Only APPROVED datasets are listed | `routes/datasets.js` catalog query has `where.status = 'APPROVED'` |
| 2 | Private download = owner, admin, or APPROVED request | `canDownload()` in `routes/datasets.js`; admin route in `routes/admin.js` |
| 3 | Public download = any signed-in user | same `canDownload()` |
| 4 | No request for own/public dataset; no duplicate pending | `routes/accessRequests.js` (Serializable transaction closes the double-click race) |
| 5 | Only the owner answers access requests | ownership check in `respond()` |
| 6 | Only admin approves/rejects; reason required | `routes/admin.js`, Zod `min(3)` |
| 7 | Suspended users locked out | `middleware/auth.js` re-reads the user from the DB on **every** request, and login refuses suspended accounts |
| 8 | Admin and user tokens don't cross | separate cookies (`ds_admin_token` / `ds_user_token`), separate JWT audiences, role check |
| 9 | No public static folder for files | files are stored under opaque random names and only streamed by `utils/sendFile.js` after an auth check; the API never returns `filePath` |

**Swapping local storage for S3:** only `backend/src/storage/index.js` touches the disk. Implement the same four methods (`save`, `saveBuffer`, `open`, `remove`) with the AWS SDK and export that instead - no route changes.

## 8. Run the project using following commands
git clone 
cd 
##Docker setup:
$env:DB_PORT = '5433'
docker compose up -d
##Backend setup
cd backend
npm ci
npm run setup
npm run dev
##Admin portal
cd admin-portal
npm install
npm run dev
##User portal
cd user-portal
npm ci
$env:VITE_API_URL = 'http://localhost:4000/api'
npm run dev
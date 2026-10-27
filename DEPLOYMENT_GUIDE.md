# 🚀 N5 Casino Platform — Complete Deployment & Operations Guide

Yeh guide aapko N5 Casino platform ko kisi bhi Linux VPS (Ubuntu 22.04 / 24.04, AWS, DigitalOcean, Hetzner, ya Contabo) par **Docker** aur standalone mode ke zariye secure aur reproducible tareeqay se run karne ka process batati hai.

---

## 📋 Pre-requisites (Server Requirements)
1. Ubuntu 22.04 LTS ya 24.04 LTS (Kam az kam 2 GB RAM, 2 vCPU recommended).
2. Docker & Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2
   sudo systemctl enable --now docker
   ```
3. Node.js 20+ (agar standalone backend run karna ho).

---

## ⚡ Deployment Process:

### Step 1: Project Server Par Setup Karein
Server par folder upload karein ya git clone karein:
```bash
cd /opt/n5-casino
cp .env.example .env
```
`.env` file mein apni secure production values configure karein:
- `POSTGRES_PASSWORD`: Strong database password
- `JWT_ACCESS_SECRET`: 32+ character random string (openssl rand -base64 32)
- `JWT_REFRESH_SECRET`: 32+ character random string (openssl rand -base64 32)
- `CORS_ORIGIN`: Explicit comma-separated allowed origins (e.g. `https://n5game.com,https://admin.n5game.com`)

### Step 2: Stack Launch Karein
```bash
docker compose up -d --build
```
Yeh command automatically:
1. PostgreSQL 16 database launch karegi private internal network (`backend-network`) par (host ports isolated).
2. React Admin panel build karegi.
3. Node.js backend build karegi non-root `node` user execution ke saath.
4. `AUTO_MIGRATE=true` ke tehat container start par automatically canonical SQL migrations execute karegi.
5. Nginx HTTPS reverse proxy (Ports 80 & 443) start karegi with HTTP-to-HTTPS redirect, modern TLSv1.2/1.3, security headers, aur WebSocket support.

### Step 3: Logs Check Karein
```bash
docker compose logs -f app
docker compose logs -f proxy
```

---

## 🗄️ Database Migrations Architecture:

Database migrations `schema_migrations` table ke zariye tracked, atomic transactions mein executed, aur PostgreSQL advisory lock (`14592034`) se concurrent runs ke khilaf protected hain.

### Supported Scenarios:
1. **Clean Database Install:**
   Empty database par migrations `001_initial_foundation.sql` se lekar `036_crash_game_rounds.sql` tak sequential order mein execute hoti hain.
2. **Existing Database Upgrade:**
   Pre-existing database par sirf pending migrations detect aur apply hoti hain (e.g. `034_admin_payment_methods.sql`, `035_payment_idempotency_and_reference_uniqueness.sql`, `036_crash_game_rounds.sql`).
3. **Legacy Database Baselining:**
   Agar database pehle se exist karti ho lekin `schema_migrations` table na ho (e.g. legacy Docker volume), migrator historical migrations (001–033) ko automatically baseline karta hai aur naye pending migrations apply karta hai.
4. **Repeated Runs / Idempotency:**
   Migrations idempotent hain; database up-to-date hone par 0 changes apply hotay hain.

### Manual CLI Commands:
```bash
# Migration status check karein:
npm run migrate -- --status

# Dry-run check:
npm run migrate -- --dry-run

# Migrations apply karein:
npm run migrate

# Specific database URL par run karein:
npm run migrate -- --url="postgresql://user:pass@host:5432/n5_game"
```

---

## 🔑 Secure Admin Operator Bootstrap:

Production platform par koi default public passwords, hardcoded credentials ya automatic test-admin creation nahi hoti. Pehla authorized admin operator explicit CLI command ke zariye configure kiya jata hai:

```bash
# Explicit password ke sath:
ADMIN_PHONE="+923001234567" ADMIN_PASSWORD="<Your_Secure_Password_Min_12_Chars>" npm run bootstrap:admin

# Ya CLI flags ke sath:
npm run bootstrap:admin -- --phone="+923001234567" --password="<Your_Secure_Password_Min_12_Chars>"

# Ya auto-generated secure password ke sath:
npm run bootstrap:admin -- --phone="+923001234567"
```

### Security & Safety Rules:
1. **E.164 Phone Format Required:** Phone number strictly international format mein hona chahiye (e.g. `+923001234567`).
2. **Password Complexity:** Kam az kam 12 characters lazmi hain. Common default passwords (e.g. `Password123!`, `admin123`, `securePassword123!`) strictly reject hotay hain. Password bcrypt (cost 12) ke sath hash hota hai.
3. **2 Active Operator Limit:** Migration `030` aur application logic ke tehat system mein maximum **2 active admin operators** allow hain. Teesra active operator create karne par `N5_ADMIN_OPERATOR_LIMIT_REACHED` error aayega.
4. **Audit Trail:** Admin user profile aur role assignment `admin_users` aur `admin_roles` tables mein auditable record ke tor par save hoti hai.

---

## 🌐 Live Service URLs (Via HTTPS Reverse Proxy):
- **Player Web Lobby:** `https://YOUR_DOMAIN/lobby`
- **Slot Game:** `https://YOUR_DOMAIN/games/play`
- **Aviator Crash:** `https://YOUR_DOMAIN/games/aviator`
- **Admin Management Panel:** `https://YOUR_DOMAIN/admin`
- **Health / Readiness Check:** `https://YOUR_DOMAIN/api/v1/health/ready`
- **Nginx Liveness Probe:** `http://YOUR_DOMAIN/nginx-health` (Port 80)

---

## 🛠️ Management & Maintenance Commands:
* **Restart Services:** `docker compose restart`
* **Stop Services:** `docker compose down`
* **Database Backup:**
  ```bash
  docker exec -t n5-postgres pg_dump -U postgres n5_game > backup_$(date +%F).sql
  ```
* **Database Restore:**
  ```bash
  docker exec -i n5-postgres psql -U postgres n5_game < backup.sql
  ```

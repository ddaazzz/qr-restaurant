# 🚨 Database Connection Error - Resolution Guide

## Problem
Your backend is failing with:
```
Error: Connection terminated unexpectedly
```

## Root Cause
**PostgreSQL is not installed or running** on your machine.

The `.env` file has been created with:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qrrestaurant
```

But the database server is not accessible.

---

## Solution

### Step 1: Install PostgreSQL (Windows)

**Option A: GUI Installer (Recommended for Windows)**
1. Download: https://www.postgresql.org/download/windows/
2. Choose latest version (17 or 16)
3. Run installer and follow these steps:
   - **Installation Directory**: Keep default (`C:\Program Files\PostgreSQL\17`)
   - **Password**: Set password for `postgres` user (e.g., `postgres`)
   - **Port**: Keep default (`5432`)
   - **Locale**: Keep default
   - **Data Directory**: Keep default
4. **Important**: Remember your postgres password!

**Option B: Using Chocolatey (if installed)**
```powershell
choco install postgresql
# Set password when prompted
```

**Option C: Windows Subsystem for Linux (WSL)**
```bash
wsl
sudo apt update
sudo apt install postgresql postgresql-contrib -y
sudo service postgresql start
```

---

### Step 2: Start PostgreSQL Server

**Windows (Auto):**
- PostgreSQL starts automatically as a Windows service
- Verify: Open Services app (`services.msc`) and check "postgresql-x64-*" is Running

**Windows (Manual):**
```powershell
# If not running, use:
pg_ctl -D "C:\Program Files\PostgreSQL\17\data" start
```

**WSL:**
```bash
wsl
sudo service postgresql start
```

---

### Step 3: Create Database and Load Schema

**Open PowerShell/Terminal and run:**

```powershell
# Add PostgreSQL to PATH (if psql command not found)
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"

# Create database
psql -U postgres -c "CREATE DATABASE qrrestaurant;"

# Load schema
cd c:\Users\DT\Documents\qr-restaurant-ai
psql -U postgres -d qrrestaurant -f qrrestaurant.sql
```

If prompted for password, enter the postgres password you set during installation.

---

### Step 4: Update .env if Needed

If you used a **different password** during installation, update `.env`:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/qrrestaurant
```

---

### Step 5: Start the Backend

```powershell
cd c:\Users\DT\Documents\qr-restaurant-ai
npm run dev
```

Expected output:
```
✅ Backend running on http://localhost:10000
📱 Local Network: http://192.168.x.x:10000
```

---

## Troubleshooting

### "psql: command not found"
Add PostgreSQL to PATH:
```powershell
$env:Path += ";C:\Program Files\PostgreSQL\17\bin"
# Permanently: Add to System Environment Variables → Path
```

### "password authentication failed"
- Verify `.env` DATABASE_URL has correct password
- Or reset postgres password:
  ```powershell
  psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'newpassword';"
  ```

### "FATAL: database "qrrestaurant" does not exist"
Run Step 3 again to create database

### "Cannot connect to localhost:5432"
- Ensure PostgreSQL service is running (Services.msc)
- Check firewall isn't blocking port 5432
- Try restarting PostgreSQL service

---

## Database Ready Checklist

- [ ] PostgreSQL installed (check: `psql --version`)
- [ ] PostgreSQL service running (check: Services app)
- [ ] Database `qrrestaurant` created
- [ ] Schema loaded from `qrrestaurant.sql`
- [ ] `.env` file has correct DATABASE_URL
- [ ] Backend starts without connection errors

Once all boxes are checked, run `npm run dev` and access http://localhost:10000

---

## Test Connection

```powershell
# Test if database is accessible:
psql -U postgres -d qrrestaurant -c "\dt"
# Should list tables if schema was loaded

# Or from backend:
npm run dev
# Should see: "Backend running on http://localhost:10000" (no errors)
```

---

## Need Help?

- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **Default Port**: 5432
- **Default User**: postgres
- **Default DB**: qrrestaurant

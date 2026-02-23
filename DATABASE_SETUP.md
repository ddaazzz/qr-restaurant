# Database Setup Guide for QR Restaurant AI

## Prerequisites
You need PostgreSQL installed. Here are the quick steps:

### Option 1: Install PostgreSQL on Windows
1. Download PostgreSQL installer from: https://www.postgresql.org/download/windows/
2. Run the installer and follow the installation wizard
3. When prompted, set the password for `postgres` user (e.g., `postgres`)
4. Remember the port (default is `5432`)
5. During installation, keep the default settings

### Option 2: Use PostgreSQL in WSL (Windows Subsystem for Linux)
If you have WSL2 installed:
```bash
wsl
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

## Local Development Setup

### 1. Start PostgreSQL Server
**Windows (via pgAdmin or Services):**
- Open Services app → find PostgreSQL service → Start it
- Or use: `pg_ctl -D "C:\Program Files\PostgreSQL\17\data" start`

**WSL:**
```bash
wsl
sudo service postgresql start
```

### 2. Create Database
**Via psql:**
```bash
psql -U postgres -c "CREATE DATABASE qrrestaurant;"
```

**Or via pgAdmin GUI:**
- Open pgAdmin → Servers → PostgreSQL → Databases
- Right-click "Databases" → Create → Database
- Name: `qrrestaurant`
- Click Save

### 3. Load Initial Schema
```bash
# Windows
psql -U postgres -d qrrestaurant -f "c:\Users\DT\Documents\qr-restaurant-ai\qrrestaurant.sql"

# WSL
psql -U postgres -d qrrestaurant -f ~/qr-restaurant-ai/qrrestaurant.sql
```

### 4. Configure .env
The `.env` file has been created with the default connection string:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/qrrestaurant
```

If you used a different password or port, update this accordingly.

### 5. Start the Backend Server
```bash
cd c:\Users\DT\Documents\qr-restaurant-ai
npm run dev
```

You should see:
```
🚀 Backend running on http://localhost:10000
```

## Troubleshooting

### "Connection refused" error
- Check if PostgreSQL service is running
- Verify the DATABASE_URL in .env matches your setup
- On Windows, ensure pg_sql port is 5432 (or update .env)

### "Database does not exist" error
- Run the "Create Database" step above
- Verify database name is `qrrestaurant`

### psql command not found
- Add PostgreSQL bin folder to your PATH: `C:\Program Files\PostgreSQL\17\bin`
- Restart terminal after adding to PATH

## Next Steps
Once the server is running:
1. Navigate to http://localhost:10000
2. Login with test credentials from `backend/README.txt`
3. Start managing your restaurant!

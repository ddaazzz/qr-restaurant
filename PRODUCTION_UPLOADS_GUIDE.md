# Uploading Images to Production (chuio.io)

## Current Setup - How It Works

✅ **Good News:** Your system is already configured to auto-detect localhost vs chuio.io!

### Frontend API Configuration (Already Set)
In [admin.js](frontend/admin.js#L10):
```javascript
var API = window.location.hostname === "localhost" 
  ? "http://localhost:10000/api" 
  : "https://chuio.io/api";
```

This means:
- On **localhost**: API calls go to `http://localhost:10000/api`
- On **chuio.io**: API calls go to `https://chuio.io/api`
- **No code changes needed!** The frontend automatically detects where it's running

### Backend Upload Serving (Already Set)
In [backend/src/app.ts](backend/src/app.ts#L70-L72):
```typescript
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/uploads", express.static("uploads"));
```

This serves files from the `uploads/` folder to both:
- `http://localhost:10000/uploads/...`
- `https://chuio.io/uploads/...`

## How File Paths Work

### File Storage
When you upload a restaurant logo on chuio.io:
1. File saved to: `backend/uploads/restaurants/{restaurantId}/logo.jpg`
2. Path stored in DB: `/uploads/restaurants/{restaurantId}/logo.jpg`
3. URL accessed as: `https://chuio.io/uploads/restaurants/{restaurantId}/logo.jpg`

### Upload Flow
```
Frontend (chuio.io)
    ↓
POST /api/restaurants/{id}/logo (to chuio.io/api)
    ↓
Backend receives upload
    ↓
Saves to: uploads/restaurants/{restaurantId}/filename.jpg
    ↓
Stored path in DB: /uploads/restaurants/{restaurantId}/filename.jpg
    ↓
Frontend loads: https://chuio.io/uploads/restaurants/{restaurantId}/filename.jpg
```

## Deployment Checklist

✅ **Code is Production-Ready**

To make uploads work on chuio.io:

1. **Ensure `uploads/` folder exists on production server**
   ```bash
   mkdir -p backend/uploads/restaurants
   chmod 755 backend/uploads
   ```

2. **The folder structure is created automatically** when you upload:
   - `uploads/restaurants/{restaurantId}/` ← created automatically
   - `uploads/restaurants/{restaurantId}/menu/` ← created automatically

3. **Verify backend environment variables**
   - `PORT` should be set (or defaults to 10000)
   - `DATABASE_URL` should point to production database

4. **File permissions** (on Linux/Mac production servers)
   ```bash
   # Allow backend to write uploads
   chmod 755 backend/uploads
   chmod 755 backend/uploads/restaurants
   ```

## Troubleshooting

### Issue: Uploads work on localhost but fail on chuio.io

**Check 1: Is `/uploads` folder writable on production?**
```bash
# SSH into production server
cd /path/to/qr-restaurant-ai/backend
ls -la uploads/  # Should have drwxr-xr-x permissions
```

**Check 2: Are file paths CORS-accessible?**
- Open browser DevTools on chuio.io
- Check Network tab for `/uploads/...` requests
- Should return 200 status

**Check 3: Does backend have access to uploads folder?**
- SSH to production
- Run: `npm run build && npm start`
- Try uploading a test image
- Check: `ls -la backend/uploads/restaurants/*/`

### Issue: Image URLs show as `http://localhost` on production

**This shouldn't happen** because:
- Frontend API detection is automatic
- URL paths stored in DB are relative: `/uploads/restaurants/{id}/...`
- Browser converts to full URL: `https://chuio.io/uploads/restaurants/{id}/...`

If it does happen:
1. Check [admin.js line 10](frontend/admin.js#L10) - API variable
2. Check database - are paths stored as `/uploads/...` (not `http://...`)?
3. Run: `SELECT logo_url, background_url FROM restaurants LIMIT 1;`

## Quick Test on chuio.io

1. Log in to admin dashboard on chuio.io
2. Go to **Settings** → **Restaurant Info**
3. Upload a logo image
4. Should save to: `backend/uploads/restaurants/{id}/filename.jpg`
5. View page source → find image URL → should be `/uploads/restaurants/{id}/filename.jpg`
6. Image should display correctly

## For Render Deployment

If deploying on Render:

**Important:** Render ephemeral filesystem resets on deployment!

**Solution:** Use Render Disk to persist uploads

```yaml
# render.yaml or Render dashboard settings
services:
  - type: web
    name: qr-restaurant
    envVars:
      - key: UPLOADS_PATH
        value: /var/data/uploads
    disk:
      name: uploads_storage
      path: /var/data/uploads
      sizeGb: 10
```

Then in backend, update app.ts to use `UPLOADS_PATH`:
```typescript
const uploadsPath = process.env.UPLOADS_PATH || path.join(__dirname, "../uploads");
app.use("/uploads", express.static(uploadsPath));
```

## S3 Alternative (For Scalability)

For large-scale production, consider S3 storage:

1. Install: `npm install aws-sdk`
2. Configure multer with S3 storage
3. Files upload directly to S3
4. Serve from S3 CDN URLs

Example:
```typescript
// backend/src/config/upload.ts - S3 version
import S3Storage from 'multer-s3';
import AWS from 'aws-sdk';

const s3 = new AWS.S3();
const storage = S3Storage({
  s3: s3,
  bucket: 'chuio-uploads',
  key: (req, file, cb) => {
    const restaurantId = req.params.restaurantId || req.params.id;
    const key = `restaurants/${restaurantId}/${Date.now()}-${file.originalname}`;
    cb(null, key);
  }
});
```

## Summary

✅ **Your system is already configured for multi-environment support**

- Frontend API auto-detects localhost vs production
- Backend serves uploads from both environments
- File paths are stored relative (no hardcoded URLs)
- Just ensure `/uploads` folder is writable on production

**No code changes needed to make uploads work on chuio.io!**

Just deploy and test. The system will automatically route all API calls to the correct domain and serve images from the correct location.

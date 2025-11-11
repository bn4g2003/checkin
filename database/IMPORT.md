# Import Sample Data to Firebase

## Cách 1: Manual Import (Recommended for testing)

1. Truy cập Firebase Console: https://console.firebase.google.com/
2. Chọn project "chamcongkama"
3. Vào "Realtime Database" 
4. Click vào icon "..." → "Import JSON"
5. Chọn file `sample-data.json`
6. Click "Import"

## Cách 2: Firebase CLI Import

```bash
# Cài đặt Firebase CLI (nếu chưa có)
npm install -g firebase-tools

# Login vào Firebase
firebase login

# Set project 
firebase use chamcongkama

# Import data
firebase database:set / sample-data.json

# Hoặc import từng collection
firebase database:set /employees sample-data.json -y --data employees
firebase database:set /companyWifis sample-data.json -y --data companyWifis
firebase database:set /workSettings sample-data.json -y --data workSettings
```

## Cách 3: REST API Import (cho automation)

```bash
# Set database URL
DB_URL="https://chamcongkama-default-rtdb.asia-southeast1.firebasedatabase.app"

# Import full data
curl -X PUT \
  -H "Content-Type: application/json" \
  -d @sample-data.json \
  "$DB_URL/.json"

# Import employees only
curl -X PUT \
  -H "Content-Type: application/json" \
  -d @sample-data.json \
  "$DB_URL/employees.json" \
  --data-raw "$(jq .employees sample-data.json)"
```

## Deploy Rules

```bash
# Deploy database rules
firebase deploy --only database

# Hoặc chỉ deploy rules
firebase database:rules:deploy database.rules.json
```

## Verify Data

After import, check:
1. Go to Firebase Console → Realtime Database
2. Verify structure matches schema
3. Test read/write operations
4. Check indexing is working

## Clean Up (if needed)

```bash
# Clear all data
firebase database:remove /

# Clear specific collection  
firebase database:remove /checkins
firebase database:remove /employees
```
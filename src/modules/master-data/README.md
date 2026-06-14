# Master Data Module

Modul ini menyediakan API untuk mengambil data referensi dari Satu Sehat, termasuk provinsi, kota, district, dan sub-district dengan OAuth global yang dapat digunakan untuk semua Satu Sehat API calls.

## Features

- ✅ Global OAuth Management - token caching otomatis per environment
- ✅ Provinces API - ambil data provinsi
- ✅ Cities API - ambil data kota berdasarkan kode provinsi
- ✅ Districts API - ambil data district berdasarkan kode kota
- ✅ Sub-Districts API - ambil data sub-district berdasarkan kode district

## Endpoints

### 1. Get Provinces
Mengambil daftar provinsi dari Satu Sehat

```
GET /api/master-data/provinces
Query Parameters (optional):
  - codes: string (contoh: "11,12")
```

**Response:**
```json
{
  "status": 200,
  "error": false,
  "message": "success",
  "data": [
    {
      "code": "11",
      "parent_code": "",
      "bps_code": "11",
      "name": "Aceh"
    },
    {
      "code": "12",
      "parent_code": "",
      "bps_code": "12",
      "name": "Sumatera Utara"
    }
  ]
}
```

### 2. Get Cities
Mengambil daftar kota/kabupaten dari Satu Sehat

```
GET /api/master-data/cities
Query Parameters (optional):
  - province_codes: string (contoh: "31,32")
```

**Response:**
```json
{
  "status": 200,
  "error": false,
  "message": "success",
  "data": [
    {
      "code": "3101",
      "parent_code": "31",
      "bps_code": "3101",
      "name": "Jakarta Pusat"
    }
  ]
}
```

### 3. Get Districts
Mengambil daftar district dari Satu Sehat

```
GET /api/master-data/districts
Query Parameters (optional):
  - city_codes: string (contoh: "3101,3102")
```

**Response:**
```json
{
  "status": 200,
  "error": false,
  "message": "success",
  "data": [
    {
      "code": "310101",
      "parent_code": "3101",
      "bps_code": "310101",
      "name": "Gambir"
    }
  ]
}
```

### 4. Get Sub-Districts
Mengambil daftar sub-district dari Satu Sehat

```
GET /api/master-data/sub-districts
Query Parameters (optional):
  - district_codes: string (contoh: "310101,310102")
```

**Response:**
```json
{
  "status": 200,
  "error": false,
  "message": "success",
  "data": [
    {
      "code": "3101011",
      "parent_code": "310101",
      "bps_code": "3101011",
      "name": "Gambir"
    }
  ]
}
```

## Configuration

Tambahkan environment variables berikut di `.env`:

```env
# Satu Sehat Global OAuth (for Master Data APIs)
SATUSEHAT_GLOBAL_CLIENT_ID=your-client-id
SATUSEHAT_GLOBAL_CLIENT_SECRET=your-client-secret
SATUSEHAT_ENVIRONMENT=sandbox  # atau production
```

## Architecture

### Global OAuth Service (`SatusehatGlobalOauthService`)

Service ini mengelola autentikasi OAuth2 untuk semua Satu Sehat API calls dengan:

- **Token Caching**: Token di-cache secara in-memory dan otomatis refresh 30 menit sebelum expired
- **Environment Support**: Mendukung sandbox dan production environments
- **Automatic Refresh**: Token otomatis di-refresh ketika expired

### Master Data Service (`MasterDataService`)

Service ini menghandle semua panggilan ke Satu Sehat Master Data APIs dengan:

- **Consistent Interface**: Semua metode menggunakan pola yang sama
- **Error Handling**: Error handling yang robust dengan logging
- **Token Management**: Menggunakan global OAuth untuk semua requests

## Usage Example

### Using cURL

```bash
# Get all provinces
curl -X GET "http://localhost:3000/api/master-data/provinces"

# Get specific provinces
curl -X GET "http://localhost:3000/api/master-data/provinces?codes=11,12"

# Get cities in a province
curl -X GET "http://localhost:3000/api/master-data/cities?province_codes=31"

# Get districts in a city
curl -X GET "http://localhost:3000/api/master-data/districts?city_codes=3101"

# Get sub-districts
curl -X GET "http://localhost:3000/api/master-data/sub-districts?district_codes=310101"
```

### Using NestJS Injection

```typescript
import { MasterDataService } from './master-data.service';

export class MyService {
  constructor(private readonly masterDataService: MasterDataService) {}

  async findCities() {
    return this.masterDataService.getCities('31'); // Jakarta
  }
}
```

## Error Handling

Semua endpoints akan mengembalikan error jika:

1. **OAuth Credentials Not Configured**: Pastikan `SATUSEHAT_GLOBAL_CLIENT_ID` dan `SATUSEHAT_GLOBAL_CLIENT_SECRET` sudah dikonfigurasi
2. **Satu Sehat API Error**: Jika Satu Sehat API tidak responding atau error
3. **Invalid Parameters**: Query parameters yang tidak valid akan diteruskan ke Satu Sehat API

## Access Control

Semua endpoints di Master Data Module adalah **public** (tidak memerlukan authentication) menggunakan `@Public()` decorator karena data ini adalah referensi publik.

## Future Enhancements

- [ ] Add caching di Redis untuk mengurangi API calls ke Satu Sehat
- [ ] Add pagination support untuk data sets yang besar
- [ ] Add filtering dan searching capabilities
- [ ] Add versioning support (v1, v2)

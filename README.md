# RentMate AI

Rental housing search platform with an LLM-powered assistant (engineering thesis, Collegium Da Vinci).

- **backend/** — Node.js, Express 5, TypeScript, Prisma 7 (PostgreSQL), OpenRouter (function calling)
- **frontend/** — React + TypeScript (in progress)

## Run locally

```bash
docker compose up -d              # PostgreSQL + PostGIS (needs root .env with POSTGRES_* and DB_PORT)
cd backend
cp .env.example .env              # fill in DATABASE_URL, JWT_SECRET, OPENROUTER_API_KEY
npm install                       # also runs prisma generate
npm run migrate                   # apply migrations
npm run seed                      # 42 listings + test users (password: password123)
npm run dev                       # http://localhost:4100
```

Test users: `tenant@rentmate.dev`, `landlord1@rentmate.dev`, `landlord2@rentmate.dev`, `admin@rentmate.dev`.

## API

Errors always look like `{ "message": "..." }`. Auth = header `Authorization: Bearer <token>`.

### Health
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | – | `{ status, ai }` (`ai` = OpenRouter key configured) |
| GET | `/health/db` | – | `{ status, users }` |

### Auth
| Method | Path | Auth | Body / response |
|---|---|---|---|
| POST | `/auth/register` | – | `{ email, password (≥8), role? (TENANT\|LANDLORD) }` → 201 `{ token, user }` |
| POST | `/auth/login` | – | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | any | current user |

### Listings
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/listings` | – | filters below, → `{ items, total, page, limit }` |
| GET | `/listings/recommended` | TENANT | same filters, ranked by your preferences → `{ personalized, results: [{ listing, score, reasons, warnings }] }` |
| GET | `/listings/mine` | LANDLORD | your listings |
| GET | `/listings/:id` | – | |
| POST | `/listings` | LANDLORD | required: `title, description, propertyType, city, address, price, area, rooms, latitude, longitude` |
| PATCH | `/listings/:id` | owner/ADMIN | any create field + `status` |
| DELETE | `/listings/:id` | owner/ADMIN | 204, deletes its bookings too |

Filters (query): `city, neighborhood, propertyType (APARTMENT|ROOM|STUDIO|HOUSE), status (default AVAILABLE), minPrice, maxPrice, minRooms, maxRooms, rooms, minArea, maxArea, petsAllowed, smokingAllowed, furnished, hasBalcony, hasParking, hasElevator, utilitiesIncluded, remoteWorkFriendly, availableFrom (date)`.
Paging: `page` (default 1), `limit` (default 20, max 50), `sort` (`newest|price_asc|price_desc|area_desc`).

### Preferences (tenant search profile)
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/preferences/me` | TENANT | 404 if not filled in |
| PUT | `/preferences/me` | TENANT | upsert; fields: `wantsPetsAllowed, wantsSmokingAllowed, wantsRemoteWork, desiredPropertyType, desiredCity, desiredNeighborhood, moveInDate, minPrice, maxPrice, minArea, maxArea, minRooms` |

### Bookings (viewing requests)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/bookings` | TENANT | `{ listingId, viewingDate (future), comment? }` → 201 |
| GET | `/bookings/my` | TENANT | your requests |
| GET | `/bookings/incoming` | LANDLORD | requests for your listings (with tenant contact) |
| PATCH | `/bookings/:id` | involved user | `{ status }`: landlord → CONFIRMED/CANCELLED/COMPLETED, tenant → CANCELLED |

### AI (OpenRouter, rate limited 10 req/min per IP)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/ai/search` | optional | `{ query, history?, previousFilters? }` → `{ query, filters, reply, personalized, total, results }` |
| POST | `/ai/listings/:id/ask` | – | `{ question, history? }` → `{ answer }` (answers only from listing data) |

`history` = `[{ role: "user" \| "assistant", content }]` (last 10 kept). `previousFilters` = the `filters` object from the previous `/ai/search` response, lets the user refine ("cheaper", "with a balcony").
503 if no API key, 502 if the provider fails, 429 if rate limited.

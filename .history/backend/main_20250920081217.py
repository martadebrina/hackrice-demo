# backend/main.py
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
import httpx
from pymongo import MongoClient
from bson import ObjectId
from pydantic_settings import BaseSettings
import os

# --- Settings from .env ---
class Settings(BaseSettings):
    MONGODB_URI: str
    AUTH0_DOMAIN: str
    AUTH0_AUDIENCE: str
    PORT: int = 8080
    class Config:
        env_file = ".env"

settings = Settings()

# --- App & CORS ---
app = FastAPI(title="Peerfect API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon-friendly
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MongoDB ---
client = MongoClient(settings.MONGODB_URI)
db = client.get_default_database()  # uses default DB from the URI

# --- Auth0 helper ---
async def get_jwks():
    url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=5) as s:
        r = await s.get(url)
        r.raise_for_status()
        return r.json()

async def auth_user(req: Request):
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = auth.split()[1]

    # Get unverified header to find KID
    unverified = jwt.get_unverified_header(token)
    jwks = await get_jwks()
    key = next((k for k in jwks["keys"] if k.get("kid") == unverified.get("kid")), None)
    if not key:
        raise HTTPException(401, "Signing key not found")

    public_key = jwt.construct_rsa_public_key(key)
    try:
        payload = jwt.decode(
            token,
            public_key,
            audience=settings.AUTH0_AUDIENCE,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
            algorithms=["RS256"],
        )
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {e}")
    return payload  # contains email, name, sub, etc.

# --- Health ---
@app.get("/health")
def health():
    return {"ok": True}

# --- Create/find user on first login ---
@app.get("/me")
async def me(user=Depends(auth_user)):
    email = user.get("email")
    if not email:
        raise HTTPException(400, "No email in token")
    u = db.users.find_one({"email": email})
    if not u:
        u = {
            "email": email,
            "name": user.get("name"),
            "points": 100,
            "courses": [],
            "rating": 5,
            "createdAt": datetime.utcnow(),
        }
        db.users.insert_one(u)
    u["_id"] = str(u["_id"])
    return u

# --- List open/accepted/completed requests ---
@app.get("/requests")
async def list_requests(status: str = "open", user=Depends(auth_user)):
    docs = list(db.requests.find({"status": status}).sort("createdAt", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
        if d.get("studentId") and isinstance(d["studentId"], ObjectId):
            d["studentId"] = str(d["studentId"])
        if d.get("tutorId") and isinstance(d["tutorId"], ObjectId):
            d["tutorId"] = str(d["tutorId"])
    return docs

# --- Create a request ---
@app.post("/requests")
async def create_request(payload: dict, user=Depends(auth_user)):
    email = user.get("email")
    student = db.users.find_one({"email": email})
    if not student:
        raise HTTPException(400, "User not found")

    course = (payload.get("course") or "").strip()
    topic = (payload.get("topic") or "").strip()
    points = int(payload.get("pointsOffered") or 20)
    if not course or not topic:
        raise HTTPException(400, "course and topic are required")
    if points <= 0:
        raise HTTPException(400, "pointsOffered must be > 0")

    doc = {
        "studentId": student["_id"],
        "course": course,
        "topic": topic,
        "pointsOffered": points,
        "status": "open",
        "tutorId": None,
        "link": None,
        "createdAt": datetime.utcnow(),
    }
    r = db.requests.insert_one(doc)
    return {"_id": str(r.inserted_id)}

# --- Accept a request ---
@app.post("/requests/{rid}/accept")
async def accept_request(rid: str, user=Depends(auth_user)):
    email = user.get("email")
    tutor = db.users.find_one({"email": email})
    if not tutor:
        raise HTTPException(400, "User not found")

    res = db.requests.update_one(
        {"_id": ObjectId(rid), "status": "open"},
        {"$set": {"status": "accepted", "tutorId": tutor["_id"], "link": "https://meet.jit.si/peerfect-demo"}},
    )
    if not res.modified_count:
        raise HTTPException(400, "Cannot accept (already accepted or not found)")
    return {"ok": True}

# --- Complete a request (simple transfer) ---
@app.post("/requests/{rid}/complete")
async def complete_request(rid: str, user=Depends(auth_user)):
    r = db.requests.find_one({"_id": ObjectId(rid)})
    if not r or r.get("status") != "accepted":
        raise HTTPException(400, "Request is not in accepted state")

    student = db.users.find_one({"_id": r["studentId"]})
    tutor = db.users.find_one({"_id": r["tutorId"]})
    if not student or not tutor:
        raise HTTPException(400, "Participants missing")
    pts = int(r["pointsOffered"])
    if student["points"] < pts:
        raise HTTPException(400, "Insufficient student points")

    db.users.update_one({"_id": student["_id"]}, {"$inc": {"points": -pts}})
    db.users.update_one({"_id": tutor["_id"]}, {"$inc": {"points":  pts}})
    db.requests.update_one({"_id": r["_id"]}, {"$set": {"status": "completed"}})
    return {"ok": True}

# backend/main.py
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt 
from pymongo import MongoClient
from bson import ObjectId
from pathlib import Path
from dotenv import load_dotenv 
from pydantic_settings import BaseSettings
import httpx
from typing import Optional
import asyncio, json
from fastapi.responses import StreamingResponse
from typing import Dict, Any

# Always load the .env that sits beside this file
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

subscribers: set[asyncio.Queue] = set()

async def broadcast(evt: Dict[str, Any]):
    # fan-out to all subscribers
    dead = []
    for q in list(subscribers):
        try:
            q.put_nowait(evt)
        except Exception:
            dead.append(q)
    for q in dead:
        subscribers.discard(q)

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
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MongoDB ---
client = MongoClient(settings.MONGODB_URI)
# Extract database name from URI or use a default
from urllib.parse import urlparse
parsed_uri = urlparse(settings.MONGODB_URI)
if parsed_uri.path and parsed_uri.path != "/":
    db_name = parsed_uri.path.lstrip("/")
else:
    db_name = "PeerfectDB"  # fallback default, change as needed
db = client[db_name]

# --- Auth0 helper ---
async def get_userinfo_from_auth0(access_token: str):
    url = f"https://{settings.AUTH0_DOMAIN}/userinfo"
    async with httpx.AsyncClient(timeout=5) as s:
        r = await s.get(url, headers={"Authorization": f"Bearer {access_token}"})
        r.raise_for_status()
        return r.json()  # typically has: sub, email, name, nickname, picture

async def get_jwks():
    url = f"https://{settings.AUTH0_DOMAIN}/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=5) as s:
        r = await s.get(url)
        r.raise_for_status()
        return r.json()

async def auth_user(req: Request):
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        # try query param for SSE
        token = req.query_params.get("access_token")
        if not token:
            raise HTTPException(401, "Missing token")
    else:
        token = auth.split()[1]

    # --- verify the JWT signature against Auth0 JWKS
    unverified = jwt.get_unverified_header(token)
    jwks = await get_jwks()
    key = next((k for k in jwks["keys"] if k.get("kid") == unverified.get("kid")), None)
    if not key:
        raise HTTPException(401, "Signing key not found")

    # python-jose can accept a JWK dict for RS256 verification
    try:
        payload = jwt.decode(
            token,
            key,  # pass the JWK dict
            audience=settings.AUTH0_AUDIENCE,
            issuer=f"https://{settings.AUTH0_DOMAIN}/",
            algorithms=["RS256"],
        )
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {e}")

    # --- ensure we have email/name; fetch from /userinfo if missing
    email = payload.get("email")
    name = payload.get("name")
    if not email or not name:
        try:
            ui = await get_userinfo_from_auth0(token)
            if not email:
                email = ui.get("email")
            if not name:
                name = ui.get("name") or ui.get("nickname")
            if email:
                payload["email"] = email
            if name:
                payload["name"] = name
        except Exception:
            # If userinfo call fails we proceed; /me will still error if email is required
            pass

    return payload

# --- Health ---
@app.get("/health")
def health():
    return {"ok": True}

# --- Create/find user on first login ---
@app.get("/me")
async def me(user=Depends(auth_user)):
    sub = user.get("sub")
    if not sub:
        raise HTTPException(400, "No sub in token")

    u = db.users.find_one({"auth0Sub": sub})
    if not u:
        email = user.get("email")
        if email:
            old = db.users.find_one({"email": email})
            if old:
                db.users.update_one(
                    {"_id": old["_id"]},
                    {"$set": {
                        "auth0Sub": sub,
                        "email": email,
                        "name": user.get("name"),
                    }}
                )
                u = db.users.find_one({"_id": old["_id"]})

    if not u:
        u = {
            "auth0Sub": sub,
            "email": user.get("email"),
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
async def list_requests(status: str = "open", mine: Optional[int] = 0, user=Depends(auth_user)):
    q = {"status": status}
    if mine:
        me = db.users.find_one({"auth0Sub": user.get("sub")})
        if not me:
            raise HTTPException(400, "User not found")
        q["$or"] = [{"studentId": me["_id"]}, {"tutorId": me["_id"]}]
    docs = list(db.requests.find(q).sort("createdAt", -1))
    for d in docs:
        d["_id"] = str(d["_id"])
        if isinstance(d.get("studentId"), ObjectId):
            d["studentId"] = str(d["studentId"])
        if isinstance(d.get("tutorId"), ObjectId):
            d["tutorId"] = str(d["tutorId"])
    return docs

# --- Create a request ---
@app.post("/requests")
async def create_request(payload: dict, user=Depends(auth_user)):
    sub = user.get("sub")
    student = db.users.find_one({"auth0Sub": sub})
    if not student:
        raise HTTPException(400, "User not found")

    course = (payload.get("course") or "").strip()
    topic  = (payload.get("topic")  or "").strip()
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
    await broadcast({"type": "request:created", "rid": str(r.inserted_id)})
    return {"_id": str(r.inserted_id)}


# --- Accept a request ---
# --- Accept a request (cannot accept your own) ---
@app.post("/requests/{rid}/accept")
async def accept_request(rid: str, user=Depends(auth_user)):
    tutor = db.users.find_one({"auth0Sub": user.get("sub")})
    if not tutor:
        raise HTTPException(400, "User not found")

    req = db.requests.find_one({"_id": ObjectId(rid)})
    if not req:
        raise HTTPException(404, "Request not found")
    if req.get("status") != "open":
        raise HTTPException(400, "Request is not open")

    # 🚫 block accepting own request
    if req.get("studentId") == tutor["_id"]:
        raise HTTPException(403, "You cannot accept your own request")

    res = db.requests.update_one(
        {"_id": req["_id"], "status": "open"},
        {"$set": {
            "status": "accepted",
            "tutorId": tutor["_id"],
            "link": "https://meet.jit.si/peerfect-demo"
        }},
    )
    if not res.modified_count:
        raise HTTPException(400, "Cannot accept (race or already accepted)")
    return {"ok": True}


# --- Complete a request (simple transfer) ---
# --- Complete a request (only student can complete) ---
@app.post("/requests/{rid}/complete")
async def complete_request(rid: str, user=Depends(auth_user)):
    # who is calling?
    caller = db.users.find_one({"auth0Sub": user.get("sub")})
    if not caller:
        raise HTTPException(400, "User not found")

    r = db.requests.find_one({"_id": ObjectId(rid)})
    if not r or r.get("status") != "accepted":
        raise HTTPException(400, "Request is not in accepted state")

    # ✅ only the creator (student) may complete
    if r["studentId"] != caller["_id"]:
        raise HTTPException(403, "Only the student who created this request can complete it")

    student = db.users.find_one({"_id": r["studentId"]})
    tutor   = db.users.find_one({"_id": r["tutorId"]})
    if not student or not tutor:
        raise HTTPException(400, "Participants missing")

    # coerce ints
    pts   = int(r.get("pointsOffered", 0))
    s_pts = int(student.get("points", 0))
    t_pts = int(tutor.get("points", 0))
    if pts <= 0:
        raise HTTPException(400, "pointsOffered must be > 0")
    if s_pts < pts:
        raise HTTPException(400, "Insufficient student points")

    # transfer with explicit totals
    s_new = s_pts - pts
    t_new = t_pts + pts
    db.users.update_one({"_id": student["_id"]}, {"$set": {"points": s_new}})
    db.users.update_one({"_id": tutor["_id"]},   {"$set": {"points": t_new}})
    db.requests.update_one({"_id": r["_id"]},    {"$set": {"status": "completed"}})

    # tell the caller (student) their fresh points
    return {
        "ok": True,
        "transferred": pts,
        "studentId": str(student["_id"]),
        "tutorId": str(tutor["_id"]),
        "studentPoints": s_new,
        "tutorPoints": t_new,
        "callerPoints": s_new,  # caller is the student by rule
    }

# Event
@app.get("/events")
async def sse_events(user=Depends(auth_user)):
    """
    Server-Sent Events stream. Client connects via EventSource(`${API}/events?access_token=...`).
    """
    queue: asyncio.Queue = asyncio.Queue()
    subscribers.add(queue)

    async def event_stream():
        try:
            # immediate hello so client knows we’re live
            yield "event: hello\ndata: {}\n\n"
            # keepalive pings + forward real events
            ping_task = asyncio.create_task(_keepalive(queue))
            while True:
                evt = await queue.get()
                yield f"data: {json.dumps(evt)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            subscribers.discard(queue)

    async def _keepalive(q: asyncio.Queue):
        while True:
            await asyncio.sleep(25)
            try:
                q.put_nowait({"type": "ping"})
            except Exception:
                return

    return StreamingResponse(event_stream(), media_type="text/event-stream")

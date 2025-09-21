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
from pymongo import ReturnDocument
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi import Body
from typing import Literal

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

try:
    client.admin.command("ping")
    print("✅ Mongo connected")
except Exception as e:
    print("❌ Mongo connect failed:", e)
    # optionally: raise

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

def _oid(x):  # tiny helper to coerce string->ObjectId safely
    return x if isinstance(x, ObjectId) else ObjectId(x)

def _user_or_404(user):
    u = db.users.find_one({"auth0Sub": user.get("sub")})
    if not u: raise HTTPException(400, "User not found")
    return u

def _ensure_participant(req, uid: ObjectId):
    if req.get("studentId") != uid and req.get("tutorId") != uid:
        raise HTTPException(403, "Not a participant of this request")

# --- List schedules for a request ---
@app.get("/requests/{rid}/schedules")
async def list_schedules(rid: str, user=Depends(auth_user)):
    me = _user_or_404(user)
    req = db.requests.find_one({"_id": ObjectId(rid)})
    if not req: raise HTTPException(404, "Request not found")
    _ensure_participant(req, me["_id"])
    scheds = req.get("schedules", [])
    # stringify ObjectIds for JSON
    def _cast(s):
        s = dict(s)
        s["_id"] = str(s["_id"])
        s["proposerId"] = str(s["proposerId"])
        if s.get("decidedById"): s["decidedById"] = str(s["decidedById"])
        return s
    return list(map(_cast, scheds))

# --- Propose a schedule ---
@app.post("/requests/{rid}/schedules")
async def propose_schedule(
    rid: str,
    payload: dict = Body(...),  # {start, end, note?}
    user=Depends(auth_user),
):
    me = _user_or_404(user)
    req = db.requests.find_one({"_id": ObjectId(rid)})
    if not req: raise HTTPException(404, "Request not found")
    # Allow proposing when request is open or accepted
    if req.get("status") not in {"open", "accepted"}:
        raise HTTPException(400, "Scheduling only allowed for open/accepted requests")
    _ensure_participant(req, me["_id"])

    start = (payload.get("start") or "").strip()
    end   = (payload.get("end") or "").strip()
    note  = (payload.get("note") or "").strip()
    if not start or not end:
        raise HTTPException(400, "start and end (ISO 8601) are required")

    sched = {
        "_id": ObjectId(),
        "proposerId": me["_id"],
        "start": start,   # keep as ISO strings to avoid TZ headaches client-side
        "end": end,
        "note": note,
        "status": "proposed",
        "decidedById": None,
        "createdAt": datetime.utcnow(),
        "decidedAt": None,
    }

    db.requests.update_one({"_id": req["_id"]}, {"$push": {"schedules": sched}})
    await broadcast({"type": "schedule:proposed", "rid": rid})
    # return casted
    sched["__rid"] = rid
    sched["_id"] = str(sched["_id"])
    sched["proposerId"] = str(sched["proposerId"])
    return sched

# --- Accept / Decline a schedule ---
@app.post("/requests/{rid}/schedules/{sid}")
async def decide_schedule(
    rid: str,
    sid: str,
    payload: dict = Body(...),  # { action: "accept" | "decline" }
    user=Depends(auth_user),
):
    me = _user_or_404(user)
    req = db.requests.find_one({"_id": ObjectId(rid)})
    if not req: raise HTTPException(404, "Request not found")
    _ensure_participant(req, me["_id"])

    action: str = (payload.get("action") or "").lower()
    if action not in {"accept", "decline"}:
        raise HTTPException(400, "action must be 'accept' or 'decline'")

    # Only allow the *other* participant to accept/decline a proposal
    # (proposer cannot accept their own)
    schedules = req.get("schedules", [])
    target = next((s for s in schedules if str(s["_id"]) == sid), None)
    if not target:
        raise HTTPException(404, "Schedule proposal not found")
    if target.get("status") != "proposed":
        raise HTTPException(400, "Proposal already decided")
    if target.get("proposerId") == me["_id"]:
        raise HTTPException(403, "You cannot decide your own proposal")

    new_status = "accepted" if action == "accept" else "declined"
    # positional array update by matching nested id
    res = db.requests.update_one(
        {"_id": req["_id"], "schedules._id": _oid(sid)},
        {"$set": {
            "schedules.$.status": new_status,
            "schedules.$.decidedById": me["_id"],
            "schedules.$.decidedAt": datetime.utcnow()
        }}
    )
    if not res.modified_count:
        raise HTTPException(400, "Could not update proposal")

    evt = "schedule:accepted" if action == "accept" else "schedule:declined"
    await broadcast({"type": evt, "rid": rid, "sid": sid})

    # If accepted and request was open, optionally auto-accept the request and create link
    if action == "accept" and req.get("status") == "open":
        link = f"https://meet.jit.si/peerfect-{rid}"
        db.requests.update_one({"_id": req["_id"], "status": "open"},
                               {"$set": {"status": "accepted", "link": link, "acceptedAt": datetime.utcnow()},
                                "$setOnInsert": {}})  # harmless if already accepted
        await broadcast({"type":"request:accepted","rid":rid})

    return {"ok": True, "status": new_status}

@app.patch("/me")
async def update_me(payload: dict = Body(...), user=Depends(auth_user)):
    sub = user.get("sub")
    me = db.users.find_one({"auth0Sub": sub})
    if not me:
        raise HTTPException(404, "User not found")

    updates = {}
    if isinstance(payload.get("name"), str):
        n = payload["name"].strip()
        if len(n) > 60: raise HTTPException(400, "Name too long")
        updates["name"] = n or "User"

    if isinstance(payload.get("avatarUrl"), str):
        a = payload["avatarUrl"].strip()
        if len(a) > 500: raise HTTPException(400, "Avatar URL too long")
        updates["avatarUrl"] = a  # empty string clears

    if not updates:
        return {"ok": True, "message": "No changes"}

    updates["updatedAt"] = datetime.utcnow()
    doc = db.users.find_one_and_update(
        {"_id": me["_id"]},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    doc["_id"] = str(doc["_id"])
    return doc

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
                    {
                        "$set": {
                            "auth0Sub": sub,
                            "email": email,
                            "name": user.get("name"),
                        }
                    },
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
async def list_requests(
    status: str = "open", mine: Optional[int] = 0, user=Depends(auth_user)
):
    q = {"status": status}
    if mine:
        me = db.users.find_one({"auth0Sub": user.get("sub")})
        if not me:
            raise HTTPException(400, "User not found")
        q["$or"] = [{"studentId": me["_id"]}, {"tutorId": me["_id"]}]

    docs = list(db.requests.find(q).sort("createdAt", -1))

    # You can keep your manual stringification if you want,
    # but the line below will safely handle ANY remaining ObjectId.
    encoded = jsonable_encoder(docs, custom_encoder={ObjectId: str})
    return JSONResponse(content=encoded)



# --- Create a request ---
@app.post("/requests")
async def create_request(payload: dict, user=Depends(auth_user)):
    sub = user.get("sub")
    student = db.users.find_one({"auth0Sub": sub})
    if not student:
        raise HTTPException(400, "User not found")

    course = (payload.get("course") or "").trim() if hasattr("", "trim") else (payload.get("course") or "").strip()
    topic = (payload.get("topic") or "").strip()
    description = (payload.get("description") or "").strip()   # <— ADD THIS
    raw_points = payload.get("pointsOffered", 20)
    try:
        points = int(raw_points)
    except (TypeError, ValueError):
        raise HTTPException(400, "pointsOffered must be an integer")

    if not course or not topic:
        raise HTTPException(400, "course and topic are required")
    if points <= 0:
        raise HTTPException(400, "pointsOffered must be > 0")

    doc = {
        "studentId": student["_id"],
        "course": course,
        "topic": topic,
        "description": description,            # <— ADD THIS
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
    if not tutor: raise HTTPException(400, "User not found")
    req = db.requests.find_one({"_id": ObjectId(rid)})
    if not req: raise HTTPException(404, "Request not found")
    if req.get("studentId") == tutor["_id"]:
        raise HTTPException(403, "You cannot accept your own request")

    link = f"https://meet.jit.si/peerfect-{rid}"
    res = db.requests.update_one(
        {"_id": ObjectId(rid), "status": "open"},
        {"$set": {"status": "accepted", "tutorId": tutor["_id"], "link": link, "acceptedAt": datetime.utcnow()}}
    )
    if not res.modified_count:
        raise HTTPException(400, "Cannot accept (already accepted)")
    await broadcast({"type":"request:accepted","rid":rid})
    return {"ok": True, "link": link}


# --- Complete a request (simple transfer) ---
# /requests/{rid}/complete  ➜ only student can complete, single-shot
@app.post("/requests/{rid}/complete")
async def complete_request(rid: str, user=Depends(auth_user)):
    caller = db.users.find_one({"auth0Sub": user.get("sub")})
    if not caller: raise HTTPException(400, "User not found")

    # Atomically flip accepted ➜ completed one time only
    r_before = db.requests.find_one_and_update(
        {"_id": ObjectId(rid), "status": "accepted"},
        {"$set": {"status": "completed", "completedAt": datetime.utcnow()}},
        return_document=ReturnDocument.BEFORE,
    )
    if not r_before:
        raise HTTPException(400, "Request is not in accepted state")

    if r_before["studentId"] != caller["_id"]:
        # roll back status if wrong caller
        db.requests.update_one({"_id": ObjectId(rid), "status": "completed"},
                               {"$set": {"status": "accepted"}, "$unset": {"completedAt": ""}})
        raise HTTPException(403, "Only the student who created this request can complete it")

    student = db.users.find_one({"_id": r_before["studentId"]})
    tutor   = db.users.find_one({"_id": r_before["tutorId"]})
    if not student or not tutor: raise HTTPException(400, "Participants missing")

    pts   = int(r_before.get("pointsOffered", 0))
    s_pts = int(student.get("points", 0))
    t_pts = int(tutor.get("points", 0))
    if pts <= 0: raise HTTPException(400, "pointsOffered must be > 0")
    if s_pts < pts: raise HTTPException(400, "Insufficient student points")

    s_new, t_new = s_pts - pts, t_pts + pts
    db.users.update_one({"_id": student["_id"]}, {"$set": {"points": s_new}})
    db.users.update_one({"_id": tutor["_id"]},   {"$set": {"points": t_new}})

    # (Optional) ledger row for audit
    # db.ledger.insert_one({ ... })

    await broadcast({"type":"request:completed","rid":rid})
    await broadcast({"type":"user:points_changed"})

    return {"ok": True, "studentPoints": s_new, "tutorPoints": t_new, "callerPoints": s_new}



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

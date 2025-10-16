"""
FastAPI application exposing RESTful endpoints for the event browsing app.

This module wires together the existing SQLite‑backed data access
functions found in the `backend` package and exposes them through a
simple HTTP API.  Endpoints are provided for listing and creating
events, viewing individual events, updating and deleting events,
toggling RSVP and like status for a given user, and searching events.

The app includes permissive CORS settings so it can be called from
the browser during local development.  In production you should
restrict the allowed origins to your domain (e.g. ``cs350unco.com``).

To run the development server locally use:

    uvicorn backend.main:app --reload

This will start a server on http://127.0.0.1:8000 by default.  The
frontend can then talk to these endpoints under the ``/events`` path.

"""

from __future__ import annotations

import os
import sqlite3
from typing import List, Optional, Any

from fastapi import FastAPI, HTTPException, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .events import create as events_create
from .events import read as events_read
from .events import update as events_update
from .events import soft_delete as events_soft_delete
from .events import hard_delete as events_hard_delete
from .rsvp import rsvp as rsvp_log
from .liking_log import liking_log
from .searching_logic import searching_logic
from .UserAccounts import userAccount



# ---------------------------------------------------------------------------
# FastAPI setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Event Browsing API")
app.include_router(userAccount.router)
# During development it's convenient to allow any origin.  In
# production you should set this to the domain(s) your frontend is
# served from (e.g. ["https://cs350unco.com"]).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class EventResponse(BaseModel):
    """Return representation of an event as consumed by the React frontend."""

    id: int = Field(..., description="Primary key of the event")
    title: str
    description: str
    startDate: str
    endDate: str
    location: str
    category: str
    likes: int
    rsvps: List[int]  # list of accountIDs that RSVPed
    eventAccess: str
    creatorID: int
    price: Optional[float] = None
    rsvpRequired: bool = False
    userLiked: Optional[bool] = False
    userRsvped: Optional[bool] = False
    # Additional optional fields the frontend can choose to display
    # E.g. images, host, etc.  Unused fields are omitted from the response.


class EventCreateRequest(BaseModel):
    """Payload for creating a new event."""

    creatorID: int = Field(..., description="ID of the user creating the event")
    title: str = Field(..., description="Human‑friendly event name")
    description: str = Field(..., description="Detailed description of the event")
    location: str = Field(..., description="Where the event is held")
    eventType: str = Field(..., description="Category/type of the event")
    startDateTime: str = Field(..., description="Start timestamp in YYYY‑MM‑DD HH:MM:SS format")
    endDateTime: str = Field(..., description="End timestamp in YYYY‑MM‑DD HH:MM:SS format")
    eventAccess: Optional[str] = Field(
        "Public", description="Access control: Public, Private or Inactive"
    )
    images: Optional[bytes] = Field(
        None, description="Optional image data – currently unused"
    )
    rsvpRequired: Optional[bool] = Field(
        False, description="Whether attendees must RSVP"
    )
    isPriced: Optional[bool] = Field(
        False, description="If true, the event has a cost"
    )
    cost: Optional[float] = Field(
        None, description="Ticket price if isPriced is true"
    )
    categories: Optional[List[str]] = Field(
        None, description="Additional categories for the event"
    )


class UpdateEventRequest(BaseModel):
    """Payload for updating an event.  Only included fields are modified."""

    updaterID: int = Field(..., description="ID of the user attempting the update")
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    eventType: Optional[str] = None
    startDateTime: Optional[str] = None
    endDateTime: Optional[str] = None
    eventAccess: Optional[str] = None
    images: Optional[bytes] = None
    rsvpRequired: Optional[bool] = None
    isPriced: Optional[bool] = None
    cost: Optional[float] = None


class RSVPRequest(BaseModel):
    user_id: int = Field(..., description="ID of the user performing the RSVP action")


class LikeRequest(BaseModel):
    user_id: int = Field(..., description="ID of the user performing the like action")


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def _get_db_path() -> str:
    """Return the absolute path to the SQLite database."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base_dir, "db", "EventPlannerDB.db")


def _insert_categories(event_id: int, categories: List[str]) -> None:
    """Persist additional categories for an event into the eventCategories table."""
    if not categories:
        return
    db_path = _get_db_path()
    with sqlite3.connect(db_path) as conn:
        cur = conn.cursor()
        for cat in categories:
            cur.execute(
                "INSERT OR IGNORE INTO eventCategories (eventID, category) VALUES (?, ?)",
                (event_id, cat),
            )
        conn.commit()


def _event_to_response(event: dict, user_id: Optional[int] = None) -> EventResponse:
    """Transform a raw DB event row into a response model.

    If ``user_id`` is provided the returned object will include
    ``userLiked`` and ``userRsvped`` flags based on the likesLog and
    rsvpLog tables.  RSVP lists are always returned as lists of
    integers (account IDs).
    """
    eid = event["eventID"]
    # Calculate likes and rsvps dynamically rather than trusting the
    # denormalised numberLikes field.  This ensures consistency with
    # the like and RSVP tables.
    likes_list = liking_log.get_event_likes(eid)
    rsvp_list = rsvp_log.get_event_rsvps(eid)

    user_liked = False
    user_rsvped = False
    if user_id is not None:
        user_liked = user_id in likes_list
        user_rsvped = user_id in rsvp_list

    return EventResponse(
        id=eid,
        title=event["eventName"],
        description=event["eventDescription"],
        startDate=event["startDateTime"],
        endDate=event["endDateTime"],
        location=event["location"],
        category=event["eventType"],
        likes=len(likes_list),
        rsvps=rsvp_list,
        eventAccess=event["eventAccess"],
        creatorID=event["creatorID"],
        price=event.get("cost"),
        rsvpRequired=bool(event.get("rsvpRequired", 0)),
        userLiked=user_liked,
        userRsvped=user_rsvped,
    )


# ---------------------------------------------------------------------------
# Event endpoints
# ---------------------------------------------------------------------------
@app.get("/events", response_model=List[EventResponse])
def list_events(
    include_inactive: bool = Query(False, description="Include events marked as Inactive"),
    user_id: Optional[int] = Query(None, description="ID of current user (for like/RSVP flags)"),
) -> List[EventResponse]:
    """Return a list of events.

    The ``include_inactive`` flag can be set to true to include events
    whose eventAccess is ``Inactive``.  If ``user_id`` is provided the
    returned objects include ``userLiked`` and ``userRsvped`` flags.
    """
    events = events_read.read_events(include_inactive=include_inactive)
    return [_event_to_response(evt, user_id=user_id) for evt in events]


@app.get("/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, user_id: Optional[int] = Query(None)) -> EventResponse:
    """Retrieve a single event by ID."""
    evt = events_read.read_event_by_id(event_id)
    if not evt:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_to_response(evt, user_id=user_id)


@app.post("/events", status_code=status.HTTP_201_CREATED)
def create_event(payload: EventCreateRequest) -> dict[str, Any]:
    """Create a new event and optionally attach additional categories."""
    try:
        eid = events_create.create_event(
            creatorID=payload.creatorID,
            eventName=payload.title,
            eventDescription=payload.description,
            location=payload.location,
            eventType=payload.eventType,
            startDateTime=payload.startDateTime,
            endDateTime=payload.endDateTime,
            eventAccess=payload.eventAccess or "Public",
            images=payload.images,
            rsvpRequired=int(bool(payload.rsvpRequired)),
            isPriced=int(bool(payload.isPriced)),
            cost=payload.cost,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Insert any extra categories into the join table
    if payload.categories:
        _insert_categories(eid, payload.categories)

    return {"eventID": eid}


@app.put("/events/{event_id}")
def update_event(event_id: int, payload: UpdateEventRequest) -> dict[str, Any]:
    """Partially update an existing event.  Only supplied fields are updated."""
    updates: dict[str, Any] = {}
    # Map Pydantic fields to DB column names
    field_map = {
        "title": "eventName",
        "description": "eventDescription",
        "location": "location",
        "eventType": "eventType",
        "startDateTime": "startDateTime",
        "endDateTime": "endDateTime",
        "eventAccess": "eventAccess",
        "images": "images",
        "rsvpRequired": "rsvpRequired",
        "isPriced": "isPriced",
        "cost": "cost",
    }
    for field_name, db_col in field_map.items():
        value = getattr(payload, field_name)
        if value is not None:
            # SQLite doesn't support booleans natively; convert to int where appropriate
            if field_name in {"rsvpRequired", "isPriced"}:
                updates[db_col] = int(bool(value))
            else:
                updates[db_col] = value
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    success = events_update.update_event(event_id, payload.updaterID, updates)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorised or event not found")
    return {"success": True}


@app.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    user_id: int = Query(..., description="ID of the user requesting the delete"),
    hard: bool = Query(False, description="If true, perform a hard delete (Faculty only)"),
) -> dict[str, Any]:
    """Delete an event.  Students can soft delete their own events; faculty can hard delete."""
    if hard:
        success = events_hard_delete.hard_delete_event(event_id, user_id)
    else:
        success = events_soft_delete.soft_delete_event(event_id, user_id)
    if not success:
        raise HTTPException(status_code=403, detail="Not authorised or event not found")
    return {"success": True}


# ---------------------------------------------------------------------------
# RSVP and Like endpoints
# ---------------------------------------------------------------------------
@app.post("/events/{event_id}/rsvp")
def rsvp_event(event_id: int, payload: RSVPRequest) -> dict[str, Any]:
    """Add an RSVP for the given user.  Returns the new RSVP list."""
    added = rsvp_log.add_rsvp(payload.user_id, event_id)
    if not added:
        # Already RSVPed – treat as idempotent success
        pass
    rsvp_list = rsvp_log.get_event_rsvps(event_id)
    return {"rsvps": rsvp_list}


@app.delete("/events/{event_id}/rsvp")
def cancel_rsvp(event_id: int, payload: RSVPRequest) -> dict[str, Any]:
    """Remove an RSVP for the given user."""
    rsvp_log.cancel_rsvp(payload.user_id, event_id)
    rsvp_list = rsvp_log.get_event_rsvps(event_id)
    return {"rsvps": rsvp_list}


@app.post("/events/{event_id}/like")
def like_event(event_id: int, payload: LikeRequest) -> dict[str, Any]:
    """Add a like for the given user.  Returns the new like count."""
    liked = liking_log.add_like(payload.user_id, event_id)
    # Optionally update the denormalised numberLikes column
    if liked:
        db_path = _get_db_path()
        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE events SET numberLikes = numberLikes + 1 WHERE eventID = ?",
                (event_id,),
            )
            conn.commit()
    count = len(liking_log.get_event_likes(event_id))
    return {"likes": count}


@app.delete("/events/{event_id}/like")
def unlike_event(event_id: int, payload: LikeRequest) -> dict[str, Any]:
    """Remove a like for the given user."""
    removed = liking_log.remove_like(payload.user_id, event_id)
    if removed:
        # Decrement numberLikes
        db_path = _get_db_path()
        with sqlite3.connect(db_path) as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE events SET numberLikes = MAX(numberLikes - 1, 0) WHERE eventID = ?",
                (event_id,),
            )
            conn.commit()
    count = len(liking_log.get_event_likes(event_id))
    return {"likes": count}


# ---------------------------------------------------------------------------
# Search endpoint
# ---------------------------------------------------------------------------
@app.get("/search", response_model=List[EventResponse])
def search_events(
    title: Optional[str] = Query(None, description="Title contains this substring"),
    description: Optional[str] = Query(None, description="Description contains this substring"),
    category: Optional[str] = Query(None, description="Match a single category"),
    start_date: Optional[str] = Query(None, description="Earliest start date (YYYY‑MM‑DD)"),
    end_date: Optional[str] = Query(None, description="Latest start date (YYYY‑MM‑DD)"),
    user_id: Optional[int] = Query(None),
) -> List[EventResponse]:
    """Filter events by various optional parameters."""
    events = events_read.read_events()
    # Apply filters in Python rather than SQL for simplicity
    if title:
        events = searching_logic.search_by_title(events, title)
    if description:
        events = searching_logic.search_by_description(events, description)
    if category:
        events = searching_logic.search_by_category(events, [category])
    if start_date and end_date:
        events = searching_logic.search_by_date(events, start_date, end_date)
    elif start_date or end_date:
        # If only one bound provided, treat the other as unbounded
        sd = start_date or "0001-01-01"
        ed = end_date or "9999-12-31"
        events = searching_logic.search_by_date(events, sd, ed)
    return [_event_to_response(evt, user_id=user_id) for evt in events]


# ---------------------------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------------------------
@app.get("/")
def root() -> dict[str, str]:
    """Simple endpoint for load balancers and monitoring."""
    return {"message": "Event Browsing API is running"}
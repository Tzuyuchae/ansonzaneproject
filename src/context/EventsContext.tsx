import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Event } from '../types/Event';

// This context manages event data and syncs with the FastAPI back-end via HTTP.
// Events are fetched from the API and local state is updated for UI responsiveness.
// The API base URL is set by `VITE_API_BASE_URL` in `.env` (default: http://localhost:8000).
const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL ?? 'http://localhost:8000';

interface User {
  id: number;
  [key: string]: any;
}

interface EventsContextProps {
  events: Event[];
  addEvent: (event: Omit<Event, 'id' | 'likes' | 'rsvps' | 'userLiked' | 'userRsvped' | 'createdAt' | 'updatedAt'>) => Promise<string | undefined>;
  updateEvent: (event: Event) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
  toggleRsvp: (id: string) => Promise<void>;
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const EventsContext = createContext<EventsContextProps | undefined>(undefined);

/**
 * Custom hook to access the events context.  Throws an error if used
 * outside of a provider to help developers catch configuration
 * mistakes early.
 */
export const useEvents = (): EventsContextProps => {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error('useEvents must be used within an EventsProvider');
  }
  return context;
};

/**
 * Provider component responsible for maintaining and persisting the
 * application's event state.  Events are stored in localStorage to
 * survive page reloads without a back‑end.  The provider exposes
 * functions for common CRUD operations and for toggling likes and
 * RSVPs.  Whenever the events array changes it is serialized back
 * into localStorage.
 */
export const EventsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  /** Fetch events from the API and update local state.  If a user ID is
   * supplied it will be forwarded to the back‑end so that per‑user
   * ``userLiked`` and ``userRsvped`` flags are included. */
  const fetchEvents = useCallback(async (userId?: number): Promise<void> => {
    try {
      const url = new URL(`${API_BASE_URL}/events`);
      if (userId) {
        url.searchParams.set('user_id', String(userId));
      }
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.error('Failed to fetch events', res.statusText);
        return;
      }
      const data = await res.json();
      // Transform API objects into the front‑end Event shape.  The back‑end
      // returns a list of RSVP account IDs whereas our type uses a simple
      // count.  It also exposes ``category`` as a single string; we store
      // both a ``category`` field (for legacy code) and a ``categories`` array.
      const mapped: Event[] = (data as any[]).map((evt) => {
        const rsvpList: any[] = Array.isArray(evt.rsvps) ? evt.rsvps : [];
        const categories: string[] = evt.categories ?? (evt.category ? [evt.category] : []);
        return {
          id: String(evt.id),
          title: evt.title,
          description: evt.description,
          startDate: evt.startDate,
          endDate: evt.endDate,
          location: evt.location,
          categories,
          // To maintain compatibility with components expecting a singular
          // ``category`` property we mirror the first entry.  This property
          // isn’t defined on the Event interface but is tolerated by
          // consumers using ``as any``.
          category: categories[0],
          likes: Number(evt.likes ?? 0),
          rsvps: rsvpList.length,
          userLiked: Boolean(evt.userLiked),
          userRsvped: Boolean(evt.userRsvped),
          createdAt: evt.startDate,
          updatedAt: evt.endDate ?? evt.startDate,
          price: evt.price,
          rsvpRequired: evt.rsvpRequired,
          isPrivate: evt.eventAccess === 'Private',
          creatorID: evt.creatorID,
          capacity: undefined,
          imageUrl: undefined,
          invitedUserIds: undefined,
          online: undefined,
          distanceMi: undefined,
          lat: undefined,
          lng: undefined,
          host: undefined,
          ticketUrl: undefined,
        } as any;
      });
      setEvents(mapped);
    } catch (err) {
      console.error('Error loading events', err);
    }
  }, []);

  // On mount, fetch events from the back‑end.  You can optionally
  // forward a logged‑in user ID here to receive personalised like/RSVP flags.
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /** Helper to convert a JavaScript date/time value (which may be an ISO
   * string) into the format expected by the back‑end (``YYYY‑MM‑DD HH:MM:SS``). */
  const toBackendDateTime = (dt: string | Date): string => {
    const d = dt instanceof Date ? dt : new Date(dt);
    // Pad components to two digits and assemble the expected format
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const addEvent: EventsContextProps['addEvent'] = async (data) => {
    try {
      // Choose a primary category for the DB eventType.  The API also
      // accepts a ``categories`` array for additional values.
      const primaryCategory = data.categories?.[0] || 'Other';
      const payload: any = {
        creatorID: 1, // TODO: integrate with real authentication to obtain current user ID
        title: data.title,
        description: data.description,
        location: data.location,
        eventType: primaryCategory,
        startDateTime: toBackendDateTime(data.startDate),
        endDateTime: data.endDate ? toBackendDateTime(data.endDate) : toBackendDateTime(data.startDate),
        eventAccess: data.isPrivate ? 'Private' : 'Public',
        rsvpRequired: Boolean(data.rsvpRequired),
        isPriced: Boolean(data.price && data.price > 0),
        cost: data.price && data.price > 0 ? data.price : null,
        categories: data.categories ?? undefined,
      };
      const res = await fetch(`${API_BASE_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Failed to create event: ${res.statusText}`);
      }
      const result = await res.json();
      const newIdRaw: any = result?.eventID;
      // Refresh list after creation so the UI updates with the new event
      await fetchEvents();
      return typeof newIdRaw === 'number' ? String(newIdRaw) : undefined;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  };

  const updateEvent: EventsContextProps['updateEvent'] = async (updated) => {
    try {
      const payload: any = {
        updaterID: 1, // TODO: wire in authenticated user ID
        title: updated.title,
        description: updated.description,
        location: updated.location,
        eventType: updated.categories?.[0] || updated.category || undefined,
        startDateTime: updated.startDate ? toBackendDateTime(updated.startDate) : undefined,
        endDateTime: updated.endDate ? toBackendDateTime(updated.endDate) : undefined,
        eventAccess: updated.isPrivate ? 'Private' : 'Public',
        rsvpRequired: updated.rsvpRequired,
        isPriced: updated.price && updated.price > 0,
        cost: updated.price && updated.price > 0 ? updated.price : undefined,
      };
      // Remove undefined entries so they are not sent
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      const res = await fetch(`${API_BASE_URL}/events/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Failed to update event: ${res.statusText}`);
      }
      await fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteEvent: EventsContextProps['deleteEvent'] = async (id) => {
    try {
      const url = new URL(`${API_BASE_URL}/events/${id}`);
      url.searchParams.set('user_id', '1');
      // For now perform a soft delete (hard flag false)
      const res = await fetch(url.toString(), {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error(`Failed to delete event: ${res.statusText}`);
      }
      await fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const toggleLike: EventsContextProps['toggleLike'] = async (id) => {
    // Find local state for current like status
    const event = events.find((e) => e.id === id);
    if (!event) return;
    const liked = Boolean(event.userLiked);
    try {
      const endpoint = `${API_BASE_URL}/events/${id}/like`;
      const method = liked ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1 }),
      });
      if (!res.ok) {
        throw new Error(`Failed to toggle like: ${res.statusText}`);
      }
      const data = await res.json();
      // Update local event synchronously to avoid refetch flicker
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          return {
            ...e,
            likes: Number(data.likes ?? (liked ? e.likes - 1 : e.likes + 1)),
            userLiked: !liked,
          };
        }),
      );
    } catch (err) {
      console.error(err);
    }
  };

  const toggleRsvp: EventsContextProps['toggleRsvp'] = async (id) => {
    const event = events.find((e) => e.id === id);
    if (!event) return;
    const rsvped = Boolean(event.userRsvped);
    try {
      const endpoint = `${API_BASE_URL}/events/${id}/rsvp`;
      const method = rsvped ? 'DELETE' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 1 }),
      });
      if (!res.ok) {
        throw new Error(`Failed to toggle RSVP: ${res.statusText}`);
      }
      const data = await res.json();
      const rsvps = Array.isArray(data.rsvps) ? data.rsvps.length : event.rsvps;
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          return {
            ...e,
            rsvps,
            userRsvped: !rsvped,
          };
        }),
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <EventsContext.Provider value={{ events, addEvent, updateEvent, deleteEvent, toggleLike, toggleRsvp, currentUser, setCurrentUser }}>
      {children}
    </EventsContext.Provider>
  );
};
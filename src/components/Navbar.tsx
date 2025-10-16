/* This component is the navigation bar at the top of every page for the event browsing app.
This page should provide the navigation bar that appears at the top of the app. It should include links to the 
main sections such as the event list, the create event page, and any other key routes. 
The navbar should stay consistent across all pages, give users an easy way to move around the app, and 
clearly indicate which page they are on.*/

/**
 * Purpose: Describe what this file does in one line.
 *
 * Common references:
 * - Actions (like/RSVP): src/context/EventsContext.tsx
 * - Buttons: src/components/LikeButton.tsx, src/components/RSVPButton.tsx
 * - Event card: src/components/EventItem.tsx
 * - Pages: src/pages/EventList.tsx, src/pages/EventDetail.tsx, src/pages/CreateEvent.tsx
 * - Filters: src/components/Filters.tsx, src/components/SearchBar.tsx
 * - Routing: src/App.tsx
 *
 * Hint: If you need like or RSVP functionality, import from EventsContext
 * and/or reuse LikeButton or RSVPButton components.
 */



// Ruth this page is assigned to you.

// src/components/Navbar.tsx
// Purpose: Top navigation bar for event browsing app
//          with icon + text highlighting for current page

import { NavLink} from "react-router-dom";
import AccountIcon from "../assets/images/AccountIcon.png"
import CalendarIcon from "../assets/images/CalendarIcon.png"
import CreateIcon from "../assets/images/CreateIcon.png"
import EventsIcon from "../assets/images/EventsIcon.png"
import HelpIcon from "../assets/images/HelpIcon.png"
import ManageIcon from "../assets/images/ManageIcon.png"
import bear from "../assets/images/bear.png"

export function Navbar() {
    const linkBase = "flex items-center gap-1 px-3 py-2 text-white/90 hover:text-[#ffcc00] hover:bg-white/10 rounded-lg";
    const linkActive = "bg-[#ffcc00] text-[#002855] rounded-lg";

    return (
        <nav className="flex justify-between items-center px-6 py-3 bg-[#002855] text-white shadow-md border-b-2 border-[#ffcc00]">
            {/* Left */}
            <NavLink to = "/events" className = "flex items-center">
                <img src = {bear} alt = "Logo" className = "h-10" />
            </NavLink>

            {/* Center */}
            <div className = "flex gap-4">
                <NavLink to = "/events" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
                    <img src = {EventsIcon} alt = "Events" className = "h-4" />
                    <span>Events</span>
                </NavLink>

                <NavLink to = "/calendar" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
                    <img src = {CalendarIcon} alt = "Calendar" className = "h-4" />
                    <span>Calendar</span>
                </NavLink>

                <NavLink
                    to="/manage"
                    state={{ freshSignup: true }}
                    className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}
                >
                    <img src = {ManageIcon} alt = "Manage" className = "h-4" />
                    <span>Sign Up</span>
                </NavLink>
            </div>

            {/* Right */}
            <div className = "flex gap-4">
                <NavLink to="/create" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
                    <span>Create</span>
                </NavLink>
                <NavLink to="/help" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
                    <span>Help</span>
                </NavLink>
                <NavLink to="/profile" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ""}`}>
                    <span>Profile</span>
                </NavLink>
            </div>
        </nav>
    );
}

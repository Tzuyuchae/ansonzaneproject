import React, { useState, FormEvent, ChangeEvent } from 'react';
import { useEvents } from '../context/EventsContext';
import { useNavigate } from 'react-router-dom';
import EventPreviewBanner from './EventPreviewBanner';
import Popup from './Popup'; 
import InviteUserSearch from './InviteUserSearch'; 


// Define the User type (must match the type used in InviteUserSearch)
interface User {
    id: string;
    name: string;
}

// Define the available categories for mapping
const AVAILABLE_CATEGORIES = ["Music", "Tech", "Art", "Sports", "Food", "Community", "Other"];


function CreateEventForm() {
  const { addEvent } = useEvents();
  const navigate = useNavigate();


  // Standard Event State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  // 💥 CHANGED: State is now an array of strings for multiple categories
  const [categories, setCategories] = useState<string[]>([]);
  const [rsvpRequired, setRsvpRequired] = useState(false);
  const [capacity, setCapacity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isPriceRequired, setIsPriceRequired] = useState(false);
  const [price, setPrice] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Private Event and Invitation State
  const [isPrivate, setIsPrivate] = useState(false);
  const [invitedUsers, setInvitedUsers] = useState<User[]>([]); // List of invited users
  const [isPopupOpen, setIsPopupOpen] = useState(false); // Controls Popup visibility



  // Handler for updating the categories array
  const handleCategoryChange = (e: ChangeEvent<HTMLInputElement>) => {
    const categoryValue = e.target.value;
    if (e.target.checked) {
      // Add category if checked
      setCategories(prev => [...prev, categoryValue]);
    } else {
      // Remove category if unchecked
      setCategories(prev => prev.filter(cat => cat !== categoryValue));
    }
  };


  // Handler for inviting a user: adds a user to the invitedUsers list
  const handleInviteUser = (user: User) => {
    setInvitedUsers((prev) => {
      // Prevent duplicates
      if (prev.some(u => u.id === user.id)) return prev;
      return [...prev, user];
    });
  };

  // Handler for toggling private and clearing invited users if unchecked
  const handleTogglePrivate = (e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsPrivate(checked);
    if (!checked) {
      setInvitedUsers([]); // Clear invites if it's no longer private
    }
  };


  /**
   * Creates a temporary local URL for the selected image
   * to use in the live preview banner.
   */
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageUrl(URL.createObjectURL(file));
    }
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!title || !description || !date || !location || categories.length === 0) {
      setError('Please fill out all required fields, including at least one Category.');
      return;
    }
    // Private events must specify at least one invitee
    if (isPrivate && invitedUsers.length === 0) {
      setError('A private event must have at least one invited user.');
      return;
    }

    // Build the payload omitting fields that are derived or server‑side
    const payload = {
      title,
      description,
      startDate: date,
      endDate: undefined as string | undefined,
      location,
      categories,
      rsvpRequired,
      capacity: capacity ? parseInt(capacity, 10) : undefined,
      imageUrl: imageUrl || 'https://via.placeholder.com/300',
      price,
      isPrivate,
      invitedUserIds: invitedUsers.map((user) => user.id),
    };

    try {
      const res = await fetch('http://127.0.0.1:8000/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to create event');
      const newEvent = await res.json();
      const newId = newEvent.id;
      setError(null);
      // If creation succeeded and returned an ID, navigate to the detail view.
      if (newId) {
        navigate(`/events/${newId}`);
      } else {
        // Otherwise go back to the home page
        navigate('/');
      }
    } catch (err) {
      let errorMsg = 'Unknown error';
      if (err instanceof Response) {
        errorMsg = await err.json();
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      console.error('Event creation error:', errorMsg);
      setError('Failed to create event. Please try again.');
    };


    return (
      <>
        {/* --- LIVE PREVIEW BANNER --- */}
        <EventPreviewBanner
          title={title}
          date={date}
          location={location}
          imageUrl={imageUrl} />


        <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
          {error && <div className="text-red-500 bg-red-100 p-3 rounded">{error}</div>}


          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">Event Title</label>
            <input type="text" id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
          </div>


          {/* Description Input */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" rows={3} required />
          </div>


          {/* Date and Time Input */}
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">Date and Time</label>
            <input type="datetime-local" id="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
          </div>


          {/* Location Input */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700">Location</label>
            <input type="text" id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" required />
          </div>


          {/* --- EVENT OPTIONS --- */}

          {/* Is Private Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPrivate"
              checked={isPrivate}
              onChange={handleTogglePrivate} // Use the new handler
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
            <label htmlFor="isPrivate" className="ml-2 block text-sm font-medium text-gray-700">
              Is this a **Private** Event?
            </label>
          </div>

          {/* CONDITIONAL RENDERING: Invite User UI when isPrivate is true */}
          {isPrivate && (
            <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400">
              <h4 className="text-sm font-semibold text-yellow-800 mb-2">Private Event Invitation</h4>

              <button
                type="button"
                onClick={() => setIsPopupOpen(true)}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                {invitedUsers.length > 0 ? `Manage ${invitedUsers.length} Invited Users` : 'Invite Users'}
              </button>

              {invitedUsers.length > 0 && (
                <p className="mt-2 text-xs text-gray-600">
                  <span className="font-semibold">{invitedUsers.length}</span> users invited.
                  <span className="underline cursor-pointer ml-1" onClick={() => setIsPopupOpen(true)}>Click to view/add.</span>
                </p>
              )}
              {!invitedUsers.length && (
                <p className="mt-2 text-sm text-red-600 font-medium">No users invited yet!</p>
              )}
            </div>
          )}

          {/* RSVP Required Checkbox */}
          <div className="flex items-center">
            <input type="checkbox" id="rsvp" checked={rsvpRequired} onChange={(e) => setRsvpRequired(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
            <label htmlFor="rsvp" className="ml-2 block text-sm font-medium text-gray-700">RSVP Required?</label>
          </div>


          {/* IsPrice Required Checkbox */}
          <div className="flex items-center">
            <input type="checkbox" id="isPrice" checked={isPriceRequired} onChange={(e) => setIsPriceRequired(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
            <label htmlFor="isPrice" className="ml-2 block text-sm font-medium text-gray-700">Is Price Required?</label>
          </div>


          {/* Price Input */}
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price</label>
            <input
              type="number"
              id="price"
              value={price}
              onChange={(e) => setPrice(parseInt(e.target.value))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
          </div>


          {/* 💥 NEW MULTI-CATEGORY CHECKBOXES 💥 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categories (Select one or more)</label>
            <div className="flex flex-wrap gap-4 p-3 border border-gray-300 rounded-md">
              {AVAILABLE_CATEGORIES.map(cat => (
                <div key={cat} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`cat-${cat}`}
                    value={cat}
                    // Check if the category is currently in the state array
                    checked={categories.includes(cat)}
                    onChange={handleCategoryChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                  <label htmlFor={`cat-${cat}`} className="ml-2 text-sm text-gray-700">{cat}</label>
                </div>
              ))}
            </div>
          </div>


          {/* --- OPTIONAL FIELDS --- */}

          {/* Banner Image Upload */}
          <div>
            <label htmlFor="imageUpload" className="block text-sm font-medium text-gray-700">Banner Image (Optional)</label>
            <input
              type="file"
              id="imageUpload"
              accept="image/png, image/jpeg, image/gif"
              onChange={handleImageChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200" />
          </div>


          {/* Capacity Input */}
          <div>
            <label htmlFor="capacity" className="block text-sm font-medium text-gray-700">Capacity (Optional)</label>
            <input type="number" id="capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" min="1" />
          </div>


          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            Create Event
          </button>
        </form>

        {/* Conditional Popup: Renders the Popup when isPopupOpen is true */}
        {isPopupOpen && (
          <Popup onClose={() => setIsPopupOpen(false)}>
            <InviteUserSearch
              onInvite={handleInviteUser}
              invitedUsers={invitedUsers} />
          </Popup>
        )}
      </>
    );
  };


}

export default CreateEventForm;

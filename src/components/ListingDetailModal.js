import React from 'react';
import PictureCarousel from './PictureCarousel'; // Import the carousel

// Helper function to format numbers with commas
const formatNumber = (num) => {
  if (num === null || num === undefined) return 'N/A';
  return num.toLocaleString();
};

// Helper to format amenities array
const formatAmenities = (amenities) => {
  if (!Array.isArray(amenities) || amenities.length === 0) return 'None specified';
  return amenities.join(', ');
};

// Listing Detail Modal Component
function ListingDetailModal({ listing, onClose }) {
  if (!listing) return null;

  // Use the mapped data directly if available, otherwise fallback to originalPayload
  const displayData = listing || {}; // Use the mapped 'listing' passed as prop
  const originalPayload = listing?.originalPayload || {}; // Access original if needed

  const handleModalContentClick = (e) => {
    e.stopPropagation(); // Prevent click inside modal from closing it
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4 overflow-y-auto" 
      onClick={onClose} // Close when clicking the background overlay
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={handleModalContentClick} // Prevent closing when clicking modal content
      >
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 z-10 text-2xl"
          aria-label="Close modal"
        >
          &times;
        </button>

        {/* Modal Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Left Column: Carousel and Basic Info */}
          <div className="space-y-4">
            <PictureCarousel pictures={displayData.pictures || []} />
            <h2 className="text-2xl font-bold text-gray-800">{displayData.listingTitle || 'Listing Details'}</h2>
            <p className="text-lg text-gray-600">Ref: {displayData.listingRef || 'N/A'}</p>
            <p className="text-2xl font-semibold text-indigo-600">{formatNumber(displayData.price)} AED</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
              <p><span className="font-medium">Type:</span> {displayData.unitType || 'N/A'}</p>
              <p><span className="font-medium">Transaction:</span> {displayData.transactionType || 'N/A'}</p>
              <p><span className="font-medium">Beds:</span> {displayData.bedrooms ?? 'N/A'}</p>
              <p><span className="font-medium">Baths:</span> {displayData.bathrooms ?? 'N/A'}</p>
              <p><span className="font-medium">Size:</span> {formatNumber(displayData.unitSize)} sqft</p>
              <p><span className="font-medium">Furnishing:</span> {displayData.furnishing || 'N/A'}</p>
              {/* Add other key fields here if needed */}
            </div>
          </div>

          {/* Right Column: Address, Amenities, Description */}
          <div className="space-y-4">
             <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Location</h3>
              <p className="text-gray-700">{displayData.address || 'Address not available'}</p>
              {displayData.building && <p className="text-gray-700">Building: {displayData.building}</p>}
              {Array.isArray(displayData.neighborhood) && displayData.neighborhood.length > 0 && (
                <p className="text-gray-700">Community: {displayData.neighborhood.join(', ')}</p>
              )}
            </div>
             <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Amenities</h3>
              <p className="text-gray-700 text-sm">{formatAmenities(displayData.amenities)}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Description</h3>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">{displayData.description || 'No description provided.'}</p>
            </div>
            {/* Optional: Display raw data for debugging */}
            {/* <details className="mt-4">
              <summary className="text-sm text-gray-500 cursor-pointer">View Raw Data</summary>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto mt-1">
                {JSON.stringify(originalPayload, null, 2)}
              </pre>
            </details> */}          
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListingDetailModal;

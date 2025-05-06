import React from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import DOMPurify from 'dompurify';

// --- Helper Function for Days on Market ---
const calculateDaysOnMarket = (createdAt) => {
  if (!createdAt) return 'N/A';
  const createdDate = new Date(createdAt);
  const now = new Date();
  const differenceInTime = now.getTime() - createdDate.getTime();
  const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));
  return differenceInDays >= 0 ? `${differenceInDays} day(s)` : 'N/A';
};

// --- Helper function to display list items ---
const displayList = (items) => {
  if (!items || items.length === 0) return 'N/A';
  if (Array.isArray(items)) {
    return items.join(', ');
  }
  return items; // Handle non-array case if necessary
};

// --- Card Section Component ---
const CardSection = ({ data, type }) => {
  if (!data) return null;

  // Common fields or defaults
  const listingRef = data.unit_ref_no || 'N/A';

  // Listing specific detailed view
  if (type === 'listing') {
    // Use other_details for description (assume plain text)
    const descriptionText = data.other_details || ''; 
    const daysOnMarket = calculateDaysOnMarket(data.created_at);
    // Use facilities for amenities
    const facilities = Array.isArray(data.facilities) ? data.facilities : []; 
    // Use images for carousel
    const images = Array.isArray(data.images) ? data.images : [];

    // Settings for the image carousel
    const carouselSettings = {
      dots: true,
      infinite: images.length > 1, // Only loop if more than 1 image
      speed: 500,
      slidesToShow: 1,
      slidesToScroll: 1,
      arrows: images.length > 1, // Only show arrows if more than 1 image
      adaptiveHeight: true,
    };

    return (
      <div className="bg-white rounded-xl shadow-md p-4 w-full border border-gray-200">
        {/* Listing Ref Header */}
        <div className="mb-2 text-xs text-gray-500 font-mono">
          Listing Ref: <span className="font-semibold text-gray-700">{listingRef}</span>
        </div>

        {/* Basic Info Section */}
        <section className="mb-4">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Basic Info</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-gray-600">Transaction:</span><span>{data.transaction_type || 'N/A'}</span>
            <span className="font-medium text-gray-600">Price:</span><span>{data.price_aed ? `${data.price_aed.toLocaleString()} AED` : 'N/A'}</span>
            <span className="font-medium text-gray-600">Unit Size:</span><span>{data.area_sqft ? `${data.area_sqft} sqft` : 'N/A'}</span>
            <span className="font-medium text-gray-600">Community:</span><span>{data.community || 'N/A'}</span>
            <span className="font-medium text-gray-600">Bedrooms:</span><span>{data.bedr_num !== null ? data.bedr_num : 'N/A'}</span>
            <span className="font-medium text-gray-600">Bathrooms:</span><span>{data.bathr_num !== null ? data.bathr_num : 'N/A'}</span>
            <span className="font-medium text-gray-600">Unit Type:</span><span>{data.property_type || 'N/A'}</span>
            <span className="font-medium text-gray-600">Listing Title:</span><span>{data.title || 'N/A'}</span>
          </div>
        </section>

        {/* Listing Info Section */}
        <section className="mb-4">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Listing Info</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
             <span className="font-medium text-gray-600">Listing Agent:</span><span>{data.agent_name || 'N/A'}</span> {/* Assuming agent_name */}
             <span className="font-medium text-gray-600">Days on Market:</span><span>{daysOnMarket}</span>
             <span className="font-medium text-gray-600">Listing Ref:</span><span>{listingRef}</span>
          </div>
        </section>

        {/* Amenities / Facilities (using facilities) */}
        {facilities.length > 0 && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">Amenities / Facilities</h2>
            <div className="flex flex-wrap gap-2">
              {facilities.map((facility, index) => (
                <span key={index} className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs">
                  {facility}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Description (using other_details - plain text) */}
        {descriptionText && (
          <section className="mb-4">
            <h2 className="text-lg font-semibold mb-2 text-gray-700">Description</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {descriptionText}
            </p>
          </section>
        )}

        {/* Images & Details (using Carousel) */}
        <section className="mb-4">
          <h2 className="text-lg font-semibold mb-2 text-gray-700">Images & Details</h2>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm text-gray-600">Furnishing: {data.furnishing || 'N/A'}</span>
            {images.length > 0 && (
                 <div className="mt-2 slick-container border rounded overflow-hidden"> {/* Added container */} 
                   <Slider {...carouselSettings}>
                      {images.map((img, index) => (
                        <div key={index} className="w-full h-64 flex justify-center items-center bg-gray-100"> {/* Centering container */} 
                          <img
                            // Check if img is object with url or just string url
                            src={typeof img === 'object' && img.url ? img.url : (typeof img === 'string' ? img : '#')}
                            alt={`Listing Image ${index + 1}`}
                            className="object-contain max-h-full max-w-full" // Use object-contain 
                            onError={(e) => { e.target.src = '/placeholder-image.png'; }} // Fallback image
                           />
                        </div>
                      ))}
                   </Slider>
                 </div>
            )}
           </div>
        </section>
      </div>
    );
  }

  // Requirement specific detailed view
  if (type === 'requirement') {
    const budgetMin = data.budget_min_aed ? data.budget_min_aed.toLocaleString() : 'N/A';
    const budgetMax = data.budget_max_aed ? data.budget_max_aed.toLocaleString() : 'N/A';
    const budget = budgetMin !== 'N/A' || budgetMax !== 'N/A' ? `${budgetMin} - ${budgetMax} AED` : 'N/A';

    // Extract boolean flags
    const booleans = [
      data.urgent_bool && { label: 'Urgent' },
      data.garden_bool && { label: 'Garden' },
      data.pool_bool && { label: 'Pool' },
      data.distressed_deal_bool && { label: 'Distressed Deal' },
      data.off_plan_bool && { label: 'Off Plan' },
      data.mortgage_approved && { label: 'Pre-approved' },
    ].filter(Boolean); // Filter out falsy values

    return (
      <div className="bg-white rounded-xl shadow-md p-4 w-full border border-gray-200 space-y-3">
        {/* Requirement Ref Header */}
        <div className="text-xs text-gray-500 font-mono">
          Req Ref: <span className="font-semibold text-gray-700">{data.pk || 'N/A'}</span> | Client: <span className="font-semibold text-gray-700">{data.client_name || 'N/A'}</span>
        </div>

        {/* Core Requirements Section */}
        <div>
           <h4 className="text-sm font-semibold text-gray-700 mb-1">Core Needs:</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-gray-600">Transaction:</span><span>{data.transaction_type || 'N/A'}</span>
            <span className="font-medium text-gray-600">Budget:</span><span>{budget}</span>
            <span className="font-medium text-gray-600">Size:</span><span>{data.area_sqft ? `${data.area_sqft} sqft` : 'N/A'}</span>
            <span className="font-medium text-gray-600">Bedrooms:</span><span>{data.bedr_num !== null ? data.bedr_num : 'N/A'}</span>
            <span className="font-medium text-gray-600">Unit Type:</span><span>{data.property_type || 'N/A'}</span>
            <span className="font-medium text-gray-600">Furnishing:</span><span>{data.furnishing || 'N/A'}</span>
            <span className="font-medium text-gray-600">Buyer Type:</span><span>{data.mortgage_or_cash || 'N/A'}</span>
            <span className="font-medium text-gray-600">Communities:</span><span>{displayList(data.communities)}</span>
            <span className="font-medium text-gray-600">Developers:</span><span>{displayList(data.developers)}</span>
          </div>
        </div>

        {/* Boolean Flags Section */}
        {booleans.length > 0 && (
          <div>
             <h4 className="text-sm font-semibold text-gray-700 mb-1">Preferences:</h4>
            <div className="flex flex-wrap gap-2">
              {booleans.map((b, index) => (
                <span
                  key={index}
                  className={`text-xs px-2 py-0.5 rounded-full border ${b.label === 'Urgent' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Additional Details Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Additional Details:</h4>
          <div className="text-sm space-y-1">
            {data.location_raw && <div><span className="font-medium text-gray-600">Location Raw:</span> {data.location_raw}</div>}
            {data.other_details && <div><span className="font-medium text-gray-600">Other Details:</span> {data.other_details}</div>}
            {data.message_body && 
              <div>
                <span className="font-medium text-gray-600">Message:</span> 
                <p className="text-xs text-gray-500 bg-gray-50 p-1 rounded border mt-0.5 whitespace-pre-wrap">{data.message_body}</p>
              </div>
            }
          </div>
        </div>
      </div>
    );
  }

  // Fallback or default view if type is not recognized or data is missing fields
  return (
    <div className="p-4 border rounded bg-gray-100">
      <p className="text-sm text-gray-600">Unsupported card type or missing data.</p>
      <pre className="text-xs mt-2 bg-white p-2 rounded overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default CardSection;

import React from 'react';

// Component to display a list of items, expandable if the list exceeds a limit.
function ExpandableListCell({ items, label, itemClassName, limit = 3, onOpenModal }) {
  // Ensure items is a valid array and filter out non-strings/empty strings
  const validItems = Array.isArray(items)
    ? items.filter(item => typeof item === 'string' && item.trim() !== '')
    : [];

  if (validItems.length === 0) {
    return <span className="text-gray-500 italic text-xs">N/A</span>; // Indicate when empty or invalid
  }

  const displayItems = validItems.slice(0, limit);
  const hasMore = validItems.length > limit;

  const handleViewMoreClick = (e) => {
    e.stopPropagation(); // Prevent triggering row clicks etc.
    if (onOpenModal) {
        onOpenModal(label, validItems); // Pass the label and the full list of valid items
    } else {
        console.warn('onOpenModal handler not provided to ExpandableListCell for label:', label);
    }
  };

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {displayItems.map((item, index) => (
        // Use index in key as items might not be unique, but ensure label provides context
        <span key={`${label}-item-${index}`} className={itemClassName || 'px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs'}>
          {item}
        </span>
      ))}
      {hasMore && onOpenModal && (
        <button
          onClick={handleViewMoreClick}
          className="text-blue-600 hover:text-blue-800 text-xs underline pl-1"
          aria-label={`View all ${label}`}
        >
          + {validItems.length - limit} more
        </button>
      )}
      {!hasMore && validItems.length > 0 && validItems.length <= limit && (
          // Optionally render something else if needed when all items are shown and within limit
          null
      )}
    </div>
  );
}

export default ExpandableListCell;

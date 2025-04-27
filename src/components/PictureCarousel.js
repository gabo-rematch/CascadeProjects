import React, { useState } from 'react';

// Image Carousel Component
function PictureCarousel({ pictures }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!pictures || pictures.length === 0) {
    return <div className="text-center text-gray-500 italic">No images available</div>;
  }

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? pictures.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === pictures.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  return (
    <div className="relative w-full h-64 overflow-hidden rounded-lg group">
      {/* Image */}
      <img 
        src={pictures[currentIndex]} 
        alt={`Listing ${currentIndex + 1}`} 
        className="w-full h-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
        onError={(e) => { e.target.onerror = null; e.target.src='placeholder.png'; }} // Basic placeholder fallback
      />
      
      {/* Previous Button */}
      {pictures.length > 1 && (
        <button 
          onClick={goToPrevious} 
          className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 focus:outline-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        >
          &#10094; {/* Left arrow */}
        </button>
      )}

      {/* Next Button */}
      {pictures.length > 1 && (
        <button 
          onClick={goToNext} 
          className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-75 focus:outline-none transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        >
          &#10095; {/* Right arrow */}
        </button>
      )}

      {/* Dots Indicator */}
      {pictures.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {pictures.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full ${currentIndex === index ? 'bg-white' : 'bg-gray-400 bg-opacity-75'} focus:outline-none transition-opacity duration-300 opacity-0 group-hover:opacity-100`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PictureCarousel;

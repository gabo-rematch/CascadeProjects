// Global variable for the Autocomplete instance
let autocomplete;

function initAutocomplete() {
    console.log("Google Maps API loaded, initializing Autocomplete.");
    const locationIdEl = document.getElementById('location-id');
    const locationTitleEl = document.getElementById('location-title');
    const locationCoordsEl = document.getElementById('location-coords');
    const progressEl = document.getElementById('progress');
    const dataIndexInput = document.getElementById('data-index');

    const searchQueryInput = document.getElementById('search-query');
    const skipButton = document.getElementById('skip-button');
    const resultsListEl = document.getElementById('results-list');
    const statusMessageEl = document.getElementById('status-message');
    const saveButton = document.getElementById('save-button');

    // --- Initialize Autocomplete ---
    autocomplete = new google.maps.places.Autocomplete(
        searchQueryInput, 
        {
            types: ['geocode'], // Or ['address'], ['establishment'], ['(regions)'], ['(cities)']
            // Optional: Bias results to a specific country or viewport
             componentRestrictions: { country: 'AE' }, // Bias towards UAE
            fields: ['place_id', 'formatted_address', 'types', 'geometry'] // Fetch necessary fields
        }
    );

    // --- Event Listener for Place Selection ---
    autocomplete.addListener('place_changed', onPlaceChanged);

    function onPlaceChanged() {
        clearStatus();
        resultsListEl.innerHTML = ''; // Clear previous selection display
        const place = autocomplete.getPlace();

        if (!place.geometry || !place.place_id) {
            // User entered the name of a Place that was not suggested and
            // pressed the Enter key, or the Place Details request failed.
            displayStatus("No details available for input: '" + place.name + "'. Please select from the dropdown.", true);
            return;
        }

        // Display the selected place and confirmation button
        const div = document.createElement('div');
        div.innerHTML = `
            <p><strong>Selected Address:</strong> ${place.formatted_address || 'N/A'}</p>
            <p><strong>Types:</strong> ${place.types ? place.types.join(', ') : 'N/A'}</p>
            <p><strong>Place ID:</strong> ${place.place_id}</p>
            <button id="use-selected-place">Use This Selected Place</button>
        `;
        resultsListEl.appendChild(div);

        // Add listener to the confirmation button
        document.getElementById('use-selected-place').addEventListener('click', () => {
            // Prepare the result object for the backend
            const geocode_result = {
                types: place.types || [],
                formatted_address: place.formatted_address,
                place_id: place.place_id,
                // Use bounds if available, otherwise viewport
                geometry: { // Need to nest geometry for backend compatibility
                     bounds: place.geometry.bounds ? place.geometry.bounds.toJSON() : (place.geometry.viewport ? place.geometry.viewport.toJSON() : null)
                }
            };
            updateLocation(geocode_result);
        });
    }

    async function fetchNextLocation() {
        clearStatus();
        resultsListEl.innerHTML = ''; // Clear previous results/selection
        searchQueryInput.value = ''; // Clear search box
        try {
            const response = await fetch('/api/next-location');
            const data = await response.json();

            if (response.ok) {
                if (data.location) {
                    locationIdEl.textContent = data.location.id;
                    locationTitleEl.textContent = data.location.title_en;
                    locationCoordsEl.textContent = `Lat: ${data.location.original_lat}, Lon: ${data.location.original_lon}`;
                    dataIndexInput.value = data.location.data_index;
                    progressEl.textContent = data.progress;
                } else if (data.message === 'All locations fixed!') {
                    displayStatus('All locations have been processed!', false);
                    searchQueryInput.disabled = true;
                    skipButton.disabled = true;
                    locationIdEl.textContent = '-';
                    locationTitleEl.textContent = '-';
                    locationCoordsEl.textContent = '-';
                    progressEl.textContent = data.progress;
                } else {
                    displayStatus('No more locations to fix or error fetching.', true);
                }
            } else {
                displayStatus(`Error: ${data.message || 'Failed to fetch next location'}`, true);
            }
        } catch (error) {
            displayStatus(`Network error: ${error.message}`, true);
        }
    }

    async function updateLocation(selectedResult) { 
        const dataIndex = parseInt(dataIndexInput.value, 10);
        if (isNaN(dataIndex)) {
            displayStatus('Invalid location index.', true);
            return;
        }

        clearStatus();
        try {
            const response = await fetch('/api/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    data_index: dataIndex, 
                    geocode_result: selectedResult 
                }),
            });
            const data = await response.json();

            if (response.ok) {
                displayStatus(data.message || 'Update successful!', false);
                fetchNextLocation(); 
            } else {
                displayStatus(`Error updating: ${data.error || 'Unknown error'}`, true);
            }
        } catch (error) {
            displayStatus(`Network error during update: ${error.message}`, true);
        }
    }

    async function skipLocation() {
        const dataIndex = parseInt(dataIndexInput.value, 10);
        if (isNaN(dataIndex)) {
            displayStatus('Invalid location index.', true);
            return;
        }
        clearStatus();
        try {
            const response = await fetch('/api/skip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data_index: dataIndex }),
            });
            const data = await response.json();
            if (response.ok) {
                displayStatus(data.message || 'Location skipped.', false);
                fetchNextLocation(); 
            } else {
                displayStatus(`Error skipping: ${data.error || 'Unknown error'}`, true);
            }
        } catch (error) {
            displayStatus(`Network error during skip: ${error.message}`, true);
        }
    }

    async function saveChanges() {
        clearStatus();
        if (!confirm('Are you sure you want to save all changes to the file?')) {
            return;
        }
        try {
            const response = await fetch('/api/save', {
                method: 'POST',
            });
            const data = await response.json();
            if (response.ok) {
                displayStatus(data.message || 'Save successful!', false);
            } else {
                displayStatus(`Error saving: ${data.error || 'Unknown error'}`, true);
            }
        } catch (error) {
            displayStatus(`Network error during save: ${error.message}`, true);
        }
    }

    function displayStatus(message, isError = false) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = isError ? 'error' : '';
    }

    function clearStatus() {
        statusMessageEl.textContent = '';
        statusMessageEl.className = '';
    }

    skipButton.addEventListener('click', skipLocation);
    saveButton.addEventListener('click', saveChanges);

    fetchNextLocation();
}

window.initAutocomplete = initAutocomplete;

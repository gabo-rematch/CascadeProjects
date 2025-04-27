import googlemaps
import json
import os
import time
from Levenshtein import distance as levenshtein_distance
from math import radians, cos, sin, asin, sqrt
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import deque
import logging
from dotenv import load_dotenv

# --- Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load environment variables from .env file in the project root
script_dir = os.path.dirname(__file__)
project_root = os.path.abspath(os.path.join(script_dir, '..', '..'))
dotenv_path = os.path.join(project_root, '.env')
loaded = load_dotenv(dotenv_path=dotenv_path)
if loaded:
    logging.info(f"Loaded environment variables from: {dotenv_path}")
else:
    logging.warning(f"Could not find or load .env file at: {dotenv_path}. Relying on system environment variables.")

API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
if not API_KEY:
    raise ValueError("Google Maps API key not found in environment variable 'GOOGLE_MAPS_API_KEY' or .env file")

gmaps = googlemaps.Client(key=API_KEY, requests_kwargs={'timeout': 10})

# Rate Limiting (Google Maps Platform standard limits are often 50 QPS, but let's be safer)
MAX_QPS = 20
MIN_DELAY = 1.0 / MAX_QPS
last_request_time = 0
request_times = deque()

# Constants
UAE_COUNTRY_CODES = {'AE'}
UAE_COUNTRY_NAMES = {'United Arab Emirates', 'UAE'}
NEARBY_SEARCH_RADIUS = 100  # meters
CONFIDENCE_THRESHOLD_HIGH = 0.85
CONFIDENCE_THRESHOLD_MEDIUM = 0.6
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds
MAX_DISTANCE_METERS = 2000

# Types preferred for neighborhood/area matching
PREFERRED_AREA_TYPES = {
    'locality',
    'sublocality',
    'sublocality_level_1',
    'sublocality_level_2',
    'neighborhood',
    'administrative_area_level_1',
    'administrative_area_level_2',
    'administrative_area_level_3'
}
REQUIRED_AREA_TYPES = {'neighborhood', 'sublocality', 'sublocality_level_1'}
# Types that often indicate a specific point, less desirable for broad area matching
UNDESIRABLE_POINT_TYPES = {
    'establishment',
    'point_of_interest',
    'premise',
    'subpremise',
    'store',
    'restaurant' # Add others as needed
}

# --- Helper Functions ---

def haversine(lon1, lat1, lon2, lat2):
    """Calculate the great circle distance between two points on the earth."""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r * 1000 # Distance in meters

def rate_limited_request(api_call, *args, **kwargs):
    """Ensures API calls respect the rate limit."""
    global last_request_time
    retries = 0
    while True:
        current_time = time.monotonic()
        elapsed = current_time - last_request_time

        if elapsed < MIN_DELAY:
            sleep_time = MIN_DELAY - elapsed
            time.sleep(sleep_time)

        try:
            last_request_time = time.monotonic()
            result = api_call(*args, **kwargs)
            # Check for specific API errors if needed (e.g., OVER_QUERY_LIMIT)
            if isinstance(result, dict) and result.get('status') == 'OVER_QUERY_LIMIT':
                 raise googlemaps.exceptions.ApiError("OVER_QUERY_LIMIT", status='OVER_QUERY_LIMIT')
            return result
        except (googlemaps.exceptions.ApiError, googlemaps.exceptions.Timeout, googlemaps.exceptions.TransportError) as e:
            logging.warning(f"API Error: {e}. Retrying ({retries + 1}/{MAX_RETRIES})...")
            retries += 1
            if retries >= MAX_RETRIES:
                logging.error(f"Max retries reached for API call. Error: {e}")
                return None # Or re-raise the exception depending on desired handling
            time.sleep(RETRY_DELAY * (2 ** (retries - 1))) # Exponential backoff
        except Exception as e:
            logging.error(f"Unexpected error during API call: {e}")
            return None

def is_in_uae(address_components):
    """Check if the address components indicate a location in the UAE."""
    if not address_components:
        return False
    for component in address_components:
        if 'country' in component.get('types', []) and component.get('short_name') in UAE_COUNTRY_CODES:
            return True
        if component.get('long_name') in UAE_COUNTRY_NAMES or component.get('short_name') in UAE_COUNTRY_NAMES:
             # Sometimes country isn't tagged but appears in other components
             return True
    return False

def calculate_confidence(input_data, result_data):
    """Calculate a confidence score based on text similarity, proximity, type, and completeness."""
    if not result_data:
        return 0.0

    input_name = input_data['title']['en']
    input_lat = input_data['latitude']
    input_lon = input_data['longitude']

    result_name = result_data.get('name', '')
    result_address = result_data.get('formatted_address', '')
    result_location = result_data.get('geometry', {}).get('location', {})
    result_lat = result_location.get('lat')
    result_lon = result_location.get('lng')
    result_bounds = result_data.get('geometry', {}).get('viewport') or result_data.get('geometry', {}).get('bounds')
    result_types = result_data.get('types', [])

    # 1. Text Similarity (using name and address)
    name_similarity = 0.0
    address_similarity = 0.0
    max_len_name = max(len(input_name), len(result_name))
    if max_len_name > 0:
        name_similarity = 1.0 - (levenshtein_distance(input_name.lower(), result_name.lower()) / max_len_name)

    # Consider address similarity if name similarity is not perfect
    if name_similarity < 1.0:
        max_len_addr = max(len(input_name), len(result_address))
        if max_len_addr > 0:
             # Compare input name to result address as sometimes the specific name isn't in the address
            address_similarity = 1.0 - (levenshtein_distance(input_name.lower(), result_address.lower()) / max_len_addr)

    text_score = max(name_similarity, address_similarity) # Take the better match

    # 2. Spatial Proximity
    proximity_score = 0.0
    if result_lat is not None and result_lon is not None:
        distance = haversine(input_lon, input_lat, result_lon, result_lat)
        # Score decreases sharply beyond a small radius (e.g., 200m)
        proximity_score = max(0.0, 1.0 - (distance / 200.0))

    # 3. Type Score (New)
    type_score = 0.5 # Default score
    has_preferred_type = any(t in PREFERRED_AREA_TYPES for t in result_types)
    has_undesirable_type = any(t in UNDESIRABLE_POINT_TYPES for t in result_types)

    if has_preferred_type:
        type_score = 1.0 # Max score if a preferred area type is present
    elif has_undesirable_type:
        type_score = 0.3 # Lower score if only undesirable types are present
    elif not result_types:
        type_score = 0.2 # Penalize if no types are returned

    # 4. Completeness Score (simple check for key fields)
    completeness_score = 0.0
    fields_present = 0
    if result_name: fields_present += 1
    if result_address: fields_present += 1
    if result_bounds: fields_present += 1
    if result_lat is not None: fields_present += 1 # Check if coordinates exist
    completeness_score = fields_present / 4.0

    # Combine scores (Adjusted weights)
    # Weighting: Text=0.4, Proximity=0.3, Type=0.2, Completeness=0.1
    composite_score = (0.4 * text_score) + (0.3 * proximity_score) + (0.2 * type_score) + (0.1 * completeness_score)

    return min(max(composite_score, 0.0), 1.0) # Clamp score between 0 and 1

# --- API Call Functions ---

def geocode_location(location_name):
    """Perform Geocoding API lookup."""
    query = location_name
    if "UAE" not in query and "United Arab Emirates" not in query:
        query += ", UAE"
    logging.debug(f"Geocoding query: '{query}'")
    return rate_limited_request(gmaps.geocode, address=query, components={"country": "AE"})

def places_text_search(location_name):
    """Perform Places API Text Search biased towards UAE."""
    logging.debug(f"Places Text Search query: '{location_name}'")
    # Using location bias is generally preferred over component restrictions for text search
    # Define a rough center point for UAE if possible, or rely on Google's understanding
    # Let's try without explicit location bias first, relying on 'UAE' in query potentially
    # If results are poor, add location bias (e.g., location=(24.4, 54.5), radius=500000)
    return rate_limited_request(gmaps.places, query=location_name, region='ae')

def places_nearby_search(lat, lon):
    """Perform Places API Nearby Search."""
    logging.debug(f"Places Nearby Search query: lat={lat}, lon={lon}, radius={NEARBY_SEARCH_RADIUS}")
    return rate_limited_request(gmaps.places_nearby, location=(lat, lon), radius=NEARBY_SEARCH_RADIUS)

def get_place_details(place_id):
    """Retrieve Place Details using Place ID."""
    logging.debug(f"Get Place Details query: place_id={place_id}")
    # Request specific fields to manage costs
    # Corrected 'address_components' to 'address_component' and 'types' to 'type'
    fields = ['place_id', 'name', 'formatted_address', 'geometry', 'address_component', 'type']
    return rate_limited_request(gmaps.place, place_id=place_id, fields=fields)

# --- Main Processing Logic ---

def process_location(location_data):
    """Process a single location using the defined mapping strategy."""
    input_id = location_data['id']
    input_name = location_data['title']['en']
    input_lat = location_data['latitude']
    input_lon = location_data['longitude']
    logging.info(f"Processing ID {input_id}: '{input_name}' ({input_lat}, {input_lon})")

    final_result = {
        'input_id': input_id,
        'input_name': input_name,
        'input_latitude': input_lat,
        'input_longitude': input_lon,
        'match_status': 'rejected',
        'place_id': None,
        'name': None,
        'address': None,
        'latitude': None,
        'longitude': None,
        'bounds': None,
        'confidence': 0.0,
        'method': None,
        'google_types': None,
        'distance_meters': None
    }

    # 1. Geocoding API Attempt
    geocode_results = geocode_location(input_name)
    if geocode_results:
        # Check if results are exact and in UAE
        for result in geocode_results:
            is_uae = is_in_uae(result.get('address_components'))
            # Google often returns 'ROOFTOP', 'RANGE_INTERPOLATED' for precise geocodes.
            # 'GEOMETRIC_CENTER', 'APPROXIMATE' are less precise.
            # Let's consider a good match if it's in UAE and geometry type suggests precision
            location_type = result.get('geometry', {}).get('location_type')
            is_precise_enough = location_type in ['ROOFTOP', 'RANGE_INTERPOLATED']

            result_types = set(result.get('types', []))
            has_required_type = any(t in REQUIRED_AREA_TYPES for t in result_types)

            distance = haversine(location_data['longitude'], location_data['latitude'], # Corrected variable name
                               result['geometry']['location']['lng'], result['geometry']['location']['lat'])
            is_within_distance = distance <= MAX_DISTANCE_METERS

            if is_uae and is_precise_enough and has_required_type and is_within_distance:
                confidence = calculate_confidence(location_data, result)
                logging.info(f"  Geocoding Match (Precise, UAE, Valid Type, Within Distance): Confidence {confidence:.3f}, Dist: {distance:.1f}m")
                if confidence >= CONFIDENCE_THRESHOLD_HIGH:
                    final_result.update({
                        'match_status': 'accepted',
                        'place_id': result.get('place_id'),
                        'name': result.get('address_components')[0].get('long_name'), # Often better than formatted address
                        'address': result.get('formatted_address'),
                        'latitude': result['geometry']['location']['lat'],
                        'longitude': result['geometry']['location']['lng'],
                        'bounds': result['geometry'].get('viewport') or result['geometry'].get('bounds'),
                        'confidence': confidence,
                        'method': 'Geocoding',
                        'google_types': result.get('types', []),
                        'distance_meters': distance
                    })
                    return final_result
                elif confidence >= CONFIDENCE_THRESHOLD_MEDIUM:
                    # Medium confidence geocode might still be the best, flag for review
                    final_result.update({
                         'match_status': 'review',
                         'place_id': result.get('place_id'),
                         'name': result.get('address_components')[0].get('long_name'),
                         'address': result.get('formatted_address'),
                         'latitude': result['geometry']['location']['lat'],
                         'longitude': result['geometry']['location']['lng'],
                         'bounds': result['geometry'].get('viewport') or result['geometry'].get('bounds'),
                         'confidence': confidence,
                         'method': 'Geocoding',
                         'google_types': result.get('types', []),
                         'distance_meters': distance
                     })
                    # Continue to Places API to see if a better match exists?
                    # For now, let's accept medium geocodes for review and stop.
                    return final_result
            else:
                logging.info(f"  Geocoding result rejected. UAE: {is_uae}, RequiredType: {has_required_type}, WithinDistance: {is_within_distance}")

    # 2. Places API Fallback (if Geocoding failed or wasn't precise enough)
    logging.info("  Geocoding insufficient. Trying Places API...")
    best_place_result = None
    best_place_confidence = 0.0
    best_place_method = None

    # a. Places Text Search
    text_search_results = places_text_search(input_name)
    place_candidates = []
    if text_search_results and text_search_results.get('results'):
        logging.debug(f"  Places Text Search found {len(text_search_results['results'])} candidates.")
        place_candidates.extend(text_search_results['results'])

    # b. Places Nearby Search
    nearby_search_results = places_nearby_search(input_lat, input_lon)
    if nearby_search_results and nearby_search_results.get('results'):
        logging.debug(f"  Places Nearby Search found {len(nearby_search_results['results'])} candidates.")
        # Avoid adding duplicates found by text search
        existing_place_ids = {p['place_id'] for p in place_candidates}
        for place in nearby_search_results['results']:
            if place['place_id'] not in existing_place_ids:
                place_candidates.append(place)

    # c. Get Place Details and Evaluate Candidates
    if not place_candidates:
        logging.warning(f"  No Place candidates found for ID {input_id}.")
        return final_result # Return the initial rejected state

    processed_details_count = 0
    for candidate in place_candidates:
        place_id = candidate['place_id'] # Assign place_id earlier
        # Get Place Details
        details = get_place_details(candidate['place_id'])
        if details and details.get('result'):
            processed_details_count += 1
            place_details = details['result']
            is_uae = is_in_uae(place_details.get('address_components'))
            if not is_uae:
                logging.debug(f"    Skipping Place ID {place_id} (Not in UAE)")
                continue # Skip non-UAE results

            place_types = set(place_details.get('types', []))
            if not any(t in REQUIRED_AREA_TYPES for t in place_types):
                logging.debug(f"    Skipping candidate {place_details.get('name', 'N/A')} ({place_id}) due to unacceptable types: {place_types}")
                continue # Skip places that don't have required types

            candidate_confidence = calculate_confidence(location_data, place_details)
            logging.debug(f"    Candidate: {place_details.get('name', 'N/A')} ({place_id}), Confidence: {candidate_confidence:.3f}, Types: {place_types}")

            if candidate_confidence > best_place_confidence:
                best_place_confidence = candidate_confidence
                best_place_result = place_details
                best_place_method = 'Places Text Search' if any(p['place_id'] == candidate['place_id'] for p in text_search_results.get('results', [])) else 'Places Nearby Search'

    logging.info(f"  Processed details for {processed_details_count} place candidates.")

    # 3. Final Evaluation based on Places API results
    if best_place_result:
        best_place_location = best_place_result.get('geometry', {}).get('location', {})
        best_place_distance = None
        if 'lat' in best_place_location and 'lng' in best_place_location:
            best_place_distance = haversine(location_data['longitude'], location_data['latitude'], # Corrected variable name
                                          best_place_location['lng'], best_place_location['lat'])

        best_place_types = set(best_place_result.get('types', []))
        is_within_distance = best_place_distance is not None and best_place_distance <= MAX_DISTANCE_METERS
        has_required_type = any(t in REQUIRED_AREA_TYPES for t in best_place_types)

        if is_within_distance and has_required_type:
            logging.info(f"  Best Place Match: Confidence {best_place_confidence:.3f} via {best_place_method}, Dist: {best_place_distance:.1f}m")
            final_result['confidence'] = best_place_confidence
            final_result['place_id'] = best_place_result.get('place_id')
            final_result['name'] = best_place_result.get('name')
            final_result['address'] = best_place_result.get('formatted_address')
            final_result['latitude'] = best_place_location.get('lat')
            final_result['longitude'] = best_place_location.get('lng')
            final_result['bounds'] = best_place_result.get('geometry', {}).get('viewport') or best_place_result.get('geometry', {}).get('bounds')
            final_result['method'] = best_place_method
            final_result['google_types'] = best_place_result.get('types', [])
            final_result['distance_meters'] = best_place_distance

            if best_place_confidence >= CONFIDENCE_THRESHOLD_HIGH:
                final_result['match_status'] = 'accepted'
            elif best_place_confidence >= CONFIDENCE_THRESHOLD_MEDIUM:
                final_result['match_status'] = 'review'
            else:
                final_result['match_status'] = 'rejected'
        else:
            # Reject if distance or type criteria are not met, regardless of confidence
            logging.info(f"  Best Place Match Rejected. WithinDistance: {is_within_distance}, RequiredType: {has_required_type}")
            final_result['match_status'] = 'rejected'
            # Keep some details for review even if rejected based on distance/type
            final_result['place_id'] = best_place_result.get('place_id')
            final_result['name'] = best_place_result.get('name')
            final_result['address'] = best_place_result.get('formatted_address')
            final_result['latitude'] = best_place_location.get('lat')
            final_result['longitude'] = best_place_location.get('lng')
            final_result['bounds'] = best_place_result.get('geometry', {}).get('viewport') or best_place_result.get('geometry', {}).get('bounds')
            final_result['method'] = best_place_method
            final_result['google_types'] = best_place_result.get('types', [])
            final_result['distance_meters'] = best_place_distance
            final_result['confidence'] = best_place_confidence # Store original confidence for review

    else:
        logging.info("  No suitable match found via Geocoding or Places API.")
        final_result['match_status'] = 'rejected'

    return final_result

# --- Main Execution ---

def main(input_file, output_file, max_workers, limit):
    # Load input data
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            locations = json.load(f)
    except FileNotFoundError:
        logging.error(f"Input file not found: {input_file}")
        return
    except json.JSONDecodeError:
        logging.error(f"Error decoding JSON from file: {input_file}")
        return

    logging.info(f"Loaded {len(locations)} locations from {input_file}")
    if not locations:
         logging.warning("Input file is empty. Exiting.")
         return

    # Apply limit if provided
    locations_to_process = locations
    if limit is not None and limit > 0:
        locations_to_process = locations[:limit]
        logging.info(f"Processing only the first {len(locations_to_process)} locations due to --limit flag.")

    # Use ThreadPoolExecutor for concurrent API calls respecting rate limits
    results = []
    start_time = time.time()
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit tasks for the limited set
        futures = {executor.submit(process_location, loc): loc for loc in locations_to_process}

        # Process completed tasks
        for i, future in enumerate(as_completed(futures)):
            location_data = futures[future]
            input_id = location_data['id']
            try:
                result = future.result()
                results.append(result)
                logging.info(f"Completed {i + 1}/{len(locations_to_process)} (ID: {input_id}, Status: {result['match_status']})")
            except Exception as exc:
                logging.error(f"Location ID {input_id} generated an exception: {exc}")
                # Add a placeholder error result if needed
                results.append({ 'input_id': input_id, 'error': str(exc) })

    end_time = time.time()
    logging.info(f"Processing completed in {end_time - start_time:.2f} seconds.")

    # Ensure output directory exists
    output_dir = os.path.dirname(output_file)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Save results
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        logging.info(f"Results saved to {output_file}")
    except IOError as e:
        logging.error(f"Error writing output file {output_file}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Map locations using Google Maps APIs.')
    parser.add_argument('-i', '--input', default='../data/input/UAE_neighborhoods.json',
                        help='Path to the input JSON file.')
    parser.add_argument('-o', '--output', default='../data/output/mapped_locations.json',
                        help='Path to the output JSON file.')
    parser.add_argument('-w', '--workers', type=int, default=min(10, MAX_QPS), # Limit workers by QPS
                        help='Number of concurrent workers for API calls.')
    parser.add_argument('-l', '--limit', type=int, default=None,
                        help='Limit processing to the first N locations.')

    args = parser.parse_args()

    main(args.input, args.output, args.workers, args.limit)

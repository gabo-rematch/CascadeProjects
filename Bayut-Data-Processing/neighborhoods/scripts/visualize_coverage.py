import json
import folium
import os
import webbrowser

# File paths (relative to script location)
INPUT_FILE = '../data/final/final_uae_locations.json'
OUTPUT_MAP_FILE = '../coverage_map.html'

def create_coverage_map():
    print(f"Loading final UAE data from {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            locations = json.load(f)
    except FileNotFoundError:
        print(f"Error: Input file {INPUT_FILE} not found. Run check_uae_locations.py first.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {INPUT_FILE}.")
        return

    print(f"Loaded {len(locations)} locations.")

    # Filtering step removed as input file is already filtered
    valid_locations = locations # Directly use the loaded locations

    if not valid_locations:
        print("No valid locations found to plot.")
        return

    # Estimate center of UAE for initial map view
    # Roughly between Abu Dhabi and Dubai
    map_center = [24.4539, 54.3773] # Abu Dhabi as a starting point
    
    # Create base map
    # Use 'CartoDB positron' tiles for cleaner look and better English label support
    m = folium.Map(location=map_center, zoom_start=8, tiles='CartoDB positron')

    plot_count = 0
    # 2. Plot locations with bounds
    for loc in valid_locations:
        bounds = loc.get('google_bounds')
        
        # Check if bounds exist and are in the expected nested dictionary format
        if (
            bounds and 
            isinstance(bounds, dict) and 
            'northeast' in bounds and isinstance(bounds['northeast'], dict) and
            'southwest' in bounds and isinstance(bounds['southwest'], dict) and
            'lat' in bounds['northeast'] and 'lng' in bounds['northeast'] and
            'lat' in bounds['southwest'] and 'lng' in bounds['southwest']
        ):
            try:
                ne = bounds['northeast']
                sw = bounds['southwest']
                # Ensure coordinates are valid floats
                bounds_coords = [
                    [float(sw['lat']), float(sw['lng'])],
                    [float(ne['lat']), float(ne['lng'])]
                ]
                
                # Determine name for popup
                popup_name = loc.get('google_name')
                if not popup_name:
                    popup_name = loc.get('title', {}).get('en', f"ID: {loc.get('id', 'N/A')}")
                    
                tooltip_text = f"{popup_name}\nID: {loc.get('id', 'N/A')}"
                popup_html = f"<b>{popup_name}</b><br>ID: {loc.get('id', 'N/A')}<br>Address: {loc.get('google_formatted_address', 'N/A')}"
                
                # Add rectangle
                folium.Rectangle(
                    bounds=bounds_coords,
                    popup=folium.Popup(popup_html, max_width=300),
                    tooltip=tooltip_text,
                    color='#ff7800',
                    fill=True,
                    fill_color='#ffff00',
                    fill_opacity=0.2
                ).add_to(m)
                plot_count += 1
            except (TypeError, ValueError) as e:
                print(f"  Skipping location ID {loc.get('id', 'N/A')}: Invalid coordinate data in bounds - {e}")
        else:
             print(f"  Skipping location ID {loc.get('id', 'N/A')}: Missing or invalid bounds structure.")

    print(f"\nPlotted {plot_count} locations with valid bounds.")

    # Save map to HTML file
    try:
        m.save(OUTPUT_MAP_FILE)
        print(f"Map saved to {OUTPUT_MAP_FILE}")
        
        # Attempt to open the map in the default web browser
        try:
            filepath = os.path.abspath(OUTPUT_MAP_FILE)
            webbrowser.open(f'file://{filepath}')
            print("Attempted to open the map in your default browser.")
        except Exception as e:
            print(f"Could not automatically open the map: {e}")
            print(f"Please open the file manually: {os.path.abspath(OUTPUT_MAP_FILE)}")
            
    except Exception as e:
        print(f"Error saving map: {e}")

if __name__ == "__main__":
    create_coverage_map()

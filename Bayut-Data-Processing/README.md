# Bayut Data Processing

This repository contains scripts and data for processing and analyzing Bayut property data for the UAE, primarily focusing on mapping neighborhoods and potentially buildings using Google Maps APIs.

## Project Structure

```
Bayut-Data-Processing/
├── neighborhoods/
│   ├── data/
│   │   ├── input/           # Original input data
│   │   │   └── UAE_neighborhoods.json
│   │   └── output/          # Output from the mapping process
│   │       └── mapped_locations.json
│   └── scripts/            # Processing and review scripts
│       ├── google_maps_mapper.py   # Maps locations using Google Maps API
│       ├── review_ui.html          # Static HTML UI for reviewing mapped locations
│       └── visualize_coverage.py   # Creates interactive coverage map
├── buildings/
│   ├── data/              # Building data
│   │   └── bayut_buildings.json
│   └── scripts/           # Building processing scripts
│       └── filter_json.py
├── requirements.txt       # Python dependencies
└── README.md              # This file
```
*(Note: A `.env` file is recommended in the project root to store the `GOOGLE_MAPS_API_KEY`)*

## Neighborhoods Processing Workflow

1.  **Automated Mapping:**
    *   **Script:** `neighborhoods/scripts/google_maps_mapper.py`
    *   **Input:** `neighborhoods/data/input/UAE_neighborhoods.json`
    *   **Output:** `neighborhoods/data/output/mapped_locations.json` (Timestamped initially, rename or use the latest)
    *   **Action:** Reads input locations, attempts to map them using Google Maps Geocoding and Places APIs, calculates confidence scores, and assigns an initial `match_status` (`accepted`, `review`, `rejected`). Requires `GOOGLE_MAPS_API_KEY` environment variable.

2.  **Manual Review & Correction:**
    *   **UI:** `neighborhoods/scripts/review_ui.html`
    *   **Input:** `neighborhoods/data/output/mapped_locations.json`
    *   **Output:** A downloaded `mapped_locations_updated.json` file.
    *   **Action:**
        *   Serve the `neighborhoods` directory using a simple local HTTP server (see Setup).
        *   Open `review_ui.html` in your browser.
        *   Filter and review the mappings. Use the "Accept" and "Reject" buttons to override the `match_status`. Reviewed items are hidden from view.
        *   Click "Download Updated JSON" to save the results (including your changes and the `reviewed` flag).
        *   **Crucially:** Manually replace the `neighborhoods/data/output/mapped_locations.json` file with the downloaded `mapped_locations_updated.json` file.

3.  **Visualization (Optional):**
    *   **Script:** `neighborhoods/scripts/visualize_coverage.py`
    *   **Input:** `neighborhoods/data/output/mapped_locations.json` (after review)
    *   **Output:** `neighborhoods/scripts/coverage_map.html`
    *   **Action:** Creates an interactive Folium map showing the final mapped locations.

## Buildings Processing

The `buildings` directory contains scripts for processing building data. Currently includes:
- `filter_json.py`: Filters buildings based on specific criteria (e.g., level). *(Further development planned)*

## Requirements

*   Python 3.9+
*   Required Python packages listed in `requirements.txt`. Install using `pip install -r requirements.txt`.
*   Google Maps API Key (set as `GOOGLE_MAPS_API_KEY` environment variable, e.g., in a `.env` file).
*   A modern web browser (for the `review_ui.html`).
*   (Optional) `python-dotenv` package if using a `.env` file (`pip install python-dotenv`).

## Setup

1.  **Clone the repository.**
2.  **Install Python dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Set up environment variables:**
    *   Create a `.env` file in the project root directory (`Bayut-Data-Processing/`).
    *   Add your Google Maps API key to the `.env` file:
        ```
        GOOGLE_MAPS_API_KEY='YOUR_API_KEY_HERE'
        ```
4.  **Run the Neighborhood Mapping:**
    ```bash
    # Ensure your API key is set in the environment or .env file
    python neighborhoods/scripts/google_maps_mapper.py
    ```
    *   This will create a timestamped JSON file in `neighborhoods/data/output/`. Rename the latest one to `mapped_locations.json` or modify the script/UI to load the latest automatically.

5.  **Run the Review UI:**
    *   Navigate to the `neighborhoods` directory in your terminal:
        ```bash
        cd neighborhoods
        ```
    *   Start a simple Python HTTP server:
        ```bash
        # For Python 3
        python -m http.server 8001
        # Or if you have Python 2 (less common now)
        # python -m SimpleHTTPServer 8001
        ```
    *   Open your web browser and go to: `http://localhost:8001/scripts/review_ui.html`
    *   Review the data as described in the Workflow section. Remember to replace the `mapped_locations.json` file after downloading your changes.

6.  **Run Visualization (Optional):**
    ```bash
    python neighborhoods/scripts/visualize_coverage.py
    ```
    *   Open the generated `neighborhoods/scripts/coverage_map.html` in your browser.

## To-Do / Next Steps

*   **Neighborhood Review:** Complete the manual review of locations using `review_ui.html`.
*   **Building Mapping:** Implement a similar mapping and review process for the building data (`buildings/data/bayut_buildings.json`).
    *   Create a `buildings/scripts/google_maps_mapper.py` (or adapt the neighborhoods one).
    *   Create a `buildings/scripts/review_ui.html`.
*   **Refine Mapping Logic:** Potentially further refine the confidence scoring or matching logic in `google_maps_mapper.py` based on review results.
*   **Error Handling:** Improve error handling and logging in scripts.
*   **Automation:** Consider ways to automate the renaming/replacement of the `mapped_locations.json` file after review (though this might require backend changes).

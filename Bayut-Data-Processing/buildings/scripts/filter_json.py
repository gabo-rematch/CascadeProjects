import json
import sys
import os
import argparse

# File paths (relative to script location)
INPUT_FILE = '../data/bayut_buildings.json'
OUTPUT_FILE = '../data/filtered_buildings.json'

def filter_json_by_level(input_path, output_path, data_key="data", level=4):
    """Reads a JSON file containing a dictionary, extracts a list from data_key,
       filters objects by 'level', and writes to a new file."""
    try:
        with open(input_path, 'r', encoding='utf-8') as infile:
            data = json.load(infile)

        if not isinstance(data, dict):
            print(f"Error: Expected a JSON dictionary in {input_path}, but got {type(data)}.", file=sys.stderr)
            sys.exit(1)

        if data_key not in data:
            print(f"Error: Key '{data_key}' not found in the JSON dictionary in {input_path}.", file=sys.stderr)
            sys.exit(1)

        location_list = data.get(data_key)

        if not isinstance(location_list, list):
            print(f"Error: Expected a JSON list under the key '{data_key}' in {input_path}, but got {type(location_list)}.", file=sys.stderr)
            sys.exit(1)

        filtered_data = [obj for obj in location_list if isinstance(obj, dict) and obj.get('level') == level]

        # Ensure the output directory exists
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)

        # Prepare the output structure (optional, depending on desired output format)
        # Option 1: Output only the filtered list
        output_json = filtered_data
        # Option 2: Output a dictionary with the 'data' key containing the filtered list
        # output_json = {data_key: filtered_data}

        with open(output_path, 'w', encoding='utf-8') as outfile:
            # Using output_json which currently is just the list
            json.dump(output_json, outfile, indent=2, ensure_ascii=False)

        print(f"Successfully filtered JSON. Output written to: {output_path}")
        print(f"Original objects in '{data_key}': {len(location_list)}, Filtered objects (level={level}): {len(filtered_data)}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_path}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {input_path}. Please ensure it's valid JSON.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Filter JSON data based on the 'level' key.")
    parser.add_argument("input_json_path", help="Path to the input JSON file.", default=INPUT_FILE)
    parser.add_argument("output_json_path", help="Path to save the filtered JSON file.", default=OUTPUT_FILE)
    parser.add_argument("-l", "--level", type=int, default=4, help="The level value to filter by (default: 4).")
    parser.add_argument("-k", "--key", default="data", help="The key in the JSON dictionary containing the list to filter (default: 'data').")

    args = parser.parse_args()

    filter_json_by_level(args.input_json_path, args.output_json_path, data_key=args.key, level=args.level)

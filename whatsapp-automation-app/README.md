# WhatsApp Messaging Automation App

This application automates sending WhatsApp messages based on a list of phone numbers and messages provided via a CSV file. It includes features for human-like random delays between messages.

Future enhancements will allow importing data from Supabase.

## Features

- Reads data from CSV (phone number, message body).
- Sends messages via a custom API endpoint.
- Implements randomized delays between messages.
- Structured for future Supabase integration.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn

### Installation

1. Clone the repository (or set up based on these files).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file by copying `config/sample.env` to `config/.env` and fill in the required environment variables.

### Running the App

- To build the project:
  ```bash
  npm run build
  ```
- To run the application:
  ```bash
  npm start
  ```
- To run in development mode with auto-reloading:
  ```bash
  npm start:dev
  ```

## Configuration

Environment variables are managed in `config/.env`. See `config/sample.env` for required variables like:

- `CUSTOM_API_ENDPOINT`: The URL of your custom WhatsApp API.
- `MIN_DELAY_MS`: Minimum delay in milliseconds.
- `MAX_DELAY_MS`: Maximum delay in milliseconds.

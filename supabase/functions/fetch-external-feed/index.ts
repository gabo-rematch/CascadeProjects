import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

console.log('Fetch External Feed Function Initializing')

// Define allowed origins - adjust as needed for production
const allowedOrigins = [
  'http://localhost:3000', // Example: Local React dev server
  'http://127.0.0.1:53282', // Cascade Browser Preview origin
  // Add your production frontend URL here
];

serve(async (req) => {
  const origin = req.headers.get('Origin') || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0], // Allow specific origin or fallback
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST for body, OPTIONS for preflight
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing parameter: url is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Validate URL format (basic)
    try {
      new URL(url);
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Invalid URL format.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Fetching content from external URL: ${url}`);

    // Fetch the content from the external URL using Deno's fetch
    const response = await fetch(url, {
        headers: {
            // Add any specific headers the target feed might require, e.g., User-Agent
            'User-Agent': 'SupabaseProxy/1.0'
        }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from external URL: ${response.status} ${response.statusText}`);
    }

    const content = await response.text(); // Get content as text (assuming XML/CSV)
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';

    console.log(`Successfully fetched content. Type: ${contentType}, Size: ${content.length}`);

    return new Response(JSON.stringify({ success: true, content: content, contentType: contentType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in fetch-external-feed function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Import Processor Function Initializing')

// IMPORTANT: Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
// in your Supabase project's environment variables!
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use Service Role Key for backend!
  { auth: { persistSession: false } } // Recommended for serverless functions
)

serve(async (req) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 
      'Access-Control-Allow-Origin': '*', // Adjust for production
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } })
  }

  try {
    // 2. Parse request body
    const { targetTable, dataChunk } = await req.json()

    if (!targetTable || !dataChunk || !Array.isArray(dataChunk) || dataChunk.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters: targetTable and dataChunk (non-empty array) are required.' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 400,
      })
    }

    console.log(`Received request for table: ${targetTable}, chunk size: ${dataChunk.length}`);
    // console.log('First record in chunk:', dataChunk[0]);

    // 3. Implement Supabase Upsert Logic Here
    const uniqueColumn = 'property_ref_no'; // <<< CONFIRM this is your unique identifier for wa_group_listings

    if (!uniqueColumn) {
       throw new Error('Unique column (onConflict) not specified for upsert.');
    }

    console.log(`Attempting upsert on ${targetTable} with onConflict: ${uniqueColumn}`);

    const { data, error } = await supabaseClient
      .from(targetTable)
      .upsert(dataChunk, {
        onConflict: uniqueColumn,
        // ignoreDuplicates: false, // Default is false. Set true to only insert new records.
      });

    if (error) {
      console.error('Supabase upsert error:', error);
      // Consider logging specific failed records if possible/needed
      throw new Error(`Supabase upsert failed: ${error.message}`);
    }

    // Supabase upsert in v2 might return null for data on success or just the affected rows.
    // It doesn't reliably give counts of added/updated/failed directly.
    // We'll return the total processed count as a placeholder for success.
    // For detailed counts, you might need pre-checks or more complex logic.
    console.log(`Upsert successful for chunk. Processed count (potential adds/updates): ${dataChunk.length}`);

    // Placeholder success response (counts are simplified)
    const results = {
      added: dataChunk.length, // Simplified: Assuming all were potentially added/updated
      updated: 0,          // Simplified: Upsert handles updates, but count isn't directly returned
      failed: 0,           // If we get here, the batch didn't fail overall
      errors: [],          // Placeholder for potential row-level errors if implemented
    }

    console.log(`Simulated processing for ${targetTable}. Results:`, results);

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    })

  } catch (error) {
    console.error('Error processing import request:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 500,
    })
  }
})

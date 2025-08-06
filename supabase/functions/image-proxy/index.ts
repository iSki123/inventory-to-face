import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrls } = await req.json();
    
    if (!imageUrls || !Array.isArray(imageUrls)) {
      return new Response(JSON.stringify({ error: 'imageUrls array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloading ${imageUrls.length} images...`);

    const results = await Promise.allSettled(
      imageUrls.map(async (url, index) => {
        try {
          console.log(`Downloading image ${index + 1}: ${url}`);
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Referer': new URL(url).origin,
              'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
              'Accept-Encoding': 'gzip, deflate, br',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.startsWith('image/')) {
            throw new Error(`Invalid content type: ${contentType}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          console.log(`Successfully downloaded image ${index + 1}, size: ${arrayBuffer.byteLength} bytes`);
          
          return {
            success: true,
            url,
            base64: `data:${contentType};base64,${base64}`,
            contentType,
            size: arrayBuffer.byteLength
          };
        } catch (error) {
          console.error(`Failed to download image ${index + 1} (${url}):`, error.message);
          return {
            success: false,
            url,
            error: error.message
          };
        }
      })
    );

    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          url: imageUrls[index],
          error: result.reason?.message || 'Unknown error'
        };
      }
    });

    const successCount = processedResults.filter(r => r.success).length;
    console.log(`Image processing complete: ${successCount}/${imageUrls.length} successful`);

    return new Response(JSON.stringify({ 
      results: processedResults,
      summary: {
        total: imageUrls.length,
        successful: successCount,
        failed: imageUrls.length - successCount
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in image-proxy function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Failed to process image download request'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
const SUPABASE_EDGE_URL = "https://egzquylwclewcgpqnoig.supabase.co/functions/v1/osm-counter-tactics".trim();
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const calculateTactic = async (payload: any) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  
  try {
    const response = await fetch(SUPABASE_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${ANON_KEY}`,
        "apikey": ANON_KEY,
        "X-Client-Version": "8.2.0"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "Tactic calculation failed");
    }
    
    return result.strategy;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as any).name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
};
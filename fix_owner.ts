import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://xtgztxbbkduxfcaocjhh.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z3p0eGJia2R1eGZjYW9jamhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjY3OTMsImV4cCI6MjA4NTAwMjc5M30._fYCizbbpv1mkyd2qNufDVLOFRc-wI5Yo6zKA3Mp4Og');

async function fix() {
  const { data: b } = await supabase.from('farm_activity_logs').select('*');
  console.log("Total logs:", b?.length);
  if (b) {
    for (const p of b) {
      if (JSON.stringify(p).toLowerCase().includes("kiri") || p.farmer_phone?.includes("Lavina")) {
         console.log("Found:", p.id, p);
         const { error } = await supabase.from('farm_activity_logs').update({ farmer_phone: '+254726838526' }).eq('id', p.id);
         console.log("Updated?", error);
      }
    }
  }
}

fix();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://djpchzaaycmvhoalxmam.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqcGNoemFheWNtdmhvYWx4bWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2NTIwNzEsImV4cCI6MjA4MDIyODA3MX0._ryXdmvuLGpsrJSKuoIr5Ohq-s6tE3olOaZ9M9TyVw4';

export const supabase = createClient(supabaseUrl, supabaseKey);
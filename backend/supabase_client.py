#from supabase import create_client

#SUPABASE_URL = "https://iqfhgjrzkyscaixddkbj.supabase.co"
#SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlxZmhnanJ6a3lzY2FpeGRka2JqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM3NTM2OSwiZXhwIjoyMDg3OTUxMzY5fQ.llc7AHeRsfEVHVSelNjGTcp7dGoLWvLWa1vZCj2nxRU"

#supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL or SUPABASE_KEY is missing")

    return create_client(url, key)
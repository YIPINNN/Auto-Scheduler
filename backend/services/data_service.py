from supabase_client import supabase

def get_tasks():
    response = supabase.table("tasks").select("*").execute()
    return response.data

def get_technicians():
    response = supabase.table("technicians").select("*").execute()
    return response.data

def save_assignments(data):
    supabase.table("assignments").insert(data).execute()
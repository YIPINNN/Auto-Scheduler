from backend.supabase_client import supabase
import re

def get_tickets():
    return supabase.table("Ticket").select("*").execute().data

def get_technicians():
    return supabase.table("Technician").select("*").execute().data

def get_target_groups():
    return supabase.table("TargetGroup").select("*").execute().data

def get_job_titles():
    return supabase.table("JobTitle").select("*").execute().data

def get_group_levels():
    return supabase.table("GroupLevel").select("*").execute().data

def get_group_job_bridge():
    return supabase.table("Group_Job_bridge").select("*").execute().data

def get_alarm_code():
    return supabase.table("AlarmCode").select("*").execute().data


def save_assignments(data):
    supabase.table("assignments").insert(data).execute()

def save_scenario_to_supabase(scenario_name, assignments):
    """Saves the final MATLAB JSON result into the history table."""
    try:
        data = {
            "scenario_name": scenario_name,
            "result_data": assignments # This matches the jsonb column
        }
        return supabase.table("Optimization_Results").insert(data).execute()
    except Exception as e:
        print(f"Error saving scenario: {e}")
        return None
    
def sync_tickets_to_supabase(ticket_data_list, file_name):
    """
    ticket_data_list should now be a list of dictionaries: 
    [{'id': '3', 'alarm': '161', 'group': 'DPLevel2'}, ...]
    """
    for item in ticket_data_list:
        try:
            supabase.table("Ticket").upsert({
                "TicketID": int(item['id']),
                "alarmCode": str(item['alarm']),
                "targetGroup": str(item['group']),
                "machineName": f"Machine_{item['id']}",
                "status": "pending",
                "LineName": file_name
            }).execute()
        except Exception as e:
            print(f"Error syncing {item['id']}: {e}")

def sync_final_results_to_tickets(assignments, tech_map, file_name, ticket_details_map):
    """
    Updates existing tickets or inserts new ones, ensuring attendByName 
    and attendById are always updated together based on the TicketID.
    """
    print(f"\n--- 🛰️ STARTING DATABASE SYNC (Update Mode) ---")
    
    for entry in assignments:
        # Get the technician info from our map
        tech_id = str(entry.get('tech'))
        tech_name = tech_map.get(tech_id) or f"Tech {tech_id}"
        
        for t_id in entry.get('tickets', []):
            try:
                # 1. Clean Ticket ID (ensure it's an integer)
                t_id_str = str(t_id)
                t_id_int = int(re.sub(r'\D', '', t_id_str))
                
                # 2. Get technical details (alarm/group) from our map
                details = ticket_details_map.get(t_id_str, {})
                
                # 3. Prepare the data payload
                # We update Name and ID together here
                ticket_payload = {
                    "attendByName": tech_name,
                    "attendById": tech_id,
                    "status": "pending",
                    "alarmCode": str(details.get('alarm', '0')),
                    "targetGroup": str(details.get('group', 'TECH')),
                    "LineName": file_name
                }
                
                # 4. Check if the ticket already exists in the DB
                existing = supabase.table("Ticket") \
                    .select("TicketID") \
                    .eq("TicketID", t_id_int) \
                    .execute()
                
                if existing.data and len(existing.data) > 0:
                    # UPDATE existing record using TicketID as the filter
                    supabase.table("Ticket") \
                        .update(ticket_payload) \
                        .eq("TicketID", t_id_int) \
                        .execute()
                    print(f"✅ UPDATED: Ticket #{t_id_int} -> Assigned to {tech_name} ({tech_id})")
                else:
                    # INSERT new record if it doesn't exist
                    ticket_payload["TicketID"] = t_id_int
                    ticket_payload["machineName"] = f"Machine_{t_id_int}"
                    supabase.table("Ticket").insert(ticket_payload).execute()
                    print(f"🆕 CREATED: Ticket #{t_id_int} -> Assigned to {tech_name} ({tech_id})")
                
            except Exception as e:
                print(f"❌ DATABASE SYNC ERROR on Ticket {t_id}: {str(e)}")

    print(f"--- 🛰️ DATABASE SYNC FINISHED ---\n")
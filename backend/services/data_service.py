from backend.supabase_client import get_supabase
import re
import time


def get_tickets():
    supabase = get_supabase()
    return supabase.table("Ticket").select("*").execute().data


def get_technicians():
    supabase = get_supabase()
    return supabase.table("Technician").select("*").execute().data


def get_target_groups():
    supabase = get_supabase()
    return supabase.table("TargetGroup").select("*").execute().data


def get_job_titles():
    supabase = get_supabase()
    return supabase.table("JobTitle").select("*").execute().data


def get_group_levels():
    supabase = get_supabase()
    return supabase.table("GroupLevel").select("*").execute().data


def get_group_job_bridge():
    supabase = get_supabase()
    return supabase.table("Group_Job_bridge").select("*").execute().data


def get_alarm_code():
    supabase = get_supabase()
    return supabase.table("AlarmCode").select("*").execute().data


def save_assignments(data):
    supabase = get_supabase()
    supabase.table("assignments").insert(data).execute()


def save_scenario_to_supabase(scenario_name, assignments, comp_time):
    """Saves the final MATLAB JSON result into the history table."""
    try:
        supabase = get_supabase()
        data = {
            "scenarioName": scenario_name,
            "resultData": assignments,
            "computationTime": comp_time
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
        for attempt in range(3):
            try:
                supabase = get_supabase()
                supabase.table("Ticket").upsert({
                    "ticketID": int(item['id']),
                    "alarmCode": str(item['alarm']),
                    "targetGroup": str(item['group']),
                    "machineName": f"Machine_{item['id']}",
                    "status": "pending",
                    "lineName": file_name
                }).execute()
                break
            except Exception as e:
                print(f"Error syncing {item['id']} (attempt {attempt + 1}): {e}")
                if attempt == 2:
                    print(f"⚠️ GAVE UP syncing {item['id']} after 3 attempts")
                time.sleep(1.5)


def sync_final_results_to_tickets(assignments, tech_map, file_name, ticket_details_map):
    print("\n--- 🛰️ STARTING DATABASE SYNC (Update Mode) ---")

    # 1. Identify which tickets were assigned by the algorithm
    assigned_ticket_ids = set()
    for entry in assignments:
        for t_id in entry.get('tickets', []):
            assigned_ticket_ids.add(str(t_id))

    # 2. Build a full list of all tickets to process (Assigned + Unassigned)
    full_sync_list = []

    # Add Assigned
    for entry in assignments:
        t_tech_id = str(entry.get('tech'))
        t_tech_name = tech_map.get(t_tech_id) or f"Tech {t_tech_id}"
        for tid in entry.get('tickets', []):
            full_sync_list.append({
                "tid": tid, 
                "tech_id": t_tech_id, 
                "tech_name": t_tech_name, 
                "status": "pending"
            })

    # Add Unassigned (IDs present in input map but NOT in the assigned set)
    for tid in ticket_details_map.keys():
        if str(tid) not in assigned_ticket_ids:
            full_sync_list.append({
                "tid": tid, 
                "tech_id": None, 
                "tech_name": "Unassigned", 
                "status": "unassigned"
            })

    # 3. Process every ticket using your original logic
    for item in full_sync_list:
        t_id_str = str(item["tid"])
        
        for attempt in range(5):
            try:
                supabase = get_supabase()
                t_id_int = int(re.sub(r'\D', '', t_id_str))
                details = ticket_details_map.get(t_id_str, {})

                ticket_payload = {
                    "attendByName": item["tech_name"],
                    "attendById": item["tech_id"],
                    "status": item["status"],
                    "alarmCode": str(details.get('alarm', '0')),
                    "targetGroup": str(details.get('group', 'TECH')),
                    "lineName": file_name
                }

                # Check if exists
                existing = (
                    supabase.table("Ticket")
                    .select("ticketID")
                    .eq("ticketID", t_id_int)
                    .execute()
                )

                if existing.data and len(existing.data) > 0:
                    # Update existing
                    supabase.table("Ticket").update(ticket_payload).eq("ticketID", t_id_int).execute()
                    print(f"✅ UPDATED: Ticket #{t_id_int} ({item['status']}) (attempt {attempt + 1})")
                else:
                    # Insert new
                    ticket_payload["ticketID"] = t_id_int
                    ticket_payload["machineName"] = f"Machine_{t_id_int}"
                    supabase.table("Ticket").insert(ticket_payload).execute()
                    print(f"🆕 CREATED: Ticket #{t_id_int} ({item['status']}) (attempt {attempt + 1})")

                time.sleep(1)
                break

            except Exception as e:
                print(f"❌ ERROR Ticket {t_id_str} (attempt {attempt + 1}): {str(e)}")
                if attempt == 4:
                    print(f"⚠️ GAVE UP on Ticket {t_id_str} after 5 attempts")
                time.sleep(2)

    print("--- 🛰️ DATABASE SYNC FINISHED ---\n")
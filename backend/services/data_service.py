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
            "scenario_name": scenario_name,
            "result_data": assignments,
            "computation_time": comp_time
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
                    "TicketID": int(item['id']),
                    "alarmCode": str(item['alarm']),
                    "targetGroup": str(item['group']),
                    "machineName": f"Machine_{item['id']}",
                    "status": "pending",
                    "LineName": file_name
                }).execute()
                break
            except Exception as e:
                print(f"Error syncing {item['id']} (attempt {attempt + 1}): {e}")
                if attempt == 2:
                    print(f"⚠️ GAVE UP syncing {item['id']} after 3 attempts")
                time.sleep(1.5)


def sync_final_results_to_tickets(assignments, tech_map, file_name, ticket_details_map):
    print("\n--- 🛰️ STARTING DATABASE SYNC (Update Mode) ---")

    for entry in assignments:
        tech_id = str(entry.get('tech'))
        tech_name = tech_map.get(tech_id) or f"Tech {tech_id}"

        for t_id in entry.get('tickets', []):
            for attempt in range(5):
                try:
                    supabase = get_supabase()

                    t_id_str = str(t_id)
                    t_id_int = int(re.sub(r'\D', '', t_id_str))
                    details = ticket_details_map.get(t_id_str, {})

                    ticket_payload = {
                        "attendByName": tech_name,
                        "attendById": tech_id,
                        "status": "pending",
                        "alarmCode": str(details.get('alarm', '0')),
                        "targetGroup": str(details.get('group', 'TECH')),
                        "LineName": file_name
                    }

                    existing = (
                        supabase.table("Ticket")
                        .select("TicketID")
                        .eq("TicketID", t_id_int)
                        .execute()
                    )

                    if existing.data and len(existing.data) > 0:
                        (
                            supabase.table("Ticket")
                            .update(ticket_payload)
                            .eq("TicketID", t_id_int)
                            .execute()
                        )
                        print(f"✅ UPDATED: Ticket #{t_id_int} (attempt {attempt + 1})")
                    else:
                        ticket_payload["TicketID"] = t_id_int
                        ticket_payload["machineName"] = f"Machine_{t_id_int}"
                        supabase.table("Ticket").insert(ticket_payload).execute()
                        print(f"🆕 CREATED: Ticket #{t_id_int} (attempt {attempt + 1})")

                    time.sleep(1)
                    break

                except Exception as e:
                    print(f"❌ ERROR Ticket {t_id} (attempt {attempt + 1}): {str(e)}")
                    if attempt == 2:
                        print(f"⚠️ GAVE UP on Ticket {t_id} after 3 attempts")
                    time.sleep(2)

    print("--- 🛰️ DATABASE SYNC FINISHED ---\n")
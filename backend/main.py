import re
import time
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from backend.services.file_service import update_config_file, read_result
from backend.services.matlab_service import run_matlab
from backend.services.csv_service import save_all_to_csv
from backend.services.email_service import send_dispatch_notification
#from backend.supabase_client import supabase
from backend.supabase_client import get_supabase

# Import data services
from backend.services.data_service import (
    get_tickets,
    get_technicians,
    get_target_groups,
    get_job_titles,
    get_group_levels,
    get_group_job_bridge,
    get_alarm_code,
    save_scenario_to_supabase,
    sync_final_results_to_tickets 
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/optimize")
async def optimize(file: UploadFile = File(...), scenario_name: str = "New Scenario"):
    
    try:
        # 1. READ FILE CONTENT (8-16)
        content_bytes = await file.read()
        content_str = content_bytes.decode("utf-8").strip()
        
        # 2. FETCH SYSTEM STATE
        all_db_tickets = get_tickets() or []

        # 2b. FETCH TECHNICIANS & FILTER
        raw_techs = get_technicians() or []
        # ONLY use technicians where isAvailable is True
        all_techs = [t for t in raw_techs if t.get('isAvailable') == True]

        if not all_techs:
            return {"status": "error", "message": "No technicians are currently available for assignment!"}

        print(f"--- 👥 RESOURCE CHECK ---")
        print(f"Total Techs in DB: {len(raw_techs)}")
        print(f"Available for Assignment: {len(all_techs)}")
        
        print(f"--- DATABASE CHECK ---")

        attending_list = [
            t for t in all_db_tickets
            if str(t.get('status')).lower() == 'attending'
        ]

        db_schedulable_tickets = [
            t for t in all_db_tickets
            if str(t.get('status')).lower() in ['pending', 'unassigned']
        ]

        print(f"Attending (Locked): {len(attending_list)}")
        print(f"Pending + Unassigned for Scheduling: {len(db_schedulable_tickets)}")

        # 3. CONSTRUCT COMBINED QUEUE & TECHNICAL MAP
        final_input_rows = []
        ticket_details_map = {}
        added_ticket_ids = set()

        # Process existing pending + unassigned tickets from DB
        for t in db_schedulable_tickets:
            tid = str(t.get('ticketID'))
            acode = str(t.get('alarmCode') or "0")
            tgrp = str(t.get('targetGroup') or "TECH")

            if tid not in added_ticket_ids:
                final_input_rows.append(f"{tid} {acode} {tgrp}")
                ticket_details_map[tid] = {
                    'alarm': acode,
                    'group': tgrp
                }
                added_ticket_ids.add(tid)
            
        # Process new tickets from uploaded file
        file_lines = content_str.split('\n')
        start_idx = 1 if file_lines and file_lines[0].strip().isdigit() else 0

        for line in file_lines[start_idx:]:
            parts = line.split()
            if len(parts) >= 3:
                tid, acode, tgrp = parts[0], parts[1], parts[2]

                if tid not in added_ticket_ids:
                    final_input_rows.append(f"{tid} {acode} {tgrp}")
                    ticket_details_map[tid] = {
                        'alarm': acode,
                        'group': tgrp
                    }
                    added_ticket_ids.add(tid)

        # 4. WRITE INPUT.TXT
        total_count = len(final_input_rows)
        file_path = r"C:\Users\huiying\Desktop\Auto-Scheduler\Auto-Scheduler\output\input.txt"
        with open(file_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(f"{total_count}\n")
            for row in final_input_rows:
                f.write(f"{row}\n")

        # 5. WORKLOAD & TECHNICIAN CSV
        workload_map = {str(tech['employeeID']): 0 for tech in all_techs}
        for t in attending_list:
            t_id = str(t.get('attendById'))
            if t_id in workload_map: workload_map[t_id] += 1
            
        for tech in all_techs:
            tech['workload'] = workload_map.get(str(tech['employeeID']), 0)

        save_all_to_csv(all_techs, get_target_groups(), get_job_titles(), 
                        get_group_levels(), get_group_job_bridge(), get_alarm_code())
        
        # --- START CORE TIMER ---
        algo_start = time.time()

        # 6. EXECUTE MATLAB
        update_config_file()
        run_matlab()

        algo_duration = time.time() - algo_start
        print(f"⚡ MO-SAHH Core Computation Time: {algo_duration:.4f}s")

        # 7. PROCESS RESULTS
        full_data = read_result()
        assignments = full_data.get("assignments", [])
        
        # --- NEW: Identify Unassigned Tickets ---
        assigned_ticket_ids = set()
        for entry in assignments:
            for t_id in entry.get('tickets', []):
                assigned_ticket_ids.add(str(t_id))

        unassigned_tickets = []
        for tid, details in ticket_details_map.items():
            if tid not in assigned_ticket_ids:
                unassigned_tickets.append({
                    "ticketID": tid,
                    "alarmCode": details['alarm'],
                    "targetGroup": details['group'],
                    "status": "Unassigned", # Mark clearly for frontend
                    "attendById": None      # Explicitly null
                })
        
        # Log for debugging
        print(f"Total Tickets: {len(ticket_details_map)}")
        print(f"Assigned: {len(assigned_ticket_ids)}")
        print(f"Unassigned: {len(unassigned_tickets)}")

        # Save to Supabase (Add 'computation_time' to your save function)
        save_scenario_to_supabase(
            scenario_name=scenario_name, 
            assignments=assignments, 
            comp_time=algo_duration # Pass the duration here
        )
        
        # --- NEW: Reverse ticket order for chronological Gantt display ---
        # This makes the last ticket in the text output the FIRST ticket on the chart
        for entry in assignments:
            if "tickets" in entry:
                entry["tickets"].reverse() 
        
        tech_map = {str(t['employeeID']): t['fullName'] for t in all_techs}
        
        # 8. SYNC RESULTS WITH TECHNICAL DETAILS PRESERVED
        # Note: You must update sync_final_results_to_tickets in data_service.py 
        # to accept this 4th parameter (ticket_details_map)
        sync_final_results_to_tickets(assignments, tech_map, file.filename, ticket_details_map)
        
        #save_scenario_to_supabase(scenario_name, assignments, algo_duration)

        # --- 9. AUTOMATIC NOTIFICATION TRIGGER ---
        print("--- TRIGGERING AUTOMATED DISPATCH ---")
        # Fetch tech emails for the assigned technicians
        for entry in assignments:
            tech_id_str = str(entry.get('tech'))
            target_tech = next((tech for tech in all_techs if str(tech['employeeID']) == tech_id_str), None)
            
            if target_tech and target_tech.get('email'):
                send_dispatch_notification(
                    tech_email=target_tech['email'],
                    tech_name=target_tech['fullName'],
                    ticket_list=entry.get('tickets', [])
                )

        return {
            "status": "success", 
            "result": assignments, 
            "computationTime": f"{algo_duration:.2f}s"
        }
    
            

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return {"status": "error", "message": str(e)}
    

@app.post("/resend-notification/{ticket_id}")
async def resend_notification(ticket_id: int):
    try:
        supabase = get_supabase()

        # Fetch ticket to find the technician
        ticket = supabase.table("Ticket").select("*").eq("ticketID", ticket_id).single().execute()
        if not ticket.data:
            return {"status": "error", "message": "Ticket not found"}
        
        tech_id = ticket.data['attendById']
        # Fetch technician to get email
        tech = supabase.table("Technician").select("*").eq("employeeID", tech_id).single().execute()
        
        if tech.data:
            success = send_dispatch_notification(
                tech.data['email'], 
                tech.data['fullName'], 
                [ticket_id]
            )
            if success: return {"status": "success"}
        
        return {"status": "error", "message": "Technician email not found"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.get("/technicians/available")
async def get_available_techs():
    try:
        # Re-use your existing data_service logic
        raw_techs = get_technicians() or []
        # Filter for availability
        available_techs = [
            {
                "id": t.get('employeeID'), 
                "name": t.get('fullName'),
                "email": t.get('email')
            } 
            for t in raw_techs if t.get('isAvailable') == True
        ]
        return available_techs
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
from pydantic import BaseModel

class AssignmentUpdate(BaseModel):
    technician_id: str
    technician_name: str

@app.patch("/tickets/{ticket_id}/assign")
async def manually_assign_ticket(ticket_id: int, data: AssignmentUpdate):
    try:
        supabase = get_supabase()
        
        # Update the ticket status and assigned technician
        result = (
            supabase.table("Ticket")
            .update({
                "attendById": data.technician_id,
                "attendByName": data.technician_name,
                "status": "pending" # Change from 'unassigned' to 'pending'
            })
            .eq("ticketID", ticket_id)
            .execute()
        )
        
        if result.data:
            # Optional: Trigger an email notification to the manually assigned tech
            # send_dispatch_notification(tech_email, tech_name, [ticket_id])
            return {"status": "success", "message": f"Ticket {ticket_id} assigned to {data.technician_name}"}
        
        return {"status": "error", "message": "Ticket not found"}
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
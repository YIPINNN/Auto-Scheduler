# from fastapi import FastAPI
# from backend.services.data_service import get_tasks, get_technicians
# from backend.services.file_service import create_input_txt, update_config_file, read_result
# from backend.services.matlab_service import run_matlab

# app = FastAPI()


# @app.get("/")
# def home():
#     return {"message": "Backend running 🚀"}


# @app.post("/optimize")
# def optimize():
#     try:
#         # 1. Get data
#         tasks = get_tasks()
#         techs = get_technicians()

#         # 2. Create input file
#         create_input_txt(tasks, techs)

#         # 3. Update config
#         update_config_file()

#         # 4. Run MATLAB
#         run_matlab()

#         # 5. Read result
#         result = read_result()

#         return {
#             "status": "success",
#             "result": result
#         }

#     except Exception as e:
#         return {
#             "status": "error",
#             "message": str(e)
#         }

# import re
# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# from backend.services.file_service import update_config_file, read_result
# from backend.services.matlab_service import run_matlab
# from backend.services.csv_service import save_all_to_csv

# # Import all necessary data services
# from backend.services.data_service import (
#     get_tickets,
#     get_technicians,
#     get_target_groups,
#     get_job_titles,
#     get_group_levels,
#     get_group_job_bridge,
#     get_alarm_code,
#     save_scenario_to_supabase,
#     sync_tickets_to_supabase 
# )

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:5173"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.post("/optimize")
# async def optimize(file: UploadFile = File(...), scenario_name: str = "New Scenario"):
#     try:
#         # 1. Read file
#         content_bytes = await file.read()
#         content_str = content_bytes.decode("utf-8")

#         # 2. Save CSVs for MATLAB
#         technicians = get_technicians()
#         save_all_to_csv(technicians, get_target_groups(), get_job_titles(), 
#                         get_group_levels(), get_group_job_bridge(), get_alarm_code())

#         # 3. Save input.txt
#         file_path = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output\input.txt"
#         with open(file_path, "w", encoding="utf-8", newline="\n") as f:
#              f.write(content_str.strip())

#         # 4. Run MATLAB
#         update_config_file()
#         run_matlab()

#         # 5. Process Results
#         full_data = read_result() 
#         assignments = full_data.get("assignments", [])

#         # 6. Fetch Tech Names for Mapping
#         db_techs = get_technicians()
#         tech_map = {str(t['employeeID']): t['fullName'] for t in db_techs}

#         # 7. SYNC TO TICKET TABLE (The New Way)
#         # This now happens AFTER MATLAB so tech_name is available
#         from backend.services.data_service import sync_final_results_to_tickets
#         sync_final_results_to_tickets(assignments, tech_map, file.filename)

#         # 8. Scenario Tracking & Locked Ticket Logic
#         db_tickets = get_tickets()
#         attending_tickets = [t for t in db_tickets if t.get('status') == 'attending']
#         for locked in attending_tickets:
#             # ... (keep your existing 'stitch' logic here) ...
#             pass

#         save_scenario_to_supabase(scenario_name, assignments)

#         return {"status": "success", "result": assignments}

#     except Exception as e:
#         print(f"❌ Error: {str(e)}")
#         return {"status": "error", "message": str(e)}

import re
import time
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from backend.services.file_service import update_config_file, read_result
from backend.services.matlab_service import run_matlab
from backend.services.csv_service import save_all_to_csv
from backend.services.email_service import send_dispatch_notification
from backend.supabase_client import supabase

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
        attending_list = [t for t in all_db_tickets if str(t.get('status')).lower() == 'attending']
        db_pending_tickets = [t for t in all_db_tickets if str(t.get('status')).lower() == 'pending']
        
        print(f"Attending (Locked): {len(attending_list)}")
        print(f"Pending (3-7): {len(db_pending_tickets)}")

        # 3. CONSTRUCT COMBINED QUEUE & TECHNICAL MAP
        final_input_rows = []
        ticket_details_map = {} # This will store the technical info for syncing later
        
        # Process 3-7 from DB
        for t in db_pending_tickets:
            tid = str(t.get('TicketID'))
            acode = str(t.get('alarmCode') or "0")
            tgrp = str(t.get('targetGroup') or "TECH")
            
            final_input_rows.append(f"{tid} {acode} {tgrp}")
            # Store details for step 8
            ticket_details_map[tid] = {'alarm': acode, 'group': tgrp}
            
        # Process 8-16 from File
        file_lines = content_str.split('\n')
        start_idx = 1 if file_lines[0].strip().isdigit() else 0
        for line in file_lines[start_idx:]:
            parts = line.split()
            if len(parts) >= 3:
                tid, acode, tgrp = parts[0], parts[1], parts[2]
                final_input_rows.append(f"{tid} {acode} {tgrp}")
                # Store details for step 8
                ticket_details_map[tid] = {'alarm': acode, 'group': tgrp}

        # 4. WRITE INPUT.TXT
        total_count = len(final_input_rows)
        file_path = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output\input.txt"
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
        # --- END CORE TIMER ---
        print(f"⚡ MO-SAHH Core Computation Time: {algo_duration:.4f}s")
        
        # 7. PROCESS RESULTS
        full_data = read_result() 
        assignments = full_data.get("assignments", [])

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
            "computation_time": f"{algo_duration:.2f}s"
        }
    
            

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return {"status": "error", "message": str(e)}
    

@app.post("/resend-notification/{ticket_id}")
async def resend_notification(ticket_id: int):
    try:
        # Fetch ticket to find the technician
        ticket = supabase.table("Ticket").select("*").eq("TicketID", ticket_id).single().execute()
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
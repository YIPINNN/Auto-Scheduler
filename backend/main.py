import re
import time
import threading
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from backend.services.file_service import update_config_file, read_result, read_moga_result
from backend.services.matlab_service import run_matlab, run_moga
from backend.services.csv_service import save_all_to_csv
from backend.services.email_service import send_dispatch_notification
#from backend.supabase_client import supabase
from backend.supabase_client import get_supabase
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timezone

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

scheduler = AsyncIOScheduler()
is_running = False
is_moga_running = False

async def auto_schedule_unassigned():
    global is_running
    if is_running:
        print("[AUTO-SCHEDULER] Already running, skipping this cycle.")
        return

    try:
        supabase = get_supabase()
        response = supabase.table("Ticket").select("ticketID").eq("status", "unassigned").execute()
        unassigned = response.data or []

        if not unassigned:
            print("[AUTO-SCHEDULER] No unassigned tickets. Skipping.")
            return

        print(f"[AUTO-SCHEDULER] Found {len(unassigned)} unassigned tickets. Triggering optimization...")
        is_running = True

        # Reuse your existing optimize logic
        await run_optimization(scenario_name=f"auto_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    except Exception as e:
        print(f"[AUTO-SCHEDULER] Error: {str(e)}")
    finally:
        is_running = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(auto_schedule_unassigned, "interval", minutes=30)  # ← change minutes here
    scheduler.start()
    print("[AUTO-SCHEDULER] Scheduler started.")
    yield
    scheduler.shutdown()
    print("[AUTO-SCHEDULER] Scheduler stopped.")

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def run_moga_background():
    global is_moga_running

    if is_moga_running:
        print("⚠️ MOGA is already running. Skipping duplicate background run.")
        return

    try:
        is_moga_running = True

        import time as _t
        print("\n🔄 MOGA detached background task started...")
        t0 = _t.time()

        run_moga()
        moga_data = read_moga_result()

        print(f"⚡ MOGA elapsed: {_t.time() - t0:.4f}s")

        _sb = get_supabase()
        _sb.table("MOGA_Results").insert({
            "workloadVariance": moga_data.get("workloadVariance", 0),
            "makespan": moga_data.get("makespan", 0),
            "algorithmElapsedTime": moga_data.get("algorithmElapsedTime", 0),
            "assignments": moga_data.get("assignments", []),
        }).execute()

        print("✅ MOGA saved to Supabase")

    except Exception as e:
        print(f"⚠️ MOGA detached background task failed: {e}")

    finally:
        is_moga_running = False

#def start_moga_detached():
#    thread = threading.Thread(target=run_moga_background, daemon=True)
#    thread.start()
#    print("🚀 MOGA started in detached thread")

async def run_optimization(scenario_name: str = "New Scenario", content_str: str = "0"):
    try:
        # 1. FETCH SYSTEM STATE
        all_db_tickets = get_tickets() or []

        # 2b. FETCH TECHNICIANS & FILTER
        raw_techs = get_technicians() or []
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

        for t in db_schedulable_tickets:
            tid = str(t.get('ticketID'))
            acode = str(t.get('alarmCode') or "0")
            tgrp = str(t.get('targetGroup') or "TECH")
            estimated_duration = (
                t.get("estimatedDuration") or t.get("processingTime")
                or t.get("ticketDuration") or t.get("duration") or 1
            )
            if tid not in added_ticket_ids:
                final_input_rows.append(f"{tid} {acode} {tgrp} {estimated_duration}")
                ticket_details_map[tid] = {
                    'alarm': acode, 'group': tgrp, 'estimatedDuration': estimated_duration
                }
                added_ticket_ids.add(tid)

        # Process new tickets from content_str (uploaded file or empty for auto)
        file_lines = content_str.split('\n')
        start_idx = 1 if file_lines and file_lines[0].strip().isdigit() else 0
        for line in file_lines[start_idx:]:
            parts = line.split()
            if len(parts) >= 3:
                tid, acode, tgrp = parts[0], parts[1], parts[2]
                estimated_duration = int(float(parts[3])) if len(parts) >= 4 else 1
                if tid not in added_ticket_ids:
                    final_input_rows.append(f"{tid} {acode} {tgrp} {estimated_duration}")
                    ticket_details_map[tid] = {
                        'alarm': acode, 'group': tgrp, 'estimatedDuration': estimated_duration
                    }
                    added_ticket_ids.add(tid)

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

        # Sync current workloads back to Supabase
        supabase_client = get_supabase()
        for tech in all_techs:
            supabase_client.table('Technician').update(
                {'workload': tech['workload']}
            ).eq('employeeID', tech['employeeID']).execute()
        print(f"✅ Workload synced to Supabase for {len(all_techs)} technicians")

        save_all_to_csv(all_techs, get_target_groups(), get_job_titles(),
                        get_group_levels(), get_group_job_bridge(), get_alarm_code())
        

        # 6. EXECUTE MATLAB
        algo_start = time.time()
        update_config_file()
        run_matlab()
        algo_duration = time.time() - algo_start
        print(f"⚡ MO-SAHH Core Computation Time: {algo_duration:.4f}s")

        # 7. PROCESS RESULTS
        full_data = read_result()
        assignments = full_data.get("assignments", [])
        pareto_solutions = full_data.get("paretoSolutions", [])

        print("========== DEBUG PARETO ==========")
        print("Assignments count:", len(assignments))
        print("Pareto solutions count:", len(pareto_solutions))
        print("Pareto solutions:", pareto_solutions)
        print("==================================")

        assigned_ticket_ids = set()
        for entry in assignments:
            for t_id in entry.get('tickets', []):
                assigned_ticket_ids.add(str(t_id))

        unassigned_tickets = []
        for tid, details in ticket_details_map.items():
            if tid not in assigned_ticket_ids:
                unassigned_tickets.append({
                    "ticketID": tid, "alarmCode": details['alarm'],
                    "targetGroup": details['group'],
                    "estimatedDuration": details.get("estimatedDuration", 1),
                    "status": "Unassigned", "attendById": None
                })

        print(f"Total Tickets: {len(ticket_details_map)}")
        print(f"Assigned: {len(assigned_ticket_ids)}")
        print(f"Unassigned: {len(unassigned_tickets)}")

        save_scenario_to_supabase(
            scenario_name=scenario_name,
            assignments=assignments,
            comp_time=algo_duration,
            workload_variance=full_data.get("workloadVariance", 0),
            makespan=full_data.get("makespan", 0),
            algorithm_elapsed_time=full_data.get("algorithmElapsedTime", 0),
            pareto_solutions=pareto_solutions
        )

        for entry in assignments:
            if "tickets" in entry:
                entry["tickets"].reverse()

        tech_map = {str(t['employeeID']): t['fullName'] for t in all_techs}
        sync_final_results_to_tickets(assignments, tech_map, "auto", ticket_details_map)

        # 8. SEND NOTIFICATIONS
        print("--- TRIGGERING AUTOMATED DISPATCH ---")
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
            "paretoSolutions": pareto_solutions,
            "workloadVariance": full_data.get("workloadVariance", 0),
            "makespan": full_data.get("makespan", 0),
            "computationTime": f"{algo_duration:.2f}s",
            "_moga_queued": True
        }

    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return {"status": "error", "message": str(e)}
    
@app.post("/optimize")
async def optimize(file: UploadFile = File(...), scenario_name: str = "New Scenario"):
    content_bytes = await file.read()
    content_str = content_bytes.decode("utf-8").strip()

    # 1. Run MO-SAHH first
    result = await run_optimization(
        scenario_name=scenario_name,
        content_str=content_str
    )

    # 2. After MO-SAHH success, run MOGA immediately.
    # This is NOT detached, so frontend will only receive response after MOGA finishes.
    if result.get("status") == "success":
        print("🔄 MO-SAHH completed. Now running MOGA before sending frontend response...")

        try:
            run_moga_background()
            result["_moga_completed"] = True
            result["mogaMessage"] = "MOGA comparison completed and saved."
        except Exception as e:
            print(f"⚠️ MOGA failed after MO-SAHH: {e}")
            result["_moga_completed"] = False
            result["mogaMessage"] = f"MOGA failed: {str(e)}"

    return result
    

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
from typing import List, Dict, Optional

class AssignmentUpdate(BaseModel):
    technician_id: str
    technician_name: str


class AlternativeAssignment(BaseModel):
    tech: str
    tickets: List[str]
    techName: Optional[str] = None


class ApplyAlternativeRequest(BaseModel):
    solutionID: int
    workloadVariance: float
    makespan: float
    assignments: List[AlternativeAssignment]
    technicianLookup: Optional[Dict[str, str]] = {}

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
    
@app.post("/apply-alternative-schedule")
async def apply_alternative_schedule(payload: ApplyAlternativeRequest):
    try:
        supabase = get_supabase()

        allowed_statuses = ["pending", "unassigned"]

        updated_tickets = []
        skipped_tickets = []

        for assignment in payload.assignments:
            tech_id = str(assignment.tech)

            tech_name = None
            if payload.technicianLookup:
                tech_name = payload.technicianLookup.get(tech_id)

            if not tech_name:
                tech_name = assignment.techName or tech_id

            for ticket_id in assignment.tickets:
                ticket_id_str = str(ticket_id)

                # 1. Get current ticket status
                ticket_res = (
                    supabase
                    .table("Ticket")
                    .select("ticketID,status,attendById,attendByName")
                    .eq("ticketID", ticket_id_str)
                    .execute()
                )

                if not ticket_res.data:
                    skipped_tickets.append({
                        "ticketID": ticket_id_str,
                        "reason": "Ticket not found"
                    })
                    continue

                ticket = ticket_res.data[0]
                current_status = str(ticket.get("status") or "").lower()

                # 2. Protect attending/completed tickets
                if current_status not in allowed_statuses:
                    skipped_tickets.append({
                        "ticketID": ticket_id_str,
                        "status": ticket.get("status"),
                        "reason": "Ticket is already attending/completed or not allowed to reassign"
                    })
                    continue

                # 3. Apply alternative assignment
                update_data = {
                    "attendById": tech_id,
                    "attendByName": tech_name,
                    "assignedTime": datetime.now(timezone.utc).isoformat(),
                    "status": "pending"
                }

                update_res = (
                    supabase
                    .table("Ticket")
                    .update(update_data)
                    .eq("ticketID", ticket_id_str)
                    .execute()
                )

                if update_res.data:
                    updated_tickets.append({
                        "ticketID": ticket_id_str,
                        "tech": tech_id,
                        "techName": tech_name
                    })
                else:
                    skipped_tickets.append({
                        "ticketID": ticket_id_str,
                        "reason": "Update failed"
                    })
        # 4. Send email notification to technicians after successful reassignment
        notification_results = []
        tickets_by_tech = {}

        for item in updated_tickets:
            tech_id = str(item.get("tech"))
            ticket_id = item.get("ticketID")

            if tech_id not in tickets_by_tech:
                tickets_by_tech[tech_id] = []

            tickets_by_tech[tech_id].append(ticket_id)

        for tech_id, ticket_list in tickets_by_tech.items():
            try:
                tech_res = (
                    supabase
                    .table("Technician")
                    .select("employeeID,fullName,email")
                    .eq("employeeID", tech_id)
                    .execute()
                )

                if not tech_res.data:
                    notification_results.append({
                        "tech": tech_id,
                        "status": "skipped",
                        "reason": "Technician not found",
                        "tickets": ticket_list
                    })
                    continue

                tech = tech_res.data[0]
                tech_email = tech.get("email")
                tech_name = tech.get("fullName") or tech_id

                if not tech_email:
                    notification_results.append({
                        "tech": tech_id,
                        "techName": tech_name,
                        "status": "skipped",
                        "reason": "Technician email not found",
                        "tickets": ticket_list
                    })
                    continue

                success = send_dispatch_notification(
                    tech_email=tech_email,
                    tech_name=tech_name,
                    ticket_list=ticket_list
                )

                notification_results.append({
                    "tech": tech_id,
                    "techName": tech_name,
                    "email": tech_email,
                    "tickets": ticket_list,
                    "status": "sent" if success else "failed"
                })

            except Exception as email_error:
                notification_results.append({
                    "tech": tech_id,
                    "status": "failed",
                    "reason": str(email_error),
                    "tickets": ticket_list
                })

        return {
            "status": "success",
            "message": "Alternative schedule applied.",
            "solutionID": payload.solutionID,
            "workloadVariance": payload.workloadVariance,
            "makespan": payload.makespan,
            "updatedCount": len(updated_tickets),
            "skippedCount": len(skipped_tickets),
            "notificationCount": len([n for n in notification_results if n.get("status") == "sent"]),
            "updatedTickets": updated_tickets,
            "skippedTickets": skipped_tickets,
            "notifications": notification_results
        }

        return {
            "status": "success",
            "message": "Alternative schedule applied.",
            "solutionID": payload.solutionID,
            "workloadVariance": payload.workloadVariance,
            "makespan": payload.makespan,
            "updatedCount": len(updated_tickets),
            "skippedCount": len(skipped_tickets),
            "updatedTickets": updated_tickets,
            "skippedTickets": skipped_tickets
        }

    except Exception as e:
        print("❌ Apply alternative schedule error:", e)
        return {
            "status": "error",
            "message": str(e)
        }
    

@app.get("/moga-history")
async def get_moga_history():
    """Return last 10 MOGA runs for Performance tab comparison charts."""
    try:
        supabase = get_supabase()
        result = (
            supabase.table("MOGA_Results")
            .select("workloadVariance, makespan, algorithmElapsedTime, created_at")
            .order("created_at", desc=False)
            .limit(10)
            .execute()
        )
        return {"status": "success", "data": result.data or []}
    except Exception as e:
        print(f"❌ MOGA history fetch failed: {e}")
        return {"status": "error", "data": []}
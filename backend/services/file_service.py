import os
import sys
import re
import glob

sys.stdout.reconfigure(encoding="utf-8")

OUTPUT_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output"
CONFIG_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\Makespan\Config_LatestLocal.txt"

INPUT_FILE = os.path.join(OUTPUT_DIR, "input.txt")
RESULT_FILE = os.path.join(OUTPUT_DIR, "result.txt")

FULL_RESULTS_DIR = os.path.join(OUTPUT_DIR, "results")


def get_latest_full_result_file():
    pattern = os.path.join(FULL_RESULTS_DIR, "result_*.txt")
    files = glob.glob(pattern)

    print("🔍 Searching full result files with pattern:", pattern)
    print("🔍 Full result files found:", files)

    if not files:
        print("⚠️ No full result file found.")
        return None

    latest_file = max(files, key=os.path.getmtime)
    print(f"✅ Latest full result file: {latest_file}")
    return latest_file

# ✅ Create input.txt for MATLAB algorithm
def create_input_txt(tasks, techs):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        # First line: number of tasks
        f.write(str(len(tasks)) + "\n")

        # Second line: number of technicians
        f.write(str(len(techs)) + "\n")

        # Task lines
        # Expected format:
        # ticketID alarmCode targetGroup processingTime
        for t in tasks:
            ticket_id = (
                t.get("ticketID")
                or t.get("ticketId")
                or t.get("id")
                or t.get("ticket_id")
            )

            alarm_code = (
                t.get("alarmCode")
                or t.get("alarm_code")
                or 0
            )

            target_group = (
                t.get("targetGroup")
                or t.get("groupLevel")
                or t.get("group")
                or "UNKNOWN"
            )

            # New variable for makespan objective
            processing_time = (
                t.get("processingTime")
                or t.get("estimatedDuration")
                or t.get("ticketDuration")
                or t.get("duration")
                or 1
            )

            f.write(f"{ticket_id} {alarm_code} {target_group} {processing_time}\n")

        # Technician lines
        # Keep this simple first. If your MATLAB expects only technician ID, this is okay.
        for tech in techs:
            tech_id = (
                tech.get("employeeID")
                or tech.get("technicianID")
                or tech.get("techID")
                or tech.get("id")
            )

            f.write(f"{tech_id}\n")


# ✅ Update MATLAB config file to point to input.txt
def update_config_file():
    lines = []

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("datasetFileName"):
                lines.append(f"datasetFileName 1 {INPUT_FILE}\n")
            else:
                lines.append(line)

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        f.writelines(lines)


# ✅ Read MATLAB result.txt
# ✅ Read MATLAB result.txt
def parse_schedule_block(lines):
    assignments = []
    current_tech = None

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            continue

        if line.startswith("Technician"):
            try:
                tech_id = line.split(" ")[1].replace(":", "")
                current_tech = {
                    "tech": tech_id,
                    "tickets": []
                }
                assignments.append(current_tech)
            except Exception as e:
                print(f"⚠️ Failed to parse technician line: {line}, error: {e}")

        elif (line.startswith("T") or line.isdigit()) and current_tech:
            current_tech["tickets"].append(line)

    return assignments


def parse_pareto_from_full_result(lines):
    workload_variance = 0
    makespan = 0
    algorithm_elapsed_time = 0

    all_pareto_schedules = []
    final_pareto_objectives = []

    current_solution = None
    current_lines = []

    in_pareto_schedule_section = False
    in_final_section = False

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            continue

        # Example:
        # Final Pareto-optimal Solution: [0.25 110;0.3833 105;1.5833 100]
        final_pf_match = re.search(
            r"Final Pareto-optimal Solution:\s*\[(.*?)\]",
            line,
            re.IGNORECASE
        )

        if final_pf_match:
            raw_pf = final_pf_match.group(1)
            rows = raw_pf.split(";")
            final_pareto_objectives = []

            for row in rows:
                values = row.strip().split()
                if len(values) >= 2:
                    final_pareto_objectives.append([
                        float(values[0]),
                        float(values[1])
                    ])

            print(f"✅ Parsed global Pareto objectives: {final_pareto_objectives}")
            continue

        if "All Pareto Schedules Found Along the Pareto Front" in line:
            in_pareto_schedule_section = True
            in_final_section = False
            continue

        if line.startswith("All Pareto Fronts:"):
            if current_solution:
                current_solution["assignments"] = parse_schedule_block(current_lines)
                all_pareto_schedules.append(current_solution)
                current_solution = None
                current_lines = []

            in_pareto_schedule_section = False
            continue

        if "FINAL BEST SCHEDULE SELECTED" in line:
            if current_solution:
                current_solution["assignments"] = parse_schedule_block(current_lines)
                all_pareto_schedules.append(current_solution)
                current_solution = None
                current_lines = []

            in_pareto_schedule_section = False
            in_final_section = True
            continue

        if in_final_section:
            workload_match = re.search(
                r"Workload\s+Variance\s*:\s*([0-9]*\.?[0-9]+)",
                line,
                re.IGNORECASE
            )
            if workload_match:
                workload_variance = float(workload_match.group(1))
                print(f"✅ Parsed final Workload Variance: {workload_variance}")
                continue

            makespan_match = re.search(
                r"Makespan\s*:\s*([0-9]*\.?[0-9]+)",
                line,
                re.IGNORECASE
            )
            if makespan_match:
                makespan = float(makespan_match.group(1))
                print(f"✅ Parsed final Makespan: {makespan}")
                continue

            if line.startswith("End Time:") or line.startswith("Algorithm Elapsed Time:"):
                in_final_section = False

        algorithm_time_match = re.search(
            r"Algorithm\s+Elapsed\s+Time\s*:\s*([0-9]*\.?[0-9]+)",
            line,
            re.IGNORECASE
        )

        if algorithm_time_match:
            algorithm_elapsed_time = float(algorithm_time_match.group(1))
            print(f"✅ Parsed Algorithm Elapsed Time: {algorithm_elapsed_time}")
            continue

        if in_pareto_schedule_section:
            schedule_match = re.search(
                r"Schedule\s+(\d+)\s+\(Objectives:\s*\[([0-9]*\.?[0-9]+)\s+([0-9]*\.?[0-9]+)\]\):",
                line,
                re.IGNORECASE
            )

            if schedule_match:
                if current_solution:
                    current_solution["assignments"] = parse_schedule_block(current_lines)
                    all_pareto_schedules.append(current_solution)

                current_solution = {
                    "rawScheduleNo": int(schedule_match.group(1)),
                    "workloadVariance": float(schedule_match.group(2)),
                    "makespan": float(schedule_match.group(3)),
                    "assignments": []
                }
                current_lines = []
                continue

            if current_solution:
                current_lines.append(raw_line)

    if current_solution:
        current_solution["assignments"] = parse_schedule_block(current_lines)
        all_pareto_schedules.append(current_solution)

    filtered_solutions = []
    seen_objectives = set()

    for sol in all_pareto_schedules:
        if not sol.get("assignments"):
            continue

        sol_variance = float(sol.get("workloadVariance", 0))
        sol_makespan = float(sol.get("makespan", 0))

        if final_pareto_objectives:
            is_global_non_dominated = any(
                abs(round(sol_variance, 4) - round(obj[0], 4)) <= 0.001 and
                abs(round(sol_makespan, 4) - round(obj[1], 4)) <= 0.001
                for obj in final_pareto_objectives
            )

            if not is_global_non_dominated:
                print(
                    f"SKIPPED dominated/non-final solution: "
                    f"[{sol_variance}, {sol_makespan}]"
                )
                continue

        key = (round(sol_variance, 4), round(sol_makespan, 4))

        if key in seen_objectives:
            continue

        seen_objectives.add(key)

        sol["solutionID"] = len(filtered_solutions) + 1
        sol["isBest"] = (
            abs(sol_variance - workload_variance) < 0.001 and
            abs(sol_makespan - makespan) < 0.001
        )

        filtered_solutions.append(sol)

    filtered_solutions.sort(
        key=lambda s: (float(s["makespan"]), float(s["workloadVariance"]))
    )

    for idx, sol in enumerate(filtered_solutions, start=1):
        sol["solutionID"] = idx

    print("========== PARETO PARSE DEBUG ==========")
    print("Total parsed Pareto schedules:", len(all_pareto_schedules))
    print("Final Pareto objectives:", final_pareto_objectives)
    print("Filtered global Pareto schedules:", len(filtered_solutions))

    for sol in filtered_solutions:
        print(
            f"Solution {sol['solutionID']} | "
            f"Variance={sol['workloadVariance']} | "
            f"Makespan={sol['makespan']} | "
            f"Assignments={len(sol.get('assignments', []))}"
        )

    print("========================================")

    return {
        "paretoSolutions": filtered_solutions,
        "workloadVariance": workload_variance,
        "makespan": makespan,
        "algorithmElapsedTime": algorithm_elapsed_time
    }

def read_result():
    # 1. Read simplified result.txt for final schedule
    try:
        with open(RESULT_FILE, "r", encoding="utf-8") as f:
            simplified_lines = f.readlines()

        print(f"✅ Reading simplified final schedule from: {RESULT_FILE}")

    except FileNotFoundError:
        print(f"Error: simplified result.txt not found at {RESULT_FILE}")
        simplified_lines = []

    # 2. Read latest full result file for Pareto/non-dominated schedules
    full_result_file = get_latest_full_result_file()

    if full_result_file:
        try:
            with open(full_result_file, "r", encoding="utf-8") as f:
                full_lines = f.readlines()

            print(f"✅ Reading Pareto schedules from full result: {full_result_file}")

        except FileNotFoundError:
            print(f"Error: full result file not found at {full_result_file}")
            full_lines = []
    else:
        full_lines = []

    # Final Gantt schedule should come from simplified result.txt
    final_assignments = parse_schedule_block(simplified_lines)

    # Pareto alternatives should come from full MATLAB result file
    pareto_data = parse_pareto_from_full_result(full_lines)

    workload_variance = pareto_data.get("workloadVariance", 0)
    makespan = pareto_data.get("makespan", 0)
    algorithm_elapsed_time = pareto_data.get("algorithmElapsedTime", 0)
    pareto_solutions = pareto_data.get("paretoSolutions", [])

    print("========== READ_RESULT DEBUG ==========")
    print("Final assignments from simplified result.txt:", len(final_assignments))
    print("Pareto solutions from full result file:", len(pareto_solutions))
    print("Workload Variance:", workload_variance)
    print("Makespan:", makespan)
    print("Algorithm Elapsed Time:", algorithm_elapsed_time)
    print("=======================================")

    return {
        "assignments": final_assignments,
        "paretoSolutions": pareto_solutions,
        "workloadVariance": workload_variance,
        "makespan": makespan,
        "algorithmElapsedTime": algorithm_elapsed_time
    }
    
# ─────────────────────────────────────────────────────────────
#  MOGA result parser
#  Reads moga_result.txt (the final-section extract).
#  Returns only the 4 fields the Performance tab needs.
# ─────────────────────────────────────────────────────────────
MOGA_RESULT_FILE = os.path.join(OUTPUT_DIR, "moga_result.txt")


def read_moga_result():
    try:
        with open(MOGA_RESULT_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"⚠️  moga_result.txt not found at {MOGA_RESULT_FILE}")
        return {"workloadVariance": 0, "makespan": 0, "algorithmElapsedTime": 0, "assignments": []}

    if not lines or all(not line.strip() for line in lines):
        print("⚠️  moga_result.txt is empty.")
        return {"workloadVariance": 0, "makespan": 0, "algorithmElapsedTime": 0, "assignments": []}

    workload_variance     = 0.0
    makespan              = 0.0
    algorithm_elapsed_time = 0.0
    assignments           = []
    current_tech          = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Parse Workload Variance
        m = re.search(r"Workload\s+Variance\s*:\s*([0-9]*\.?[0-9]+)", line, re.IGNORECASE)
        if m:
            workload_variance = float(m.group(1))
            print(f"✅ MOGA Parsed Workload Variance: {workload_variance}")
            continue

        # Parse Makespan
        m = re.search(r"Makespan\s*:\s*([0-9]*\.?[0-9]+)", line, re.IGNORECASE)
        if m:
            makespan = float(m.group(1))
            print(f"✅ MOGA Parsed Makespan: {makespan}")
            continue

        # Parse Algorithm Elapsed Time
        m = re.search(r"Algorithm\s+Elapsed\s+Time\s*:\s*([0-9]*\.?[0-9]+)", line, re.IGNORECASE)
        if m:
            algorithm_elapsed_time = float(m.group(1))
            print(f"✅ MOGA Parsed Algorithm Elapsed Time: {algorithm_elapsed_time}")
            continue

        # Parse Technician line
        if line.startswith("Technician"):
            try:
                tech_id = line.split(" ")[1].replace(":", "")
                current_tech = {"tech": tech_id, "tickets": []}
                assignments.append(current_tech)
            except Exception as e:
                print(f"⚠️  MOGA failed to parse technician line: {line}, error: {e}")

        # Parse Ticket line
        elif (line.startswith("T") or line.isdigit()) and current_tech:
            current_tech["tickets"].append(line)

    result = {
        "workloadVariance":     workload_variance,
        "makespan":             makespan,
        "algorithmElapsedTime": algorithm_elapsed_time,
        "assignments":          assignments
    }
    print("🔍 MOGA parsed result:", result)
    return result
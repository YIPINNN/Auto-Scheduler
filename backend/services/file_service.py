import os
import sys
import re

sys.stdout.reconfigure(encoding="utf-8")

# 📁 Paths
OUTPUT_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output"
CONFIG_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\Makespan\Config_LatestLocal.txt"

INPUT_FILE = os.path.join(OUTPUT_DIR, "input.txt")
RESULT_FILE = os.path.join(OUTPUT_DIR, "result.txt")


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
def read_result():
    try:
        with open(RESULT_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

    except FileNotFoundError:
        print(f"Error: result.txt not found at {RESULT_FILE}")
        return {
            "assignments": [],
            "workloadVariance": 0,
            "makespan": 0,
            "algorithmElapsedTime": 0
        }

    if not lines or all(not line.strip() for line in lines):
        print("⚠️ result.txt is empty.")
        return {
            "assignments": [],
            "workloadVariance": 0,
            "makespan": 0,
            "algorithmElapsedTime": 0
        }

    assignments = []
    current_tech = None

    workload_variance = 0
    makespan = 0
    algorithm_elapsed_time = 0

    for line in lines:
        line = line.strip()

        if not line:
            continue

        # ✅ Parse Workload Variance
        # Example: Workload Variance: 0.8289
        workload_match = re.search(
            r"Workload\s+Variance\s*:\s*([0-9]*\.?[0-9]+)",
            line,
            re.IGNORECASE
        )

        if workload_match:
            workload_variance = float(workload_match.group(1))
            print(f"✅ Parsed Workload Variance: {workload_variance}")
            continue

        # ✅ Parse Makespan
        # Example: Makespan:          215.0000
        makespan_match = re.search(
            r"Makespan\s*:\s*([0-9]*\.?[0-9]+)",
            line,
            re.IGNORECASE
        )

        if makespan_match:
            makespan = float(makespan_match.group(1))
            print(f"✅ Parsed Makespan: {makespan}")
            continue

        # ✅ Parse Algorithm Elapsed Time
        # Example: Algorithm Elapsed Time: 18.2345 seconds
        algorithm_time_match = re.search(
            r"Algorithm\s+Elapsed\s+Time\s*:\s*([0-9]*\.?[0-9]+)",
            line,
            re.IGNORECASE
        )

        if algorithm_time_match:
            algorithm_elapsed_time = float(algorithm_time_match.group(1))
            print(f"✅ Parsed Algorithm Elapsed Time: {algorithm_elapsed_time}")
            continue

        # Optional: support old MATLAB label
        # Example: CPU Time: 18.2345 seconds
        cpu_time_match = re.search(
            r"CPU\s+Time\s*:\s*([0-9]*\.?[0-9]+)",
            line,
            re.IGNORECASE
        )

        if cpu_time_match:
            algorithm_elapsed_time = float(cpu_time_match.group(1))
            print(f"✅ Parsed CPU Time as Algorithm Elapsed Time: {algorithm_elapsed_time}")
            continue

        # ✅ Parse Technician line
        # Example: Technician 1000403990:
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

        # ✅ Parse Ticket line
        # Example: T-22867225 or 22867225
        elif (line.startswith("T") or line.isdigit()) and current_tech:
            current_tech["tickets"].append(line)

    print("🔍 Final parsed result from result.txt:")
    print({
        "assignments": assignments,
        "workloadVariance": workload_variance,
        "makespan": makespan,
        "algorithmElapsedTime": algorithm_elapsed_time
    })

    return {
        "assignments": assignments,
        "workloadVariance": workload_variance,
        "makespan": makespan,
        "algorithmElapsedTime": algorithm_elapsed_time
    }
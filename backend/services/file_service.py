import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
# 📁 paths
OUTPUT_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output"
CONFIG_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\MO-SAHH-yipin2 (single)\mo-sahh-master -finalize\Config_LatestLocal.txt"
INPUT_FILE = os.path.join(OUTPUT_DIR, "input.txt")
RESULT_FILE = os.path.join(OUTPUT_DIR, "result.txt")


# ✅ Create input.txt
def create_input_txt(tasks, techs):
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    with open(INPUT_FILE, "w", encoding="utf-8") as f:
        # ⚠️ TEMP FORMAT (you will refine later)
        f.write(str(len(tasks)) + "\n")
        f.write(str(len(techs)) + "\n")

        for t in tasks:
            f.write(str(t) + "\n")

        for tech in techs:
            f.write(str(tech) + "\n")


# ✅ Update Config file
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


# ✅ Read MATLAB result
def read_result():
    # Use the full path you defined at the top of your file_service.py
    # to ensure it finds the file correctly
    try:
        with open("output/result.txt", "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print("Error: output/result.txt not found.")
        return {"assignments": [], "variance": 0, "penalty": 0}

    assignments = []
    current_tech = None
    variance = None
    penalty = None

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Detect Technician Line
        if line.startswith("Technician"):
            # Splits "Technician 1000403990:" into ["Technician", "1000403990:"]
            tech_id = line.split(" ")[1].replace(":", "")
            current_tech = {"tech": tech_id, "tickets": []}
            assignments.append(current_tech)

        # Detect Ticket Line (e.g., "T-22867225" or just "22867225")
        # Added a check for line.isdigit() in case your MATLAB output skips the "T"
        elif (line.startswith("T") or line.isdigit()) and current_tech:
            current_tech["tickets"].append(line)

        # Performance Metrics
        elif "Variance" in line:
            try:
                variance = float(line.split(":")[1].strip())
            except: variance = 0
            
        elif "Penalty" in line:
            try:
                penalty = float(line.split(":")[1].strip())
            except: penalty = 0

    # This structure is critical for your current React Schedule.jsx
    return {
        "assignments": assignments,
        "variance": variance,
        "penalty": penalty
    }
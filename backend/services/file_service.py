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
def read_result(result_file_path):
    try:
        with open(result_file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        print(f"Error: {result_file_path} not found.")
        return {"assignments": [], "variance": 0, "penalty": 0}

    assignments = []
    current_tech = None
    variance = 0
    penalty = 0

    in_final_assignment = False
    in_final_objectives = False

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if "===== FINAL ASSIGNMENT =====" in line:
            in_final_assignment = True
            in_final_objectives = False
            current_tech = None
            continue

        if "Final Objectives:" in line:
            in_final_assignment = False
            in_final_objectives = True
            current_tech = None
            continue

        if in_final_assignment:
            if line.startswith("Technician"):
                tech_id = line.split(" ")[1].replace(":", "")
                current_tech = {"tech": tech_id, "tickets": []}
                assignments.append(current_tech)
            elif line.isdigit() and current_tech:
                current_tech["tickets"].append(line)

        elif in_final_objectives:
            if line.startswith("Variance:"):
                try:
                    variance = float(line.split(":", 1)[1].strip())
                except:
                    variance = 0
            elif line.startswith("Penalty:"):
                try:
                    penalty = float(line.split(":", 1)[1].strip())
                except:
                    penalty = 0

    return {
        "assignments": assignments,
        "variance": variance,
        "penalty": penalty
    }
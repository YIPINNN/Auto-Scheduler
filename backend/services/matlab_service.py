import subprocess
import os
import glob
import shutil

MATLAB_PATH = r"C:\Program Files\MATLAB\R2021a\bin\matlab.exe"

SCRIPT_PATH = r"C:\Users\huiying\Desktop\Auto-Scheduler\MO-SAHH-yipin2 (single)\mo-sahh-master -finalize\Main_LatestLocal.m"

MATLAB_RESULTS_DIR = r"C:\Users\huiying\Desktop\Auto-Scheduler\MO-SAHH-yipin2 (single)\mo-sahh-master -finalize\results"

# Full result history folder in frontend
FRONTEND_RESULTS_DIR = r"C:\Users\huiying\Desktop\Auto-Scheduler\Auto-Scheduler\output\results"

# Simplified latest result file for backend/frontend parsing
FRONTEND_LATEST_RESULT_FILE = r"C:\Users\huiying\Desktop\Auto-Scheduler\Auto-Scheduler\output\result.txt"


def extract_final_assignment_section(full_result_path):
    """
    Extract only:
    ===== FINAL ASSIGNMENT =====
    ...
    Final Objectives:
    Variance:
    Penalty:
    """
    with open(full_result_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    extracted_lines = []
    capture = False

    for line in lines:
        stripped = line.strip()

        # Start capturing from FINAL ASSIGNMENT
        if stripped == "===== FINAL ASSIGNMENT =====":
            capture = True

        if capture:
            extracted_lines.append(line)

        # Stop after Penalty line under Final Objectives
        if capture and stripped.startswith("Penalty:"):
            break

    return "".join(extracted_lines)


def run_matlab():
    command = f"run('{SCRIPT_PATH}')"

    result = subprocess.run(
        [MATLAB_PATH, "-batch", command],
        capture_output=True,
        text=True
    )

    print("========== MATLAB STDOUT ==========")
    print(result.stdout)

    print("========== MATLAB STDERR ==========")
    print(result.stderr)

    if result.returncode != 0:
        raise Exception(f"MATLAB failed:\n{result.stderr}")

    # Find newest MATLAB timestamped result
    result_files = glob.glob(os.path.join(MATLAB_RESULTS_DIR, "result_*.txt"))
    if not result_files:
        raise Exception("No MATLAB result file found in MATLAB results folder.")

    latest_result_file = max(result_files, key=os.path.getmtime)
    latest_filename = os.path.basename(latest_result_file)

    # 1. Copy full timestamped result into frontend/output/results/
    os.makedirs(FRONTEND_RESULTS_DIR, exist_ok=True)
    frontend_timestamped_result_file = os.path.join(FRONTEND_RESULTS_DIR, latest_filename)
    shutil.copyfile(latest_result_file, frontend_timestamped_result_file)

    # 2. Extract only FINAL ASSIGNMENT section into frontend/output/result.txt
    final_assignment_text = extract_final_assignment_section(latest_result_file)

    os.makedirs(os.path.dirname(FRONTEND_LATEST_RESULT_FILE), exist_ok=True)
    with open(FRONTEND_LATEST_RESULT_FILE, "w", encoding="utf-8") as f:
        f.write(final_assignment_text)

    print(f"✅ Latest MATLAB full result: {latest_result_file}")
    print(f"✅ Copied full result to: {frontend_timestamped_result_file}")
    print(f"✅ Updated simplified result.txt: {FRONTEND_LATEST_RESULT_FILE}")

    return FRONTEND_LATEST_RESULT_FILE
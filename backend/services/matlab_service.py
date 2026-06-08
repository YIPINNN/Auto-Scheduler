import subprocess
import os
import glob
import shutil

MATLAB_PATH = r"C:\\Program Files\\MATLAB\\R2025b\\bin\\matlab.exe"
SCRIPT_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\Makespan\Main_LatestLocal.m"

MATLAB_RESULTS_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\Makespan\results"

# Full result history folder in frontend
FRONTEND_RESULTS_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output\results"

# Simplified latest result file for backend/frontend parsing
FRONTEND_LATEST_RESULT_FILE = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output\result.txt"


def extract_final_assignment_section(full_result_path):
    with open(full_result_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    extracted_lines = []
    capture = False

    for line in lines:
        stripped = line.strip()

        # Start from final assignment section
        if (
            stripped == "===== FINAL ASSIGNMENT ====="
            or stripped == "FINAL BEST SCHEDULE SELECTED:"
        ):
            capture = True

        if capture:
            extracted_lines.append(line)

        # Old objective 2
        if capture and stripped.startswith("Penalty:"):
            break

        # New objective 2
        if capture and stripped.startswith("Makespan:"):
            # Do not break immediately if technician lines are after Makespan
            # Only break if your result format places metrics at the end.
            pass

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

# ─────────────────────────────────────────────────────────────
#  MOGA (NSGA-II) — runs AFTER MO-SAHH on the same input files
# ─────────────────────────────────────────────────────────────
MOGA_SCRIPT_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\Makespan\MOGA_NSGA2.m"
MOGA_RESULTS_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\Makespan\results"
FRONTEND_MOGA_LATEST_FILE = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output\moga_result.txt"


def run_moga():
    """
    Run MOGA_NSGA2.m in MATLAB.
    Must be called AFTER run_matlab() so that input.txt and
    Config_LatestLocal.txt are already written with the correct data.
    MOGA reads those same files — no extra setup needed.
    """
    command = f"run('{MOGA_SCRIPT_PATH}')"

    result = subprocess.run(
        [MATLAB_PATH, "-batch", command],
        capture_output=True,
        text=True
    )

    print("========== MOGA STDOUT ==========")
    print(result.stdout)
    print("========== MOGA STDERR ==========")
    print(result.stderr)

    if result.returncode != 0:
        raise Exception(f"MOGA MATLAB failed:\n{result.stderr}")

    # Find the newest MOGA result file
    moga_files = glob.glob(os.path.join(MOGA_RESULTS_DIR, "MOGA_result_*.txt"))
    if not moga_files:
        raise Exception("No MOGA result file found.")

    latest_moga = max(moga_files, key=os.path.getmtime)

    # Copy full result to frontend/output/results/ for history
    os.makedirs(FRONTEND_RESULTS_DIR, exist_ok=True)
    shutil.copyfile(latest_moga, os.path.join(FRONTEND_RESULTS_DIR, os.path.basename(latest_moga)))

    # Extract final section into moga_result.txt for backend parsing
    final_section = _extract_moga_final_section(latest_moga)
    os.makedirs(os.path.dirname(FRONTEND_MOGA_LATEST_FILE), exist_ok=True)
    with open(FRONTEND_MOGA_LATEST_FILE, "w", encoding="utf-8") as f:
        f.write(final_section)

    print(f"✅ MOGA result → {FRONTEND_MOGA_LATEST_FILE}")
    return FRONTEND_MOGA_LATEST_FILE


def _extract_moga_final_section(path):
    """Extract from 'FINAL BEST SCHEDULE SELECTED:' to end of file."""
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    out, capture = [], False
    for line in lines:
        if line.strip() == "FINAL BEST SCHEDULE SELECTED:":
            capture = True
        if capture:
            out.append(line)
    return "".join(out)
import subprocess
import os
import glob
import shutil

MATLAB_PATH = r"C:\\Program Files\\MATLAB\\R2025b\\bin\\matlab.exe"
SCRIPT_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\MO-SAHH-yipin2 (single)\mo-sahh-master -finalize\Main_LatestLocal.m"

MATLAB_RESULTS_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\MO-SAHH-yipin2 (single)\mo-sahh-master -finalize\results"
FRONTEND_RESULTS_DIR = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\my-frontend\output\results"

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

    result_files = glob.glob(os.path.join(MATLAB_RESULTS_DIR, "result_*.txt"))
    if not result_files:
        raise Exception("No MATLAB result file found in MATLAB results folder.")

    latest_result_file = max(result_files, key=os.path.getmtime)
    latest_filename = os.path.basename(latest_result_file)

    os.makedirs(FRONTEND_RESULTS_DIR, exist_ok=True)
    frontend_result_file = os.path.join(FRONTEND_RESULTS_DIR, latest_filename)

    shutil.copyfile(latest_result_file, frontend_result_file)

    print(f"✅ Latest MATLAB result file: {latest_result_file}")
    print(f"✅ Copied to frontend result folder: {frontend_result_file}")

    return frontend_result_file
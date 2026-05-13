import subprocess

MATLAB_PATH = r"C:\\Program Files\\MATLAB\\R2025b\\bin\\matlab.exe"

SCRIPT_PATH = r"C:\Users\yipin\OneDrive\Desktop\Y4S1\FYP\MO-SAHH-yipin2 (single)\mo-sahh-master -finalize\Main_LatestLocal.m"

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
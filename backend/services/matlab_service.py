import subprocess

def run_matlab():
    try:
        result = subprocess.run(
            ["matlab", "-batch", "run('your_script.m')"],
            capture_output=True,
            text=True
        )
        print(result.stdout)
    except Exception as e:
        print("MATLAB Error:", e)
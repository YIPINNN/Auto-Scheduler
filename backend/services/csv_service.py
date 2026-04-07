import pandas as pd
import os

OUTPUT_DIR = "output"

def save_all_to_csv(
    technicians,
    target_groups,
    job_titles,
    group_levels,
    group_job_bridge,
    alarm_code
):
    """
    Saves all supporting data to CSV files for MATLAB.
    Ensures the Technician.csv contains the workload count for rescheduling.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Prepare Technician Data
    # We ensure the columns match the exact names MATLAB expects: employeeID, fullName, workload
    tech_df = pd.DataFrame(technicians)
    
    # Ensure 'workload' column exists (default to 0 if not provided by main.py)
    if 'workload' not in tech_df.columns:
        tech_df['workload'] = 0
    
    # Save Technician.csv (Crucial for the workload mechanism)
    tech_df.to_csv(os.path.join(OUTPUT_DIR, "Technician.csv"), index=False)

    # 2. Save other supporting tables
    pd.DataFrame(target_groups).to_csv(os.path.join(OUTPUT_DIR, "TargetGroup_rows.csv"), index=False)
    pd.DataFrame(job_titles).to_csv(os.path.join(OUTPUT_DIR, "JobTitle_rows.csv"), index=False)
    pd.DataFrame(group_levels).to_csv(os.path.join(OUTPUT_DIR, "GroupLevel_rows.csv"), index=False)
    pd.DataFrame(group_job_bridge).to_csv(os.path.join(OUTPUT_DIR, "Group_Job_bridge_rows.csv"), index=False)
    
    # Save AlarmCode.csv (Used in P1 for mapping)
    pd.DataFrame(alarm_code).to_csv(os.path.join(OUTPUT_DIR, "AlarmCode.csv"), index=False)

    print(f"✅ All CSV files saved to {OUTPUT_DIR}/")

def read_result():
    """Reads the MATLAB output for the frontend."""
    file_path = os.path.join(OUTPUT_DIR, "result.txt")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""
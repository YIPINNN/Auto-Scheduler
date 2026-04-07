from fastapi import FastAPI
from services.data_service import get_tasks, get_technicians, save_assignments
from services.csv_service import save_to_csv, read_result
from services.matlab_service import run_matlab

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Backend is running 🚀"}

@app.post("/optimize")
def optimize():
    # 1. Get data from Supabase
    tasks = get_tasks()
    techs = get_technicians()

    # 2. Convert to CSV
    save_to_csv(tasks, techs)

    # 3. Run MATLAB algorithm
    run_matlab()

    # 4. Read result
    result_df = read_result()
    result_data = result_df.to_dict(orient="records")

    # 5. Save result to Supabase
    save_assignments(result_data)

    return {
        "status": "success",
        "assignments": result_data
    }
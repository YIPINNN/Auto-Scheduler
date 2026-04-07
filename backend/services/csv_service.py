import pandas as pd

def save_to_csv(tasks, techs):
    pd.DataFrame(tasks).to_csv("output/tasks.csv", index=False)
    pd.DataFrame(techs).to_csv("output/techs.csv", index=False)

def read_result():
    return pd.read_csv("output/result.csv")
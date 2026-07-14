"""
app.py — startup helper

The Streamlit UI has been replaced by a React/TypeScript frontend (frontend/).
Use the commands below to run the project:

  Backend (FastAPI):
    pip install -r requirements.txt
    uvicorn backend.main:app --reload --port 8000

  Frontend (React + Vite):
    cd frontend
    npm install
    npm run dev

  The frontend dev server will be available at http://localhost:5173
  The API will be available at http://localhost:8000
"""

if __name__ == "__main__":
    import subprocess
    import sys

    print("Starting FastAPI backend on http://localhost:8000 ...")
    subprocess.run(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--reload", "--port", "8000"]
    )

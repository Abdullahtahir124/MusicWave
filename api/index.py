import sys
import os

# Make project root importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app  # noqa: F401 — FastAPI app
from mangum import Mangum

# Vercel serverless handler
handler = Mangum(app, lifespan="off")

from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import uuid
from typing import Dict, Any, Optional

from master_job_army import run_master_job_army

app = FastAPI(title="Master Job Army API")

# In-memory storage for job statuses
jobs: Dict[str, Dict[str, Any]] = {}

class ScrapeRequest(BaseModel):
    query: str
    limit: Optional[int] = None
    headful: Optional[bool] = False

def scrape_worker(job_id: str, query: str, headful: bool, limit: int):
    try:
        leads = run_master_job_army(search_query=query, headful=headful, limit=limit)
        jobs[job_id]["status"] = "done"
        jobs[job_id]["leads"] = leads
    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)

@app.post("/scrape")
def start_scraping(req: ScrapeRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "status": "running",
        "leads": []
    }
    background_tasks.add_task(scrape_worker, job_id, req.query, req.headful, req.limit)
    return {"job_id": job_id}

@app.get("/scrape/{job_id}")
def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return jobs[job_id]

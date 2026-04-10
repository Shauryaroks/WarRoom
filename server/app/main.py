from fastapi import FastAPI
from app.worker import hello

app = FastAPI()

@app.get("/")
def root():
    return {"message": "API is running"}

@app.get("/hello")
def hello_route():
    task = hello.delay()
    return {
        "message": "Task sent to worker",
        "task_id": task.id
    }

@app.get("/health")
def health():
    return {"status": "ok"}

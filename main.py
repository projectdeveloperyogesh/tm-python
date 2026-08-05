import os
import sys
import json
import uuid
import datetime

os.environ["PYTHONIOENCODING"] = "utf-8"

from fastapi import FastAPI, Request, File, UploadFile, Form, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from audio_recorder import DualAudioRecorder
from media_processor import MediaProcessor
from local_speech_engine import LocalSpeechEngine
from meeting_analyzer import MeetingAnalyzer

app = FastAPI(title="TaskPulse AI - Dual Audio Meeting Recorder & Task Extractor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RECORDINGS_DIR = os.path.join(BASE_DIR, "recordings")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
PROCESSED_DIR = os.path.join(BASE_DIR, "processed")
DATA_DIR = os.path.join(BASE_DIR, "data")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

for d in [RECORDINGS_DIR, UPLOADS_DIR, PROCESSED_DIR, DATA_DIR, STATIC_DIR, TEMPLATES_DIR]:
    os.makedirs(d, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/recordings", StaticFiles(directory=RECORDINGS_DIR), name="recordings")
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

templates = Jinja2Templates(directory=TEMPLATES_DIR)

# Initialize Core Services
recorder = DualAudioRecorder(output_dir=RECORDINGS_DIR)
media_processor = MediaProcessor(upload_dir=UPLOADS_DIR, processed_dir=PROCESSED_DIR)
speech_engine = LocalSpeechEngine()

MEETINGS_FILE = os.path.join(DATA_DIR, "meetings.json")
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

def load_json_file(filepath, default_val=None):
    if default_val is None:
        default_val = []
    if not os.path.exists(filepath):
        return default_val
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default_val

def save_json_file(filepath, data):
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_gemini_api_key():
    settings = load_json_file(SETTINGS_FILE, {})
    return settings.get("gemini_api_key", None)

def get_analyzer():
    settings = load_json_file(SETTINGS_FILE, {})
    g_key = settings.get("gemini_api_key") or os.environ.get("GEMINI_API_KEY")
    gr_key = settings.get("groq_api_key") or os.environ.get("GROQ_API_KEY")
    o_key = settings.get("openai_api_key") or os.environ.get("OPENAI_API_KEY")
    ol_host = settings.get("ollama_host") or os.environ.get("OLLAMA_HOST") or "http://localhost:11434"
    prov = settings.get("ai_provider", "auto")
    return MeetingAnalyzer(api_key=g_key, groq_api_key=gr_key, openai_api_key=o_key, ollama_host=ol_host, default_provider=prov)

# --- Routes ---

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    return FileResponse(os.path.join(TEMPLATES_DIR, "index.html"))

@app.get("/api/devices")
async def list_devices():
    """List microphone and system audio loopback devices."""
    try:
        return recorder.get_audio_devices()
    except Exception as e:
        return {"microphones": [], "speakers": [], "error": str(e)}

@app.post("/api/record/start")
async def start_recording(mic_id: int = Form(None), speaker_id: int = Form(None)):
    """Start dual stream recording."""
    result = recorder.start_recording(mic_id=mic_id, speaker_id=speaker_id)
    return result

@app.post("/api/record/pause")
async def pause_recording():
    """Toggle pause/resume on recording."""
    return recorder.pause_recording()

@app.post("/api/record/mute")
async def toggle_mute(target: str = Form(...)):
    """Toggle mute status for a specific stream."""
    return recorder.toggle_mute(target=target)

@app.post("/api/record/stop")
async def stop_recording(meeting_title: str = Form("Live Recorded Meeting"), target_language: str = Form("English")):
    """Stop recording, transcribe locally, generate summary, items discussed, & tasks in target language."""
    stop_result = recorder.stop_recording()
    filepath = stop_result.get("filepath")
    
    if not filepath or not os.path.exists(filepath):
        raise HTTPException(status_code=400, detail="No active desktop recording session found. Please click 'Start Recording' first.")

    # 1. Local Transcription
    live_trans = stop_result.get("live_transcript", [])
    if live_trans and len(live_trans) > 0:
        transcript_text = " ".join([t["text"] for t in live_trans if t.get("text")])
        segments = [{
            "start": t.get("time", "00:00"),
            "end": t.get("time", "00:00"),
            "speaker": t.get("speaker", "Participant"),
            "text": t.get("text", "")
        } for t in live_trans]
    else:
        transcribe_res = speech_engine.transcribe_audio(filepath)
        transcript_text = transcribe_res.get("text", "")
        segments = transcribe_res.get("segments", [])

    # 2. Meeting Analysis (Multi-provider AI)
    analyzer = get_analyzer()
    analysis = analyzer.analyze_meeting(transcript_text, meeting_title=meeting_title, target_language=target_language)

    meeting_id = str(uuid.uuid4())[:8]
    created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    meeting_obj = {
        "id": meeting_id,
        "title": meeting_title,
        "language": target_language,
        "created_at": created_at,
        "audio_url": f"/recordings/{os.path.basename(filepath)}",
        "audio_filename": os.path.basename(filepath),
        "transcript": transcript_text,
        "segments": segments,
        "summary": analysis.get("summary", ""),
        "items_discussed": analysis.get("items_discussed", []),
        "task_count": len(analysis.get("tasks", []))
    }

    # Save to meetings store
    meetings = load_json_file(MEETINGS_FILE, [])
    meetings.insert(0, meeting_obj)
    save_json_file(MEETINGS_FILE, meetings)

    # Save extracted tasks to tasks store
    existing_tasks = load_json_file(TASKS_FILE, [])
    new_tasks = analysis.get("tasks", [])
    for task in new_tasks:
        task["meeting_id"] = meeting_id
        task["language"] = target_language
        existing_tasks.insert(0, task)
    save_json_file(TASKS_FILE, existing_tasks)

    return {
        "status": "success",
        "meeting": meeting_obj,
        "tasks": new_tasks
    }

@app.post("/api/record/stop_web")
async def stop_web_recording(
    file: UploadFile = File(...),
    meeting_title: str = Form("Web Live Recorded Meeting"),
    target_language: str = Form("English")
):
    """Handles live audio recordings captured directly by client web browsers in cloud deployment mode."""
    file_ext = os.path.splitext(file.filename)[1].lower()
    if not file_ext:
        file_ext = ".webm"

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    saved_filename = f"web_rec_{timestamp}{file_ext}"
    upload_filepath = os.path.join(RECORDINGS_DIR, saved_filename)

    with open(upload_filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    # Process and convert to standard 16kHz WAV
    processed_wav = media_processor.process_media_file(upload_filepath)

    # Speech Transcription
    transcribe_res = speech_engine.transcribe_audio(processed_wav)
    transcript_text = transcribe_res.get("text", "")
    segments = transcribe_res.get("segments", [])

    # 2. Meeting Analysis (Multi-provider AI)
    analyzer = get_analyzer()
    analysis = analyzer.analyze_meeting(transcript_text, meeting_title=meeting_title, target_language=target_language)

    meeting_id = str(uuid.uuid4())[:8]
    created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    meeting_obj = {
        "id": meeting_id,
        "title": meeting_title,
        "language": target_language,
        "created_at": created_at,
        "audio_url": f"/recordings/{saved_filename}",
        "audio_filename": saved_filename,
        "transcript": transcript_text,
        "segments": segments,
        "summary": analysis.get("summary", ""),
        "items_discussed": analysis.get("items_discussed", []),
        "task_count": len(analysis.get("tasks", []))
    }

    # Save meeting
    meetings = load_json_file(MEETINGS_FILE, [])
    meetings.insert(0, meeting_obj)
    save_json_file(MEETINGS_FILE, meetings)

    # Save tasks
    existing_tasks = load_json_file(TASKS_FILE, [])
    new_tasks = analysis.get("tasks", [])
    for task in new_tasks:
        task["meeting_id"] = meeting_id
        task["language"] = target_language
        existing_tasks.insert(0, task)
    save_json_file(TASKS_FILE, existing_tasks)

    return {
        "status": "success",
        "meeting": meeting_obj,
        "tasks": new_tasks
    }

@app.get("/api/record/status")
async def recording_status():
    """Returns live volume decibel levels and recording status."""
    return recorder.get_status()

@app.post("/api/upload")
async def upload_media(file: UploadFile = File(...), meeting_title: str = Form("Uploaded Media Meeting"), target_language: str = Form("English")):
    """Upload Audio or Video file, process audio, transcribe locally, and generate insights."""
    file_ext = os.path.splitext(file.filename)[1].lower()
    allowed_exts = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".mp4", ".mkv", ".avi", ".webm", ".mov"]
    
    if file_ext not in allowed_exts:
        raise HTTPException(status_code=400, detail=f"Unsupported file format '{file_ext}'. Allowed formats: {', '.join(allowed_exts)}")

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    saved_filename = f"upload_{timestamp}_{file.filename}"
    upload_filepath = os.path.join(UPLOADS_DIR, saved_filename)

    # Save uploaded file
    with open(upload_filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    # Process and convert to audio WAV
    processed_wav = media_processor.process_media_file(upload_filepath)

    # Local Speech Transcription
    transcribe_res = speech_engine.transcribe_audio(processed_wav)
    transcript_text = transcribe_res.get("text", "")
    segments = transcribe_res.get("segments", [])

    # Meeting Analysis
    api_key = get_gemini_api_key()
    analyzer = MeetingAnalyzer(api_key=api_key)
    analysis = analyzer.analyze_meeting(transcript_text, meeting_title=meeting_title if meeting_title else file.filename, target_language=target_language)

    meeting_id = str(uuid.uuid4())[:8]
    created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    meeting_obj = {
        "id": meeting_id,
        "title": meeting_title if meeting_title else file.filename,
        "language": target_language,
        "created_at": created_at,
        "audio_url": f"/uploads/{saved_filename}",
        "audio_filename": file.filename,
        "transcript": transcript_text,
        "segments": segments,
        "summary": analysis.get("summary", ""),
        "items_discussed": analysis.get("items_discussed", []),
        "task_count": len(analysis.get("tasks", []))
    }

    # Save meeting
    meetings = load_json_file(MEETINGS_FILE, [])
    meetings.insert(0, meeting_obj)
    save_json_file(MEETINGS_FILE, meetings)

    # Save tasks
    existing_tasks = load_json_file(TASKS_FILE, [])
    new_tasks = analysis.get("tasks", [])
    for task in new_tasks:
        task["meeting_id"] = meeting_id
        task["language"] = target_language
        existing_tasks.insert(0, task)
    save_json_file(TASKS_FILE, existing_tasks)

    return {
        "status": "success",
        "meeting": meeting_obj,
        "tasks": new_tasks
    }

@app.post("/api/meetings/{meeting_id}/reanalyze")
async def reanalyze_meeting(meeting_id: str, payload: dict):
    """Re-analyze and translate meeting summary & task list into selected target language."""
    target_language = payload.get("language", "English")
    meetings = load_json_file(MEETINGS_FILE, [])
    meeting_idx = None
    for i, m in enumerate(meetings):
        if m["id"] == meeting_id:
            meeting_idx = i
            break

    if meeting_idx is None:
        raise HTTPException(status_code=404, detail="Meeting session not found")

    meeting = meetings[meeting_idx]
    transcript_text = meeting.get("transcript", "")

    api_key = get_gemini_api_key()
    analyzer = MeetingAnalyzer(api_key=api_key)
    analysis = analyzer.analyze_meeting(transcript_text, meeting_title=meeting.get("title", "Meeting"), target_language=target_language)

    meeting["summary"] = analysis.get("summary", "")
    meeting["items_discussed"] = analysis.get("items_discussed", [])
    meeting["language"] = target_language
    meeting["task_count"] = len(analysis.get("tasks", []))

    meetings[meeting_idx] = meeting
    save_json_file(MEETINGS_FILE, meetings)

    # Remove previous tasks for this meeting and add translated tasks
    existing_tasks = load_json_file(TASKS_FILE, [])
    existing_tasks = [t for t in existing_tasks if t.get("meeting_id") != meeting_id]
    new_tasks = analysis.get("tasks", [])
    for task in new_tasks:
        task["meeting_id"] = meeting_id
        task["language"] = target_language
        existing_tasks.insert(0, task)
    save_json_file(TASKS_FILE, existing_tasks)

    return {
        "status": "success",
        "meeting": meeting,
        "tasks": new_tasks
    }

@app.get("/api/meetings")
async def get_meetings():
    return load_json_file(MEETINGS_FILE, [])

@app.get("/api/meetings/{meeting_id}")
async def get_meeting(meeting_id: str):
    meetings = load_json_file(MEETINGS_FILE, [])
    for m in meetings:
        if m["id"] == meeting_id:
            return m
    raise HTTPException(status_code=404, detail="Meeting session not found")

@app.delete("/api/meetings_all")
async def delete_all_meetings():
    """Deletes all recorded meetings, transcripts, extracted tasks, and audio files."""
    # 1. Clear JSON stores
    save_json_file(MEETINGS_FILE, [])
    save_json_file(TASKS_FILE, [])

    # 2. Delete saved audio files in recordings, uploads, processed
    deleted_files_count = 0
    for folder in [RECORDINGS_DIR, UPLOADS_DIR, PROCESSED_DIR]:
        if os.path.exists(folder):
            for fname in os.listdir(folder):
                fpath = os.path.join(folder, fname)
                try:
                    if os.path.isfile(fpath):
                        os.remove(fpath)
                        deleted_files_count += 1
                except Exception as e:
                    print(f"Error removing file {fpath}: {e}")

    return {
        "status": "success",
        "message": f"Successfully deleted all meeting sessions, tasks, and {deleted_files_count} audio files."
    }

@app.delete("/api/meetings/{meeting_id}")
async def delete_meeting(meeting_id: str):
    meetings = load_json_file(MEETINGS_FILE, [])
    filtered_meetings = [m for m in meetings if m["id"] != meeting_id]
    save_json_file(MEETINGS_FILE, filtered_meetings)
    
    tasks = load_json_file(TASKS_FILE, [])
    filtered_tasks = [t for t in tasks if t.get("meeting_id") != meeting_id]
    save_json_file(TASKS_FILE, filtered_tasks)

    return {"status": "deleted", "meeting_id": meeting_id}

@app.get("/api/tasks")
async def get_tasks():
    return load_json_file(TASKS_FILE, [])

@app.post("/api/tasks")
async def create_task(task: dict):
    tasks = load_json_file(TASKS_FILE, [])
    task["id"] = task.get("id", str(uuid.uuid4())[:8])
    task["status"] = task.get("status", "todo")
    task["subtasks"] = task.get("subtasks", [])
    tasks.insert(0, task)
    save_json_file(TASKS_FILE, tasks)
    return task

@app.put("/api/tasks/{task_id}")
async def update_task(task_id: str, updated_task: dict):
    tasks = load_json_file(TASKS_FILE, [])
    for i, t in enumerate(tasks):
        if t["id"] == task_id:
            tasks[i].update(updated_task)
            save_json_file(TASKS_FILE, tasks)
            return tasks[i]
    raise HTTPException(status_code=404, detail="Task not found")

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    tasks = load_json_file(TASKS_FILE, [])
    filtered_tasks = [t for t in tasks if t["id"] != task_id]
    save_json_file(TASKS_FILE, filtered_tasks)
    return {"status": "deleted", "task_id": task_id}

@app.get("/api/ollama/status")
async def get_ollama_status():
    from ollama_installer import is_ollama_running, get_installed_models
    running = is_ollama_running()
    models = get_installed_models() if running else []
    return {
        "running": running,
        "models": models
    }

@app.post("/api/ollama/setup")
async def setup_ollama(model_name: str = Form("llama3.2")):
    from ollama_installer import auto_setup_ollama
    return auto_setup_ollama(model_name=model_name)

@app.get("/api/settings")
async def get_settings():
    settings = load_json_file(SETTINGS_FILE, {})
    return {
        "ai_provider": settings.get("ai_provider", "auto"),
        "gemini_api_key": settings.get("gemini_api_key", ""),
        "groq_api_key": settings.get("groq_api_key", ""),
        "openai_api_key": settings.get("openai_api_key", ""),
        "ollama_host": settings.get("ollama_host", "http://localhost:11434")
    }

@app.post("/api/settings")
async def update_settings(payload: dict):
    settings = load_json_file(SETTINGS_FILE, {})
    for k in ["ai_provider", "gemini_api_key", "groq_api_key", "openai_api_key", "ollama_host"]:
        if k in payload:
            settings[k] = payload[k]
    save_json_file(SETTINGS_FILE, settings)
    return {"status": "saved"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)

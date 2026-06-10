"""
Resolve AI RoughCut with GUI (Resolve 20 Studio)

Workflow:
1) Select the timeline clips you want (single-camera, timeline items).
2) Tag them in the Edit page by setting their clip color (e.g. Yellow).
3) Run this script from DaVinci Resolve. Adjust settings in the GUI.
4) Click "Run AI RoughCut" to create a new timeline containing the most stable segments.
"""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

# We will import Resolve script module dynamically
def _import_davinci_resolve_script():
    try:
        import DaVinciResolveScript as dvr_script  # type: ignore
        return dvr_script
    except ModuleNotFoundError:
        import sys
        programdata = os.environ.get("PROGRAMDATA", r"C:\ProgramData")
        candidates = [
            os.path.join(programdata, "Blackmagic Design", "DaVinci Resolve", "Support", "Developer", "Scripting", "Modules"),
            os.path.join(programdata, "Blackmagic Design", "DaVinci Resolve", "Developer", "Scripting", "Modules"),
        ]
        for p in candidates:
            if os.path.isdir(p) and p not in sys.path:
                sys.path.append(p)
        import DaVinciResolveScript as dvr_script  # type: ignore
        return dvr_script

# Global UI Logger Helper
def append_log(win, message):
    formatted_msg = f"[{time.strftime('%H:%M:%S')}] {message}\n"
    print(formatted_msg, end="")  # Print to terminal/console stdout
    
    try:
        log_widget = win.GetItems()["LogOutput"]
    except Exception:
        return
        
    # Try different properties/methods of UIManager TextEdit to set text safely
    try:
        current = log_widget.HTML or ""
        log_widget.HTML = current + formatted_msg.replace("\n", "<br>")
        return
    except Exception:
        pass

    try:
        current = log_widget.PlainText or ""
        log_widget.PlainText = current + formatted_msg
        return
    except Exception:
        pass

    try:
        current = log_widget.GetText() or ""
        log_widget.SetText(current + formatted_msg)
        return
    except Exception:
        pass
        
    try:
        current = log_widget.Text or ""
        log_widget.Text = current + formatted_msg
        return
    except Exception:
        pass


@dataclass(frozen=True)
class ClipSelection:
    timeline_item: Any
    media_pool_item: Any
    source_path: str
    source_start_time: float
    source_end_time: float
    source_start_frame: int
    source_end_frame: int
    clip_start_frame: int  # Starting frame offset of the raw file (to handle non-zero timecodes)
    fps: float


def _parse_float_from_frame_rate(value: str) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip().replace("DF", "").strip()
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)", s)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _best_effort_source_path(media_pool_item: Any) -> Optional[str]:
    try:
        props = media_pool_item.GetClipProperty()
    except Exception:
        return None

    if not isinstance(props, dict):
        return None

    candidate_keys = [
        "File Path", "File Path (Full)", "File Path (Original)", 
        "FilePath", "Source File", "Source Path", "Media Path", "Location"
    ]
    for k in candidate_keys:
        if k in props and isinstance(props[k], str) and props[k].strip():
            return props[k].strip()

    for k, v in props.items():
        kl = str(k).lower()
        if ("file" in kl or "path" in kl) and isinstance(v, str) and v.strip():
            return v.strip()

    return None


def _normalize_filesystem_path(path: str) -> str:
    p = str(path).strip().strip('"').strip("'")
    if p.lower().startswith("file://"):
        # Use standard URL path decoding to handle drive letters and slashes correctly on Windows
        p = urllib.request.url2pathname(urllib.parse.urlparse(p).path)
    else:
        p = p.replace("/", "\\")
    return p


def _ffmpeg_extract_sample_frames(
    ffmpeg_path: str,
    input_path: str,
    start_time_sec: float,
    duration_sec: float,
    sample_fps: float,
    out_dir: str,
    scale_width: int = 320,
) -> List[str]:
    vf = f"fps={sample_fps},scale={scale_width}:-2:flags=lanczos,format=yuv420p"

    # Crucial Enhancement: Prevent cmd/terminal window popup on Windows
    creation_flags = 0
    if os.name == 'nt':
        creation_flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000)

    def extract(ext: str) -> List[str]:
        pattern = os.path.join(out_dir, f"frame_%06d.{ext}")
        cmd = [
            ffmpeg_path,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            input_path,
            "-ss",
            f"{start_time_sec:.6f}",
            "-t",
            f"{duration_sec:.6f}",
            "-an",
            "-sn",
            "-vf",
            vf,
        ]
        if ext.lower() in {"jpg", "jpeg"}:
            cmd += ["-q:v", "2"]
        cmd += [pattern]

        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=creation_flags
        )
        if proc.returncode != 0:
            raise RuntimeError(
                f"ffmpeg failed writing .{ext} (code={proc.returncode}). stderr:\n{proc.stderr[-1000:]}"
            )

        frames = [
            os.path.join(out_dir, f)
            for f in os.listdir(out_dir)
            if f.lower().endswith(f".{ext.lower()}")
        ]
        frames.sort()
        return frames

    try:
        frames = extract("jpg")
    except Exception:
        frames = extract("png")

    return frames


def _frame_metrics_cv2(frames: List[str]) -> Tuple[List[float], List[float]]:
    import cv2  # type: ignore
    import numpy as np  # type: ignore

    blur_vars: List[float] = []
    prev_gray = None
    motion_means: List[float] = []

    for idx, fp in enumerate(frames):
        img = cv2.imread(fp)
        if img is None:
            raise RuntimeError(f"Failed to read frame image: {fp}")
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        blur = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        blur_vars.append(blur)

        if prev_gray is not None:
            diff = cv2.absdiff(gray, prev_gray)
            motion = float(np.mean(diff))
            motion_means.append(motion)
        prev_gray = gray

    return blur_vars, motion_means


def _pick_best_stable_segment_local(
    frames: List[str],
    sample_fps: float,
    segment_seconds_min: float,
    segment_seconds_max: float,
    top_k: int,
) -> Tuple[float, float, Dict[str, Any]]:
    if not frames:
        raise ValueError("No frames provided for stability scoring.")

    min_s = float(segment_seconds_min)
    max_s = float(segment_seconds_max)
    if max_s < min_s:
        max_s = min_s
    if min_s <= 0:
        min_s = 0.5

    length_candidates: List[float] = []
    cur = min_s
    step = 0.5
    while cur <= max_s + 1e-9:
        length_candidates.append(round(cur, 3))
        cur += step

    blur_vars, motion_means = _frame_metrics_cv2(frames)

    if len(frames) >= 2:
        motion_means_extended = motion_means + [motion_means[-1]]
    else:
        motion_means_extended = motion_means

    best_i = 0
    best_len_s = length_candidates[0] if length_candidates else max_s
    best_score = float("-inf")

    candidate_scores: List[Tuple[int, float, float, float, float]] = []
    eps = 1e-9

    for seg_len_s in length_candidates:
        window_samples = max(2, int(round(seg_len_s * sample_fps)))
        if window_samples > len(frames):
            continue

        max_start = len(frames) - window_samples
        if max_start < 0:
            continue

        for i0 in range(0, max_start + 1):
            i1 = i0 + window_samples
            blur_window = blur_vars[i0:i1]
            motion_window = motion_means_extended[i0:i1]

            blur_mean = float(sum(blur_window) / len(blur_window))
            motion_mean = float(sum(motion_window) / len(motion_window))

            score = blur_mean - motion_mean
            candidate_scores.append((i0, seg_len_s, score, blur_mean, motion_mean))

            if score > best_score + eps:
                best_score = score
                best_i = i0
                best_len_s = seg_len_s
            elif abs(score - best_score) <= eps:
                if seg_len_s > best_len_s:
                    best_i = i0
                    best_len_s = seg_len_s

    start_offset_sec = best_i / sample_fps
    debug = {
        "total_frames": len(frames),
        "best_i": best_i,
        "best_len_s": best_len_s,
        "best_score": best_score,
        "length_candidates": length_candidates,
        "candidates": sorted(candidate_scores, key=lambda x: x[2], reverse=True)[:top_k],
    }
    return start_offset_sec, float(best_len_s), debug


def _call_gemini_pick_candidate(
    gemini_key: str,
    gemini_model: str,
    clip_name: str,
    candidates: List[Dict[str, Any]],
    segment_seconds_max: float,
) -> Optional[int]:
    if not gemini_key:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{urllib.parse.quote(gemini_model)}:generateContent?key={urllib.parse.quote(gemini_key)}"

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": json.dumps(
                            {
                                "task": "Pick the best stable segment candidate. Choose the most stable/non-shaky option based on metrics.",
                                "clipName": clip_name,
                                "segmentSecondsMax": segment_seconds_max,
                                "candidates": candidates,
                                "output": {
                                    "best_index": "index of chosen candidate in the input list (0-based)",
                                    "reason": "one short sentence",
                                },
                            },
                            ensure_ascii=False,
                        )
                    }
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 160,
            "responseMimeType": "application/json",
        },
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
        data = json.loads(raw)
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        if parts:
            text = parts[0].get("text", "") or ""
            obj = json.loads(text)
            best_index = obj.get("best_index", None)
            if isinstance(best_index, int):
                return best_index
            if isinstance(best_index, str) and best_index.isdigit():
                return int(best_index)
    except Exception:
        pass
    return None


def _select_clips_by_color(timeline: Any, clip_color_filter: str) -> List[Any]:
    clip_items: List[Any] = []
    vtracks = timeline.GetTrackCount("video")
    for ti_idx in range(1, vtracks + 1):
        items = timeline.GetItemListInTrack("video", ti_idx) or []
        for it in items:
            try:
                c = it.GetClipColor()
            except Exception:
                continue
            if not isinstance(c, str):
                continue
            if c.strip().lower() == clip_color_filter.strip().lower():
                clip_items.append(it)
    clip_items.sort(key=lambda x: float(x.GetStart(False) if hasattr(x, "GetStart") else x.GetStart(True)))
    return clip_items


def _build_clip_selection(timeline_item: Any) -> Optional[ClipSelection]:
    try:
        mpi = timeline_item.GetMediaPoolItem()
        if mpi is None:
            return None

        source_path = _best_effort_source_path(mpi)
        if not source_path:
            return None
        source_path = _normalize_filesystem_path(source_path)

        source_start_time = float(timeline_item.GetSourceStartTime())
        source_end_time = float(timeline_item.GetSourceEndTime())
        if source_end_time <= source_start_time:
            return None

        source_start_frame = int(timeline_item.GetSourceStartFrame())
        source_end_frame = int(timeline_item.GetSourceEndFrame())

        duration_time = source_end_time - source_start_time
        source_frame_count = int(source_end_frame - source_start_frame)
        fps = (float(source_frame_count) / duration_time) if duration_time > 0 else 0.0
        if fps <= 0:
            duration_frames = float(timeline_item.GetDuration(False))
            fps = duration_frames / duration_time if duration_time > 0 else 0.0

        # Retrieve starting frame offset of the raw file
        start_property = mpi.GetClipProperty("Start")
        try:
            clip_start_frame = int(start_property) if start_property else 0
        except (ValueError, TypeError):
            clip_start_frame = 0

        return ClipSelection(
            timeline_item=timeline_item,
            media_pool_item=mpi,
            source_path=source_path,
            source_start_time=source_start_time,
            source_end_time=source_end_time,
            source_start_frame=source_start_frame,
            source_end_frame=source_end_frame,
            clip_start_frame=clip_start_frame,
            fps=fps,
        )
    except Exception:
        return None


def show_ui():
    dvr_script = _import_davinci_resolve_script()
    resolve = dvr_script.scriptapp("Resolve")
    if resolve is None:
        print("Error: Could not connect to DaVinci Resolve scripting API.")
        return

    fusion = resolve.Fusion()
    ui = fusion.UIManager
    disp = dvr_script.UIDispatcher(ui)

    # Initial value defaults
    env_ffmpeg = os.environ.get("RESOLVE_AI_FFMPEG_PATH", "ffmpeg")
    env_gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    env_gemini_model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

    # Define layout
    window_layout = ui.VGroup([
        ui.Label({"Text": "Resolve AI RoughCut Settings", "Font": ui.Font({"PointSize": 12, "Bold": True})}),
        
        ui.HGroup([
            ui.Label({"Text": "Min Segment Length (sec):", "Weight": 1}),
            ui.LineEdit({"ID": "MinSecs", "Text": "3.0", "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "Max Segment Length (sec):", "Weight": 1}),
            ui.LineEdit({"ID": "MaxSecs", "Text": "4.0", "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "Clip Color Filter:", "Weight": 1}),
            ui.ComboBox({"ID": "ClipColor", "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "Sample FPS:", "Weight": 1}),
            ui.LineEdit({"ID": "SampleFps", "Text": "4.0", "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "Insert Original Audio:", "Weight": 1}),
            ui.CheckBox({"ID": "InsertAudio", "Checked": False, "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "Gemini API Key:", "Weight": 1}),
            ui.LineEdit({"ID": "GeminiKey", "Text": env_gemini_key, "EchoMode": "Normal", "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "Gemini Model:", "Weight": 1}),
            ui.LineEdit({"ID": "GeminiModel", "Text": env_gemini_model, "Weight": 2})
        ]),
        ui.HGroup([
            ui.Label({"Text": "FFmpeg Executable Path:", "Weight": 1}),
            ui.LineEdit({"ID": "FfmpegPath", "Text": env_ffmpeg, "Weight": 2})
        ]),
        
        ui.HGroup([
            ui.Button({"ID": "ScanBtn", "Text": "Scan Selected Clips"}),
            ui.Button({"ID": "RunBtn", "Text": "Run AI RoughCut", "Weight": 2})
        ]),
        
        ui.Label({"Text": "Status Logs:", "Font": ui.Font({"Bold": True})}),
        ui.TextEdit({"ID": "LogOutput", "ReadOnly": True, "Text": "Ready.\n", "Weight": 5})
    ])

    win = disp.AddWindow(
        {
            "ID": "AIRoughCutWin",
            "WindowTitle": "Resolve AI RoughCut (Studio)",
            "Geometry": [300, 200, 550, 450]
        },
        window_layout
    )

    items = win.GetItems()
    
    # Initialize ComboBox
    combo = items["ClipColor"]
    combo.AddItems(["Yellow", "Green", "Blue", "Pink", "Red", "Orange", "Purple", "Cyan", "Chocolate", "Cream", "Navy", "Apricot"])

    def on_close(ev):
        disp.ExitLoop()

    def on_scan(ev):
        try:
            project_manager = resolve.GetProjectManager()
            project = project_manager.GetCurrentProject()
            if project is None:
                append_log(win, "Error: No project open.")
                return
            timeline = project.GetCurrentTimeline()
            if timeline is None:
                append_log(win, "Error: No timeline open.")
                return
            
            color_filter = items["ClipColor"].CurrentText
            tagged_items = _select_clips_by_color(timeline, color_filter)
            append_log(win, f"Found {len(tagged_items)} clips with color '{color_filter}' on the current timeline.")
            for idx, it in enumerate(tagged_items):
                try:
                    name = it.GetName()
                except Exception:
                    name = f"Clip #{idx+1}"
                append_log(win, f" - {name}")
        except Exception as e:
            append_log(win, f"Error: {e}")

    def on_run(ev):
        items["RunBtn"].Enabled = False
        items["ScanBtn"].Enabled = False
        try:
            # 1. Gather GUI Settings
            ffmpeg_path = items["FfmpegPath"].Text.strip()
            min_sec = float(items["MinSecs"].Text.strip())
            max_sec = float(items["MaxSecs"].Text.strip())
            color_filter = items["ClipColor"].CurrentText
            sample_fps = float(items["SampleFps"].Text.strip())
            insert_audio = items["InsertAudio"].Checked
            gemini_key = items["GeminiKey"].Text.strip()
            gemini_model = items["GeminiModel"].Text.strip()
            
            if min_sec <= 0 or max_sec <= 0:
                append_log(win, "Error: Length settings must be positive numbers.")
                return
            if max_sec < min_sec:
                append_log(win, "Warning: Max length is smaller than Min length. Aligning Max to Min.")
                max_sec = min_sec

            append_log(win, "Starting AI RoughCut processing...")
            
            # 2. Check for dependency requirements
            if not shutil.which(ffmpeg_path):
                append_log(win, f"Error: FFmpeg executable not found at '{ffmpeg_path}'. Verify your settings/PATH.")
                return
                
            try:
                import cv2
                import numpy
            except ImportError as e:
                append_log(win, f"Error: Required Python libraries missing in Resolve environment: {e}")
                append_log(win, "Please install OpenCV and NumPy in terminal: pip install opencv-python numpy")
                return

            # 3. Retrieve Timeline Data
            project_manager = resolve.GetProjectManager()
            project = project_manager.GetCurrentProject()
            if project is None:
                append_log(win, "Error: No project open.")
                return
            timeline = project.GetCurrentTimeline()
            if timeline is None:
                append_log(win, "Error: No active timeline.")
                return
            media_pool = project.GetMediaPool()
            if media_pool is None:
                append_log(win, "Error: Could not access MediaPool.")
                return

            tagged_items = _select_clips_by_color(timeline, color_filter)
            if not tagged_items:
                append_log(win, f"Error: No clips with color '{color_filter}' found in current timeline.")
                return

            selections: List[ClipSelection] = []
            for it in tagged_items:
                sel = _build_clip_selection(it)
                if sel is not None:
                    selections.append(sel)

            append_log(win, f"Valid clips found for analysis: {len(selections)}")
            if not selections:
                append_log(win, "Error: Selected clips did not contain valid source path/timing metadata.")
                return

            # Create Output Timeline
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            out_timeline_name = f"AI_RoughCut_{timestamp}"
            append_log(win, f"Creating output timeline: {out_timeline_name}")
            out_timeline = media_pool.CreateEmptyTimeline(out_timeline_name)
            if out_timeline is None:
                append_log(win, "Error: Failed to create output timeline.")
                return
            
            project.SetCurrentTimeline(out_timeline)

            try:
                if out_timeline.GetTrackCount("video") < 1:
                    out_timeline.AddTrack("video", "mono")
            except Exception:
                try:
                    if out_timeline.GetTrackCount("video") < 1:
                        out_timeline.AddTrack("video")
                except Exception:
                    pass

            # Gather Timeline FPS
            timeline_fps = None
            try:
                timeline_fps = _parse_float_from_frame_rate(str(out_timeline.GetSetting("timelineFrameRate")))
            except Exception:
                pass
            if timeline_fps is None:
                try:
                    timeline_fps = _parse_float_from_frame_rate(str(project.GetSetting("timelineFrameRate")))
                except Exception:
                    pass
            if timeline_fps is None or timeline_fps <= 0:
                timeline_fps = 25.0

            video_track_index = 1
            output_cursor_frame = 0
            appended_segments = 0
            top_k_candidates = 5
            max_samples_per_clip = 1200

            # 4. Processing Loop
            for idx, sel in enumerate(selections):
                ti = sel.timeline_item
                mp = sel.media_pool_item
                
                try:
                    clip_name = str(ti.GetName())
                except Exception:
                    clip_name = f"clip_{idx+1}"

                append_log(win, f"Analyzing clip [{idx+1}/{len(selections)}]: {clip_name}")

                input_duration_sec = sel.source_end_time - sel.source_start_time
                if input_duration_sec <= 0.01:
                    append_log(win, f"  -> Skipped: Clip duration too small ({input_duration_sec:.3f}s)")
                    continue

                segment_seconds_max_for_clip = min(max_sec, input_duration_sec)
                segment_seconds_min_for_clip = min(min_sec, segment_seconds_max_for_clip)
                if segment_seconds_max_for_clip <= 0.5:
                    append_log(win, "  -> Skipped: Under minimum duration for analysis (0.5s)")
                    continue

                # Adjust sample rate if clip is extremely long
                sample_fps_eff = sample_fps
                est_samples = int(max(1.0, input_duration_sec * sample_fps_eff))
                if est_samples > max_samples_per_clip:
                    sample_fps_eff = max(1.0, max_samples_per_clip / input_duration_sec)

                # Media relative seek calculation (Corrected Timecode Offset)
                media_start_frame = sel.source_start_frame - sel.clip_start_frame
                media_start_time_sec = float(media_start_frame) / float(sel.fps)
                
                # Temp files directory
                tmp_root = tempfile.mkdtemp(prefix="resolve_ai_roughcut_")
                frames_dir = os.path.join(tmp_root, "frames")
                os.makedirs(frames_dir, exist_ok=True)

                chosen_start_offset = 0.0
                chosen_seg_seconds = segment_seconds_max_for_clip

                try:
                    # Run silent FFmpeg extraction
                    frames = _ffmpeg_extract_sample_frames(
                        ffmpeg_path=ffmpeg_path,
                        input_path=sel.source_path,
                        start_time_sec=media_start_time_sec,
                        duration_sec=input_duration_sec,
                        sample_fps=sample_fps_eff,
                        out_dir=frames_dir,
                    )

                    if not frames:
                        raise RuntimeError("FFmpeg did not produce any frame outputs.")

                    # Calculate local stability
                    local_start_offset, local_seg_seconds, local_debug = _pick_best_stable_segment_local(
                        frames=frames,
                        sample_fps=sample_fps_eff,
                        segment_seconds_min=segment_seconds_min_for_clip,
                        segment_seconds_max=segment_seconds_max_for_clip,
                        top_k=top_k_candidates,
                    )
                    chosen_start_offset = float(local_start_offset)
                    chosen_seg_seconds = float(local_seg_seconds)

                    # Gemini decision refinement if api key provided
                    if gemini_key:
                        candidates_local = local_debug.get("candidates", [])[:top_k_candidates]
                        candidates_payload = []
                        for c_idx, (i0, seg_len_s, score, blur, motion) in enumerate(candidates_local):
                            candidates_payload.append({
                                "index": c_idx,
                                "startOffsetSec": i0 / sample_fps_eff,
                                "segmentSeconds": float(seg_len_s),
                                "localScore": score,
                                "blurMean": blur,
                                "motionMean": motion
                            })

                        gemini_best_idx = _call_gemini_pick_candidate(
                            gemini_key=gemini_key,
                            gemini_model=gemini_model,
                            clip_name=clip_name,
                            candidates=candidates_payload,
                            segment_seconds_max=segment_seconds_max_for_clip
                        )
                        if gemini_best_idx is not None and 0 <= gemini_best_idx < len(candidates_payload):
                            chosen_start_offset = float(candidates_payload[gemini_best_idx]["startOffsetSec"])
                            chosen_seg_seconds = float(candidates_payload[gemini_best_idx]["segmentSeconds"])
                            append_log(win, f"  -> Gemini selected Candidate #{gemini_best_idx} ({chosen_seg_seconds:.2f}s)")
                        else:
                            append_log(win, f"  -> Local stability algorithm selected window ({chosen_seg_seconds:.2f}s)")
                    else:
                        append_log(win, f"  -> Stability window selected: {chosen_start_offset:.2f}s offset ({chosen_seg_seconds:.2f}s)")

                except Exception as ex:
                    append_log(win, f"  -> Extraction/Analysis failed: {ex}")
                    continue
                finally:
                    shutil.rmtree(tmp_root, ignore_errors=True)

                # Determine Timeline Frames
                segment_frames = int(round(chosen_seg_seconds * sel.fps))
                clip_max_frames = int(sel.source_end_frame - sel.source_start_frame)
                if segment_frames > clip_max_frames:
                    segment_frames = clip_max_frames

                chosen_start_source_frame = sel.source_start_frame + int(round(chosen_start_offset * sel.fps))
                chosen_end_source_frame = chosen_start_source_frame + segment_frames

                # Clamping boundaries
                if chosen_end_source_frame > sel.source_end_frame:
                    chosen_end_source_frame = sel.source_end_frame
                    chosen_start_source_frame = chosen_end_source_frame - segment_frames
                if chosen_start_source_frame < sel.source_start_frame:
                    chosen_start_source_frame = sel.source_start_frame
                    chosen_end_source_frame = chosen_start_source_frame + segment_frames
                if chosen_end_source_frame > sel.source_end_frame:
                    chosen_end_source_frame = sel.source_end_frame

                # Append to active output timeline
                clip_info = {
                    "mediaPoolItem": mp,
                    "startFrame": chosen_start_source_frame,
                    "endFrame": chosen_end_source_frame,
                    "trackIndex": video_track_index,
                    "recordFrame": output_cursor_frame,
                }

                result_items = media_pool.AppendToTimeline([{**clip_info, "mediaType": 1}])
                
                n_appended = 0
                if isinstance(result_items, list):
                    n_appended = len(result_items)
                elif result_items is not None:
                    n_appended = 1

                if n_appended > 0:
                    appended_segments += 1
                    output_cursor_frame += int(round(chosen_seg_seconds * timeline_fps))
                    append_log(win, f"  -> Successfully placed segment in timeline.")
                else:
                    append_log(win, "  -> Error: AppendToTimeline returned no items.")

                if insert_audio:
                    try:
                        media_pool.AppendToTimeline([{**clip_info, "mediaType": 2}])
                    except Exception as audio_err:
                        append_log(win, f"  -> Audio insert error: {audio_err}")

            try:
                project.SaveProject()
            except Exception:
                pass

            append_log(win, f"AI RoughCut Complete! Created timeline '{out_timeline_name}' with {appended_segments} stable clips.")

        except Exception as err:
            append_log(win, f"Execution failed: {err}")
        finally:
            items["RunBtn"].Enabled = True
            items["ScanBtn"].Enabled = True

    # Assign event handlers
    win.On.AIRoughCutWin.Close = on_close
    win.On.ScanBtn.Clicked = on_scan
    win.On.RunBtn.Clicked = on_run

    win.Show()
    disp.RunLoop()


if __name__ == "__main__":
    show_ui()

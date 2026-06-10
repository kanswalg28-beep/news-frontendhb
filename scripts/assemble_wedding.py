import os
import sys
import re
import subprocess
import xml.etree.ElementTree as ET
from xml.dom import minidom
import cv2
import numpy as np

# Default Configurations (overridden by AGENTS.md if present)
CONFIG = {
    "trim_start_sec": 2.0,
    "trim_end_sec": 2.0,
    "audio_enabled": True,
    "cross_dissolve_sec": 1.0,
    "clip_duration_sec": 4.0,
    "speed_ratio": 0.4,
    "audio_threshold_rms": 0.015,
    "sequence_fps": 50.0,
}

def parse_agents_md(filepath):
    """Parses style configurations and thresholds from AGENTS.md"""
    if not os.path.exists(filepath):
        print(f"[Info] AGENTS.md not found at {filepath}. Using default parameters.")
        return CONFIG

    print(f"[Info] Loading signature style parameters from {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Search for markdown list key-values, e.g. - **trim_start_sec**: 2.0
    pattern = r'-\s*\*\*([a-zA-Z0-9_]+)\*\*:\s*([^\n\r]+)'
    matches = re.findall(pattern, content)
    for key, val in matches:
        key = key.strip()
        val = val.strip()
        
        # Clean value from comments, e.g., "2.0 (Seconds to cut...)" -> "2.0"
        clean_val = val.split('(')[0].split('#')[0].strip()
        
        # Parse boolean
        if clean_val.lower() == 'true':
            CONFIG[key] = True
        elif clean_val.lower() == 'false':
            CONFIG[key] = False
        # Parse number
        else:
            try:
                if '.' in clean_val:
                    CONFIG[key] = float(clean_val)
                else:
                    CONFIG[key] = int(clean_val)
            except ValueError:
                CONFIG[key] = val  # keep original string as fallback if not a number
                
    print("[Config] Loaded Parameters:")
    for k, v in CONFIG.items():
        print(f"  {k}: {v}")
    return CONFIG

def get_video_metadata(video_path):
    """Uses ffprobe to extract video duration and framerate"""
    cmd = [
        'ffprobe', 
        '-v', 'error', 
        '-show_entries', 'format=duration:stream=r_frame_rate,codec_type', 
        '-of', 'json', 
        video_path
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        import json
        metadata = json.loads(result.stdout)
        
        duration = float(metadata.get('format', {}).get('duration', 0))
        
        fps = 50.0 # Default fallback
        has_audio = False
        
        streams = metadata.get('streams', [])
        for stream in streams:
            if stream.get('codec_type') == 'video':
                r_fps = stream.get('r_frame_rate', '50/1')
                if '/' in r_fps:
                    num, den = map(int, r_fps.split('/'))
                    fps = num / den if den > 0 else 50.0
                else:
                    fps = float(r_fps)
            elif stream.get('codec_type') == 'audio':
                has_audio = True
                
        return duration, fps, has_audio
    except Exception as e:
        print(f"[Warning] Failed to read metadata for {video_path}: {e}")
        return 0, 50.0, False

def extract_and_analyze_audio(video_path, threshold_rms):
    """
    Pipes audio from ffmpeg directly into Python to measure RMS energy.
    Avoids creating temp files on disk. Highly efficient.
    """
    # Extract mono 8kHz 16-bit audio from the first 20 seconds
    cmd = [
        'ffmpeg',
        '-y',
        '-ss', '0',
        '-t', '20',  # analyze first 20 seconds
        '-i', video_path,
        '-vn',
        '-ac', '1',
        '-ar', '8000',
        '-f', 's16le',
        'pipe:1'
    ]
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        raw_audio, _ = process.communicate()
        
        if len(raw_audio) == 0:
            return 0.0, False  # No audio stream or silent
            
        # Interpret bytes as 16-bit integers and normalize to [-1.0, 1.0]
        samples = np.frombuffer(raw_audio, dtype=np.int16) / 32768.0
        rms = np.sqrt(np.mean(samples ** 2))
        
        # We also check the standard deviation of RMS in 1-second chunks to identify dynamic beats/clapping
        chunk_size = 8000  # 1 second of audio at 8kHz
        chunk_rms = []
        for i in range(0, len(samples), chunk_size):
            chunk = samples[i:i+chunk_size]
            if len(chunk) > 100:
                chunk_rms.append(np.sqrt(np.mean(chunk ** 2)))
        
        rms_variance = np.std(chunk_rms) if chunk_rms else 0.0
        
        # High RMS energy or high volume variance (indicating dynamic singing/percussion)
        is_dance = (rms > threshold_rms) or (rms_variance > threshold_rms * 0.5)
        return rms, is_dance
    except Exception as e:
        print(f"[Warning] Audio analysis failed for {video_path}: {e}")
        return 0.0, False

def analyze_motion_stability(video_path, target_duration_sec, sequence_fps):
    """
    Uses OpenCV optical flow tracking on a downscaled representation (270p)
    of the video to measure camera movement frame-by-frame.
    Finds the continuous 4-5 second window with the lowest camera shake variance.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"[Error] Could not open video file {video_path} for motion tracking.")
        return 0, int(target_duration_sec * sequence_fps)

    original_fps = cap.get(cv2.CAP_PROP_FPS)
    if original_fps <= 0:
        original_fps = sequence_fps
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Target analysis parameters
    subsample_step = 3  # Analyze every 3rd frame to maximize processing speed
    downscale_h = 270   # Downscale 1080p to 480x270 in-memory
    
    shake_values = []
    frame_indices = []
    
    prev_gray = None
    prev_pts = None
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_idx % subsample_step == 0:
            h, w = frame.shape[:2]
            aspect = w / h
            downscale_w = int(downscale_h * aspect)
            
            # Fast downscale
            small_frame = cv2.resize(frame, (downscale_w, downscale_h), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small_frame, cv2.COLOR_BGR2GRAY)
            
            shake = 0.0
            if prev_gray is not None:
                # Track key features
                if prev_pts is None or len(prev_pts) < 15:
                    prev_pts = cv2.goodFeaturesToTrack(prev_gray, maxCorners=60, qualityLevel=0.05, minDistance=10)
                
                if prev_pts is not None and len(prev_pts) > 0:
                    next_pts, status, err = cv2.calcOpticalFlowPyrLK(prev_gray, gray, prev_pts, None)
                    
                    good_prev = prev_pts[status == 1]
                    good_next = next_pts[status == 1]
                    
                    if len(good_prev) > 3:
                        # Compute translations (dx, dy)
                        diffs = good_next - good_prev
                        dx_med = np.median(diffs[:, 0])
                        dy_med = np.median(diffs[:, 1])
                        
                        # Calculate sudden camera acceleration/shake
                        shake = float(dx_med**2 + dy_med**2)
                        prev_pts = good_next.reshape(-1, 1, 2)
                    else:
                        prev_pts = None
                else:
                    prev_pts = None
            
            shake_values.append(shake)
            frame_indices.append(frame_idx)
            prev_gray = gray
            
        frame_idx += 1
        
    cap.release()
    
    if len(shake_values) < 5:
        # Too short, default to start
        return 0, int(target_duration_sec * original_fps)

    # We want a timeline segment of target_duration_sec.
    # Because of slow-motion retiming (40% speed), a 4.0 second segment on the timeline 
    # translates to 4.0 * 0.4 = 1.6 seconds of real-time source footage.
    # Real-time source frames needed = 1.6s * original_fps.
    source_duration_sec = target_duration_sec * CONFIG["speed_ratio"]
    frames_needed = int(source_duration_sec * original_fps)
    
    # Convert frames needed to our subsampled indexes count
    subsampled_window_size = max(1, int(frames_needed / subsample_step))
    
    if len(shake_values) <= subsampled_window_size:
        # Video is shorter than required window, return full video duration
        return 0, total_frames

    # Sliding window to find minimum shake variance (most stable part)
    min_shake_sum = float('inf')
    best_start_idx = 0
    
    # Smooth the shake values using a simple moving average to avoid transient spikes
    smoothed_shake = np.convolve(shake_values, np.ones(3)/3, mode='same')
    
    for i in range(len(smoothed_shake) - subsampled_window_size + 1):
        window_shake = np.sum(smoothed_shake[i:i+subsampled_window_size])
        if window_shake < min_shake_sum:
            min_shake_sum = window_shake
            best_start_idx = i
            
    best_start_frame = frame_indices[best_start_idx]
    best_end_frame = min(total_frames, best_start_frame + frames_needed)
    
    return best_start_frame, best_end_frame

def path_to_url(filepath):
    """Converts a standard Windows path to an FCP7/Premiere compatible absolute file URL"""
    abs_path = os.path.abspath(filepath).replace('\\', '/')
    if not abs_path.startswith('/'):
        abs_path = '/' + abs_path
    return f"file://localhost{abs_path}"

def build_fcp7_xml(clips_data, output_xml_path, sequence_fps):
    """
    Generates a beautifully structured Final Cut Pro 7 XML timeline.
    Compatible with Adobe Premiere Pro and DaVinci Resolve.
    """
    timebase_str = str(int(sequence_fps))
    
    # Root element
    xmeml = ET.Element('xmeml', version='5')
    project = ET.SubElement(xmeml, 'project')
    ET.SubElement(project, 'name').text = "Wedding Rough Cut Project"
    
    children = ET.SubElement(project, 'children')
    sequence = ET.SubElement(children, 'sequence', id='sequence-1')
    ET.SubElement(sequence, 'name').text = "Master Automated Timeline"
    
    # Sequence Rates
    seq_rate = ET.SubElement(sequence, 'rate')
    ET.SubElement(seq_rate, 'timebase').text = timebase_str
    ET.SubElement(seq_rate, 'ntsc').text = "FALSE"
    
    ET.SubElement(sequence, 'duration').text = "0"  # Computed dynamically
    
    timecode = ET.SubElement(sequence, 'timecode')
    tc_rate = ET.SubElement(timecode, 'rate')
    ET.SubElement(tc_rate, 'timebase').text = timebase_str
    ET.SubElement(tc_rate, 'ntsc').text = "FALSE"
    ET.SubElement(timecode, 'string').text = "00:00:00:00"
    ET.SubElement(timecode, 'frame').text = "0"
    ET.SubElement(timecode, 'displayformat').text = "NDF"
    
    media = ET.SubElement(sequence, 'media')
    
    # Video Channel Track Setup
    video_node = ET.SubElement(media, 'video')
    format_node = ET.SubElement(video_node, 'format')
    sample_characteristics = ET.SubElement(format_node, 'samplecharacteristics')
    ET.SubElement(sample_characteristics, 'width').text = "1920"
    ET.SubElement(sample_characteristics, 'height').text = "1080"
    
    video_track = ET.SubElement(video_node, 'track')
    
    # Audio Channels Tracks Setup
    audio_node = ET.SubElement(media, 'audio')
    audio_track_1 = ET.SubElement(audio_node, 'track')  # Left
    audio_track_2 = ET.SubElement(audio_node, 'track')  # Right
    
    timeline_cursor = 0
    clip_id_counter = 1
    
    total_clips = len(clips_data)
    
    for idx, clip in enumerate(clips_data):
        file_path = clip['path']
        filename = os.path.basename(file_path)
        file_url = path_to_url(file_path)
        
        # Source metadata in frames
        source_in = int(clip['in_sec'] * clip['source_fps'])
        source_out = int(clip['out_sec'] * clip['source_fps'])
        source_duration_frames = int(clip['total_duration'] * clip['source_fps'])
        
        # Timeline dimensions in sequence frames
        timeline_duration_frames = int(clip['timeline_duration_sec'] * sequence_fps)
        
        # Start and end positions on the timeline sequence
        start_pos = timeline_cursor
        end_pos = start_pos + timeline_duration_frames
        
        # Move timeline cursor forward sequentially
        timeline_cursor = end_pos
            
        clip_id = f"clip-{clip_id_counter}"
        file_id = f"file-{clip_id_counter}"
        clip_id_counter += 1
        
        # 1. Video Clip Item
        v_clip = ET.SubElement(video_track, 'clipitem', id=clip_id)
        ET.SubElement(v_clip, 'name').text = filename
        ET.SubElement(v_clip, 'duration').text = str(source_duration_frames)
        
        v_rate = ET.SubElement(v_clip, 'rate')
        ET.SubElement(v_rate, 'timebase').text = timebase_str
        ET.SubElement(v_rate, 'ntsc').text = "FALSE"
        
        ET.SubElement(v_clip, 'in').text = str(source_in)
        ET.SubElement(v_clip, 'out').text = str(source_out)
        ET.SubElement(v_clip, 'start').text = str(start_pos)
        ET.SubElement(v_clip, 'end').text = str(end_pos)
        
        # Shared source file link
        file_node = ET.SubElement(v_clip, 'file', id=file_id)
        ET.SubElement(file_node, 'name').text = filename
        ET.SubElement(file_node, 'pathurl').text = file_url
        f_rate = ET.SubElement(file_node, 'rate')
        ET.SubElement(f_rate, 'timebase').text = str(int(clip['source_fps']))
        ET.SubElement(f_rate, 'ntsc').text = "FALSE"
        ET.SubElement(file_node, 'duration').text = str(source_duration_frames)
        
        timecode_node = ET.SubElement(file_node, 'timecode')
        tc_rate_node = ET.SubElement(timecode_node, 'rate')
        ET.SubElement(tc_rate_node, 'timebase').text = str(int(clip['source_fps']))
        ET.SubElement(tc_rate_node, 'ntsc').text = "FALSE"
        ET.SubElement(timecode_node, 'string').text = "00:00:00:00"
        ET.SubElement(timecode_node, 'frame').text = "0"
        ET.SubElement(timecode_node, 'displayformat').text = "NDF"
        
        # Speed retiming for Rule 2 & 3 (slow-motion)
        if clip['rule'] in (2, 3):
            filter_node = ET.SubElement(v_clip, 'filter')
            effect_node = ET.SubElement(filter_node, 'effect')
            ET.SubElement(effect_node, 'effectid').text = "speed"
            ET.SubElement(effect_node, 'name').text = "Speed"
            ET.SubElement(effect_node, 'category').text = "Motion"
            param_node = ET.SubElement(effect_node, 'parameter')
            ET.SubElement(param_node, 'parameterid').text = "speed"
            ET.SubElement(param_node, 'name').text = "speed"
            ET.SubElement(param_node, 'value').text = str(int(CONFIG['speed_ratio'] * 100))
            
        # Audio Tracks for Rule 1 (linked sound)
        if clip['rule'] == 1:
            for track_idx, audio_track in enumerate([audio_track_1, audio_track_2]):
                a_clip = ET.SubElement(audio_track, 'clipitem', id=f"{clip_id}-a{track_idx+1}")
                ET.SubElement(a_clip, 'name').text = filename
                ET.SubElement(a_clip, 'duration').text = str(source_duration_frames)
                a_rate = ET.SubElement(a_clip, 'rate')
                ET.SubElement(a_rate, 'timebase').text = timebase_str
                ET.SubElement(a_rate, 'ntsc').text = "FALSE"
                ET.SubElement(a_clip, 'in').text = str(source_in)
                ET.SubElement(a_clip, 'out').text = str(source_out)
                ET.SubElement(a_clip, 'start').text = str(start_pos)
                ET.SubElement(a_clip, 'end').text = str(end_pos)
                
                # Link same file element
                file_link = ET.SubElement(a_clip, 'file', id=file_id)
                
                # Audio tracking indicators
                sourcetrack = ET.SubElement(a_clip, 'sourcetrack')
                ET.SubElement(sourcetrack, 'mediatype').text = "audio"
                ET.SubElement(sourcetrack, 'trackindex').text = str(track_idx + 1)
                
            # Links to bind audio and video together
            link_node = ET.SubElement(v_clip, 'link')
            
            link_v = ET.SubElement(link_node, 'linkitem')
            ET.SubElement(link_v, 'trackindex').text = "1"
            ET.SubElement(link_v, 'mediatype').text = "video"
            ET.SubElement(link_v, 'clipitemid').text = clip_id
            
            for t_idx in [1, 2]:
                link_a = ET.SubElement(link_node, 'linkitem')
                ET.SubElement(link_a, 'trackindex').text = str(t_idx)
                ET.SubElement(link_a, 'mediatype').text = "audio"
                ET.SubElement(link_a, 'clipitemid').text = f"{clip_id}-a{t_idx}"

        # No transitions are placed on the sequence timeline as per Sandeep's updated style
        pass

    sequence.find('duration').text = str(timeline_cursor)
    
    # Format and save XML
    xml_str = ET.tostring(xmeml, 'utf-8')
    reparsed = minidom.parseString(xml_str)
    pretty_xml = reparsed.toprettyxml(indent="  ")
    
    with open(output_xml_path, 'w', encoding='utf-8') as f:
        f.write(pretty_xml)
    print(f"[Success] Generated Master FCP7 XML timeline: {output_xml_path}")

def process_wedding_folder(media_folder, agents_md_path, output_xml_name="wedding_rough_cut.xml", force_rule=None):
    """
    Main orchestrator that scans the wedding footage folder, classifies each 
    clip based on its audio signature, extracts the best stabilized segment 
    for cinematic montage shots, and creates the master FCP7 XML timeline.
    """
    media_folder = media_folder.strip('"').strip("'")
    output_xml_name = output_xml_name.strip('"').strip("'")
    parse_agents_md(agents_md_path)
    
    # Valid video extensions
    video_exts = ('.mp4', '.mov', '.mkv', '.avi', '.m4v')
    
    # Scan media folder for files
    all_files = []
    for root, _, files in os.walk(media_folder):
        for f in files:
            if f.lower().endswith(video_exts):
                all_files.append(os.path.join(root, f))
                
    if not all_files:
        print(f"[Error] No video clips found in {media_folder}")
        sys.exit(1)
        
    # Sort files chronologically (by creation time) to preserve natural sequence
    all_files.sort(key=lambda x: os.path.getctime(x))
    print(f"[Info] Found {len(all_files)} video clips. Analyzing...")
    
    clips_data = []
    
    for f_idx, filepath in enumerate(all_files):
        filename = os.path.basename(filepath)
        print(f"\n[{f_idx+1}/{len(all_files)}] Processing: {filename}...")
        
        duration, fps, has_audio = get_video_metadata(filepath)
        if duration <= 0:
            print(f"  [Skipping] Video has 0 or invalid duration.")
            continue
            
        # 1. Classification (Rule 1 vs Rule 2)
        if force_rule is not None:
            rule = force_rule
            print(f"  [Classifier] Rule {rule} forced by command line.")
        else:
            rule = 3
            rms = 0.0
            
            # Check folder names or file tags first
            parent_name = os.path.basename(os.path.dirname(filepath)).lower()
            file_lower = filename.lower()
            
            if 'kirtan' in parent_name or 'dance' in parent_name or 'kirtan' in file_lower or 'dance' in file_lower:
                print("  [Classifier] Classified as Rule 1 (Dance) via Keyword Matching.")
                rule = 1
            elif has_audio:
                print("  [Classifier] Running Audio Signature Analysis...")
                rms, is_dance = extract_and_analyze_audio(filepath, CONFIG['audio_threshold_rms'])
                print(f"  [Classifier] Measured Audio RMS: {rms:.4f}")
                if is_dance:
                    print("  [Classifier] Classified as Rule 1 (Dance) via Audio Energy.")
                    rule = 1
                else:
                    print("  [Classifier] Classified as Rule 3 (Cinematic B-Roll) via Audio Energy.")
                    rule = 3
            else:
                print("  [Classifier] No audio track. Classified as Rule 3 (Cinematic B-Roll).")
                rule = 3
            
        # 2. Applying Cut Parameters and Motion Stability
        in_sec = 0.0
        out_sec = duration
        timeline_duration = duration
        
        if rule == 1:
            # Rule 1: Trim 2 seconds off start/end, keep speed standard (100% speed)
            in_sec = CONFIG['trim_start_sec']
            out_sec = max(in_sec, duration - CONFIG['trim_end_sec'])
            timeline_duration = out_sec - in_sec
            print(f"  [Rule 1] Full clip trimmed: In={in_sec:.2f}s, Out={out_sec:.2f}s (Duration={timeline_duration:.2f}s)")
        elif rule == 2:
            # Rule 2: Find best 4-second stabilized window using OpenCV
            target_dur = CONFIG['clip_duration_sec']
            speed_factor = CONFIG['speed_ratio']
            
            source_dur_needed = target_dur * speed_factor
            if duration > source_dur_needed:
                print("  [Rule 2] Running OpenCV camera shake analysis to find the most stable segment...")
                best_start_frame, best_end_frame = analyze_motion_stability(filepath, target_dur, fps)
                in_sec = best_start_frame / fps
                out_sec = best_end_frame / fps
            else:
                in_sec = 0.0
                out_sec = duration
                
            timeline_duration = target_dur
            print(f"  [Rule 2] Stabilized Cinematic window selected: In={in_sec:.2f}s, Out={out_sec:.2f}s")
            print(f"  [Rule 2] Retimed to play in {int(speed_factor*100)}% slow-motion on timeline for {timeline_duration:.2f}s")
        elif rule == 3:
            # Rule 3: Fast Cinematic Montage. Extract the exact mid-part systematically
            target_dur = CONFIG['clip_duration_sec']
            speed_factor = CONFIG['speed_ratio']
            
            source_dur_needed = target_dur * speed_factor
            if duration > source_dur_needed:
                mid = duration / 2.0
                in_sec = mid - (source_dur_needed / 2.0)
                out_sec = mid + (source_dur_needed / 2.0)
            else:
                in_sec = 0.0
                out_sec = duration
                
            timeline_duration = target_dur
            print(f"  [Rule 3] Midpoint window systematically selected: In={in_sec:.2f}s, Out={out_sec:.2f}s")
            print(f"  [Rule 3] Retimed to play in {int(speed_factor*100)}% slow-motion on timeline for {timeline_duration:.2f}s")
            
        clips_data.append({
            'path': filepath,
            'rule': rule,
            'in_sec': in_sec,
            'out_sec': out_sec,
            'total_duration': duration,
            'source_fps': fps,
            'timeline_duration_sec': timeline_duration
        })
        
    # Generate FCP7 XML Output
    output_xml_path = os.path.join(media_folder, output_xml_name)
    build_fcp7_xml(clips_data, output_xml_path, CONFIG['sequence_fps'])

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python assemble_wedding.py <path_to_wedding_folder> [output_xml_name] [--force-rule-1 | --force-rule-2 | --force-rule-3]")
        sys.exit(1)
        
    force_rule = None
    if "--force-rule-3" in sys.argv:
        force_rule = 3
        sys.argv.remove("--force-rule-3")
    elif "--force-rule-2" in sys.argv:
        force_rule = 2
        sys.argv.remove("--force-rule-2")
    elif "--force-rule-1" in sys.argv:
        force_rule = 1
        sys.argv.remove("--force-rule-1")
        
    folder = sys.argv[1].strip('"').strip("'")
    out_name = sys.argv[2].strip('"').strip("'") if len(sys.argv) > 2 else "wedding_rough_cut.xml"
    agents_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "AGENTS.md")
    
    process_wedding_folder(folder, agents_path, out_name, force_rule)

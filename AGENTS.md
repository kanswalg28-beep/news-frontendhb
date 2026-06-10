# Indian Wedding Editing Style Profile

This file defines the signature editing style and algorithm thresholds for Sandeep Bisht's wedding assembly automation. The python engine (`scripts/assemble_wedding.py`) reads this file to adjust the cutting formulas.

## Rule 1: Kirtan & Dance Footage
- **trim_start_sec**: 2.0 (Seconds to cut from the beginning of each clip)
- **trim_end_sec**: 2.0 (Seconds to cut from the end of each clip)
- **audio_enabled**: true (Keep the original sync audio)
- **cross_dissolve_sec**: 0.0 (No transitions - standard clean cuts only)

## Rule 2: Cinematic Montages (Haldi, Mehendi, Wedding)
- **clip_duration_sec**: 4.0 (Length of the final cut on the timeline)
- **speed_ratio**: 0.4 (40% slow motion speed. E.g. plays at 40% of standard speed)
- **audio_enabled**: false (Mute original clip audio, so you can overlay a background track)
- **cross_dissolve_sec**: 0.0 (No transitions - standard clean cuts only)

## Rule 3: Fast Cinematic Montages (Kangna, Preps, Quick Assembly)
- **clip_duration_sec**: 4.0 (Timeline length of the cut)
- **speed_ratio**: 0.4 (40% slow motion speed)
- **audio_enabled**: false (Mute original clip audio)
- **extraction_type**: "systematic midpoint" (Fast, zero-CPU extract of exact mid-portion of raw clip)

## Classification Thresholds
- **audio_threshold_rms**: 0.015 (RMS amplitude threshold. Clips with audio energy above this are classified as Rule 1/Dance. Clips below are classified as Rule 2/Cinematic B-Roll)
- **frequency_range**: "mid-high" (Tuned for dhol, vocals, and clapping)

## Timeline Settings
- **sequence_fps**: 50.0 (Target timeline framerate. Matches your 50fps shooting standard)
- **transition_type**: "None" (Strictly standard straight cuts)

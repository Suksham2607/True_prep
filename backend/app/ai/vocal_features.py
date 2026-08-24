"""
Milestone 5: turning a short practice-session recording into the vocal/
speech features listed in the roadmap - pitch stability, voice energy,
pause duration, speaking speed, and filler-word frequency.

Split into two halves on purpose:
  - The acoustic functions (pitch, energy, pauses) only need librosa/numpy
    and work on any audio - no network, no AI model, fully testable with
    synthetic audio.
  - The speech-content functions (speaking speed, filler words) need a
    transcript, which comes from Whisper (via faster-whisper) elsewhere.
    They're still plain functions here that just take a transcript in -
    testable with a fake transcript string, no model required.

`analyze_recording()` at the bottom is the only piece that actually needs
the Whisper model loaded, tying everything else together.
"""

import re

import librosa
import numpy as np

# --- Acoustic features (need only the raw audio) ---------------------------


def compute_pitch_stability(y, sr):
    """
    Extracts the fundamental frequency (pitch) over time with librosa's
    pyin algorithm, then scores how *stable* it is - a steady, controlled
    voice has less pitch wobble than a shaky or highly variable one.

    Returned as 0-100 (higher = more stable). None if no voiced pitch was
    detected at all (e.g. silence, or audio that's not really speech).
    """
    f0, voiced_flag, _ = librosa.pyin(
        y, sr=sr, fmin=librosa.note_to_hz("C2"), fmax=librosa.note_to_hz("C7")
    )
    voiced_f0 = f0[voiced_flag]
    if len(voiced_f0) < 5:
        return None

    mean_f0 = np.mean(voiced_f0)
    if mean_f0 == 0:
        return None

    # Coefficient of variation: std relative to the mean. Lower = steadier
    # pitch. Flipped and scaled into a 0-100 "stability" score, capped so
    # a wildly variable voice doesn't produce a negative number.
    coefficient_of_variation = np.std(voiced_f0) / mean_f0
    stability = max(0.0, 100.0 - coefficient_of_variation * 200.0)
    return min(100.0, stability)


def compute_voice_energy(y):
    """
    Average RMS (root-mean-square) loudness of the recording, scaled to a
    rough 0-100 "voice energy" score. The scaling constant here is a
    reasonable-for-normal-speech approximation, not a calibrated loudness
    standard - good enough for a relative, explainable indicator.
    """
    rms = librosa.feature.rms(y=y)[0]
    mean_rms = float(np.mean(rms))
    return min(100.0, mean_rms * 400.0)


def compute_pause_metrics(y, sr, top_db=30):
    """
    Splits the audio into non-silent chunks (librosa.effects.split) and
    treats the gaps between them as pauses. `top_db` controls how much
    quieter than the loudest part of the clip counts as "silence" - 30dB
    is a reasonable default for typical mic recordings.

    Returns pause count, total pause time, and the longest single pause,
    all in seconds.
    """
    intervals = librosa.effects.split(y, top_db=top_db)
    total_duration = len(y) / sr

    if len(intervals) <= 1:
        # Either continuous speech with no detected gaps, or no speech at
        # all - either way there's nothing meaningful to report as pauses.
        return {"pause_count": 0, "total_pause_seconds": 0.0, "longest_pause_seconds": 0.0}

    pause_durations = []
    for i in range(len(intervals) - 1):
        gap_start = intervals[i][1]
        gap_end = intervals[i + 1][0]
        pause_durations.append((gap_end - gap_start) / sr)

    return {
        "pause_count": len(pause_durations),
        "total_pause_seconds": round(float(sum(pause_durations)), 2),
        "longest_pause_seconds": round(float(max(pause_durations)), 2),
        "total_duration_seconds": round(float(total_duration), 2),
    }


# --- Speech-content features (need a transcript) ----------------------------

FILLER_WORDS = [
    "um", "umm", "uh", "uhh", "erm", "hmm",
    "like", "you know", "i mean", "sort of", "kind of", "basically", "actually",
]


def compute_speaking_speed(word_count, speaking_duration_seconds):
    """
    Words per minute, based on time actually spent speaking (total
    duration minus pauses) rather than the raw clip length - otherwise a
    recording with a long pause at the start would look artificially slow.
    Returns None if there's no usable duration to divide by.
    """
    if speaking_duration_seconds <= 0:
        return None
    return round(word_count / (speaking_duration_seconds / 60.0), 1)


def compute_filler_word_stats(transcript_text, total_words, duration_seconds):
    """
    Counts filler words/phrases in the transcript (case-insensitive, whole
    words only via regex boundaries so "like" doesn't match inside
    "likely"). Returns the raw count, the rate per minute, and the
    percentage of total words that were filler words.
    """
    text = transcript_text.lower()
    count = 0
    for filler in FILLER_WORDS:
        pattern = r"\b" + re.escape(filler) + r"\b"
        count += len(re.findall(pattern, text))

    rate_per_minute = None
    if duration_seconds > 0:
        rate_per_minute = round(count / (duration_seconds / 60.0), 1)

    percent_of_words = round((count / total_words) * 100, 1) if total_words else None

    return {
        "filler_word_count": count,
        "filler_word_rate_per_minute": rate_per_minute,
        "filler_word_percent": percent_of_words,
    }


# --- Orchestration (this is the piece that actually needs Whisper) --------


def transcribe_only(audio_path, whisper_model):
    """
    Milestone 8: just the transcript, skipping the acoustic feature
    extraction analyze_recording() also does - the mock interview only
    cares about what the candidate said, not how it sounded, so there's
    no reason to spend CPU on pitch/energy/pause analysis here.
    """
    segments, _info = whisper_model.transcribe(audio_path, beam_size=5)
    segments = list(segments)
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    return {"transcript": transcript}


def analyze_recording(audio_path, whisper_model):
    """
    Loads an audio file, runs Whisper for transcription, and combines
    that with the acoustic functions above into one results dict. This is
    the only function here that touches the AI model - everything it
    calls is independently tested with synthetic/fake inputs.
    """
    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    total_duration = len(y) / sr

    segments, _info = whisper_model.transcribe(audio_path, beam_size=5)
    segments = list(segments)
    transcript = " ".join(segment.text.strip() for segment in segments).strip()
    word_count = len(transcript.split()) if transcript else 0

    pause_metrics = compute_pause_metrics(y, sr)
    speaking_duration = total_duration - pause_metrics["total_pause_seconds"]

    pitch_stability = compute_pitch_stability(y, sr)

    return {
        "duration_seconds": round(total_duration, 2),
        "transcript": transcript,
        "word_count": word_count,
        "pitch_stability": round(pitch_stability, 1) if pitch_stability is not None else None,
        "voice_energy": round(compute_voice_energy(y), 1),
        "pause_count": pause_metrics["pause_count"],
        "total_pause_seconds": pause_metrics["total_pause_seconds"],
        "longest_pause_seconds": pause_metrics["longest_pause_seconds"],
        "speaking_speed_wpm": compute_speaking_speed(word_count, speaking_duration),
        **compute_filler_word_stats(transcript, word_count, total_duration),
    }


# --- Milestone 6: calibration (mean + spread across a longer recording) ----
#
# A single Voice Check gives you one number per feature - useful as a demo,
# but not enough to calibrate a personal baseline. A baseline needs to know
# your *typical* value AND how much you naturally vary, so later sessions
# can be judged against your own normal range instead of a generic one.
#
# The approach: take one longer recording (calibration asks for ~60s),
# slice it into fixed-length windows, run the same per-window analysis on
# each slice independently, then report the mean and standard deviation
# across those windows for each feature.


def _mean_std(values):
    """
    Small local mean/std helper so this module doesn't need scipy.stats
    for something this simple. Ignores None entries (a window with no
    detectable pitch, for instance) rather than letting them break the
    average. Returns (None, None) if nothing usable is left, and (value,
    0.0) for a single sample - just enough for the code that expects a
    (mean, std) pair, without pretending a single point has some other
    meaningful "spread".

    Uses population standard deviation (ddof=0): these windows are the
    complete calibration recording, not a sample drawn from a larger one,
    so there's no correction to make.
    """
    clean = [v for v in values if v is not None]
    if not clean:
        return None, None
    if len(clean) == 1:
        return round(float(clean[0]), 2), 0.0
    arr = np.array(clean, dtype=float)
    return round(float(np.mean(arr)), 2), round(float(np.std(arr)), 2)


def analyze_recording_windows(audio_path, whisper_model, window_seconds=10.0, min_windows=3):
    """
    Splits one longer recording into non-overlapping `window_seconds`
    windows, analyzes each independently (its own transcript, its own
    pitch/energy/pause/filler numbers), and returns the mean + standard
    deviation across windows for each feature - the shape the baseline
    profile (Milestone 2's `/api/baseline/`) actually stores.

    Trailing audio shorter than a full window is dropped rather than
    padded or force-analyzed, since a partial window would skew that
    feature's numbers for no good reason. Raises ValueError if fewer than
    `min_windows` full windows are available - calibration needs several
    independent samples to describe a *spread*, not just a single clip
    split arbitrarily in two.
    """
    y, sr = librosa.load(audio_path, sr=16000, mono=True)
    total_duration = len(y) / sr
    window_samples = int(window_seconds * sr)

    chunks = []
    start = 0
    while start + window_samples <= len(y):
        chunks.append(y[start:start + window_samples])
        start += window_samples

    if len(chunks) < min_windows:
        needed_seconds = int(window_seconds * min_windows)
        raise ValueError(
            f"That recording is too short for calibration - need at least "
            f"~{needed_seconds}s of continuous speech, got {total_duration:.0f}s. "
            "Please record again and keep talking for the full duration."
        )

    pitch_values, energy_values, speed_values = [], [], []
    pause_duration_values, filler_rate_values = [], []
    transcripts = []

    for chunk in chunks:
        segments, _info = whisper_model.transcribe(chunk, beam_size=5)
        segments = list(segments)
        transcript = " ".join(segment.text.strip() for segment in segments).strip()
        word_count = len(transcript.split()) if transcript else 0
        if transcript:
            transcripts.append(transcript)

        pause_metrics = compute_pause_metrics(chunk, sr)
        speaking_duration = window_seconds - pause_metrics["total_pause_seconds"]

        pitch_values.append(compute_pitch_stability(chunk, sr))
        energy_values.append(compute_voice_energy(chunk))
        speed_values.append(compute_speaking_speed(word_count, speaking_duration))

        # Mean pause *length* within this window (not the count, not the
        # total) - "pause_duration" reads as "how long is a typical pause
        # for this person", which is the number a later milestone can use
        # to flag one unusually long pause against.
        if pause_metrics["pause_count"] > 0:
            pause_duration_values.append(
                pause_metrics["total_pause_seconds"] / pause_metrics["pause_count"]
            )
        else:
            pause_duration_values.append(0.0)

        filler_stats = compute_filler_word_stats(transcript, word_count, window_seconds)
        filler_rate_values.append(filler_stats["filler_word_rate_per_minute"])

    pitch_mean, pitch_std = _mean_std(pitch_values)
    energy_mean, energy_std = _mean_std(energy_values)
    speed_mean, speed_std = _mean_std(speed_values)
    pause_mean, pause_std = _mean_std(pause_duration_values)
    filler_mean, filler_std = _mean_std(filler_rate_values)

    return {
        "window_count": len(chunks),
        "window_seconds": window_seconds,
        "total_duration_seconds": round(total_duration, 2),
        "transcript": " ".join(transcripts).strip(),
        "pitch_stability_mean": pitch_mean,
        "pitch_stability_std": pitch_std,
        "voice_energy_mean": energy_mean,
        "voice_energy_std": energy_std,
        "speaking_speed_mean": speed_mean,
        "speaking_speed_std": speed_std,
        "pause_duration_mean": pause_mean,
        "pause_duration_std": pause_std,
        "filler_word_rate_mean": filler_mean,
        "filler_word_rate_std": filler_std,
    }

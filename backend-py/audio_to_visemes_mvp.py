import faster_whisper
import json
import argparse
import logging
import tempfile
import os
import subprocess
from pathlib import Path
import soundfile as sf
import numpy as np
from phonemizer import phonemize
from phonemizer.backend import EspeakBackend
from phonemizer.separator import Separator
import traceback
import sys

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Update viseme mapping to include all espeak-ng phonemes
VISEME_MAP = {
    # Vowels
    'a': 'B',  # Neutral position
    'e': 'C',  # Open mouth
    'i': 'C',  # Wide mouth
    'o': 'B',  # Round mouth
    'u': 'B',  # Round mouth
    'ɛ': 'C',  # Open-mid front unrounded
    'ɔ': 'B',  # Open-mid back rounded
    'ə': 'B',  # Schwa (neutral)
    'ɪ': 'C',  # Near-close front unrounded
    'ʊ': 'B',  # Near-close back rounded
    'æ': 'C',  # Near-open front unrounded
    'ɑ': 'B',  # Open back unrounded
    'ɒ': 'B',  # Open back rounded
    'ʌ': 'B',  # Open-mid back unrounded
    'ɜ': 'C',  # Open-mid central unrounded
    'ɐ': 'B',  # Near-open central
    
    # Consonants - Plosives
    'p': 'F',  # Closed lips
    'b': 'F',  # Closed lips
    't': 'G',  # Tongue touching teeth
    'd': 'G',  # Tongue touching teeth
    'k': 'C',  # Back of tongue raised
    'g': 'C',  # Back of tongue raised
    'ʔ': 'C',  # Glottal stop
    
    # Consonants - Nasals
    'm': 'F',  # Closed lips
    'n': 'G',  # Tongue touching teeth
    'ŋ': 'C',  # Velar nasal
    'ɲ': 'G',  # Palatal nasal
    'ɱ': 'F',  # Labiodental nasal
    
    # Consonants - Fricatives
    'f': 'A',  # Lower lip touching upper teeth
    'v': 'A',  # Lower lip touching upper teeth
    'θ': 'G',  # Dental fricative
    'ð': 'G',  # Dental fricative
    's': 'G',  # Teeth slightly apart
    'z': 'G',  # Teeth slightly apart
    'ʃ': 'G',  # Rounded lips
    'ʒ': 'G',  # Rounded lips
    'x': 'C',  # Back of tongue raised
    'ɣ': 'C',  # Velar fricative
    'h': 'C',  # Glottal fricative
    'ɦ': 'C',  # Voiced glottal fricative
    'β': 'F',  # Bilabial fricative
    'ʋ': 'A',  # Labiodental approximant
    'ç': 'C',  # Palatal fricative
    'ʝ': 'C',  # Palatal fricative
    
    # Consonants - Approximants
    'ɹ': 'B',  # Alveolar approximant
    'j': 'C',  # Palatal approximant
    'w': 'B',  # Rounded lips
    'ɰ': 'C',  # Velar approximant
    'l': 'G',  # Tongue touching teeth
    'ʎ': 'G',  # Palatal lateral
    'ʟ': 'C',  # Velar lateral
    
    # Consonants - Taps and Trills
    'ɾ': 'B',  # Tap or flap
    'r': 'B',  # Trill
    'ʀ': 'B',  # Uvular trill
    'ɽ': 'B',  # Retroflex flap
    
    # Silence and special markers
    '_': 'X',  # Silence
    ' ': 'X',  # Space
    '': 'X',   # Empty
}

# Natural transitions between visemes
NATURAL_TRANSITIONS = {
    'B': {'C': True, 'F': True, 'G': True},
    'C': {'B': True, 'A': True},
    'F': {'B': True},
    'G': {'B': True, 'C': True},
    'A': {'B': True, 'C': True},
    'X': {'B': True, 'F': True}
}

def get_audio_duration(audio_path):
    """Get the duration of an audio file in seconds."""
    data, samplerate = sf.read(audio_path)
    return len(data) / samplerate

def extract_base_phoneme(phoneme):
    """Extract base phoneme by removing any markers."""
    return phoneme.split('_')[0] if phoneme and '_' in phoneme else phoneme

def is_silence_marker(phoneme):
    """Check if a phoneme represents silence."""
    silence_markers = ['_', ' ', '']
    return phoneme in silence_markers

def clean_phoneme(phoneme):
    """Clean a phoneme by removing punctuation and normalizing."""
    # Remove punctuation and whitespace
    cleaned = ''.join(c for c in phoneme if c.isalnum() or c in 'əɛɔɪʊæɑɒʌɜɐŋɲɱθðʃʒɣɦβʋçʝɹɰʎʟʀɽ')
    # Return '_' for empty or invalid phonemes
    return cleaned if cleaned else '_'

def map_phoneme_to_viseme(phoneme):
    """Map a phoneme to its corresponding viseme with error handling."""
    cleaned = clean_phoneme(phoneme)
    return VISEME_MAP.get(cleaned, 'B')  # Default to neutral position if unknown

def get_transition_viseme(from_viseme, to_viseme):
    """Get a natural transition viseme between two visemes."""
    if from_viseme == to_viseme:
        return None
    if from_viseme in NATURAL_TRANSITIONS and to_viseme in NATURAL_TRANSITIONS[from_viseme]:
        return None
    return 'B'  # Use neutral position as default transition

def estimate_phoneme_durations(phonemes, word_timing, total_duration):
    """Estimate phoneme durations based on word timing and phoneme characteristics."""
    if not phonemes:
        return []
    
    # Base duration factors
    duration_factors = {
        'vowel': 1.2,      # Vowels are longer
        'plosive': 0.6,    # Plosives are shorter
        'fricative': 0.8,  # Fricatives are medium
        'silence': 0.4     # Silences are shorter
    }
    
    # Minimum and maximum durations
    MIN_DURATION = 0.07  # 70ms minimum
    MAX_DURATION = 0.25  # 250ms maximum
    TRANSITION_DURATION = 0.03  # 30ms for transitions
    
    # Calculate initial durations
    durations = []
    total_factor = 0
    
    for phoneme in phonemes:
        cleaned = clean_phoneme(phoneme)
        if cleaned == '_':
            factor = duration_factors['silence']
        elif cleaned in 'aeiouɛɔəɪʊæɑɒʌɜɐ':
            factor = duration_factors['vowel']
        elif cleaned in 'ptkbdgʔ':
            factor = duration_factors['plosive']
        elif cleaned in 'fvθðszʃʒxɣhɦβʋçʝ':
            factor = duration_factors['fricative']
        else:
            factor = 1.0
        total_factor += factor
        durations.append(factor)
    
    # Scale durations to match word timing
    scale = word_timing / total_factor
    durations = [d * scale for d in durations]
    
    # Apply minimum and maximum constraints
    for i in range(len(durations)):
        if durations[i] < MIN_DURATION:
            durations[i] = MIN_DURATION
        elif durations[i] > MAX_DURATION:
            durations[i] = MAX_DURATION
    
    # Generate timeline with transitions
    timeline = []
    current_time = 0
    prev_viseme = None
    
    for i, (phoneme, duration) in enumerate(zip(phonemes, durations)):
        viseme = map_phoneme_to_viseme(phoneme)
        
        if prev_viseme and prev_viseme != viseme:
            transition = get_transition_viseme(prev_viseme, viseme)
            if transition:
                timeline.append((current_time, current_time + TRANSITION_DURATION, transition))
                current_time += TRANSITION_DURATION
                duration -= TRANSITION_DURATION / 2
        
        timeline.append((current_time, current_time + duration, viseme))
        current_time += duration
        prev_viseme = viseme
    
    # Scale to match total duration if needed
    if current_time > 0:
        scale_factor = total_duration / current_time
        timeline = [(start * scale_factor, end * scale_factor, v) for start, end, v in timeline]
    
    return timeline

def process_audio(audio_path, output_json_path, whisper_model_name='base'):
    """
    Process an audio file to generate viseme lip sync data.
    
    Args:
        audio_path: Path to the audio file
        output_json_path: Path to save the output JSON
        whisper_model_name: Whisper model size to use
    """
    audio_path = Path(audio_path).resolve()
    output_json_path = Path(output_json_path).resolve()
    
    if not audio_path.exists():
        logging.error(f"Audio file not found: {audio_path}")
        return False
    
    # Make sure output directory exists
    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        # Step 1: Get audio duration
        logging.info(f"Getting audio duration for {audio_path}")
        total_duration = get_audio_duration(audio_path)
        logging.info(f"Audio duration: {total_duration:.2f} seconds")
        
        # Step 2: Transcribe audio using Whisper
        logging.info(f"Loading Whisper model: {whisper_model_name}")
        model = faster_whisper.WhisperModel(whisper_model_name, device="cpu")
        
        logging.info("Transcribing audio...")
        segments, info = model.transcribe(str(audio_path), beam_size=5)
        
        # Step 3: Process each segment
        all_phonemes = []
        
        for segment in segments:
            # Get phonemes using phonemizer
            phonemes = phonemize(
                segment.text,
                language='es',
                backend='espeak',
                separator=Separator(phone=' ', word=' _ '),  # Use _ as word separator
                strip=True,
                preserve_punctuation=True,
                with_stress=False
            )
            
            # Split into individual phonemes
            phoneme_list = phonemes.split()
            
            # Get segment duration and estimate phoneme timings
            segment_duration = segment.end - segment.start
            segment_phonemes = estimate_phoneme_durations(phoneme_list, segment_duration, segment_duration)
            
            # Adjust timings to account for segment start time
            adjusted_phonemes = [
                (start + segment.start, end + segment.start, p)
                for start, end, p in segment_phonemes
            ]
            
            all_phonemes.extend(adjusted_phonemes)
        
        logging.info(f"Extracted {len(all_phonemes)} phoneme timings.")
        
        # Step 4: Optimize timeline (combine very short consecutive identical visemes)
        logging.info("Optimizing timeline...")
        optimized_phonemes = []
        min_duration = 0.05  # Minimum duration threshold
        
        if all_phonemes:
            current_start, current_end, current_viseme = all_phonemes[0]
            for i in range(1, len(all_phonemes)):
                next_start, next_end, next_viseme = all_phonemes[i]
                
                # Check if we should merge
                duration = current_end - current_start
                if (next_viseme == current_viseme and 
                    abs(next_start - current_end) < 0.01 and 
                    duration < min_duration):
                    current_end = next_end  # Merge
                else:
                    if duration >= min_duration:
                        optimized_phonemes.append((current_start, current_end, current_viseme))
                    current_start, current_end, current_viseme = next_start, next_end, next_viseme
            
            # Add the last phoneme
            if current_end - current_start >= min_duration:
                optimized_phonemes.append((current_start, current_end, current_viseme))
        
        logging.info(f"Optimized timeline to {len(optimized_phonemes)} phoneme cues.")
        
        # Step 5: Prepare JSON output
        output_data = {
            "metadata": {
                "soundFile": str(audio_path),
                "duration": round(total_duration, 4)
            },
            "mouthCues": []
        }
        
        # Add initial silence if needed
        if optimized_phonemes and optimized_phonemes[0][0] > 0:
            output_data["mouthCues"].append({
                "start": 0.0,
                "end": round(optimized_phonemes[0][0], 4),
                "value": "X"
            })
        
        # Add all phoneme cues
        for start, end, viseme in optimized_phonemes:
            output_data["mouthCues"].append({
                "start": round(start, 4),
                "end": round(end, 4),
                "value": viseme
            })
        
        # Add final silence if needed
        if optimized_phonemes:
            last_end_time = optimized_phonemes[-1][1]
            if last_end_time < total_duration:
                output_data["mouthCues"].append({
                    "start": round(last_end_time, 4),
                    "end": round(total_duration, 4),
                    "value": "X"
                })
        elif total_duration > 0:  # Handle empty alignment but existing audio
            output_data["mouthCues"].append({
                "start": 0.0,
                "end": round(total_duration, 4),
                "value": "X"
            })
        
        # Step 6: Write JSON output
        logging.info(f"Writing JSON output to {output_json_path}...")
        with open(output_json_path, 'w') as f:
            json.dump(output_data, f, indent=2)
        
        logging.info("Processing finished successfully.")
        return True
        
    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        traceback.print_exc()
        sys.exit(1)

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Convert speech audio to viseme lip sync data.')
    parser.add_argument('audio_path', help='Path to the audio file')
    parser.add_argument('output_path', help='Path to save the output JSON file')
    parser.add_argument('--whisper-model', default='base', choices=['tiny', 'base', 'small', 'medium', 'large'],
                        help='Whisper model size to use')
    
    args = parser.parse_args()
    
    success = process_audio(
        args.audio_path,
        args.output_path,
        whisper_model_name=args.whisper_model
    )
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())

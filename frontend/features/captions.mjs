import { IDLE_SHAPE_ID } from './state.mjs';

// How much earlier than the audio a word shows up, in seconds.
// Matches the lookahead used by the mouth animation so text and lips agree.
const CAPTION_LEAD = 0.15;

// Silences shorter than this are considered part of the surrounding speech,
// otherwise every stop consonant would split the transcript into fragments.
const MIN_SILENCE = 0.15;

let schedule = [];
let revealedCount = 0;
let captionElement = null;

/**
 * Groups the Rhubarb mouth cues into the spans where the voice is actually
 * talking. Returns [{ start, end }] ordered by time.
 */
function getSpeechSegments(mouthCues, duration) {
    const voiced = (mouthCues || []).filter(
        (cue) => cue.value !== IDLE_SHAPE_ID && cue.end > cue.start
    );

    if (voiced.length === 0) {
        return Number.isFinite(duration) && duration > 0 ? [{ start: 0, end: duration }] : [];
    }

    const segments = [{ start: voiced[0].start, end: voiced[0].end }];

    for (const cue of voiced.slice(1)) {
        const last = segments[segments.length - 1];
        if (cue.start - last.end <= MIN_SILENCE) {
            last.end = cue.end;
        } else {
            segments.push({ start: cue.start, end: cue.end });
        }
    }

    return segments;
}

/**
 * Splits the text into tokens carrying their leading whitespace, so appending
 * them one by one rebuilds the original string.
 */
function tokenize(text) {
    const matches = text.match(/\s*\S+/g);
    return matches || [];
}

/**
 * Spreads the words over the speech segments proportionally to their length,
 * so each word is revealed around the moment the voice pronounces it.
 */
export function buildCaptionSchedule(text, mouthCues, duration) {
    const tokens = tokenize(text);
    if (tokens.length === 0) return [];

    const segments = getSpeechSegments(mouthCues, duration);
    if (segments.length === 0) return tokens.map((token) => ({ token, time: 0 }));

    const speechDuration = segments.reduce((total, seg) => total + (seg.end - seg.start), 0);
    const totalWeight = tokens.reduce((total, token) => total + token.trim().length, 0) || 1;

    const timed = [];
    let tokenIndex = 0;
    let consumedWeight = 0;

    segments.forEach((segment, index) => {
        const segmentDuration = segment.end - segment.start;
        const isLast = index === segments.length - 1;
        // Weight this segment deserves, based on how much of the voice it holds.
        const segmentShare = (segmentDuration / speechDuration) * totalWeight;
        const targetWeight = isLast ? totalWeight : consumedWeight + segmentShare;

        let segmentWeight = 0;
        const segmentTokens = [];

        while (
            tokenIndex < tokens.length &&
            (isLast || consumedWeight + segmentWeight < targetWeight || segmentTokens.length === 0)
        ) {
            const token = tokens[tokenIndex++];
            segmentTokens.push({ token, weight: token.trim().length || 1 });
            segmentWeight += segmentTokens[segmentTokens.length - 1].weight;
        }

        let cursor = 0;
        for (const { token, weight } of segmentTokens) {
            timed.push({
                token,
                time: segment.start + (cursor / (segmentWeight || 1)) * segmentDuration,
            });
            cursor += weight;
        }

        consumedWeight += segmentWeight;
    });

    // Anything left over (rounding, empty segments) rides on the last segment.
    const lastSegment = segments[segments.length - 1];
    while (tokenIndex < tokens.length) {
        timed.push({ token: tokens[tokenIndex++], time: lastSegment.end });
    }

    return timed;
}

export function startCaptions(element, captionSchedule) {
    captionElement = element;
    schedule = captionSchedule;
    revealedCount = 0;
    if (captionElement) captionElement.textContent = "";
}

export function updateCaptions(currentTime) {
    if (!captionElement || revealedCount >= schedule.length) return;

    const cutoff = currentTime + CAPTION_LEAD;
    let text = "";

    while (revealedCount < schedule.length && schedule[revealedCount].time <= cutoff) {
        text += schedule[revealedCount].token;
        revealedCount++;
    }

    if (text) captionElement.textContent += text;
}

/** Reveals whatever is left, e.g. when playback ends or is interrupted. */
export function flushCaptions() {
    if (!captionElement || revealedCount >= schedule.length) return;

    let text = "";
    while (revealedCount < schedule.length) {
        text += schedule[revealedCount++].token;
    }
    captionElement.textContent += text;
}

export function resetCaptions() {
    schedule = [];
    revealedCount = 0;
    captionElement = null;
}

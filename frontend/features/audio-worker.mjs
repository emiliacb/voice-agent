import { Buffer } from 'buffer';
import { getRecordType } from '../utils/get-record-type.mjs';

self.onmessage = async function(e) {
    const { type, data } = e.data;

    switch (type) {
        case 'SEND_AUDIO':
            await sendAudioToServer(data);
            break;
    }
};

function parseSSEEvent(block) {
    const lines = block.split('\n');
    let event = null;
    let data = null;
    for (const line of lines) {
        if (line.startsWith('event: ')) event = line.slice(7);
        if (line.startsWith('data: ')) data = line.slice(6);
    }
    if (event && data) {
        try {
            return { event, data: JSON.parse(data) };
        } catch (e) {
            // Skip malformed events
        }
    }
    return null;
}

async function sendAudioToServer({audioChunks, backendUrl, currentLanguage, chatHistory}) {
    try {
        if (!audioChunks || audioChunks.length === 0) {
            self.postMessage({ type: 'ERROR', error: { message: 'No audio data received' } });
            return;
        }

        const audioBlob = new Blob(audioChunks, { type: getRecordType() });
        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("chatHistory", JSON.stringify(chatHistory || []));

        const response = await fetch(`${backendUrl}/message?lang=${currentLanguage}`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events (separated by double newline)
            const parts = buffer.split('\n\n');
            buffer = parts.pop(); // Keep incomplete last part in buffer

            for (const part of parts) {
                if (!part.trim()) continue;
                const parsed = parseSSEEvent(part);
                if (!parsed) continue;
                const { event, data } = parsed;
                switch (event) {
                    case 'transcription':
                        self.postMessage({ type: 'TRANSCRIPTION', data: { text: data.text } });
                        break;
                    case 'text-delta':
                        self.postMessage({ type: 'TEXT_DELTA', data: { delta: data.delta } });
                        break;
                    case 'audio':
                        {
                            const audioBuffer = Buffer.from(data.audio, 'base64');
                            const responseAudioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
                            self.postMessage({
                                type: 'AUDIO_PROCESSED',
                                data: { mouthCues: data.mouthCues, responseAudioBlob }
                            });
                        }
                        break;
                    case 'error':
                        self.postMessage({ type: 'ERROR', error: { message: data.details || data.error } });
                        break;
                    case 'done':
                        self.postMessage({ type: 'DONE' });
                        break;
                }
            }
        }
    } catch (error) {
        console.error("Error processing audio:", error);
        self.postMessage({ type: 'ERROR', error: error });
    }
}

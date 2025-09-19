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

async function sendAudioToServer({audioChunks, backendUrl, currentLanguage}) {
    try {
        // Check if audioChunks is empty or too short
        if (!audioChunks || audioChunks.length === 0) {
            self.postMessage({
                type: 'ERROR',
                error: { message: 'No audio data received' }
            });
            return;
        }

        let audioBlob = new Blob(audioChunks, {
            type: getRecordType(),
        });

        const formData = new FormData();
        formData.append("audio", audioBlob);

        // Use fetch with streaming for Server-Sent Events
        const response = await fetch(`${backendUrl}/message?lang=${currentLanguage}`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        let accumulatedText = "";
        let audioChunksArray = [];
        let allMouthCues = []; // Will be set from the complete signal

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            
                            switch (data.type) {
                                case 'text':
                                    accumulatedText += data.content;
                                    self.postMessage({
                                        type: 'TEXT_CHUNK',
                                        data: {
                                            text: data.content,
                                            fullText: accumulatedText
                                        }
                                    });
                                    break;
                                    
                                case 'audio':
                                    const audioBuffer = Buffer.from(data.audio, 'base64');
                                    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
                                    
                                    audioChunksArray.push(audioBlob);
                                    // Don't accumulate mouth cues here - they'll come in the complete signal
                                    
                                    self.postMessage({
                                        type: 'AUDIO_CHUNK',
                                        data: {
                                            audioBlob,
                                            mouthCues: data.mouthCues
                                        }
                                    });
                                    break;
                                    
                                case 'complete':
                                    // Combine all audio chunks
                                    const finalAudioBlob = new Blob(audioChunksArray, { type: 'audio/wav' });
                                    
                                    self.postMessage({
                                        type: 'AUDIO_PROCESSED',
                                        data: {
                                            mouthCues: data.allMouthCues || [],
                                            responseAudioBlob: finalAudioBlob,
                                            fullText: accumulatedText
                                        }
                                    });
                                    return;
                                    
                                case 'error':
                                    throw new Error(data.error);
                            }
                        } catch (parseError) {
                            console.error("Error parsing SSE data:", parseError);
                            self.postMessage({
                                type: 'ERROR',
                                error: parseError
                            });
                            return;
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }

    } catch (error) {
        console.error("Error processing audio:", error);
        self.postMessage({
            type: 'ERROR',
            error: error
        });
    }
}

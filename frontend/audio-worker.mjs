import { Buffer } from 'buffer';

self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'SEND_AUDIO':
            await sendAudioToServer(data.audioChunks, data.backendUrl);
            break;
    }
};

async function sendAudioToServer(audioChunks, backendUrl) {
    try {
        // Check if audioChunks is empty or too short
        if (!audioChunks || audioChunks.length === 0) {
            self.postMessage({
                type: 'ERROR',
                error: 'No audio data received'
            });
            return;
        }
        
        const audioBlob = new Blob(audioChunks, {
            type: "audio/webm;codecs=opus",
        });
        
        // Check if audio duration is too short (less than 500ms)
        if (audioBlob.size < 1000) {
            self.postMessage({
                type: 'ERROR',
                error: 'Audio recording too short'
            });
            return;
        }

        const formData = new FormData();
        formData.append("audio", audioBlob);

        const response = await fetch(`${backendUrl}/message`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        const responseData = await response.json();
        
        const audioPart = responseData.audio;
        const mouthCues = responseData.mouthCues;
        
        const audioBuffer = Buffer.from(audioPart, 'base64');
        const responseAudioBlob = new Blob([audioBuffer], { type: 'audio/wav' });

        self.postMessage({
            type: 'AUDIO_PROCESSED',
            data: {
                mouthCues,
                responseAudioBlob
            }
        });

    } catch (error) {
        console.error("Error processing audio:", error);
        self.postMessage({
            type: 'ERROR',
            error: error.message
        });
    }
} 
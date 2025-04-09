import { Buffer } from 'buffer';

self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    switch (type) {
        case 'SEND_AUDIO':
            await sendAudioToServer(data.audioChunks, data.backendUrl);
            break;
    }
};

const getRecordType = () => {
    if (typeof MediaRecorder === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        return 'audio/webm;codecs=opus';
    }
    return 'audio/mp4';
}

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

        let audioBlob = new Blob(audioChunks, {
            type: getRecordType(),
        });

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
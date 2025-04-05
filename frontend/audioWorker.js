// Config
const AUDIO_BIT_RATE = 16000;
const MOUTH_CUE_MIN_DURATION = 0.04;

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
        // Create audio blob from chunks
        const audioBlob = new Blob(audioChunks, {
            type: "audio/webm;codecs=opus",
        });

        const formData = new FormData();
        formData.append("audio", audioBlob);

        const response = await fetch(`${backendUrl}/rhubarb`, {
            method: "POST",
            body: formData,
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }

        const result = await response.json();
        const mouthCues = result.mouthCues.filter(cue => cue.end - cue.start > MOUTH_CUE_MIN_DURATION);
        
        self.postMessage({
            type: 'AUDIO_PROCESSED',
            data: {
                mouthCues,
                audioBlob
            }
        });

    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            error: error.message
        });
    }
} 
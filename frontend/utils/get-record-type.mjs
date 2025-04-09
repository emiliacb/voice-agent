export function getRecordType() {
    if (typeof MediaRecorder === 'function' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        return 'audio/webm;codecs=opus';
    }
    return 'audio/mp4';
}

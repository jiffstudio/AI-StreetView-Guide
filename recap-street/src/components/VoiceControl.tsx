import { useState, useRef, useEffect } from 'react';
import styles from './VoiceControl.module.scss';

interface VoiceControlProps {
  onVoiceInput: (audioBlob: Blob) => void;
  isListening: boolean;
  onToggleListening: () => void;
}

export default function VoiceControl({ 
  onVoiceInput, 
  isListening, 
  onToggleListening 
}: VoiceControlProps) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isListening && !isRecording) {
      startRecording();
    } else if (!isListening && isRecording) {
      stopRecording();
    }
  }, [isListening, isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        onVoiceInput(audioBlob);
        
        // 停止所有音频轨道
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className={styles.voiceControl}>
      <button
        className={`${styles.voiceButton} ${isListening ? styles.listening : ''}`}
        onClick={onToggleListening}
        title={isListening ? "停止语音输入" : "开始语音输入"}
      >
        {isListening ? (
          <div className={styles.listeningIndicator}>
            <div className={styles.pulse}></div>
            🎤
          </div>
        ) : (
          '🎤'
        )}
      </button>
      
      {isListening && (
        <div className={styles.listeningStatus}>
          <span>正在听取语音指令...</span>
        </div>
      )}
    </div>
  );
}
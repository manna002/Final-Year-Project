import { useState } from 'react';
import { BrainCircuit, MessageSquare, Database, Sparkles, RefreshCw } from 'lucide-react';
import styles from './AIAssistantPanel.module.css';

export default function AIAssistantPanel({ kitId }) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'train'
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your AI Agronomist. I have analyzed your greenhouse data. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [trainingStatus, setTrainingStatus] = useState('idle'); // idle, extracting, vectorizing, done
  const [progress, setProgress] = useState(0);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Add user message
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Simulate AI thinking and replying based on RAG context
    setTimeout(() => {
      let reply = "Based on the recent soil reports, your greenhouse is maintaining healthy moisture levels, but the Nitrogen (N) is slightly low at 14.5 mg/kg. Consider a nitrogen-rich nutrient mix in the next irrigation cycle.";
      
      if (input.toLowerCase().includes('water') || input.toLowerCase().includes('irrigation')) {
        reply = "Looking at the last 7 days of logs, you have used an average of 45 Liters per day. The tank state is currently FULL, so you have plenty of reserves for the upcoming dry afternoon.";
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }, 1500);
  };

  const startTraining = () => {
    setTrainingStatus('extracting');
    setProgress(10);
    
    setTimeout(() => {
      setTrainingStatus('vectorizing');
      setProgress(50);
      
      setTimeout(() => {
        setTrainingStatus('done');
        setProgress(100);
      }, 2500);
    }, 2000);
  };

  return (
    <div className={styles.container}>
      {/* Header Tabs */}
      <div className={styles.tabHeader}>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.active : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={18} />
          AI Chatbot
        </button>
        <button 
          className={`${styles.tabBtn} ${activeTab === 'train' ? styles.active : ''}`}
          onClick={() => setActiveTab('train')}
        >
          <Database size={18} />
          Model Training (RAG)
        </button>
      </div>

      {/* Chatbot View */}
      {activeTab === 'chat' && (
        <div className={styles.chatArea}>
          <div className={styles.messagesBox}>
            {messages.map((msg, i) => (
              <div key={i} className={`${styles.messageWrapper} ${msg.role === 'user' ? styles.userWrap : styles.botWrap}`}>
                <div className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.botMsg}`}>
                  {msg.role === 'assistant' && <BrainCircuit size={16} className={styles.botIcon} />}
                  <span>{msg.content}</span>
                </div>
              </div>
            ))}
          </div>
          <form className={styles.inputArea} onSubmit={handleSend}>
            <input 
              type="text" 
              placeholder="Ask about crop health, NPK levels, or water usage..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={styles.textInput}
            />
            <button type="submit" className={styles.sendBtn} disabled={!input.trim()}>
              <Sparkles size={18} />
              Ask AI
            </button>
          </form>
        </div>
      )}

      {/* Model Training View */}
      {activeTab === 'train' && (
        <div className={styles.trainArea}>
          <div className={styles.trainCard}>
            <h3>Knowledge Base Sync</h3>
            <p>
              To ensure the AI Chatbot provides highly accurate Precision Agriculture advice, 
              it must be trained on your specific greenhouse data. Click below to extract historical 
              sensor logs (Temp, Humidity, NPK, Water Usage) from the MongoDB database and vectorize 
              them into the AI's memory.
            </p>
            
            <div className={styles.statusBox}>
              <div className={styles.statusRow}>
                <span>Current Model Status:</span>
                <span className={styles.badge}>
                  {trainingStatus === 'idle' ? 'Out of Sync' : trainingStatus === 'done' ? 'Optimized' : 'Training...'}
                </span>
              </div>
              
              {trainingStatus !== 'idle' && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressBar} style={{ width: `${progress}%` }}></div>
                </div>
              )}
              
              {trainingStatus === 'extracting' && <p className={styles.logText}>[1/2] Extracting 42 SensorLog documents from MongoDB...</p>}
              {trainingStatus === 'vectorizing' && <p className={styles.logText}>[2/2] Vectorizing NPK and Climate embeddings...</p>}
              {trainingStatus === 'done' && <p className={styles.successText}>✓ Model successfully fine-tuned on latest data.</p>}
            </div>

            <button 
              className={styles.trainBtn} 
              onClick={startTraining}
              disabled={trainingStatus === 'extracting' || trainingStatus === 'vectorizing'}
            >
              <RefreshCw size={18} className={trainingStatus !== 'idle' && trainingStatus !== 'done' ? styles.spin : ''} />
              {trainingStatus === 'done' ? 'Re-Sync Database' : 'Start Model Training'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect, useContext } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Paper, Typography, TextField, Button, IconButton, CircularProgress } from '../import-mui';
import { MicIcon, SendIcon } from '../import-mui';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { UserContext } from '../Usercontext';
import { getAuth } from "firebase/auth";
import { ChatMessage, Task } from '../types';
import { saveTasks } from '../task';

// 環境変数からバックエンドドメインを取得
const BE_DOMAIN = (import.meta.env.VITE_BE_DOMAIN as string) ?? "http://localhost:3001";

const ChatInterface: React.FC<{
  onTaskCreated: (task: Task) => void
}> = ({ onTaskCreated }) => {
  const { user } = useContext(UserContext);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const theme = useTheme();
  
  // 音声認識の結果を入力欄に反映
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);
  
  // メッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 音声入力開始
  const startListening = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: 'ja-JP' });
  };
  
  // メッセージ送信処理
  const handleSend = async () => {
    if (!user || !input.trim()) return;
    
    // ユーザーメッセージを追加
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      content: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    resetTranscript();
    setLoading(true);
    
    try {
      // 会話コンテキスト構築（最新の5メッセージ）
      const recentMessages = messages.slice(-5).map(m => 
        `${m.sender === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`
      ).join('\n');
      
      // APIリクエスト
      const idtoken = await getAuth()?.currentUser?.getIdToken();
      const response = await fetch(`${BE_DOMAIN}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idtoken}`
        },
        body: JSON.stringify({
          message: input,
          context: recentMessages
        })
      });
      
      if (!response.ok) {
        throw new Error('APIリクエストに失敗しました');
      }
      
      const data = await response.json();
      
      // AIメッセージを追加
      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'ai',
        content: data.message,
        timestamp: new Date(),
        suggestedTask: data.extractedTask,
        options: data.options
      };
      
      setMessages(prev => [...prev, aiMsg]);
      
      // タスク情報を更新
      setCurrentTask(prev => ({
        ...prev,
        ...data.extractedTask
      }));
      
      // タスク情報が完成したら保存
      if (data.complete) {
        const finalTask: Task = {
          id: Date.now().toString(),
          task: data.extractedTask.title,
          aiPriority: data.extractedTask.priority === 'high' ? 80 : 
                     data.extractedTask.priority === 'medium' ? 50 : 20,
          dueDate: data.extractedTask.dueDate,
          priority: data.extractedTask.priority,
          status: 'todo',
          reason: data.extractedTask.reason,
          tags: data.extractedTask.tags
        };
        
        // 既存のタスク配列に追加して保存
        onTaskCreated(finalTask);
        
        // 確認メッセージ
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          content: `タスク「${finalTask.task}」を追加しました！`,
          timestamp: new Date()
        }]);
        
        // 現在のタスク情報をリセット
        setCurrentTask({});
      }
    } catch (error) {
      console.error('エラー:', error);
      // エラーメッセージ
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'ai',
        content: 'すみません、エラーが発生しました。もう一度お試しください。',
        timestamp: new Date()
      }]);
    }
    
    setLoading(false);
  };
  
  // 選択肢クリック処理
  const handleOptionClick = (option: string) => {
    setInput(option);
    handleSend();
  };
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '70vh' }}>
      {/* メッセージ表示エリア */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {messages.length === 0 && (
          <Typography sx={{ textAlign: 'center', color: theme.palette.text.secondary, my: 4 }}>
            タスクについて話しかけてください。例：「明日までに報告書を提出する」
          </Typography>
        )}
        
        {messages.map(msg => (
          <Box key={msg.id} sx={{ mb: 2, display: 'flex', justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
            <Paper 
              sx={{ 
                p: 2, 
                maxWidth: '80%',
                bgcolor: msg.sender === 'user' ? 'primary.dark' : theme.palette.action.hover,
                color: msg.sender === 'user' ? 'white' : theme.palette.text.primary,
                borderRadius: 2
              }}
            >
              <Typography>{msg.content}</Typography>
              
              {/* 選択肢ボタン */}
              {msg.options && msg.options.length > 0 && (
                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {msg.options.map((option, i) => (
                    <Button 
                      key={i} 
                      size="small" 
                      variant="outlined"
                      onClick={() => handleOptionClick(option)}
                      sx={{ 
                        borderColor: msg.sender === 'user' ? theme.palette.divider : theme.palette.divider,
                        color: msg.sender === 'user' ? theme.palette.text.secondary : theme.palette.text.primary
                      }}
                    >
                      {option}
                    </Button>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        ))}
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>
      
      {/* 入力エリア */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            color="primary" 
            onClick={startListening}
            disabled={loading || !browserSupportsSpeechRecognition}
          >
            <MicIcon sx={{ color: listening ? 'error.main' : 'inherit' }} />
          </IconButton>
          
          <TextField
            fullWidth
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? '話しかけてください...' : 'タスクを入力...'}
            variant="outlined"
            size="small"
            disabled={loading}
            sx={{ mx: 1 }}
          />
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleSend}
            disabled={!input.trim() || loading}
          >
            送信
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInterface;

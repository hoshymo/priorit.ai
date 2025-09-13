import React, { useState, useRef, useEffect, useContext } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Paper, Typography, TextField, Button, IconButton, CircularProgress } from '@mui/material';
import { MicIcon } from '../import-mui'; // SendIconは未使用なので削除
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { UserContext } from '../Usercontext';
// Firestore関連のインポートを追加
import { getFirestore, doc, getDoc } from "firebase/firestore"; 
import { ChatMessage, Task } from '../types';

// 環境変数からバックエンドドメインを取得
const BE_DOMAIN = (import.meta.env.VITE_BE_DOMAIN as string) ?? "http://localhost:3001";

const ChatInterface: React.FC<{
  tasks: Task[];
  onTaskCreated: (task: Task) => void;
  onTaskUpdated: (task: Task) => void;
}> = ({ tasks, onTaskCreated, onTaskUpdated }) => {
  const { user } = useContext(UserContext);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState<Partial<Task>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const theme = useTheme();
  
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);
  
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  

  const handleSend = async () => {
    if (!user || !input.trim()) return;
    
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
      // FirestoreからsystemPromptを取得する処理
      const db = getFirestore();
      const userSettingsRef = doc(db, 'userSettings', user.uid);
      const docSnap = await getDoc(userSettingsRef);

      let systemPrompt: string | null = null;
      if (docSnap.exists() && docSnap.data().systemPrompt) {
        systemPrompt = docSnap.data().systemPrompt;
      }

      const recentMessages = messages.slice(-5).map(m => 
        `${m.sender === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`
      ).join('\n');
      
      const idtoken = await user.getIdToken();

      const response = await fetch(`${BE_DOMAIN}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idtoken}`
        },
        body: JSON.stringify({
          message: input,
          context: recentMessages,
          // 取得したsystemPromptをbodyに追加（存在しない場合はnull）
          systemPrompt: systemPrompt ,
          existingTasks: tasks.filter(t => t.status === 'todo')
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("API Error Response:", errorData);
        throw new Error(errorData.error || 'APIリクエストに失敗しました');
      }
      
      const data = await response.json();
      
      const aiMsg: ChatMessage = {
        id: Date.now().toString(),
        sender: 'ai',
        content: data.message,
        timestamp: new Date(),
        suggestedTask: data.extractedTask,
        options: data.options
      };
      
      setMessages(prev => [...prev, aiMsg]);
      
      setCurrentTask(prev => ({ ...prev, ...data.extractedTask }));
      
      // --- ▼▼▼ actionに応じて処理を振り分ける ▼▼▼ ---
      if (data.action === 'create' && data.complete) {
        // タスク情報が完成したら保存 (新規作成)
        const finalTask: Task = {
          id: Date.now().toString(),
          task: data.extractedTask.title,
          aiPriority: data.extractedTask.priority, // aiPriorityとして受け取る
          dueDate: data.extractedTask.dueDate,
          priority: 'medium', // 仮
          status: 'todo',
          reason: data.extractedTask.reason,
          tags: data.extractedTask.tags
        };
        onTaskCreated(finalTask);
        
        // ... (完了メッセージを追加)

      } else if (data.action === 'update') {
        // タスクを更新
        onTaskUpdated(data.updatedTask);
        
        // ... (更新完了メッセージを追加しても良い)
      }

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
        
        onTaskCreated(finalTask);
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          sender: 'ai',
          content: `タスク「${finalTask.task}」を追加しました！`,
          timestamp: new Date()
        }]);
        
        setCurrentTask({});
      }
    } catch (error) {
      console.error('エラー:', error);
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100vh' }}>
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
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <IconButton 
            color="primary" 
            onClick={() => SpeechRecognition.startListening({ continuous: false, language: 'ja-JP' })}
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
            multiline
            minRows={1}
            maxRows={6}
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

import React, { useContext, useEffect, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { UserContext } from "./Usercontext";
import { saveTasks, loadTasks } from "./task";
import { LoginButton } from "./loginbutton";
import { Box, Card, CardContent, IconButton, Typography, CardActionArea,Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Slider} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { CheckCircle as CheckIcon, Delete as DeleteIcon, PlusOneRounded as PlusIcon, Menu as MenuIcon, Edit as EditIcon } from '@mui/icons-material';

const BE_DOMAIN = (process.env.BE_DOMAIN as string) ?? "";

type Task = {
  id: string;
  task: string;
  priority: number;
};

const fixTaskArray = (arr: any[]): Task[] =>
  arr.map((t: any, index: number) => ({
    id: t.id || `${Date.now()}-${index}`, // ← idがなければ生成
    task: t.task,
    priority: typeof t.priority === "number" ? t.priority : 50
  }));



const App: React.FC = () => {
  const { user, authChecked } = useContext(UserContext);
  const [openMicModal, setOpenMicModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rankedTasks, setRankedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputTask, setInputTask] = useState(""); // ←追加
  
    const [editingTask, setEditingTask] = useState<Task | null>(null); // ← 追加
  const [openEditModal, setOpenEditModal] = useState(false);        // ← 追加

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  useEffect(() => {
    if (user) {
      loadTasks(user.uid).then((data) => {
        setTasks(fixTaskArray(data || []));
        setRankedTasks([]);
      });
    } else {
      setTasks([]);
      setRankedTasks([]);
    }
  }, [user]);

  const handleStart = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: "ja-JP" });
  };

  // 手入力タスク追加
  const handleAddTaskManual = async () => {
    if (!user || !inputTask.trim()) return;
    const newTasks = [
      ...tasks,
        { id: Date.now().toString(), task: inputTask.trim(), priority: 50 }
    ];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    setInputTask(""); // 入力欄クリア
    setRankedTasks([]);
  };

  
  // 音声入力タスク追加
  const handleAddTaskVoice = async () => {
    if (!user) return;
    if (transcript.trim()) {
      const newTasks = [
        ...tasks,
        { id: Date.now().toString(), task: inputTask.trim(), priority: 50 }
      ];
      setTasks(newTasks);
      await saveTasks(user.uid, newTasks);
      resetTranscript();
      SpeechRecognition.stopListening();
      setRankedTasks([]);
    }
  };

  // モーダルを開く
  const handleOpenMicModal = () => {
    setOpenMicModal(true);
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: "ja-JP" });
  };

  // モーダルを閉じる
  const handleCloseMicModal = () => {
    setOpenMicModal(false);
    SpeechRecognition.stopListening();
    resetTranscript();
  };

  // モーダル内でタスク追加
const handleAddTaskFromModal = async () => {
    if (!user || !transcript.trim()) return;
    const newTasks = [
      ...tasks,
      { id: Date.now().toString(), task: transcript.trim(), priority: 50 } // ← idを追加
    ];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    handleCloseMicModal();
  };

  // タスク削除機能
  const handleDeleteTask = async (taskId: string) => { // ← 追加
    if (!user) return;
    const newTasks = tasks.filter(task => task.id !== taskId);
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (task: Task) => { // ← 追加
    setEditingTask({ ...task }); // 変更用にタスクのコピーをセット
    setOpenEditModal(true);
  };

  // 編集モーダルを閉じる
  const handleCloseEditModal = () => { // ← 追加
    setOpenEditModal(false);
    setEditingTask(null);
  };

  // タスクの更新を保存
  const handleUpdateTask = async () => { // ← 追加
    if (!user || !editingTask) return;
    const newTasks = tasks.map(task => 
      task.id === editingTask.id ? editingTask : task
    );
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    handleCloseEditModal();
  };
  
  // 編集中のタスク内容を変更
  const handleEditInputChange = (event: React.ChangeEvent<HTMLInputElement>) => { // ← 追加
    if (!editingTask) return;
    setEditingTask({ ...editingTask, task: event.target.value });
  };
  
  // 編集中のタスク優先度を変更
  const handleEditPriorityChange = (event: Event, newValue: number | number[]) => { // ← 追加
    if (!editingTask) return;
    setEditingTask({ ...editingTask, priority: newValue as number });
  };

const handleRank = async () => {
  setLoading(true);
  const prompt = `
あなたはタスク管理AIです。以下のタスク一覧に対し、緊急度・重要度・期限などを考慮してpriority（重要度）を1〜100の整数で付けてください。
priorityは必ず1（最も低い）〜100（最も高い）の範囲の整数とし、日本語は使わずJSON配列で返してください。
例:
[
  {"task": "メール返信", "priority": 90},
  {"task": "昼ごはん", "priority": 20}
]
タスク: ${JSON.stringify(tasks.map(t => t.task))}
  `;

  try {
    const response = await fetch(BE_DOMAIN + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();

    // ▼▼▼【修正点】エラーレスポンスを詳細に表示する処理を追加 ▼▼▼
    if (!response.ok) {
      console.error("API Error from server:", data);
      const errorMessage = data.detail?.error?.message || data.error || "不明なエラーです。";
      alert(`APIリクエストでエラーが発生しました:\n\n${errorMessage}`);
      setLoading(false);
      return; // エラー時はここで処理を中断
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log("Gemini返答:", text);

    // candidatesがない場合（ブロックされた場合など）のハンドリング
    if (!text && data.candidates?.[0]?.finishReason) {
        alert(`LLMからの返答がありませんでした。\n理由: ${data.candidates[0].finishReason}`);
        setLoading(false);
        return;
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = fixTaskArray(JSON.parse(jsonMatch[0]));
        const sorted = parsed.sort((a, b) => b.priority - a.priority);
        setRankedTasks(parsed);
        if (user) await saveTasks(user.uid, sorted);
      } catch (e) {
        alert("LLMの返答をパースできませんでした\n" + text);
      }
    } else {
      alert("LLMの返答からJSON部分が抽出できませんでした\n" + text);
    }
  } catch (err) {
    console.error("Fetch Error:", err);
    alert("APIサーバーとの通信に失敗しました。");
  }
  setLoading(false);
};

  if (!authChecked) return <div>認証確認中...</div>;
  if (!user) return <LoginButton />;

  return (
    <div style={{ maxWidth: 480, margin: "2em auto", fontFamily: "sans-serif" }}>
      {/* <h2>音声タスク管理（Gemini LLM連携）</h2> */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={inputTask}
          onChange={e => setInputTask(e.target.value)}
          placeholder="タスクを手入力"
          style={{ marginRight: 8 }}
        />
        <button onClick={handleAddTaskManual} disabled={!inputTask.trim()}>
          手入力でタスク追加
        </button>
      </div>
      <div style={{ marginBottom: 16 }}>
        {/* <button onClick={handleStart} disabled={listening}>🎤 音声入力</button> */}
        {/* <button onClick={handleAddTaskVoice} disabled={!transcript}>タスク追加</button> */}
        <span style={{ marginLeft: 8, color: listening ? "green" : "gray" }}>
          {listening ? "録音中..." : ""}
        </span>
        <div style={{ marginTop: 8, minHeight: 24 }}>{transcript}
          <IconButton onClick={handleAddTaskVoice} disabled={!transcript} color="primary" size="large" aria-label="add task">
            <CheckIcon />
          </IconButton>
        </div>
      </div>
<div>
        <Box
          sx={{
            width: '100%',
            display: 'grid',
            gridTemplateRows: 'repeat(auto-fill, 1fr)',
            borderRadius: 1,
            gap: 1,
          }}
        >
          {tasks
            .slice() // ソート前に配列をコピー
            .sort((a, b) => b.priority - a.priority)
            .map((t) => ( // ← keyにインデックスではなくtask.idを使用
            <Card style={{marginBottom: 0.5}} key={t.id}>
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" component="div">
                    {t.task}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    優先度: {t.priority}
                  </Typography>
                </Box>
                <Box>
                  {/* --- 編集・削除ボタン --- */}
                  <IconButton onClick={() => handleOpenEditModal(t)} color="default" aria-label="edit task">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDeleteTask(t.id)} color="warning" aria-label="delete task">
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      </div>

      <button onClick={handleRank} disabled={tasks.length === 0 || loading}>
        {loading ? "Geminiが優先順位付け中..." : "LLMで優先順位を付ける"}
      </button>

      <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, }}>
        <IconButton onClick={handleOpenMicModal} color="primary" size="large" aria-label="start voice input" sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#f0f0f0' }}}>
          <MicIcon fontSize="large" />
        </IconButton>
      </Box>
      {rankedTasks.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>優先度順タスクリスト</h3>
          <ol>
            {rankedTasks.map((t, i) => (
              <li key={i}>
                <span style={{ fontWeight: "bold" }}>{t.task}</span>
                <span style={{
                  marginLeft: 8,
                  color:
                    t.priority >= 80 ? "red" :
                    t.priority >= 50 ? "orange" :
                    t.priority >= 20 ? "gray" : "black"
                }}>
                  [priority: {t.priority}]
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {/* 画面右下固定でボタンを表示する */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1000,
        }}
      >
        {/* <IconButton onClick={handleOpenMicModal} color="primary" size="large" aria-label="start voice input">
          <MicIcon />
        </IconButton>
        <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
          <MenuIcon />
        </IconButton> */}
      </Box>

      <Dialog open={openMicModal} onClose={handleCloseMicModal} fullWidth>
        <DialogTitle>音声入力でタスク追加</DialogTitle>
        <DialogContent>
          {!browserSupportsSpeechRecognition && (
            <Typography color="error">このブラウザは音声認識に対応していません</Typography>
          )}
          <Typography variant="subtitle1" sx={{ mt: 2 }}>
            {listening ? "録音中..." : ""}
          </Typography>
          <Typography variant="body1" sx={{ mt: 2, minHeight: 28 }}>
            {transcript}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMicModal}>キャンセル</Button>
          <Button 
            onClick={handleAddTaskFromModal} 
            disabled={!transcript.trim()}
            color="primary"
            variant="contained"
            startIcon={<CheckIcon />}
          >
            タスク追加
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={openEditModal} onClose={handleCloseEditModal} fullWidth>
        <DialogTitle>タスクの編集</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="タスク内容"
            type="text"
            fullWidth
            variant="standard"
            value={editingTask?.task || ""}
            onChange={handleEditInputChange}
            sx={{ mb: 4 }}
          />
          <Typography gutterBottom>優先度: {editingTask?.priority}</Typography>
          <Slider
            value={editingTask?.priority || 50}
            onChange={handleEditPriorityChange}
            aria-labelledby="priority-slider"
            valueLabelDisplay="auto"
            step={1}
            marks
            min={1}
            max={100}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditModal}>キャンセル</Button>
          <Button 
            onClick={handleUpdateTask} 
            color="primary"
            variant="contained"
          >
            保存する
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default App;
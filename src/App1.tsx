import React, { useContext, useEffect, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { UserContext } from "./Usercontext";
import { saveTasks, loadTasks } from "./task";
import { LoginButton } from "./loginbutton";
import { Box, Card, CardContent, IconButton, Typography, CardActionArea,Dialog, DialogTitle, DialogContent, DialogActions, Button} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { CheckCircle as CheckIcon, Delete as DeleteIcon, PlusOneRounded as PlusIcon, Menu as MenuIcon } from '@mui/icons-material';
import { getAuth } from "firebase/auth";

// const BE_DOMAIN = window.location.hostname === "hoshymo.github.io" ? "https://backend-1064199407438.asia-northeast1.run.app" : "http://localhost:3001";
const BE_DOMAIN = (process.env.REACT_APP_BE_DOMAIN as string) ?? "http://localhost:3001";

type Task = {
  task: string;
  priority: number;
};

const fixTaskArray = (arr: any[]): Task[] =>
arr.map((t: any) => ({
    task: t.task,
    priority: typeof t.priority === "number" ? t.priority : 50 // デフォルト値は50など
  }));



const App: React.FC = () => {
  const { user, authChecked } = useContext(UserContext);
  const [openMicModal, setOpenMicModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [rankedTasks, setRankedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputTask, setInputTask] = useState(""); // ←追加

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
      { task: inputTask.trim(), priority: 50 }
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
        { task: transcript.trim(), priority: 50}
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
      { task: transcript.trim(), priority: 50}
    ];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    handleCloseMicModal();
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
    const idtoken = await getAuth()?.currentUser?.getIdToken(/* forceRefresh */ false);
    const response = await fetch(BE_DOMAIN + "/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": ("Bearer " + idtoken) },
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
        {/* <strong>タスク一覧:</strong> */}
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
            .slice()
            .sort((a, b) => b.priority - a.priority)
            .map((t, i) => (
            <Card style={{marginBottom: 0.5}} key={i}>
              <CardActionArea
                // onClick={() => setSelectedCard(index)}
                // data-active={selectedCard === index ? '' : undefined}
                sx={{
                  height: '100%',
                  '&[data-active]': {
                    backgroundColor: 'action.selected',
                    '&:hover': {
                      backgroundColor: 'action.selectedHover',
                    },
                  },
                  // bgcolor: 'primary.main',
                }}
              >
                <CardContent sx={{ height: '100%' }}>
                  <Typography variant="h6" component="div">
                    {t.task}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t.priority}
                  </Typography>
                  <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
                    <CheckIcon />
                  </IconButton>
                  <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
                    <PlusIcon />
                  </IconButton>
                  <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
                    <DeleteIcon />
                  </IconButton>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </div>
      <button onClick={handleRank} disabled={tasks.length === 0 || loading}>
        {loading ? "Geminiが優先順位付け中..." : "LLMで優先順位を付ける"}
      </button>
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
        <IconButton onClick={handleOpenMicModal} color="primary" size="large" aria-label="start voice input">
          <MicIcon />
        </IconButton>
        <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
          <MenuIcon />
        </IconButton>
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
    </div>
  );
};

export default App;
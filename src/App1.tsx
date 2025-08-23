import React, { useContext, useEffect, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { UserContext } from "./Usercontext";
import { saveTasks, loadTasks } from "./task";
import { LoginButton } from "./loginbutton";
import { Box, Card, CardContent, IconButton, Typography, CardActionArea } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { CheckCircle as CheckIcon, Delete as DeleteIcon, PlusOneRounded as PlusIcon, Menu as MenuIcon } from '@mui/icons-material';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY as string);

type Task = {
  task: string;
  priority: "high" | "medium" | "low";
};

const fixTaskArray = (arr: any[]): Task[] =>
  arr.map((t: any) => ({
    task: t.task,
    priority: (["high", "medium", "low"].includes(t.priority)
      ? t.priority
      : "medium") as "high" | "medium" | "low"
  }));

const App: React.FC = () => {
  const { user, authChecked } = useContext(UserContext);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [rankedTasks, setRankedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputTask, setInputTask] = useState(""); // ←追加

  const { transcript, listening, resetTranscript } = useSpeechRecognition();

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
      { task: inputTask.trim(), priority: "medium" as const }
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
        { task: transcript.trim(), priority: "medium" as const }
      ];
      setTasks(newTasks);
      await saveTasks(user.uid, newTasks);
      resetTranscript();
      SpeechRecognition.stopListening();
      setRankedTasks([]);
    }
  };

  const handleRank = async () => {
    setLoading(true);
    const prompt = `
あなたはタスク管理AIです。以下のタスク一覧に対し、「今日」や「明日」などの時間情報や、内容の緊急度・重要度を考慮して
「high」「medium」「low」のpriorityを付けて、JSON配列で返してください。
priorityは "high" "medium" "low" のいずれかとし、日本語は使わないこと。
例:
[
  {"task": "メール返信", "priority": "high"},
  {"task": "昼ごはん", "priority": "low"}
]
タスク: ${JSON.stringify(tasks.map(t => t.task))}
    `;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log("Gemini返答:", text);

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = fixTaskArray(JSON.parse(jsonMatch[0]));
        setRankedTasks(parsed);
      } catch (e) {
        alert("LLMの返答をパースできませんでした\n" + text);
      }
    } else {
      alert("LLMの返答からJSON部分が抽出できませんでした\n" + text);
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
          {tasks.map((t, i) => (
            <Card style={{marginBottom: 0.5}}>
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
                  color: { high: "red", medium: "orange", low: "gray" }[t.priority]
                }}>
                  [{t.priority}]
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
        <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
          <MicIcon />
        </IconButton>
        <IconButton onClick={handleStart} disabled={listening} color="primary" size="large" aria-label="start voice input">
          <MenuIcon />
        </IconButton>
      </Box>
    </div>
  );
};

export default App;
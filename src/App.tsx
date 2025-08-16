import React, { useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY as string);
console.log(process.env.REACT_APP_GEMINI_API_KEY)
// const model = genAI.getGenerativeModel({ model: "gemini-pro" });
//AIzaSyARFfhOvf9RXaGow64uGxwcALMpG9rtjeI
type Task = {
  task: string;
  priority: "high" | "medium" | "low";
};

const priorityOrder = { high: 0, medium: 1, low: 2 };

const App: React.FC = () => {
  const [tasks, setTasks] = useState<string[]>([]);
  const [rankedTasks, setRankedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const { transcript, listening, resetTranscript } = useSpeechRecognition();

  // 音声認識スタート
  const handleStart = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: "ja-JP" });
  };

  // 音声→タスク追加
  const handleAddTask = () => {
    if (transcript.trim()) {
      setTasks((prev) => [...prev, transcript.trim()]);
      resetTranscript();
      SpeechRecognition.stopListening();
    }
  };

  // Geminiで優先順位付け
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
タスク: ${JSON.stringify(tasks)}
    `;
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log("Gemini返答:", text);

    // JSON部分だけ抽出（最初の[から最後の]まで）
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed: Task[] = JSON.parse(jsonMatch[0]);
        setRankedTasks(
          [...parsed].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
        );
      } catch (e) {
        alert("LLMの返答をパースできませんでした\n" + text);
      }
    } else {
      alert("LLMの返答からJSON部分が抽出できませんでした\n" + text);
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 480, margin: "2em auto", fontFamily: "sans-serif" }}>
      <h2>音声タスク管理（Gemini LLM連携）</h2>
      <div style={{ marginBottom: 16 }}>
        <button onClick={handleStart} disabled={listening}>🎤 音声入力</button>
        <button onClick={handleAddTask} disabled={!transcript}>タスク追加</button>
        <span style={{ marginLeft: 8, color: listening ? "green" : "gray" }}>
          {listening ? "録音中..." : ""}
        </span>
        <div style={{ marginTop: 8, minHeight: 24 }}>{transcript}</div>
      </div>
      <div>
        <strong>タスク一覧:</strong>
        <ul>
          {tasks.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
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
                <span style={{ marginLeft: 8, color: {
                  high: "red", medium: "orange", low: "gray"
                }[t.priority] }}>
                  [{t.priority}]
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

export default App;
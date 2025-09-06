import React, { useContext, useEffect, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { UserContext } from "./Usercontext";
import { saveTasks, loadTasks } from "./task";
import { LoginButton } from "./loginbutton";
import { keyframes, styled, ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, Card, CardContent, IconButton, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Slider, Switch, Collapse } from './import-mui';
import { CheckIcon, DeleteIcon, EditIcon, PlusIcon, MenuIcon, MicIcon } from './import-mui';
import { CssBaseline, useMediaQuery } from './import-mui';
import { getAuth } from "firebase/auth";

// const BE_DOMAIN = window.location.hostname === "hoshymo.github.io" ? "https://backend-1064199407438.asia-northeast1.run.app" : "http://localhost:3001";
const BE_DOMAIN = (import.meta.env.VITE_BE_DOMAIN as string) ?? "http://localhost:3001";

// --- ステップ1: Taskの型定義を変更 ---
type Task = {
  id: string;
  task: string;
  aiPriority: number;     // ← priorityからaiPriorityに名前変更
  userPriority?: number;  // ← 追加 (3:高, 2:中, 1:低)
};

// 既存のデータ変換ロジックも修正
const fixTaskArray = (arr: any[]): Task[] =>
  arr.map((t: any, index: number) => ({
    id: t.id || `${Date.now()}-${index}`,
    task: t.task,
    aiPriority: t.priority || t.aiPriority || 50, // ← 互換性のための修正
    userPriority: t.userPriority, // ← userPriorityを読み込む
  }));


const App: React.FC = () => {
  const { user, authChecked } = useContext(UserContext);
  const [openMicModal, setOpenMicModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  // rankedTasksは現在使われていないため、一旦コメントアウトまたは削除してもOKです
  // const [rankedTasks, setRankedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputTask, setInputTask] = useState("");
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [openEditModal, setOpenEditModal] = useState(false);

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  const [isExpanded, setIsExpanded] = useState(false);

  // light/dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = React.useState<'light' | 'dark'>(
    prefersDarkMode ? 'dark' : 'light'
  );
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          // background: {
          //   default: mode === 'light' ? '#f5f5f5' : '#121212',
          // },
        },
      }),
    [mode]
  );

  useEffect(() => {
    if (user) {
      loadTasks(user.uid).then((data) => {
        setTasks(fixTaskArray(data || []));
      });
    } else {
      setTasks([]);
    }
  }, [user]);

  // --- タスク追加時のaiPriorityをデフォルト値(50)に設定 ---
  const handleAddTaskManual = async () => {
    if (!user || !inputTask.trim()) return;
    const newTask = { 
      id: Date.now().toString(), 
      task: inputTask.trim(), 
      aiPriority: 50 // ← aiPriorityとして追加
    };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    setInputTask("");
  };

  const handleAddTaskFromModal = async () => {
    if (!user || !transcript.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      task: transcript.trim(),
      aiPriority: 50 // ← aiPriorityとして追加
    };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    handleCloseMicModal();
  };

  // --- ステップ2: ユーザー優先度を更新する関数 ---
  const handleSetUserPriority = async (taskId: string, priority: number) => { // ← 追加
    if (!user) return;
    const newTasks = tasks.map(task => 
      task.id === taskId ? { ...task, userPriority: priority } : task
    );
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
  };
  
  // --- 既存の関数群 (一部修正) ---
  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    const newTasks = tasks.filter(task => task.id !== taskId);
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
  };

  const handleOpenEditModal = (task: Task) => {
    setEditingTask({ ...task });
    setOpenEditModal(true);
  };

  const handleCloseEditModal = () => {
    setOpenEditModal(false);
    setEditingTask(null);
  };

  const handleUpdateTask = async () => {
    if (!user || !editingTask) return;
    const newTasks = tasks.map(task => 
      task.id === editingTask.id ? editingTask : task
    );
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    handleCloseEditModal();
  };
  
  const handleEditInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingTask) return;
    setEditingTask({ ...editingTask, task: event.target.value });
  };
  
// 編集中のタスクの「ユーザー優先度」をスライダーで変更するためのハンドラ
    const handleEditUserPriorityChange = (event: Event, newValue: number | number[]) => {
    if (!editingTask) return;
    setEditingTask({ ...editingTask, userPriority: newValue as number });
    };

  const handleCloseMicModal = () => {
    setOpenMicModal(false);
    SpeechRecognition.stopListening();
    resetTranscript();
  };
  
  const handleOpenMicModal = () => {
    setOpenMicModal(true);
    resetTranscript();
    SpeechRecognition.startListening({ continuous: false, language: "ja-JP" });
  };

  // --- LLMの優先度付け機能を修正 ---
  const handleRank = async () => {
    if (!user) return;
    setLoading(true);
    const prompt = `
あなたはタスク管理AIです。以下のタスク一覧に対し、緊急度・重要度・期限などを考慮してaiPriority（AIによる重要度）を1〜100の整数で付けてください。
aiPriorityは必ず1（最も低い）〜100（最も高い）の範囲の整数とし、日本語は使わずJSON配列で返してください。
例:
[
  {"task": "メール返信", "aiPriority": 90},
  {"task": "昼ごはん", "aiPriority": 20}
]
タスク: ${JSON.stringify(tasks.map(t => t.task))}
  `;

  try {
    const idtoken = await getAuth()?.currentUser?.getIdToken(/* forceRefresh */ false);
    const response = await fetch(BE_DOMAIN + "/api/generate", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idtoken}` // 認証トークンを追加
      },
      body: JSON.stringify({ prompt }),
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("API Error from server:", data);
      throw new Error(data.detail?.error?.message || data.error || "不明なエラーです。");
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsedResults: { task: string; aiPriority: number }[] = JSON.parse(jsonMatch[0]);
      
      // AIの返却結果を既存のタスクにマージする
      const newTasks = tasks.map(originalTask => {
        const rankedTask = parsedResults.find(p => p.task === originalTask.task);
        return rankedTask ? { ...originalTask, aiPriority: rankedTask.aiPriority } : originalTask;
      });
      
      setTasks(newTasks);
      await saveTasks(user.uid, newTasks);
    } else {
      alert("LLMの返答からJSON部分が抽出できませんでした\n" + text);
    }
  } catch (err) {
    alert(`APIリクエストでエラーが発生しました:\n\n${err}`);
  }
  setLoading(false);
};

  const handleToggleDark = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  if (!authChecked) return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography variant="subtitle2" sx={{ color: '#000000a0' }}>
          Just a mmoment...
        </Typography>
      </Box>
    );
  if (!user) return <LoginButton />;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

    <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
      }}
    >
        <Box sx={{ width: '96%', display: 'grid', gap: 1 }}>

      {/* --- 入力フォーム --- */}
      <div style={{ marginTop:16, marginBottom: 16, display: 'flex' }}>
        <TextField
          value={inputTask}
          onChange={e => setInputTask(e.target.value)}
          placeholder="タスクを手入力"
          variant="outlined"
          size="small"
          fullWidth
        />
        <Button onClick={handleAddTaskManual} disabled={!inputTask.trim()} variant="contained" sx={{ ml: 1 }}>追加</Button>
      </div>

            {(() => {
            // 事前にソート済みのタスク配列を準備
            const sortedTasks = tasks
                .slice()
                .sort((a, b) => {
                const userPriorityA = a.userPriority || 50; // 未設定は中間値として扱う
                const userPriorityB = b.userPriority || 50;
                const totalPriorityA = userPriorityA + a.aiPriority;
                const totalPriorityB = userPriorityB + b.aiPriority;
                return totalPriorityB - totalPriorityA;
                });

            const topTasks = sortedTasks.slice(0, 3);
            const remainingTasks = sortedTasks.slice(3);

            const rainbowSpin = keyframes`
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            `;
            const AnimatedCard = styled(Card)(({ theme }) => ({
              position: 'relative',
              zIndex: 0,
              borderRadius: theme.shape.borderRadius,
              padding: theme.spacing(2),
              overflow: 'hidden',
              // 枠の背景を回転させる擬似要素
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-819px',
                left: '-819px',
                right: '-819px',
                bottom: '-819px',
                borderRadius: 'inherit',
                padding: '4px',
                background: 'conic-gradient(red, orange, indigo, violet, red)',
                // background: 'conic-gradient(red, orange, yellow, green, blue, indigo, violet, red)',
                animation: `${rainbowSpin} 12s linear infinite`,
                zIndex: -1,
              },
              // 枠の内側に白背景を重ねて中身を静止させる
              '&::after': {
                content: '""',
                position: 'absolute',
                top: 4,
                left: 4,
                right: 4,
                bottom: 4,
                borderRadius: 'inherit',
                backgroundColor: theme.palette.background.paper,
                zIndex: -1,
              },
            }));
            const RainbowCard = styled(Card)({
              border: '4px solid',
              borderImage: 'linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) 1',
              borderRadius: '12px',
            });

            return (
                <>
                {/* --- TOP3タスクの表示 --- */}
                {topTasks.map((t) => {
                    const CardWrapper = (t.aiPriority + (t.userPriority ?? 0)) > 80 ? AnimatedCard : Card;
                    return (
                    <CardWrapper style={{marginBottom: 0.5}} key={t.id}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="h6" component="div">
                                {t.task}
                            </Typography>
                            <Box>
                                <IconButton onClick={() => handleOpenEditModal(t)} color="default" size="small"><EditIcon /></IconButton>
                                <IconButton onClick={() => handleDeleteTask(t.id)} color="warning" size="small"><DeleteIcon /></IconButton>
                            </Box>
                            </Box>
                            
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                            AI優先度: {t.aiPriority}
                            
                            {/* ユーザー優先度が設定されていれば、50を基準とした±値を青字で表示 */}
                            {t.userPriority != null && (
                                <Box component="span" sx={{ 
                                color: '#1976d2', // MUIのデフォルトの青色
                                fontWeight: 'bold',
                                ml: 1 // marginLeft
                                }}>
                                ( {t.userPriority - 50 >= 0 ? '+' : ''}{t.userPriority - 50} )
                                </Box>
                            )}
                            </Typography>
                        </CardContent>
                  </CardWrapper>
                );})}

                {/* --- 4件目以降のタスクをCollapseで囲む --- */}
                {remainingTasks.length > 0 && (
                    <>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ width: '100%', display: 'grid', gap: 1 }}>
                        {remainingTasks.map((t) => (
                            <Card style={{marginBottom: 0.5}} key={t.id}>
                                <CardContent>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="h6" component="div">
                                        {t.task}
                                    </Typography>
                                    <Box>
                                        <IconButton onClick={() => handleOpenEditModal(t)} color="default" size="small"><EditIcon /></IconButton>
                                        <IconButton onClick={() => handleDeleteTask(t.id)} color="warning" size="small"><DeleteIcon /></IconButton>
                                    </Box>
                                    </Box>
                                    
                                    <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                    AI優先度: {t.aiPriority}
                                    
                                    {/* ユーザー優先度が設定されていれば、50を基準とした±値を青字で表示 */}
                                    {t.userPriority != null && (
                                        <Box component="span" sx={{ 
                                        color: '#1976d2', // MUIのデフォルトの青色
                                        fontWeight: 'bold',
                                        ml: 1 // marginLeft
                                        }}>
                                        ( {t.userPriority - 50 >= 0 ? '+' : ''}{t.userPriority - 50} )
                                        </Box>
                                    )}
                                    </Typography>                
                                </CardContent>
                            </Card>
                        ))}
                        </Box>
                    </Collapse>
                    
                    {/* --- 開閉ボタン --- */}
                    <Button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        fullWidth 
                        sx={{ mt: 1 }}
                    >
                        {isExpanded ? '閉じる' : `残り${remainingTasks.length}件を見る`}
                    </Button>
                    </>
                )}
                </>
            );
            })()}

          <Button onClick={handleRank} disabled={tasks.length === 0 || loading} variant="contained" color="primary" sx={{ my: 2, width: '100%' }}>
            {loading ? "Geminiが優先順位付け中..." : "LLMで優先順位を付ける"}
          </Button>
        </Box>

      {/* --- 右下固定ボタン --- */}
      <Box sx={{ position: 'fixed', bottom: 20, left: 20, zIndex: 1000 }}>
        <Switch checked={mode === 'dark'} onChange={handleToggleDark} />
      </Box>
      <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, display: 'flex', gap: 1, alignItems: 'center' }}>
        <IconButton onClick={handleOpenMicModal} color="primary" size="small" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <MenuIcon/>
        </IconButton>
        <IconButton onClick={handleOpenMicModal} color="primary" size="large" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <MicIcon fontSize="large" />
        </IconButton>
      </Box>

      {/* --- 音声入力モーダル --- */}
      <Dialog open={openMicModal} onClose={handleCloseMicModal} fullWidth>
        <DialogTitle>音声入力でタスク追加</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mt: 2 }}>{listening ? "録音中..." : "マイクに向かって話してください"}</Typography>
          <Typography variant="body1" sx={{ mt: 2, minHeight: 28 }}>{transcript}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMicModal}>キャンセル</Button>
          <Button onClick={handleAddTaskFromModal} disabled={!transcript.trim()} color="primary" variant="contained" startIcon={<CheckIcon />}>タスク追加</Button>
        </DialogActions>
      </Dialog>
      
      {/* --- 編集モーダル --- */}
      <Dialog open={openEditModal} onClose={handleCloseEditModal} fullWidth>
        <DialogTitle>タスクの編集</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="タスク内容" type="text" fullWidth variant="standard" value={editingTask?.task || ""} onChange={handleEditInputChange} sx={{ mb: 4 }} />
            <Typography gutterBottom>ユーザー優先度: {editingTask?.userPriority || '未設定'}</Typography>
            <Slider
            value={editingTask?.userPriority || 50} // 未設定なら中央値の50を表示
            onChange={handleEditUserPriorityChange}  // 上で用意したハンドラを紐付け
            aria-labelledby="user-priority-slider"
            valueLabelDisplay="auto"
            step={1}
            marks
            min={0}
            max={100}
            />         
            {/* <Slider value={editingTask?.aiPriority || 50} onChange={handleEditPriorityChange} valueLabelDisplay="auto" step={1} marks min={1} max={100} /> */}
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
      </Box>
    </ThemeProvider>
  );
};

export default App;
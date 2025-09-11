import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { UserContext } from "./Usercontext";
import { saveTasks, loadTasks } from "./task";
import { LoginButton } from "./loginbutton";
import { useMediaQuery } from "@mui/material"
import { keyframes, styled, useTheme } from '@mui/material/styles';
import { Box, Card, Button, Divider, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Slide, TextField, Typography, Slider, Switch, Collapse, Paper, Tooltip } from '@mui/material';
import { CheckIcon, DeleteIcon, EditIcon, PlusIcon, SettingsIcon, MicIcon, InfoIcon, ThumbUpIcon, ThumbDownIcon, HistoryIcon } from './import-mui';
import { ThemeContext } from './ThemeContext';
import { getAuth } from "firebase/auth";
import ChatInterface from "./components/ChatInterface";
import { Task } from "./types";

// const BE_DOMAIN = window.location.hostname === "hoshymo.github.io" ? "https://backend-1064199407438.asia-northeast1.run.app" : "http://localhost:3001";
const BE_DOMAIN = (import.meta.env.VITE_BE_DOMAIN as string) ?? "http://localhost:3001";

// 既存のデータ変換ロジック

// 既存のデータ変換ロジックも修正
const fixTaskArray = (arr: any[]): Task[] =>
  arr.map((t: any, index: number) => ({
    id: t.id || `${Date.now()}-${index}`,
    task: t.task,
    aiPriority: t.priority || t.aiPriority || 50, // ← 互換性のための修正
    userPriority: t.userPriority, // ← userPriorityを読み込む
    priority: t.priority || 'medium', // 優先度（high/medium/low）
    status: t.status || 'todo', // ステータス（todo/done）
    reason: t.reason, // 理由（あれば）
    dueDate: t.dueDate, // 期限（あれば）
    tags: t.tags || [] // タグ（あれば）
  }));


const App: React.FC = () => {
  const navigate = useNavigate();

  const { user, authChecked } = useContext(UserContext);
  const [openMicModal, setOpenMicModal] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  // rankedTasksは現在使われていないため、一旦コメントアウトまたは削除してもOKです
  // const [rankedTasks, setRankedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputTask, setInputTask] = useState("");
  
   const [openHistoryModal, setOpenHistoryModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [openEditModal, setOpenEditModal] = useState(false);

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const themeContext = useContext(ThemeContext);
  if (!themeContext) return null;
  const { mode, setMode } = themeContext;
  const theme = useTheme();

  const [focusArea, setFocusArea] = useState<'list' | 'chat'>('list');
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // 600px以下

  const todoTasks = tasks.filter(t => t.status === 'todo');

  useEffect(() => {
    if (user) {
      loadTasks(user.uid).then((data) => {
        setTasks(fixTaskArray(data || []));
      });
    } else {
      setTasks([]);
    }

    if(user){
      console.log(user.uid);
    }
    // SpeechRecognition の event handler 例
    // const recognition = SpeechRecognition.getRecognition();
    // console.log("recognition:");
    // console.log(recognition);
    // if (recognition) {
    //   recognition.onstart = () => {
    //     console.log('Speech recognition started');
    //   };
    //   recognition.onaudiostart = () => {
    //     console.log('Speech recognition: audio started.');
    //   };
    //   recognition.onaudioend = () => {
    //     console.log('Speech recognition: audio ended.');
    //   };
    //   recognition.onerror = (event) => {
    //     console.error('SpeechRecognition error:', event.error);
    //     console.log('Error details:', event);
    //   };
    // } else {
    //   console.warn('SpeechRecognition is not supported in this browser.');
    // }
  }, [user]);

  // --- タスク追加時のaiPriorityをデフォルト値(50)に設定 ---
  const handleAddTaskManual = async () => {
    if (!user || !inputTask.trim()) return;
    const newTask = { 
      id: Date.now().toString(), 
      task: inputTask.trim(), 
      aiPriority: 50, // ← aiPriorityとして追加
      status: 'todo' as const,
      priority: 'medium' as const
    };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
    setInputTask("");
  };

  // チャットから作成されたタスクを追加
  const handleTaskCreated = async (newTask: Task) => {
    if (!user) return;
    
    // 既存のタスク配列に追加
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
  };

  const handleAddTaskFromModal = async () => {
    if (!user || !transcript.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      task: transcript.trim(),
      aiPriority: 50, // ← aiPriorityとして追加
      priority: 'medium', // 優先度（high/medium/low）
      status: 'todo' // ステータス（todo/done）
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

  const handleToggleTaskStatus = async (taskId: string) => {
    if (!user) return;
    
    // mapのコールバック関数の返り値の型を明示的に指定
    const newTasks = tasks.map((task): Task => { 
      if (task.id === taskId) {
        return { 
          ...task, 
          status: task.status === 'todo' ? 'done' : 'todo' 
        };
      }
      return task;
    });

    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
  };

  const handleEditInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingTask) return;
    setEditingTask({ ...editingTask, task: event.target.value });
  };

  const handleUserPriorityAdjustment = (adjustment: number) => {
    if (!editingTask) return;
    
    // 現在の優先度を取得。未設定(null or undefined)の場合はデフォルト値の50を基準にする
    const currentPriority = editingTask.userPriority ?? 50;
    
    // 優先度を調整し、0〜100の範囲に収める
    const newPriority = Math.max(0, Math.min(100, currentPriority + adjustment));
    
    // stateを更新
    setEditingTask({ ...editingTask, userPriority: newPriority });
  };
  
const handleUserPriorityOnCard = async (taskId: string, adjustment: number) => {
    if (!user) return;
    
    const newTasks = tasks.map(task => {
      // IDが一致するタスクを見つけたら、優先度を更新
      if (task.id === taskId) {
        const currentPriority = task.userPriority ?? 50; // 未設定の場合は50を基準
        const newPriority = Math.max(0, Math.min(100, currentPriority + adjustment));
        return { ...task, userPriority: newPriority };
      }
      return task; // IDが違うタスクはそのまま返す
    });

    setTasks(newTasks); // UIを更新
    await saveTasks(user.uid, newTasks); // 変更をDBに保存
  };
  
  const handleCloseMicModal = () => {
    setOpenMicModal(false);
    SpeechRecognition.stopListening();
    resetTranscript();
  };
  
  const handleOpenMicModal = (e: { stopPropagation: () => void; }) => {
    // resetTranscript();
    // SpeechRecognition.startListening({ continuous: false, language: "ja-JP" });
    // setOpenMicModal(true);
    e.stopPropagation(); // click することでこの panel に focus が来てしまうのを防ぐ
    setFocusArea(focusArea == 'list' ? 'chat' : 'list');
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
    setMode((mode === 'light' ? 'dark' : 'light'));
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
          Just a moment...
        </Typography>
      </Box>
    );
  if (!user) return <LoginButton />;

  const TodoList = () => {
    return (
    <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%'
      }}
    >
        <Box sx={{ width: '96%', display: 'grid', gap:1, mt: 2 }}>

            {(() => {
            // 事前にソート済みのタスク配列を準備
            const sortedTasks = todoTasks
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
                                {/* 理由表示用ツールチップ */}
                                {t.reason && (
                                  <Tooltip title={t.reason}>
                                    <IconButton size="small">
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                            </Typography>
                            <Box>
                              {/* --- ▼▼▼ 完了ボタンを追加 ▼▼▼ --- */}
                              <IconButton onClick={() => handleToggleTaskStatus(t.id)} color="success" size="small">
                                <CheckIcon />
                              </IconButton>
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

                            <Box>
                              <IconButton size="small" onClick={() => handleUserPriorityOnCard(t.id, -10)}>
                                <ThumbDownIcon fontSize="small" />
                              </IconButton>
                              <IconButton size="small" onClick={() => handleUserPriorityOnCard(t.id, 10)}>
                                <ThumbUpIcon fontSize="small" />
                              </IconButton>
                            </Box>
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
                                        {/* 理由表示用ツールチップ */}
                                        {t.reason && (
                                          <Tooltip title={t.reason}>
                                            <IconButton size="small">
                                              <InfoIcon fontSize="small" />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                    </Typography>
                                    <Box>
                                      {/* --- ▼▼▼ 完了ボタンを追加 ▼▼▼ --- */}
                                      <IconButton onClick={() => handleToggleTaskStatus(t.id)} color="success" size="small">
                                        <CheckIcon />
                                      </IconButton>
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

                                    <Box>
                                      <IconButton size="small" onClick={() => handleUserPriorityOnCard(t.id, -10)}>
                                        <ThumbDownIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton size="small" onClick={() => handleUserPriorityOnCard(t.id, 10)}>
                                        <ThumbUpIcon fontSize="small" />
                                      </IconButton>
                                    </Box>         
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
      <Box sx={{ position: 'fixed', bottom: 20, right: isMobile ? 20 : '52%', zIndex: 1000, display: 'flex', gap: 1, alignItems: 'center' }}>
              {/* --- ▼▼▼ 履歴ボタンを追加 ▼▼▼ --- */}
        <IconButton onClick={() => setOpenHistoryModal(true)} color="primary" size="small" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <HistoryIcon />
        </IconButton>
        <IconButton onClick={() => navigate('/settings')} color="primary" size="small" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <SettingsIcon />
        </IconButton>
      {/* --- 音声入力開始ボタン --- チャットモードでは非表示 */}
      {!showChat && (
        <IconButton onClick={handleOpenMicModal} color="primary" size="large" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <MicIcon fontSize="large" />
        </IconButton>
      )}
      </Box>

      {/* --- 音声入力モーダル --- */}
      <Dialog open={openMicModal} onClose={handleCloseMicModal} fullWidth>
        <DialogTitle>音声入力でタスク追加</DialogTitle>
        {!browserSupportsSpeechRecognition ? (
          <>
          <Typography color="error" sx={{ margin: 2 }}>動作環境が音声認識に対応していません。別のブラウザ等を使用してください。</Typography>
          <DialogActions>
            <Button onClick={handleCloseMicModal}>キャンセル</Button>
          </DialogActions>
          </>
        ) : (
          <>
        <DialogContent>
          <Typography variant="subtitle1" sx={{ mt: 2 }}>{listening ? "録音中..." : "マイクに向かって話してください"}</Typography>
          <Typography variant="body1" sx={{ mt: 2, minHeight: 28 }}>{transcript}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMicModal}>キャンセル</Button>
          <Button onClick={handleAddTaskFromModal} disabled={!transcript.trim()} color="primary" variant="contained" startIcon={<CheckIcon />}>タスク追加</Button>
        </DialogActions>
          </>
        )}
      </Dialog>

      {/* --- 編集モーダル --- */}
      <Dialog open={openEditModal} onClose={handleCloseEditModal} fullWidth>
        <DialogTitle>タスクの編集</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="タスク内容" type="text" fullWidth variant="standard" value={editingTask?.task || ""} onChange={handleEditInputChange} sx={{ mb: 4 }} />
          <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="caption" display="block">
              ユーザー優先度
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
              <IconButton color="error" onClick={() => handleUserPriorityAdjustment(-10)} size="large">
                <ThumbDownIcon />
              </IconButton>
              
              <Typography variant="h5" component="div" sx={{ minWidth: 60, textAlign: 'center' }}>
                {editingTask?.userPriority ?? 50}
              </Typography>

              <IconButton color="primary" onClick={() => handleUserPriorityAdjustment(10)} size="large">
                <ThumbUpIcon />
              </IconButton>
            </Box>
          </Box>
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

        <Dialog open={openHistoryModal} onClose={() => setOpenHistoryModal(false)} fullWidth scroll="paper">
        <DialogTitle>完了したタスクの履歴</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
            {tasks
              .filter(t => t.status === 'done') // 完了タスクのみフィルタリング
              .map((t) => (
                <Card key={t.id} sx={{ opacity: 0.8 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}> {/* Paddingを調整 */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ textDecoration: 'line-through' }}>
                        {t.task}
                      </Typography>
                      <Box>
                        <Button size="small" onClick={() => handleToggleTaskStatus(t.id)}>
                          戻す
                        </Button>
                        <IconButton onClick={() => handleDeleteTask(t.id)} color="warning" size="small">
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
            ))}
            {tasks.filter(t => t.status === 'done').length === 0 && (
              <Typography color="text.secondary" sx={{ textAlign: 'center', my: 4 }}>
                完了したタスクはありません
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHistoryModal(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
      </Box>
  )};

  const ChatPanel = () => {
    return (
    <Box
      flexDirection="column"
      sx={{
        display: 'flex',
        margin: 2,
        justifyContent: 'center',
        alignItems: 'center',
        // width: '100vw'
      }}
    >
      <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
        Chat Panel
      </Typography>

      <Divider />

      <TextField
        value={inputTask}
        onChange={e => setInputTask(e.target.value)}
        placeholder="タスクを手入力"
        variant="outlined"
        size="small"
        fullWidth
      />

      <Divider />

      <Button onClick={(e) => {
          e.stopPropagation(); // click することでこの panel に focus が来てしまうのを防ぐ
          setFocusArea('list');
        }
      } variant="contained" sx={{ mt: 2 }}>Test</Button>
    </Box>
  )};


  return (
    <Box
      position="relative"
      width="100%"
      height="100vh"
      overflow="hidden"
    >
      {/* List Window */}
      <Paper
        tabIndex={0}
        onFocus={() => setFocusArea('list')}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: isMobile ? '100%' : '50%',
          height: '100%',
          transform: isMobile
            ? focusArea === 'list'
              ? 'translateX(0%)'
              : 'translateX(-10%)'
            : 'none',
          transition: 'transform 0.3s ease',
          // zIndex: focusArea === 'list' ? 1 : 2,
        }}
      >
        {/* List content */}
        <TodoList />
      </Paper>

      {/* Chat Window */}
      <Paper
        tabIndex={0}
        onFocus={() => setFocusArea('chat')}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: isMobile ? '90%' : '50%',
          height: '100%',
          transform: isMobile
            ? focusArea === 'chat'
              ? 'translateX(10%)'
              : 'translateX(110%)'
            : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          // zIndex: focusArea === 'chat' ? 2 : 1,
        }}
      >
        {/* Chat content */}
        <ChatInterface onTaskCreated={handleTaskCreated} />
      </Paper>
    </Box>
  );

  
};

export default App;

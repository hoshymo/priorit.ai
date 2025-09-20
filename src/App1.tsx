import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { useSwipeable } from 'react-swipeable';
import { UserContext } from "./Usercontext";
import { saveTasks, loadTasks, DEFAULT_USERPRIORITY } from "./task";
import { LoginButton } from "./loginbutton";
import { useMediaQuery } from "@mui/material"
import { keyframes, styled, useTheme } from '@mui/material/styles';
import { Box, Card, Button, Divider, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, TextField, Typography, Collapse, Paper, Tooltip } from '@mui/material';
import { ChatIcon, CheckIcon, DeleteIcon, EditIcon, ScheduleIcon, SettingsIcon, InfoIcon, RecyclingIcon, ThumbUpIcon, ThumbDownIcon, HistoryIcon } from './import-mui';
import { ThemeContext } from './ThemeContext';
import ChatInterface from "./components/ChatInterface";
import { Task } from "./types";
import { useSnackbar } from 'notistack';
import EditModal from './EditModal'; 


// const BE_DOMAIN = window.location.hostname === "hoshymo.github.io" ? "https://backend-1064199407438.asia-northeast1.run.app" : "http://localhost:3001";
const BE_DOMAIN = (import.meta.env.VITE_BE_DOMAIN as string) ?? "http://localhost:3001";

// 既存のデータ変換ロジック
const fixTaskArray = (arr: any[]): Task[] =>
  arr.map((t: any, index: number) => ({
    id: t.id || `${Date.now()}-${index}`,
    task: t.task,
    aiPriority:  t.aiPriority || DEFAULT_USERPRIORITY, // ← 互換性のための修正
    userPriority: t.userPriority, // ← userPriorityを読み込む
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
// useEffect(() => { // TODO 消す
//   console.log("focusAreaが変更されました:", focusArea);
// }, [focusArea]);
  const todoTasks = tasks.filter(t => t.status === 'todo');

  const { enqueueSnackbar } = useSnackbar(); // ★ Snackbar用のhookを呼び出し
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [suggestionComment, setSuggestionComment] = useState<string | null>(null); // ← 新しく追加
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  const pulseGlow = keyframes`
  0% { box-shadow: 0 0 5px 2px rgba(25, 118, 210, 0.4); }
  50% { box-shadow: 0 0 15px 5px rgba(25, 118, 210, 0.8); }
  100% { box-shadow: 0 0 5px 2px rgba(25, 118, 210, 0.4); }
`;
  const SUGGESTION_TTL_MS = 5 * 60 * 1000;

  useEffect(() => {
    if(!user){
      setTasks([]);
      return;
    }

    const fetchTasksAndSuggestion = async () => {
      try {
        const taskData = await loadTasks(user.uid);
        const loadedTasks = fixTaskArray(taskData || []);
        setTasks(loadedTasks);

        const { getFirestore, doc, getDoc } = await import("firebase/firestore");
        const db = getFirestore();
        const userSettingsRef = doc(db, 'userSettings', user.uid);
        const docSnap = await getDoc(userSettingsRef);
        let systemPrompt: string | null = null;
        if (docSnap.exists() && docSnap.data().systemPrompt) {
          systemPrompt = docSnap.data().systemPrompt;
        }

        const lastFetchedRaw = localStorage.getItem('lastSuggestionFetchedAt');
        const lastFetched = lastFetchedRaw ? Number(lastFetchedRaw) : 0;
        const isExpired = Date.now() - lastFetched > SUGGESTION_TTL_MS;

        const isNewUserWithoutWelcome = loadedTasks.length === 0 && !localStorage.getItem('welcomeMessageShown');
        const isExistingUserWithExpiredCache = loadedTasks.length > 0 && isExpired;
        if (isNewUserWithoutWelcome || isExistingUserWithExpiredCache) {
          const idtoken = await user.getIdToken();
          const response = await fetch(`${BE_DOMAIN}/api/suggest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idtoken}` },
            body: JSON.stringify({
              tasks: loadedTasks.filter(t => t.status === 'todo'),
              systemPrompt: systemPrompt,
            }),
          });
          if (!response.ok) throw new Error('サジェストの取得に失敗');
          const suggestion = await response.json();
          if (suggestion.comment) {
            setSuggestionComment(suggestion.comment);
            setHighlightedTaskId(suggestion.suggestedTaskId);
            setShowSuggestionModal(true);
            if (isNewUserWithoutWelcome) {
              localStorage.setItem('welcomeMessageShown', 'true');
            }
            if (isExistingUserWithExpiredCache) {
              localStorage.setItem('lastSuggestionFetchedAt', String(Date.now()));
            }
          }
        }
      } catch (error) {
        console.error("サジェスト機能のエラー:", error);
      }
    };
    fetchTasksAndSuggestion();
  }, [user]);

  // --- タスク追加時のaiPriorityをデフォルト値に設定 ---
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

  const handleTaskUpdated = async (updatedTaskData: Partial<Task> & { id: string }) => {
    if (!user) return;
    const newTasks = tasks.map(task => {
      if (task.id === updatedTaskData.id) {
        // スプレッド構文で既存のタスク情報に更新情報をマージ
        return { ...task, ...updatedTaskData };
      }
      return task;
    });
    setTasks(newTasks);
    await saveTasks(user.uid, newTasks);
  };

  const handleTasksUpdated = async (updatedTodoList: Task[]) => {
    if (!user) return;

    // バックエンドから返されたToDoタスクリストを取得
    // このリストには、新しいタスク（仮のID）と、優先度が調整された既存タスクが含まれる
    const finalTodoList = updatedTodoList.map(task => {
        if (task.id.startsWith('temp-')) {
        // 仮のIDを、ユニークな新しいIDに置き換える
        return { ...task, id: Date.now().toString() + Math.random().toString(36).substring(2, 9) };
        }
        return task;
    });

    // 既存の完了済みタスクを取得
    const doneTasks = tasks.filter(t => t.status === 'done');
    
    // 調整後のToDoタスクリストと、完了済みタスクを結合して、新しい全体のタスクリストを作成
    const newFullTaskList = [...finalTodoList, ...doneTasks];
    
    setTasks(newFullTaskList);
    await saveTasks(user.uid, newFullTaskList);
  };

  const handleAddTaskFromModal = async () => {
    if (!user || !transcript.trim()) return;
    const newTask: Task = {
      id: Date.now().toString(),
      task: transcript.trim(),
      aiPriority: 50, // ← aiPriorityとして追加
      // priority: 'medium', // 優先度（high/medium/low）
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

  const handleUpdateTask = async (updatedTaskData: { id: string; task: string; userPriority?: number }) => {
    if (!user) return;
    const newTasks = tasks.map(task => {
      if (task.id === updatedTaskData.id) {
        // スプレッド構文で既存のタスク情報に更新情報をマージ
        return { ...task, ...updatedTaskData };
      }
      return task;
    });
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

    // 現在の優先度を取得。未設定(null or undefined)の場合はデフォルト値を基準にする
    const currentPriority = editingTask.userPriority ?? DEFAULT_USERPRIORITY;

    // stateを更新
    setEditingTask({ ...editingTask, userPriority: currentPriority + adjustment });
  };

  const handleUserPriorityOnCard = async (taskId: string, adjustment: number) => {
    if (!user) return;
    
    const newTasks = tasks.map(task => {
      // IDが一致するタスクを見つけたら、優先度を更新
      if (task.id === taskId) {
        const currentPriority = task.userPriority ?? DEFAULT_USERPRIORITY;
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

  const GlowingCard = styled(Card)(({ theme }) => ({
  animation: `${pulseGlow} 1.5s 4`,
  }));

  const swipeHandlers = useSwipeable({
      onSwiped: (eventData) => {
        // console.log("User Swiped!", eventData.dir);
        if (eventData.dir === 'Right')
          setFocusArea(focusArea == 'chat' ? 'list' : 'chat');
      }
  });


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
      const suggestedTask = highlightedTaskId 
      ? tasks.find(t => t.id === highlightedTaskId) 
      : null;
    return (
    <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        // alignItems: 'center',
        maxHeight: '100%',
        width: '100%'
      }}
    >

      <Dialog open={showSuggestionModal} onClose={() => setShowSuggestionModal(false)}>
        {/* <DialogTitle>今日はこのタスクを先に進めると、一番効果的かも！</DialogTitle> */}
        <DialogContent>
          <Typography variant="body1">
            {suggestionComment}
          </Typography>

          {suggestedTask && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2, borderColor: 'primary.main' }}>
              <Typography variant="h6" component="div">
                {suggestedTask.task}
              </Typography>
              {/* 必要であれば他のタスク情報もここに追加できます */}
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          {/* ハイライトボタン（任意） */}
          <Button onClick={() => {
            setShowSuggestionModal(false);
            setHighlightedTaskId(null); // ハイライトを解除
          }} color="secondary">
            閉じる
          </Button>
        </DialogActions>
      </Dialog>
        <Box sx={{ width: '96%', display: 'grid', gap:1 }}>

            {(() => {
            // 事前にソート済みのタスク配列を準備
            const sortedTasks = todoTasks
                .slice()
                .sort((a, b) => {
                const userPriorityA = a.userPriority || DEFAULT_USERPRIORITY;
                const userPriorityB = b.userPriority || DEFAULT_USERPRIORITY;
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
              padding: theme.spacing(1),
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
                // padding: '4px',
                background: 'conic-gradient(red, orange, indigo, violet, red)',
                // background: 'conic-gradient(red, orange, yellow, green, blue, indigo, violet, red)',
                animation: `${rainbowSpin} 12s linear infinite`,
                zIndex: -1,
              },
              // 枠の内側に白背景を重ねて中身を静止させるA
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
            const TaskCard = (t: Task) => {
                    const CardWrapper = (t.aiPriority + (t.userPriority ?? 0)) > 80 ? AnimatedCard : 
                      t.id === highlightedTaskId ? GlowingCard : Card;
                    return (
                    <CardWrapper key={t.id}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" component="div">
                                {t.task}
                            </Typography>
                            </Box>

                        </CardContent>

                            {/* <Typography variant="body2" color="text.secondary" component="div">
                                {t.dueDate}
                            </Typography> */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                {/* 理由表示用ツールチップ */}
                                {t.reason && (
                                  <Tooltip title={t.reason}>
                                    <IconButton size="small">
                                      <InfoIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* 期限表示用ツールチップ */}
                                {t.dueDate && (
                                  <Tooltip title={t.dueDate}>
                                    <IconButton size="small">
                                      <ScheduleIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {/* 直接ここに表示するには見た目の調整が必要 */}
                                {/* { t.dueDate } */}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                              <IconButton size="small" onClick={() => handleUserPriorityOnCard(t.id, -10)}>
                                <ThumbDownIcon fontSize="small" sx={{ mr: 2, color: (theme) => t.userPriority ? theme.palette.error.main : theme.palette.action.disabled }}/>
                              </IconButton>
                              {/* 優先度合計値。ちょっと冗長だが、number 型なのに string が入っていることがあるようで editor での警告表示除去対策もありこの表記に。 */}
                              {(typeof t.aiPriority === 'string' ? parseInt(t.aiPriority) : t.aiPriority) + (t.userPriority ?? DEFAULT_USERPRIORITY)}
                              <IconButton size="small" onClick={() => handleUserPriorityOnCard(t.id, 10)}>
                                <ThumbUpIcon fontSize="small" sx={{ ml: 2, color: (theme) => t.userPriority ? theme.palette.info.main : theme.palette.action.disabled }} />
                              </IconButton>
                            </Typography>
                            <Box>
                              <IconButton onClick={() => handleOpenEditModal(t)} color="default" size="small"><EditIcon /></IconButton>
                              <IconButton onClick={() => handleToggleTaskStatus(t.id)} color="success" size="small"><CheckIcon /></IconButton>
                              {/* いきなり削除はしなくていいかな。まずは done にすることにしよう */}
                              {/* <IconButton onClick={() => handleDeleteTask(t.id)} color="warning" size="small"><DeleteIcon /></IconButton> */}
                            </Box>
                        </Box>
                  </CardWrapper>
                  );
            }

            return (
                <>
                {/* --- TOP3タスクの表示 --- */}
                {topTasks.map((t) => TaskCard(t))}

                {/* --- 4件目以降のタスクをCollapseで囲む --- */}
                {remainingTasks.length > 0 && (
                    <>
                    <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ width: '100%', display: 'grid', gap: 1 }}>
                        {remainingTasks.map((t) => TaskCard(t))}
                        </Box>

                        {/* --- 開閉ボタン --- */}
                        <Button 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            fullWidth 
                            sx={{ mt: 1, mb: 10 }}
                        >
                            閉じる
                        </Button>
                    </Collapse>
                    
                    {/* --- 開閉ボタン --- */}
                    {!isExpanded && (
                    <Button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        fullWidth 
                        sx={{ mt: 1 }}
                    >
                        残り {remainingTasks.length}件を見る
                    </Button>
                    )}
                    </>
                )}
                </>
            );
            })()}

          {/* <Button onClick={handleRank} disabled={tasks.length === 0 || loading} variant="contained" color="primary" sx={{ my: 2, width: '100%' }}>
            {loading ? "Geminiが優先順位付け中..." : "LLMで優先順位を付ける"}
          </Button> */}

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

          <Box>
            {/* 既存の編集モーダルは削除し、以下のコンポーネントに置き換える */}
            {editingTask && (
              <EditModal
                open={openEditModal}
                task={editingTask}
                onClose={handleCloseEditModal}
                onUpdate={handleUpdateTask}
              />
            )}
          </Box>

        <Dialog open={openHistoryModal} onClose={() => setOpenHistoryModal(false)} fullWidth scroll="paper">
        <DialogTitle>完了したタスクの履歴</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
            {tasks
              .filter(t => t.status === 'done') // 完了タスクのみフィルタリング
              .map((t) => (
                <Card key={t.id} sx={{ opacity: 0.8 }}>
                  <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ textDecoration: 'line-through' }}>
                        {t.task}
                      </Typography>
                      <Box sx={{ minWidth: 10, display: 'flex', gap: 0, justifyContent: 'flex-end' }}>
                        <IconButton onClick={() => handleToggleTaskStatus(t.id)} color="info" size="small">
                          <RecyclingIcon />
                        </IconButton>
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
      height="100dvh"
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
          height: '100dvh',
          overflow: 'auto',
          pt: 1,
          pb: 1,
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

      {/* --- 右下固定ボタン --- */}
      {focusArea === 'list' && (
      <Box sx={{ position: 'fixed', bottom: 20, right: isMobile ? 20 : '52%', zIndex: 1000, display: 'flex', gap: 1, alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/settings')} color="primary" size="small" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <SettingsIcon />
        </IconButton>
        <IconButton onClick={() => setOpenHistoryModal(true)} color="primary" size="small" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <HistoryIcon />
        </IconButton>
      {/* --- 音声入力開始ボタン --- チャットモードでは非表示 */}
      {!showChat && (
        <IconButton onClick={handleOpenMicModal} color="primary" size="large" sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: theme.palette.action.hover }}}>
          <ChatIcon fontSize="large" />
        </IconButton>
      )}
      </Box>
      )}

      {/* Chat Window */}
      <Paper
        {...swipeHandlers}
        tabIndex={0}
        onFocus={() => setFocusArea('chat')}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: isMobile ? '90%' : '50%',
          height: '100dvh',
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
        <ChatInterface 
          tasks={tasks} 
          onTaskUpdated={handleTaskUpdated} // ← Step3で作成
          onTasksUpdated={handleTasksUpdated}
        />      </Paper>
    </Box>
  );

  
};

export default App;

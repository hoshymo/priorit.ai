// 既存のタスクモデルを拡張
export type Task = {
  id: string;
  task: string;
  aiPriority: number;     // 既存
  userPriority?: number;  // 既存
  
  // 新規追加フィールド
  dueDate?: string;       // ISO形式または相対表現文字列
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'done';
  reason?: string;        // AIによる優先度の理由
  tags?: string[];        // 抽出されたタグ
};

// チャットメッセージ型
export type ChatMessage = {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestedTask?: Partial<Task>; // AIが提案したタスク情報
  options?: string[];            // 選択肢（あれば）
  
};

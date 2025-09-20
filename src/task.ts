import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

export const DEFAULT_USERPRIORITY: number = 0;

// タスク保存
export async function saveTasks(userId: string, tasks: any[]) {
  // Firestoreに保存する前に、undefinedの値をnullに変換する
  const tasksToSave = tasks.map(task => {
    // オブジェクトの各キーをループして、値がundefinedならnullに置き換える
    const sanitizedTask = Object.fromEntries(
      Object.entries(task).map(([key, value]) => [key, value === undefined ? null : value])
    );
    return sanitizedTask;
  });

  try {
    // 変換後のデータを { list: ... } の形式で保存
    await setDoc(doc(db, "tasks", userId), { list: tasksToSave });
  } catch (error) {
    // エラー発生時に、どのデータが問題だったかログに出力するとデバッグしやすい
    console.error("Error saving tasks:", error);
    console.error("Data that caused the error:", tasksToSave);
  }
}

// タスク取得 (この関数は変更不要です)
export async function loadTasks(userId: string): Promise<any[]> {
  try {
    const snap = await getDoc(doc(db, "tasks", userId));
    return snap.exists() ? snap.data().list : [];
  } catch (error) {
    console.error("Error loading tasks:", error);
    return []; // エラー時は空の配列を返す
  }
}
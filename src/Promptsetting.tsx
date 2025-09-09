import { db } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// デフォルトのシステムプロンプト
const DEFAULT_SYSTEM_PROMPT = "あなたは優秀なタスク管理アシスタントです。ユーザーのタスク管理を効率的にサポートしてください。";

/**
 * ユーザーのシステムプロンプトをFirestoreから読み込む
 * @param userId ユーザーID
 * @returns 保存されているプロンプト。なければデフォルト値を返す。
 */
export async function loadSystemPrompt(userId: string): Promise<string> {
  try {
    const docRef = doc(db, "userSettings", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists() && docSnap.data().systemPrompt) {
      return docSnap.data().systemPrompt;
    } else {
      return DEFAULT_SYSTEM_PROMPT; // 保存されたものがなければデフォルトを返す
    }
  } catch (error) {
    console.error("Error loading system prompt:", error);
    return DEFAULT_SYSTEM_PROMPT; // エラー時もデフォルトを返す
  }
}

/**
 * ユーザーのシステムプロンプトをFirestoreに保存する
 * @param userId ユーザーID
 * @param prompt 保存するプロンプト文字列
 */
export async function saveSystemPrompt(userId: string, prompt: string): Promise<void> {
  try {
    const docRef = doc(db, "userSettings", userId);
    await setDoc(docRef, { systemPrompt: prompt }, { merge: true }); // merge: trueで他の設定を上書きしない
  } catch (error) {
    console.error("Error saving system prompt:", error);
    throw error; // エラーを呼び出し元に伝える
  }
}
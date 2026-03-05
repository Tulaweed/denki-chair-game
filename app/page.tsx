"use client";

import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "Firebaseコンソールの『プロジェクト設定』にあるAPIキー",
  authDomain: "denki-chair-game.firebaseapp.com",
  databaseURL: "https://denki-chair-game-default-rtdb.firebaseio.com/", // ←これ！
  projectId: "denki-chair-game",
  storageBucket: "denki-chair-game.appspot.com",
  messagingSenderId: "あなたの送信者ID",
  appId: "あなたのアプリID"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const gameRef = ref(db, 'denki-chair/room1'); // 同一URLで対戦するためのパス

// --- 定数 ---
const TOTAL_CHAIRS = 12;
const MAX_ROUNDS = 8;
const WINNING_SCORE = 40;
const RADIUS = 140;

export default function DenkiChairOnline() {
  const [myRole, setMyRole] = useState<'A' | 'B' | null>(null);
  const [gameState, setGameState] = useState<any>(null); // DBから取得する全データ

  // 1. DBのリアルタイム監視
  useEffect(() => {
    return onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
  }, []);

  // 2. プレイヤー登録
  const entry = (role: 'A' | 'B') => {
    setMyRole(role);
    if (!gameState) {
      // 初期データ作成
      const initialData = {
        phase: 'CHOOSING_ORDER',
        round: 1,
        attackerSide: 'A',
        removedChairs: [],
        trap: null,
        defenderChoice: null,
        scores: { A: 0, B: 0 },
        shocks: { A: 0, B: 0 },
        historyA: Array(MAX_ROUNDS).fill(null),
        historyB: Array(MAX_ROUNDS).fill(null),
        names: { A: "", B: "" }
      };
      set(gameRef, initialData);
    }
  };

  if (!myRole || !gameState) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-5xl font-black text-red-600 mb-10 italic">電気イス ONLINE</h1>
        <div className="flex gap-4">
          <button onClick={() => entry('A')} className="p-8 bg-zinc-900 border-2 border-red-600 rounded-xl text-2xl font-bold">1Pで参戦</button>
          <button onClick={() => entry('B')} className="p-8 bg-zinc-900 border-2 border-blue-600 rounded-xl text-2xl font-bold">2Pで参戦</button>
        </div>
      </div>
    );
  }

  // 便利変数
  const isAttacker = myRole === gameState.attackerSide;
  const defenderSide = gameState.attackerSide === 'A' ? 'B' : 'A';
  const isDefender = myRole === defenderSide;

  // --- DB更新関数 ---
  const updateDB = (updates: any) => update(gameRef, updates);

  const handleChairClick = (index: number) => {
    if (gameState.phase === 'SETUP' && isAttacker) {
      updateDB({ trap: index });
    } else if (gameState.phase === 'BATTLE' && isDefender) {
      updateDB({ defenderChoice: index });
    }
  };

  const fireShock = () => {
    if (gameState.defenderChoice === null) return;
    const isHit = gameState.trap === gameState.defenderChoice;
    const points = gameState.defenderChoice + 1;
    
    let newScores = { ...gameState.scores };
    let newShocks = { ...gameState.shocks };
    let newHistory = gameState[defenderSide === 'A' ? 'historyA' : 'historyB'];
    let newRemoved = gameState.removedChairs || [];

    if (isHit) {
      newScores[defenderSide] = 0;
      newShocks[defenderSide] += 1;
      newHistory[gameState.round - 1] = '●';
    } else {
      newScores[defenderSide] += points;
      newHistory[gameState.round - 1] = points;
      newRemoved.push(gameState.defenderChoice);
    }

    updateDB({
      scores: newScores,
      shocks: newShocks,
      [defenderSide === 'A' ? 'historyA' : 'historyB']: newHistory,
      removedChairs: newRemoved,
      phase: 'RESULT'
    });
  };

  const nextTurn = () => {
    const isRoundEnd = gameState.attackerSide === (gameState.historyA[0] === null ? 'B' : 'A');
    updateDB({
      round: isRoundEnd ? gameState.round + 1 : gameState.round,
      attackerSide: defenderSide,
      trap: null,
      defenderChoice: null,
      phase: 'SETUP'
    });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 font-mono select-none">
      {/* スコアボード (前回と同じ構造) */}
      <div className="max-w-2xl mx-auto bg-black border-2 border-zinc-700 mb-6">
        <div className="flex justify-between px-4 py-2 bg-zinc-900 text-[10px] text-zinc-500 italic">
          <span>YOU ARE: PLAYER {myRole}</span>
          <span>ROUND: {gameState.round}</span>
        </div>
        <table className="w-full text-center">
          <tbody className="text-lg font-black italic">
            <tr className="border-b border-zinc-800">
              <td className="w-20 text-[10px] border-r border-zinc-700">PLAYER A</td>
              {gameState.historyA.map((h:any, i:number) => <td key={i} className="text-sm text-yellow-500 w-8">{h}</td>)}
              <td className="bg-zinc-900 text-yellow-500 w-12">{gameState.scores.A}</td>
            </tr>
            <tr>
              <td className="w-20 text-[10px] border-r border-zinc-700">PLAYER B</td>
              {gameState.historyB.map((h:any, i:number) => <td key={i} className="text-sm text-yellow-500 w-8">{h}</td>)}
              <td className="bg-zinc-900 text-yellow-500 w-12">{gameState.scores.B}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center">
        {/* 円形ステージ */}
        <div className="relative w-[300px] h-[300px] flex items-center justify-center my-4">
          {Array.from({ length: TOTAL_CHAIRS }).map((_, i) => {
            const angle = (i * 360) / TOTAL_CHAIRS;
            const x = RADIUS * Math.cos((angle - 90) * (Math.PI / 180));
            const y = RADIUS * Math.sin((angle - 90) * (Math.PI / 180));
            const isRemoved = (gameState.removedChairs || []).includes(i);

            // 重要なロジック：罠(trap)は仕掛けた本人か、結果発表時しか見えない
            const showTrap = (isAttacker && gameState.phase === 'SETUP') || gameState.phase === 'RESULT';
            
            let style = "bg-zinc-900 border-zinc-800 text-zinc-600";
            if (!isRemoved) {
              if (showTrap && gameState.trap === i) style = "bg-red-950 border-red-500 text-white animate-pulse";
              if (gameState.defenderChoice === i) style = "bg-blue-600 border-white text-white ring-4 ring-blue-500/50 scale-110 z-10";
              if (gameState.phase === 'RESULT' && gameState.trap === i) style = "bg-yellow-400 border-white text-black scale-125 z-20 shadow-[0_0_30px_yellow]";
            }

            return (
              <button key={i} onClick={() => handleChairClick(i)} 
                className={`absolute w-12 h-12 rounded-sm border flex items-center justify-center font-black transition-all ${isRemoved ? 'opacity-0 scale-0' : ''} ${style}`}
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                {i + 1}
              </button>
            );
          })}
          <div className={`text-sm font-black text-white px-4 py-1 skew-x-[-15deg] ${isAttacker ? 'bg-red-700' : 'bg-blue-700'}`}>
            {isAttacker ? 'ATTACKER' : 'DEFENDER'}
          </div>
        </div>

        {/* ボタン操作 */}
        <div className="mt-8 w-full max-w-sm bg-zinc-900 p-6 rounded border border-zinc-800 shadow-2xl">
          <div className="h-12 flex items-center justify-center mb-4 text-sm font-bold text-zinc-300">
            {gameState.phase === 'SETUP' && (isAttacker ? "罠を仕掛けろ" : "相手が仕掛け中...")}
            {gameState.phase === 'BATTLE' && (isDefender ? "椅子を選べ（移動自由）" : "相手が悩み中...放電ボタンに指をかけろ")}
            {gameState.phase === 'RESULT' && (gameState.trap === gameState.defenderChoice ? "⚡️ SHOCK ⚡️" : "SAFE")}
          </div>

          {gameState.phase === 'SETUP' && isAttacker && (
            <button onClick={() => updateDB({ phase: 'BATTLE' })} disabled={gameState.trap === null} className="w-full py-4 bg-red-700 font-black text-xl">SET完了</button>
          )}

          {gameState.phase === 'BATTLE' && isAttacker && (
            <button onClick={fireShock} disabled={gameState.defenderChoice === null} className="w-full py-6 bg-red-600 font-black text-3xl rounded-full border-8 border-red-900 animate-pulse">放電</button>
          )}

          {gameState.phase === 'RESULT' && (
            <button onClick={nextTurn} className="w-full py-4 bg-yellow-500 text-black font-black text-xl">NEXT ROUND</button>
          )}
        </div>
      </div>
    </div>
  );
}
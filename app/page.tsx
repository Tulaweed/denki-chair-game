"use client";

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';

// --- Firebase 設定 (必ずご自身のコンソールの値に書き換えてください) ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://denki-chair-game-default-rtdb.firebaseio.com/", // ←確認したもの
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 二重初期化防止
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const gameRef = ref(db, 'denki-chair/room1');

// --- 定数 ---
const TOTAL_CHAIRS = 12;
const MAX_ROUNDS = 8;
const WINNING_SCORE = 40;
const RADIUS = 140;

export default function DenkiChairOnline() {
  const [myRole, setMyRole] = useState<'A' | 'B' | null>(null);
  const [gameState, setGameState] = useState<any>(null);

  // 1. データベースの同期
  useEffect(() => {
    return onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
  }, []);

  // 2. エントリー処理
  const entry = (role: 'A' | 'B') => {
    setMyRole(role);
    if (!gameState) {
      const initialData = {
        phase: 'CHOOSING_ORDER',
        round: 1,
        attackerSide: 'A', // 後攻(罠設置)
        removedChairs: [99], // 初期化用ダミー
        trap: null,
        defenderChoice: null,
        scores: { A: 0, B: 0 },
        shocks: { A: 0, B: 0 },
        historyA: Array(MAX_ROUNDS).fill(null),
        historyB: Array(MAX_ROUNDS).fill(null),
        names: { A: "PLAYER A", B: "PLAYER B" }
      };
      set(gameRef, initialData);
    }
  };

  if (!myRole || !gameState) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans">
        <h1 className="text-5xl font-black italic text-red-600 mb-12 tracking-tighter">電気イス</h1>
        <div className="flex flex-col gap-6 w-full max-w-xs">
          <button onClick={() => entry('A')} className="py-8 bg-zinc-900 border-2 border-red-600 rounded-lg text-2xl font-bold hover:bg-red-950 transition">1P</button>
          <button onClick={() => entry('B')} className="py-8 bg-zinc-900 border-2 border-blue-600 rounded-lg text-2xl font-bold hover:bg-blue-950 transition">2P</button>
        </div>
      </div>
    );
  }

  // 便利変数
  const isAttacker = myRole === gameState.attackerSide; // 罠を仕掛ける側
  const defenderSide = gameState.attackerSide === 'A' ? 'B' : 'A'; // 椅子に座る側
  const isDefender = myRole === defenderSide;

  // DB更新用
  const updateDB = (updates: any) => update(gameRef, updates);

  // 椅子クリック
  const handleChairClick = (index: number) => {
    if (gameState.phase === 'SETUP' && isAttacker) {
      updateDB({ trap: index });
    } else if (gameState.phase === 'BATTLE' && isDefender) {
      updateDB({ defenderChoice: index });
    }
  };

  // 先攻後攻決定
  const setOrder = (firstDefender: 'A' | 'B') => {
    updateDB({ 
      attackerSide: firstDefender === 'A' ? 'B' : 'A', 
      phase: 'SETUP' 
    });
  };

  // 放電実行
  const fireShock = () => {
    if (gameState.defenderChoice === null) return;
    const isHit = gameState.trap === gameState.defenderChoice;
    const points = gameState.defenderChoice + 1;
    
    let newScores = { ...gameState.scores };
    let newShocks = { ...gameState.shocks };
    let newHistory = [...gameState[defenderSide === 'A' ? 'historyA' : 'historyB']];
    let newRemoved = [...(gameState.removedChairs || [])];

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

  // 次のターンへ
  const nextTurn = () => {
    // 勝利判定
    if (gameState.scores.A >= WINNING_SCORE || gameState.shocks.B >= 3 || gameState.scores.B >= WINNING_SCORE || gameState.shocks.A >= 3) {
      updateDB({ phase: 'GAMEOVER' });
      return;
    }

    const isRoundEnd = gameState.attackerSide === (gameState.historyA[0] === null ? 'B' : 'A');
    updateDB({
      round: isRoundEnd ? gameState.round + 1 : gameState.round,
      attackerSide: defenderSide,
      trap: null,
      defenderChoice: null,
      phase: 'SETUP'
    });
  };

  // --- UI画面判定 ---

  if (gameState.phase === 'CHOOSING_ORDER') {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl font-bold mb-8 text-yellow-500 italic uppercase">Order Decision</h2>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button onClick={() => setOrder('A')} className="py-6 bg-white text-black font-black text-xl skew-x-[-10deg]">1P</button>
          <button onClick={() => setOrder('B')} className="py-6 bg-white text-black font-black text-xl skew-x-[-10deg]">2P</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 font-mono select-none overflow-x-hidden">
      {/* スコアボード */}
      <div className="max-w-2xl mx-auto bg-black border-2 border-zinc-700 mb-6 shadow-2xl">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr className="bg-zinc-900 text-[10px] text-zinc-500 border-b border-zinc-700">
              <th className="py-2 border-r border-zinc-700 w-20 italic">Player</th>
              {[...Array(MAX_ROUNDS)].map((_, i) => (
                <th key={i} className={`border-r border-zinc-700 w-8 ${gameState.round === i+1 ? 'text-yellow-500 bg-zinc-800' : ''}`}>{i + 1}</th>
              ))}
              <th className="bg-red-950 text-red-500 w-10 text-xs font-black italic uppercase">PT</th>
            </tr>
          </thead>
          <tbody className="text-lg font-black italic">
            <tr className="border-b border-zinc-800">
              <td className="text-[10px] border-r border-zinc-700 px-2 truncate">PLAYER A</td>
              {gameState.historyA.map((h: any, i: number) => <td key={i} className="border-r border-zinc-800 text-sm text-yellow-500">{h}</td>)}
              <td className="bg-zinc-900 text-yellow-500 text-2xl">{gameState.scores.A}</td>
            </tr>
            <tr>
              <td className="text-[10px] border-r border-zinc-700 px-2 truncate">PLAYER B</td>
              {historyB_map(gameState)}
              <td className="bg-zinc-900 text-yellow-500 text-2xl">{gameState.scores.B}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center">
        {/* 円形ステージ */}
        <div className="relative w-[320px] h-[320px] flex items-center justify-center my-4">
          {Array.from({ length: TOTAL_CHAIRS }).map((_, i) => {
            const angle = (i * 360) / TOTAL_CHAIRS;
            const x = RADIUS * Math.cos((angle - 90) * (Math.PI / 180));
            const y = RADIUS * Math.sin((angle - 90) * (Math.PI / 180));
            const isRemoved = (gameState.removedChairs || []).includes(i);

            // 罠の可視性ロジック
            const showTrap = (isAttacker && gameState.phase === 'SETUP') || gameState.phase === 'RESULT';
            
            let btnStyle = "bg-zinc-900 border-zinc-800 text-zinc-700";
            if (!isRemoved) {
              if (showTrap && gameState.trap === i) btnStyle = "bg-red-950 border-red-500 text-white animate-pulse shadow-[0_0_15px_red]";
              if (gameState.defenderChoice === i) btnStyle = "bg-blue-600 border-white text-white scale-110 ring-4 ring-blue-500/50 z-10";
              if (gameState.phase === 'RESULT' && gameState.trap === i) btnStyle = "bg-yellow-400 border-white text-black scale-125 z-20 shadow-[0_0_30px_yellow]";
              if (gameState.phase === 'RESULT' && gameState.defenderChoice === i && gameState.trap !== i) btnStyle = "bg-green-600 border-white text-white";
            }

            return (
              <button key={i} onClick={() => !isRemoved && handleChairClick(i)} 
                disabled={isRemoved || gameState.phase === 'RESULT' || (gameState.phase === 'BATTLE' && isAttacker)}
                style={{ transform: `translate(${x}px, ${y}px)` }}
                className={`absolute w-12 h-12 rounded-sm border flex items-center justify-center font-black transition-all duration-300 ${isRemoved ? 'opacity-0 scale-0' : ''} ${btnStyle}`}
              >
                {i + 1}
              </button>
            );
          })}
          <div className={`text-sm font-black text-white px-4 py-1 skew-x-[-15deg] italic shadow-lg ${isAttacker ? 'bg-red-700' : 'bg-blue-700'}`}>
            {isAttacker ? 'ATTACKER' : 'DEFENDER'}
          </div>
        </div>

        {/* コントロールパネル */}
        <div className="mt-8 text-center w-full max-w-sm bg-zinc-900 p-6 rounded-sm border border-zinc-800 shadow-2xl relative">
          <div className="h-16 flex items-center justify-center mb-4">
            <p className="text-sm font-bold text-zinc-300 italic tracking-tighter">
              {gameState.phase === 'SETUP' && (isAttacker ? "罠を仕掛けろ" : "相手が仕掛け中...")}
              {gameState.phase === 'BATTLE' && (isDefender ? "椅子を選べ (移動自由)" : "相手が悩み中... 隙を見て放電せよ")}
              {gameState.phase === 'RESULT' && (gameState.trap === gameState.defenderChoice ? "⚡️⚡️ 感電 ⚡️⚡️" : `SAFE！ +${gameState.defenderChoice! + 1} PT`)}
              {gameState.phase === 'GAMEOVER' && "GAME OVER"}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {gameState.phase === 'SETUP' && isAttacker && (
              <button onClick={() => updateDB({ phase: 'BATTLE' })} disabled={gameState.trap === null} className="py-4 bg-zinc-100 text-black font-black text-xl hover:bg-white transition-all disabled:opacity-20">SET完了</button>
            )}
            {gameState.phase === 'BATTLE' && isAttacker && (
              <button onClick={fireShock} disabled={gameState.defenderChoice === null} className="py-6 bg-red-600 text-white font-black text-3xl rounded-full border-8 border-red-900 shadow-[0_10px_0_rgb(127,29,29)] animate-pulse active:translate-y-2 transition-all">放電</button>
            )}
            {gameState.phase === 'RESULT' && (
              <button onClick={nextTurn} className="py-4 bg-yellow-500 text-black font-black text-xl hover:bg-yellow-400 transition-all">NEXT ROUND</button>
            )}
            {gameState.phase === 'GAMEOVER' && (
              <button onClick={() => window.location.reload()} className="py-4 bg-white text-black font-black text-xl">REMATCH</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 補助：Historyの描画
function historyB_map(gs: any) {
  return gs.historyB.map((h: any, i: number) => <td key={i} className="border-r border-zinc-800 text-sm text-yellow-500">{h}</td>);
}
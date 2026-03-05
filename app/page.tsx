"use client";

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';

// --- Firebase 設定 (必ずご自身のコンソールの値に書き換えてください) ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://denki-chair-game-default-rtdb.firebaseio.com/", 
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 初期化チェック
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const gameRef = ref(db, 'denki-chair/room1');

const TOTAL_CHAIRS = 12;
const MAX_ROUNDS = 8;
const WINNING_SCORE = 40;
const RADIUS = 140;

export default function DenkiChairOnline() {
  const [myRole, setMyRole] = useState<'A' | 'B' | null>(null);
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    return onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameState(data);
    });
  }, []);

  const entry = (role: 'A' | 'B') => {
    setMyRole(role);
    if (!gameState) {
      const initialData = {
        phase: 'CHOOSING_ORDER',
        round: 1,
        attackerSide: 'A',
        removedChairs: [99],
        trap: null,
        defenderChoice: null,
        scores: { A: 0, B: 0 },
        shocks: { A: 0, B: 0 },
        historyA: Array(MAX_ROUNDS).fill(null),
        historyB: Array(MAX_ROUNDS).fill(null)
      };
      set(gameRef, initialData);
    }
  };

  if (!myRole || !gameState) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-black italic text-red-600 mb-10">電気イスゲーム</h1>
        <div className="flex flex-col gap-4 w-64">
          <button onClick={() => entry('A')} className="py-6 bg-zinc-900 border-2 border-red-600 rounded font-bold">1P</button>
          <button onClick={() => entry('B')} className="py-6 bg-zinc-900 border-2 border-blue-600 rounded font-bold">2P</button>
        </div>
      </div>
    );
  }

  const isAttacker = myRole === gameState.attackerSide;
  const defenderSide = gameState.attackerSide === 'A' ? 'B' : 'A';
  const isDefender = myRole === defenderSide;

  const updateDB = (updates: any) => update(gameRef, updates);

  const handleChairClick = (index: number) => {
    if (gameState.phase === 'SETUP' && isAttacker) updateDB({ trap: index });
    else if (gameState.phase === 'BATTLE' && isDefender) updateDB({ defenderChoice: index });
  };

  const fireShock = () => {
    if (gameState.defenderChoice === null) return;
    const isHit = gameState.trap === gameState.defenderChoice;
    const points = gameState.defenderChoice + 1;
    
    let newScores = { ...gameState.scores };
    let newShocks = { ...gameState.shocks };
    let sideKey = defenderSide === 'A' ? 'historyA' : 'historyB';
    let newHistory = [...gameState[sideKey]];
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
      [sideKey]: newHistory,
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

  if (gameState.phase === 'CHOOSING_ORDER') {
    return (
      <div className="min-h-screen bg-stone-950 text-white flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold mb-6 text-yellow-500 italic">順番を選択</h2>
        <div className="flex flex-col gap-4 w-64">
          <button onClick={() => updateDB({ attackerSide: 'B', phase: 'SETUP' })} className="py-4 bg-white text-black font-black">1Pが先攻</button>
          <button onClick={() => updateDB({ attackerSide: 'A', phase: 'SETUP' })} className="py-4 bg-white text-black font-black">2Pが先攻</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-white p-2 font-mono">
      {/* スコアボード */}
      <div className="max-w-md mx-auto bg-black border border-zinc-700 mb-4 overflow-x-auto">
        <table className="w-full text-center text-xs">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500">
              <th className="p-1 border-r border-zinc-800 italic">PL</th>
              {[...Array(MAX_ROUNDS)].map((_, i) => <th key={i} className="border-r border-zinc-800">{i+1}</th>)}
              <th className="text-red-500">PT</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-zinc-800">
              <td className="border-r border-zinc-800">A</td>
              {gameState.historyA.map((h:any, i:number) => <td key={i} className="border-r border-zinc-800 text-yellow-500">{h}</td>)}
              <td className="text-yellow-500 font-bold">{gameState.scores.A}</td>
            </tr>
            <tr className="border-t border-zinc-800">
              <td className="border-r border-zinc-800">B</td>
              {gameState.historyB.map((h:any, i:number) => <td key={i} className="border-r border-zinc-800 text-yellow-500">{h}</td>)}
              <td className="text-yellow-500 font-bold">{gameState.scores.B}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center">
        <div className="relative w-64 h-64 flex items-center justify-center my-8">
          {Array.from({ length: TOTAL_CHAIRS }).map((_, i) => {
            const angle = (i * 360) / TOTAL_CHAIRS;
            const x = RADIUS * 0.8 * Math.cos((angle - 90) * (Math.PI / 180));
            const y = RADIUS * 0.8 * Math.sin((angle - 90) * (Math.PI / 180));
            const isRemoved = (gameState.removedChairs || []).includes(i);
            const showTrap = (isAttacker && gameState.phase === 'SETUP') || gameState.phase === 'RESULT';
            
            let btnClass = "bg-zinc-900 border-zinc-800 text-zinc-600";
            if (!isRemoved) {
              if (showTrap && gameState.trap === i) btnClass = "bg-red-900 border-red-500 text-white animate-pulse";
              if (gameState.defenderChoice === i) btnClass = "bg-blue-600 border-white text-white ring-2 ring-white scale-110";
              if (gameState.phase === 'RESULT' && gameState.trap === i) btnClass = "bg-yellow-400 border-white text-black scale-125 z-10 shadow-[0_0_20px_yellow]";
            }

            return (
              <button key={i} onClick={() => !isRemoved && handleChairClick(i)} 
                disabled={isRemoved || gameState.phase === 'RESULT'}
                className={`absolute w-10 h-10 rounded border flex items-center justify-center font-bold text-sm transition-all ${isRemoved ? 'opacity-0 scale-0' : ''} ${btnClass}`}
                style={{ transform: `translate(${x}px, ${y}px)` }}
              >
                {i + 1}
              </button>
            );
          })}
          <div className={`px-3 py-1 text-xs font-bold ${isAttacker ? 'bg-red-700' : 'bg-blue-700'}`}>
            {isAttacker ? 'ATTACKER' : 'DEFENDER'}
          </div>
        </div>

        <div className="w-full max-w-xs bg-zinc-900 p-4 border border-zinc-800 text-center">
          <div className="h-12 mb-4 flex items-center justify-center text-xs text-zinc-300 italic">
            {gameState.phase === 'SETUP' && (isAttacker ? "罠を仕掛けよ" : "相手が仕掛け中...")}
            {gameState.phase === 'BATTLE' && (isDefender ? "椅子を選べ" : "放電せよ")}
            {gameState.phase === 'RESULT' && (gameState.trap === gameState.defenderChoice ? "⚡️ SHOCK ⚡️" : "SAFE")}
          </div>

          {gameState.phase === 'SETUP' && isAttacker && (
            <button onClick={() => updateDB({ phase: 'BATTLE' })} disabled={gameState.trap === null} className="w-full py-3 bg-zinc-100 text-black font-bold">SET完了</button>
          )}
          {gameState.phase === 'BATTLE' && isAttacker && (
            <button onClick={fireShock} disabled={gameState.defenderChoice === null} className="w-full py-4 bg-red-600 text-white font-bold rounded-full border-4 border-red-900 animate-pulse">放電</button>
          )}
          {gameState.phase === 'RESULT' && (
            <button onClick={nextTurn} className="w-full py-3 bg-yellow-500 text-black font-bold">NEXT</button>
          )}
        </div>
      </div>
    </div>
  );
}
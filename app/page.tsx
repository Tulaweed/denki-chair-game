"use client";

import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, remove } from 'firebase/database';

// --- Firebase 設定 (ご自身の値に必ず差し替えてください) ---
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://denki-chair-game-default-rtdb.firebaseio.com/", 
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);
const gameRef = ref(db, 'denki-chair/room1');

const TOTAL_CHAIRS = 12;
const MAX_ROUNDS = 8;
const WINNING_SCORE = 40;
const RADIUS = 140;

export default function DenkiChairOnline() {
  const [myRole, setMyRole] = useState<'A' | 'B' | null>(null);
  const [inputName, setInputName] = useState("");
  const [gameState, setGameState] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGameState(data);
    });
    return () => unsubscribe();
  }, []);

  const entry = (role: 'A' | 'B') => {
    if (!inputName.trim()) {
      alert("名前を入力してください");
      return;
    }
    setMyRole(role);
    
    // 現在のDB状態を確認
    const currentNames = gameState?.names || {};
    const isFirstPlayer = !gameState || !gameState.names;

    if (isFirstPlayer) {
      // 1人目の入室：DBを完全初期化
      const initialData = {
        phase: 'WAITING', // 2人目を待つ状態
        round: 1,
        attackerSide: 'B', 
        removedChairs: [],
        trap: null,
        defenderChoice: null,
        scores: { A: 0, B: 0 },
        shocks: { A: 0, B: 0 },
        historyA: Array(MAX_ROUNDS).fill(""),
        historyB: Array(MAX_ROUNDS).fill(""),
        names: { 
          A: role === 'A' ? inputName : null, 
          B: role === 'B' ? inputName : null 
        }
      };
      set(gameRef, initialData);
    } else {
      // 2人目の入室：名前を更新し、フェーズをSETUPへ
      const updates: any = {};
      updates[`names/${role}`] = inputName;
      updates[`phase`] = 'SETUP'; 
      update(gameRef, updates);
    }
  };

  const resetGame = () => {
    remove(gameRef).then(() => {
      window.location.reload();
    });
  };

  if (!myRole || !gameState) {
    // どちらの枠が埋まっているか判定
    const isAFilled = gameState?.names?.A && gameState?.names?.A !== "null";
    const isBFilled = gameState?.names?.B && gameState?.names?.B !== "null";

    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-black italic text-red-600 mb-8 tracking-tighter uppercase">電気イスゲーム</h1>
        <div className="bg-zinc-900 p-6 border-t-4 border-red-600 w-full max-w-xs shadow-2xl">
          <input 
            className="w-full bg-black border border-zinc-700 p-3 mb-6 text-center text-lg focus:border-red-600 outline-none"
            placeholder="名前を入力"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
          />
          <div className="flex flex-col gap-4">
            <button 
              onClick={() => !isAFilled && entry('A')} 
              disabled={isAFilled}
              className={`group flex flex-col items-center py-4 font-bold transition relative ${isAFilled ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-zinc-100 text-black hover:bg-white'}`}
            >
              <span className="text-xs">最初に座る</span>
              <span className="text-xl">先攻で参戦</span>
              {isAFilled && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded">入室済: {gameState.names.A}</span>}
            </button>
            <button 
              onClick={() => !isBFilled && entry('B')} 
              disabled={isBFilled}
              className={`group flex flex-col items-center py-4 font-bold transition relative ${isBFilled ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-blue-900 text-white hover:bg-blue-800'}`}
            >
              <span className="text-xs text-zinc-400">最初に罠を仕掛ける</span>
              <span className="text-xl">後攻で参戦</span>
              {isBFilled && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-1 rounded">入室済: {gameState.names.B}</span>}
            </button>
          </div>
          <button onClick={resetGame} className="w-full mt-6 text-[10px] text-zinc-600 hover:text-zinc-400 underline uppercase">強制リセット</button>
        </div>
      </div>
    );
  }

  // --- ゲームロジック ---
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
    let newHistory = [...(gameState[sideKey] || Array(MAX_ROUNDS).fill(""))];
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

    updateDB({ scores: newScores, shocks: newShocks, [sideKey]: newHistory, removedChairs: newRemoved, phase: 'RESULT' });
  };

  const nextTurn = () => {
    if (gameState.scores.A >= WINNING_SCORE || gameState.shocks.B >= 3 || gameState.scores.B >= WINNING_SCORE || gameState.shocks.A >= 3) {
      updateDB({ phase: 'GAMEOVER' });
      return;
    }
    const isRoundEnd = gameState.attackerSide === (gameState.historyA?.[0] === "" ? 'B' : 'A');
    updateDB({
      round: isRoundEnd ? (gameState.round || 1) + 1 : gameState.round,
      attackerSide: defenderSide,
      trap: null,
      defenderChoice: null,
      phase: 'SETUP'
    });
  };

  return (
    <div className="min-h-screen bg-stone-950 text-white p-2 font-mono flex flex-col items-center">
      {/* スコアボード */}
      <div className="w-full max-w-lg bg-black border border-zinc-700 mb-4 p-2 shadow-xl">
        <table className="w-full text-center text-[10px] border-collapse table-fixed">
          <thead>
            <tr className="bg-zinc-900 text-zinc-500 italic uppercase">
              <th className="p-1 border-r border-zinc-800 w-16">NAME</th>
              {[...Array(MAX_ROUNDS)].map((_, i) => <th key={i} className={`border-r border-zinc-800 ${gameState.round === i+1 ? 'text-yellow-500 bg-zinc-800' : ''}`}>{i+1}</th>)}
              <th className="text-red-500 w-10">TOTAL</th>
            </tr>
          </thead>
          <tbody className="font-bold uppercase">
            <tr className="border-t border-zinc-800 h-8">
              <td className="border-r border-zinc-800 truncate px-1 text-[8px]">{gameState.names?.A || "Waiting..."}</td>
              {gameState.historyA?.map((h:any, i:number) => <td key={i} className="border-r border-zinc-800 text-yellow-500">{h}</td>)}
              <td className="text-yellow-500 bg-zinc-900">{gameState.scores?.A || 0}</td>
            </tr>
            <tr className="border-t border-zinc-800 h-8">
              <td className="border-r border-zinc-800 truncate px-1 text-[8px]">{gameState.names?.B || "Waiting..."}</td>
              {gameState.historyB?.map((h:any, i:number) => <td key={i} className="border-r border-zinc-800 text-yellow-500">{h}</td>)}
              <td className="text-yellow-500 bg-zinc-900">{gameState.scores?.B || 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ステージ */}
      <div className="relative w-72 h-72 flex items-center justify-center my-8">
        {Array.from({ length: TOTAL_CHAIRS }).map((_, i) => {
          const angle = (i * 360) / TOTAL_CHAIRS;
          const x = RADIUS * 0.8 * Math.cos((angle - 90) * (Math.PI / 180));
          const y = RADIUS * 0.8 * Math.sin((angle - 90) * (Math.PI / 180));
          const isRemoved = (gameState.removedChairs || []).includes(i);
          const showTrap = (isAttacker && gameState.phase === 'SETUP') || gameState.phase === 'RESULT';
          
          let btnClass = "bg-zinc-900 border-zinc-800 text-zinc-600";
          if (!isRemoved) {
            if (showTrap && gameState.trap === i) btnClass = "bg-red-900 border-red-500 text-white animate-pulse shadow-[0_0_15px_red]";
            if (gameState.defenderChoice === i) btnClass = "bg-blue-600 border-white text-white ring-4 ring-blue-500/50 scale-110 z-10 shadow-2xl";
            if (gameState.phase === 'RESULT' && gameState.trap === i) btnClass = "bg-yellow-400 border-white text-black scale-125 z-20 shadow-[0_0_30px_yellow]";
            if (gameState.phase === 'RESULT' && gameState.defenderChoice === i && gameState.trap !== i) btnClass = "bg-green-600 border-white text-white";
          }

          return (
            <button key={i} onClick={() => !isRemoved && handleChairClick(i)} 
              disabled={isRemoved || gameState.phase === 'RESULT' || gameState.phase === 'WAITING'}
              className={`absolute w-10 h-10 rounded-sm border flex items-center justify-center font-black text-sm transition-all duration-300 ${isRemoved ? 'opacity-0 scale-0 pointer-events-none' : ''} ${btnClass}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              {i + 1}
            </button>
          );
        })}
        <div className="text-center">
            <div className={`px-4 py-1 text-[10px] font-black italic shadow-lg skew-x-[-15deg] mb-1 ${isAttacker ? 'bg-red-700' : 'bg-blue-700'}`}>
            {isAttacker ? 'ATTACKER' : 'DEFENDER'}
            </div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase">
                {myRole === 'A' ? gameState.names?.A : gameState.names?.B}
            </div>
        </div>
      </div>

      {/* 操作パネル */}
      <div className="w-full max-w-xs bg-zinc-900 p-6 border border-zinc-800 text-center shadow-2xl">
        <div className="h-12 mb-4 flex items-center justify-center text-[10px] text-zinc-300 italic font-bold">
          {gameState.phase === 'WAITING' && "対戦相手の入室を待っています..."}
          {gameState.phase === 'SETUP' && (isAttacker ? "罠を仕掛けろ" : "相手が罠を仕掛けている")}
          {gameState.phase === 'BATTLE' && (isDefender ? "椅子を選択せよ" : "放電せよ")}
          {gameState.phase === 'RESULT' && (gameState.trap === gameState.defenderChoice ? "⚡️ 感電：スコア没収 ⚡️" : `SAFE！ +${(gameState.defenderChoice ?? 0) + 1} PT`)}
          {gameState.phase === 'GAMEOVER' && `GAME OVER - WINNER: ${gameState.scores?.A > gameState.scores?.B ? gameState.names?.A : gameState.names?.B}`}
        </div>

        <div className="flex flex-col gap-3">
          {gameState.phase === 'SETUP' && isAttacker && (
            <button onClick={() => updateDB({ phase: 'BATTLE' })} disabled={gameState.trap === null} className="w-full py-4 bg-zinc-100 text-black font-black hover:bg-white active:scale-95 transition-all shadow-lg">決定</button>
          )}
          {gameState.phase === 'BATTLE' && isAttacker && (
            <button onClick={fireShock} disabled={gameState.defenderChoice === null} className="w-full py-6 bg-red-600 text-white font-black text-2xl rounded-full border-8 border-red-900 animate-pulse active:scale-90 transition-all">放電</button>
          )}
          {gameState.phase === 'RESULT' && (
            <button onClick={nextTurn} className="w-full py-4 bg-yellow-500 text-black font-black hover:bg-yellow-400 active:scale-95 transition-all uppercase italic">Next Round</button>
          )}
          {gameState.phase === 'GAMEOVER' && (
            <button onClick={resetGame} className="w-full py-4 bg-white text-black font-black hover:bg-zinc-200 transition-all uppercase">New Game</button>
          )}
        </div>
      </div>
    </div>
  );
}
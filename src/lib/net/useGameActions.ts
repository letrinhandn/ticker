"use client";

import { useEffect, useRef } from "react";
import { isBotPlayerId } from "@/lib/game/bots/botRoster";
import { useGameFxOptional } from "@/lib/fx/GameFxContext";
import { useRoom } from "./RoomContext";

export const ROLL_MS = 1200;

export function useGameActions() {
  const {
    playerId,
    snapshot,
    send,
    diceRolling,
    setDiceRolling,
    tokensMoving,
    setTokensMoving,
  } = useRoom();
  const gameFx = useGameFxOptional();
  const fxBusy = gameFx?.fxBusy ?? false;
  const game = snapshot?.game ?? null;
  const rollTimer = useRef<number | null>(null);
  const turnKey = game
    ? `${game.turnIndex}:${game.players[game.turnIndex]?.id ?? ""}:${game.lastDice?.[0] ?? "x"}:${game.pending?.type ?? "none"}`
    : "";

  useEffect(() => {
    return () => {
      if (rollTimer.current) window.clearTimeout(rollTimer.current);
    };
  }, []);

  const me = game?.players.find((p) => p.id === playerId) ?? null;
  const current = game ? game.players[game.turnIndex] : null;
  const isAutoPlay = Boolean(snapshot?.autoPlay);
  const isMyTurn = Boolean(
    current && playerId && current.id === playerId && !isAutoPlay,
  );
  const pending = game?.pending ?? null;
  const isBotTurn = Boolean(
    current && (isBotPlayerId(current.id) || isAutoPlay),
  );
  const hasBotRival = Boolean(game?.players.some((p) => isBotPlayerId(p.id)));
  const isSpectator = Boolean(
    game &&
      ((playerId && !game.players.some((p) => p.id === playerId)) || isAutoPlay),
  );

  const blockingPending =
    pending?.type === "info" ||
    pending?.type === "price_reaction" ||
    pending?.type === "regime" ||
    pending?.type === "trade";

  const turnReadyToRoll =
    Boolean(game) &&
    isMyTurn &&
    !me?.bankrupt &&
    !blockingPending &&
    (!game!.lastDice || pending?.type === "halt");

  useEffect(() => {
    if (!turnReadyToRoll) return;
    setDiceRolling(false);
    setTokensMoving(false);
    if (rollTimer.current) {
      window.clearTimeout(rollTimer.current);
      rollTimer.current = null;
    }
  }, [turnKey, turnReadyToRoll, setDiceRolling, setTokensMoving]);

  useEffect(() => {
    if (!diceRolling && !tokensMoving) return;
    const t = window.setTimeout(() => {
      setDiceRolling(false);
      setTokensMoving(false);
    }, 4500);
    return () => window.clearTimeout(t);
  }, [diceRolling, tokensMoving, setDiceRolling, setTokensMoving]);

  // Cards only after dice + hop finish — no gap between the two flags.
  const motionBusy = diceRolling || tokensMoving;
  const presentationBusy = (motionBusy && !turnReadyToRoll) || fxBusy;
  const revealPending = !motionBusy;

  const canRoll = turnReadyToRoll && !diceRolling;

  const canEnd =
    Boolean(game) &&
    isMyTurn &&
    !diceRolling &&
    !tokensMoving &&
    !fxBusy &&
    !pending &&
    Boolean(game!.lastDice);

  const roll = () => {
    if (!turnReadyToRoll) return;
    // Keep tokensMoving true through dice → hop so cards never open mid-travel.
    setDiceRolling(true);
    setTokensMoving(true);
    void import("@/lib/sfx/sounds").then(({ playDiceRoll, unlockSfx }) => {
      unlockSfx();
      playDiceRoll();
    });
    send({ type: "roll" });
    if (rollTimer.current) window.clearTimeout(rollTimer.current);
    rollTimer.current = window.setTimeout(() => {
      setDiceRolling(false);
    }, ROLL_MS);
  };

  const endTurn = () => {
    if (!canEnd) return;
    send({ type: "end_turn" });
  };

  useEffect(() => {
    if (!canEnd || !game || isSpectator) return;
    if (!hasBotRival) return;
    // Immediate advance — peg FX already provided the beat.
    const t = window.setTimeout(() => {
      send({ type: "end_turn" });
    }, 50);
    return () => window.clearTimeout(t);
  }, [canEnd, send, game, hasBotRival, isSpectator]);

  // Safety only: normal path is GameHUD dismiss right after mill/sectors.
  useEffect(() => {
    if (!game || !isBotTurn || !blockingPending) return;
    const wait = pending?.type === "price_reaction" ? 26000 : 8000;
    const t = window.setTimeout(() => send({ type: "dismiss" }), wait);
    return () => window.clearTimeout(t);
  }, [game, isBotTurn, blockingPending, turnKey, send, pending?.type]);

  return {
    game,
    playerId,
    me,
    current,
    isMyTurn,
    isBotTurn,
    isSpectator,
    pending,
    canRoll,
    canEnd,
    diceRolling,
    tokensMoving,
    fxBusy: presentationBusy,
    revealPending,
    roll,
    endTurn,
    send,
  };
}

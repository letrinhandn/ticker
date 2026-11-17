import { Server, type Connection, type ConnectionContext } from "partyserver";
import {
  MAX_PLAYERS,
  nextPlayerToken,
  PROTOCOL_VERSION,
  type ClientMessage,
  type LobbySeat,
  type RoomSnapshot,
  type ServerMessage,
} from "../src/shared/types";
import {
  isBotPlayerId,
  pickBotFundName,
  resolveBotFundName,
} from "../src/lib/game/bots/botRoster";
import { stepBot } from "../src/lib/game/bots/botRunner";
import { applyAction, createGame, type EngineAction } from "../src/lib/game/engine";
import {
  BOT_ID,
  BOT_MAX_STEPS,
  isFxCardPending,
  send,
  sleepWhile,
} from "./lib";
import type { ConnState, Env, PersistedLobby } from "./types";

export class PlotRoom extends Server<Env> {
  // Keep lobby seats in memory — hibernate was wiping seats between WS messages.
  static options = { hibernate: false };

  hostId: string | null = null;
  seats: LobbySeat[] = [];
  /** Empty chairs waiting to be claimed or filled with a fund. */
  openSlots = 0;
  /** Safety timer: auto-dismiss card if client never sends dismiss. */
  private cardSafetyTimer: ReturnType<typeof setTimeout> | null = null;
  private cardSafetyGen = 0;
  game: ReturnType<typeof createGame> | null = null;
  /** Humans in the room who are not seated (invitees + auto-play spectators). */
  private viewers = new Set<string>();
  private waitingNames = new Map<string, string>();
  private autoPlay = false;
  private botRunning = false;
  private botGen = 0;
  private botSeq = 0;
  private lobbyLoaded = false;

  async onStart() {
    await this.loadLobby();
  }

  private async loadLobby() {
    if (this.lobbyLoaded) return;
    this.lobbyLoaded = true;
    try {
      const saved = await this.ctx.storage.get<PersistedLobby>("lobby");
      if (!saved) return;
      this.hostId = saved.hostId;
      this.seats = saved.seats ?? [];
      this.openSlots = saved.openSlots ?? 0;
      this.viewers = new Set(saved.viewers ?? []);
      this.waitingNames = new Map(saved.waitingNames ?? []);
      this.autoPlay = Boolean(saved.autoPlay);
      this.botSeq = saved.botSeq ?? 0;
    } catch {
      /* ignore corrupt lobby blob */
    }
  }

  private async saveLobby() {
    const blob: PersistedLobby = {
      hostId: this.hostId,
      seats: this.seats,
      openSlots: this.openSlots,
      viewers: [...this.viewers],
      waitingNames: [...this.waitingNames.entries()],
      autoPlay: this.autoPlay,
      botSeq: this.botSeq,
    };
    try {
      await this.ctx.storage.put("lobby", blob);
    } catch {
      /* best-effort */
    }
  }

  private snapshot(): RoomSnapshot {
    return {
      protocolVersion: PROTOCOL_VERSION,
      roomCode: this.name.toUpperCase(),
      hostId: this.hostId,
      seats: this.seats,
      openSlots: this.openSlots,
      waiting: [...this.viewers].map((playerId) => ({
        playerId,
        name: this.waitingNames.get(playerId) ?? "Guest",
      })),
      game: this.game,
      autoPlay: this.autoPlay,
    };
  }

  /** Human seat left mid-match (disconnect or leave-to-spectate). */
  private isAwayHuman(playerId: string) {
    const seat = this.findSeat(playerId);
    return Boolean(seat && !seat.isBot && !seat.connected);
  }

  /**
   * Auto-play drives every seat; otherwise fund bots + any human who left
   * mid-game so the table never stalls on an empty chair.
   */
  private shouldAutoDrive(playerId: string) {
    return (
      this.autoPlay || this.isBotId(playerId) || this.isAwayHuman(playerId)
    );
  }

  private resumeAutoDriveIfNeeded() {
    if (!this.game || this.game.phase !== "playing" || this.botRunning) return;
    const current = this.game.players[this.game.turnIndex];
    if (current && this.shouldAutoDrive(current.id)) {
      void this.runBots();
    }
  }

  private tableSlots(): number {
    return this.seats.length + this.openSlots;
  }

  private broadcastSnapshot() {
    const msg: ServerMessage = { type: "snapshot", snapshot: this.snapshot() };
    this.broadcast(JSON.stringify(msg));
    void this.saveLobby();
  }

  private findSeat(playerId: string) {
    return this.seats.find((s) => s.playerId === playerId);
  }

  private humanSeats() {
    return this.seats.filter((s) => !s.isBot);
  }

  private botSeats() {
    return this.seats.filter((s) => s.isBot);
  }

  private hasBot() {
    return this.botSeats().length > 0;
  }

  private connectedHumans() {
    return this.humanSeats().filter((s) => s.connected);
  }

  private isBotId = (playerId: string) =>
    Boolean(this.findSeat(playerId)?.isBot) || isBotPlayerId(playerId);

  private ensureHost(preferId?: string) {
    const humans = this.connectedHumans();
    if (preferId && humans.some((s) => s.playerId === preferId)) {
      this.hostId = preferId;
      return;
    }
    if (this.hostId && humans.some((s) => s.playerId === this.hostId)) return;
    this.hostId = humans[0]?.playerId ?? null;
  }

  private canStart(playerId: string) {
    const seat = this.findSeat(playerId);
    if (!seat || seat.isBot) return false;
    // Messaging proves presence (survives Strict Mode double-mount disconnect races).
    seat.connected = true;
    const humans = this.humanSeats();
    // Sole human at the table always manages (host badge may lag after reconnect).
    if (humans.length === 1 && humans[0]?.playerId === playerId) {
      this.hostId = playerId;
      return true;
    }
    this.ensureHost(playerId);
    return this.hostId === playerId;
  }

  /** Host seat, or any spectator when the table has no humans (watch lobby). */
  private canManageLobby(playerId: string) {
    const seat = this.findSeat(playerId);
    if (seat && !seat.isBot) return this.canStart(playerId);
    return this.humanSeats().length === 0 && this.viewers.has(playerId);
  }

  private nextBotId(): string {
    if (!this.seats.some((s) => s.playerId === BOT_ID)) return BOT_ID;
    this.botSeq += 1;
    return `bot-${this.botSeq}`;
  }

  private seatHuman(
    playerId: string,
    name: string,
  ): LobbySeat {
    const token = nextPlayerToken(this.seats.map((s) => s.token));
    const seat: LobbySeat = {
      playerId,
      name: name || (this.humanSeats().length === 0 ? "Host" : "Guest"),
      token,
      ready: false,
      connected: true,
      isBot: false,
    };
    this.seats.push(seat);
    this.viewers.delete(playerId);
    this.waitingNames.delete(playerId);
    if (!this.hostId || !this.findSeat(this.hostId)) {
      this.hostId = playerId;
    }
    this.ensureHost(playerId);
    return seat;
  }

  private markWaiting(playerId: string, name: string) {
    this.viewers.add(playerId);
    this.waitingNames.set(playerId, name.slice(0, 16) || "Guest");
  }

  /**
   * Safety ceiling while waiting for the client to finish presenting.
   * Clients send `dismiss` when FX completes; that applies immediately for bots.
   * These values are only the fallback if no client advances the turn.
   */
  private pendingPresentMs(
    pending: NonNullable<typeof this.game>["pending"],
  ): number {
    if (!pending) return 0;
    const auto = this.autoPlay;
    switch (pending.type) {
      case "info":
        return auto ? 2800 : 3200;
      case "trade":
        return auto ? 3000 : 3400;
      case "price_reaction":
        // Safety only — client dismiss after pegs is the gate (incl. autoPlay).
        return auto ? 12000 : 14000;
      case "regime":
        // Deal + flip + lock + gather + shuffle + pegs (client dismiss is gate).
        return auto ? 14000 : 16000;
      case "halt":
        return auto ? 1400 : 1600;
      default:
        return 0;
    }
  }

  /** Invalidate any in-flight bot loop so a new runBots can start. */
  private cancelBotLoop() {
    this.botGen += 1;
    this.botRunning = false;
    this.clearCardSafety();
  }

  private clearCardSafety() {
    if (this.cardSafetyTimer != null) {
      clearTimeout(this.cardSafetyTimer);
      this.cardSafetyTimer = null;
    }
    this.cardSafetyGen += 1;
  }

  /**
   * Card FX is client-driven. Park the bot loop and resume when the client
   * dismisses (or when the safety timer fires). Never block the DO on a
   * multi-second await — that delayed dismiss by ~10s.
   */
  private parkForCardFx(presentMs: number, gen: number) {
    this.broadcastSnapshot();
    this.clearCardSafety();
    const safetyGen = this.cardSafetyGen;
    this.cardSafetyTimer = setTimeout(() => {
      if (safetyGen !== this.cardSafetyGen) return;
      if (gen !== this.botGen) return;
      if (!this.game || this.game.phase !== "playing") return;
      const current = this.game.players[this.game.turnIndex];
      if (!current || !this.shouldAutoDrive(current.id)) return;
      if (!isFxCardPending(this.game.pending)) return;
      this.game = applyAction(this.game, current.id, { type: "dismiss" });
      this.broadcastSnapshot();
      void this.runBots();
    }, presentMs);
  }

  /**
   * Drive auto seats step-by-step (funds always; every seat when autoPlay).
   * Card/info/PR/news: yield to client FX; client dismiss resumes this loop.
   */
  private async runBots() {
    if (this.botRunning) return;
    const gen = ++this.botGen;
    this.botRunning = true;
    const isDriven = (id: string) => this.shouldAutoDrive(id);
    try {
      for (let batch = 0; batch < 64; batch++) {
        let steps = 0;
        for (; steps < BOT_MAX_STEPS; steps++) {
          if (gen !== this.botGen) return;
          if (!this.game || this.game.phase !== "playing") return;

          const current = this.game.players[this.game.turnIndex];
          if (!current || current.bankrupt || !isDriven(current.id)) return;

          const pending = this.game.pending;
          const presentMs = this.pendingPresentMs(pending);

          // Yield on FX cards — do not await. Client dismiss (or safety) resumes.
          if (isFxCardPending(pending) && presentMs > 0) {
            this.parkForCardFx(presentMs, gen);
            return;
          }

          // Trade desk / halt: short in-loop beat is fine.
          if (presentMs > 0) {
            this.broadcastSnapshot();
            const ok = await sleepWhile(presentMs, () => gen === this.botGen);
            if (!ok) return;
            if (!this.game || this.game.phase !== "playing") return;
          }

          let step;
          try {
            step = stepBot(this.game, current.id, isDriven);
          } catch (e) {
            console.error("[bots] stepBot failed", e);
            step = null;
          }
          if (!step) {
            let forced = null;
            try {
              forced = this.forceBotProgress(current.id);
            } catch (e) {
              console.error("[bots] forceBotProgress failed", e);
            }
            if (!forced) return;
            this.game = forced;
            this.broadcastSnapshot();
            const ok = await sleepWhile(
              this.autoPlay ? 500 : 650,
              () => gen === this.botGen,
            );
            if (!ok) return;
            continue;
          }

          this.game = step.state;
          this.broadcastSnapshot();
          {
            const ok = await sleepWhile(
              step.delayMs,
              () => gen === this.botGen,
            );
            if (!ok) return;
          }
        }
        const still =
          this.game?.phase === "playing" &&
          this.game.players[this.game.turnIndex] &&
          isDriven(this.game.players[this.game.turnIndex]!.id);
        if (!still || steps === 0) return;
      }
    } finally {
      if (gen === this.botGen) this.botRunning = false;
    }
  }

  private forceBotProgress(botId: string) {
    if (!this.game) return null;
    const pending = this.game.pending;
    if (
      pending?.type === "info" ||
      pending?.type === "price_reaction" ||
      pending?.type === "regime"
    ) {
      return applyAction(this.game, botId, { type: "dismiss" });
    }
    if (pending?.type === "trade") {
      return applyAction(this.game, botId, { type: "trade", action: "skip" });
    }
    if (pending?.type === "halt") {
      return applyAction(
        this.game,
        botId,
        pending.canPay ? { type: "pay_jail" } : { type: "roll" },
      );
    }
    if (!this.game.lastDice) {
      return applyAction(this.game, botId, { type: "roll" });
    }
    return applyAction(this.game, botId, { type: "end_turn" });
  }

  private addBotSeat(preferredName?: string | null): boolean {
    if (this.game) return false;
    const bots = this.botSeats().length;

    // Auto-watch: exactly two funds. Play lobby: consume one open chair.
    if (this.autoPlay) {
      if (bots >= 2) return false;
    } else {
      if (this.openSlots < 1 || this.seats.length >= MAX_PLAYERS) return false;
      this.openSlots -= 1;
    }

    const token = nextPlayerToken(this.seats.map((s) => s.token));
    const taken = this.seats.map((s) => s.name);
    const name =
      (preferredName && resolveBotFundName(preferredName, taken)) ||
      pickBotFundName(Math.random, taken);

    this.seats.push({
      playerId: this.nextBotId(),
      name,
      token,
      ready: true,
      connected: true,
      isBot: true,
    });
    return true;
  }

  private async startAutoPlay() {
    if (this.game) return;
    if (this.seats.length < 2) return;
    this.cancelBotLoop();
    this.game = createGame(
      this.seats.map((s) => ({
        id: s.playerId,
        name: s.name,
        token: s.token,
      })),
    );
    this.broadcastSnapshot();
    await this.runBots();
  }

  async onConnect(connection: Connection<ConnState>, ctx: ConnectionContext) {
    await this.loadLobby();
    const url = new URL(ctx.request.url);
    const playerId = url.searchParams.get("playerId") ?? crypto.randomUUID();
    const name = (url.searchParams.get("name") ?? "Guest").slice(0, 16);
    const wantAuto =
      url.searchParams.get("bots") === "2" || url.searchParams.get("auto") === "1";
    const fund1 = url.searchParams.get("f1");
    const fund2 = url.searchParams.get("f2");
    connection.setState({ playerId });

    const existing = this.findSeat(playerId);
    if (existing) {
      existing.connected = true;
      existing.name = name || existing.name;
      this.viewers.delete(playerId);
      this.waitingNames.delete(playerId);
      this.ensureHost(playerId);
      send(connection, { type: "welcome", playerId, snapshot: this.snapshot() });
      this.broadcastSnapshot();
      if (this.game?.phase === "playing") {
        const current = this.game.players[this.game.turnIndex];
        // Reclaim control when a human returns to their seat.
        if (current?.id === playerId && !this.autoPlay) {
          this.cancelBotLoop();
        } else {
          this.resumeAutoDriveIfNeeded();
        }
      }
      return;
    }

    // Returning / joining spectator for an auto-play room.
    if (wantAuto || this.autoPlay) {
      this.autoPlay = true;
      this.markWaiting(playerId, name);

      if (this.seats.length === 0 && !this.game) {
        this.addBotSeat(fund1);
        this.addBotSeat(fund2);
      }

      send(connection, { type: "welcome", playerId, snapshot: this.snapshot() });
      this.broadcastSnapshot();

      if (!this.game && this.seats.length >= 2) {
        void this.startAutoPlay();
      } else {
        this.resumeAutoDriveIfNeeded();
      }
      return;
    }

    if (this.viewers.has(playerId)) {
      this.waitingNames.set(
        playerId,
        name || this.waitingNames.get(playerId) || "Guest",
      );
      send(connection, { type: "welcome", playerId, snapshot: this.snapshot() });
      this.broadcastSnapshot();
      return;
    }

    // In-progress match: land as spectator (watch only; seats stay as-is).
    if (this.game && this.game.phase === "playing") {
      this.markWaiting(playerId, name);
      send(connection, { type: "welcome", playerId, snapshot: this.snapshot() });
      this.broadcastSnapshot();
      this.resumeAutoDriveIfNeeded();
      return;
    }

    // Lobby full of seated players and no open chairs.
    if (this.seats.length >= MAX_PLAYERS && this.openSlots < 1) {
      send(connection, {
        type: "rejected",
        reason: `Room is full (${MAX_PLAYERS} players).`,
      });
      connection.close(1000, "full");
      return;
    }

    // Everyone joins as a spectator first, then claims a seat explicitly.
    // Empty play tables get two open chairs so the first guest can sit.
    if (
      this.seats.length === 0 &&
      this.openSlots === 0 &&
      this.botSeats().length === 0
    ) {
      this.openSlots = Math.min(2, MAX_PLAYERS);
    }
    this.markWaiting(playerId, name);

    send(connection, { type: "welcome", playerId, snapshot: this.snapshot() });
    this.broadcastSnapshot();
  }

  onClose(connection: Connection<ConnState>) {
    const playerId = connection.state?.playerId;
    if (!playerId) return;
    // Another live socket for the same player (e.g. React Strict Mode remount)?
    for (const conn of this.getConnections()) {
      if (conn !== connection && conn.state?.playerId === playerId) return;
    }
    this.viewers.delete(playerId);
    this.waitingNames.delete(playerId);
    const seat = this.findSeat(playerId);
    if (seat && !seat.isBot) {
      seat.connected = false;
      seat.ready = false;
    }
    if (this.hostId === playerId) {
      const nextHost = this.seats.find(
        (s) => s.connected && !s.isBot && s.playerId !== playerId,
      );
      this.hostId = nextHost?.playerId ?? playerId;
    }
    this.broadcastSnapshot();
    // Mid-game leave / disconnect: bot-drive that seat so the table continues.
    this.resumeAutoDriveIfNeeded();
  }

  onMessage(connection: Connection<ConnState>, message: string | ArrayBuffer) {
    if (typeof message !== "string") return;

    let raw: ClientMessage & { sessionId?: string };
    try {
      raw = JSON.parse(message) as ClientMessage & { sessionId?: string };
    } catch {
      send(connection, { type: "error", message: "Invalid JSON" });
      return;
    }

    // Recover sender id if conn state was dropped (never overwrite msg.playerId targets).
    let playerId = connection.state?.playerId ?? raw.sessionId;
    if (!playerId && raw.type === "hello") playerId = raw.playerId;
    if (!playerId) {
      send(connection, {
        type: "error",
        message: "Session lost. Refresh the page.",
      });
      return;
    }
    if (!connection.state?.playerId) {
      connection.setState({ playerId });
    }

    void this.handle(playerId, raw, connection).catch((e) => {
      this.cancelBotLoop();
      send(connection, {
        type: "error",
        message: e instanceof Error ? e.message : "Server error",
      });
    });
  }

  private async handle(
    playerId: string,
    msg: ClientMessage,
    connection: Connection<ConnState>,
  ) {
    // Auto-play spectators watch — but MUST forward dismiss so FX cards
    // clear immediately (otherwise only the safety timer advances, ~16s lag).
    // Restart also falls through; everything else is ignored (bot nudge only).
    if (this.autoPlay) {
      if (
        msg.type === "dismiss" &&
        this.game?.phase === "playing"
      ) {
        const current = this.game.players[this.game.turnIndex];
        const pending = this.game.pending;
        if (
          current &&
          pending &&
          (pending.type === "info" ||
            pending.type === "price_reaction" ||
            pending.type === "regime")
        ) {
          this.cancelBotLoop();
          this.game = applyAction(this.game, current.id, { type: "dismiss" });
          this.broadcastSnapshot();
          void this.runBots();
          return;
        }
      }
      if (msg.type !== "restart") {
        if (
          this.game?.phase === "playing" &&
          this.game.players[this.game.turnIndex] &&
          this.shouldAutoDrive(this.game.players[this.game.turnIndex]!.id) &&
          !this.botRunning
        ) {
          await this.runBots();
        }
        return;
      }
      // restart → fall through to switch
    }

    // Waiting invitees may claim a chair / update their name.
    // Bot-only (watch) lobbies: spectators may manage seats / start auto-play.
    if (this.viewers.has(playerId) && !this.findSeat(playerId)) {
      if (msg.type === "hello" && msg.name) {
        this.waitingNames.set(playerId, msg.name.slice(0, 16));
        this.broadcastSnapshot();
        return;
      }
      if (msg.type === "claim_seat") {
        if (this.game) {
          send(connection, { type: "error", message: "Match already started." });
          return;
        }
        if (this.openSlots < 1) {
          send(connection, {
            type: "error",
            message: "No open seats. Wait for the host to add one.",
          });
          return;
        }
        if (this.seats.length >= MAX_PLAYERS) {
          send(connection, { type: "error", message: "Room is full." });
          return;
        }
        this.openSlots -= 1;
        const name = this.waitingNames.get(playerId) ?? "Guest";
        this.seatHuman(playerId, name);
        this.broadcastSnapshot();
        return;
      }
      const watchLobby = this.humanSeats().length === 0;
      const watchManage =
        watchLobby &&
        (msg.type === "add_open_seat" ||
          msg.type === "remove_open_seat" ||
          msg.type === "add_bot" ||
          msg.type === "remove_bot" ||
          msg.type === "replace_bot" ||
          msg.type === "start_auto" ||
          msg.type === "kick");
      const viewerRestart = msg.type === "restart" && Boolean(this.game);
      if (!watchManage && !viewerRestart) {
        send(connection, {
          type: "error",
          message: "Take an open seat before managing the lobby.",
        });
        return;
      }
      // Fall through to switch for watch-lobby management / restart.
    }

    switch (msg.type) {
      case "hello": {
        const seat = this.findSeat(playerId);
        if (seat && msg.name && !seat.isBot) {
          seat.name = msg.name.slice(0, 16);
          this.broadcastSnapshot();
        }
        return;
      }
      case "set_ready": {
        if (this.game) return;
        const seat = this.findSeat(playerId);
        if (!seat || seat.isBot) return;
        seat.ready = !!msg.ready;
        this.broadcastSnapshot();
        return;
      }
      case "add_open_seat": {
        if (this.game) {
          send(connection, { type: "error", message: "Match already started." });
          return;
        }
        if (!this.canManageLobby(playerId)) {
          send(connection, {
            type: "error",
            message: "Only the host can add seats.",
          });
          return;
        }
        if (this.tableSlots() >= MAX_PLAYERS) {
          send(connection, {
            type: "error",
            message: `Table full (${MAX_PLAYERS} seats).`,
          });
          return;
        }
        this.openSlots += 1;
        this.broadcastSnapshot();
        return;
      }
      case "remove_open_seat": {
        if (!this.canManageLobby(playerId) || this.game) return;
        if (this.openSlots < 1) return;
        this.openSlots -= 1;
        this.broadcastSnapshot();
        return;
      }
      case "claim_seat": {
        // Already seated — ignore.
        return;
      }
      case "leave_seat": {
        const seat = this.findSeat(playerId);
        if (!seat || seat.isBot) return;
        // Mid-match: keep the chair in the game, mark away, and autoplay it.
        if (this.game?.phase === "playing") {
          seat.connected = false;
          seat.ready = false;
          if (this.hostId === playerId) this.ensureHost();
          this.broadcastSnapshot();
          this.resumeAutoDriveIfNeeded();
          return;
        }
        // Lobby: free the chair and become a waiting spectator.
        this.seats = this.seats.filter((s) => s.playerId !== playerId);
        this.openSlots += 1;
        this.markWaiting(playerId, seat.name);
        this.ensureHost();
        this.broadcastSnapshot();
        return;
      }
      case "add_bot": {
        if (this.game) {
          send(connection, {
            type: "error",
            message: "Match already started.",
          });
          return;
        }
        if (!this.canManageLobby(playerId)) {
          send(connection, {
            type: "error",
            message: "Only the host can add a fund seat.",
          });
          return;
        }
        if (!this.addBotSeat(msg.fund)) {
          send(connection, {
            type: "error",
            message: "Open a seat first, then assign a fund.",
          });
          return;
        }
        this.broadcastSnapshot();
        return;
      }
      case "remove_bot": {
        if (!this.canManageLobby(playerId) || this.game) return;
        let removed = false;
        if (msg.playerId) {
          const seat = this.findSeat(msg.playerId);
          if (!seat?.isBot) {
            send(connection, {
              type: "error",
              message: "That seat is not a fund.",
            });
            return;
          }
          this.seats = this.seats.filter((s) => s.playerId !== msg.playerId);
          removed = true;
        } else {
          for (let i = this.seats.length - 1; i >= 0; i--) {
            if (this.seats[i]?.isBot) {
              this.seats.splice(i, 1);
              removed = true;
              break;
            }
          }
        }
        if (removed) {
          this.openSlots += 1;
          this.broadcastSnapshot();
        }
        return;
      }
      case "replace_bot": {
        if (!this.canManageLobby(playerId) || this.game) return;
        const seat = this.findSeat(msg.playerId);
        if (!seat?.isBot) {
          send(connection, {
            type: "error",
            message: "Pick a fund seat to change.",
          });
          return;
        }
        const taken = this.seats
          .filter((s) => s.playerId !== seat.playerId)
          .map((s) => s.name);
        const next =
          (msg.fund && resolveBotFundName(msg.fund, taken)) ||
          pickBotFundName(Math.random, taken);
        if (next === seat.name && msg.fund) {
          // Same fund requested — still ack so UI can settle.
          this.broadcastSnapshot();
          return;
        }
        seat.name = next;
        this.broadcastSnapshot();
        return;
      }
      case "kick": {
        if (!this.canManageLobby(playerId) || this.game) return;
        if (msg.playerId === playerId) {
          send(connection, {
            type: "error",
            message: "Use leave seat to spectate, or leave the room.",
          });
          return;
        }
        const seat = this.findSeat(msg.playerId);
        if (!seat) return;
        this.seats = this.seats.filter((s) => s.playerId !== msg.playerId);
        this.openSlots += 1;
        if (this.hostId === msg.playerId) this.ensureHost(playerId);
        this.broadcastSnapshot();
        // Drop their socket if still connected.
        for (const conn of this.getConnections()) {
          if (conn.state?.playerId === msg.playerId) {
            try {
              conn.close(1000, "kicked");
            } catch {
              /* ignore */
            }
          }
        }
        return;
      }
      case "start_auto": {
        if (this.game) {
          send(connection, {
            type: "error",
            message: "Match already started.",
          });
          return;
        }
        if (!this.canManageLobby(playerId)) {
          send(connection, {
            type: "error",
            message: "Only host can start auto-play.",
          });
          return;
        }
        if (this.openSlots > 0) {
          send(connection, {
            type: "error",
            message: "Fill or remove open seats before starting.",
          });
          return;
        }

        // Empty watch table: seat two funds from optional names.
        if (this.seats.length < 2 && this.humanSeats().length === 0) {
          this.autoPlay = true;
          const names = [msg.fund1, msg.fund2].filter(Boolean) as string[];
          while (this.botSeats().length < 2) {
            const preferred = names[this.botSeats().length];
            if (!this.addBotSeat(preferred)) break;
          }
          if (this.botSeats().length < 2) {
            this.autoPlay = false;
            send(connection, {
              type: "error",
              message: "Need two funds for auto-play.",
            });
            this.broadcastSnapshot();
            return;
          }
        }

        if (this.seats.length < 2) {
          send(connection, {
            type: "error",
            message: "Need two ready seats for auto-play.",
          });
          return;
        }

        const humansReady = this.humanSeats().every(
          (s) => s.ready && s.connected,
        );
        if (!humansReady) {
          send(connection, {
            type: "error",
            message: "Ready up first.",
          });
          return;
        }

        // Keep seated funds and players; server drives every turn.
        this.openSlots = 0;
        this.autoPlay = true;
        await this.startAutoPlay();
        return;
      }
      case "start": {
        if (!this.canStart(playerId)) {
          send(connection, { type: "error", message: "Only host can start." });
          return;
        }
        if (this.seats.length < 2) {
          send(connection, { type: "error", message: "Need a friend or add a bot." });
          return;
        }
        if (this.openSlots > 0) {
          send(connection, {
            type: "error",
            message: "Fill or remove open seats before starting.",
          });
          return;
        }
        const humansReady = this.humanSeats().every((s) => s.ready && s.connected);
        if (!humansReady) {
          send(connection, { type: "error", message: "Ready up first." });
          return;
        }
        this.cancelBotLoop();
        this.game = createGame(
          this.seats.map((s) => ({ id: s.playerId, name: s.name, token: s.token })),
        );
        this.broadcastSnapshot();
        await this.runBots();
        return;
      }
      case "restart": {
        if (!this.game) {
          send(connection, { type: "error", message: "No match to restart." });
          return;
        }
        const restartOk = this.autoPlay
          ? this.viewers.has(playerId) || Boolean(this.findSeat(playerId))
          : this.canStart(playerId);
        if (!restartOk) {
          send(connection, {
            type: "error",
            message: "Only host can restart.",
          });
          return;
        }
        if (this.seats.length < 2) {
          send(connection, {
            type: "error",
            message: "Need a friend or add a bot.",
          });
          return;
        }
        this.cancelBotLoop();
        this.game = createGame(
          this.seats.map((s) => ({
            id: s.playerId,
            name: s.name,
            token: s.token,
          })),
        );
        this.broadcastSnapshot();
        await this.runBots();
        return;
      }
      case "roll":
      case "dismiss":
      case "trade":
      case "pay_jail":
      case "end_turn":
      case "declare_bankrupt": {
        if (!this.game || this.game.phase !== "playing") return;

        const current = this.game.players[this.game.turnIndex];
        const pending = this.game.pending;

        // Card FX finished on any client → advance as the current actor.
        // (Spectator / autoplay viewer must not wait out presentMs.)
        if (
          msg.type === "dismiss" &&
          current &&
          pending &&
          (pending.type === "info" ||
            pending.type === "price_reaction" ||
            pending.type === "regime")
        ) {
          this.cancelBotLoop();
          this.game = applyAction(this.game, current.id, { type: "dismiss" });
          this.broadcastSnapshot();
          void this.runBots();
          return;
        }

        if (current?.id === playerId) {
          const seat = this.findSeat(playerId);
          // Away / left-to-spectate seats stay bot-driven until they reconnect.
          if (seat && !seat.isBot && !seat.connected) {
            this.resumeAutoDriveIfNeeded();
            return;
          }
          this.cancelBotLoop();
          const action = msg as EngineAction;
          this.game = applyAction(this.game, playerId, action);
          this.broadcastSnapshot();
          void this.runBots();
          return;
        }

        // Nudge stuck auto-driven turns (non-dismiss).
        if (current && this.shouldAutoDrive(current.id)) {
          if (this.botRunning) this.cancelBotLoop();
          void this.runBots();
          return;
        }
        return;
      }
    }
  }
}

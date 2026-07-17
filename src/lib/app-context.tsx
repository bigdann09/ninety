import React, { createContext, useContext, useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@anchor-lang/core";
import idlJson from "./ninety-idl.json";
import { type Position, type SettledMarket } from "./mock-data";
import { API_URL, NINETY_PROGRAM_ID } from "./config";

export interface Fixture {
  id: string;
  competition: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  minute: number | null;
  state: "live" | "ht" | "soon" | "ended";
  kickoffIn?: string;
  openMarkets: number;
  velocity: number[];
  closingSoon?: boolean;
  rawMarkets?: any[];
  kickoffAt?: string;
}

export interface TournamentTeam {
  name: string;
  prob: number;
  matchId?: string;
  marketId?: string;
  marketStatus?: string;
  outcome?: boolean | null;
  yesVotes?: number;
  yesPoolSol?: number;
}

function formatKickoffIn(ms: number): string {
  if (ms <= 0) return "kicking off";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

interface AppContextType {
  isConnected: boolean;
  walletAddress: string;
  walletBalance: number;
  connectWallet: () => void;
  disconnectWallet: () => void;
  deductBalance: (amount: number) => void;
  slippage: number;
  setSlippage: (value: number) => void;
  priorityFee: string;
  setPriorityFee: (value: string) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  liveTelemetry: boolean;
  setLiveTelemetry: (value: boolean) => void;
  matches: Fixture[];
  positions: Position[];
  settled: SettledMarket[];
  isLoading: boolean;
  addPosition: (pos: Omit<Position, "id"> & { onChainPubkey?: string; txSig?: string }) => Promise<void>;
  refreshData: () => Promise<void>;
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  claimPosition: (stakeId: string, marketId: string) => Promise<void>;
  program: any;
  loyaltyInfo: any;
  recommendations: any[];
  tournamentTeams: TournamentTeam[];
  p2pChallenges: any[];
  fetchCopilot: (matchId: string) => Promise<{ commentary: string; suggestion: string; goalYesProb: number; cornerYesProb: number }>;
  cashoutPosition: (stakeId: string, marketId: string) => Promise<void>;
  createP2pChallenge: (data: { challenger_wallet: string; match_id: string; question: string; amount_sol: number; creator_side: string }) => Promise<void>;
  acceptP2pChallenge: (challengeId: string) => Promise<void>;
  p2pPlaceStake: (challengeId: string) => Promise<void>;
  resolveP2pChallenge: (challengeId: string, outcome: boolean) => Promise<void>;
  p2pClaimPayout: (challengeId: string) => Promise<void>;
}

const PROGRAM_ID = new anchor.web3.PublicKey(NINETY_PROGRAM_ID);

function toBytes32(str: string): number[] {
  const buf = Buffer.alloc(32);
  buf.write(str, "utf-8");
  return Array.from(buf);
}

const getMarketPda = (matchId: string, marketId: string) => {
  const matchBytes = Buffer.from(toBytes32(matchId));
  const marketBytes = Buffer.from(toBytes32(marketId));
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("market"), matchBytes, marketBytes],
    PROGRAM_ID
  );
  return pda;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const connectionContext = useConnection();
  const walletContext = useWallet();

  const connection = connectionContext ? connectionContext.connection : null;
  const publicKey = walletContext ? walletContext.publicKey : null;
  const disconnect = walletContext ? walletContext.disconnect : null;

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.5);
  const [priorityFee, setPriorityFee] = useState<string>("ACCELERATED");
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const [liveTelemetry, setLiveTelemetry] = useState<boolean>(true);

  // Dynamic backend data
  const [matches, setMatches] = useState<Fixture[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [settled, setSettled] = useState<SettledMarket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [tournamentTeams, setTournamentTeams] = useState<TournamentTeam[]>([]);
  const [p2pChallenges, setP2pChallenges] = useState<any[]>([]);

  const isConnected = !!publicKey;
  const walletAddress = publicKey ? publicKey.toBase58() : "";

  // Subscribe to balance
  useEffect(() => {
    if (!publicKey || !connection) {
      setWalletBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        const bal = await connection.getBalance(publicKey);
        setWalletBalance(bal / 1e9);
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      }
    };

    fetchBalance();

    const id = connection.onAccountChange(publicKey, (accountInfo) => {
      setWalletBalance(accountInfo.lamports / 1e9);
    });

    return () => {
      connection.removeAccountChangeListener(id);
    };
  }, [publicKey, connection]);

  // Construct Anchor Wallet and Program
  const anchorWallet = React.useMemo(() => {
    if (!publicKey || !walletContext?.signTransaction || !walletContext?.signAllTransactions) {
      return null;
    }
    return {
      publicKey,
      signTransaction: walletContext.signTransaction.bind(walletContext),
      signAllTransactions: walletContext.signAllTransactions.bind(walletContext),
    };
  }, [publicKey, walletContext]);

  const program = React.useMemo(() => {
    if (!anchorWallet || !connection) return null;
    const provider = new anchor.AnchorProvider(connection, anchorWallet as any, {
      commitment: "confirmed",
    });
    return new anchor.Program(idlJson as any, provider);
  }, [connection, anchorWallet]);

  const connectWallet = () => setIsWalletModalOpen(true);
  const disconnectWallet = () => {
    if (disconnect) {
      disconnect();
    }
  };
  const deductBalance = (amount: number) => setWalletBalance((prev) => Math.max(0, prev - amount));

  // Fetch matches from Express API
  const fetchMatches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/matches`);
      if (res.ok) {
        const data = await res.json();

        // Find all open markets
        const openMarketInfos: { matchId: string; marketId: string; pda: anchor.web3.PublicKey }[] = [];
        data.forEach((m: any) => {
          if (m.markets) {
            m.markets.forEach((mk: any) => {
              if (mk.status === "open") {
                openMarketInfos.push({
                  matchId: m.id,
                  marketId: mk.id,
                  pda: getMarketPda(m.id, mk.id)
                });
              }
            });
          }
        });

        // Fetch all open market account states from Solana in one batch
        const onChainPoolsMap: Record<string, { totalYesStake: number; totalNoStake: number }> = {};
        if (openMarketInfos.length > 0 && connection) {
          try {
            const pdas = openMarketInfos.map(info => info.pda);
            const accountsInfo = await connection.getMultipleAccountsInfo(pdas);
            const coder = new anchor.BorshAccountsCoder(idlJson as any);
            
            accountsInfo.forEach((accInfo, index) => {
              if (accInfo) {
                try {
                  const decoded: any = coder.decode("MarketAccount", accInfo.data);
                  const key = `${openMarketInfos[index].matchId}::${openMarketInfos[index].marketId}`;
                  const totalYesStake = decoded.totalYesStake !== undefined ? Number(decoded.totalYesStake) : Number(decoded.total_yes_stake);
                  const totalNoStake = decoded.totalNoStake !== undefined ? Number(decoded.totalNoStake) : Number(decoded.total_no_stake);
                  onChainPoolsMap[key] = {
                    totalYesStake,
                    totalNoStake
                  };
                } catch (decodeErr) {
                  console.error("Failed to decode market account:", decodeErr);
                }
              }
            });
          } catch (rpcErr) {
            console.error("Failed to fetch on-chain market accounts:", rpcErr);
          }
        }

        const mapped: Fixture[] = data.map((m: any) => {
          const kickoffMs = new Date(m.kickoff_at).getTime();
          const nowMs = Date.now();
          const elapsedMin = (nowMs - kickoffMs) / 60000;

          const isLive = m.status === "live" ||
            (m.status === "scheduled" && elapsedMin >= 0 && elapsedMin < 120);
          const isHT = m.status === "halftime";
          const isEnded = m.status === "full_time" || m.status === "fulltime" || m.status === "postponed" ||
            (m.status === "scheduled" && elapsedMin >= 120);

          const openMarkets = m.markets ? m.markets.filter((mk: any) => {
            if (isEnded) return true;
            if (mk.status !== "open") return false;
            if (isLive || isHT) {
              return new Date(mk.closes_at).getTime() > nowMs;
            }
            return true;
          }).length : 0;
          const velocity = [0.2, 0.3, 0.4, 0.5, 0.42, 0.6, 0.78, 0.92, 0.81, 0.7, 0.66, 0.74, 0.88, 0.95, 0.72, 0.6];

          let minute: number | null = null;
          if (isLive) {
            const diffMs = nowMs - kickoffMs;
            minute = Math.max(1, Math.min(90, Math.floor(diffMs / 60000)));
          }

          const marketsWithOnChain = (m.markets || []).map((mk: any) => {
            const dbStakeRows = mk.stakes || [];
            const yesVotes = dbStakeRows.filter((st: any) => st.side === "yes").length;
            const noVotes = dbStakeRows.filter((st: any) => st.side === "no").length;

            const key = `${m.id}::${mk.id}`;
            const onChain = onChainPoolsMap[key];
            if (onChain) {
              return {
                ...mk,
                yesVotes,
                noVotes,
                stakes: [
                  { side: "yes", amount_lamports: onChain.totalYesStake.toString() },
                  { side: "no", amount_lamports: onChain.totalNoStake.toString() }
                ]
              };
            }
            return { ...mk, yesVotes, noVotes };
          });

          const state = isLive ? "live" : isHT ? "ht" : isEnded ? "ended" : "soon";
          const kickoffIn =
            state === "soon" && m.kickoff_at
              ? formatKickoffIn(new Date(m.kickoff_at).getTime() - nowMs)
              : undefined;

          return {
            id: m.id,
            competition: m.competition,
            home: m.home_team,
            away: m.away_team,
            homeScore: m.score_home ?? 0,
            awayScore: m.score_away ?? 0,
            minute,
            state,
            kickoffIn,
            openMarkets,
            velocity,
            rawMarkets: marketsWithOnChain,
            kickoffAt: m.kickoff_at,
          };
        });
        setMatches(mapped);
      }
    } catch (err) {
      console.error("Error fetching matches:", err);
    }
  };

  // Fetch stakes from Express API
  const fetchStakes = async () => {
    if (!walletAddress) {
      setPositions([]);
      setSettled([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/stakes/wallet/${walletAddress}`);
      if (res.ok) {
        const data = await res.json();

        // Separate pending positions from settled ones
        const pendingList: Position[] = [];
        const settledList: SettledMarket[] = [];

        data.forEach((s: any) => {
          const stakeSol = Number(s.amount_lamports) / 1e9;
          
          const dbStakes = s.market?.stakes || [];
          const yesDbLamports = dbStakes.filter((st: any) => st.side === "yes").reduce((sum: number, st: any) => sum + Number(st.amount_lamports), 0);
          const noDbLamports = dbStakes.filter((st: any) => st.side === "no").reduce((sum: number, st: any) => sum + Number(st.amount_lamports), 0);

          const yesDbSol = yesDbLamports / 1e9;
          const noDbSol = noDbLamports / 1e9;

          const yesPoolSol = yesDbSol;
          const noPoolSol = noDbSol;
          const totalPoolSol = yesPoolSol + noPoolSol;

          const yesPrice = totalPoolSol > 0 ? yesPoolSol / totalPoolSol : 0.5;
          const noPrice = totalPoolSol > 0 ? noPoolSol / totalPoolSol : 0.5;

          const price = s.side === "yes" ? yesPrice : noPrice;
          const odds = 1 / price;
          const potentialPayout = stakeSol * odds;

          const kickoff = new Date(s.market?.match?.kickoff_at || Date.now());
          const diffMs = Date.now() - kickoff.getTime();
          const minute = Math.max(1, Math.min(90, Math.floor(diffMs / 60000)));

          const marketPdaStr = s.market?.match_id
            ? getMarketPda(s.market.match_id, s.market_id).toBase58()
            : s.market_id;

          if (s.market?.status === "settled" || s.cashed_out) {
            const won = s.cashed_out ? false : ((s.side === "yes" && s.market.outcome === true) || 
                        (s.side === "no" && s.market.outcome === false));
            
            const cashoutAmt = s.cashout_amount ? Number(s.cashout_amount) : 0;
            const pnl = s.cashed_out ? (cashoutAmt - stakeSol) : (won ? (potentialPayout - stakeSol) : -stakeSol);

            settledList.push({
              id: s.id,
              result: s.cashed_out ? "cashout" : (won ? "win" : "loss"),
              pnl,
              competition: s.market?.match?.competition || "World Cup 2026",
              context: s.cashed_out 
                ? `Cashed Out · +${cashoutAmt.toFixed(3)} SOL`
                : `Resolved · ${new Date(s.market?.updated_at || Date.now()).toLocaleTimeString()}`,
              home: s.market?.match?.home_team || "Home",
              away: s.market?.match?.away_team || "Away",
              marketQuestion: s.market?.question || "",
              odds,
              slot: 301229104, 
              txSig: s.tx_sig || s.id,
              settlement_tx_signature: s.settlement_tx_signature || s.market?.resolution_event_hash || null,
              nft_mint_address: s.nft_mint_address || null,
              nft_metadata_uri: s.nft_metadata_uri || null,
              claimed: s.cashed_out ? true : !!s.claimed,
              marketId: marketPdaStr,
              stake: stakeSol,
              cashoutAmount: s.cashout_amount
            } as any);
          } else {
            pendingList.push({
              id: s.id,
              marketId: marketPdaStr,
              matchId: s.market?.match_id || "",
              competition: s.market?.match?.competition || "World Cup 2026",
              home: s.market?.match?.home_team || "Home",
              away: s.market?.match?.away_team || "Away",
              marketQuestion: s.market?.question || "",
              side: s.side === "yes" ? "Yes" : "No",
              sideLabel: s.side === "yes" ? "Yes" : "No",
              stake: stakeSol,
              odds,
              potentialPayout,
              matchMinute: minute,
              matchProgress: minute / 90,
              txSig: s.tx_sig || undefined,
            });
          }
        });

        setPositions(pendingList);
        setSettled(settledList);
      }
    } catch (err) {
      console.error("Error fetching stakes:", err);
    }
  };

  const fetchLoyalty = async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${walletAddress}/loyalty`);
      if (res.ok) {
        const data = await res.json();
        setLoyaltyInfo(data);
      }
    } catch (err) {
      console.error("Failed to fetch loyalty:", err);
    }
  };

  const fetchRecommendations = async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_URL}/api/users/${walletAddress}/recommendations`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    }
  };

  const fetchP2pChallenges = async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_URL}/api/p2p/challenges/wallet/${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setP2pChallenges(data);
      }
    } catch (err) {
      console.error("Failed to fetch P2P challenges:", err);
    }
  };

  const fetchTournamentTeams = async () => {
    try {
      const res = await fetch(`${API_URL}/api/tournament`);
      if (res.ok) {
        const data = await res.json();
        setTournamentTeams(data);
      }
    } catch (err) {
      console.error("Failed to fetch tournament teams:", err);
    }
  };

  const refreshData = async () => {
    await Promise.all([fetchMatches(), fetchStakes(), fetchTournamentTeams()]);
    if (walletAddress) {
      await Promise.all([fetchLoyalty(), fetchRecommendations(), fetchP2pChallenges()]);
    }
  };

  const fetchCopilot = async (matchId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/copilot`);
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.error("Failed to fetch copilot info:", err);
    }
    return {
      commentary: "Match is progressing at a fierce pace. Prepare your stakes.",
      suggestion: "Monitor late game attacks before staking.",
      goalYesProb: 0.15,
      cornerYesProb: 0.45
    };
  };

  const cashoutPosition = async (stakeId: string, marketId: string) => {
    if (!program || !publicKey) {
      throw new Error("Wallet not connected");
    }
    try {
      const marketPda = new anchor.web3.PublicKey(marketId);
      const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        PROGRAM_ID
      );
      const [stakePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), marketPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        PROGRAM_ID
      );
      const config: any = await (program.account as any).programConfig.fetch(configPda);

      const txSig = await program.methods
        .cashout()
        .accounts({
          user: publicKey,
          config: configPda,
          market: marketPda,
          vault: vaultPda,
          stake: stakePda,
          treasury: config.treasury,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const res = await fetch(`${API_URL}/api/stakes/${stakeId}/cashout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, tx_sig: txSig }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Cashout recording failed");
      }
      await refreshData();
    } catch (err: any) {
      console.error("Cashout action error:", err);
      throw err;
    }
  };

  const createP2pChallenge = async (data: { challenger_wallet: string; match_id: string; question: string; amount_sol: number; creator_side: string }) => {
    try {
      const res = await fetch(`${API_URL}/api/p2p/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_wallet: walletAddress,
          challenger_wallet: data.challenger_wallet,
          match_id: data.match_id,
          question: data.question,
          amount_sol: data.amount_sol,
          creator_side: data.creator_side,
        })
      });
      if (res.ok) {
        await refreshData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "P2P Creation failed");
      }
    } catch (err: any) {
      console.error("P2P creation error:", err);
      throw err;
    }
  };

  // Opponent agrees to the wager — backend creates the on-chain escrow market. No funds
  // move yet; both sides still need to call p2pPlaceStake to actually fund their position.
  const acceptP2pChallenge = async (challengeId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/p2p/challenges/${challengeId}/accept`, {
        method: "POST"
      });
      if (res.ok) {
        await refreshData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "P2P Acceptance failed");
      }
    } catch (err: any) {
      console.error("P2P acceptance error:", err);
      throw err;
    }
  };

  const p2pPlaceStake = async (challengeId: string) => {
    if (!program || !publicKey) {
      throw new Error("Wallet not connected");
    }
    const challenge = p2pChallenges.find((c) => c.id === challengeId);
    if (!challenge || !challenge.market_pda) {
      throw new Error("Challenge has not been accepted yet (no escrow market)");
    }
    const isCreator = challenge.creator_wallet === walletAddress;
    const side = isCreator
      ? (challenge.creator_side === "yes" ? 0 : 1)
      : (challenge.creator_side === "yes" ? 1 : 0);
    const amountLamports = new anchor.BN(challenge.amount_lamports);

    const marketPda = new anchor.web3.PublicKey(challenge.market_pda);
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      PROGRAM_ID
    );
    const [stakePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), marketPda.toBuffer(), publicKey.toBuffer()],
      PROGRAM_ID
    );

    const txSig = await program.methods
      .placeStake(side, amountLamports)
      .accounts({
        user: publicKey,
        market: marketPda,
        vault: vaultPda,
        stake: stakePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const res = await fetch(`${API_URL}/api/p2p/challenges/${challengeId}/confirm-stake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, tx_sig: txSig }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to confirm P2P stake");
    }
    await refreshData();
  };

  const resolveP2pChallenge = async (challengeId: string, outcome: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/p2p/challenges/${challengeId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome })
      });
      if (res.ok) {
        await refreshData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "P2P Resolution failed");
      }
    } catch (err: any) {
      console.error("P2P resolution error:", err);
      throw err;
    }
  };

  // Winner claims their real payout after settlement — same claim_payout instruction as pool markets.
  const p2pClaimPayout = async (challengeId: string) => {
    if (!program || !publicKey) {
      throw new Error("Wallet not connected");
    }
    const challenge = p2pChallenges.find((c) => c.id === challengeId);
    if (!challenge || !challenge.market_pda) {
      throw new Error("Challenge has no escrow market");
    }
    if (challenge.winner_wallet !== walletAddress) {
      throw new Error("You are not the winner of this challenge");
    }

    const marketPda = new anchor.web3.PublicKey(challenge.market_pda);
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), marketPda.toBuffer()],
      PROGRAM_ID
    );
    const [stakePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("stake"), marketPda.toBuffer(), publicKey.toBuffer()],
      PROGRAM_ID
    );
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      PROGRAM_ID
    );
    const config: any = await (program.account as any).programConfig.fetch(configPda);

    const txSig = await program.methods
      .claimPayout()
      .accounts({
        user: publicKey,
        config: configPda,
        market: marketPda,
        vault: vaultPda,
        stake: stakePda,
        treasury: config.treasury,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const res = await fetch(`${API_URL}/api/p2p/challenges/${challengeId}/confirm-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: walletAddress, tx_sig: txSig }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to confirm P2P claim");
    }
    await refreshData();
  };

  const addPosition = async (newPos: Omit<Position, "id"> & { onChainPubkey?: string; txSig?: string }) => {
    try {
      const res = await fetch(`${API_URL}/api/stakes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market_id: newPos.marketId,
          user_wallet: walletAddress,
          side: newPos.side.toLowerCase(),
          amount_lamports: (newPos.stake * 1e9).toString(),
          on_chain_pubkey: newPos.onChainPubkey || null,
          tx_sig: newPos.txSig || null,
        }),
      });

      if (res.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error("Error adding stake:", err);
    }
  };

  // Claim payout on-chain
  const claimPosition = async (stakeId: string, marketId: string) => {
    if (!program || !publicKey) {
      throw new Error("Wallet not connected");
    }

    try {
      const marketPda = new anchor.web3.PublicKey(marketId);

      const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        PROGRAM_ID
      );

      const [stakePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("stake"), marketPda.toBuffer(), publicKey.toBuffer()],
        PROGRAM_ID
      );

      const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        PROGRAM_ID
      );
      const config: any = await (program.account as any).programConfig.fetch(configPda);

      const tx = await program.methods
        .claimPayout()
        .accounts({
          user: publicKey,
          config: configPda,
          market: marketPda,
          vault: vaultPda,
          stake: stakePda,
          treasury: config.treasury,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const res = await fetch(`${API_URL}/api/stakes/${stakeId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: walletAddress, tx_sig: tx }),
      });
      if (res.ok) {
        await refreshData();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Claim recording failed");
      }
    } catch (e: any) {
      console.error("Failed to claim payout:", e);
      alert(`Claim failed: ${e.message}`);
    }
  };

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await refreshData();
      setIsLoading(false);
    };

    load();

    const interval = setInterval(refreshData, 3000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  // Add high-contrast class to document element when active
  useEffect(() => {
    if (highContrast) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.remove("high-contrast");
    }
  }, [highContrast]);

  return (
    <AppContext.Provider
      value={{
        isConnected,
        walletAddress,
        walletBalance,
        connectWallet,
        disconnectWallet,
        deductBalance,
        slippage,
        setSlippage,
        priorityFee,
        setPriorityFee,
        reducedMotion,
        setReducedMotion,
        highContrast,
        setHighContrast,
        liveTelemetry,
        setLiveTelemetry,
        matches,
        positions,
        settled,
        isLoading,
        addPosition,
        refreshData,
        isWalletModalOpen,
        setIsWalletModalOpen,
        claimPosition,
        program,
        loyaltyInfo,
        recommendations,
        tournamentTeams,
        p2pChallenges,
        fetchCopilot,
        cashoutPosition,
        createP2pChallenge,
        acceptP2pChallenge,
        p2pPlaceStake,
        resolveP2pChallenge,
        p2pClaimPayout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

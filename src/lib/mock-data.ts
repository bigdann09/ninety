export type Fixture = {
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
};

export type Position = {
    id: string;
    marketId?: string;
    matchId: string;
    competition: string;
    home: string;
    away: string;
    marketQuestion: string;
    side: "Yes" | "No";
    sideLabel: string;
    stake: number;
    odds: number;
    potentialPayout: number;
    matchMinute: number;
    matchProgress: number;
    txSig?: string;
};

export type SettledMarket = {
    id: string;
    result: "win" | "loss" | "cashout";
    pnl: number;
    competition: string;
    context: string;
    home: string;
    away: string;
    marketQuestion: string;
    odds: number;
    slot: number;
    txSig: string;
    settlement_tx_signature?: string | null;
    nft_mint_address?: string | null;
    nft_metadata_uri?: string | null;
    claimed?: boolean;
    marketId?: string;
    stake?: number;
    cashoutAmount?: string | null;
};
